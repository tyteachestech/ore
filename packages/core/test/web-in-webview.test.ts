import { afterEach, expect, test } from "bun:test";
import { htmlToDoc } from "../src/ingest/web.ts";

// The iPhone runs the importers inside a web view, where the page's own `getComputedStyle` exists.
// linkedom hands Defuddle that real window, and the real function throws on an element it did not make:
// Defuddle then gave up and returned the whole page, menus and all (found 2026-11-12 in the phone bundle).
const g = globalThis as { getComputedStyle?: unknown };
afterEach(() => {
  delete g.getComputedStyle;
});

test("a page reads the same where the web view has its own getComputedStyle", async () => {
  const para = "Spacing reviews out over days keeps a memory longer than cramming them into one sitting. ";
  const html = `<html><head><title>Spacing</title></head><body>
    <nav class="sidebar"><ul><li><a href="/">Main page</a></li><li><a href="/random">Random article</a></li></ul></nav>
    <table><tr><td><article><h1>Spacing</h1>${`<p>${para.repeat(6)}</p>`.repeat(4)}</article></td></tr></table>
    <footer><a href="/about">About this site</a></footer></body></html>`;
  const plain = await htmlToDoc(html, "https://example.test/spacing");
  g.getComputedStyle = function (this: unknown) {
    throw new TypeError("Illegal invocation");
  };
  const inWebView = await htmlToDoc(html, "https://example.test/spacing");
  expect(inWebView.markdown).toBe(plain.markdown);
  expect(inWebView.markdown).not.toContain("Random article");
});
