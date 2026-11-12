import { levelProgress, type Strength } from "./ore";
import { DotRing } from "./Ring";

// Gems (D90): a solid memory is a cut gem, a growing card a rough stone, one review from cut its dots have
// swollen until they almost touch, and a cut gem he missed cracks until he wins it back. A cut gem has a grade
// (D197): won back, its crack is mended with a gold seam it keeps (`seam`); passed on a new case, it is polished
// and carries a sparkle (`polished`). The level is the gem being cut: a ring that fills toward the next level.
// One grid the whole way (D236): a memory starts as loose halftone dots in the skill's colour (`--skill`, set by
// `data-color` on an ancestor), the dots swell as it nears solid, and cut they have fused into solid pixels, a
// tone per shade. No glow. The art lives here alone, so it can be swapped.

export type GemKind = "cut" | "ready" | "rough" | "dull" | "empty";

/** Sprites: W highlight, H light, M mid, D shade, C a crack (no dot). 10×8 below 22px, 14×11 from there up. */
const CUT = ["..HHHHHH..", ".HWHHHHMM.", "HWHHHHMMMD", "MMMMMMMDDD", ".MMMMMDDD.", "..MMMDDD..", "...MMDD...", "....MD...."];
const CRACKED = ["..HHHHHH..", ".HWHCHHMM.", "HWHHHCMMMD", "MMMMMCMDDD", ".MMMCMDDD.", "..MMMCDD..", "...MMDD...", "....MD...."];
const ROUGH = ["..........", "...HHH....", "..HWHHM...", ".HHHHMMMD.", "HHHMMMMDD.", ".MMMMMDDD.", "..MMDDDD..", "....DD...."];
const CUT_L = ["...HHHHHHHH...", "..HWWHHHHMMM..", ".HWWHHHHHMMMM.", "HHHHHHHHMMMMMD", "MMMMMMMMMMDDDD", ".MMMMMMMDDDDD.", "..MMMMMMDDDD..", "...MMMMDDDD...", "....MMMDDD....", ".....MMDD.....", "......MD......"];
const CRACKED_L = ["...HHHHHHHH...", "..HWWHCHHMMM..", ".HWWHHHCHMMMM.", "HHHHHHCHMMMMMD", "MMMMMCMMMMDDDD", ".MMMMMCMDDDDD.", "..MMMMMCDDDD..", "...MMMCDDDD...", "....MCMDDD....", ".....MMDD.....", "......MD......"];
const ROUGH_L = ["..............", "....HHHH......", "...HWWHHMM....", "..HHWHHHMMMM..", ".HHHHHHMMMMMD.", "HHHHHMMMMMMDDD", "HHMMMMMMMMDDDD", ".MMMMMMMDDDDD.", "..MMMMDDDDDD..", "....MDDDD.....", ".............."];
const C = "var(--skill, var(--accent))";
const LIGHT = `color-mix(in oklab, ${C}, white 30%)`;
const SHINE = `color-mix(in oklab, ${C}, white 75%)`;
/** A dot's radius in cells, by shade: the highlight touches its neighbours, the shade leaves ground between. */
const RADIUS: Record<string, number> = { W: 0.5, H: 0.44, M: 0.36, D: 0.25, C: 0.48 };
/** A fused cell's tone, by shade: once the dots have joined, size can no longer say the shade, so colour does. */
const SOLID: Record<string, string> = { W: `color-mix(in oklab, ${C}, white 70%)`, H: `color-mix(in oklab, ${C}, white 34%)`, M: C, D: `color-mix(in oklab, ${C}, black 38%)` };
const GOLD = "var(--seam)";
/** How far a gem's dots have fused: 0 loose dots, 1 solid pixels. One review from cut they almost touch. */
export const FUSE: Record<GemKind, number> = { rough: 0, empty: 0, ready: 0.62, cut: 1, dull: 1 };
/** Fused cells overlap their neighbours a hair, so no seam of ground shows between them at a fractional scale. */
const LAP = 0.03;

/** One cell: a round dot at `fuse` 0, growing and squaring until it fills its cell at 1. */
const cell = (x: number, y: number, t: string, fuse: number, fill?: string) => {
  if (fuse <= 0) return <circle key={`${x},${y}`} cx={x + 0.5} cy={y + 0.5} r={RADIUS[t]} fill={fill ?? (t === "W" ? SHINE : LIGHT)} />;
  const d = (RADIUS[t] ?? 0.36) * 2;
  const size = d + (1 - d) * fuse + (fuse >= 1 ? LAP * 2 : 0);
  const tone = fill ?? (fuse >= 1 ? SOLID[t] : `color-mix(in oklab, ${SOLID[t]} ${Math.round(fuse * 100)}%, ${t === "W" ? SHINE : LIGHT})`);
  return <rect key={`${x},${y}`} x={x + 0.5 - size / 2} y={y + 0.5 - size / 2} width={size} height={size} rx={fuse >= 1 ? 0 : (size / 2) * (1 - fuse)} fill={tone} />;
};

/** One mark per cell; `outline` keeps only the edge cells, small, for an empty slot. */
const dots = (rows: readonly string[], fuse: number, outline = false, seam = false) =>
  rows.flatMap((row, y) =>
    [...row].map((t, x) => {
      if (t === "." || (t === "C" && !seam)) return null;
      if (t === "C") return cell(x, y, t, fuse, GOLD);
      if (outline && [rows[y - 1]?.[x], rows[y + 1]?.[x], row[x - 1], row[x + 1]].every((n) => n && n !== ".")) return null;
      if (outline) return <circle key={`${x},${y}`} cx={x + 0.5} cy={y + 0.5} r={0.25} fill={C} />;
      return cell(x, y, t, fuse);
    }),
  );

/** A polished gem's sparkle: a plus of pixels off its top right corner, its far points only at the large size. */
const sparkle = (cx: number, cy: number, large: boolean) =>
  [[0, 0, 1], [1, 0, 0.7], [-1, 0, 0.7], [0, 1, 0.7], [0, -1, 0.7], ...(large ? [[2, 0, 0.4], [-2, 0, 0.4], [0, 2, 0.4], [0, -2, 0.4]] : [])].map(([dx, dy, k]) => (
    <rect key={`s${dx},${dy}`} className="gem-sparkle" x={cx + dx! - k! / 2} y={cy + dy! - k! / 2} width={k} height={k} fill="var(--text)" />
  ));

/** `breathe`: a nearly cut gem due today swells and settles slowly; one due later sits still. */
export function Gem({ kind, size = 16, breathe, seam, polished }: { kind: GemKind; size?: number; breathe?: boolean; seam?: boolean; polished?: boolean }) {
  const large = size >= 22;
  const mended = kind === "cut" && !!seam;
  const shine = kind === "cut" && !!polished;
  const rows = kind === "rough" ? (large ? ROUGH_L : ROUGH) : (kind === "dull" || mended) && size >= 12 ? (large ? CRACKED_L : CRACKED) : large ? CUT_L : CUT;
  return (
    <svg className="gem" data-kind={kind} data-breathe={breathe || undefined} data-polished={shine || undefined} width={size} height={size} viewBox={large ? "-1 -2.5 16 16" : "-1 -2 12 12"} aria-hidden="true">
      {dots(rows, FUSE[kind], kind === "empty", mended)}
      {shine && sparkle(large ? 12 : 8.5, large ? 0.5 : 0, large)}
    </svg>
  );
}

/** The hover line for a skill's gems: what a cut gem is, the level, and the near goal. */
export function gemHint(k: Pick<Strength, "solid" | "ready" | "ready_today" | "win_back">, levelLine: string): string {
  const parts = [`${k.solid} cut ${k.solid === 1 ? "gem" : "gems"}: things you'd still recall three weeks from now`, levelLine];
  if (k.ready) parts.push(`${k.ready} nearly cut: cut if you recall ${k.ready === 1 ? "it" : "them"} at the next review${k.ready_today ? ` (${k.ready_today} due today)` : ""}`);
  if (k.win_back) parts.push(`${k.win_back} cracked: missed since, review to win ${k.win_back === 1 ? "it" : "them"} back`);
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
 *  the hover and popover) and, off Home (`due`), cracked ones to win back. */
export function NearGoal({ k, size = 16, due }: { k: Pick<Strength, "ready" | "ready_today" | "win_back">; size?: number; due?: boolean }) {
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
