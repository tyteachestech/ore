import { useSyncExternalStore } from "react";
import { Working } from "./Working";

/** The source this device is filling in right now (an episode's audio coming down, then heard: D227), and
 *  how far it is. One at a time; the iPhone's shell sets it (phone/core.ts `fill`). */
export type Filling = { id: string; done: number; label?: string };
let now: Filling | null = null;
const subs = new Set<() => void>();
export function setFilling(f: Filling | null): void {
  now = f;
  for (const s of subs) s();
}
const sub = (s: () => void) => (subs.add(s), () => void subs.delete(s));
/** How far `id` is, while this device is filling it. */
export function useFilling(id: string): Filling | null {
  const f = useSyncExternalStore(sub, () => now);
  return f?.id === id ? f : null;
}

/** A wait that says what it is doing and how far it is (the Mac's adding toast, Podcasts' download ring):
 *  the working line, a bar once there is a fraction to draw, and what he has to do for it to finish. */
export function FillingLine({ filling, row }: { filling: Filling; row?: boolean }) {
  const label = filling.label ?? "Transcribing";
  return (
    <span className={`filling${row ? " in-row" : ""}`}>
      <Working label={label} stage={filling.label ? "work" : "write"}>
        {!row && <span className="filling-keep">Keep Ore open to finish.</span>}
      </Working>
      {filling.done > 0 && (
        <span className="filling-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(filling.done * 100)}>
          <span style={{ transform: `scaleX(${Math.min(1, filling.done)})` }} />
        </span>
      )}
    </span>
  );
}
