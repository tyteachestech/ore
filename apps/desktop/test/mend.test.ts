import { describe, expect, test } from "bun:test";
import { mend } from "../src/mend";

// A reply is drawn as it is written (D138, D296): the Markdown so far is cut anywhere, so an open mark
// would show as stray characters until its closing half arrives.
describe("a reply being written never shows half-written Markdown", () => {
  test("open bold, italic, code and strike are closed", () => {
    expect(mend("It is **bold and")).toBe("It is **bold and**");
    expect(mend("an *idea")).toBe("an *idea*");
    expect(mend("call `fetch(")).toBe("call `fetch(`");
    expect(mend("~~old")).toBe("~~old~~");
  });
  test("a link whose address is still coming shows as its words", () => {
    expect(mend("see [the paper](https://exa")).toBe("see the paper");
  });
  test("a table waits until its header and rule are whole", () => {
    expect(mend("Compare:\n\n| Term | Mean")).toBe("Compare:\n\n");
    expect(mend("Compare:\n\n| Term | Meaning |\n|---|")).toBe("Compare:\n\n");
    expect(mend("Compare:\n\n| Term | Meaning |\n|---|---|\n| Recall | pul")).toBe("Compare:\n\n| Term | Meaning |\n|---|---|\n| Recall | pul");
  });
  test("finished Markdown is left as it is", () => {
    const whole = "A **point**, `code` and a [link](https://example.com).\n\n| a | b |\n|:--|--:|\n| 1 | 2 |\n";
    expect(mend(whole)).toBe(whole);
  });
});
