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
beforeAll(async () => {
  ed = await import("../src/editor/editor");
  core = await import("@milkdown/kit/core");
  ops = await import("../src/editor/blockops");
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
  });

  test("kindOf names what Turn into marks", async () => {
    const kinds: (string | null)[] = [];
    for (const s of ["Ideas", "First", "Apple"]) await act(NOTE, s, (v, b) => void kinds.push(ops.kindOf(v.state.doc, b)) ?? null);
    expect(kinds).toEqual(["h2", "text", "bullet"]);
  });
});
