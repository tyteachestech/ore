import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { moreBelow } from "../src/more";

// D281: a list fades at its foot only while rows wait below it.
test("more below while the foot hides rows, none at the end or when everything fits", () => {
  expect(moreBelow(0, 300, 640)).toBe(true);
  expect(moreBelow(200, 300, 640)).toBe(true);
  expect(moreBelow(340, 300, 640)).toBe(false);
  expect(moreBelow(0, 300, 300)).toBe(false);
  expect(moreBelow(339.5, 300, 640)).toBe(false); // a fractional scroll position at the end
});

test("the fade shows only with data-more and never takes a click", () => {
  const css = readFileSync(join(import.meta.dir, "../src/styles.css"), "utf8");
  const rule = css.match(/\.fade-more::after \{[^}]*\}/)?.[0] ?? "";
  expect(rule).toContain("pointer-events: none");
  expect(rule).toContain("opacity: 0");
  expect(css).toMatch(/\.fade-more\[data-more\]::after \{ opacity: 1; \}/);
});

test("the fade strip keeps a list's bottom padding", () => {
  const css = require("node:fs").readFileSync(require("node:path").join(import.meta.dir, "../src/styles.css"), "utf8");
  expect(css).toContain("margin: -32px calc(-1 * var(--fade-pad, 0px)) 0;");
});
