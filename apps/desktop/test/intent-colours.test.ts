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

  test("the three intents paint three different tints on both pages", () => {
    for (const block of css.split(":root")) {
      const tint = (name: string) => block.match(new RegExp(`--${name}: ([^;]+);`))?.[1];
      const [keep, card, question] = [tint("keep"), tint("card"), tint("question")];
      if (!keep || !card || !question) continue;
      expect(new Set([keep, card, question]).size).toBe(3);
    }
  });
});
