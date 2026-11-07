import { GearSix } from "./icons";
import { useCallback, useEffect, useState, type ComponentProps } from "react";
import { gemHint, GemRing, NearGoal } from "./Gem";
import { Hint } from "./Hint";
import { label, useKeymap } from "./keys";
import { WithMenu, type MenuAction } from "./Menu";
import { SkillIcon } from "./IconPicker";
import { lessonsOf, levelProgress, nextLesson, ore, type Item, type Skill, type Today } from "./ore";
import { minutes, minutesText, Ring } from "./Ring";
import { dueSkills, rememberToday, ReviewPick } from "./ReviewPick";
import { SkillChip, skillGroups, SkillPicker } from "./Skills";
import { useSplit } from "./split";
import { Thumb } from "./Thumb";
import { Roll } from "./Roll";
import { errorText, load, type Notify } from "./util";

const day = () => new Date().toLocaleDateString("sv-SE");

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** Home (D58): today's goal and what is due, the sources he is reading, and each skill's
 *  strength. Apple Fitness for the ring; Start review asks what to review (D80). */
export function Home({ items, empty, skills, recent, reload, onReview, onOpenSource, onOpenSkill, onRefile, onCreateSkill, onSettings, sourceMenu, onRename, skillMenu, notify }: {
  items: Item[];
  /** The library has no sources yet (loaded, not loading): Home says how to add the first. */
  empty?: boolean;
  skills: Skill[];
  recent: string[];
  /** Changes whenever Home should reload today's numbers (after a review). */
  reload: number;
  onReview: (pick: string[] | null) => void;
  onOpenSource: (id: string) => void;
  onOpenSkill: (id: string) => void;
  /** Files a source under other skills from its chips (the same picker as the source lists). */
  onRefile?: (item: Item, next: string[], before: string[], changed: Skill) => void;
  onCreateSkill?: (name: string) => Promise<Skill | undefined>;
  /** Opens Settings; left out on the phone, which has none: its gear and plan button are not shown. */
  onSettings?: () => void;
  /** A source's and a skill's actions: the same right-click menus as in the source list and sidebar.
   *  Left out (the phone), a row has no menu at all: a long-press must not open an empty one. */
  sourceMenu?: (item: Item) => MenuAction[];
  /** Saves a source's title, typed in place on its row from Rename…. */
  onRename?: (item: Item, title: string) => void;
  skillMenu?: (skill: Skill) => MenuAction[];
  notify: Notify;
}) {
  const keys = useKeymap();
  const [renaming, setRenaming] = useState<string | null>(null);
  /** Rename… after Open, as in the source list, typed on the row itself. */
  const withRename = (acts: MenuAction[], i: Item): MenuAction[] =>
    onRename ? acts.flatMap((a) => (a.id === "open" ? [a, { id: "rename", label: "Rename…", run: () => setRenaming(i.id) }] : [a])) : acts;
  const [today, setToday] = useState<Today | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    ore<Today>("today").then(
      (t) => {
        rememberToday(t);
        setToday(t);
        setError(null);
      },
      (e) => setError(errorText(e)),
    );
  }, []);
  useEffect(refresh, [refresh, reload]);

  const [picking, setPicking] = useState(false);
  /** Start review asks what to review (D80) when there is a choice; with one skill due, it just starts. */
  const ask = useCallback(() => (today && dueSkills(today, skills).length > 1 ? setPicking(true) : onReview(null)), [today, skills, onReview]);

  // ↵ starts review (D58, D80) unless focus is on something that takes Enter itself.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if ((e.target as HTMLElement).closest?.("button, a, input, textarea, [contenteditable='true'], [role='dialog']")) return;
      if (!today?.due) return;
      e.preventDefault();
      ask();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [today, ask]);

  // Arrows move between skill tiles and Continue reading (Raycast's grid): ←→ in order, ↑↓ to the
  // nearest one in the row above or below. Nothing is selected until an arrow is pressed.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.key.startsWith("Arrow") || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t.closest?.("input, textarea, [contenteditable='true'], [role='dialog'], [role='menu']")) return;
      const all = [...document.querySelectorAll<HTMLElement>(".home .home-skill, .home .home-read")];
      if (!all.length) return;
      const at = all.indexOf(t);
      if (at < 0 && t !== document.body) return;
      e.preventDefault();
      if (at < 0) return all[0]!.focus();
      const box = (el: HTMLElement) => el.getBoundingClientRect();
      const here = box(t);
      let next: HTMLElement | undefined;
      if (e.key === "ArrowRight") next = all[at + 1];
      else if (e.key === "ArrowLeft") next = all[at - 1];
      else {
        const down = e.key === "ArrowDown";
        const rows = all.filter((el) => (down ? box(el).top > here.bottom - 1 : box(el).bottom < here.top + 1));
        const rowTop = down ? Math.min(...rows.map((el) => box(el).top)) : Math.max(...rows.map((el) => box(el).top));
        const cx = here.left + here.width / 2;
        next = rows
          .filter((el) => Math.abs(box(el).top - rowTop) < 2)
          .sort((a, b) => Math.abs(box(a).left + box(a).width / 2 - cx) - Math.abs(box(b).left + box(b).width / 2 - cx))[0];
      }
      next?.focus();
      next?.scrollIntoView({ block: "nearest" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /** Skills with sources or cards; empty ones stay in the sidebar only. */
  const shown = skills.filter((s) => items.some((i) => i.skills.includes(s.id)) || today?.skills.some((x) => x.skill === s.id && (x.due || x.solid)));

  // A lesson he opened stands for its course (D79): the lesson to read next, once, even when the one he
  // opened is done.
  const reading = [
    ...new Set(
      [...recent, ...items.filter((i) => i.status === "reading").map((i) => i.id)].flatMap((id) => {
        const i = items.find((x) => x.id === id);
        const up = i?.course ? nextLesson(lessonsOf(items, i.course.id)) : i?.status === "reading" ? i : null;
        return up ? [up] : [];
      }),
    ),
  ].slice(0, 5);

  const split = useSplit("ore.home-split", 1 / 3);
  const two = reading.length > 0 && shown.length > 0 && !!today;
  return (
    <div className="home">
      <section className="home-today" aria-label="Today">
        {error && (
          <div role="alert">
            <p className="err">{error}</p>
            {/* The first screen: once he fixes what it names (the `ore` command, Bun), it comes back without a relaunch. */}
            <button className="pill-btn" onClick={refresh}>
              Try again
            </button>
          </div>
        )}
        {today && (
          <>
            <div className="home-goal">
              <Ring value={today.goal_ms ? today.active_ms / today.goal_ms : 0} met={today.met} size={92} label={`${minutes(today.active_ms)} of ${today.goal_minutes} minutes today`} />
              <div className="home-goal-text">
                <h1>
                  <Roll id="goal" value={minutesText(today.active_ms)} /> <span>of {today.goal_minutes} min</span>
                </h1>
                {/* Today's slice, not the pile (D65): the full count waits in the hint. */}
                {today.due > 0 ? (
                  <Hint text={`${today.due} due · about ${Math.max(1, minutes(today.estimate_ms))} min in all`}>
                    <p>{subline(today)}</p>
                  </Hint>
                ) : (
                  <p>{subline(today)}</p>
                )}
                {/* His plan (D67): the cue that starts review, set in Settings › Review. On the phone (no Settings)
                    the plan is read, not set: a button that does nothing is never shown. */}
                {onSettings ? (
                  <Hint text={today.plan ? "Change your plan" : "Pick when you review each day"}>
                    <button className={`home-plan${today.plan ? "" : " empty"}`} onClick={onSettings}>
                      {today.plan ? `After ${today.plan}, I review.` : "Plan when you review"}
                    </button>
                  </Hint>
                ) : (
                  today.plan && <p className="home-plan">After {today.plan}, I review.</p>
                )}
                <Week week={today.week} />
              </div>
              {/* Beside the ring, not on a row of its own: Today is only as tall as the ring. Nothing due: the
                  subline already says so, so no dead button. */}
              {today.due > 0 && (
                <Hint text="Start review" keys="review">
                  <button className="pill-btn home-go" onClick={ask}>
                    Start review
                  </button>
                </Hint>
              )}
              {onSettings && (
                <Hint text="Settings" keys="settings">
                  <button className="home-gear" aria-label="Settings" onClick={onSettings}>
                    <GearSix size={16} aria-hidden="true" />
                  </button>
                </Hint>
              )}
            </div>

          </>
        )}
        {picking && today && (
          <ReviewPick
            today={today}
            skills={skills}
            onClose={() => setPicking(false)}
            onStart={(pick) => {
              setPicking(false);
              onReview(pick);
            }}
          />
        )}
      </section>

      {/* An empty library: the one thing to do next, as the empty source list says it. */}
      {empty && today && (
        <p className="empty-state">
          Nothing to read yet. Paste a link, a file or any text with <b>{label(keys.add)}</b>, or drop files here.
        </p>
      )}

      {/* Under Today: what to read on the left, skills on the right, split by a bar he can drag (as on the skill page). */}
      <div className={`home-cols${split.dragging ? " dragging" : ""}`} style={two ? { gridTemplateColumns: `minmax(0, ${1 - split.side}fr) 20px minmax(0, ${split.side}fr)` } : undefined}>
      {reading.length > 0 && (
        <section className="home-cont" aria-label="Continue reading">
          <h2 className="home-h">Continue reading</h2>
          <div className="home-reading">
            {reading.map((i) => {
              const at = Number(load(`ore.pos.${i.id}`) ?? 0) || 0;
              return (
                // A row that opens on click, holding the skill picker's own button, so not a <button> itself.
                <WithMenu key={i.id} actions={sourceMenu ? () => withRename(sourceMenu(i), i) : []}>
                <div className="home-read" role="button" tabIndex={0} onClick={() => onOpenSource(i.id)} onKeyDown={(e) => e.target === e.currentTarget && (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpenSource(i.id))}>
                  <Thumb item={i} />
                  {renaming === i.id ? (
                    <input
                      className="row-rename"
                      aria-label="Title"
                      autoFocus
                      defaultValue={i.title}
                      onFocus={(e) => e.currentTarget.select()}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") {
                          setRenaming(null);
                          onRename?.(i, e.currentTarget.value);
                        } else if (e.key === "Escape") setRenaming(null);
                      }}
                      // Half-typed text is never saved on blur (AGENTS.md); Enter saves.
                      onBlur={() => setRenaming(null)}
                    />
                  ) : (
                    <span className="title">{i.title}</span>
                  )}
                  {i.course && <span className="course-of">{i.course.title}</span>}
                  {onRefile && onCreateSkill && (
                    <SkillPicker skills={skills} value={i.skills} title={i.title} onChange={(next, before, k) => onRefile(i, next, before, k)} onCreate={onCreateSkill}>
                      {i.skills.length > 0 && (
                        <span className="chips">
                          {i.skills.map((id) => (
                            <SkillChip key={id} skill={skills.find((s) => s.id === id) ?? { id, name: id }} />
                          ))}
                        </span>
                      )}
                    </SkillPicker>
                  )}
                  <Hint text={`${Math.round(at * 100)}% read`}>
                    <span className="home-meter small">
                      <span style={{ width: `${Math.max(4, at * 100)}%` }} />
                    </span>
                  </Hint>
                </div>
                </WithMenu>
              );
            })}
          </div>
        </section>
      )}

      {two && (
        <Hint text="Drag to resize · double-click to reset">
          <div className="col-divider" role="separator" aria-orientation="vertical" aria-label="Resize columns" {...split.divider} />
        </Hint>
      )}
      {shown.length > 0 && today && (
        <section className="home-skill-col" aria-label="Skills">
          {skillGroups(shown).map((g) => (
            <div key={g.name}>
              <h2 className="home-h">{g.name}</h2>
              <div className="home-skills">
                {g.skills.map((s) => (
                  <WithMenu key={s.id} actions={skillMenu ? () => skillMenu(s) : []}>
                    <SkillTile skill={s} strength={today.skills.find((x) => x.skill === s.id)} onOpen={() => onOpenSkill(s.id)} />
                  </WithMenu>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
      </div>
    </div>
  );
}

/** One skill's strength (D62, D63): its level, which never drops, and the way to the next one. */
// The rest (ref and handlers) comes from the right-click menu's trigger.
function SkillTile({ skill: s, strength: k, onOpen, ...trigger }: { skill: Skill; strength?: Today["skills"][number]; onOpen: () => void } & ComponentProps<"button">) {
  const lv = k?.level ?? 0;
  const p = levelProgress({ solid: k?.solid ?? 0, level: lv, next_level_at: k?.next_level_at ?? 5 });
  return (
    <button {...trigger} className="home-skill" data-color={s.color} onClick={onOpen}>
      <span className="home-skill-top">
        <span className={`mark${s.icon && s.color ? " tile" : ""}`} data-color={s.color} aria-hidden="true">
          <SkillIcon icon={s.icon} color={s.color} dot />
        </span>
        <span className="home-skill-name">{s.name}</span>
      </span>
      <Hint text={k ? gemHint(k, p.line) : p.line}>
        <span className="home-level">
          {k ? (
            <>
              <GemRing k={k} size={26} />
              <span className="home-solid"><Roll id={`solid:${s.id}`} value={k.solid} /></span>
              <NearGoal k={k} size={12} due />
            </>
          ) : (
            <>
              <span className="home-lv">Lv {lv}</span>
              <span className="home-meter" />
            </>
          )}
        </span>
      </Hint>
    </button>
  );
}

function subline(t: Today): string {
  if (!t.counts) return t.due ? "Today is off. Cards are ready if you feel like it." : "Today is off.";
  // Caught up short of the goal still counts (D60); say why, or a full ring beside "<1 of 10" reads as a bug.
  if (t.met && t.active_ms < t.goal_ms) return t.new_waiting ? `All caught up, so today counts. ${waiting(t)}` : "All caught up, so today counts.";
  if (t.met) return t.caught_up ? (t.new_waiting ? `Goal met. ${waiting(t)}` : "Goal met and all caught up.") : "Goal met. Anything more is a bonus.";
  if (t.due) return `About ${Math.max(1, minutes(t.slice_ms))} min of your most urgent cards`;
  return t.new_waiting ? `All caught up. ${waiting(t)}` : "All caught up. Read something new.";
}

/** New cards the daily limits held back (D65), so "caught up" never reads as "there's nothing left". */
export function waiting(t: Today): string {
  const n = t.new_waiting;
  const cards = `${n} new card${n === 1 ? "" : "s"}`;
  if (!t.new_per_day) return `${cards} wait. New cards are off in Settings.`;
  // New cards only take the goal time due cards leave (D65), so past a day's worth say that, not "up to 10 a day".
  return n <= t.new_per_day ? `${cards} start${n === 1 ? "s" : ""} tomorrow.` : `${cards} wait. A few start each day, as your goal leaves room.`;
}

function Week({ week }: { week: Today["week"] }) {
  const now = day();
  return (
    <div className="home-week" role="img" aria-label={`${week.filter((d) => d.status === "met").length} of ${week.filter((d) => d.status !== "off").length} days met this week`}>
      {week.map((d, i) => (
        <Hint key={d.date} text={`${new Date(`${d.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long" })} · ${d.status === "off" ? "off" : `${minutes(d.active_ms)} min`}`}>
          <span className={`home-day ${d.status}${d.date === now ? " today" : ""}${d.date > now ? " later" : ""}`}>
            <i />
            {DAYS[i]}
          </span>
        </Hint>
      ))}
    </div>
  );
}
