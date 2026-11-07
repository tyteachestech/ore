import { beforeAll, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

// Headless Milkdown: the same editor setup the app uses, on a happy-dom document.
const w = new Window();
for (const k of ["window", "document", "HTMLElement", "Node", "MutationObserver", "getComputedStyle"] as const) {
  const v = (w as unknown as Record<string, unknown>)[k];
  (globalThis as Record<string, unknown>)[k] = typeof v === "function" && /^[a-z]/.test(k) ? (v as (...a: unknown[]) => unknown).bind(w) : v;
}
(globalThis as Record<string, unknown>).requestAnimationFrame = (f: () => void) => setTimeout(f, 0);

let ed: typeof import("../src/editor/editor");
let core: typeof import("@milkdown/kit/core");
let keep: typeof import("../src/editor/preserve").keepUnedited;
let blocks: typeof import("../src/editor/blocks");
beforeAll(async () => {
  ed = await import("../src/editor/editor");
  core = await import("@milkdown/kit/core");
  keep = (await import("../src/editor/preserve")).keepUnedited;
  blocks = await import("../src/editor/blocks");
});

const SAMPLE = `## Recall

Spacing beats massing because *effortful* retrieval strengthens the trace.
I also remember **desirable difficulties**.

## Why self-explanation works

- It forces you to notice gaps.
  - Nested: novices gain more.
* A star bullet someone typed.

1. Read the worked example.
2. Explain each step.

- [ ] Look up Chi 1989
- [x] Compare with Bisra 2018

> A quote, kept as is.

> [!note]
> Callout: this contradicts what I thought about rereading.

<details><summary>Toggle: the numbers</summary>

g = 0.55 across 64 studies.

</details>

\`\`\`ts
const r = retention(0.9);
\`\`\`

![map](images/spacing.png)

Links to [Make It Stick](ore:item/01HXYZ) and a [web page](https://example.com).
Line with trailing spaces for a break  
next line, an _underscore emphasis_ and \`inline code\`.

<span style="color:red">raw html</span>

---

## Use and connections

Use this when planning.
`;

async function open(md: string) {
  const root = document.createElement("div");
  document.body.appendChild(root);
  let last = "";
  const editor = await ed.createEditor(root as unknown as HTMLElement, md, (m) => (last = m));
  return { editor, base: ed.markdownOf(editor), changed: () => last };
}

describe("note editor (D38)", () => {
  test("toggles and callouts load as blocks; other HTML stays a literal", async () => {
    const { editor } = await open(SAMPLE);
    const types: string[] = [];
    editor.action((ctx) => {
      const { editorViewCtx } = core;
      ctx.get(editorViewCtx).state.doc.descendants((n: { type: { name: string } }) => void types.push(n.type.name));
    });
    expect(types).toContain("toggle");
    expect(types).toContain("toggle_summary");
    expect(types).toContain("callout");
    expect(types).toContain("html");
  });

  test("saving without an edit returns the file byte for byte", async () => {
    const { base } = await open(SAMPLE);
    expect(keep(SAMPLE, base, base)).toBe(SAMPLE);
  });

  test("an edit changes only the edited block", async () => {
    const { editor, base } = await open(SAMPLE);
    editor.action((ctx) => {
      const { editorViewCtx } = core;
      const view = ctx.get(editorViewCtx);
      let pos = -1;
      view.state.doc.descendants((n: { isText: boolean; text?: string }, p: number) => {
        if (pos < 0 && n.isText && n.text?.startsWith("Use this")) pos = p;
      });
      view.dispatch(view.state.tr.insertText("Always ", pos));
    });
    const out = keep(SAMPLE, base, ed.markdownOf(editor));
    expect(out).toBe(SAMPLE.replace("Use this when planning.", "Always Use this when planning."));
  });

  test("deleting the block between two lists never merges them into one", async () => {
    const md = "* A star bullet.\n* Second star.\n\n1. A step.\n\n- [ ] A to-do\n";
    const { editor, base } = await open(md);
    editor.action((ctx) => {
      const view = ctx.get(core.editorViewCtx);
      const { doc } = view.state;
      const at = doc.child(0).nodeSize;
      view.dispatch(view.state.tr.delete(at, at + doc.child(1).nodeSize));
    });
    const edited = ed.markdownOf(editor);
    const out = keep(md, base, edited);
    expect((await open(out)).base).toBe(edited);
  });

  test("link reference definitions stay where they were, and an edit beside one keeps the other lines", async () => {
    // The editor resolves `[x][p]` to an inline link and drops the definition line; the file
    // must keep both the line and every block he did not touch.
    const md = "Read [the paper][p].\n\n[p]: https://example.com\n\nMore to say.\n\n* A star bullet.\n";
    const { editor, base } = await open(md);
    expect(keep(md, base, base)).toBe(md);
    editor.action((ctx) => {
      const view = ctx.get(core.editorViewCtx);
      let pos = -1;
      view.state.doc.descendants((n: { isText: boolean; text?: string }, p: number) => {
        if (pos < 0 && n.isText && n.text?.startsWith("More")) pos = p;
      });
      view.dispatch(view.state.tr.insertText("Much ", pos));
    });
    expect(keep(md, base, ed.markdownOf(editor))).toBe(md.replace("More to say.", "Much More to say."));
    // Editing the paragraph that uses the definition keeps the definition for the rest of the note.
    const { editor: e2, base: b2 } = await open(md);
    e2.action((ctx) => {
      const view = ctx.get(core.editorViewCtx);
      view.dispatch(view.state.tr.insertText("Now ", 1));
    });
    const out = keep(md, b2, ed.markdownOf(e2));
    expect(out).toContain("[p]: https://example.com");
    expect(out).toContain("* A star bullet.\n");
    expect(out).toMatch(/^Now Read \[the paper\]\(https:\/\/example\.com\)\./);
  });

  test("menu triggers: / at a line start, after a space or after an inline node (a diagram), never mid-word", async () => {
    expect(ed.menuTrigger("/")).toEqual({ kind: "slash", query: "", typed: 1 });
    expect(ed.menuTrigger("Some text /hea")).toEqual({ kind: "slash", query: "hea", typed: 4 });
    expect(ed.menuTrigger("￼/diagram")).toEqual({ kind: "slash", query: "diagram", typed: 8 });
    expect(ed.menuTrigger("a/b")).toBeNull();
    expect(ed.menuTrigger("https://x")).toBeNull();
    expect(ed.menuTrigger("See [[mak")).toEqual({ kind: "link", query: "mak", typed: 5 });
    expect(ed.menuTrigger("Nice :fir")).toEqual({ kind: "emoji", query: "fir", typed: 4 });
    expect(ed.menuTrigger("at 10:30")).toBeNull();
  });

  test("new toggles and callouts serialize to Markdown that loads back as the same blocks", async () => {
    const md = "> [!tip]\n> Short body.\n\n<details><summary>A &lt;b&gt; title</summary>\n\nInside.\n\n</details>\n";
    const { base } = await open(md);
    expect(base).toBe(md);
  });

  test("a diagram link (D40) loads as an image node and saves back unchanged", async () => {
    const md = "Before.\n\n![Diagram](diagrams/diagram-1.excalidraw)\n\nAfter.\n";
    const { editor, base } = await open(md);
    expect(base).toBe(md);
    const srcs: string[] = [];
    editor.action((ctx) => {
      const { editorViewCtx } = core;
      ctx.get(editorViewCtx).state.doc.descendants((n: { type: { name: string }; attrs: { src?: string } }) => void (n.type.name === "image" && srcs.push(n.attrs.src!)));
    });
    expect(srcs).toEqual(["diagrams/diagram-1.excalidraw"]);
  });

  test("a resized diagram keeps its size in the link (Obsidian's |WxH) and saves it back", async () => {
    const md = "![Diagram](diagrams/diagram-1.excalidraw)\n";
    const { editor } = await open(md);
    const { withSize } = await import("../src/editor/board");
    let out = "";
    editor.action((ctx) => {
      const view = ctx.get(core.editorViewCtx);
      let at = -1;
      view.state.doc.descendants((n: { type: { name: string } }, p: number) => void (n.type.name === "image" && (at = p)));
      const n = view.state.doc.nodeAt(at)!;
      view.dispatch(view.state.tr.setNodeMarkup(at, undefined, { ...n.attrs, alt: withSize(String(n.attrs.alt), { w: 480, h: 300 }) }));
    });
    out = ed.markdownOf(editor);
    expect(out).toBe("![Diagram|480x300](diagrams/diagram-1.excalidraw)\n");
    expect((await open(out)).base).toBe(out);
  });

  test("diagramName: only diagrams/<slug>.excalidraw beside the note", () => {
    expect(blocks.diagramName("diagrams/diagram-2.excalidraw")).toBe("diagram-2");
    expect(blocks.diagramName("images/a.png")).toBeNull();
    expect(blocks.diagramName("../diagrams/x.excalidraw")).toBeNull();
    expect(blocks.diagramName("diagrams/X Y.excalidraw")).toBeNull();
  });

  /** Types `text` one key at a time at the end of the first line, as a keyboard would, so input rules run. */
  async function typeInto(md: string, text: string) {
    const { editor } = await open(md);
    const { TextSelection } = await import("@milkdown/kit/prose/state");
    editor.action((ctx) => {
      const view = ctx.get(core.editorViewCtx);
      let end = -1;
      view.state.doc.descendants((n: { isTextblock: boolean; content: { size: number } }, p: number) => {
        if (end < 0 && n.isTextblock) end = p + 1 + n.content.size;
      });
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, end)));
      for (const ch of text) {
        const at = view.state.selection.from;
        const insert = () => view.state.tr.insertText(ch, at);
        if (!view.someProp("handleTextInput", (f: (...a: unknown[]) => boolean) => f(view, at, at, ch, insert))) view.dispatch(insert());
      }
    });
    return ed.markdownOf(editor);
  }

  test("[] or [ ] then a space starts a to-do, saved as standard GFM (Notion's shortcut)", async () => {
    expect(await typeInto("", "[] Look up Chi")).toBe("- [ ] Look up Chi\n");
    expect(await typeInto("", "[ ] Look up Chi")).toBe("- [ ] Look up Chi\n");
    expect(await typeInto("", "[x] Done")).toBe("- [x] Done\n");
    expect(await typeInto("- \n", "[] In a list")).toBe("- [ ] In a list\n");
  });

  test("[] mid-line stays literal text", async () => {
    expect(await typeInto("Arrays look like", " [] here")).toMatch(/^Arrays look like \\?\[\] here\n$/);
  });
});
