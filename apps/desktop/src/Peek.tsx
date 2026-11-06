import * as Popover from "@radix-ui/react-popover";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadSkills, ore, opt, type Doc, type Notes, type Skill } from "./ore";
import { SkillChip } from "./Skills";

type Target = { kind: "item" | "skill"; id: string };
type Preview = { title: string; skills: Skill[]; lines: string };

const OPEN_MS = 500;
const GRACE_MS = 250;

/** The first few lines of a note or source as plain text: Markdown marks and images dropped, and a
 *  first line that only repeats `title`. */
export function firstLines(md: string, max = 280, title?: string): string {
  const text = md
    .replace(/^---\n[\s\S]*?\n---\n/, "")
    .split("\n")
    .map((l) => l.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[\[?([^\]]+)\]?\]\([^)]*\)/g, "$1").replace(/^\s*(#+|>|[-*+]|\d+\.)\s+/, "").replace(/[*_`~]/g, "").trim())
    .filter(Boolean)
    // A source's text usually opens with its own title, which the card already shows.
    .filter((l, i) => !(i === 0 && l === title?.trim()))
    .join(" ");
  return text.length > max ? `${text.slice(0, max).replace(/\s+\S*$/, "")}…` : text;
}

async function preview(t: Target): Promise<Preview> {
  if (t.kind === "skill") {
    const [skills, notes] = await Promise.all([loadSkills(), ore<Notes>("notes", opt("skill", t.id))]);
    const skill = skills.find((s) => s.id === t.id);
    return { title: skill ? `${skill.name} notes` : "Skill notes", skills: [], lines: firstLines(notes.text) };
  }
  const [skills, doc] = await Promise.all([loadSkills(), ore<Doc>("show", t.id)]);
  return { title: doc.title, skills: skills.filter((s) => doc.skills.includes(s.id)), lines: firstLines(doc.body, undefined, doc.title) };
}

/** Hover a link to peek at what it points to (Notion, Arc Peek): opens after half a second, stays
 *  while the pointer moves onto it, closes a moment after it leaves, and one click on it opens the
 *  target. `hover` is called with the link element as the pointer enters it, `leave` as it leaves. */
export function usePeek(onOpen: (t: Target) => void) {
  const [shown, setShown] = useState<{ target: Target; data: Preview | null; error?: boolean } | null>(null);
  const anchor = useRef<HTMLElement | null>(null);
  const virtual = useRef({ getBoundingClientRect: () => anchor.current?.getBoundingClientRect() ?? new DOMRect() });
  const timer = useRef(0);
  const pending = useRef<string | null>(null);

  const close = useCallback(() => {
    clearTimeout(timer.current);
    pending.current = null;
    setShown(null);
  }, []);
  const hover = useCallback((el: HTMLElement, target: Target) => {
    clearTimeout(timer.current);
    const key = `${target.kind}/${target.id}`;
    if (pending.current === key && anchor.current === el) return;
    pending.current = key;
    anchor.current = el;
    // Fetch while the half second runs, so the card opens filled; a failure is caught here even when
    // the pointer leaves before the card opens.
    const data = preview(target).catch(() => null);
    timer.current = window.setTimeout(() => {
      setShown({ target, data: null });
      void data.then((d) => pending.current === key && setShown(d ? { target, data: d } : { target, data: null, error: true }));
    }, OPEN_MS);
  }, []);
  const leave = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = window.setTimeout(close, GRACE_MS);
  }, [close]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const view = (
    <Popover.Root open={!!shown} onOpenChange={(o) => !o && close()}>
      <Popover.Anchor virtualRef={virtual} />
      <Popover.Portal>
        {shown && (
          <Popover.Content
            className="popover peek"
            side="bottom"
            align="start"
            sideOffset={6}
            collisionPadding={12}
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
            // Esc closes the peek only, not the page under it.
            onEscapeKeyDown={(e) => e.stopPropagation()}
            onPointerEnter={() => clearTimeout(timer.current)}
            onPointerLeave={leave}
          >
            <button
              className="peek-card"
              onClick={() => {
                close();
                onOpen(shown.target);
              }}
            >
              <span className="peek-title">{shown.data?.title ?? anchor.current?.textContent ?? ""}</span>
              {!!shown.data?.skills.length && (
                <span className="chips">
                  {shown.data.skills.map((s) => (
                    <SkillChip key={s.id} skill={s} />
                  ))}
                </span>
              )}
              <span className="peek-lines">
                {shown.error ? "Couldn’t load this; it may have been deleted." : shown.data ? shown.data.lines || "Nothing written yet." : "…"}
              </span>
            </button>
          </Popover.Content>
        )}
      </Popover.Portal>
    </Popover.Root>
  );
  return { hover, leave, close, view };
}
