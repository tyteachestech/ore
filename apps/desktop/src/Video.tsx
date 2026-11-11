import { ArrowClockwise, ArrowCounterClockwise, Pause, Play } from "./icons";
import { resizeDrag } from "./drag";
import * as Popover from "@radix-ui/react-popover";
import * as Slider from "@radix-ui/react-slider";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { Hint } from "./Hint";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { load, save } from "./util";

// The YouTube player for a video source (D48, D50), driven over the embed's postMessage protocol
// (what YouTube's iframe_api script does, without loading a remote script into this webview).
// The embed sits inside a relay page the app serves at http://127.0.0.1:<port>/player
// (src-tauri/src/player.html): YouTube refuses tauri://localhost as an embedder (error 153).

const RATE_KEY = "ore.video.rate";
export const MIN_RATE = 0.5;
export const MAX_RATE = 2;
const PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2];

const clampRate = (r: number) => Math.min(MAX_RATE, Math.max(MIN_RATE, Math.round(r * 20) / 20));
const savedRate = () => clampRate(Number(load(RATE_KEY)) || 1);

export type Player = {
  frame: RefObject<HTMLIFrameElement | null>;
  src: string;
  ready: boolean;
  playing: boolean;
  /** Has played (or was resumed) at least once: the transcript dims what is not yet spoken (D49). */
  started: boolean;
  ended: boolean;
  error: number | null;
  /** The webview would not start playback from a command; the next click goes to YouTube itself. */
  blocked: boolean;
  duration: number;
  rate: number;
  /** Whole seconds, for the control row; `time()` is the smooth value. */
  elapsed: number;
  time: () => number;
  toggle: () => void;
  play: () => void;
  seek: (t: number) => void;
  skip: (by: number) => void;
  setRate: (r: number) => void;
};

/** Where a source's video picks up next time: where he stopped, or the start once it played to the
 *  end (YouTube's own resume), so a finished video reopens at 0, paused. */
export const resumeAt = (t: number, duration: number, ended: boolean) => (ended || (duration > 0 && t >= duration - 1) ? 0 : Math.floor(t));

/** One player per source; the position is saved per source and the rate once for all (D50). */
export function useYouTube(video: string | undefined, id: string): Player {
  const frame = useRef<HTMLIFrameElement>(null);
  const [port, setPort] = useState<number | null>(null);
  const origin = port ? `http://127.0.0.1:${port}` : "";
  const posKey = `ore.video.${id}`;
  const [start] = useState(() => Math.max(0, Math.floor(Number(load(posKey)) || 0)));
  const base = useRef({ t: start, at: performance.now(), playing: false, rate: savedRate() });
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(start > 0);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState<number | null>(null);
  const [blocked, setBlocked] = useState(false);
  const state = useRef(-1);
  const [duration, setDuration] = useState(0);
  const [rate, setRateState] = useState(base.current.rate);
  const [elapsed, setElapsed] = useState(start);
  const durationRef = useRef(0);
  // When the last seek was made: the embed keeps reporting the old position for a moment after one.
  const seekedAt = useRef(0);

  const time = useCallback(() => {
    const b = base.current;
    const t = b.playing ? b.t + ((performance.now() - b.at) / 1000) * b.rate : b.t;
    return durationRef.current ? Math.min(t, durationRef.current) : t;
  }, []);

  const post = useCallback((func: string, args: unknown[] = []) => {
    frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args, id: 1, channel: "widget" }), origin);
  }, [origin]);

  const persist = useCallback(() => {
    if (base.current.t > 0) save(posKey, String(resumeAt(time(), durationRef.current, state.current === 0)));
  }, [posKey, time]);

  useEffect(() => {
    if (video) invoke<number | null>("player_port").then((p) => (p ? setPort(p) : setError(-1)), () => setError(-1));
  }, [video]);

  // Handshake: the embed answers only after it hears "listening"; keep asking until it does.
  useEffect(() => {
    if (!video || !origin) return;
    let heard = false;
    const hello = setInterval(() => {
      if (heard) return clearInterval(hello);
      frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), origin);
    }, 250);
    const setBase = (patch: Partial<typeof base.current>) => {
      base.current = { ...base.current, t: time(), at: performance.now(), ...patch };
    };
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || typeof e.data !== "string") return;
      let msg: { event?: string; info?: unknown };
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (!heard) {
        heard = true;
        for (const ev of ["onReady", "onStateChange", "onPlaybackRateChange", "onError"]) post("addEventListener", [ev]);
      }
      if (msg.event === "onReady") {
        setReady(true);
        setError((e) => (e === -2 ? null : e));
        post("setPlaybackRate", [base.current.rate]);
      } else if (msg.event === "onError") {
        setError(Number(msg.info));
      } else if (msg.event === "onStateChange") {
        applyState(Number(msg.info));
      } else if (msg.event === "onPlaybackRateChange") {
        const r = Number(msg.info);
        if (r > 0) {
          setBase({ rate: r });
          setRateState(r);
        }
      } else if ((msg.event === "infoDelivery" || msg.event === "initialDelivery") && msg.info && typeof msg.info === "object") {
        const info = msg.info as { currentTime?: number; duration?: number; playerState?: number; playbackRate?: number };
        if (info.duration && info.duration > 0) {
          durationRef.current = info.duration;
          setDuration(info.duration);
        }
        if (info.playerState !== undefined) applyState(info.playerState);
        // A report from before the seek landed would pull the clock (and the lit transcript) back
        // to where he was; trust the seek until the embed agrees, or for two seconds.
        if (typeof info.currentTime === "number") {
          const settling = performance.now() - seekedAt.current < 2000;
          if (!settling || Math.abs(info.currentTime - time()) < 1) {
            seekedAt.current = 0;
            setBase({ t: info.currentTime });
          }
        }
        if (info.playbackRate && info.playbackRate > 0) setBase({ rate: info.playbackRate });
      }
    };
    // -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued. Only 1 advances the clock.
    const applyState = (s: number) => {
      state.current = s;
      const on = s === 1;
      if (on) setBlocked(false);
      // Captions off (the transcript below shows the words): the URL's cc_load_policy loses to his
      // YouTube account's setting, and the captions module only loads once playback starts.
      if (on && !base.current.playing) for (const m of ["captions", "cc"]) post("unloadModule", [m]);
      if (on !== base.current.playing) {
        setBase({ playing: on });
        if (!on) persist();
      }
      setPlaying(on);
      if (on) setStarted(true);
      setEnded(s === 0);
    };
    window.addEventListener("message", onMessage);
    return () => {
      clearInterval(hello);
      window.removeEventListener("message", onMessage);
    };
  }, [video, origin, post, time, persist]);

  // Offline, or YouTube never answers: say so instead of a black frame with dead controls. It
  // clears itself if the embed answers later.
  useEffect(() => {
    if (!video || !origin || ready) return;
    const t = setTimeout(() => setError((e) => e ?? -2), 15000);
    return () => clearTimeout(t);
  }, [video, origin, ready]);

  // A click that went through to the embed (a blocked play) leaves the keyboard inside YouTube's
  // frame, where the app's shortcuts (⌘F, Space, highlight keys) never arrive: take it back.
  useEffect(() => {
    const onBlur = () =>
      setTimeout(() => {
        const f = frame.current;
        if (f && document.activeElement === f) f.parentElement?.closest<HTMLElement>("[tabindex]")?.focus({ preventScroll: true });
      });
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, []);

  // The control row's clock and the saved position, while playing.
  useEffect(() => {
    if (!playing) return;
    let n = 0;
    const t = setInterval(() => {
      setElapsed(Math.floor(time()));
      if (++n % 5 === 0) persist();
    }, 1000);
    return () => clearInterval(t);
  }, [playing, time, persist]);
  useEffect(() => () => persist(), [persist]);

  const seek = useCallback(
    (t: number) => {
      const to = Math.max(0, durationRef.current ? Math.min(t, durationRef.current - 0.5) : t);
      base.current = { ...base.current, t: to, at: performance.now() };
      seekedAt.current = performance.now();
      setElapsed(Math.floor(to));
      setEnded(false);
      setStarted(true);
      post("seekTo", [to, true]);
      save(posKey, String(Math.floor(to)));
    },
    [post, posKey],
  );
  // If a play command does nothing (an autoplay policy wants a click inside the video), let the
  // next click through to the embed.
  const play = useCallback(() => {
    post("playVideo");
    setTimeout(() => {
      if (state.current === -1 || state.current === 5) setBlocked(true);
    }, 1500);
  }, [post]);
  const toggle = useCallback(() => (base.current.playing ? post("pauseVideo") : play()), [post, play]);
  const skip = useCallback((by: number) => seek(time() + by), [seek, time]);
  const setRate = useCallback(
    (r: number) => {
      const next = clampRate(r);
      base.current = { ...base.current, t: time(), at: performance.now(), rate: next };
      setRateState(next);
      save(RATE_KEY, String(next));
      post("setPlaybackRate", [next]);
    },
    [post, time],
  );

  const params = new URLSearchParams({ v: video ?? "", enablejsapi: "1", controls: "0", disablekb: "1", rel: "0", iv_load_policy: "3", cc_load_policy: "0", playsinline: "1", start: String(start) });
  const src = video && origin ? `${origin}/player?${params}` : "";

  return { frame, src, ready, playing, started, ended, error, blocked, duration, rate, elapsed, time, toggle, play, seek, skip, setRate };
}

/** A kept podcast or recording (D167): the same player as a video's, on the Mac's own audio element, so the
 *  transcript follows it, stamps seek it and the keys drive it as they do a video (D48 to D50). The
 *  position is saved per source and the rate shared with videos. */
export function useAudio(file: string | undefined, id: string): Player {
  const frame = useRef<HTMLIFrameElement>(null);
  const posKey = `ore.video.${id}`;
  const [start] = useState(() => Math.max(0, Math.floor(Number(load(posKey)) || 0)));
  const el = useRef<HTMLAudioElement | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(start > 0);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState<number | null>(null);
  const [duration, setDuration] = useState(0);
  const [rate, setRateState] = useState(savedRate);
  const [elapsed, setElapsed] = useState(start);
  // A stamp clicked before the file's metadata is read: that is where it plays from, not the saved place.
  const moved = useRef(false);
  useEffect(() => {
    if (!file) return;
    moved.current = false;
    const a = new Audio(/^(https?:|data:|blob:)/i.test(file) ? file : convertFileSrc(file));
    a.preload = "metadata";
    a.playbackRate = savedRate();
    el.current = a;
    // Only once the file is read: before then currentTime is 0, not where he stopped.
    let loaded = false;
    const persist = () => loaded && save(posKey, String(resumeAt(a.currentTime, a.duration || 0, a.ended)));
    const on: Record<string, () => void> = {
      loadedmetadata: () => {
        setDuration(a.duration || 0);
        if (start && start < a.duration && !moved.current) a.currentTime = start;
        loaded = true;
        setReady(true);
      },
      play: () => (setPlaying(true), setStarted(true), setEnded(false)),
      pause: () => (setPlaying(false), persist()),
      ended: () => (setPlaying(false), setEnded(true), persist()),
      timeupdate: () => setElapsed(Math.floor(a.currentTime)),
      ratechange: () => setRateState(a.playbackRate),
      error: () => setError(-2),
    };
    for (const [k, f] of Object.entries(on)) a.addEventListener(k, f);
    // As a video's: saved every few seconds while it plays, so a quit or crash keeps the place.
    const every = setInterval(() => !a.paused && persist(), 5000);
    return () => {
      clearInterval(every);
      persist();
      a.pause();
      for (const [k, f] of Object.entries(on)) a.removeEventListener(k, f);
      el.current = null;
    };
  }, [file, posKey, start]);
  // Before the file is read (and no stamp moved it), it is at the saved place, though currentTime says 0.
  const time = useCallback(() => (el.current && (el.current.duration || moved.current) ? el.current.currentTime : start), [start]);
  const play = useCallback(() => void el.current?.play().catch(() => {}), []);
  const toggle = useCallback(() => (el.current?.paused ? play() : el.current?.pause()), [play]);
  const seek = useCallback((t: number) => {
    const a = el.current;
    if (!a) return;
    moved.current = true;
    a.currentTime = Math.max(0, Math.min(t, a.duration || t));
    setElapsed(Math.floor(a.currentTime));
    setStarted(true);
    setEnded(false);
    if (a.duration) save(posKey, String(resumeAt(a.currentTime, a.duration, false)));
  }, [posKey]);
  const skip = useCallback((by: number) => seek(time() + by), [seek, time]);
  const setRate = useCallback((r: number) => {
    const next = clampRate(r);
    if (el.current) el.current.playbackRate = next;
    setRateState(next);
    save(RATE_KEY, String(next));
  }, []);
  return { frame, src: "", ready, playing, started, ended, error, blocked: false, duration, rate, elapsed, time, toggle, play, seek, skip, setRate };
}

export function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

const rateLabel = (r: number) => `${Number(r.toFixed(2))}x`;

const ERRORS: Record<number, string> = {
  [-1]: "The app’s video player could not start. Quit and reopen Ore, or watch it on YouTube.",
  [-2]: "The video hasn’t loaded. Check your internet connection; the player comes back here once YouTube answers.",
  2: "YouTube rejected this video ID.",
  5: "This video can't play in the app's player.",
  100: "This video was removed or made private.",
  101: "The owner doesn't allow this video to play outside YouTube.",
  150: "The owner doesn't allow this video to play outside YouTube.",
  152: "YouTube refused to play this video here (error 152).",
  153: "YouTube refused to play this video here (error 153).",
};

const WIDTH_KEY = "ore.video.width";
const MIN_WIDTH = 280;

/** The video's width (D48): the column's by default; dragging either edge widens or narrows it
 *  around the column's centre, within the pane and 70% of its height, remembered for every video. */
function useVideoWidth(box: RefObject<HTMLDivElement | null>) {
  const [wanted, setWanted] = useState<number | null>(() => Number(load(WIDTH_KEY)) || null);
  const [fit, setFit] = useState<{ width: number; left: number } | null>(null);
  useLayoutEffect(() => {
    const el = box.current;
    const col = el?.parentElement;
    const pane = el?.closest<HTMLElement>(".reader-scroll");
    if (!el || !col || !pane) return;
    const layout = () => {
      const c = col.getBoundingClientRect();
      const cw = c.width - parseFloat(getComputedStyle(col).paddingLeft);
      const cl = c.right - cw;
      const p = pane.getBoundingClientRect();
      const most = Math.min(p.width - 32, ((p.height * 0.7) / 9) * 16);
      // In a page's video card (D92) the player stays inside the card's column.
      const cap = el.closest(".video-card") ? cw - parseFloat(getComputedStyle(col).paddingRight) : most;
      const width = Math.round(Math.min(cap, Math.max(Math.min(MIN_WIDTH, p.width - 32), Math.min(wanted ?? Math.min(cw, ((innerHeight * 0.4) / 9) * 16), most))));
      const left = el.closest(".video-card") ? cl : Math.min(Math.max(cl + (cw - width) / 2, p.left + 16), p.right - 16 - width);
      setFit({ width, left: Math.round(left - cl) });
    };
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(pane);
    ro.observe(col);
    return () => ro.disconnect();
  }, [box, wanted]);
  const drag = (side: -1 | 1) => (e: ReactPointerEvent<HTMLElement>) => {
    if (!fit) return;
    e.preventDefault();
    const x0 = e.clientX;
    const w0 = fit.width;
    const before = wanted;
    const at = (ev: PointerEvent) => Math.max(MIN_WIDTH, w0 + side * 2 * (ev.clientX - x0));
    document.body.classList.add("resizing");
    resizeDrag(e, {
      move: (ev) => setWanted(at(ev)),
      end: (ev) => {
        document.body.classList.remove("resizing");
        if (ev) save(WIDTH_KEY, String(Math.round(at(ev))));
        else setWanted(before);
      },
    });
  };
  const reset = () => {
    setWanted(null);
    save(WIDTH_KEY, "");
  };
  return { fit, drag, reset };
}

/** The pinned video and its control row (D48). Copies Eleven Reader's player: a full-width scrubber,
 *  then back 15, a round play button and forward 30 in the middle, time on the left and speed on
 *  the right. YouTube's own controls are off. Every control shows its shortcut on hover (Hint). */
export function VideoPlayer({ player, title, onFinish, onOpen, audio = false, ticks = [] }: { player: Player; title: string; onFinish: () => void; onOpen: () => void; audio?: boolean; ticks?: number[] }) {
  const [scrub, setScrub] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const size = useVideoWidth(box);
  const shown = scrub ?? player.elapsed;
  const total = player.duration;
  const off = !player.ready;
  return (
    <div className={`player${audio ? " audio" : ""}`} ref={box} style={size.fit && !audio ? { width: size.fit.width, marginLeft: size.fit.left } : undefined}>
      {audio ? (
        player.error !== null && <div className="video-error">This recording won’t play here. Its transcript is below.</div>
      ) : (
      <div className="video-frame">
        <iframe
          ref={player.frame}
          src={player.src || undefined}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture"
          tabIndex={-1}
        />
        {player.error === null ? (
          !player.blocked && <button className="video-hit" aria-label={player.playing ? "Pause" : "Play"} tabIndex={-1} onClick={player.toggle} />
        ) : (
          <div className="video-error">
            {ERRORS[player.error] ?? `YouTube error ${player.error}.`}
            <button onClick={onOpen}>Open on YouTube ↗</button>
          </div>
        )}
        {([-1, 1] as const).map((side) => (
          <Hint key={side} text="Drag to resize · double-click to reset" side={side < 0 ? "left" : "right"}>
            <div
              className={`video-edge ${side < 0 ? "left" : "right"}`}
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize video"
              onPointerDown={size.drag(side)}
              onDoubleClick={size.reset}
            />
          </Hint>
        ))}
      </div>
      )}
      <Slider.Root
        className="scrub"
        min={0}
        max={Math.max(1, total)}
        step={1}
        value={[Math.min(shown, Math.max(1, total))]}
        disabled={off || !total}
        onValueChange={([v]) => setScrub(v ?? 0)}
        onValueCommit={([v]) => {
          setScrub(null);
          player.seek(v ?? 0);
        }}
        aria-label="Position"
      >
        <Slider.Track className="scrub-track">
          <Slider.Range className="scrub-range" />
        </Slider.Track>
        {/* His highlights where they are spoken (D167), so he can go back to the moments he marked. */}
        {total > 0 && ticks.filter((t) => t <= total).map((t, i) => <span key={i} className="scrub-tick" style={{ left: `${(t / total) * 100}%` }} aria-hidden="true" />)}
        <Slider.Thumb className="scrub-thumb" aria-valuetext={`${clock(shown)} of ${clock(total)}`} />
      </Slider.Root>
      <div className="controls">
        <span className="time">
          {clock(shown)}
          <span className="total"> / {total ? clock(total) : "–:––"}</span>
        </span>
        <div className="transport">
          <Hint text="Back 15 seconds" keys={["back", "back-alt"]} side="top">
            <button className="ctl skip" aria-label="Back 15 seconds" onClick={() => player.skip(-15)} disabled={off}>
              <SkipIcon by={15} back />
            </button>
          </Hint>
          <Hint text={player.playing ? "Pause" : "Play"} keys={["play", "play-alt"]} side="top">
            <button className="ctl play" aria-label={player.playing ? "Pause" : "Play"} onClick={player.toggle} disabled={off}>
              {player.playing ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" />}
            </button>
          </Hint>
          <Hint text="Forward 30 seconds" keys={["forward", "forward-alt"]} side="top">
            <button className="ctl skip" aria-label="Forward 30 seconds" onClick={() => player.skip(30)} disabled={off}>
              <SkipIcon by={30} />
            </button>
          </Hint>
        </div>
        <div className="controls-end">
          {player.ended ? (
            <Hint text="Finish source" keys="finish-source" side="top">
              <button className="ctl finish" onClick={onFinish}>
                Finish
              </button>
            </Hint>
          ) : (
            <Speed rate={player.rate} onRate={player.setRate} />
          )}
        </div>
      </div>
    </div>
  );
}

/** A circular arrow with the seconds inside, like Eleven Reader's and Apple Podcasts' skip buttons: the pixel
 *  arrow (icons.tsx) at 32px, the seconds in the pixel mono over its middle. */
function SkipIcon({ by, back = false }: { by: number; back?: boolean }) {
  const Arrow = back ? ArrowCounterClockwise : ArrowClockwise;
  return (
    <span className="skip-icon" aria-hidden="true">
      <Arrow size={32} />
      <span>{by}</span>
    </span>
  );
}

/** Eleven Reader's speed sheet as a popover: a fine slider plus presets, applied at once. */
export function Speed({ rate, onRate }: { rate: number; onRate: (r: number) => void }) {
  return (
    <Popover.Root>
      <Hint text="Playback speed" keys={["slower", "faster"]} side="top">
        <Popover.Trigger asChild>
          <button className="ctl rate" aria-label={`Playback speed ${rateLabel(rate)}`}>
            {rateLabel(rate)}
          </button>
        </Popover.Trigger>
      </Hint>
      <Popover.Portal>
        <Popover.Content className="popover speed" side="bottom" align="end" sideOffset={6} collisionPadding={12}>
          <div className="speed-head">
            Playback speed <b>{rateLabel(rate)}</b>
          </div>
          <Slider.Root className="speed-slider" min={MIN_RATE} max={MAX_RATE} step={0.05} value={[rate]} onValueChange={([v]) => v && onRate(v)} aria-label="Playback speed">
            <Slider.Track className="scrub-track">
              <Slider.Range className="scrub-range" />
            </Slider.Track>
            <Slider.Thumb className="scrub-thumb" aria-valuetext={rateLabel(rate)} />
          </Slider.Root>
          <div className="speed-ticks" aria-hidden="true">
            <span>0.5x</span>
            <span>1x</span>
            <span>1.5x</span>
            <span>2x</span>
          </div>
          <div className="speed-presets">
            {PRESETS.map((r) => (
              <button key={r} className={Math.abs(r - rate) < 0.001 ? "on" : undefined} aria-pressed={Math.abs(r - rate) < 0.001} onClick={() => onRate(r)}>
                {rateLabel(r)}
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
