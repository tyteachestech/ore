import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { readdirSync, readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

// A highlight maps a rendered selection to the Markdown source and back (text.ts). Both skeletons
// must agree on what renders as text, or a selection can't be saved and a saved highlight never
// paints (reader stress test, 2026-11-08: code with `# comments`, math, Wikipedia links, entities).
const w = new Window();
for (const k of ["document", "NodeFilter", "Node"] as const) (globalThis as Record<string, unknown>)[k] = (w as unknown as Record<string, unknown>)[k];
const { chunks, footnotes, indexText, plainSkeleton, rangeFor, sourceHint, sourceQuote, sourceSkeleton } = await import("../src/text");

/** The body as the reader renders it (Reader.tsx `Chunk`). */
const render = (md: string) => {
  const root = document.createElement("article");
  root.innerHTML = renderToStaticMarkup(
    createElement(
      ReactMarkdown,
      { remarkPlugins: [remarkGfm, [remarkMath, { singleDollarTextMath: false }]], rehypePlugins: [[rehypeKatex, { output: "html", throwOnError: false }]], skipHtml: true },
      footnotes(md),
    ),
  );
  document.body.appendChild(root);
  return root as unknown as HTMLElement;
};

/** A DOM range from the start of `from` to the end of `to` in the rendered text (a drag). */
function drag(root: HTMLElement, from: string, to: string, nth = 0): Range {
  const idx = indexText(root);
  const skel = plainSkeleton;
  let a = -1;
  for (let i = 0; i <= nth; i++) a = idx.chars.indexOf(skel(from), a + 1);
  const b = idx.chars.indexOf(skel(to), a) + skel(to).length - 1;
  const r = document.createRange();
  r.setStart(idx.nodes[idx.node[a]!]!, idx.off[a]!);
  r.setEnd(idx.nodes[idx.node[b]!]!, idx.off[b]! + 1);
  return r;
}

const CODE = [
  "Sum the items.",
  "",
  "```python",
  "total = 0",
  "# add each item",
  "for x in items:",
  "    total += x",
  "```",
  "",
  "```java",
  "List<String> names = new ArrayList<>();",
  "```",
  "",
  "```yaml",
  "steps:",
  "  - run: build",
  "  > not a quote",
  "  1. not a list",
  "```",
  "",
  "```sh",
  "echo $$",
  "grep '\\.md$' \\(a\\) [x](y)",
  "```",
  "",
  "Generic types like `Map<Key>` and `# not a heading` and `$$x$$` show up inline.",
  "",
  "```",
  ">>> d = Dog('Fido')",
  ">>> e = Dog('Buddy')",
  "```",
  "",
  "Then the price is $$5$$ after all.",
  "",
].join("\n");

const WIKI =
  "arbitrary number of study stages.\n\n" +
  '- [Neural-network-based](https://en.wikipedia.org/wiki/Neural_network_\\(machine_learning\\) "Neural network (machine learning)")[^21] algorithms\n' +
  "- [Memory](https://en.wikipedia.org/wiki/Memory_(psychology)) research and <https://example.com/a>\n\n" +
  "The SM family of algorithms.\n\n" +
  "[^21]: A note.\n";

const ENTITIES = "Tom &amp; Jerry is an HTML&nbsp;entity &#x27;test&#39; &copy; here, not &bogus; though.\n\nwith a reference [ref link][r1] in it and [collapsed][] and [Shortcut] too, not [undefined][nope].\n\n[r1]: https://example.com/r1\n[collapsed]: https://example.com/c \"A title\"\n[shortcut]: <https://example.com/s>\n";

const MATH = "Inline math $$a+b$$ sits within this sentence too.\n\n$$\nE = mc^2\n$$\n\nAfter the display.\n";

describe("source and rendered skeletons agree", () => {
  for (const [name, md] of [["code", CODE], ["wikipedia links", WIKI], ["entities and reference links", ENTITIES], ["math", MATH]] as const) {
    test(name, () => {
      expect(sourceSkeleton(md).chars).toBe(indexText(render(md)).chars);
    });
  }
});

describe("a highlight in code paints after a reload (reader-01)", () => {
  test("its passage is found in the rendered code", () => {
    const root = render(CODE);
    const src = sourceSkeleton(CODE);
    const idx = indexText(root);
    for (const exact of ["total = 0\n# add each item\nfor x in items:\n    total += x", "List<String> names", "- run: build\n  > not a quote", "echo $$\ngrep '\\.md$' \\(a\\) [x](y)", "`Map<Key>` and `# not a heading`", ">>> e = Dog('Buddy')"]) {
      const start = CODE.indexOf(exact);
      const r = rangeFor(idx, src, CODE, { exact, prefix: CODE.slice(start - 32, start), suffix: CODE.slice(start + exact.length, start + exact.length + 32), start });
      expect(r?.toString().replace(/\s+/g, "")).toBe(exact.replace(/[\s`]+/g, ""));
    }
  });
});

describe("a selection maps back to its source (reader-03, -04, -07)", () => {
  const cases: [string, string, string, string, string][] = [
    ["math inline", MATH, "Inline math", "too.", "Inline math $$a+b$$ sits within this sentence too."],
    ["math display", MATH, "too.", "After", "too.\n\n$$\nE = mc^2\n$$\n\nAfter"],
    ["wikipedia link with parens and title", WIKI, "arbitrary number", "The SM family", WIKI.slice(0, WIKI.indexOf("The SM family") + 13)],
    ["entity", ENTITIES, "Tom", "Jerry", "Tom &amp; Jerry"],
    ["reference link", ENTITIES, "with a reference", "in it", "with a reference [ref link][r1] in it"],
    ["code", CODE, "total = 0", "total += x", "total = 0\n# add each item\nfor x in items:\n    total += x"],
  ];
  for (const [name, md, from, to, exact] of cases) {
    test(name, () => {
      const root = render(md);
      const q = sourceQuote(sourceSkeleton(md), md, indexText(root), drag(root, from, to));
      expect(q).toEqual({ exact, start: md.indexOf(exact) });
    });
  }
});

test("a selection on repeated code saves where he selected (reader-02)", () => {
  const block = "```\n>>> d = Dog('Fido')\n>>> e = Dog('Buddy')\n```\n";
  const md = ["One.", block, "Two.", block, "Three.", block].join("\n");
  const root = render(md);
  const q = sourceQuote(sourceSkeleton(md), md, indexText(root), drag(root, ">>> d", "Buddy')", 2));
  const third = md.lastIndexOf(">>> d");
  expect(q?.start).toBe(third);
});

test("a selection that can't be quoted still says where it is (reader-02)", () => {
  const md = "Alpha beta.\n\nGamma delta.\n\nAlpha beta.\n";
  const root = render(md);
  const r = drag(root, "Alpha", "beta.", 1);
  const at = sourceHint(sourceSkeleton(md), indexText(root), r);
  expect(Math.abs(at - md.lastIndexOf("Alpha"))).toBeLessThan(Math.abs(at - md.indexOf("Alpha")));
});

// Every golden import (packages/core/test/golden): what the reader shows and what the source skeleton
// keeps are the same text, so any passage in them can be highlighted and painted again.
describe("golden imports: source and rendered skeletons agree", () => {
  const dir = `${import.meta.dir}/../../../packages/core/test/golden/`;
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
    test(f, () => {
      const body = readFileSync(dir + f, "utf8").replace(/^---\n[\s\S]*?\n---\n/, "");
      const root = document.createElement("article");
      for (const c of chunks(body)) root.appendChild(render(c));
      const a = sourceSkeleton(body).chars;
      const b = indexText(root as unknown as HTMLElement).chars;
      let i = 0;
      while (i < a.length && a[i] === b[i]) i++;
      expect(a.slice(Math.max(0, i - 20), i + 60)).toBe(b.slice(Math.max(0, i - 20), i + 60));
    });
  }
});

// Collected lists a highlight by its passage, which is Markdown source (reader-10): it reads as the page shows it.
test("a passage reads as the page shows it, not as its Markdown", async () => {
  const { passageText } = await import("../src/text");
  expect(passageText("and a [link to the")).toBe("and a link to the");
  expect(passageText("Generic types like `Map<Key>` show up in")).toBe("Generic types like Map<Key> show up in");
  expect(passageText("Literal hash: \\# not a heading.")).toBe("Literal hash: # not a heading.");
  expect(passageText("words**, _italic")).toBe("words, italic");
  expect(passageText('see [the docs](https://x.y/a_(b) "T") and [1], ~~gone~~')).toBe("see the docs and [1], gone");
  expect(passageText("scope_test and 5 * 3, Tom &amp; Jerry")).toBe("scope_test and 5 * 3, Tom & Jerry");
  expect(passageText("- one\n- two `a*b_c`")).toBe("one two a*b_c");
  // Cut from the body, a passage has no definitions: a reference link still shows its text alone, and a
  // footnote mark (a raised number on the page) has no place on one plain line.
  expect(passageText("the [memory][1] of it[^3] and [this][] goes")).toBe("the memory of it and this goes");
  expect(passageText("[^3]: A note.")).toBe("3 A note.");
  expect(passageText("`a[b][c]` and `x[^1]`")).toBe("a[b][c] and x[^1]");
});

// A character reference widens a quote to all of itself, but only where the page shows it as one
// character: in code, or escaped, "&amp;" is five characters, and a quote ending on its "&" stays there.
describe("a quote ending on an & takes the reference only where it is one (review of reader-07)", () => {
  const cases: [string, string, string, string, string][] = [
    ["entity", "Tom &amp; Jerry.\n", "Tom", "&", "Tom &amp;"],
    ["in code", "Code `a &amp; b` here.\n", "a", "&", "a &"],
    ["escaped", "Text \\&amp; here.\n", "Text", "&", "Text \\&"],
  ];
  for (const [name, md, from, to, exact] of cases) {
    test(name, () => {
      const root = render(md);
      const q = sourceQuote(sourceSkeleton(md), md, indexText(root), drag(root, from, to));
      expect(q?.exact).toBe(exact);
    });
  }
});
