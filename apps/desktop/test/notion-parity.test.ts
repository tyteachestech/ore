import { beforeAll, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

// Notion's editing behaviours on the real note editor, headless: each case starts from a note, puts
// the caret at ‸ (or selects ‹…›), types, presses keys or pastes as a keyboard would, and checks the
// saved Markdown. The checklist they come from: docs/reviews/2026-11-06-notion-parity.md.
const w = new Window();
for (const k of ["window", "document", "HTMLElement", "Node", "MutationObserver", "getComputedStyle", "KeyboardEvent", "DOMParser"] as const) {
  const v = (w as unknown as Record<string, unknown>)[k];
  (globalThis as Record<string, unknown>)[k] = typeof v === "function" && /^[a-z]/.test(k) ? (v as (...a: unknown[]) => unknown).bind(w) : v;
}
(globalThis as Record<string, unknown>).requestAnimationFrame = (f: () => void) => setTimeout(f, 0);

let ed: typeof import("../src/editor/editor");
let core: typeof import("@milkdown/kit/core");
let pm: typeof import("@milkdown/kit/prose/state");
beforeAll(async () => {
  pm = await import("@milkdown/kit/prose/state");
  ed = await import("../src/editor/editor");
  core = await import("@milkdown/kit/core");
});

type View = import("@milkdown/kit/prose/view").EditorView;
/** A string types it, one key at a time; `{Key}` presses a key (`{Mod-z}`, `{Shift-Tab}`); `paste` pastes. */
type Step = string | { key: string } | { paste: string; html?: boolean } | { tab: "Tab" | "Shift-Tab" };
const MAC = /Mac|iP(hone|[oa]d)/.test(globalThis.navigator?.platform ?? "");

function press(v: View, combo: string): boolean {
  const parts = combo.split("-");
  const key = parts.pop()!;
  const has = (m: string) => parts.includes(m);
  const e = new KeyboardEvent("keydown", {
    key,
    shiftKey: has("Shift"),
    altKey: has("Alt"),
    metaKey: has("Meta") || (has("Mod") && MAC),
    ctrlKey: has("Ctrl") || (has("Mod") && !MAC),
    cancelable: true,
  });
  return !!v.someProp("handleKeyDown", (f) => f(v, e as never));
}

function type(v: View, text: string) {
  for (const ch of text) {
    const { from, to } = v.state.selection;
    const insert = () => v.state.tr.insertText(ch, from, to);
    if (!v.someProp("handleTextInput", (f) => f(v, from, to, ch, insert))) v.dispatch(insert());
  }
}

/** Runs the steps on `md`; the saved Markdown, and each key's handled flag (false: the browser's own). */
async function run(md: string, steps: Step[], probe?: (state: import("@milkdown/kit/prose/state").EditorState) => string | null) {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const marks = [...md.matchAll(/[‸‹›]/g)];
  const editor = await ed.createEditor(root as unknown as HTMLElement, md.replace(/[‸‹›]/g, "⁂"), () => {});
  const handled: boolean[] = [];
  let hint: string | null = null;
  editor.action((ctx) => {
    const v: View = ctx.get(core.editorViewCtx);
    // The markers, found in the document and taken out.
    const at: number[] = [];
    for (let i = 0; i < marks.length; i++) {
      let pos = -1;
      v.state.doc.descendants((n, p) => void (pos < 0 && n.isText && n.text!.includes("⁂") && (pos = p + n.text!.indexOf("⁂"))));
      v.dispatch(v.state.tr.delete(pos, pos + 1).setMeta("addToHistory", false));
      at.push(pos);
    }
    if (at.length) v.dispatch(v.state.tr.setSelection(pm.TextSelection.create(v.state.doc, at[0]!, (at[1] ?? at[0]!) - (at.length > 1 ? 0 : 0))).setMeta("addToHistory", false));
    for (const s of steps) {
      if (typeof s === "string") {
        const k = s.match(/^\{(.+)\}$/);
        if (k) handled.push(press(v, k[1]!));
        else type(v, s);
      } else if ("key" in s) handled.push(press(v, s.key));
      else if ("tab" in s) {
        // A real key event on the editor, so the handlers around it run too: handled means the browser won't move focus.
        const e = new KeyboardEvent("keydown", { key: "Tab", shiftKey: s.tab === "Shift-Tab", bubbles: true, cancelable: true });
        v.dom.dispatchEvent(e);
        handled.push(e.defaultPrevented);
      }
      else {
        // A paste event as the browser gives it, with the clipboard's text and HTML.
        const data = { "text/plain": s.html ? "" : s.paste, "text/html": s.html ? s.paste : "" } as Record<string, string>;
        const e = Object.assign(new Event("paste"), { clipboardData: { getData: (t: string) => data[t] ?? "" } });
        if (s.html) v.pasteHTML(s.paste, e as never);
        else v.pasteText(s.paste, e as never);
      }
    }
    if (probe) hint = probe(v.state);
  });
  const out = ed.markdownOf(editor);
  editor.destroy();
  root.remove();
  return { md: out.trim(), handled, hint };
}
const md = async (start: string, ...steps: Step[]) => (await run(start, steps)).md;

describe("markdown shortcuts at the start of a block", () => {
  test("# ## ### make headings, also before text already on the line", async () => {
    expect(await md("‸", "# Title")).toBe("# Title");
    expect(await md("‸", "### Small")).toBe("### Small");
    expect(await md("‸Text after", "# ")).toBe("# Text after");
    expect(await md("# ‸Title", "## ")).toBe("## Title");
  });

  test("# in a list item turns the item into a heading, splitting the list around it", async () => {
    expect(await md("1. What is AI?\n2. ‸The Foundations\n3. Next", "# ")).toBe("1. What is AI?\n\n# The Foundations\n\n1. Next");
    expect(await md("- a\n- ‸b", "## ")).toBe("- a\n\n## b");
    expect(await md("- ‸b", "### ")).toBe("### b");
    // A list in a toggle's body: the item turns there, the toggle stays.
    expect(await md("<details><summary>T</summary>\n\n1. a\n2. ‸b\n\n</details>", "# ")).toBe("<details><summary>T</summary>\n\n1. a\n\n# b\n\n</details>");
  });

  test("- 1. [] in a list item switch its kind", async () => {
    expect(await md("1. a\n2. ‸b", "- ")).toBe("1. a\n\n- b");
    expect(await md("- a\n- ‸b", "1. ")).toBe("- a\n\n1. b");
    expect(await md("- a\n- ‸b", "[] ")).toBe("- a\n- [ ] b");
  });

  test("- * + 1. make lists, [] a to-do", async () => {
    for (const m of ["-", "*", "+"]) expect(await md("‸", `${m} a`)).toBe("- a");
    expect(await md("‸", "1. a")).toBe("1. a");
    expect(await md("‸", "[] a")).toBe("- [ ] a");
  });

  test('" makes a quote, also in a list item', async () => {
    expect(await md("‸", '" Said')).toBe("> Said");
    expect(await md("- a\n- ‸b", '" ')).toBe("- a\n\n> b");
  });

  test("> makes a toggle (Notion), its line the title; in a list item, and inside a quote", async () => {
    expect(await md("‸", "> Why")).toMatch(/^<details><summary>Why<\/summary>/);
    expect(await md("‸Why it works", "> ")).toMatch(/^<details><summary>Why it works<\/summary>/);
    expect(await md("- a\n- ‸b", "> ")).toMatch(/^- a\n\n<details><summary>b<\/summary>/);
    expect(await md("> a\n>\n> ‸b", "> ")).toMatch(/^> a\n>\n> <details><summary>b<\/summary>/);
  });

  test("``` makes a code block, with its language; in a list item too", async () => {
    expect(await md("‸", "``` x")).toBe("```\nx\n```");
    expect(await md("‸", "```ts x")).toBe("```ts\nx\n```");
    expect(await md("- a\n- ‸b", "``` ")).toBe("- a\n\n```\nb\n```");
  });

  test("--- makes a divider", async () => {
    expect(await md("Above\n\n‸", "---")).toMatch(/^Above\n\n---/);
  });

  test("inside a quote, callout and toggle the shortcuts make blocks there", async () => {
    expect(await md("> a\n>\n> ‸b", "# ")).toBe("> a\n>\n> # b");
    expect(await md("> [!note]\n> ‸b", "- ")).toBe("> [!note]\n>\n> - b");
    expect(await md("<details><summary>T</summary>\n\n‸b\n\n</details>", "- ")).toBe("<details><summary>T</summary>\n\n- b\n\n</details>");
  });

  test("in a table cell they stay text", async () => {
    const out = await md("| A | B |\n| - | - |\n| ‸x | y |", "# ");
    expect(out).toContain("# x");
    expect(out).toContain("| ");
  });

  test("mid-line they stay text", async () => {
    expect(await md("Some ‸", "# not")).toMatch(/^Some \\?# not$/);
  });
});

describe("inline shortcuts", () => {
  test("**bold** *italic* `code` ~strike~ ~~strike~~", async () => {
    expect(await md("‸", "**bold** x")).toBe("**bold** x");
    expect(await md("‸", "*it* x")).toMatch(/^[*_]it[*_] x$/);
    expect(await md("‸", "`code` x")).toBe("`code` x");
    expect(await md("‸", "~s~ x")).toMatch(/^~~?s~~? x$/);
    expect(await md("‸", "~~s~~ x")).toMatch(/^~~?s~~? x$/);
  });

  test("a typed web address becomes a link when the space after it is typed", async () => {
    expect(await md("‸", "see https://ore.app/x now")).toMatch(/^see (<https:\/\/ore\.app\/x>|\[https:\/\/ore\.app\/x\]\(https:\/\/ore\.app\/x\)) now$/);
  });
});

describe("Enter", () => {
  test("at the end of a heading starts text", async () => {
    expect(await md("# T‸", "{Enter}", "x")).toBe("# T\n\nx");
  });

  test("on an empty item leaves the list; nested, it outdents", async () => {
    expect(await md("- a‸", "{Enter}", "{Enter}", "x")).toBe("- a\n\nx");
    expect(await md("- a\n  - b‸", "{Enter}", "{Enter}", "x")).toMatch(/^- a\n  - b\n- x$/);
  });

  test("after a to-do, ticked or not, starts an unticked one", async () => {
    expect(await md("- [x] a‸", "{Enter}", "b")).toBe("- [x] a\n- [ ] b");
    expect(await md("- [ ] a‸", "{Enter}", "b")).toBe("- [ ] a\n- [ ] b");
  });

  test("after a numbered item starts the next number", async () => {
    expect(await md("1. a‸", "{Enter}", "b")).toBe("1. a\n2. b");
  });

  test("in a quote starts text below it (Shift-Enter breaks the line inside)", async () => {
    expect(await md("> a‸", "{Enter}", "x")).toBe("> a\n\nx");
    expect(await md("> a‸", "{Shift-Enter}", "x")).toMatch(/^> a(\\|  )\n> x$/);
  });
});

describe("Backspace at the start of a block", () => {
  test("a heading of any level becomes text", async () => {
    expect(await md("# ‸Title", "{Backspace}")).toBe("Title");
    expect(await md("## ‸Title", "{Backspace}")).toBe("Title");
  });

  test("a list item or to-do becomes text, leaving the list", async () => {
    expect(await md("- a\n- ‸b", "{Backspace}")).toBe("- a\n\nb");
    expect(await md("- [ ] ‸a", "{Backspace}")).toBe("a");
    expect(await md("1. ‸a\n2. b", "{Backspace}")).toBe("a\n\n1. b");
  });

  test("a nested item becomes text under its parent", async () => {
    expect(await md("- a\n  - ‸b", "{Backspace}")).toBe("- a\n\n  b");
  });

  test("a quote or callout becomes text", async () => {
    expect(await md("> ‸a", "{Backspace}")).toBe("a");
    expect(await md("> [!note]\n> ‸a", "{Backspace}")).toBe("a");
  });

  test("a toggle becomes text, its body kept below", async () => {
    expect(await md("<details><summary>‸T</summary>\n\nbody\n\n</details>", "{Backspace}")).toBe("T\n\nbody");
  });

  test("text joins the block above it", async () => {
    expect(await md("# T\n\n‸x", "{Backspace}")).toBe("# Tx");
    expect(await md("- a\n\n‸b", "{Backspace}")).toBe("- ab");
  });
});

describe("Tab", () => {
  test("indents and outdents a list item", async () => {
    expect(await md("- a\n- ‸b", "{Tab}")).toBe("- a\n  - b");
    expect(await md("- a\n  - ‸b", "{Shift-Tab}")).toMatch(/^- a\n- b$/);
  });

  test("in text it stays in the note instead of moving focus out", async () => {
    expect(await run("‸Text", [{ tab: "Tab" }])).toMatchObject({ md: "Text", handled: [true] });
    expect(await run("# ‸Text", [{ tab: "Shift-Tab" }])).toMatchObject({ md: "# Text", handled: [true] });
  });

  test("on text under a list it nests the line in the last item; Shift-Tab takes it back out", async () => {
    expect(await md("- a\n- b\n\n‸More", "{Tab}")).toBe("- a\n- b\n\n  More");
    expect(await md("- a\n- b\n\n  ‸More", "{Shift-Tab}")).toBe("- a\n- b\n\nMore");
    // Under a nested list the item turns loose: blank lines, or Markdown would read the line as part of b.
    expect(await md("- a\n  - b\n\n‸More", "{Tab}")).toBe("- a\n\n  - b\n\n  More");
  });

  test("on text under a toggle it nests the line in the toggle; Shift-Tab takes it back out", async () => {
    const T = "<details><summary>T</summary>\n\nbody\n\n</details>";
    expect(await md(`${T}\n\n‸More`, "{Tab}")).toBe("<details><summary>T</summary>\n\nbody\n\nMore\n\n</details>");
    expect(await md("<details><summary>T</summary>\n\nbody\n\n‸More\n\n</details>", "{Shift-Tab}")).toBe(`${T}\n\nMore`);
  });

  test("in a code block it indents the line", async () => {
    expect(await md("```\n‸x\n```", "{Tab}")).toBe("```\n  x\n```");
  });
});

describe("keyboard shortcuts", () => {
  test("⌘B ⌘I ⌘E format the selection (⌘U and ⌘⇧X are the app's keys, below)", async () => {
    expect(await md("‹bold›", "{Mod-b}")).toBe("**bold**");
    expect(await md("‹it›", "{Mod-i}")).toMatch(/^[*_]it[*_]$/);
    expect(await md("‹c›", "{Mod-e}")).toBe("`c`");
  });

  test("underline and strikethrough have Notion's ⌘U and, as ⌘⇧S toggles the sidebar here, ⌘⇧X", async () => {
    const { BINDINGS } = await import("../src/keys");
    const combo = (id: string) => BINDINGS.find((b) => b.id === id)?.combo;
    expect(combo("note-underline")).toBe("Meta+KeyU");
    expect(combo("note-strike")).toBe("Shift+Meta+KeyX");
  });

  test("underline saves as <u>, which Markdown readers show", async () => {
    expect(await md("Some <u>key</u> words‸", "!")).toBe("Some <u>key</u> words!");
  });

  test("⌘⌥0–8 turn the block into text, headings, to-do, bullet, numbered, toggle and code (Notion's keys)", async () => {
    expect(await md("‸a", "{Mod-Alt-1}")).toBe("# a");
    expect(await md("‸a", "{Mod-Alt-2}")).toBe("## a");
    expect(await md("‸a", "{Mod-Alt-3}")).toBe("### a");
    expect(await md("# ‸a", "{Mod-Alt-0}")).toBe("a");
    expect(await md("‸a", "{Mod-Alt-4}")).toBe("- [ ] a");
    expect(await md("‸a", "{Mod-Alt-5}")).toBe("- a");
    expect(await md("‸a", "{Mod-Alt-6}")).toBe("1. a");
    expect(await md("‸a", "{Mod-Alt-7}")).toMatch(/^<details><summary>a<\/summary>/);
    expect(await md("‸a", "{Mod-Alt-8}")).toBe("```\na\n```");
    expect(await md("- x\n- ‸a", "{Mod-Alt-1}")).toBe("- x\n\n# a");
  });

  test("⌘Enter ticks and unticks a to-do", async () => {
    expect(await md("- [ ] a‸", "{Mod-Enter}")).toBe("- [x] a");
    expect(await md("- [x] a‸", "{Mod-Enter}")).toBe("- [ ] a");
  });

  test("⌘Z right after a shortcut gives back what was typed", async () => {
    expect(await md("‸", "# ", "{Mod-z}")).toMatch(/^\\?# ?$/);
    expect(await md("‸", "- ", "{Mod-z}")).toMatch(/^\\?- ?$/);
  });
});

describe("paste", () => {
  test("Markdown text pastes as blocks", async () => {
    expect(await md("‸", { paste: "# Title\n\n- a\n- b\n\n**bold** text" })).toBe("# Title\n\n- a\n- b\n\n**bold** text");
  });

  test("a web address pasted over selected text links it; on its own it is a link", async () => {
    expect(await md("‹see this›", { paste: "https://ore.app" })).toBe("[see this](https://ore.app)");
    expect(await md("‸", { paste: "https://ore.app" })).toMatch(/^(<https:\/\/ore\.app>|\[https:\/\/ore\.app\]\(https:\/\/ore\.app\))$/);
  });

  test("HTML pastes as its blocks", async () => {
    expect(await md("‸", { paste: "<h2>T</h2><ul><li>a</li></ul>", html: true })).toBe("## T\n\n- a");
  });

  test("lines of plain text paste as lines", async () => {
    expect(await md("‸", { paste: "one\ntwo" })).toMatch(/^one\n\n?two$/);
  });

  test("in a code block a paste stays code", async () => {
    expect(await md("```\n‸\n```", { paste: "# not a heading\n- x" })).toBe("```\n# not a heading\n- x\n```");
  });
});

describe("empty blocks", () => {
  const notion = () => import("../src/editor/notion");

  test("say what / does, or the kind of block", async () => {
    const n = await notion();
    const h = async (start: string, ...steps: Step[]) => (await run(start, steps, n.hintFor)).hint;
    expect(await h("Text\n\n‸", "{Enter}")).toBe("Type / for blocks");
    expect(await h("# T‸", "{Enter}", "# ")).toBe("Heading 1");
    expect(await h("- a‸", "{Enter}")).toBe("List");
    expect(await h("- [ ] a‸", "{Enter}")).toBe("To-do");
    expect(await h("Text\n\n‸", '" ')).toBe("Quote");
    expect(await h("Text\n\n‸", "> ")).toBe("Toggle");
    expect(await h("Text with words‸")).toBeNull();
    // An empty note has its own placeholder.
    expect(await h("‸")).toBeNull();
  });
});
