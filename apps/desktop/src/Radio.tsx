import * as Popover from "@radix-ui/react-popover";
import { useEffect, useRef, useState } from "react";
import { bigScreen, CHANNELS, clock, grid, icon, ICONS, paint, powerDown, text, textWidth, type ChannelId, type Grid } from "./ambience-art";
import { channelName, level, toggle, useAmbience } from "./ambience";
import { dots } from "./dots";
import { Hint } from "./Hint";

/* The ambience radio (D253): a round button at the bottom left, the mole's twin at the bottom right (D160). Off until
   he picks a channel. While one plays, its icon glows amber in the button and a ring of dots breathes with the sound;
   hovering shows the channel and how long it has played. A click opens the big screen over five pads, one per channel.
   Desktop only. Motion stops when Reduce Motion is on, and nothing draws while the window is hidden. */

const AMBER = "255,178,36";
const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const now = () => performance.now() / 1000;

/** Redraws `draw` every frame while `on`, at the canvas's device scale. */
function useCanvas(on: boolean, w: number, h: number, draw: (ctx: CanvasRenderingContext2D, t: number) => void, redraw: unknown = null) {
  const ref = useRef<HTMLCanvasElement>(null);
  const fn = useRef(draw);
  fn.current = draw;
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(3, devicePixelRatio || 1);
    c.width = w * dpr; c.height = h * dpr;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Reduce Motion: a still picture, redrawn once a second so the clock still counts.
    let raf = 0, timer = 0;
    const tick = () => {
      fn.current(ctx, still() ? 0 : now());
      if (!on) return;
      if (still()) timer = window.setTimeout(tick, 1000);
      else raf = requestAnimationFrame(tick);
    };
    tick();
    return () => (cancelAnimationFrame(raf), clearTimeout(timer));
  }, [on, w, h, redraw]);
  return ref;
}

const COLS = 59, ROWS = 22, S = 5;

function Screen({ open }: { open: boolean }) {
  const { playing, since, missing, loading } = useAmbience();
  const g = useRef<Grid>(grid(COLS, ROWS));
  // Moving to another channel is not switching off: it loads with the old picture held.
  const on = playing ?? loading;
  const off = useRef<{ from: Float32Array; at: number } | null>(null);
  const held = useRef(new Float32Array(COLS * ROWS));
  const was = useRef(on);
  if (was.current !== on) {
    // Switching off (not to another channel) plays the power-down from what was on screen.
    off.current = was.current && !on ? { from: g.current.lit.slice(), at: now() } : null;
    was.current = on;
  }
  const lastMissing = !playing && !loading && missing.length ? missing[missing.length - 1] : null;
  const ref = useCanvas(open, COLS * S, ROWS * S, (ctx, t) => {
    const s = g.current;
    s.clear();
    if (playing) bigScreen(s, playing, t, now() - since, level());
    else if (loading) s.lit.set(held.current);
    else if (off.current && powerDown(s, off.current.from, now() - off.current.at)) {}
    else {
      off.current = null;
      if (lastMissing) { text(s, "NO FILE", 1, 1, 0.6); text(s, CHANNELS.find((c) => c.id === lastMissing)!.screen, 1, 10, 0.35); }
      // Standby: one dot breathing in the corner says the radio is on hand, and off.
      s.set(COLS - 2, ROWS - 2, 0.25 + 0.2 * Math.sin(t * 2.1));
    }
    if (playing) held.current.set(s.lit);
    paint(ctx, s, S, AMBER);
  });
  const label = playing ? `${channelName(playing)} playing, ${clock(now() - since)}` : lastMissing ? `${channelName(lastMissing)} has no sound file` : "Nothing playing";
  return <canvas ref={ref} className="radio-screen" style={{ width: COLS * S, height: ROWS * S }} role="img" aria-label={label} />;
}

/** A pad's icon: the 11-grid drawing, centred on the UI icons' 16 grid by its ink (dots.ts). */
const padIcon = (id: ChannelId) => dots(ICONS[id]);

function Pads() {
  const { playing, loading, missing } = useAmbience();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (i: number) => refs.current[(i + CHANNELS.length) % CHANNELS.length]?.focus();
  return (
    <div className="radio-pads" role="group" aria-label="Channels">
      {CHANNELS.map((ch, i) => (
        <Hint key={ch.id} text={<>{missing.includes(ch.id) ? `${ch.name}: no sound file` : ch.name}<kbd>{i + 1}</kbd></>} side="bottom">
          <button
            ref={(el) => void (refs.current[i] = el)}
            className={`radio-pad${playing === ch.id ? " on" : ""}${loading === ch.id ? " loading" : ""}${missing.includes(ch.id) ? " missing" : ""}`}
            aria-label={ch.name}
            aria-pressed={playing === ch.id}
            onClick={() => void toggle(ch.id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") { e.preventDefault(); move(i + 1); }
              else if (e.key === "ArrowLeft") { e.preventDefault(); move(i - 1); }
            }}
          >
            <svg viewBox="0 0 16 16" width="32" height="32" aria-hidden="true"><path d={padIcon(ch.id)} /></svg>
          </button>
        </Hint>
      ))}
    </div>
  );
}

const ORB = 52;
function Orb({ playing, hover }: { playing: ChannelId | null; hover: boolean }) {
  const g = useRef(grid(11, 11));
  const lv = useRef(0);
  const ref = useCanvas(!!playing, ORB, ORB, (ctx, t) => {
    const s = g.current, c = ORB / 2, d = 2.3, o = c - 5.5 * d;
    s.clear();
    lv.current += ((playing ? level() : 0) - lv.current) * 0.2;
    if (playing) icon(s, playing, 0, 0, 1, t || -1);
    else icon(s, "speaker", 0, 0, 1);
    ctx.clearRect(0, 0, ORB, ORB);
    const grey = playing ? "" : getComputedStyle(ctx.canvas).color;
    for (let y = 0; y < 11; y++) for (let x = 0; x < 11; x++) {
      const v = s.lit[y * 11 + x]!;
      if (v <= 0) continue;
      ctx.fillStyle = playing ? `rgba(${AMBER},${v})` : grey;
      ctx.beginPath(); ctx.arc(o + x * d + d / 2, o + y * d + d / 2, d * 0.42, 0, 7); ctx.fill();
    }
    if (!playing) return;
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2 - Math.PI / 2, w = 0.5 + 0.5 * Math.sin(k * 1.7 + t * 3);
      ctx.fillStyle = `rgba(${AMBER},${0.25 + 0.6 * lv.current * w})`;
      ctx.beginPath(); ctx.arc(c + Math.cos(a) * 21, c + Math.sin(a) * 21, 1.1 + lv.current * 1.1 * w, 0, 7); ctx.fill();
    }
  }, hover); // idle, it draws once: again on hover, so the speaker brightens with the button
  return <canvas ref={ref} className="radio-orb-dots" style={{ width: ORB, height: ORB }} aria-hidden="true" />;
}

/** The name and clock that slide out beside the button on hover while a channel plays. */
function Tag({ playing, since }: { playing: ChannelId; since: number }) {
  const ch = CHANNELS.find((c) => c.id === playing)!, cols = textWidth(ch.screen) + 3 + textWidth("00:00"), s = 2.4;
  const g = useRef(grid(cols, 7));
  const ref = useCanvas(true, cols * s, 7 * s, (ctx) => {
    g.current.clear();
    const x = text(g.current, ch.screen, 0, 0);
    text(g.current, clock(now() - since), x + 2, 0, 0.45);
    paint(ctx, g.current, s, AMBER, 0);
  });
  return <span className="radio-tag" aria-hidden="true"><canvas ref={ref} style={{ width: cols * s, height: 7 * s }} /></span>;
}

export function Radio({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { playing, since, loading } = useAmbience();
  const [hover, setHover] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Hint text="Ambience" keys="ambience" side="top">
        <Popover.Trigger asChild>
          <button
            className={`radio-orb${playing ? " playing" : ""}`}
            aria-label={playing ? `Ambience: ${channelName(playing)} playing` : "Ambience"}
            onPointerEnter={() => setHover(true)}
            onPointerLeave={() => setHover(false)}
          >
            <Orb playing={playing ?? loading} hover={hover} />
          </button>
        </Popover.Trigger>
      </Hint>
      {playing && hover && !open && <Tag playing={playing} since={since} />}
      <Popover.Portal>
        <Popover.Content
          className="popover radio"
          side="top"
          align="start"
          sideOffset={10}
          collisionPadding={12}
          aria-label="Ambience"
          data-own-keys
          onOpenAutoFocus={(e) => {
            // Focus the channel playing, else the first, so arrows and Space work at once.
            e.preventDefault();
            const pads = (e.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>(".radio-pad");
            (pads[Math.max(0, CHANNELS.findIndex((c) => c.id === playing))] ?? pads[0])?.focus();
          }}
          onKeyDown={(e) => {
            const n = Number(e.key);
            if (n >= 1 && n <= CHANNELS.length && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); void toggle(CHANNELS[n - 1]!.id); }
          }}
        >
          <Screen open={open} />
          <Pads />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
