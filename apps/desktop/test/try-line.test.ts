import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// F-new-try-line-cut: on the iPhone the end screen's try line ("Write an if-then plan for Thursday's recording ·…")
// was held to one line and cut with an ellipsis, so the one thing left to do could not be read. It wraps instead.
test("the end screen's try line wraps and is never cut with an ellipsis", () => {
  const css = readFileSync(join(import.meta.dir, "..", "src", "styles.css"), "utf8");
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, sel]) => /\.review-try\b/.test(sel!));
  expect(rules.length).toBeGreaterThan(0);
  const cut = rules.filter(([, , body]) => /text-overflow:\s*ellipsis|white-space:\s*nowrap|-webkit-line-clamp:\s*\d/.test(body!)).map(([, sel]) => sel!.trim());
  expect(cut).toEqual([]);
});
