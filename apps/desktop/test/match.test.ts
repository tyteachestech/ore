import { expect, test } from "bun:test";
import { ranked, rankScore } from "../src/match";

const rows = [
  { title: "Getting the most out of Opus 5.5 in Claude and Claude Code", author: "Addy Osmani" },
  { title: "The AI Revolution: Our Immortality or Extinction", author: "Tim Urban" },
  { title: "AI Snake Oil - Chapter 1", author: "Arvind Narayanan and Sayash Kapoor" },
  { title: "Urban planning for beginners", author: "Jane Jacobs" },
];
const find = (q: string) => ranked(rows, q, (r) => [r.title, r.author]).map((r) => r.title.slice(0, 12));

test("a title match ranks above an author match", () => {
  expect(find("urban")).toEqual(["Urban planni", "The AI Revol"]);
});

test("every word must be found, in the title or another field", () => {
  expect(find("revolution urban")).toEqual(["The AI Revol"]);
  expect(find("revolution osmani")).toEqual([]);
  expect(find("osmani")).toEqual(["Getting the "]);
});

test("a typo still finds it, below the rows that hold the word as typed", () => {
  expect(find("revoluton")).toEqual(["The AI Revol"]);
  expect(find("imortality")).toEqual(["The AI Revol"]);
  expect(find("sanke")).toEqual(["AI Snake Oil"]);
  expect(find("narayanen")).toEqual(["AI Snake Oil"]);
  expect(rankScore(["Snake oil"], "snake")).toBeGreaterThan(rankScore(["Snake oil"], "sanke"));
});

test("a typo matches while the word is still being typed", () => {
  expect(find("revlu")).toEqual(["The AI Revol"]);
});

test("short words and scattered letters never match by typo", () => {
  expect(find("oik")).toEqual([]);
  expect(find("xyzzy")).toEqual([]);
  expect(rankScore(["Notes on spaced repetition"], "section")).toBe(0);
});

test("accents fold, and rows that match equally keep the list's order", () => {
  expect(rankScore(["Résumé café"], "cafe")).toBeGreaterThan(0);
  expect(find("ai")).toEqual(["AI Snake Oil", "The AI Revol"]);
});
