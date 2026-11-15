import { useEffect, useState } from "react";
import { Hint } from "./Hint";
import { SkillIcon } from "./IconPicker";
import { DotNumber, minutes } from "./Ring";
import { still } from "./SideCursor";
import type { Skill, Today } from "./ore";

/** The end screen's minutes: where the day stood before this session, where it stands now, and the goal they
 *  are measured against (0 when today has none: an off day under Weekdays only). */
export type Lap = { from: number; to: number; goal: number };
export function lapPlan(before: Today | null, today: Today): Lap {
  const goal = today.counts && today.goal_ms > 0 ? today.goal_minutes : 0;
  // Minutes round, the goal does not: 9 min 40 s is not 10, so a day short of its goal never shows the goal's number.
  const side = (t: Today | null) => (!t ? 0 : !goal ? minutes(t.active_ms) : t.met ? Math.max(goal, minutes(t.active_ms)) : Math.min(goal - 1, minutes(t.active_ms)));
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
 *  bonus minute lands on its own (the ring's dots, the number and the "+N" tick together). `hit` counts the
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

/** What stands in the end screen's ring: the day's minutes in the ring's own dots; beside "min", what came
 *  after the goal, on a chip in the ring's green (the key to the dots with a white centre); and under them one
 *  line, the skills this session kept memories in, smallest first, one at a time, resting on the one it fed
 *  most. */
export function LapCentre({ min, goal, kept, skills, run }: { min: number; goal: number; kept: { skill: string; n: number }[]; skills: Skill[]; run: boolean }) {
  const bonus = goal > 0 ? Math.max(0, min - goal) : 0;
  // Three at most, so the roll is over in a couple of seconds; `kept` comes most first.
  const rows = kept.slice(0, 3).reverse();
  const calm = still();
  const [row, setRow] = useState(calm ? rows.length - 1 : 0);
  useEffect(() => {
    if (!run || calm || row >= rows.length - 1) return;
    const id = setTimeout(() => setRow((r) => r + 1), 900);
    return () => clearTimeout(id);
  }, [run, row]);
  // A memory filed under no skill is named as the review picker names it.
  const name = (id: string) => skills.find((s) => s.id === id)?.name ?? "No skill";
  const all = kept.map((k) => `${name(k.skill)} ${k.n}`).join(" · ");
  return (
    <div className="end-lap">
      <span className="end-lap-n" role="img" aria-label={`${min} ${min === 1 ? "minute" : "minutes"} today`}><DotNumber value={min} height={56} /></span>
      <span className="end-lap-min">
        min
        {bonus > 0 && (
          <Hint text={`${bonus} ${bonus === 1 ? "minute" : "minutes"} past today’s goal of ${goal}`}>
            <span className="end-lap-plus" role="img" tabIndex={0} aria-label={`${bonus} ${bonus === 1 ? "minute" : "minutes"} past today’s goal`}><DotNumber value={`+${bonus}`} height={10} /></span>
          </Hint>
        )}
      </span>
      {rows.length > 0 && run && (
        <Hint text={`Memories kept this session · ${all}`}>
          <span className="end-lap-reel" tabIndex={0}>
            <span className="end-lap-rows" style={{ transform: `translateY(${-row * 24}px)` }}>
              {rows.map((k, i) => {
                const s = skills.find((x) => x.id === k.skill);
                return (
                  <span key={k.skill} className={i === row ? "end-lap-skill" : undefined} data-color={s?.color} aria-hidden={i !== row || undefined}>
                    <SkillIcon icon={s?.icon} color={s?.color} dot />
                    <span>{name(k.skill)}</span>
                    <b>+{k.n}</b>
                  </span>
                );
              })}
            </span>
          </span>
        </Hint>
      )}
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
