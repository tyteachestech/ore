import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

const w = new Window();
for (const k of ["document", "NodeFilter", "HTMLElement", "Node"] as const) (globalThis as Record<string, unknown>)[k] = (w as unknown as Record<string, unknown>)[k];
const { blocksOf, textRange } = await import("../src/Focus");

const doc = (html: string) => {
  const el = document.createElement("article");
  el.innerHTML = html;
  return el as unknown as HTMLElement;
};

describe("keyboard reading focus", () => {
  test("steps through the innermost text blocks, skipping empty ones", () => {
    const d = doc("<h2>Title</h2><p>One</p><ul><li><p>Two</p></li><li>Three</li></ul><p> </p><blockquote><p>Four</p></blockquote>");
    expect(blocksOf(d).map((b) => b.textContent)).toEqual(["Title", "One", "Two", "Three", "Four"]);
  });

  test("the range covers the blocks' text without the outer whitespace or a transcript's timestamp", () => {
    const d = doc('<p class="tp"><span class="ts">0:12</span> First words here </p><p>  last <em>line</em> end. </p>');
    const [a, z] = blocksOf(d);
    expect(textRange(a!, a!)!.toString()).toBe("First words here");
    expect(textRange(a!, z!)!.toString().replace(/\s+/g, " ")).toBe("First words here last line end.");
  });
});
