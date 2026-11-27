import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { locate, quoteSelector } from "../../../packages/core/src/anchoring";
import { footnotes, indexText, rangeFor, sourceQuote, sourceSkeleton } from "../src/text";

const w = new Window();
for (const k of ["document", "NodeFilter", "Node", "Range"] as const) (globalThis as any)[k] = (w as any)[k];

test("core locates the same shown passage as the reader across links and entities (F6)", () => {
  for (const [body, shown, exact] of [
    ["Tom &amp; Jerry", "Tom & Jerry", "Tom &amp; Jerry"],
    ["Read [this paper](https://example.com) today.", "Read this paper today.", "Read [this paper](https://example.com) today."],
    ["A copyright &copy;", "A copyright ©", "A copyright &copy;"],
    ["Meet &#x1F600;", "Meet 😀", "Meet &#x1F600;"],
    ["One&nbsp;two", "One two", "One&nbsp;two"],
  ]) {
    const root = document.createElement("article");
    root.innerHTML = renderToStaticMarkup(createElement(ReactMarkdown, { remarkPlugins: [remarkGfm], skipHtml: true }, footnotes(body!)));
    const idx = indexText(root as unknown as HTMLElement);
    const src = sourceSkeleton(body!);
    const selection = document.createRange();
    selection.selectNodeContents(root);
    const fromReader = sourceQuote(src, body!, idx, selection as unknown as Range);
    expect(fromReader).toEqual({ exact, start: 0 });
    const fromCore = locate(body!, shown!);
    expect(fromCore).toEqual({ start: 0, end: exact!.length });
    const q = quoteSelector(body!, fromCore!.start, fromCore!.end);
    expect(rangeFor(idx, src, body!, q)?.toString().replace(/\s/g, " ")).toBe(shown);
  }
});

test("a selection after an emoji uses the same offsets as the shown-text map (F6)", () => {
  const body = "😀 First. Second.";
  const root = document.createElement("article");
  root.textContent = body;
  const selection = document.createRange();
  selection.setStart(root.firstChild!, body.indexOf("Second"));
  selection.setEnd(root.firstChild!, body.length);
  const idx = indexText(root as unknown as HTMLElement);
  const src = sourceSkeleton(body);
  const q = sourceQuote(src, body, idx, selection as unknown as Range);
  expect(q).toEqual({ exact: "Second.", start: body.indexOf("Second") });
  expect(locate(body, q!.exact)).toEqual({ start: q!.start, end: body.length });
});
