import { levelProgress, type Strength } from "./ore";
import { DotRing } from "./Ring";

// Gems (D90): a solid memory is a cut gem, a growing card a rough stone, one review from cut it
// glows, and a cut gem he missed cracks until he wins it back. The level is the gem being cut: a ring
// that fills toward the next level. Drawn as halftone dots (D183, Tyler's pick B): one round dot per cell in the
// skill's colour (`--skill`, set by `data-color` on an ancestor), its size the shade. The art lives here alone,
// so it can be swapped.

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
const RADIUS: Record<string, number> = { W: 0.5, H: 0.44, M: 0.36, D: 0.25 };

/** One dot per cell; `outline` keeps only the edge cells, small, for an empty slot. */
const dots = (rows: readonly string[], outline = false) =>
  rows.flatMap((row, y) =>
    [...row].map((t, x) => {
      if (t === "." || t === "C") return null;
      if (outline && [rows[y - 1]?.[x], rows[y + 1]?.[x], row[x - 1], row[x + 1]].every((n) => n && n !== ".")) return null;
      return <circle key={`${x},${y}`} cx={x + 0.5} cy={y + 0.5} r={outline ? 0.25 : RADIUS[t]} fill={outline ? C : t === "W" ? SHINE : LIGHT} />;
    }),
  );

/** `breathe`: a glowing gem due today pulses slowly; one due later glows still. */
export function Gem({ kind, size = 16, breathe }: { kind: GemKind; size?: number; breathe?: boolean }) {
  const large = size >= 22;
  const rows = kind === "rough" ? (large ? ROUGH_L : ROUGH) : kind === "dull" && size >= 12 ? (large ? CRACKED_L : CRACKED) : large ? CUT_L : CUT;
  return (
    <svg className="gem" data-kind={kind} data-breathe={breathe || undefined} width={size} height={size} viewBox={large ? "-1 -2.5 16 16" : "-1 -2 12 12"} aria-hidden="true">
      {dots(rows, kind === "empty")}
    </svg>
  );
}

/** The hover line for a skill's gems: what a cut gem is, the level, and the near goal. */
export function gemHint(k: Pick<Strength, "solid" | "ready" | "ready_today" | "win_back">, levelLine: string): string {
  const parts = [`${k.solid} cut ${k.solid === 1 ? "gem" : "gems"}: things you'd still recall three weeks from now`, levelLine];
  if (k.ready) parts.push(`${k.ready} glowing: cut if you recall ${k.ready === 1 ? "it" : "them"} at the next review${k.ready_today ? ` (${k.ready_today} due today)` : ""}`);
  if (k.win_back) parts.push(`${k.win_back} cracked: missed since, review to win ${k.win_back === 1 ? "it" : "them"} back`);
  return parts.join(" · ");
}

/** The gem being cut toward the next level: a ring of dots lights as solid memories grow, and dimmer dots
 *  after them show what today's glowing cards would add. When they would finish the level, the gem shimmers
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

/** What today's review can do: glowing gems due today (one meaning on every screen; the total is in
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
