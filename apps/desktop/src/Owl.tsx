import { useEffect, useRef, useState } from "react";
import { dots } from "./icons";

/* The tutor's owl (D160): a 16-grid sprite drawn as round dots like the UI icons, in four tones. It never leaves the
   grid: now and then it blinks, and every 15 to 20 s it turns its head one column to a side and back, in steps, as an
   8-bit sprite would. Still under reduced motion and while the window is hidden.
   Legend: # body, + shade (wings, under), o face disc, P pupil, B beak. */
export const OWL = [
  "................",
  "...#........#...",
  "...##......##...",
  "..############..",
  ".##oooo##oooo##.",
  ".#oo..oooo..oo#.",
  ".#o.PP.oo.PP.o#.",
  ".#o.PP.oo.PP.o#.",
  ".#oo..oBBo..oo#.",
  ".##oooooBooooo#.",
  ".+###oooooo###+.",
  "..+##oooooo##+..",
  "..++##oooo##++..",
  "...++######++...",
  ".....##..##.....",
  "................",
];
/** Eyes shut: each eye is one slit. */
export const OWL_BLINK = OWL.map((r, y) => (y === 5 || y === 6 ? ".#oooooooooooo#." : y === 7 ? ".#o....oo....o#." : r));
/** Head turned to his left (-1) or right (1): the face slides a column and the far cheek turns to body. */
export const owlTurned = (dir: -1 | 1, rows: readonly string[] = OWL) =>
  rows.map((r, y) => {
    if (y < 4 || y > 9) return r;
    const inner = r.slice(2, 14), moved = dir < 0 ? inner.slice(1) + "o" : "o" + inner.slice(0, -1);
    const row = r.slice(0, 2) + moved + r.slice(14);
    return dir < 0 ? row.slice(0, 13) + "#" + row.slice(14) : row.slice(0, 2) + "#" + row.slice(3);
  });

/** Each tone's dots: the beak shares the wings' shade, dark on the light face. */
const TONES = { shade: "+B", body: "#", face: "o", pupil: "P" } as const;
type Frame = "front" | "blink" | "left" | "right";
const FRAMES: Record<Frame, readonly string[]> = { front: OWL, blink: OWL_BLINK, left: owlTurned(-1), right: owlTurned(1) };
/** Each frame as one dot path per tone, made once. */
const PATHS = Object.fromEntries(
  Object.entries(FRAMES).map(([f, rows]) => [f, Object.entries(TONES).map(([tone, c]) => [tone, dots(rows.map((r) => [...r].map((x) => (c.includes(x) ? "#" : ".")).join("")))])]),
) as Record<Frame, [string, string][]>;

const BLINK_MS = 130, LOOK_MS = 900;
const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const between = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

/** The owl, `size` px square. `look` (hover or focus on its button) turns it back to face him, with a blink. */
export function Owl({ size = 40, look = false }: { size?: number; look?: boolean }) {
  const [frame, setFrame] = useState<Frame>("front");
  const looking = useRef(look);
  looking.current = look;
  const blink = useRef<() => void>(() => {});

  useEffect(() => {
    const timers = new Set<number>();
    let alive = true;
    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => { timers.delete(id); fn(); }, ms);
      timers.add(id);
    };
    // Still while hovered or focused (it is facing him), hidden, or asked for less motion.
    const quiet = () => looking.current || document.hidden || still();
    /** Shows `f` for `ms`, then faces him again (unless something else took over meanwhile). */
    const show = (f: Frame, ms: number) => {
      setFrame(f);
      later(() => setFrame((g) => (g === f ? "front" : g)), ms);
    };
    blink.current = () => { if (!still()) show("blink", BLINK_MS); };
    const blinks = () => later(() => { if (!quiet()) blink.current(); if (alive) blinks(); }, between(5000, 9000));
    // A glance: to one side and back, sometimes the other side after.
    const turns = () =>
      later(() => {
        if (!quiet()) {
          const first: Frame = Math.random() < 0.5 ? "left" : "right";
          show(first, LOOK_MS);
          if (Math.random() < 0.5) later(() => { if (!quiet()) show(first === "left" ? "right" : "left", LOOK_MS); }, LOOK_MS + 400);
        }
        if (alive) turns();
      }, between(15000, 20000));
    blinks();
    turns();
    return () => { alive = false; timers.forEach(clearTimeout); };
  }, []);

  // Hovered or focused: it faces him and blinks.
  useEffect(() => {
    if (look) blink.current();
  }, [look]);

  return (
    <svg className="owl" width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      {PATHS[frame].map(([tone, d]) => (
        <path key={tone} className={`owl-${tone}`} d={d} />
      ))}
    </svg>
  );
}
