import { expect, test } from "bun:test";
import { citeRuns, siteName } from "../src/cite-pills";

test("a page's pill is named for its site, as people say it", () => {
  expect(["britannica.com", "www.britannica.com", "en.wikipedia.org", "bbc.co.uk", "nih.gov", "pubmed.ncbi.nlm.nih.gov", "abc.net.au", "localhost"].map(siteName))
    .toEqual(["britannica", "britannica", "wikipedia", "bbc", "nih", "nih", "abc", "localhost"]);
});

test("a run of markers becomes one pill; a link's text in brackets stays a link", () => {
  expect(citeRuns("In the 1880s [1]. Born 1850 [2][3].")).toBe("In the 1880s [·](#cite-1). Born 1850 [·](#cite-2,3).");
  expect(citeRuns("Both [1] [2] say so, and [1] again[1].")).toBe("Both [·](#cite-1,2) say so, and [·](#cite-1) again [·](#cite-1).");
  expect(citeRuns("See [2](https://x.org) for more.")).toBe("See [2](https://x.org) for more.");
});
