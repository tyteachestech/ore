import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// D124: a ★ Key point is blue, a plain highlight gold, a question purple. Tyler read a whole
// source thinking every highlight was a key point because both were gold on the dark page.
const css = readFileSync(join(import.meta.dir, "../src/styles.css"), "utf8");

const rules = css
  .split("\n")
  .flatMap((line, i) => (line.match(/[^{}]*\{[^}]*\}/g) ?? []).map((r) => ({ r, i: i + 1 })));

function ownsIntent(selector: string, intent: string) {
  return new RegExp(`(^|[\\s.()])(hl-)?${intent}(?=[\\s.,:)\\]{]|$)`).test(selector);
}

describe("highlight intent colours", () => {
  test("every key point (card) rule uses the card tokens, never keep's gold", () => {
    const wrong = rules.filter(({ r }) => {
      const [selector = "", body = ""] = r.split("{");
      return ownsIntent(selector, "card") && !ownsIntent(selector, "keep") && /--keep\b|--keep-solid/.test(body);
    });
    expect(wrong.map(({ r, i }) => `${i}: ${r.trim()}`)).toEqual([]);
  });

  test("the four intents paint four different tints on both pages (D127 adds Try it, green)", () => {
    let pages = 0;
    for (const block of css.split(":root")) {
      const tints = ["keep", "card", "question", "apply"].map((name) => block.match(new RegExp(`--${name}: ([^;]+);`))?.[1]);
      if (tints.some((t) => !t)) continue;
      pages++;
      expect(new Set(tints).size).toBe(4);
    }
    expect(pages).toBe(2);
  });

  test("every intent has its highlight tint, popup switch and margin mark", () => {
    for (const i of ["keep", "card", "question", "apply"]) {
      expect(css).toContain(`::highlight(hl-${i})`);
      expect(css).toMatch(new RegExp(`\\.intent\\.${i} \\{`));
    }
    for (const i of ["card", "question", "apply"]) expect(css).toContain(`.mark-icon.${i} {`);
  });
});
