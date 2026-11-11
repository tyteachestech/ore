import type { EditorView } from "@milkdown/kit/prose/view";
import { useEffect, useReducer, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Circle, DotsSix, Keyboard, LinkSimple, Plus, Square, TextT } from "../icons";
import { MoreButton, type MenuAction } from "../Menu";
import { BlockSelection, duplicate, moveBy, remove, selectedBlock, type Block } from "./blockops";
import { barAction, barState, type BarAction } from "./kbbar";
import type { LinkTarget } from "./NoteEditor";
import { SelectionBar } from "./SelectionBar";

const BUTTONS: { a: BarAction; label: string; icon: ReactNode }[] = [
  { a: "block", label: "Add a block", icon: <Plus size={16} weight="bold" /> },
  { a: "todo", label: "To-do", icon: <Square size={16} /> },
  { a: "bullet", label: "Bulleted list", icon: <Circle size={12} /> },
  { a: "heading", label: "Heading", icon: <TextT size={16} /> },
  { a: "link", label: "Link to a source or skill", icon: <LinkSimple size={16} /> },
  { a: "indent", label: "Indent", icon: <ArrowRight size={16} /> },
  { a: "outdent", label: "Outdent", icon: <ArrowLeft size={16} /> },
];

/** The iPhone's bar over the keyboard while he writes a note (Notion, Bear): + opens the / menu,
 *  then to-do, bullet, heading, [[ link, indent and outdent, and a key that puts the keyboard away.
 *  A tap keeps the keyboard up (no blur), and acts as one editor step. Over selected text it is the
 *  format bar. */
export function KeyboardBar({ view, targets }: { view: () => EditorView | undefined; targets: LinkTarget[] }) {
  const [on, setOn] = useState(false);
  // The block menu takes focus from the note while open; the bar stays under it.
  const [menu, setMenu] = useState(false);
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    // After the editor has read the change: its own selectionchange handler may run after this one.
    const check = () =>
      setTimeout(() => {
        const v = view();
        setOn(!!v && v.hasFocus());
        redraw();
      });
    document.addEventListener("focusin", check);
    document.addEventListener("focusout", check);
    document.addEventListener("selectionchange", check);
    return () => {
      document.removeEventListener("focusin", check);
      document.removeEventListener("focusout", check);
      document.removeEventListener("selectionchange", check);
    };
  }, [view]);
  const v = view();
  if ((!on && !menu) || !v) return null;
  // Selected text gets the Mac's format bar here instead, one tap per mark or colour (Notion's iOS app).
  const { from, to, empty } = v.state.selection;
  if (!empty && !(v.state.selection instanceof BlockSelection))
    return createPortal(
      <div className="kb-bar" onMouseDown={(e) => e.preventDefault()}>
        <SelectionBar key={`${from}-${to}`} view={view} sel={{ from, to, x: 0, y: 0 }} targets={targets} onDone={redraw} docked />
      </div>,
      document.body,
    );
  const s = barState(v.state);
  // The ⋮⋮ menu of the Mac, for the caret's block: a finger can't drag inside text iOS selects on a long-press.
  const blockActions = (): MenuAction[] => {
    const run = (make: (b: Block) => import("@milkdown/kit/prose/state").Transaction | null) => () => {
      const b = selectedBlock(v.state);
      const tr = b && make(b);
      if (tr) v.dispatch(tr.scrollIntoView());
      v.focus();
    };
    return [
      { id: "up", label: "Move up", run: run((b) => moveBy(v.state, b, -1)) },
      { id: "down", label: "Move down", run: run((b) => moveBy(v.state, b, 1)) },
      { id: "duplicate", label: "Duplicate", run: run((b) => duplicate(v.state, b)) },
      { id: "delete", label: "Delete", danger: true, divider: true, run: run((b) => remove(v.state, b)) },
    ];
  };
  const active = (a: BarAction) => (a === "todo" && s.on === "todo") || (a === "bullet" && s.on === "bullet") || (a === "heading" && s.on === "h2");
  const tap = (a: BarAction) => {
    const tr = barAction(v.state, a);
    if (tr) v.dispatch(tr.scrollIntoView());
    redraw();
  };
  return createPortal(
    <div className="kb-bar" role="toolbar" aria-label="Note blocks" onMouseDown={(e) => e.preventDefault()}>
      {BUTTONS.map((b) => (
        <button
          key={b.a}
          className={`kb-btn${active(b.a) ? " on" : ""}`}
          aria-label={b.label}
          aria-pressed={b.a === "todo" || b.a === "bullet" || b.a === "heading" ? active(b.a) : undefined}
          disabled={(b.a === "indent" || b.a === "outdent") && !s.inList}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => tap(b.a)}
        >
          {b.icon}
        </button>
      ))}
      <MoreButton
        label="Block actions"
        className="kb-btn"
        icon={<DotsSix size={16} aria-hidden="true" />}
        keepFocus
        actions={blockActions}
        open={menu}
        onOpenChange={(o) => {
          setMenu(o);
          if (!o) v.focus();
        }}
      />
      <button className="kb-btn" aria-label="Hide the keyboard" onMouseDown={(e) => e.preventDefault()} onClick={() => (v.dom as HTMLElement).blur()}>
        <Keyboard size={16} />
      </button>
    </div>,
    document.body,
  );
}
