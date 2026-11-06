import { beforeAll, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

// Note colours (editor/colors.ts) through the real note editor, headless.
const w = new Window();
for (const k of ["window", "document", "HTMLElement", "Node", "MutationObserver", "getComputedStyle"] as const) {
  const v = (w as unknown as Record<string, unknown>)[k];
  (globalThis as Record<string, unknown>)[k] = typeof v === "function" && /^[a-z]/.test(k) ? (v as (...a: unknown[]) => unknown).bind(w) : v;
}
(globalThis as Record<string, unknown>).requestAnimationFrame = (f: () => void) => setTimeout(f, 0);

let ed: typeof import("../src/editor/editor");
let core: typeof import("@milkdown/kit/core");

beforeAll(async () => {
  ed = await import("../src/editor/editor");
  core = await import("@milkdown/kit/core");

});


async function open(md: string) {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const editor = await ed.createEditor(root as unknown as HTMLElement, md, () => {});
  return { editor, base: ed.markdownOf(editor) };
}

describe("text colours and highlights (Tyler 2026-11-06)", () => {
  test("load as marks and save back byte for byte", async () => {
    const md = "A <mark>plain highlight</mark>, a <mark data-color=\"blue\">blue one</mark> and <span data-color=\"red\">red text</span> with **<mark>bold inside</mark>**.\n";
    const { editor, base } = await open(md);
    expect(base).toBe(md);
    const marks: string[] = [];
    editor.action((ctx) => ctx.get(core.editorViewCtx).state.doc.descendants((n) => void n.marks.forEach((m) => marks.push(`${m.type.name}:${m.attrs.color ?? ""}`))));
    expect(new Set(marks)).toEqual(new Set(["ore_highlight:", "ore_highlight:blue", "ore_text_color:red", "strong:"]));
  });

  test("unknown colours, lone tags and other HTML stay literal text", async () => {
    const md = "A <span data-color=\"chartreuse\">x</span> and <mark>open only and <b>bold</b>.\n";
    const { editor, base } = await open(md);
    expect(base).toBe(md);
    let marked = 0;
    editor.action((ctx) => ctx.get(core.editorViewCtx).state.doc.descendants((n) => void (marked += n.marks.filter((m) => m.type.name.startsWith("ore_")).length)));
    expect(marked).toBe(0);
  });

  test("a colour applied in the editor saves as the tag", async () => {
    const { editor } = await open("Some words here.\n");
    editor.action((ctx) => {
      const v = ctx.get(core.editorViewCtx);
      const { schema } = v.state;
      v.dispatch(v.state.tr.addMark(6, 11, schema.marks.ore_highlight!.create({ color: "green" })).addMark(12, 16, schema.marks.ore_text_color!.create({ color: "purple" })));
    });
    expect(ed.markdownOf(editor)).toBe("Some <mark data-color=\"green\">words</mark> <span data-color=\"purple\">here</span>.\n");
  });
});
