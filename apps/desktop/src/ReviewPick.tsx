import { Check } from "./icons";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { SkillIcon } from "./IconPicker";
import { is } from "./keys";
import { PHONE, type Skill, type Today } from "./ore";
import { useSwipeDown } from "./phone/sheet";
import { load, save } from "./util";

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

/** Skills with cards due, most due first: the ones a session would help most. */
export const dueSkills = (today: Today, skills: Skill[]) =>
  today.skills
    .filter((x) => x.due > 0)
    .sort((a, b) => b.due - a.due)
    .flatMap((x) => skills.filter((s) => s.id === x.skill).map((s) => ({ skill: s, due: x.due })));

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
    box.current?.focus();
    const to = back.current;
    return () => to?.focus?.();
  }, []);

  const toggle = (id: string) =>
    setOn((cur) => {
      const next = new Set(cur);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const start = () => {
    if (!on.size) return;
    const pick = on.size === rows.length ? null : rows.map((r) => r.skill.id).filter((id) => on.has(id));
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
      start();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const down = e.key === "ArrowDown";
      list[at < 0 ? (down ? 0 : list.length - 1) : Math.max(0, Math.min(list.length - 1, at + (down ? 1 : -1)))]?.focus();
    }
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
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
              <span className="due">{due} {due === 1 ? "card" : "cards"} ready</span>
            </button>
          ))}
        </div>
        <div className="review-pick-foot">
          <button className="pill-btn home-go" data-color="green" disabled={!on.size} onClick={start}>
            {on.size ? "Start review" : "Pick a skill"}
            {on.size > 0 && <kbd>↵</kbd>}
          </button>
        </div>
      </div>
    </div>
  );
}
