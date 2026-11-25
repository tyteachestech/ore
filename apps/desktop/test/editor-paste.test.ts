import { beforeAll, expect, test } from "bun:test";
import { Window } from "happy-dom";

const w = new Window();
for (const k of ["window", "document", "HTMLElement", "Node", "MutationObserver", "getComputedStyle"] as const) {
  const v = (w as unknown as Record<string, unknown>)[k];
  (globalThis as Record<string, unknown>)[k] = typeof v === "function" && /^[a-z]/.test(k) ? (v as (...a: unknown[]) => unknown).bind(w) : v;
}
(globalThis as Record<string, unknown>).requestAnimationFrame = (f: () => void) => setTimeout(f, 0);
let ed: typeof import("../src/editor/editor");
let core: typeof import("@milkdown/kit/core");
let pm: typeof import("@milkdown/kit/prose/state");
beforeAll(async () => {
  ed = await import("../src/editor/editor");
  core = await import("@milkdown/kit/core");
  pm = await import("@milkdown/kit/prose/state");
});

async function paste(md: string, plain: string, html = "", select = 0) {
  const root = document.createElement("div");
  document.body.append(root);
  const editor = await ed.createEditor(root, md, () => {});
  try {
    const view = editor.action((ctx) => ctx.get(core.editorViewCtx));
    let at = 1;
    view.state.doc.descendants((node, pos) => {
      if (node.isText && node.text?.startsWith("KEEP")) at = pos;
    });
    view.dispatch(view.state.tr.setSelection(pm.TextSelection.create(view.state.doc, at, at + select)));
    const event = new w.Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: {
      getData: (type: string) => type === "text/plain" ? plain : type === "text/html" ? html : "",
      files: [], items: [], types: html ? ["text/plain", "text/html"] : ["text/plain"],
    } });
    view.dom.dispatchEvent(event as unknown as Event);
    return { markdown: ed.markdownOf(editor), doc: view.state.doc };
  } finally {
    await editor.destroy();
    root.remove();
  }
}

for (const newline of ["\n", "\r\n", "\r"]) {
  for (const selected of [0, 2]) {
    test(`plain multiline paste at a table caret preserves unselected text (${JSON.stringify(newline)}, selected=${selected})`, async () => {
      const out = await paste("| A | B |\n| - | - |\n| KEEP | NEIGHBOR |", `First${newline}Second`, "", selected);
      expect(out.doc.firstChild!.child(1).childCount).toBe(2);
      expect(out.doc.firstChild!.child(1).child(0).textContent).toBe(`First Second${selected ? "EP" : "KEEP"}`);
      expect(out.doc.firstChild!.child(1).child(1).textContent).toBe("NEIGHBOR");
    });
  }
}

async function reopen(markdown: string) {
  const root = document.createElement("div");
  document.body.append(root);
  const editor = await ed.createEditor(root, markdown, () => {});
  try {
    return editor.action((ctx) => ctx.get(core.editorViewCtx).state.doc);
  } finally {
    await editor.destroy();
    root.remove();
  }
}

function rows(doc: import("@milkdown/kit/prose/model").Node) {
  const out: string[][] = [];
  doc.firstChild!.forEach((row) => {
    const cells: string[] = [];
    row.forEach((cell) => cells.push(cell.textContent));
    out.push(cells);
  });
  return out;
}

for (const span of ["2", "0"]) {
  test(`pasted row spans (${span}) keep values under their headings after reopening`, async () => {
    const out = await paste("", "Group\tValue\nAlpha\tBeta\n\tGamma", `<table><thead><tr><th>Group</th><th>Value</th></tr></thead><tbody><tr><td rowspan="${span}"><strong>Alpha</strong></td><td>Beta</td></tr><tr><td>Gamma</td></tr></tbody></table>`);
    const expected = [["Group", "Value"], ["Alpha", "Beta"], ["Alpha", "Gamma"]];
    expect(rows(out.doc)).toEqual(expected);
    expect(rows(await reopen(out.markdown))).toEqual(expected);
  });
}

test("pasted combined row and column spans expand to rectangular cells", async () => {
  const out = await paste("", "Group\tDetail\tValue", '<table><tr><th>Group</th><th>Detail</th><th>Value</th></tr><tr><td rowspan="2" colspan="2">Alpha</td><td>Beta</td></tr><tr><td>Gamma</td></tr></table>');
  const expected = [["Group", "Detail", "Value"], ["Alpha", "Alpha", "Beta"], ["Alpha", "Alpha", "Gamma"]];
  expect(rows(out.doc)).toEqual(expected);
  expect(rows(await reopen(out.markdown))).toEqual(expected);
});

for (const content of [
  '<p><strong>Alpha</strong></p><p><a href="https://example.com">Beta</a></p>',
  '<div><p><strong>Alpha</strong></p><div><a href="https://example.com">Beta</a></div></div>',
  '<ul><li><strong>Alpha</strong></li><li><a href="https://example.com">Beta</a></li></ul>',
]) {
  test(`pasted block content stays in one table cell (${content.slice(0, 12)})`, async () => {
    const out = await paste("", "Title\nAlpha\nBeta", `<table><tr><th>Title</th></tr><tr><td>${content}</td></tr></table>`);
    const expected = [["Title"], ["Alpha Beta"]];
    expect(rows(out.doc)).toEqual(expected);
    expect(rows(await reopen(out.markdown))).toEqual(expected);
    expect(out.markdown).toContain("**Alpha**");
    expect(out.markdown).toContain("[Beta](https://example.com)");
  });
}

test("pasted paragraphs and row spans are normalized together without moving neighbors", async () => {
  const out = await paste("", "Group\tValue", '<table><tr><th>Group</th><th>Value</th></tr><tr><td rowspan="2"><p>Alpha</p><p>Beta</p></td><td>One</td></tr><tr><td>Two</td></tr></table>');
  const expected = [["Group", "Value"], ["Alpha Beta", "One"], ["Alpha Beta", "Two"]];
  expect(rows(out.doc)).toEqual(expected);
  expect(rows(await reopen(out.markdown))).toEqual(expected);
});
