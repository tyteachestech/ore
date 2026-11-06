import type { EditorView } from "@milkdown/kit/prose/view";
import { useEffect, useRef, useState, type RefObject } from "react";
import { Hint } from "../Hint";
import { DotsSix, Plus } from "../icons";
import { MoreButton, WithMenu, type MenuAction } from "../Menu";
import { canEdit, editTable, sizeOf, type TableEdit } from "./tables";

/** The table under the pointer, the cell it is on, and where the controls sit (in the note's box). */
type At = {
  table: number;
  row: number;
  col: number;
  rows: number;
  cols: number;
  rowGrip: { x: number; y: number } | null;
  colGrip: { x: number; y: number } | null;
  addRow: { x: number; y: number; w: number };
  addCol: { x: number; y: number; h: number } | null;
};

/** Notion's table controls, on the table under the pointer: a grip on the row's left edge and one on
 *  the column's top edge open their menus (insert, move, delete), and the + under and right of the
 *  table add a row or a column at the end. Each is one editor step, so ⌘Z takes it back. The header
 *  row has no grip: it stays on top. Not on the phone: no pointer to hover. */
export function TableControls({ view, host }: { view: () => EditorView | undefined; host: RefObject<HTMLElement | null> }) {
  const [at, setAt] = useState<At | null>(null);
  const [open, setOpen] = useState<"row" | "col" | null>(null);
  const busy = useRef(false);
  busy.current = open !== null;
  const viewNow = useRef(view);
  viewNow.current = view;
  const now = useRef(at);
  now.current = at;

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const move = (e: MouseEvent) => {
      const v = viewNow.current();
      const t = e.target as HTMLElement;
      if (!v || busy.current || t.closest?.(".table-ctl")) return;
      const cell = t.closest?.("td, th") as HTMLTableCellElement | null;
      if (cell && v.dom.contains(cell)) return setAt(spot(v, el, cell));
      // The room around the table, where its + sit, keeps the controls.
      if (!t.closest?.(".note-table")) setAt(null);
    };
    const leave = () => !busy.current && setAt(null);
    // Scrolling the table sideways moves its cells under the controls.
    const scroll = () => {
      const v = viewNow.current();
      const a = now.current;
      if (v && a && !busy.current) setAt(again(v, el, a));
    };
    el.addEventListener("mousemove", move);
    el.addEventListener("mouseleave", leave);
    el.addEventListener("scroll", scroll, true);
    return () => {
      el.removeEventListener("mousemove", move);
      el.removeEventListener("mouseleave", leave);
      el.removeEventListener("scroll", scroll, true);
    };
  }, [host]);

  if (!at) return null;
  const run = (edit: TableEdit, row = at.row, col = at.col) => () => {
    const v = view();
    const el = host.current;
    const tr = v && editTable(v.state, at.table, row, col, edit);
    if (!v || !el || !tr) return;
    v.dispatch(tr);
    v.focus();
    // The controls stay on the table, so the + adds a run of rows (Notion).
    requestAnimationFrame(() => setAt(again(v, el, at)));
  };
  const can = (edit: TableEdit) => canEdit(at.rows, at.cols, at.row, at.col, edit);
  const actions = (list: [TableEdit, string][]): MenuAction[] =>
    list.filter(([e]) => can(e)).map(([e, label]) => ({ id: e, label, run: run(e), danger: e.endsWith("delete"), divider: e.endsWith("delete") }));
  const rowActions = () => actions([["row-above", "Insert above"], ["row-below", "Insert below"], ["row-up", "Move up"], ["row-down", "Move down"], ["row-delete", "Delete row"]]);
  const colActions = () => actions([["col-left", "Insert left"], ["col-right", "Insert right"], ["col-move-left", "Move left"], ["col-move-right", "Move right"], ["col-delete", "Delete column"]]);
  const grip = (kind: "row" | "col", p: { x: number; y: number }, list: () => MenuAction[]) => (
    <div className={`table-ctl table-grip-at ${kind}s`} style={{ left: p.x, top: p.y }}>
      <WithMenu actions={list} keepFocus>
        <MoreButton
          label={kind === "row" ? "Row actions" : "Column actions"}
          className={`table-grip ${kind}s${open === kind ? " on" : ""}`}
          icon={<DotsSix size={14} aria-hidden="true" />}
          hint={kind === "row" ? "Row: insert, move, delete" : "Column: insert, move, delete"}
          align="start"
          keepFocus
          actions={list}
          open={open === kind}
          onOpenChange={(o) => {
            setOpen(o ? kind : null);
            if (!o) view()?.focus();
          }}
        />
      </WithMenu>
    </div>
  );
  return (
    <>
      {at.rowGrip && grip("row", at.rowGrip, rowActions)}
      {at.colGrip && grip("col", at.colGrip, colActions)}
      <Hint text="Add a row">
        <button className="table-ctl table-add rows" style={{ left: at.addRow.x, top: at.addRow.y, width: at.addRow.w }} aria-label="Add a row" onMouseDown={(e) => e.preventDefault()} onClick={run("row-below", at.rows - 1, 0)}>
          <Plus size={12} weight="bold" aria-hidden="true" />
        </button>
      </Hint>
      {at.addCol && (
        <Hint text="Add a column">
          <button className="table-ctl table-add cols" style={{ left: at.addCol.x, top: at.addCol.y, height: at.addCol.h }} aria-label="Add a column" onMouseDown={(e) => e.preventDefault()} onClick={run("col-right", 0, at.cols - 1)}>
            <Plus size={12} weight="bold" aria-hidden="true" />
          </button>
        </Hint>
      )}
    </>
  );
}

/** The table a cell is in, by where it starts in the note. */
function tableOf(v: EditorView, cell: HTMLElement): number | null {
  const $p = v.state.doc.resolve(v.posAtDOM(cell, 0));
  for (let d = $p.depth; d > 0; d--) if ($p.node(d).type.spec.tableRole === "table") return $p.before(d);
  return null;
}

function spot(v: EditorView, host: HTMLElement, cell: HTMLTableCellElement): At | null {
  const table = tableOf(v, cell);
  const row = cell.parentElement as HTMLTableRowElement | null;
  return table === null || !row ? null : measure(v, host, table, row.rowIndex, cell.cellIndex);
}

/** The same table after an edit or a scroll, on the same cell or the nearest one left. */
function again(v: EditorView, host: HTMLElement, a: At): At | null {
  const node = v.state.doc.nodeAt(a.table);
  if (node?.type.spec.tableRole !== "table") return null;
  const { rows, cols } = sizeOf(v.state, a.table);
  return measure(v, host, a.table, Math.min(a.row, rows - 1), Math.min(a.col, cols - 1));
}

function measure(v: EditorView, host: HTMLElement, table: number, row: number, col: number): At | null {
  const wrap = v.nodeDOM(table) as HTMLElement | null;
  const el = wrap?.querySelector("table");
  const cell = el?.rows[row]?.cells[col];
  if (!wrap || !el || !cell) return null;
  const h = host.getBoundingClientRect();
  const w = wrap.getBoundingClientRect();
  const t = el.getBoundingClientRect();
  const r = el.rows[row]!.getBoundingClientRect();
  const c = cell.getBoundingClientRect();
  const { rows, cols } = sizeOf(v.state, table);
  // What of the table shows in its scroller: a control for a part scrolled out of sight hides.
  const left = Math.max(t.left, w.left);
  const right = Math.min(t.right, w.right - 18);
  const mid = c.left + c.width / 2;
  return {
    table,
    row,
    col,
    rows,
    cols,
    rowGrip: row > 0 && t.left >= w.left - 1 ? { x: t.left - h.left - 7, y: r.top + r.height / 2 - h.top - 11 } : null,
    colGrip: mid >= w.left && mid <= w.right - 18 ? { x: mid - h.left - 11, y: t.top - h.top - 7 } : null,
    addRow: { x: left - h.left, y: t.bottom - h.top + 3, w: Math.max(right - left, 40) },
    addCol: t.right <= w.right - 16 ? { x: t.right - h.left + 3, y: t.top - h.top, h: t.height } : null,
  };
}
