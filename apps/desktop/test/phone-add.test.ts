import { expect, test } from "bun:test";
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
