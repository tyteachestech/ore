import { expect, test } from "bun:test";
import { afterAnswer, cardQuotes, type Annotation, type CardFull, type DueEntry } from "../src/ore";

const due = (id: string, over: Partial<DueEntry> = {}): DueEntry => ({ id, kind: "card", state: "live", item: "I", skills: [], question: "q", relearn: false, ...over });

test("a new exercise he missed comes back as one he has seen: Again, not New (rehearsal 2026-11-15)", () => {
  const q = afterAnswer([due("a", { state: "draft" }), due("b"), due("c"), due("d"), due("e")], true);
  const back = q.find((e) => e.id === "a")!;
  expect(q.map((e) => e.id)).toEqual(["b", "c", "d", "a", "e"]);
  expect([back.relearn, back.state]).toEqual([true, "live"]);
  // A second miss waits for its FSRS date.
  expect(afterAnswer([back, due("f")], true).map((e) => e.id)).toEqual(["f"]);
});

const ann = (id: string, exact: string, status = "open"): Annotation => ({ id, exact, status }) as unknown as Annotation;
const card = (over: Partial<CardFull>): CardFull => ({ id: "c", kind: "prompt", state: "live", item: "I", question: "q", answer: "a", rubric: [], ...over });

test("review shows every highlight an exercise was planned from, in order, not only the first (rehearsal 2026-11-15)", () => {
  const anns = [ann("h1", "Here are the three most common strategies I came across:"), ann("h2", "Plagiarize the brain, the first route."), ann("h3", "Try to make evolution do what it did before."), ann("gone", "Deleted.", "deleted")];
  const quotes = cardQuotes(card({ annotation: "h1", also: ["h2", "gone", "h3"] }), anns);
  expect(quotes.map((x) => x.at)).toEqual(["h1", "h2", "h3"]);
  expect(quotes[1]!.text).toBe("Plagiarize the brain, the first route.");
  expect(cardQuotes(card({ annotation: "h1" }), anns).map((x) => x.at)).toEqual(["h1"]);
  expect(cardQuotes(card({}), anns)).toEqual([]);
});

test("a highlight named twice shows once", () => {
  expect(cardQuotes(card({ annotation: "h1", also: ["h1", "h2", "h2"] }), [ann("h1", "One."), ann("h2", "Two.")]).map((x) => x.at)).toEqual(["h1", "h2"]);
});
