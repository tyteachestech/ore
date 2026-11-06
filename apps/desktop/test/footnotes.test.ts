import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Footnotes in a body that renders in slices (D96, Wait But Why): each slice is its own parse, so GFM
// footnotes showed "[^7]" and dropped the notes. `footnotes` makes them links that keep their text.
const w = new Window();
for (const k of ["document", "NodeFilter"] as const) (globalThis as Record<string, unknown>)[k] = (w as unknown as Record<string, unknown>)[k];
const { chunks, footnotes, indexText, sourceSkeleton } = await import("../src/text");

const md = [
  "No one calls it AI anymore.”[^7] Because of this, and a second note.[^n2]",
  "",
  "```",
  "a[^1] in code stays",
  "```",
  "",
  "[^7]: Vardi, *Artificial Intelligence*, 5.",
  "",
  "    A second paragraph of the note.",
  "",
  "[^n2]: Okay so there are two kinds of notes.",
  "",
].join("\n");

const render = (src: string) => {
  const a = ({ href, children }: { href?: string; children?: ReactNode }) =>
    createElement("a", { href }, typeof children === "string" && children.startsWith("^") ? [createElement("span", { key: 0 }, "^"), children.slice(1)] : children);
  const root = document.createElement("article");
  root.innerHTML = renderToStaticMarkup(createElement(ReactMarkdown, { remarkPlugins: [remarkGfm], components: { a }, skipHtml: true }, src));
  return root;
};

test("footnote markers link to their notes and back, in any slice", () => {
  const out = footnotes(md);
  expect(out).toContain("anymore.”[^7](#fn-7) Because");
  expect(out).toContain("note.[^n2](#fn-n2)");
  expect(out).toContain("[^7](#fnref-7): Vardi");
  expect(out).toContain("\nA second paragraph of the note.");
  expect(out).toContain("a[^1] in code stays");
  // The marker and its note in different slices still render, as links.
  const slices = chunks(out, 40);
  expect(slices.length).toBeGreaterThan(1);
  const html = slices.map((c) => render(c).innerHTML).join("");
  expect(html).toContain('href="#fn-7"');
  expect(html).toContain('href="#fnref-n2"');
  expect(html).toContain("Okay so there are two kinds of notes.");
  expect(html.replace("a[^1] in code", "")).not.toContain("[^");
});

test("the rendered text still lines up with the source, so highlights across a marker paint", () => {
  const root = render(footnotes(md));
  const strip = (s: string) => s.replace(/a\^1incodestays/, ""); // code text: same on both sides
  expect(strip(indexText(root as unknown as HTMLElement).chars)).toBe(strip(sourceSkeleton(md).chars));
});
