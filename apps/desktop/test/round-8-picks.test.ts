// Tyler's four picks from Impeccable round 8 (2026-11-14, D-new-words-where-he-looks).
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { GEM_WORD } from "../src/Gem";
import { readingFor } from "../src/util";

const src = (f: string) => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");

test("the gem breakdown names each count in a word (F168)", () => {
  expect(Object.values(GEM_WORD)).toEqual(["polished", "won back", "cut", "nearly cut", "missed", "rough", "new"]);
  // A word, never a noun that needs a plural: "1 missed" and "214 missed" both read right.
  for (const w of Object.values(GEM_WORD)) expect(w).toMatch(/^[a-z ]{3,10}$/);
});

test("the Reading for chip says what it counts, one or many (F169)", () => {
  expect(readingFor(3)).toBe("Reading for 3 questions");
  expect(readingFor(1)).toBe("Reading for 1 question");
  expect(readingFor(12)).toBe("Reading for 12 questions");
});

test("Finish's scope field says it skips a part of the source, in its label, its name and its error (F170)", () => {
  const finish = src("Finish.tsx");
  expect(finish.includes("Leave anything out?")).toBe(false);
  expect(finish.match(/Skip a part of this source\?/g)?.length).toBeGreaterThanOrEqual(3);
  // The iPhone keeps the same name for a screen reader and a line short enough for its 320pt field.
  expect(finish.includes('PHONE ? "Skip a part? Like “the coding part”"')).toBe(true);
});

test("the paper primary is flat wherever it shows: Review and Finish join Home's rule (F171)", () => {
  const flat = src("retro.css").split("\n").find((l) => l.startsWith(".pill-btn,"))!;
  for (const sel of [".quiz .pill-btn.quiz-go", ".review .pill-btn.quiz-go", ".home .pill-btn.home-go", ".review-pick .pill-btn.home-go"]) expect(flat.includes(sel)).toBe(true);
  expect(flat.includes("box-shadow: none")).toBe(true);
  // No older rule gives a primary a lip of its own any more.
  const lips = src("styles.css").split("\n").filter((l) => /\.pill-btn\.(quiz-go|home-go) \{/.test(l) && l.includes("box-shadow"));
  expect(lips).toEqual([]);
});

test("keyboard focus shows on a paper button: its ring sits outside it, on the page (F-new-paper-focus)", () => {
  // The ring is the paper colour and the global rule draws it 2px inside, where a paper button hides it.
  expect(/\.pill-btn:focus-visible \{ outline-offset: 2px; \}/.test(src("retro.css"))).toBe(true);
});
