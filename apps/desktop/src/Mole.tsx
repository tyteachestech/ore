import { useEffect, useRef, useState } from "react";
import { dots } from "./icons";

/* The tutor's mole (D168, after D160's owl): a miner poking out of its burrow, Ore's mining in one sprite. A 16-grid
   sprite drawn as round dots like the UI icons, in four tones. It never leaves the grid: now and then it blinks, and
   every 15 to 20 s it glances one column to a side and back, in steps, as an 8-bit sprite would. Still under reduced
   motion and while the window is hidden.
   Legend: # fur, + shade (helmet, burrow), o snout and paws, P eyes (round, 2 by 2), nose and the helmet's lamp. */
export const MOLE = [
  "................",
  "....++++++++....",
  "...++++PP++++...",
  "...##########...",
  "..##PP####PP##..",
  "..##PP####PP##..",
  "..#####oo#####..",
  "..####oPPo####..",
  "..#####oo#####..",
  "..############..",
  ".oooo######oooo.",
  "o.o.o######o.o.o",
  "++++++++++++++++",
  ".++++++++++++++.",
  "................",
  "................",
];
/** Eyes shut: their top row goes, leaving a slit. */
export const MOLE_BLINK = MOLE.map((r, y) => (y === 4 ? r.replaceAll("P", "#") : r));
/** Glancing to his left (-1) or right (1): eyes, snout and nose slide a column inside the head. */
export const moleTurned = (dir: -1 | 1, rows: readonly string[] = MOLE) =>
  rows.map((r, y) => {
    if (y < 4 || y > 8) return r;
    const inner = r.slice(3, 13);
    return r.slice(0, 3) + (dir < 0 ? inner.slice(1) + "#" : "#" + inner.slice(0, -1)) + r.slice(13);
  });

/** Each tone's dots, back to front. */
const TONES = { shade: "+", body: "#", face: "o", pupil: "P" } as const;
type Frame = "front" | "blink" | "left" | "right";
const FRAMES: Record<Frame, readonly string[]> = { front: MOLE, blink: MOLE_BLINK, left: moleTurned(-1), right: moleTurned(1) };
/** Each frame as one dot path per tone, made once. */
const PATHS = Object.fromEntries(
  Object.entries(FRAMES).map(([f, rows]) => [f, Object.entries(TONES).map(([tone, c]) => [tone, dots(rows.map((r) => [...r].map((x) => (c.includes(x) ? "#" : ".")).join("")))])]),
) as Record<Frame, [string, string][]>;

const BLINK_MS = 130, LOOK_MS = 900;
const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const between = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

/** The mole, `size` px square. `look` (hover or focus on its button) turns it back to face him, with a blink. */
export function Mole({ size = 40, look = false }: { size?: number; look?: boolean }) {
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
    <svg className="mole" width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      {PATHS[frame].map(([tone, d]) => (
        <path key={tone} className={`mole-${tone}`} d={d} />
      ))}
    </svg>
  );
}
