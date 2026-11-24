import { useEffect, useState } from "react";
import { Hint } from "./Hint";
import { DotNumber, DotRing, minutes } from "./Ring";
import { Gem } from "./Gem";
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
/** What the end screen's rows show and what flies to them, worked out once so the screen and the flight agree.
 *  A row is a skill the session fed; its line is the session's own stones for it, one per memory kept: the ones
 *  that became gems first, then the ones one good answer from a gem, then the rest. A flier is one of those,
 *  leaving the ring for its place in the line. Skills that went up lead, then by gems, then by memories kept. */
export type EndRow = { skill: string; cut: number; kept: number; slots: ("cut" | "ready" | "rough")[]; extra: number; first: number };
export function endPlan(cut: string[], kept: { skill: string; n: number }[], was: Today["skills"], now: Today["skills"]): { rows: EndRow[]; fliers: { skill: string; kind: "cut" | "ready" | "rough"; row: number }[]; more: number } {
  const of = (list: Today["skills"], id: string) => list.find((k) => k.skill === id);
  const up = (id: string) => (of(now, id)?.level ?? 0) > (of(was, id)?.level ?? of(now, id)?.level ?? 0);
  const ids = [...new Set([...cut, ...kept.map((k) => k.skill)])].filter((id) => of(now, id));
  const all = ids.map((id) => {
    const c = cut.filter((x) => x === id).length, n = Math.max(c, kept.find((k) => k.skill === id)?.n ?? 0);
    const near = Math.min(of(now, id)!.ready, n - c);
    const line = [...Array<"cut">(c).fill("cut"), ...Array<"ready">(near).fill("ready"), ...Array<"rough">(n - c - near).fill("rough")];
    return { skill: id, cut: c, kept: n, slots: line.slice(0, LINE), extra: Math.max(0, n - LINE), first: 0 };
  }).sort((x, y) => Number(up(y.skill)) - Number(up(x.skill)) || y.cut - x.cut || y.kept - x.kept);
  const rows = all.slice(0, all.length > REEL_ROWS ? REEL_ROWS - 1 : REEL_ROWS);
  const fliers = rows.flatMap((r, row) => ((r.first = rows.slice(0, row).reduce((n, x) => n + x.slots.length, 0)), r.slots.map((kind) => ({ skill: r.skill, kind, row }))));
  return { rows, fliers, more: all.length - rows.length };
}
/** The most stones a row's line holds; past it the line ends on "+N". */
const LINE = 8;

/** How far a session's fliers have got, row by row of its plan: the gems that have landed on the skill's ring,
 *  the rough stones that have landed on its medal, and whether its medal is out. */
export type EndProg = { cut: number[]; stone: number[]; shown: boolean[]; done: boolean };
/** Where a skill's level stands with `here` of the session's gems landed (all of them once `done`): the level,
 *  whether that is a new one, the share of the way to the next, and the share one good answer away (`soon`). */
export function levelAt(r: EndRow, here: number, done: boolean, was: Today["skills"], now: Today["skills"]) {
  const k = now.find((x) => x.skill === r.skill)!, b = was.find((x) => x.skill === r.skill) ?? k;
  const count = done ? Math.max(k.peak, b.peak + r.cut) : b.peak + here;
  const lv = Math.floor(Math.sqrt(count / 5)), from = 5 * lv ** 2, next = 5 * (lv + 1) ** 2, up = lv > b.level;
  // A skill that went up filled the level it was on: its ring stays full.
  return { lv, up, share: up ? 1 : (count - from) / (next - from), soon: up ? 0 : Math.min(k.ready, next - count) / (next - from) };
}

/** A skill's turn in the end screen's big ring (Tyler, 2026-11-23: "I don't want to read it. I want to feel it
 *  with an animation, like Duolingo does"; an independent critic the same day, of medals under the ring: "the
 *  climax is the smallest event on screen"). For the length of its turn the ring is the skill's: its dots are the
 *  way to the skill's next level in the skill's colour, its icon and level stand in the middle, and each gem the
 *  session cut for it leaves its place and lands on the rim as the next dots. A new level throws the dots
 *  outward and turns the number, and is held. Then it goes down to its medal (`leaving`). One thing at a time, in
 *  the centre, the level a ring round the thing itself: Duolingo's lesson end and level up, Mimo, Finch, Brilliant
 *  (Mobbin, 2026-11-23). */
export function SkillStage({ row, here, leaving, size, was, now, skills }: { row: EndRow; here: number; leaving: boolean; size: number; was: Today["skills"]; now: Today["skills"]; skills: Skill[] }) {
  const s = skills.find((x) => x.id === row.skill), lv = levelAt(row, here, false, was, now);
  return (
    <div className="end-stage" data-color={s?.color} data-leaving={leaving || undefined} aria-hidden="true">
      <span className="end-stage-ring gem-ring" key={`in${here}`} data-beat={here || undefined} style={{ width: size, height: size }}><DotRing size={size} share={lv.share} ghost={lv.soon} step /></span>
      {lv.up && <span className="end-stage-burst">{Array.from({ length: 24 }, (_, d) => <i key={d} style={{ "--a": `${d * 15}deg` } as React.CSSProperties} />)}</span>}
      <span className="end-stage-mid">
        <SkillIcon icon={s?.icon} color={s?.color} dot />
        {(lv.lv > 0 || lv.up) && <b key={`lv${lv.lv}`} data-flip={lv.up || undefined}>{lv.lv}</b>}
      </span>
    </div>
  );
}

/** Under the end screen's ring: a medal for each skill the session fed, and no sentence in it. A medal is the
 *  skill's icon inside the ring of its level, the level on its rim once it has one. A skill that won a gem comes
 *  down here from its turn in the big ring (`SkillStage`); the rest come in together, and the session's rough
 *  stones fly to their medals in one volley. The dim dots ahead are the memories one good answer from a gem.
 *  Every medal's place is held from the start, so none slides when another arrives.
 *  `was` and `now` are each skill's strength before and after. */
export function SkillRows({ plan, prog, was, now, skills, run }: { plan: ReturnType<typeof endPlan>; prog: EndProg; was: Today["skills"]; now: Today["skills"]; skills: Skill[]; run: boolean }) {
  if (!plan.rows.length) return null;
  const name = (id: string) => skills.find((s) => s.id === id)?.name ?? "No skill";
  const said = (r: EndRow, lv: number) => [name(r.skill), `${r.kept} kept`, r.cut > 0 && `${r.cut} became ${r.cut === 1 ? "a gem" : "gems"}`, lv > 0 && `level ${lv}`].filter(Boolean).join(" · ");
  return (
    // Its room is held from the start, so the results under it never move when it comes in.
    <div className="end-skills" data-wait={!run || undefined}>
      <span className="sr-only">{plan.rows.map((r) => said(r, now.find((k) => k.skill === r.skill)!.level)).join(". ")}</span>
      {plan.rows.map((r, i) => {
        const s = skills.find((x) => x.id === r.skill), lv = levelAt(r, prog.cut[i]!, prog.done, was, now);
        return (
          <Hint key={r.skill} text={said(r, lv.lv)}>
            <div className="end-medal" data-skill={r.skill} data-color={s?.color} data-wait={!prog.shown[i] || undefined} data-up={lv.up || undefined}>
              <span className="end-medal-ring" data-row={i} aria-hidden="true">
                <span className="end-medal-core gem-ring" data-beat={prog.stone[i] || undefined} key={`in${prog.stone[i]}`}>
                  <DotRing size={MEDAL} share={lv.share} ghost={lv.soon} step />
                  <SkillIcon icon={s?.icon} color={s?.color} dot />
                </span>
                {lv.lv > 0 && <b className="gem-ring-lv" data-flip={lv.up || undefined}>{lv.lv}</b>}
                {/* What flies, drawn once here so the flight can lift a copy of it. */}
                <span className="end-medal-fliers">{r.slots.map((kind, d) => <span key={d} data-slot={r.first + d}><Gem kind={kind} size={kind === "cut" ? 28 : 20} /></span>)}</span>
              </span>
              <span className="end-medal-name">{name(r.skill)}</span>
            </div>
          </Hint>
        );
      })}
      {/* Three at most; a session that fed more says how many. */}
      {plan.more > 0 && <span className="end-skills-more" data-wait={!prog.shown.every(Boolean) || undefined}>+{plan.more}</span>}
    </div>
  );
}
const REEL_ROWS = 3;
/** A medal's ring, in px. */
const MEDAL = 64;

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
