import { CaretRight, Plus } from "./icons";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { Hint } from "./Hint";
import { MoreButton, WithMenu, type MenuAction } from "./Menu";
import { still } from "./SideCursor";
import { PixelKeep, PixelQuestion, PixelStar, PixelTry } from "./PixelIcon";
import { INTENTS, PHONE, type Annotation, type Intent } from "./ore";
import { passageText } from "./text";
import { load, save } from "./util";

// D118: one highlight; a key point (`card` in the files) is a highlight he marked to come back, and the AI
// plans the cards from all of them: the day after a sitting while he is still reading (D180), and at the finish.
export const LABEL: Record<Intent, string> = { keep: "Highlight", card: "Key point", question: "Question", apply: "Try it" };
export const ICON: Record<Intent, typeof PixelKeep> = { keep: PixelKeep, card: PixelStar, question: PixelQuestion, apply: PixelTry };
/** What each mark means, said on hover where he picks it. */
export const MEANS: Record<Intent, string> = {
  keep: "Cards are planned from your highlights the next day",
  card: "Make sure this comes back in review",
  question: "Something to find out",
  apply: "A technique to try on your own work, then check off",
};
/** Highlights that are a generative step pop on their own (D65); any type pops when he writes a note on it. */
const CELEBRATE: Intent[] = ["card", "question", "apply"];
const PLURAL: Record<Intent, string> = { keep: "Highlights", card: "Key points", question: "Questions", apply: "To try" };

type Props = {
  anns: Annotation[];
  /** False until the saved highlights have loaded, so opening a source never pops. */
  ready: boolean;
  /** Where a highlight sits on screen, for the fly-in. */
  rectOf: (id: string) => DOMRect | undefined;
  /** A chip: the Collected tab of the side panel, at that type's group. */
  onOpen: (intent: Intent) => void;
  /** How much of it fits in the toolbar: a chip per type, one chip for all (as on the phone), or none. */
  fit?: Fit;
};
export type Fit = "all" | "one" | "none";


/** D64: what he has collected in this source, at the bottom center of the reader. Each new
 *  highlight flies into its type's chip, which pops; a click opens the Collected tab. */
export function Collected({ anns, ready, rectOf, onOpen, fit = "all" }: Props) {
  const [pop, setPop] = useState<{ intent: Intent; n: number } | null>(null);
  const chips = useRef(new Map<Intent, HTMLElement>());
  const prev = useRef<Map<string, { intent: Intent; noted: boolean }> | null>(null);
  const fly = useRef<{ intent: Intent; from: DOMRect } | null>(null);

  const counts = useMemo(() => {
    const c: Record<Intent, number> = { keep: 0, card: 0, question: 0, apply: 0 };
    for (const a of anns) c[a.intent]++;
    return c;
  }, [anns]);

  // Thinking pops, clicking doesn't (D65): a new Card or Question, a highlight changed to one, or a
  // note written on any highlight flies into its type's chip. A plain Keep is listed quietly. A
  // pending id swapped for the saved one changes no count, so it pops only once.
  useEffect(() => {
    if (!ready) return;
    const now = new Map(anns.map((a) => [a.id, { intent: a.intent, noted: !!a.note?.trim() }]));
    const before = prev.current;
    prev.current = now;
    if (!before) return;
    const count = (m: typeof now, i: Intent, noted = false) => [...m.values()].filter((v) => v.intent === i && (!noted || v.noted)).length;
    const grew = INTENTS.find((i) => (CELEBRATE.includes(i) && count(now, i) > count(before, i)) || count(now, i, true) > count(before, i, true));
    if (!grew) return;
    const id = anns.find((a) => a.intent === grew && (before.get(a.id)?.intent !== grew || (!!a.note?.trim() && !before.get(a.id)?.noted)))?.id;
    const from = id ? rectOf(id) : undefined;
    if (from && !still()) fly.current = { intent: grew, from };
    setPop((p) => ({ intent: grew, n: (p?.n ?? 0) + 1 }));
  }, [anns, ready]);
  useEffect(() => {
    if (!pop) return;
    const t = setTimeout(() => setPop(null), 1400);
    return () => clearTimeout(t);
  }, [pop]);

  // Fly a dot of the type's colour from the passage into its chip (after render: a first
  // highlight of a type adds the chip).
  useLayoutEffect(() => {
    const f = fly.current;
    const chip = f && chips.current.get(f.intent);
    fly.current = null;
    if (!f || !chip) return;
    const to = chip.getBoundingClientRect();
    const dot = document.createElement("div");
    dot.className = `collect-fly ${f.intent}`;
    document.body.append(dot);
    const x0 = f.from.left + f.from.width / 2, y0 = f.from.top + f.from.height / 2;
    const x1 = to.left + 16, y1 = to.top + to.height / 2;
    dot.animate(
      [
        { transform: `translate(${x0}px, ${y0}px) scale(1)`, opacity: 1 },
        { transform: `translate(${(x0 + x1) / 2}px, ${Math.min(y0, y1) - 60}px) scale(1.2)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${x1}px, ${y1}px) scale(0.5)`, opacity: 0.9 },
      ],
      { duration: 520, easing: "cubic-bezier(.5,0,.3,1)" },
    ).finished.finally(() => dot.remove());
  }, [pop]);

  const total = anns.length;
  if (!total || fit === "none") return null;
  const shown = INTENTS.filter((i) => counts[i] > 0);

  // The iPhone's top bar has room for one count beside Back (Tyler, 2026-11-06): every type's dot flies
  // into it. So does a Mac toolbar too narrow for a chip per type.
  if (PHONE || fit === "one")
    return (
      <div className="collected" role="group" aria-label="Collected in this source">
        <button
          key={pop ? `all-${pop.n}` : "all"}
          ref={(el) => INTENTS.forEach((i) => void (el ? chips.current.set(i, el) : chips.current.delete(i)))}
          className={`collected-chip all${pop ? " pop" : ""}`}
          aria-label={`${total} collected`}
          onClick={() => onOpen(shown[0]!)}
        >
          {pop && <span className="plus" aria-hidden="true">+1</span>}
          Collected {total}
        </button>
      </div>
    );

  return (
    <div className="collected" role="group" aria-label="Collected in this source">
      {shown.map((i) => {
        const Glyph = ICON[i];
        const popping = pop?.intent === i;
        return (
          <Hint key={i} text={`${counts[i]} ${PLURAL[i].toLowerCase()} collected here`} keys="collected" side="top">
            <button
              key={popping ? `${i}-${pop.n}` : i}
              ref={(el) => void (el ? chips.current.set(i, el) : chips.current.delete(i))}
              className={`collected-chip ${i}${popping ? " pop" : ""}`}
              aria-label={`${counts[i]} ${PLURAL[i]}`}
              onClick={() => onOpen(i)}
            >
              {popping && <span className="plus" aria-hidden="true">+1</span>}
              <Glyph size={15} weight="fill" aria-hidden="true" />
              {counts[i]}
            </button>
          </Hint>
        );
      })}
    </div>
  );
}

/** The side panel's Collected tab (Tyler, 2026-10-29): his cards, then his questions, then his keeps, each
 *  a collapsible group in reading order. A row opens its passage; + on Cards adds one where he is ("Card
 *  here"): a line he types, drafted from the whole source. */
export function CollectedPanel({ anns, timeOf, adding, onAdding, onEdit, addAsk, takeAddFocus, onAdd, onJump, onAsk, questions, actions }: {
  anns: Annotation[];
  /** A video source: the time each highlight is spoken, for the row's right edge. */
  timeOf?: (a: Annotation) => string | null;
  /** The key point field (a line of his own, here) is open, with what he had typed (kept when a save fails). */
  adding: string | null;
  onAdding: (on: boolean) => void;
  /** Each edit of the key point field: kept by the Reader, so closing the group or the tab keeps it. */
  onEdit: (line: string) => void;
  /** Bumps when he asks for the field; `takeAddFocus` says (once) whether it should take focus. */
  addAsk: number;
  takeAddFocus: () => boolean;
  onAdd: (line: string) => void;
  onJump: (id: string) => void;
  onAsk: () => void;
  /** The Questions group's own list (answering, matches: D75). */
  questions: ReactNode;
  /** A row's ⋯ and right-click menu: the popup's actions, without opening the passage. */
  actions?: (a: Annotation) => MenuAction[];
}) {
  // A row's passage as the page shows it, worked out once per passage, not on every render.
  const shownText = useRef(new Map<string, string>());
  const passage = (exact: string) => {
    let t = shownText.current.get(exact);
    if (t === undefined) shownText.current.set(exact, (t = passageText(exact)));
    return t;
  };
  const [shut, setShut] = useState<Set<string>>(() => new Set((load("ore.collected.shut") ?? "keep").split(",").filter(Boolean)));
  const toggle = (g: string) =>
    setShut((cur) => {
      const next = new Set(cur);
      if (!next.delete(g)) next.add(g);
      save("ore.collected.shut", [...next].join(","));
      return next;
    });
  const sorted = [...anns].sort((a, b) => (a.anchor?.start ?? a.start) - (b.anchor?.start ?? b.start));
  const of = (i: Intent) => sorted.filter((a) => a.intent === i);
  const cards = of("card");
  const keeps = of("keep");
  const tries = of("apply");

  const box = useRef<HTMLDivElement>(null);
  // The key point field is gone (Enter or Esc): focus goes back to the + that opens it, never to the page body.
  const addDone = (line: string) => {
    onAdding(false);
    if (line) onAdd(line);
    requestAnimationFrame(() => !box.current?.querySelector(".cp-input") && box.current?.querySelector<HTMLElement>(".cp-head.card .icon-btn")?.focus());
  };

  // ↑ ↓ move between rows, as in any list here; Enter or a click opens one.
  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const box = e.currentTarget as HTMLElement;
    const rows = [...box.querySelectorAll<HTMLButtonElement>(".cp-row:not(.cp-add), .qp-row")];
    const at = rows.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0 && document.activeElement?.tagName === "INPUT") return;
    const next = rows[Math.max(0, Math.min(rows.length - 1, at + (e.key === "ArrowDown" ? 1 : -1)))];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };

  const head = (g: string, label: string, Glyph: typeof PixelKeep, extra?: ReactNode) => (
    <h3 className={`cp-head ${g}`}>
      <button className="cp-toggle" aria-expanded={!shut.has(g)} onClick={() => toggle(g)}>
        <CaretRight className="cp-caret" size={10} weight="bold" aria-hidden="true" />
        <Glyph size={13} weight="fill" aria-hidden="true" />
        {label}
      </button>
      {extra}
    </h3>
  );
  const row = (a: Annotation) => {
    const t = timeOf?.(a);
    return (
      <WithMenu key={a.id} actions={actions && !PHONE ? () => actions(a) : []}>
        <div className="cp-line">
          <button className={`cp-row${a.point ? " point" : ""}`} onClick={() => onJump(a.id)}>
            <span className="cp-text">{a.point || (a.note && a.intent !== "keep") ? a.note : passage(a.exact)}</span>
            {t && <span className="cp-time">{t}</span>}
          </button>
          {actions && !PHONE && <MoreButton label="Highlight actions" actions={() => actions(a)} />}
        </div>
      </WithMenu>
    );
  };

  return (
    <div className="cp" ref={box} onKeyDown={onKey}>
      <section>
        {head(
          "card",
          "Key points",
          PixelStar,
          <Hint text="A key point of your own, from this spot" keys="card" side="left">
            <button className="icon-btn" aria-label="Add a key point" onClick={() => (shut.has("card") && toggle("card"), onAdding(true))}>
              <Plus size={12} weight="bold" aria-hidden="true" />
            </button>
          </Hint>,
        )}
        {!shut.has("card") && (
          <>
            {adding !== null && <AddLine value={adding} ask={addAsk} takeFocus={takeAddFocus} onChange={onEdit} onDone={addDone} />}
            {cards.map(row)}
            {!cards.length && adding === null && (
              <button className="cp-empty" onClick={() => onAdding(true)}>
                Add a key point…
              </button>
            )}
          </>
        )}
      </section>
      <section>
        {head(
          "question",
          "Questions",
          PixelQuestion,
          <Hint text="Ask a question" side="left">
            <button className="icon-btn" aria-label="Ask a question" onClick={() => (shut.has("question") && toggle("question"), onAsk())}>
              <Plus size={12} weight="bold" aria-hidden="true" />
            </button>
          </Hint>,
        )}
        {!shut.has("question") && questions}
      </section>
      {tries.length > 0 && (
        <section>
          {head("apply", "To try", PixelTry)}
          {!shut.has("apply") && tries.map(row)}
        </section>
      )}
      {keeps.length > 0 && (
        <section>
          {head("keep", "Highlights", PixelKeep, shut.has("keep") ? <span className="cp-count">{keeps.length}</span> : null)}
          {!shut.has("keep") && keeps.map(row)}
        </section>
      )}
    </div>
  );
}

/** Linear's inline create: the field is focused, Enter commits, Esc drops it; a blur keeps the field and what he typed. */
function AddLine({ value: v, ask, takeFocus, onChange, onDone }: { value: string; ask: number; takeFocus: () => boolean; onChange: (line: string) => void; onDone: (line: string) => void }) {
  const done = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => void (takeFocus() && input.current?.focus()), [ask]);
  const finish = (line: string) => {
    if (done.current) return;
    done.current = true;
    onDone(line.trim());
    // The field can stay (a key point with no place to go keeps it open): the next Enter or Esc counts.
    setTimeout(() => (done.current = false), 0);
  };
  return (
    <div className="cp-row cp-add">
      <input
        ref={input}
        className="cp-input"
        value={v}
        placeholder="What to remember…"
        aria-label="Key point"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            finish(v);
          } else if (e.key === "Escape") {
            e.preventDefault();
            finish("");
          }
        }}
      />
    </div>
  );
}
