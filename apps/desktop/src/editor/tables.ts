import { type Command, type EditorState, Plugin, TextSelection, type Transaction } from "@milkdown/kit/prose/state";
import { addColumnAfter, addColumnBefore, addRowAfter, addRowBefore, deleteColumn, deleteRow, goToNextCell, isInTable, moveTableColumn, moveTableRow, TableMap } from "@milkdown/kit/prose/tables";
import { tableSchema } from "@milkdown/kit/preset/gfm";
import type { ViewMutationRecord } from "@milkdown/kit/prose/view";
import { $prose, $view } from "@milkdown/kit/utils";

// Notion's simple tables in a note, saved as GFM tables: rows and columns added and taken out from
// the grips on a row and a column, the + under and beside the table, and Tab in the last cell.

export type TableEdit = "row-above" | "row-below" | "row-up" | "row-down" | "row-delete" | "col-left" | "col-right" | "col-move-left" | "col-move-right" | "col-delete";

/** Each edit: its command, and where the caret goes after it (the cell it made, moved or left beside). */
const EDITS: Record<TableEdit, { run: (table: number, row: number, col: number) => Command; to: (row: number, col: number) => [number, number]; rows?: number; cols?: number }> = {
  "row-above": { run: () => addRowBefore, to: (r, c) => [r, c], rows: 1 },
  "row-below": { run: () => addRowAfter, to: (r, c) => [r + 1, c], rows: 1 },
  "row-up": { run: (pos, r) => moveTableRow({ from: r, to: r - 1, select: false, pos: pos + 1 }), to: (r, c) => [r - 1, c] },
  "row-down": { run: (pos, r) => moveTableRow({ from: r, to: r + 1, select: false, pos: pos + 1 }), to: (r, c) => [r + 1, c] },
  "row-delete": { run: () => deleteRow, to: (r, c) => [r, c], rows: -1 },
  "col-left": { run: () => addColumnBefore, to: (r, c) => [r, c], cols: 1 },
  "col-right": { run: () => addColumnAfter, to: (r, c) => [r, c + 1], cols: 1 },
  "col-move-left": { run: (pos, _, c) => moveTableColumn({ from: c, to: c - 1, select: false, pos: pos + 1 }), to: (r, c) => [r, c - 1] },
  "col-move-right": { run: (pos, _, c) => moveTableColumn({ from: c, to: c + 1, select: false, pos: pos + 1 }), to: (r, c) => [r, c + 1] },
  "col-delete": { run: () => deleteColumn, to: (r, c) => [r, c], cols: -1 },
};

/** Whether the table can take the edit: the header row stays on top, and GFM keeps one row under
 *  it and one column. */
export function canEdit(rows: number, cols: number, row: number, col: number, edit: TableEdit): boolean {
  switch (edit) {
    case "row-above": return row > 0;
    case "row-up": return row > 1;
    case "row-down": return row > 0 && row < rows - 1;
    case "row-delete": return row > 0 && rows > 2;
    case "col-move-left": return col > 0;
    case "col-move-right": return col < cols - 1;
    case "col-delete": return cols > 1;
    default: return true;
  }
}

/** Where the cell at `row`, `col` of the table at `table` starts. */
export function cellAt(state: EditorState, table: number, row: number, col: number): number {
  const node = state.doc.nodeAt(table)!;
  const map = TableMap.get(node);
  return table + 1 + map.map[row * map.width + col]!;
}

/** The table's size, for which edits it allows: the header row, one row under it and the last column stay (GFM). */
export function sizeOf(state: EditorState, table: number) {
  const map = TableMap.get(state.doc.nodeAt(table)!);
  return { rows: map.height, cols: map.width };
}

/** One edit on the cell at `row`, `col`, as one editor step; the caret lands in the cell it made or
 *  moved, or the one beside what it took out. Null for an edit the table can't take. */
export function editTable(state: EditorState, table: number, row: number, col: number, edit: TableEdit): Transaction | null {
  const { rows, cols } = sizeOf(state, table);
  if (!canEdit(rows, cols, row, col, edit)) return null;
  const e = EDITS[edit];
  const at = state.apply(state.tr.setSelection(TextSelection.near(state.doc.resolve(cellAt(state, table, row, col) + 1))));
  let out: Transaction | null = null;
  e.run(table, row, col)(at, (tr) => void (out = tr));
  if (!out) return null;
  const tr = out as Transaction;
  const [r, c] = e.to(row, col);
  const now = state.apply(tr);
  const cell = cellAt(now, table, Math.min(r, rows + (e.rows ?? 0) - 1), Math.min(c, cols + (e.cols ?? 0) - 1));
  return tr.setSelection(TextSelection.near(tr.doc.resolve(cell + 1))).scrollIntoView();
}

/** A row or column dragged by its grip from `from` to `to` (Notion), as one editor step; the header
 *  row stays on top. The caret goes into the moved line. Null when it doesn't move. */
export function moveLine(state: EditorState, table: number, kind: "row" | "col", from: number, to: number): Transaction | null {
  const { rows, cols } = sizeOf(state, table);
  const n = kind === "row" ? rows : cols;
  const min = kind === "row" ? 1 : 0;
  if (from === to || from < min || to < min || from >= n || to >= n) return null;
  const move = kind === "row" ? moveTableRow({ from, to, select: false, pos: table + 1 }) : moveTableColumn({ from, to, select: false, pos: table + 1 });
  // As editTable: the command reads the table from a caret inside it.
  const at = state.apply(state.tr.setSelection(TextSelection.near(state.doc.resolve(cellAt(state, table, kind === "row" ? from : 0, kind === "row" ? 0 : from) + 1))));
  let out: Transaction | null = null;
  move(at, (tr) => void (out = tr));
  if (!out) return null;
  const tr = out as Transaction;
  const cell = cellAt(at.apply(tr), table, kind === "row" ? to : 0, kind === "row" ? 0 : to);
  return tr.setSelection(TextSelection.near(tr.doc.resolve(cell + 1))).scrollIntoView();
}

/** Tab in the last cell adds a row and goes to it (Notion, Google Docs). Before the GFM keymap. */
export const tablePlugin = $prose(
  () =>
    new Plugin({
      props: {
        handleKeyDown: (view, e) => {
          if (e.key !== "Tab" || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey || !isInTable(view.state)) return false;
          if (goToNextCell(1)(view.state)) return false;
          const $c = view.state.selection.$from;
          let d = $c.depth;
          while (d > 0 && $c.node(d).type.spec.tableRole !== "table") d--;
          const table = $c.before(d);
          const { rows, cols } = sizeOf(view.state, table);
          const tr = editTable(view.state, table, rows - 1, cols - 1, "row-below");
          if (!tr) return false;
          view.dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(cellAt(view.state.apply(tr), table, rows, 0) + 1))));
          return true;
        },
      },
    }),
);

/** A table wider than the note scrolls sideways in place, faded at the edge with more to see
 *  (Notion); the widen button beside + gives it the whole page. */
export const tableView = $view(tableSchema.node, () => (node) => {
  const dom = document.createElement("div");
  dom.className = "note-table";
  const table = dom.appendChild(document.createElement("table"));
  const body = table.appendChild(document.createElement("tbody"));
  const fade = () => {
    dom.classList.toggle("more-left", dom.scrollLeft > 1);
    dom.classList.toggle("more-right", dom.scrollLeft + dom.clientWidth < dom.scrollWidth - 1);
  };
  dom.addEventListener("scroll", fade, { passive: true });
  const seen = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fade);
  seen?.observe(dom);
  seen?.observe(table);
  return {
    dom,
    contentDOM: body,
    ignoreMutation: (m: ViewMutationRecord) => m.type === "attributes" && m.target === dom,
    update: (n) => n.type === node.type,
    destroy: () => seen?.disconnect(),
  };
});
