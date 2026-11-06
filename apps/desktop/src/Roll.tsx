import { useLayoutEffect, useRef, useState } from "react";
import { still } from "./SideCursor";

/** The last value each number showed, so one that changed while he was away (minutes after a review,
 *  a gem made solid) rolls from what he last saw when he comes back. Lives as long as the window. */
const seen = new Map<string, string>();

/** Four hard frames: the digit wheel of RareUI's animated counter as 8-bit motion (D113). */
const ROLL_MS = 112;

/** Which characters change, right-aligned, and which way they roll: up when the number grows. */
export function rollPlan(from: string, to: string): { chars: { was: string; now: string }[]; up: boolean } {
  const n = Math.max(from.length, to.length);
  const a = from.padStart(n, " ");
  const b = to.padStart(n, " ");
  const up = Number.isFinite(Number(from)) && Number.isFinite(Number(to)) ? Number(to) >= Number(from) : true;
  return { chars: [...b].map((now, i) => ({ was: a[i]!, now })), up };
}

/** A big pixel number that rolls digit by digit when it changes, never on its first showing.
 *  `id` names the number across screens (Home and the skill page share a skill's). */
export function Roll({ value, id }: { value: string | number; id: string }) {
  const now = String(value);
  const last = useRef(seen.get(id) ?? now);
  const [roll, setRoll] = useState<{ from: string; to: string } | null>(null);

  useLayoutEffect(() => {
    const from = last.current;
    last.current = now;
    seen.set(id, now);
    if (from === now || still()) return;
    setRoll({ from, to: now });
    const t = setTimeout(() => setRoll(null), ROLL_MS + 40);
    return () => clearTimeout(t);
  }, [id, now]);

  if (!roll || roll.to !== now) return <span className="roll">{now}</span>;
  const plan = rollPlan(roll.from, roll.to);
  return (
    <span className={`roll${plan.up ? " up" : " down"}`} aria-label={now}>
      {plan.chars.map((c, i) =>
        c.was === c.now ? (
          <span key={i} aria-hidden="true">{c.now}</span>
        ) : (
          <span key={i} className="roll-slot" aria-hidden="true">
            <span className="roll-was">{c.was === " " ? " " : c.was}</span>
            <span className="roll-now">{c.now === " " ? "\u00a0" : c.now}</span>
          </span>
        ),
      )}
    </span>
  );
}
