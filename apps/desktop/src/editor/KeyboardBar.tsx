import { NodeSelection, Selection } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { useEffect, useReducer, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Circle, DotsSix, Image, Keyboard, LinkSimple, Plus, Square, Table, TextT } from "../icons";
import { MoreButton, type MenuAction } from "../Menu";
import { BlockSelection, duplicate, moveBy, remove, selectBlocks, selectedBlock, type Block } from "./blockops";
import { canEdit, caretCell, editTable, sizeOf, type TableEdit } from "./tables";
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

/** A table's edits on the phone, where there are no grips to hover (TableControls on the Mac). */
const TABLE: [TableEdit, string][] = [
  ["row-above", "Insert row above"], ["row-below", "Insert row below"], ["row-up", "Move row up"], ["row-down", "Move row down"], ["row-delete", "Delete row"],
  ["col-left", "Insert column left"], ["col-right", "Insert column right"], ["col-move-left", "Move column left"], ["col-move-right", "Move column right"], ["col-delete", "Delete column"],
];

/** The iPhone's bar over the keyboard while he writes a note (Notion, Bear): + opens the / menu,
 *  then to-do, bullet, heading, [[ link, a picture, indent and outdent, and a key that puts the keyboard away.
 *  In a table, the table's edits take the place of the block kinds. A tap keeps the keyboard up (no blur), and
 *  acts as one editor step. Over selected text it is the format bar. Move (from ⋮⋮) picks the block up: the bar
 *  becomes ↑ ↓ Done, one step a tap (D227). */
export function KeyboardBar({ view, targets, onPicture }: { view: () => EditorView | undefined; targets: LinkTarget[]; onPicture: () => void }) {
  const [on, setOn] = useState(false);
  // The block menu takes focus from the note while open; the bar stays under it.
  const [menu, setMenu] = useState(false);
  const [moving, setMoving] = useState(false);
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
  // A tap into the text, or leaving the note, puts the block down: ↑ ↓ never carry another one.
  const carrying = moving && !!v && v.hasFocus() && v.state.selection instanceof BlockSelection;
  if (moving && !carrying) queueMicrotask(() => setMoving(false));
  if ((!on && !menu) || !v) return null;
  if (carrying) {
    const step = (dir: -1 | 1) => {
      const b = selectedBlock(v.state);
      const tr = b && moveBy(v.state, b, dir);
      if (tr) v.dispatch(tr);
      redraw();
    };
    const done = () => {
      setMoving(false);
      // The caret goes back into the block it moved, at its start, so he types on.
      const s = v.state.selection;
      v.dispatch(v.state.tr.setSelection(Selection.near(v.state.doc.resolve(s.from + 1))));
      v.focus();
    };
    const b = selectedBlock(v.state);
    return createPortal(
      <div className="kb-bar moving" role="toolbar" aria-label="Move block" onMouseDown={(e) => e.preventDefault()}>
        <button className="kb-btn" aria-label="Move up" disabled={!b || !moveBy(v.state, b, -1)} onMouseDown={(e) => e.preventDefault()} onClick={() => step(-1)}>
          <ArrowUp size={16} />
        </button>
        <button className="kb-btn" aria-label="Move down" disabled={!b || !moveBy(v.state, b, 1)} onMouseDown={(e) => e.preventDefault()} onClick={() => step(1)}>
          <ArrowDown size={16} />
        </button>
        <button className="kb-btn" aria-label="Done moving" onMouseDown={(e) => e.preventDefault()} onClick={done}>
          <Check size={16} />
        </button>
      </div>,
      document.body,
    );
  }
  // Selected text gets the Mac's format bar here instead, one tap per mark or colour (Notion's iOS app).
  const { from, to, empty } = v.state.selection;
  // A tapped diagram or picture (a NodeSelection) is no text to format; picked-up blocks get the block bar.
  if (!empty && !(v.state.selection instanceof BlockSelection) && !(v.state.selection instanceof NodeSelection))
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
      {
        id: "move",
        label: "Move",
        run: () => {
          // Picked up whole (the Mac's ⋮⋮ selection): typing can't change it, and ↑ ↓ carry it.
          const b = selectedBlock(v.state);
          const sel = b && selectBlocks(v.state.doc, b.from, b.from);
          if (sel) v.dispatch(v.state.tr.setSelection(sel).scrollIntoView());
          setMoving(true);
          v.focus();
        },
      },
      { id: "duplicate", label: "Duplicate", run: run((b) => duplicate(v.state, b)) },
      { id: "delete", label: "Delete", danger: true, divider: true, run: run((b) => remove(v.state, b)) },
    ];
  };
  const cell = caretCell(v.state);
  const tableActions = (): MenuAction[] => {
    const c = caretCell(v.state);
    if (!c) return [];
    const { rows, cols } = sizeOf(v.state, c.table);
    return TABLE.filter(([e]) => canEdit(rows, cols, c.row, c.col, e)).map(([e, label]) => ({
      id: e,
      label,
      danger: e.endsWith("delete"),
      divider: e === "col-left" || e.endsWith("delete"),
      run: () => {
        const now = caretCell(v.state);
        const tr = now && editTable(v.state, now.table, now.row, now.col, e);
        if (tr) v.dispatch(tr);
        v.focus();
      },
    }));
  };
  const active = (a: BarAction) => (a === "todo" && s.on === "todo") || (a === "bullet" && s.on === "bullet") || (a === "heading" && s.on === "h2");
  const tap = (a: BarAction) => {
    const tr = barAction(v.state, a);
    if (tr) v.dispatch(tr.scrollIntoView());
    redraw();
  };
  return createPortal(
    <div className="kb-bar" role="toolbar" aria-label="Note blocks" onMouseDown={(e) => e.preventDefault()}>
      {(cell ? BUTTONS.filter((b) => b.a === "link") : BUTTONS).map((b) => (
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
      {cell && (
        <MoreButton
          label="Table actions"
          className="kb-btn"
          icon={<Table size={16} aria-hidden="true" />}
          keepFocus
          actions={tableActions}
          open={menu}
          onOpenChange={(o) => {
            setMenu(o);
            if (!o) v.focus();
          }}
        />
      )}
      {/* iOS's own sheet: Photo Library, Take Photo or Choose File. */}
      <button className="kb-btn" aria-label="Add a picture" onMouseDown={(e) => e.preventDefault()} onClick={onPicture}>
        <Image size={16} />
      </button>
      {!cell && <MoreButton
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
      />}
      <button className="kb-btn" aria-label="Hide the keyboard" onMouseDown={(e) => e.preventDefault()} onClick={() => (v.dom as HTMLElement).blur()}>
        <Keyboard size={16} />
      </button>
    </div>,
    document.body,
  );
}
