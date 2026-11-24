import { expect, test } from "bun:test";
import { citedRange, citeJump, citeRuns, siteName } from "../src/cite-pills";

const has = (...ns: number[]) => (n: number) => ns.includes(n);

test("a page's pill is named for its site, as people say it", () => {
  expect(["britannica.com", "www.britannica.com", "en.wikipedia.org", "bbc.co.uk", "nih.gov", "pubmed.ncbi.nlm.nih.gov", "abc.net.au", "example.go.jp", "localhost", "192.168.1.10"].map(siteName))
    .toEqual(["britannica", "britannica", "wikipedia", "bbc", "nih", "nih", "abc", "example", "localhost", "192.168.1.10"]);
});

test("a run of markers becomes one pill; a link's text in brackets stays a link", () => {
  expect(citeRuns("In the 1880s [1]. Born 1850 [2][3].")).toBe("In the 1880s [·](#cite-1). Born 1850 [·](#cite-2,3).");
  expect(citeRuns("Both [1] [2] say so, and [1] again[1].", has(1, 2))).toBe("Both [·](#cite-1,2) say so, and [·](#cite-1) again [·](#cite-1).");
  expect(citeRuns("See [2](https://x.org) for more.")).toBe("See [2](https://x.org) for more.");
});

test("code keeps its brackets, and a marker starting a line stays on its line", () => {
  expect(citeRuns("Index it `xs[1]` like so [1].\n\n```py\nm[1][2]\n```")).toBe("Index it `xs[1]` like so [·](#cite-1).\n\n```py\nm[1][2]\n```");
  expect(citeRuns("Point one.\n[2] Point two")).toBe("Point one.\n [·](#cite-2) Point two");
});

// One rule with the tutor's check in core (packages/core/src/markers.ts): code and a formula are the reply's own
// words, and so is a [n] glued to a name when the reply has no citation n (`arr[2]`); with one it is a pill.
test("arr[2], a formula's brackets and a block still open keep their brackets; the marker after them is a pill", () => {
  expect(citeRuns("Take arr[2] here [1].", has(1))).toBe("Take arr[2] here [·](#cite-1).");
  expect(citeRuns("So $$x_{[1]}$$ holds [1].")).toBe("So $$x_{[1]}$$ holds [·](#cite-1).");
  expect(citeRuns("Like so [1].\n\n```py\nm[1]")).toBe("Like so [·](#cite-1).\n\n```py\nm[1]");
});

// Codex deep scan 2: a saved chat's citation, opened after its source was reimported, marked whatever now
// sat at its old offsets.
test("a citation opened after its source changed marks the words it quoted where they now are, or nothing when they are gone (F-new-citation-reimport)", () => {
  const quote = "Retrieval improves durable memory.";
  const before = `# Memory\n\n${quote}\n`;
  const start = before.indexOf(quote);
  const at = citeJump({ start, end: start + quote.length, quote }, 1);
  const slice = (body: string) => {
    const r = citedRange(body, at);
    return r && body.slice(...r);
  };
  expect(slice(before)).toBe(quote);
  // Moved: a paragraph put in above it.
  expect(slice(`# Memory\n\nA new introductory paragraph was inserted here.\n\n${quote}\n`)).toBe(quote);
  // Twice: the one nearest where it was.
  const twice = `# Memory\n\n${quote}\n\nLater, again: ${quote}\n`;
  expect(citedRange(twice, at)).toEqual([start, start + quote.length]);
  const twiceMoved = `# Intro\n\nMore words.\n\n# Memory\n\n${quote}\n\n${"Filler. ".repeat(40)}\n\n${quote}\n`;
  expect(citedRange(twiceMoved, at)).toEqual([twiceMoved.indexOf(quote), twiceMoved.indexOf(quote) + quote.length]);
  // Gone: nothing marked.
  expect(citedRange("# Memory\n\nWriting things repeatedly consumes a lot of time.\n", at)).toBeNull();
  // A quote across lines comes through whole.
  const lines = "First line\nsecond line.";
  expect(citedRange(`x\n\n${lines}`, citeJump({ start: 0, end: lines.length, quote: lines }, 2))).toEqual([3, 3 + lines.length]);
  // A jump with no quote (an exercise's evidence) keeps its offsets; one that isn't a quote isn't this.
  expect(citedRange("abcdef", "q:1:3")).toEqual([1, 3]);
  expect(citedRange("abcdef", "find:abc")).toBeUndefined();
});
