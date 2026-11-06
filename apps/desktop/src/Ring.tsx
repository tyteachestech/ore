import { useEffect, useState } from "react";

/** The daily goal as a ring (D60), like Apple Fitness's move ring: it fills from `from` to `value`
 *  when shown and plays one short burst when `burst` is set (D62; none under Reduce Motion). */
export function Ring({ value, from = 0, size = 64, met, burst = false, label }: { value: number; from?: number; size?: number; met: boolean; burst?: boolean; label: string }) {
  const [shown, setShown] = useState(from);
  const target = met ? 1 : Math.max(0, Math.min(1, value));
  useEffect(() => {
    const f = requestAnimationFrame(() => setShown(target));
    return () => cancelAnimationFrame(f);
  }, [target]);
  const stroke = Math.max(5, Math.round(size / 9));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className={`ring${met ? " met" : ""}`} style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-active)" strokeWidth={stroke} />
        <circle
          className="ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--c-green)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(1, shown)))}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {burst && <span className="ring-burst" aria-hidden="true" />}
    </div>
  );
}

export const minutes = (ms: number) => Math.max(0, Math.round(ms / 60_000));
/** Minutes for display: a few seconds of review shows as "<1", never as 0. */
export const minutesText = (ms: number) => (ms > 0 && ms < 30_000 ? "<1" : String(minutes(ms)));
