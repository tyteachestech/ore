import { useEffect, useRef } from "react";
import type { Player } from "./Video";

/** What the Mac and iPhone are told is playing: the source's title, who made it and its picture. */
export type Playing = { title: string; artist?: string; artwork?: string };

const ACTIONS = ["play", "pause", "seekbackward", "seekforward", "previoustrack", "nexttrack", "seekto"] as const;

/** A kept podcast or recording (D167) answers the keyboard's play keys, AirPods and Control Center as Podcasts
 *  does: play and pause, back 15 and forward 30 (the track keys skip too, as they do there), and a drag of
 *  Control Center's bar. `player` is read at each press, so the handlers are set once. Returns the undo. */
export function announce(session: MediaSession, what: Playing, player: () => Player): () => void {
  const Meta = (globalThis as { MediaMetadata?: typeof MediaMetadata }).MediaMetadata;
  if (Meta) session.metadata = new Meta({ title: what.title, artist: what.artist ?? "", artwork: what.artwork ? [{ src: what.artwork }] : [] });
  const on: Record<(typeof ACTIONS)[number], MediaSessionActionHandler> = {
    play: () => player().play(),
    pause: () => void (player().playing && player().toggle()),
    seekbackward: (d) => player().skip(-(d.seekOffset || 15)),
    seekforward: (d) => player().skip(d.seekOffset || 30),
    previoustrack: () => player().skip(-15),
    nexttrack: () => player().skip(30),
    seekto: (d) => void (d.seekTime != null && player().seek(d.seekTime)),
  };
  // An action this webview does not know throws: the others still answer.
  const set = (a: (typeof ACTIONS)[number], h: MediaSessionActionHandler | null) => {
    try {
      session.setActionHandler(a, h);
    } catch {}
  };
  for (const a of ACTIONS) set(a, on[a]);
  return () => {
    for (const a of ACTIONS) set(a, null);
    session.metadata = null;
    session.playbackState = "none";
  };
}

/** Where it is, for Control Center's bar: only once the length is known, and never past it. */
export function position(session: MediaSession, p: Pick<Player, "duration" | "rate" | "playing"> & { at: number }) {
  session.playbackState = p.playing ? "playing" : "paused";
  if (p.duration > 0) session.setPositionState?.({ duration: p.duration, playbackRate: p.rate, position: Math.max(0, Math.min(p.at, p.duration)) });
}

/** While a recording is open, the system's media controls drive it. Nothing is drawn. */
export function useNowPlaying(player: Player | null, what: Playing | null) {
  const session = typeof navigator === "undefined" ? undefined : navigator.mediaSession;
  const now = useRef(player);
  now.current = player;
  const on = !!player && !!what;
  const { title, artist, artwork } = what ?? { title: "" };
  useEffect(() => {
    if (!session || !on) return;
    return announce(session, { title, artist, artwork }, () => now.current!);
  }, [session, on, title, artist, artwork]);
  const { duration = 0, rate = 1, playing = false, elapsed = 0 } = player ?? {};
  // After the name is told again too (its undo says nothing plays), so a paused recording stays on the controls.
  useEffect(() => {
    if (session && on) position(session, { duration, rate, playing, at: elapsed });
  }, [session, on, duration, rate, playing, elapsed, title, artist, artwork]);
}
