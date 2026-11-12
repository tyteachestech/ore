import { beforeAll, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

// Note tables (editor/tables.ts) on the real note editor, headless: rows and columns in and out, saved as GFM.
const w = new Window();
for (const k of ["window", "document", "HTMLElement", "Node", "MutationObserver", "getComputedStyle"] as const) {
  const v = (w as unknown as Record<string, unknown>)[k];
  (globalThis as Record<string, unknown>)[k] = typeof v === "function" && /^[a-z]/.test(k) ? (v as (...a: unknown[]) => unknown).bind(w) : v;
}
(globalThis as Record<string, unknown>).requestAnimationFrame = (f: () => void) => setTimeout(f, 0);

let ed: typeof import("../src/editor/editor");
let core: typeof import("@milkdown/kit/core");
let tables: typeof import("../src/editor/tables");
let pm: typeof import("@milkdown/kit/prose/state");
beforeAll(async () => {
  pm = await import("@milkdown/kit/prose/state");
  ed = await import("../src/editor/editor");
  core = await import("@milkdown/kit/core");
  tables = await import("../src/editor/tables");
});

type View = import("@milkdown/kit/prose/view").EditorView;
const T = "Top.\n\n| Technique | Effort |\n| --- | --- |\n| Spacing | Medium |\n| Testing | High |\n";

async function run(md: string, act: (v: View, table: number) => unknown) {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const editor = await ed.createEditor(root as unknown as HTMLElement, md, () => {});
  let got: unknown;
  editor.action((ctx) => {
    const v = ctx.get(core.editorViewCtx);
    let table = -1;
    v.state.doc.descendants((n, p) => void (n.type.name === "table" && table < 0 && (table = p)));
    got = act(v, table);
  });
  const out = ed.markdownOf(editor);
  editor.destroy();
  root.remove();
  return { md: out, got };
}
const edit = (e: import("../src/editor/tables").TableEdit, row: number, col: number) => (v: View, t: number) => {
  const tr = tables.editTable(v.state, t, row, col, e);
  if (tr) v.dispatch(tr);
  return tr;
};
const rows = (md: string) => md.split("\n").filter((l) => l.startsWith("|"));

describe("note tables", () => {
  test("a row goes in above or below, and comes out; the header row stays", async () => {
    expect(rows((await run(T, edit("row-below", 1, 0))).md)).toHaveLength(5);
    expect(rows((await run(T, edit("row-below", 1, 0))).md)[3]).toMatch(/^\|\s+\|\s+\|$/);
    expect(rows((await run(T, edit("row-above", 1, 0))).md)[2]).toMatch(/^\|\s+\|\s+\|$/);
    expect((await run(T, edit("row-delete", 1, 0))).md).not.toContain("Spacing");
    expect((await run(T, edit("row-delete", 0, 0))).got).toBe(null);
    expect((await run(T, edit("row-above", 0, 0))).got).toBe(null);
    // GFM needs a row under the header: the last one stays.
    expect((await run("| A |\n| --- |\n| b |\n", edit("row-delete", 1, 0))).got).toBe(null);
    // Below the header comes a body row; the header stays one row.
    const under = rows((await run(T, edit("row-below", 0, 0))).md);
    expect(under).toHaveLength(5);
    expect(under[0]).toMatch(/Technique/);
    expect(under[2]).toMatch(/^\|\s+\|\s+\|$/);
  });

  test("a column goes in left or right, and comes out; the last column stays", async () => {
    expect(rows((await run(T, edit("col-right", 0, 0))).md)[0]).toMatch(/^\| Technique \|\s+\| Effort \|$/);
    expect(rows((await run(T, edit("col-left", 0, 0))).md)[0]).toMatch(/^\|\s+\| Technique \| Effort \|$/);
    expect(rows((await run(T, edit("col-delete", 0, 1))).md)[0]).toMatch(/^\| Technique \|$/);
    expect((await run("| A |\n| --- |\n| b |\n", edit("col-delete", 0, 0))).got).toBe(null);
  });

  test("a row or a column moves one step; the header row stays on top", async () => {
    expect(rows((await run(T, edit("row-down", 1, 0))).md)[2]).toMatch(/Testing/);
    expect(rows((await run(T, edit("row-up", 2, 0))).md)[2]).toMatch(/Testing/);
    expect((await run(T, edit("row-up", 1, 0))).got).toBe(null);
    expect((await run(T, edit("row-down", 2, 0))).got).toBe(null);
    expect(rows((await run(T, edit("col-move-right", 0, 0))).md)[0]).toMatch(/^\| Effort\s+\| Technique\s+\|$/);
    expect(rows((await run(T, edit("col-move-left", 2, 1))).md)[3]).toMatch(/^\| High\s+\| Testing\s+\|$/);
    expect((await run(T, edit("col-move-left", 0, 0))).got).toBe(null);
  });

  test("Tab in the last cell adds a row and goes to its first cell", async () => {
    const { md } = await run(T, (v, t) => {
      v.dispatch(v.state.tr.setSelection(pm.TextSelection.near(v.state.doc.resolve(tables.cellAt(v.state, t, 2, 1) + 1))));
      v.someProp("handleKeyDown", (f) => f(v, { key: "Tab", shiftKey: false, metaKey: false, ctrlKey: false, altKey: false } as never));
      v.dispatch(v.state.tr.insertText("Interleaving"));
    });
    expect(rows(md)).toHaveLength(5);
    expect(rows(md)[4]).toMatch(/^\| Interleaving\s+\|\s+\|$/);
  });

  test("a row or column dragged by its grip moves in one step; the header row stays on top (Notion)", async () => {
    const T3 = T + "| Mixing | Low |\n";
    const move = (kind: "row" | "col", from: number, to: number) => (v: View, t: number) => {
      const tr = tables.moveLine(v.state, t, kind, from, to);
      if (tr) v.dispatch(tr);
      return tr;
    };
    expect(rows((await run(T3, move("row", 3, 1))).md).map((r) => r.split("|")[1]!.trim().replace(/^-+$/, "-"))).toEqual(["Technique", "-", "Mixing", "Spacing", "Testing"]);
    expect(rows((await run(T3, move("row", 1, 3))).md).map((r) => r.split("|")[1]!.trim().replace(/^-+$/, "-"))).toEqual(["Technique", "-", "Testing", "Mixing", "Spacing"]);
    expect(rows((await run(T, move("col", 0, 1))).md)[0]).toMatch(/^\| Effort\s*\| Technique \|$/);
    expect((await run(T, move("row", 1, 0))).got).toBe(null);
    expect((await run(T, move("row", 2, 2))).got).toBe(null);
  });
});

describe("the caret's cell (the phone's keyboard bar)", () => {
  test("names the table, row and column the caret is in, and nothing outside a table", async () => {
    const at = (find: string) => (v: View, t: number) => {
      let pos = -1;
      v.state.doc.descendants((n, p) => void (pos < 0 && n.isText && n.text?.includes(find) && (pos = p + 1)));
      v.dispatch(v.state.tr.setSelection(pm.TextSelection.create(v.state.doc, pos)));
      return { cell: tables.caretCell(v.state), t };
    };
    const high = (await run(T, at("High"))).got as { cell: unknown; t: number };
    expect(high.cell).toEqual({ table: high.t, row: 2, col: 1 });
    const head = (await run(T, at("Technique"))).got as { cell: unknown; t: number };
    expect(head.cell).toEqual({ table: head.t, row: 0, col: 0 });
    expect(((await run(T, at("Top"))).got as { cell: unknown }).cell).toBe(null);
  });
});
