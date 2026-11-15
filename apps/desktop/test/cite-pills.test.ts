import { expect, test } from "bun:test";
import { citeRuns, siteName } from "../src/cite-pills";

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
