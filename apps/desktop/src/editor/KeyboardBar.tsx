import type { EditorView } from "@milkdown/kit/prose/view";
import { useEffect, useReducer, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Circle, Keyboard, LinkSimple, Plus, Square, TextT } from "../icons";
import { barAction, barState, type BarAction } from "./kbbar";

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
 *  A tap keeps the keyboard up (no blur), and acts as one editor step. */
export function KeyboardBar({ view }: { view: () => EditorView | undefined }) {
  const [on, setOn] = useState(false);
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const check = () => {
      const v = view();
      setOn(!!v && v.hasFocus());
      redraw();
    };
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
  if (!on || !v) return null;
  const s = barState(v.state);
  const active = (a: BarAction) => (a === "todo" && s.on === "todo") || (a === "bullet" && s.on === "bullet") || (a === "heading" && s.on === "h2");
  const tap = (a: BarAction) => {
    const tr = barAction(v.state, a);
    if (tr) v.dispatch(tr.scrollIntoView());
    redraw();
  };
  return createPortal(
    <div className="kb-bar" role="toolbar" aria-label="Note blocks" onPointerDown={(e) => e.preventDefault()}>
      {BUTTONS.map((b) => (
        <button
          key={b.a}
          className={`kb-btn${active(b.a) ? " on" : ""}`}
          aria-label={b.label}
          aria-pressed={b.a === "todo" || b.a === "bullet" || b.a === "heading" ? active(b.a) : undefined}
          disabled={(b.a === "indent" || b.a === "outdent") && !s.inList}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => tap(b.a)}
        >
          {b.icon}
        </button>
      ))}
      <button className="kb-btn" aria-label="Hide the keyboard" onPointerDown={(e) => e.preventDefault()} onClick={() => (v.dom as HTMLElement).blur()}>
        <Keyboard size={16} />
      </button>
    </div>,
    document.body,
  );
}
