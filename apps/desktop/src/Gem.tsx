import { useEffect, useRef, useState } from "react";
import { levelProgress, type Strength } from "./ore";
import { DotRing } from "./Ring";

// Gems (D90): shape tells the state (D236). A memory is a rock of loose halftone dots in the skill's colour
// (`--skill`, set by `data-color` on an ancestor) until its first cut: one review from cut the rock's dots have
// swollen and one face is already cut. Cut, it has the gem's outline for good and its dots have fused into solid
// pixels, a tone per shade. Missed, the gem keeps its outline and colour and its dots come loose again until he
// wins it back: no crack, no grey. A cut gem has a grade (D197): won back, its rim is gold for good
// (`seam`); passed on a new case, it is polished and carries a sparkle (`polished`). The level is the gem being
// cut: a ring that fills toward the next level. No glow. The art lives here alone, so it can be swapped.

export type GemKind = "cut" | "ready" | "rough" | "dull" | "empty";

/** Sprites: W highlight, H light, M mid, D shade. 10×8 below 22px, 14×11 from there up. */
const CUT = ["..HHHHHH..", ".HWHHHHMM.", "HWHHHHMMMD", "MMMMMMMDDD", ".MMMMMDDD.", "..MMMDDD..", "...MMDD...", "....MD...."];
const ROUGH = ["..........", "...HHH....", "..HWHHM...", ".HHHHMMMD.", "HHHMMMMDD.", ".MMMMMDDD.", "..MMDDDD..", "....DD...."];
const CUT_L = ["...HHHHHHHH...", "..HWWHHHHMMM..", ".HWWHHHHHMMMM.", "HHHHHHHHMMMMMD", "MMMMMMMMMMDDDD", ".MMMMMMMDDDDD.", "..MMMMMMDDDD..", "...MMMMDDDD...", "....MMMDDD....", ".....MMDD.....", "......MD......"];
const ROUGH_L = ["..............", "....HHHH......", "...HWWHHMM....", "..HHWHHHMMMM..", ".HHHHHHMMMMMD.", "HHHHHMMMMMMDDD", "HHMMMMMMMMDDDD", ".MMMMMMMDDDDD.", "..MMMMDDDDDD..", "....MDDDD.....", ".............."];
const C = "var(--skill, var(--accent))";
const LIGHT = `color-mix(in oklab, ${C}, white 30%)`;
const SHINE = `color-mix(in oklab, ${C}, white 75%)`;
/** A dot's radius in cells, by shade: the highlight touches its neighbours, the shade leaves ground between. */
const RADIUS: Record<string, number> = { W: 0.5, H: 0.44, M: 0.36, D: 0.25 };
/** A fused cell's tone, by shade: once the dots have joined, size can no longer say the shade, so colour does. */

const tones = (c: string): Record<string, string> => ({ W: `color-mix(in oklab, ${c}, white 70%)`, H: `color-mix(in oklab, ${c}, white 34%)`, M: c, D: `color-mix(in oklab, ${c}, black 38%)` });
const SOLID = tones(C);
const GOLD = tones("var(--seam)");
/** How far a gem's dots have fused: 0 loose dots, 1 solid pixels. A missed gem's have come apart again. */
export const FUSE: Record<GemKind, number> = { rough: 0, empty: 0, ready: 0.5, cut: 1, dull: 0.45 };
/** Fused cells overlap their neighbours a hair, so no seam of ground shows between them at a fractional scale. */
const LAP = 0.03;

/** One cell: a round dot at `fuse` 0, growing and squaring until it fills its cell at 1. `gold`: a won-back cell. */
const cell = (x: number, y: number, t0: string, fuse: number, gold = false, band?: number) => {
  // The light that runs across a gem as it is cut: the cells under it take the highlight's tone.
  const t = band !== undefined && t0 !== "D" && Math.abs(x + y * 0.9 - band) < 1.3 ? "W" : t0;
  const solid = (gold ? GOLD : SOLID)[t];
  const loose = gold ? GOLD[t === "W" ? "W" : "H"] : t === "W" ? SHINE : LIGHT;
  if (fuse <= 0) return <circle key={`${x},${y}`} cx={x + 0.5} cy={y + 0.5} r={RADIUS[t]} fill={loose} />;
  const d = (RADIUS[t] ?? 0.36) * 2;
  const size = d + (1 - d) * fuse + (fuse >= 1 ? LAP * 2 : 0);
  const tone = fuse >= 1 ? solid : `color-mix(in oklab, ${solid} ${Math.round(fuse * 100)}%, ${loose})`;
  return <rect key={`${x},${y}`} data-gold={gold || undefined} x={x + 0.5 - size / 2} y={y + 0.5 - size / 2} width={size} height={size} rx={fuse >= 1 ? 0 : (size / 2) * (1 - fuse)} fill={tone} />;
};

/** One mark per cell. `outline` keeps only the edge cells, small, for an empty slot; `face` cuts the rock's top
 *  left face solid (nearly cut); `gold` turns the gem's rim, its edge cells, gold (won back). */
const dots = (rows: readonly string[], fuse: number, o: { outline?: boolean; face?: boolean; gold?: boolean; band?: number } = {}) =>
  rows.flatMap((row, y) =>
    [...row].map((t, x) => {
      if (t === ".") return null;
      const inside = [rows[y - 1]?.[x], rows[y + 1]?.[x], row[x - 1], row[x + 1]].every((n) => n && n !== ".");
      if (o.outline) return inside ? null : <circle key={`${x},${y}`} cx={x + 0.5} cy={y + 0.5} r={0.25} fill={C} />;
      const cut = o.face && x + y * 1.2 < row.length * 0.62 && y < rows.length * 0.55;
      return cell(x, y, t, cut ? 1 : fuse, o.gold && !inside, o.band);
    }),
  );

/** A polished gem's sparkle: a plus of pixels off its top right corner, its far points only at the large size. */
const sparkle = (cx: number, cy: number, large: boolean) =>
  [[0, 0, 1], [1, 0, 0.7], [-1, 0, 0.7], [0, 1, 0.7], [0, -1, 0.7], ...(large ? [[2, 0, 0.4], [-2, 0, 0.4], [0, 2, 0.4], [0, -2, 0.4]] : [])].map(([dx, dy, k]) => (
    <rect key={`s${dx},${dy}`} className="gem-sparkle" x={cx + dx! - k! / 2} y={cy + dy! - k! / 2} width={k} height={k} fill="var(--text)" />
  ));

/** `breathe`: a nearly cut gem due today swells and settles slowly; one due later sits still. `fuse` and `band`
 *  are for a gem caught mid-cut (`Cutting`): how far its dots have joined, and where the light is on it. */
export function Gem({ kind, size = 16, breathe, seam, polished, fuse, band }: { kind: GemKind; size?: number; breathe?: boolean; seam?: boolean; polished?: boolean; fuse?: number; band?: number }) {
  const large = size >= 22;
  const shine = kind === "cut" && !!polished;
  const rows = kind === "rough" || kind === "ready" ? (large ? ROUGH_L : ROUGH) : large ? CUT_L : CUT;
  return (
    <svg className="gem" data-kind={kind} data-breathe={breathe || undefined} data-polished={shine || undefined} width={size} height={size} viewBox={large ? "-1 -2.5 16 16" : "-1 -2 12 12"} aria-hidden="true">
      {dots(rows, fuse ?? FUSE[kind], { outline: kind === "empty", face: kind === "ready" && fuse === undefined, gold: !!seam && (kind === "cut" || kind === "dull"), band })}
      {shine && sparkle(large ? 12 : 8.5, large ? 0.5 : 0, large)}
    </svg>
  );
}

const BURST = Array.from({ length: 8 }, (_, i) => i * (Math.PI / 4) + 0.4);
const easeOut = (x: number) => 1 - (1 - x) ** 3;

/** A stone being cut, at a session's end (D239, the look of D236 in motion): loose dots while it moves, solid
 *  pixels at rest. The rough stone lands with a squash, its dots swell as it grows to a gem's size, then they take
 *  the gem's outline and fuse into pixels with a pop, a ring of loose dots flies off it and a light runs across
 *  its faces. `go` starts it (the stone has landed); with `still` it is simply cut. Times are the motion tokens. */
export function Cutting({ go, still, size = 36, seam, polished }: { go: boolean; still?: boolean; size?: number; seam?: boolean; polished?: boolean }) {
  const box = useRef<HTMLSpanElement>(null);
  const times = useRef({ land: 150, swell: 300, fuse: 600 });
  // Milliseconds since it landed; Infinity once it is cut.
  const [at, setAt] = useState(still ? Infinity : 0);
  useEffect(() => {
    if (!go || still) return;
    const css = getComputedStyle(box.current!), ms = (name: string, or: number) => parseFloat(css.getPropertyValue(name)) || or;
    const d = (times.current = { land: ms("--t-2", 150), swell: ms("--t-4", 300), fuse: ms("--t-moment", 600) });
    const t0 = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const t = now - t0;
      if (t >= d.land + d.swell + d.fuse) return setAt(Infinity);
      setAt(t);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [go, still]);
  if (at === Infinity) return <span className="gem-cutting" ref={box}><Gem kind="cut" size={size} seam={seam} polished={polished} /></span>;
  const { land, swell, fuse } = times.current;
  // Landing: half a gem's size, as it flew, squashed against the ground it hit.
  const hit = Math.sin(Math.min(1, at / land) * Math.PI) * 0.16;
  const k = easeOut(Math.max(0, Math.min(1, (at - land) / swell)));
  const q = Math.max(0, (at - land - swell) / fuse);
  const cutNow = at >= land + swell;
  const pop = cutNow ? 1 + 0.22 * Math.sin(Math.min(1, q * 2) * Math.PI) * (1 - q) : 0.5 + 0.5 * k;
  return (
    <span className="gem-cutting" ref={box} data-cutting>
      <span style={{ transform: `scale(${pop * (1 + hit)}, ${pop * (1 - hit)})` }}>
        {cutNow ? (
          <Gem kind="cut" size={size} seam={seam} fuse={Math.min(1, 0.55 + 0.45 * easeOut(Math.min(1, q * 2.5)))} band={q > 0.35 ? ((q - 0.35) / 0.65) * 30 - 3 : undefined} />
        ) : (
          <Gem kind="rough" size={size} fuse={0.55 * k} />
        )}
      </span>
      {cutNow && BURST.map((a, i) => <i key={i} style={{ "--x": `${Math.cos(a) * size * 1.3}px`, "--y": `${Math.sin(a) * size * 1.05}px` } as React.CSSProperties} />)}
    </span>
  );
}

/** The hover line for a skill's gems: what a cut gem is, the level, and the near goal. */
export function gemHint(k: Pick<Strength, "solid" | "ready" | "ready_today" | "win_back">, levelLine: string): string {
  const parts = [`${k.solid} cut ${k.solid === 1 ? "gem" : "gems"}: things you'd still recall three weeks from now`, levelLine];
  if (k.ready) parts.push(`${k.ready} nearly cut: cut if you recall ${k.ready === 1 ? "it" : "them"} at the next review${k.ready_today ? ` (${k.ready_today} due today)` : ""}`);
  if (k.win_back) parts.push(`${k.win_back} came loose: missed since, review to win ${k.win_back === 1 ? "it" : "them"} back`);
  return parts.join(" · ");
}

/** The gem being cut toward the next level: a ring of dots lights as solid memories grow, and dimmer dots
 *  after them show what today's nearly cut cards would add. When they would finish the level, the gem shimmers
 *  and the ring glows.
 *  `badge` puts the level on the ring (the skill page); Home leaves it to the hover. */
export function GemRing({ k, size = 52, badge }: { k: Pick<Strength, "solid" | "ready_today" | "level" | "next_level_at">; size?: number; badge?: boolean }) {
  const share = levelProgress(k).share;
  const span = Math.max(1, k.next_level_at - 5 * k.level ** 2);
  const ghost = Math.min(1 - share, k.ready_today / span);
  const finishes = k.ready_today > 0 && share + k.ready_today / span >= 1;
  return (
    <span className="gem-ring" data-finishes={finishes || undefined} style={{ width: size, height: size }}>
      <DotRing size={size} share={share} ghost={ghost} />
      <Gem kind="cut" size={Math.round(size * 0.56)} breathe={finishes} />
      {badge && <span className="gem-ring-lv">Lv {k.level}</span>}
    </span>
  );
}

/** What today's review can do: nearly cut gems due today (one meaning on every screen; the total is in
 *  the hover and popover) and, off Home (`due`), missed ones to win back. */
export function NearGoal({ k, size = 18, due }: { k: Pick<Strength, "ready" | "ready_today" | "win_back">; size?: number; due?: boolean }) {
  const glow = k.ready_today;
  const cracked = due ? 0 : k.win_back;
  if (!glow && !cracked) return null;
  return (
    <span className="near-goal">
      {glow > 0 && (
        <span className="near-glow">
          <Gem kind="ready" size={size} breathe />
          {glow}
        </span>
      )}
      {cracked > 0 && (
        <span>
          <Gem kind="dull" size={size} />
          {cracked}
        </span>
      )}
    </span>
  );
}
