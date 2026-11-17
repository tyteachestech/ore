import { useEffect, useRef, useState } from "react";
import { still } from "./SideCursor";

/** Letters a second when the reply is not behind: about a fast reader's pace, so the words never outrun him. */
export const BASE = 70;
/** How far behind the model the words on screen may fall, in seconds: a clump, or a reply that lands whole, sweeps in within this. */
export const LAG = 0.5;

/** Letters a second to type what is not yet shown: BASE, or fast enough to show it all within LAG. Set again
 *  each time more arrives, so a clump, or a reply that lands whole, is on screen LAG after it came (D321). */
export function steadyRate(shown: number, target: number): number {
  return Math.max(BASE, (target - shown) / LAG);
}

/** How many letters show after `dt` ms at `rate`, never more than the model sent. */
export function steadyStep(shown: number, target: number, rate: number, dt: number): number {
  return Math.min(target, shown + (rate * dt) / 1000);
}

/** Letters `a` and `b` share from the start: where the shown text stays when the model starts over. */
export function sharedStart(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/** The reply typed out at a steady pace, letter by letter, as ChatGPT and Claude even out a stream
 *  (D321). `key` names the reply; `text` is all of it the model has sent so far. A reply
 *  that was already whole when its key first came (a saved chat) shows at once, as does everything
 *  under reduced motion. `caught` is true once every letter sent is on screen. */
export function useSteady(key: string | undefined, text: string, live: boolean): { shown: string; caught: boolean } {
  const state = useRef({ key: undefined as string | undefined, typing: false, n: 0 });
  if (state.current.key !== key) state.current = { key, typing: live && typeof matchMedia === "function" && !still(), n: 0 };
  const s = state.current;
  const [, draw] = useState(0);
  const n = Math.floor(s.n);
  const prefix = text.slice(0, n);
  // The model started over (a retry after a failed check): keep what still matches and type on from there.
  if (s.typing && !text.startsWith(prefix)) s.n = sharedStart(prefix, text);
  const caught = !s.typing || Math.floor(s.n) >= text.length;
  useEffect(() => {
    if (caught) return;
    let last = performance.now();
    const rate = steadyRate(s.n, text.length);
    let frame = requestAnimationFrame(function tick(now) {
      s.n = steadyStep(s.n, text.length, rate, Math.min(64, now - last));
      last = now;
      draw((d) => d + 1);
      if (s.n < text.length) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [text, caught, s]);
  return { shown: s.typing ? text.slice(0, Math.floor(s.n)) : text, caught };
}
