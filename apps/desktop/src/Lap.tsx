import { useEffect, useState } from "react";
import { DotNumber, minutes } from "./Ring";
import { still } from "./SideCursor";
import type { Today } from "./ore";

/** The end screen's minutes: where the day stood before this session, where it stands now, and the goal they
 *  are measured against (0 when today has none: an off day under Weekdays only). */
export type Lap = { from: number; to: number; goal: number };
export function lapPlan(before: Today | null, today: Today): Lap {
  const goal = today.counts && today.goal_ms > 0 ? today.goal_minutes : 0;
  // Minutes round, the goal does not: 9 min 40 s is not 10, so a day short of its goal never shows the goal's number.
  // A day met by being caught up (D60) still shows the minutes spent, never the goal's.
  const side = (t: Today | null) => (!t ? 0 : !goal || t.met ? minutes(t.active_ms) : Math.min(goal - 1, minutes(t.active_ms)));
  const from = side(before), to = Math.max(from, side(today));
  return { from, to, goal };
}

/** How many ring dots `bonus` minutes past a goal of `goal` minutes light, at the ring's own rate, lap after
 *  lap. Any bonus lights one, as any progress does. */
export function overDots(bonus: number, goal: number, n: number) {
  if (bonus <= 0 || goal <= 0) return 0;
  // As on the first lap, a lap's last dot waits for the whole lap.
  const laps = Math.floor(bonus / goal), rest = bonus - laps * goal;
  return laps * n + (rest > 0 ? Math.min(n - 1, Math.max(1, Math.round((rest / goal) * n))) : 0);
}

/** The minutes the count shows on its way up, one at a time; a long session skips some so it never takes long,
 *  but always stops on the goal and on twice the goal, where the ring's moments are. */
export function lapSteps({ from, to, goal }: Lap): number[] {
  const all = Array.from({ length: Math.max(0, to - from) + 1 }, (_, i) => from + i);
  const stride = Math.ceil(all.length / 22);
  return all.filter((m, i) => i % stride === 0 || m === to || (goal > 0 && (m === goal || m === 2 * goal)));
}

/** Counts the minutes up once `go` is set: quick up to the goal, then one beat per minute past it, so each
 *  bonus minute lands on its own (the ring's dots and the number tick together). `hit` counts the
 *  goal lines crossed on the way, the goal and twice the goal: the ring's two moments. Under Reduce Motion
 *  the end state is there at once and nothing is a moment. */
export function useLap(plan: Lap, go: boolean): { min: number; hit: number } {
  const calm = still();
  const [at, setAt] = useState(calm ? { min: plan.to, hit: 0 } : { min: plan.from, hit: 0 });
  useEffect(() => {
    if (!go || calm) return;
    const list = lapSteps(plan), { goal } = plan;
    const below = list.filter((m) => !goal || m <= goal).length, past = list.length - below;
    let i = 0, id: ReturnType<typeof setTimeout>;
    const next = () => {
      i++;
      const m = list[i];
      if (m === undefined) return;
      setAt((x) => ({ min: m, hit: x.hit + (goal > 0 && (m === goal || m === 2 * goal) ? 1 : 0) }));
      id = setTimeout(next, goal > 0 && m >= goal ? Math.min(200, 1600 / Math.max(1, past)) : Math.min(100, 1000 / Math.max(1, below)));
    };
    id = setTimeout(next, 120);
    return () => clearTimeout(id);
  }, [go]);
  return at;
}

/** What stands in the end screen's ring: the day's minutes in the ring's own dots, centred, and a small "m" in
 *  the same dots hanging off their right on their baseline, so the number stays in the middle whatever its width
 *  ("11m", Tyler 2026-11-19: "the wording in the circle feels cramped"; "making 'm' small and keeping 11 mostly centred"). What came after the goal is the ring's
 *  dots with a white centre, and the memories kept are in the row under it. */
export function LapCentre({ min }: { min: number }) {
  return (
    <div className="end-lap">
      <span className="end-lap-n" role="img" aria-label={`${min} ${min === 1 ? "minute" : "minutes"} today`}><DotNumber value={min} height={56} /><span className="end-lap-m"><DotNumber value="m" height={28} /></span></span>
    </div>
  );
}

/** White sparkles over the ring's bonus dots, for as long as the end screen is up: small crosses of dots that
 *  open and fade, only on the stretch past the goal, so they also say how far it went. A few past the goal,
 *  more and quicker past twice the goal. None under Reduce Motion. `n` is the ring's dots, `over` the bonus dots lit. */
export function Sparkles({ over, n }: { over: number; n: number }) {
  const twice = over > n, slots = twice ? 6 : 3, every = twice ? 240 : 650;
  const [marks, setMarks] = useState<{ id: number; x: number; y: number }[]>([]);
  const on = over > 0 && !still();
  useEffect(() => {
    if (!on) return setMarks([]);
    let id = 0;
    const span = Math.min(n, twice ? over - n : over);
    const t = setInterval(() => {
      if (document.hidden) return;
      const a = ((Math.random() * Math.max(1, span - 1)) / n) * 2 * Math.PI - Math.PI / 2, r = 43 + (Math.random() - 0.5) * 11;
      setMarks((m) => [...m.slice(-(slots - 1)), { id: ++id, x: 50 + r * Math.cos(a), y: 50 + r * Math.sin(a) }]);
    }, every);
    return () => clearInterval(t);
  }, [on, over, n]);
  return (
    <>
      {marks.map((m) => (
        <span key={m.id} className="ring-sparkle" data-twice={twice || undefined} style={{ left: `${m.x}%`, top: `${m.y}%` }} aria-hidden="true"><i /><i /><i /><i /><i /></span>
      ))}
    </>
  );
}
