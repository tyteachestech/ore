import { expect, test } from "bun:test";
import { citeQuote, citeSources } from "../src/cite";

test("a highlight copies as a quote with its linked source, and his note under it", () => {
  const c = citeQuote("Retrieval beats rereading.", { title: "The Testing Effect [2024]", url: "https://x.org/a (b)" }, "Use in class");
  expect(c.text).toBe("> Retrieval beats rereading.\n> — [The Testing Effect \\[2024\\]](https://x.org/a%20%28b%29)\n\nUse in class");
  expect(c.html).toBe('<blockquote><p>Retrieval beats rereading.</p><p>— <a href="https://x.org/a (b)">The Testing Effect [2024]</a></p></blockquote><p>Use in class</p>');
});

test("a source with no link copies its title; several copy as a list", () => {
  expect(citeQuote("a\n\nb", { title: "Notes <1>" }).html).toBe("<blockquote><p>a</p><p>b</p><p>— Notes &lt;1&gt;</p></blockquote>");
  expect(citeSources([{ title: "A", url: "https://a" }]).text).toBe("[A](https://a)");
  expect(citeSources([{ title: "A", url: "https://a" }, { title: "B" }]).text).toBe("- [A](https://a)\n- B");
});
