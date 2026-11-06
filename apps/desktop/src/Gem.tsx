import { levelProgress, type Strength } from "./ore";

// Gems (D90): a solid memory is a cut gem, a growing card a rough stone, one review from cut it
// glows, and a cut gem he missed cracks until he wins it back. The level is the gem being cut: a ring
// that fills toward the next level. Drawn as 8-bit pixel art (D101) in the skill's colour
// (`--skill`, set by `data-color` on an ancestor). The art lives here alone, so it can be swapped.

export type GemKind = "cut" | "ready" | "rough" | "dull" | "empty";

/** 10×8 sprites: W highlight, H light, M the skill colour, D shade, C a crack (the page ground). */
const CUT = ["..HHHHHH..", ".HWHHHHMM.", "HWHHHHMMMD", "MMMMMMMDDD", ".MMMMMDDD.", "..MMMDDD..", "...MMDD...", "....MD...."];
const CRACKED = ["..HHHHHH..", ".HWHCHHMM.", "HWHHHCMMMD", "MMMMMCMDDD", ".MMMCMDDD.", "..MMMCDD..", "...MMDD...", "....MD...."];
const ROUGH = ["..........", "...HHH....", "..HWHHM...", ".HHHHMMMD.", "HHHMMMMDD.", ".MMMMMDDD.", "..MMDDDD..", "....DD...."];
const C = "var(--skill, var(--accent))";
const TONE: Record<string, string> = {
  W: `color-mix(in oklab, ${C}, white 75%)`,
  H: `color-mix(in oklab, ${C}, white 30%)`,
  M: C,
  D: `color-mix(in oklab, ${C}, black 35%)`,
  C: "var(--bg)",
};

/** One rect per pixel; `outline` keeps only the edge pixels, for an empty slot. */
const pixels = (rows: readonly string[], outline = false) =>
  rows.flatMap((row, y) =>
    [...row].map((t, x) => {
      if (t === ".") return null;
      if (outline && [rows[y - 1]?.[x], rows[y + 1]?.[x], row[x - 1], row[x + 1]].every((n) => n && n !== ".")) return null;
      return <rect key={`${x},${y}`} x={x} y={y} width={1.02} height={1.02} fill={outline ? C : TONE[t]} />;
    }),
  );

/** `breathe`: a glowing gem due today pulses slowly; one due later glows still. */
export function Gem({ kind, size = 16, breathe }: { kind: GemKind; size?: number; breathe?: boolean }) {
  const rows = kind === "rough" ? ROUGH : kind === "dull" && size >= 12 ? CRACKED : CUT;
  return (
    <svg className="gem" data-kind={kind} data-breathe={breathe || undefined} width={size} height={size} viewBox="-1 -2 12 12" shapeRendering="crispEdges" aria-hidden="true">
      {pixels(rows, kind === "empty")}
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

/** A dashed run from `start` for `len` along a circle of length `c`, as one dasharray. */
const dashes = (start: number, len: number, c: number) => {
  const n = Math.max(1, Math.round(len / 9));
  const step = len / n;
  return `0 ${start + 1.5} ${Array(n).fill(`${step - 3} 3`).join(" ")} ${c}`;
};

/** The gem being cut toward the next level: a ring fills as solid memories grow, and a ghost arc
 *  after it shows what today's glowing cards would add (dashed, solid when small). When they would finish
 *  the level, the gem shimmers and the ring glows.
 *  `badge` puts the level on the ring (the skill page); Home leaves it to the hover. */
export function GemRing({ k, size = 52, badge }: { k: Pick<Strength, "solid" | "ready_today" | "level" | "next_level_at">; size?: number; badge?: boolean }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const share = levelProgress(k).share;
  const span = Math.max(1, k.next_level_at - 5 * k.level ** 2);
  const ghost = Math.min(1 - share, k.ready_today / span);
  const finishes = k.ready_today > 0 && share + k.ready_today / span >= 1;
  return (
    <span className="gem-ring" data-finishes={finishes || undefined} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
        <circle cx="50" cy="50" r={r} className="gem-ring-track" />
        {ghost > 0 && <circle cx="50" cy="50" r={r} className="gem-ring-ghost" strokeDasharray={size < 40 ? `0 ${c * share} ${c * ghost} ${c}` : dashes(c * share, c * ghost, c)} transform="rotate(-90 50 50)" />}
        <circle cx="50" cy="50" r={r} className="gem-ring-fill" strokeDasharray={`${c * share} ${c}`} transform="rotate(-90 50 50)" />
      </svg>
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
