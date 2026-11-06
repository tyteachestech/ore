import { beforeAll, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

// The ⋮⋮ handle's block actions (move, duplicate, delete, turn into) on the real note editor, headless.
const w = new Window();
for (const k of ["window", "document", "HTMLElement", "Node", "MutationObserver", "getComputedStyle"] as const) {
  const v = (w as unknown as Record<string, unknown>)[k];
  (globalThis as Record<string, unknown>)[k] = typeof v === "function" && /^[a-z]/.test(k) ? (v as (...a: unknown[]) => unknown).bind(w) : v;
}
(globalThis as Record<string, unknown>).requestAnimationFrame = (f: () => void) => setTimeout(f, 0);

let ed: typeof import("../src/editor/editor");
let core: typeof import("@milkdown/kit/core");
let ops: typeof import("../src/editor/blockops");
let core0: typeof import("@milkdown/kit/prose/state");
beforeAll(async () => {
  ed = await import("../src/editor/editor");
  core = await import("@milkdown/kit/core");
  ops = await import("../src/editor/blockops");
  core0 = await import("@milkdown/kit/prose/state");
});

type View = import("@milkdown/kit/prose/view").EditorView;

/** Opens `md`, finds the block whose text starts with `start`, runs `act` on it and returns the new Markdown. */
async function act(md: string, start: string, run: (v: View, b: import("../src/editor/blockops").Block) => import("@milkdown/kit/prose/state").Transaction | null) {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const editor = await ed.createEditor(root as unknown as HTMLElement, md, () => {});
  let out = "";
  editor.action((ctx) => {
    const v = ctx.get(core.editorViewCtx);
    let at = -1;
    v.state.doc.descendants((n, p) => {
      if (at < 0 && n.isTextblock && n.textContent.startsWith(start)) at = p + 1;
      return at < 0;
    });
    if (at < 0) throw new Error(`no block starts with ${start}`);
    const b = ops.blockAt(v.state.doc, at)!;
    const tr = run(v, b);
    if (tr) v.dispatch(tr);
  });
  out = ed.markdownOf(editor);
  editor.destroy();
  root.remove();
  return out;
}

const NOTE = "## Ideas\n\nFirst line.\n\n- Apple\n- Pear\n  - Nested\n- Plum\n\nLast line.\n";

describe("block actions (⋮⋮ handle)", () => {
  test("each list item is its own block; a one-item list is the list", async () => {
    expect(await act(NOTE, "Pear", (v, b) => ops.remove(v.state, b))).toBe("## Ideas\n\nFirst line.\n\n- Apple\n- Plum\n\nLast line.\n");
    expect(await act("Top.\n\n- Only\n\nEnd.\n", "Only", (v, b) => ops.remove(v.state, b))).toBe("Top.\n\nEnd.\n");
  });

  test("move up and down passes one sibling and keeps nested items with their parent", async () => {
    expect(await act(NOTE, "Pear", (v, b) => ops.moveBy(v.state, b, -1))).toBe("## Ideas\n\nFirst line.\n\n- Pear\n  - Nested\n- Apple\n- Plum\n\nLast line.\n");
    expect(await act(NOTE, "First", (v, b) => ops.moveBy(v.state, b, 1))).toBe("## Ideas\n\n- Apple\n- Pear\n  - Nested\n- Plum\n\nFirst line.\n\nLast line.\n");
    expect(await act(NOTE, "Apple", (v, b) => ops.moveBy(v.state, b, -1))).toBe(NOTE); // the first item stays
  });

  test("drag: a block goes to any gap; an item dropped at the top comes in a list; never into itself", async () => {
    // "Last line." above the heading.
    expect(await act(NOTE, "Last", (v, b) => ops.moveTo(v.state, b, ops.gaps(v.state.doc, b).find((g) => g.pos === 0)!))).toBe(
      "Last line.\n\n## Ideas\n\nFirst line.\n\n- Apple\n- Pear\n  - Nested\n- Plum\n",
    );
    expect(await act(NOTE, "Plum", (v, b) => ops.moveTo(v.state, b, ops.gaps(v.state.doc, b).find((g) => g.pos === 0)!))).toBe(
      "- Plum\n\n## Ideas\n\nFirst line.\n\n- Apple\n- Pear\n  - Nested\n\nLast line.\n",
    );
    let inside = -1;
    await act(NOTE, "Pear", (v, b) => {
      inside = ops.gaps(v.state.doc, b).filter((g) => g.pos > b.from && g.pos < b.to).length;
      return null;
    });
    expect(inside).toBe(0);
    // Into the nested list, under "Nested".
    expect(
      await act(NOTE, "Plum", (v, b) => {
        let nested = -1;
        v.state.doc.descendants((n, p) => void (n.type.name === "list_item" && n.textContent === "Nested" && (nested = p + n.nodeSize)));
        return ops.moveTo(v.state, b, ops.gaps(v.state.doc, b).find((g) => g.pos === nested)!);
      }),
    ).toBe("## Ideas\n\nFirst line.\n\n- Apple\n- Pear\n  - Nested\n  - Plum\n\nLast line.\n");
  });

  test("duplicate puts a copy right after", async () => {
    expect(await act(NOTE, "Apple", (v, b) => ops.duplicate(v.state, b))).toBe("## Ideas\n\nFirst line.\n\n- Apple\n- Apple\n- Pear\n  - Nested\n- Plum\n\nLast line.\n");
  });

  test("turn into: keeps the text and the blocks under it; an item leaving its list splits the list", async () => {
    expect(await act(NOTE, "First", (v, b) => ops.turnInto(v.state, b, "h3"))).toContain("### First line.\n");
    expect(await act(NOTE, "First", (v, b) => ops.turnInto(v.state, b, "todo"))).toContain("- [ ] First line.\n");
    expect(await act(NOTE, "First", (v, b) => ops.turnInto(v.state, b, "callout"))).toContain("> [!note]\n> First line.\n");
    expect(await act(NOTE, "First", (v, b) => ops.turnInto(v.state, b, "toggle"))).toContain("<details><summary>First line.</summary>\n");
    expect(await act(NOTE, "Pear", (v, b) => ops.turnInto(v.state, b, "todo"))).toContain("- [ ] Pear\n  - Nested\n");
    expect(await act(NOTE, "Pear", (v, b) => ops.turnInto(v.state, b, "text"))).toBe("## Ideas\n\nFirst line.\n\n- Apple\n\nPear\n\n- Nested\n- Plum\n\nLast line.\n");
    expect(await act("<details><summary>Why</summary>\n\nBecause.\n\n</details>\n", "Why", (v, b) => ops.turnInto(v.state, b, "text"))).toBe("Why\n\nBecause.\n");
    expect(await act("## Head\n", "Head", (v, b) => ops.turnInto(v.state, b, "quote"))).toBe("> Head\n");
    // A line turned into a list item beside a list joins it, as in Notion: one list, not two.
    expect(await act(NOTE, "Last", (v, b) => ops.turnInto(v.state, b, "bullet"))).toContain("- Plum\n- Last line.\n");
    expect(await act("Top\n\n- One\n", "Top", (v, b) => ops.turnInto(v.state, b, "bullet"))).toBe("- Top\n- One\n");
  });

  test("kindOf names what Turn into marks", async () => {
    const kinds: (string | null)[] = [];
    for (const s of ["Ideas", "First", "Apple"]) await act(NOTE, s, (v, b) => void kinds.push(ops.kindOf(v.state.doc, b)) ?? null);
    expect(kinds).toEqual(["h2", "text", "bullet"]);
  });
});

/** Opens `md`, selects the blocks from the one starting with `a` to the one starting with `h` (Esc,
 *  then ⇧↑ ⇧↓), runs `run` and returns the new Markdown and what is selected after. */
async function picked(md: string, a: string, h: string, run: (v: View) => void) {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const editor = await ed.createEditor(root as unknown as HTMLElement, md, () => {});
  let sel = "";
  editor.action((ctx) => {
    const v = ctx.get(core.editorViewCtx);
    const at = (start: string) => {
      let pos = -1;
      v.state.doc.descendants((n, p) => {
        if (pos < 0 && n.isTextblock && n.textContent.startsWith(start)) pos = p + 1;
        return pos < 0;
      });
      return ops.blockAt(v.state.doc, pos)!.from;
    };
    v.dispatch(v.state.tr.setSelection(ops.selectBlocks(v.state.doc, at(a), at(h))!));
    run(v);
    const s = v.state.selection;
    sel = s instanceof ops.BlockSelection ? v.state.doc.textBetween(s.from, s.to, "|", "|") : `caret ${s.empty}`;
  });
  const out = ed.markdownOf(editor);
  editor.destroy();
  root.remove();
  return { md: out, sel };
}
/** A key press as the editor's plugins get it. */
const key = (v: View, k: string, shift = false, meta = false) =>
  v.someProp("handleKeyDown", (f) => f(v, { key: k, code: k.length === 1 ? `Key${k.toUpperCase()}` : k, shiftKey: shift, metaKey: meta, ctrlKey: false, altKey: false } as never));

describe("selected blocks (Esc, then ⇧↑ ⇧↓)", () => {
  test("items of one list stay items; taking in a block outside the list takes the whole list", async () => {
    expect((await picked(NOTE, "Apple", "Pear", () => {})).sel).toBe("Apple|Pear|Nested");
    expect((await picked(NOTE, "First", "Nested", () => {})).sel).toBe("First line.|Apple|Pear|Nested|Plum");
    // From a nested item back up past its parent: the parent and what follows.
    expect((await picked(NOTE, "Plum", "Nested", () => {})).sel).toBe("Pear|Nested|Plum");
  });

  test("Backspace and cut take them out whole; a whole list goes with its last item", async () => {
    expect((await picked(NOTE, "Apple", "Pear", (v) => v.dispatch(v.state.tr.deleteSelection()))).md).toBe("## Ideas\n\nFirst line.\n\n- Plum\n\nLast line.\n");
    expect((await picked(NOTE, "First", "Plum", (v) => v.dispatch(v.state.tr.deleteSelection()))).md).toBe("## Ideas\n\nLast line.\n");
    expect((await picked(NOTE, "Apple", "Plum", (v) => v.dispatch(v.state.tr.deleteSelection()))).md).toBe("## Ideas\n\nFirst line.\n\nLast line.\n");
  });

  test("move, duplicate and Turn into act on all of them, and they stay selected", async () => {
    const down = await picked(NOTE, "Apple", "Pear", (v) => v.dispatch(ops.moveBy(v.state, ops.selectedBlock(v.state)!, 1)!));
    expect(down.md).toBe("## Ideas\n\nFirst line.\n\n- Plum\n- Apple\n- Pear\n  - Nested\n\nLast line.\n");
    expect(down.sel).toBe("Apple|Pear|Nested");
    const twice = await picked(NOTE, "First", "First", (v) => v.dispatch(ops.duplicate(v.state, ops.selectedBlock(v.state)!)));
    expect(twice.md).toContain("First line.\n\nFirst line.\n\n- Apple");
    expect(twice.sel).toBe("First line.");
    const bullets = await picked("A.\n\nB.\n\n- C.\n", "A.", "B.", (v) => v.dispatch(ops.turnInto(v.state, ops.selectedBlock(v.state)!, "bullet")!));
    expect(bullets.md).toBe("- A.\n- B.\n- C.\n");
    expect(bullets.sel).toBe("A.|B.");
    const text = await picked(NOTE, "Pear", "Plum", (v) => v.dispatch(ops.turnInto(v.state, ops.selectedBlock(v.state)!, "text")!));
    expect(text.md).toBe("## Ideas\n\nFirst line.\n\n- Apple\n\nPear\n\n- Nested\n\nPlum\n\nLast line.\n");
    const kinds: (string | null)[] = [];
    await picked(NOTE, "Apple", "Plum", (v) => void kinds.push(ops.kindOf(v.state.doc, ops.selectedBlock(v.state)!)));
    await picked(NOTE, "First", "Apple", (v) => void kinds.push(ops.kindOf(v.state.doc, ops.selectedBlock(v.state)!)));
    expect(kinds).toEqual(["bullet", null]);
  });

  test("keys: ↑ ↓ step through blocks (into children going down), ⇧ grows, Enter types, typing does nothing", async () => {
    const walk = await picked(NOTE, "First", "First", (v) => ["ArrowDown", "ArrowDown", "ArrowDown"].forEach((k) => key(v, k)));
    expect(walk.sel).toBe("Nested");
    // Nested is already in once Pear is: the second ⇧↓ goes on to Plum.
    const grow = await picked(NOTE, "Apple", "Apple", (v) => (key(v, "ArrowDown", true), key(v, "ArrowDown", true)));
    expect(grow.sel).toBe("Apple|Pear|Nested|Plum");
    const typed = await picked(NOTE, "Apple", "Apple", (v) => expect(key(v, "x")).toBe(true));
    expect(typed.md).toBe(NOTE);
    expect((await picked(NOTE, "Apple", "Apple", (v) => key(v, "Enter"))).sel).toBe("caret true");
    expect((await picked(NOTE, "Apple", "Apple", (v) => key(v, "Escape"))).sel).toBe("caret true");
  });

  test("⌘A: the line's text, then every block; Backspace then leaves an empty note", async () => {
    const all = await picked(NOTE, "First", "First", (v) => {
      v.dispatch(v.state.tr.setSelection(core0.TextSelection.create(v.state.doc, v.state.selection.from + 2)));
      const cmdA = () => key(v, "a", false, true);
      cmdA();
      expect(v.state.doc.textBetween(v.state.selection.from, v.state.selection.to)).toBe("First line.");
      cmdA();
    });
    expect(all.sel.startsWith("Ideas|First line.|Apple")).toBe(true);
    expect((await picked(NOTE, "Ideas", "Last", (v) => v.dispatch(v.state.tr.deleteSelection()))).md.trim()).toBe("");
  });
});

describe("toggle headings", () => {
  const TH = "<details><summary><h2>Why it works</h2></summary>\n\nBecause.\n\n</details>\n";
  test("save as a heading inside the toggle's summary, and load back the same", async () => {
    expect(await act(TH, "Why", () => null)).toBe(TH);
    const kinds: (string | null)[] = [];
    await act(TH, "Why", (v, b) => void kinds.push(ops.kindOf(v.state.doc, b)) ?? null);
    expect(kinds).toEqual(["th2"]);
    // A summary that is only partly a heading stays the toggle's text.
    const odd = "<details><summary><h2>A</h2> b</summary>\n\nC.\n\n</details>\n";
    expect(await act(odd, "<h2>", () => null)).toBe("<details><summary>&lt;h2&gt;A&lt;/h2&gt; b</summary>\n\nC.\n\n</details>\n");
  });

  test("Turn into: a line becomes a toggle heading, and back; a toggle keeps its body", async () => {
    expect(await act(NOTE, "First", (v, b) => ops.turnInto(v.state, b, "th1"))).toContain("<details><summary><h1>First line.</h1></summary>\n");
    expect(await act(TH, "Why", (v, b) => ops.turnInto(v.state, b, "toggle"))).toBe("<details><summary>Why it works</summary>\n\nBecause.\n\n</details>\n");
    expect(await act(TH, "Why", (v, b) => ops.turnInto(v.state, b, "h2"))).toBe("## Why it works\n\nBecause.\n");
    expect(await act("<details><summary>Why</summary>\n\nBecause.\n\n</details>\n", "Why", (v, b) => ops.turnInto(v.state, b, "th3"))).toBe(
      "<details><summary><h3>Why</h3></summary>\n\nBecause.\n\n</details>\n",
    );
  });
});

