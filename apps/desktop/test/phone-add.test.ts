import { expect, test } from "bun:test";
import { entries, pastedHtml } from "../src/paste";
import { phoneEntries } from "../src/phone/AddLink";

// Impeccable eval round 10: the Mac's Add box keeps pasted words as a Text source; the iPhone's took only links.
test("phone Add: links are queued, any other words are one text source, as in the Mac's Add box", () => {
  expect(phoneEntries("https://example.com/a", null)).toEqual([{ kind: "link", url: "https://example.com/a" }]);
  expect(phoneEntries("https://a.com/1\nexample.com/2", null)).toEqual([{ kind: "link", url: "https://a.com/1" }, { kind: "link", url: "https://example.com/2" }]);
  const words = "Retrieval beats rereading.\n\nhttps://example.com/source is where I read it.";
  expect(phoneEntries(`  ${words}\n`, null)).toEqual([{ kind: "text", text: words }]);
  // A file path is the Mac's to read: on the phone it is words.
  expect(phoneEntries("/Users/me/notes.pdf", null)).toEqual([{ kind: "text", text: "/Users/me/notes.pdf" }]);
  // The paste's HTML comes along while the text is still the paste, so its headings and tables are kept.
  const html = "<h2>Spacing</h2><p>Retrieval beats rereading.</p>";
  expect(phoneEntries("Spacing\nRetrieval beats rereading.", { text: "Spacing\nRetrieval beats rereading.", html })).toEqual([{ kind: "text", text: "Spacing\nRetrieval beats rereading.", html }]);
  expect(phoneEntries("Spacing, edited", { text: "Spacing", html })).toEqual([{ kind: "text", text: "Spacing, edited" }]);
  expect(phoneEntries("   ", null)).toEqual([]);
});

// Codex test of #519, E5: only invisible characters (zero-width, BOM, soft hyphen) made a source with a blank name.
test("a paste of only invisible characters is empty, on the Mac and the phone (F557)", () => {
  expect(entries("\u200b\u200d\n\ufeff\u2060")).toEqual([]);
  expect(phoneEntries("\u200b \u00ad", null)).toEqual([]);
});

// Codex test of #519, E2: a paste that was only a list lost its numbers and items, as its HTML was dropped.
test("a pasted list keeps its HTML, so its items come in as a list (F556)", () => {
  const clip = (html: string) => ({ getData: (t: string) => (t === "text/html" ? html : "") }) as unknown as DataTransfer;
  expect(pastedHtml(clip("<ol><li>Read</li><li>Recall</li></ol>"))).toBe("<ol><li>Read</li><li>Recall</li></ol>");
  expect(pastedHtml(clip("<ul class=x><li>One</li></ul>"))).toBe("<ul class=x><li>One</li></ul>");
  expect(pastedHtml(clip("<p>Just <b>words</b></p>"))).toBeNull();
});
