import { useEffect, useState } from "react";

/** How many of `n` dots a share lights: any progress lights one, and only a whole share lights them all. */
export const lit = (share: number, n: number) => (share >= 1 ? n : share <= 0 ? 0 : Math.max(1, Math.min(n - 1, Math.round(share * n))));

/** How many dots a ring of `size` px has. */
export const ringDots = (size: number) => (size > 60 ? 30 : size > 36 ? 20 : 14);

/** A ring of dots, one per step, from 12 o'clock (D183): the lit ones in `--ring` (the skill's colour, or green
 *  for the goal), then `ghost` dimmer ones, the rest as the track. Each dot lights a beat after the one before.
 *  `over`: dots lit again on a lap past the full ring (the end screen's bonus minutes): each is a little bigger
 *  and carries a white centre, so where the bonus stops is plain; past a second full lap they grow again. */
export function DotRing({ size, share, ghost = 0, over = 0, step = false, since }: { size: number; share: number; ghost?: number; over?: number; /** The share it stood at before today: the lit dots past it are marked `fresh` (at least one, when it grew at all). */ since?: number; /** Lit one step at a time by its caller, so no dot waits its turn. */ step?: boolean }) {
  const n = ringDots(size);
  const on = lit(share, n);
  const old = since === undefined || since >= share ? on : Math.min(lit(since, n), on - 1);
  const soon = Math.min(n, on + (ghost > 0 ? Math.max(1, Math.round(ghost * n)) : 0));
  const r = Math.min(6.5, ((2 * Math.PI * 43) / n) * 0.36);
  const lap2 = Math.min(n, over), lap3 = Math.min(n, Math.max(0, over - n));
  const at = (i: number) => { const a = (i / n) * 2 * Math.PI - Math.PI / 2; return { cx: +(50 + 43 * Math.cos(a)).toFixed(2), cy: +(50 + 43 * Math.sin(a)).toFixed(2) }; };
  return (
    <svg className="dot-ring" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => {
        const lit = i < on ? (i >= old ? "on fresh" : "on") : i < soon ? "soon" : "";
        return <circle key={i} className={`${lit}${i < lap3 ? " over2" : i < lap2 ? " over" : ""}` || undefined} {...at(i)} r={+r.toFixed(2)} style={{ transitionDelay: step ? "0ms" : `calc(${i} * var(--stagger))`, "--i": i } as React.CSSProperties} />;
      })}
      {Array.from({ length: lap2 }, (_, i) => <circle key={`core${i}`} className={i < lap3 ? "core big" : "core"} {...at(i)} r={+(r * 0.4).toFixed(2)} />)}
    </svg>
  );
}

/** A bar of `n` dots (D184), lit by the same rule as the ring. `className` places it (home-meter, review-bar). */
export function DotBar({ share, n, className }: { share: number; n: number; className: string }) {
  const on = lit(share, n);
  return (
    <span className={`dot-bar ${className}`} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => <i key={i} className={i < on ? "on" : undefined} />)}
    </span>
  );
}

/** How far he has read, as a line on the bottom edge of the source's picture (D326, YouTube's watched
 *  line): a slim dark shade under it keeps it readable on a white page, a gold cover and the blank tile alike. */
export function ThumbLine({ share }: { share: number }) {
  return <span className="thumb-line" style={{ "--at": Math.max(0, Math.min(1, share)) } as React.CSSProperties} aria-hidden="true" />;
}

/** The daily goal as a ring (D60), like Apple Fitness's move ring: it fills from `from` to `value`
 *  when shown and plays one short burst when `burst` is set (D62; none under Reduce Motion), a glint running
 *  once round its dots with it (D257). */
export function Ring({ value, from = 0, size = 64, met, burst = false, label, over = 0, hit = 0, step = false, children }: { step?: boolean; value: number; from?: number; size?: number; met: boolean; burst?: boolean; label: string; /** Bonus dots lit past the full ring (the end screen). */ over?: number; /** Goal lines crossed while it counted: each throws one ring of dots outward, the second a bigger one. */ hit?: number; children?: React.ReactNode }) {
  const [shown, setShown] = useState(from);
  const target = met ? 1 : Math.max(0, Math.min(1, value));
  useEffect(() => {
    const f = requestAnimationFrame(() => setShown(target));
    return () => cancelAnimationFrame(f);
  }, [target]);
  return (
    <div className={`ring${met ? " met" : ""}${burst ? " glint" : ""}`} style={{ width: size, height: size }} role="img" aria-label={label}>
      <DotRing size={size} share={shown} over={over} step={step} />
      {burst && <span className="ring-burst" aria-hidden="true" />}
      {hit > 0 && (
        <span key={hit} className="ring-throw" data-big={hit > 1 || undefined} style={{ "--r": `${size * 0.47}px`, "--far": `${size * (hit > 1 ? 0.075 : 0.05)}px` } as React.CSSProperties} aria-hidden="true">
          {Array.from({ length: hit > 1 ? 20 : 10 }, (_, i) => <i key={i} style={{ "--a": `${((i + 0.5) / (hit > 1 ? 20 : 10)) * 360}deg` } as React.CSSProperties} />)}
        </span>
      )}
      {children}
    </div>
  );
}

/** Progress towards a time goal counts whole minutes until the goal's time has elapsed. */
export const minutes = (ms: number, goalMs = 0) =>
  Math.max(0, ms < goalMs ? Math.floor(ms / 60_000) : Math.round(ms / 60_000));
/** Minutes for display: a few seconds of review shows as "<1", never as 0. */
export const minutesText = (ms: number, goalMs = 0) => {
  const shown = minutes(ms, goalMs);
  return ms > 0 && shown === 0 ? "<1" : String(shown);
};

// Digits on a 5 by 7 grid, one string per row, for `DotNumber`.
const DIGITS: Record<string, string[]> = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "00000", "00100"],
};

/** A number drawn in the ring's own fat round dots (D242), `height` px tall: a screen's hero number where the dot
 *  face's one-dot stroke is too thin to carry it. Decorative: the caller says the number in text beside it.
 *  `glint`: a light crosses its dots once, as the number lands (D257). `trim`: no empty column at either end. */
export function DotNumber({ value, height, glint, trim }: { value: number | string; height: number; glint?: boolean; trim?: boolean }) {
  const chars = [...(typeof value === "string" ? value : String(Math.max(0, Math.round(value))))];
  // `trim`: the box ends where the dots do, so a number that is centred is centred by what is seen ("14" stood
  // half a dot right of its ring: a 1 has an empty column at its left, a 4 none at its right).
  const edge = (ch: string | undefined, last?: boolean) => {
    const cols = [0, 1, 2, 3, 4].filter((x) => (DIGITS[ch ?? ""] ?? []).some((row) => row[x] === "1"));
    return !trim || !cols.length ? 0 : last ? 4 - cols[cols.length - 1]! : cols[0]!;
  };
  const x0 = edge(chars[0]), w = chars.length * 6 - 1 - x0 - edge(chars[chars.length - 1], true);
  return (
    <svg className={`dot-number${glint ? " glint" : ""}`} width={(height * w) / 7} height={height} viewBox={`${x0} 0 ${w} 7`} aria-hidden="true">
      {chars.flatMap((ch, k) => (DIGITS[ch] ?? []).flatMap((row, y) => [...row].map((on, x) => (on === "1" ? <circle key={`${k}-${x}-${y}`} cx={k * 6 + x + 0.5} cy={y + 0.5} r={0.46} style={glint ? ({ "--i": k * 6 + x + y * 0.6 } as React.CSSProperties) : undefined} /> : null))))}
    </svg>
  );
}
