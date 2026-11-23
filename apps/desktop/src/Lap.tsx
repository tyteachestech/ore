import { useEffect, useState } from "react";
import { Hint } from "./Hint";
import { DotNumber, minutes } from "./Ring";
import { still } from "./SideCursor";
import { SkillIcon } from "./IconPicker";
import { type Skill, type Today } from "./ore";

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

/** How many semitones up the tick for minute `min` plays (D336: a semitone higher each, up to an octave): by the
 *  steps the count has shown, not the minutes, since a long session skips some. */
export const lapTickUp = (plan: Lap, min: number) => Math.min(12, Math.max(0, lapSteps(plan).indexOf(min)));

/** Counts the minutes up once `go` is set: quick up to the goal, then one beat per minute past it, so each
 *  bonus minute lands on its own (the ring's dots and the number together). `hit` counts the
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

/** What stands in the end screen's ring: the day's minutes in the ring's own dots, over "min", and nothing
 *  else (Tyler, 2026-11-19: "the wording in the circle feels cramped"). Minutes past the goal are the ring's
 *  own dots with a white centre; the memories kept are under it, skill by skill (`SkillRows`). */
export function LapCentre({ min }: { min: number }) {
  return (
    <div className="end-lap">
      <span className="end-lap-n" role="img" aria-label={`${min} ${min === 1 ? "minute" : "minutes"} today`}><DotNumber value={min} height={56} trim /></span>
      <span className="end-lap-min">min</span>
    </div>
  );
}

/** Under the end screen's ring: the skills this session kept memories in, a row each (Tyler, 2026-11-20, of
 *  the one small line that took turns: "very underwhelming. It almost looks like a subtitle rather than the
 *  reward"). A row is the skill, its level as a figure of dots at the right, and under the name the way to the
 *  next level beside the memories it kept: ten dots, the ones this session lit in the skill's colour. Every row
 *  has its level, so a level never looks like something only one skill has; a skill that went up has its new
 *  level and the whole bar it filled in its colour (an independent critic, 2026-11-20: the level-up was "the
 *  quietest thing in its own row" and "+9" had no unit).
 *  One that went up leads, then the ones fed most, three at most. A memory filed under no skill is named as the
 *  review picker names it, and has no level. `was` and `now` are each skill's strength before and after. */
export function SkillRows({ cut, got, kept, stoned, was, now, skills, run }: { cut: string[]; got: Record<string, number>; /** Skills that kept memories and cut no gem, and the ones whose stone has landed (null: all). */ kept: { skill: string; n: number }[]; stoned: Set<string> | null; was: Today["skills"]; now: Today["skills"]; skills: Skill[]; run: boolean }) {
  const of = (list: Today["skills"], id: string) => list.find((k) => k.skill === id);
  const n = new Map<string, number>();
  // A gem filed under no skill has no level to feed, so no row.
  for (const id of cut) if (of(now, id)) n.set(id, (n.get(id) ?? 0) + 1);
  const up = (id: string) => (of(now, id)?.level ?? 0) > (of(was, id)?.level ?? of(now, id)?.level ?? 0);
  const all = [...[...n.keys()].sort((x, y) => Number(up(y)) - Number(up(x)) || n.get(y)! - n.get(x)!), ...kept.map((k) => k.skill)], rows = all.slice(0, all.length > REEL_ROWS ? REEL_ROWS - 1 : REEL_ROWS);
  if (!rows.length) return null;
  // Where the skill stands once `got` of its gems have landed: a gem is one step, and a full level flips.
  const at = (id: string) => {
    const k = of(now, id), b = of(was, id) ?? k;
    if (!k || !b) return null;
    const here = Math.min(got[id] ?? 0, n.get(id)!), count = here >= n.get(id)! ? Math.max(k.peak, b.peak + here) : b.peak + here;
    const lv = Math.floor(Math.sqrt(count / 5)), from = 5 * lv ** 2, next = 5 * (lv + 1) ** 2;
    const before = lv > b.level ? 0 : Math.round(((b.peak - from) / (next - from)) * BAR);
    // A skill that went up filled the level it was on: its bar stays full, in its colour, and says so.
    if (lv > b.level) return { lv, up: true, line: `reached level ${lv}`, before: 0, to: BAR, here };
    return { lv, up: false, line: `${next - count} to level ${lv + 1}`, before: Math.max(0, before), to: Math.max(before, Math.round(((count - from) / (next - from)) * BAR)), here };
  };
  const name = (id: string) => skills.find((s) => s.id === id)?.name ?? "No skill";
  // A skill with no gem today says what it kept, and how many of its stones are one good answer from a gem.
  const stone = (id: string) => {
    const k = kept.find((x) => x.skill === id);
    if (!k) return null;
    const near = of(now, id)?.ready ?? 0;
    return `${k.n} kept${near > 0 ? ` · ${near} nearly ${near === 1 ? "a gem" : "gems"}` : ""}`;
  };
  const said = all.map((id) => [name(id), stone(id) ?? `${n.get(id)} ${n.get(id) === 1 ? "gem" : "gems"}`, up(id) && `level ${of(now, id)!.level}`].filter(Boolean).join(", ")).join(" · ");
  const more = all.length - rows.length;
  return (
    // Its room is held from the start, so the results under it never move when it comes in.
    <div className="end-skills" data-wait={!run || undefined}>
      <span className="sr-only">{said}</span>
      {rows.map((id, i) => {
        const s = skills.find((x) => x.id === id), st = stone(id), lv = st ? null : at(id), k = of(now, id);
        return (
          <div key={id} className="end-skill" data-skill={id} data-color={s?.color} data-up={lv?.up || undefined} aria-hidden="true" style={{ "--i": i } as React.CSSProperties}>
            <SkillIcon icon={s?.icon} color={s?.color} dot />
            <span className="end-skill-name">{name(id)}</span>
            {lv && <b key={lv.lv} data-flip={lv.up || undefined}>Level <DotNumber value={lv.lv} height={24} /></b>}
            {st && k && <b>Level <DotNumber value={k.level} height={24} /></b>}
            <span className="end-skill-level">
              {lv && <span className="end-skill-bar">{Array.from({ length: BAR }, (_, d) => <i key={d} data-on={d < lv.before || undefined} data-new={(d >= lv.before && d < lv.to) || undefined} />)}</span>}
              {lv && <span key={lv.here} className="end-skill-left">{lv.line}</span>}
              {st && <span className="end-skill-left" data-wait={(stoned && !stoned.has(id)) || undefined}>{st}</span>}
            </span>
          </div>
        );
      })}
      {/* Three rows at most; a session that fed more says how many, and names them all on hover and focus. */}
      {more > 0 && <Hint text={`Gems cut this session · ${said}`}><span className="end-skills-more" tabIndex={0}>and {more} more {more === 1 ? "skill" : "skills"}</span></Hint>}
    </div>
  );
}
const REEL_ROWS = 3;
/** The dots in a row's bar to the next level. */
const BAR = 10;

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
