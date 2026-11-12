import { Check } from "./icons";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { SkillIcon } from "./IconPicker";
import { is } from "./keys";
import { Trap } from "./Trap";
import { PHONE, type Skill, type Today } from "./ore";
import { sheetLayer, useSwipeDown } from "./phone/sheet";
import { load, save } from "./util";
import { NO_SKILL } from "../../../packages/core/src/no-skill";

const PICK = "ore.review-pick";
const day = () => new Date().toLocaleDateString("sv-SE");

/** The skills he picked to review today, or null for all (D58, D80). A new day starts with all. */
export function loadPick(): string[] | null {
  try {
    const v = JSON.parse(load(PICK) ?? "null");
    return v && v.day === day() && Array.isArray(v.skills) ? v.skills : null;
  } catch {
    return null;
  }
}
const savePick = (skills: string[] | null) => save(PICK, JSON.stringify({ day: day(), skills }));

/** Today's numbers as Home last read them, so ⌘R from anywhere opens the picker at once. */
let seen: Today | null = null;
export const rememberToday = (t: Today) => void (seen = t);
export const lastToday = () => seen;

/** Skills with cards due, Focus first, then most due first: the ones a session would help most. Last, "No skill"
 *  for the exercises filed under none, so every row ticked is the whole session and unticking it is his call (D80, D204). */
export const dueSkills = (today: Today, skills: Skill[]) => [
  ...today.skills
    .filter((x) => x.due > 0)
    .flatMap((x) => skills.filter((s) => s.id === x.skill && !s.archived).map((s) => ({ skill: s, due: x.due })))
    // Focus first, then Normal, then Light (D173), most due first within each.
    .sort((a, b) => (a.skill.priority ?? "P2").localeCompare(b.skill.priority ?? "P2") || b.due - a.due),
  ...(today.no_skill_due > 0 ? [{ skill: { id: NO_SKILL, name: "No skill", color: "gray" } as Skill, due: today.no_skill_due }] : []),
];

/** Whether the skill list names every skill with cards due. Today's numbers can land before the
 *  skills do; until then there is no telling whether to ask what to review. */
export const knowsDue = (today: Today, skills: Skill[]) => today.skills.every((x) => !x.due || skills.some((s) => s.id === x.skill));

/** What to review this session (D80), opened by Start review, ↵ on Home and ⌘R. Preselected with his
 *  pick from earlier today, else every skill with cards due; ↵ (or ⌘R again) starts at once, so the
 *  common case costs one extra key. Rows toggle on one click or Space, Duolingo's raised checkbox. */
export function ReviewPick({ today, skills, onStart, onClose }: {
  today: Today;
  skills: Skill[];
  onStart: (pick: string[] | null) => void;
  onClose: () => void;
}) {
  const rows = dueSkills(today, skills);
  const [on, setOn] = useState<Set<string>>(() => {
    const prev = loadPick()?.filter((id) => rows.some((r) => r.skill.id === id));
    return new Set(prev?.length ? prev : rows.map((r) => r.skill.id));
  });
  const box = useRef<HTMLDivElement>(null);
  const back = useRef(document.activeElement as HTMLElement | null);
  useSwipeDown(box, onClose, PHONE);
  useEffect(() => {
    // The first row takes focus (a Mac sheet's first control), so Space ticks and ↓ moves at once; the panel only when there is none.
    (box.current?.querySelector<HTMLElement>(".pick-row") ?? box.current)?.focus();
    const to = back.current;
    return () => to?.focus?.();
  }, []);

  const toggle = (id: string) =>
    setOn((cur) => {
      const next = new Set(cur);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  // Fresh numbers can drop a ticked row: its tick goes, so it comes back unticked if it returns.
  const shown = rows.map((r) => r.skill.id).join(",");
  useEffect(() => {
    const ids = shown.split(",");
    setOn((cur) => ([...cur].every((id) => ids.includes(id)) ? cur : new Set([...cur].filter((id) => ids.includes(id)))));
  }, [shown]);
  const picked = rows.map((r) => r.skill.id).filter((id) => on.has(id));
  const start = () => {
    if (!picked.length) return;
    const pick = picked.length === rows.length ? null : picked;
    savePick(pick);
    onStart(pick);
  };

  const onKey = (e: KeyboardEvent) => {
    const list = [...(box.current?.querySelectorAll<HTMLElement>(".pick-row") ?? [])];
    const at = list.indexOf(e.target as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if ((e.key === "Enter" && !e.metaKey && !e.altKey && !e.shiftKey && !e.ctrlKey) || is(e.nativeEvent, "review")) {
      e.preventDefault();
      e.stopPropagation(); // the app's own ⌘R and Home's ↵ must not start a second review
      if (!e.repeat) start(); // a held ↵ starts once, and never toggles the focused row
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const down = e.key === "ArrowDown";
      list[at < 0 ? (down ? 0 : list.length - 1) : Math.max(0, Math.min(list.length - 1, at + (down ? 1 : -1)))]?.focus();
    }
  };

  return sheetLayer(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <Trap>
      <div ref={box} className="panel review-pick" role="dialog" aria-modal="true" aria-label="What to review" tabIndex={-1} onKeyDown={onKey}>
        <h2>What to review</h2>
        <div className="pick-list">
          {rows.map(({ skill: s, due }) => (
            <button key={s.id} className="pick-row" role="checkbox" aria-checked={on.has(s.id)} onClick={() => toggle(s.id)}>
              <span className="pick-box" aria-hidden="true">
                {on.has(s.id) && <Check size={14} weight="bold" />}
              </span>
              <span className="pick-icon">
                <SkillIcon icon={s.icon} color={s.color} dot />
              </span>
              <span className="name">{s.name}</span>
              <span className="due">{due} {due === 1 ? "exercise" : "exercises"} ready</span>
            </button>
          ))}
        </div>
        <div className="review-pick-foot">
          <button className="pill-btn home-go" data-color="green" disabled={!picked.length} onClick={start}>
            {picked.length ? "Start review" : "Pick a skill"}
            {picked.length > 0 && <kbd>↵</kbd>}
          </button>
        </div>
      </div>
      </Trap>
    </div>
  );
}
