import { beforeAll, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

// The iPhone's keyboard bar (editor/kbbar.ts) on the real note editor, headless: each tap, saved as Markdown.
const w = new Window();
for (const k of ["window", "document", "HTMLElement", "Node", "MutationObserver", "getComputedStyle"] as const) {
  const v = (w as unknown as Record<string, unknown>)[k];
  (globalThis as Record<string, unknown>)[k] = typeof v === "function" && /^[a-z]/.test(k) ? (v as (...a: unknown[]) => unknown).bind(w) : v;
}
(globalThis as Record<string, unknown>).requestAnimationFrame = (f: () => void) => setTimeout(f, 0);

let ed: typeof import("../src/editor/editor");
let core: typeof import("@milkdown/kit/core");
let bar: typeof import("../src/editor/kbbar");
let pm: typeof import("@milkdown/kit/prose/state");
beforeAll(async () => {
  pm = await import("@milkdown/kit/prose/state");
  ed = await import("../src/editor/editor");
  core = await import("@milkdown/kit/core");
  bar = await import("../src/editor/kbbar");
});

type View = import("@milkdown/kit/prose/view").EditorView;

/** Puts the caret at the end of the text `at`, taps the bar's actions, types `then`; the saved Markdown. */
async function tap(md: string, at: string, actions: import("../src/editor/kbbar").BarAction[], then = "") {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const editor = await ed.createEditor(root as unknown as HTMLElement, md, () => {});
  const got: (boolean | null)[] = [];
  editor.action((ctx) => {
    const v: View = ctx.get(core.editorViewCtx);
    let pos = -1;
    v.state.doc.descendants((n, p) => void (n.isText && pos < 0 && n.text!.includes(at) && (pos = p + n.text!.indexOf(at) + at.length)));
    v.dispatch(v.state.tr.setSelection(pm.TextSelection.create(v.state.doc, pos)));
    for (const a of actions) {
      const tr = bar.barAction(v.state, a);
      got.push(tr ? true : null);
      if (tr) v.dispatch(tr);
    }
    if (then) v.dispatch(v.state.tr.insertText(then));
  });
  const out = ed.markdownOf(editor);
  editor.destroy();
  root.remove();
  return { md: out.trim(), got };
}

describe("keyboard bar", () => {
  test("to-do, bullet and heading turn the caret's line into one, and a second tap back into text", async () => {
    expect((await tap("Plan the week", "week", ["todo"], "!")).md).toBe("- [ ] Plan the week!");
    expect((await tap("Plan the week", "week", ["bullet"])).md).toBe("- Plan the week");
    expect((await tap("Plan the week", "week", ["heading"])).md).toBe("## Plan the week");
    expect((await tap("Plan the week", "week", ["bullet", "bullet"])).md).toBe("Plan the week");
    expect((await tap("## Plan the week", "week", ["heading"])).md).toBe("Plan the week");
  });

  test("indent and outdent move a list item; outside a list they do nothing", async () => {
    expect((await tap("- One\n- Two", "Two", ["indent"])).md).toBe("- One\n  - Two");
    expect((await tap("- One\n  - Two", "Two", ["outdent"])).md).toMatch(/^- One\n- Two$/);
    expect((await tap("Plain", "Plain", ["indent"])).got).toEqual([null]);
  });

  test("+ opens the / menu on a new line under the caret's (a new item in a list), and [[ starts a link", async () => {
    expect((await tap("First line", "First", ["block"])).md).toBe("First line\n\n/");
    expect((await tap("- One", "One", ["block"])).md).toBe("- One\n- /");
    expect((await tap("Read this", "Read", ["link"])).md).toBe("Read\\[\\[ this"); // as typed: the [[ menu opens on it
  });
});
