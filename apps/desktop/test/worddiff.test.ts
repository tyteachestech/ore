import { describe, expect, test } from "bun:test";
import { wordDiff } from "../src/worddiff";

const show = (a: string, b: string) => wordDiff(a, b).map((p) => (p.kind === "same" ? p.text : p.kind === "del" ? `[-${p.text}-]` : `{+${p.text}+}`)).join("");

describe("wordDiff (D161)", () => {
  test("the same text is one unchanged piece", () => {
    expect(wordDiff("What is spacing?", "What is spacing?")).toEqual([{ text: "What is spacing?", kind: "same" }]);
  });

  test("a swapped word shows struck then added, the rest unchanged", () => {
    expect(show("What does spacing improve?", "What does spaced practice improve?")).toBe("What does [-spacing-]{+spaced practice+} improve?");
  });

  test("a swapped phrase reads as one swap, not word by word", () => {
    expect(show("compared with cramming the night before", "compared with massed practice the night before")).toBe("compared with [-cramming-]{+massed practice+} the night before");
  });

  test("punctuation alone can change", () => {
    expect(show("Name the three parts.", "Name the three parts?")).toBe("Name the three parts[-.-]{+?+}");
  });

  test("an added clause and a dropped one", () => {
    expect(show("Why does it work", "Why does retrieval practice work, in one line")).toBe("Why does [-it-]{+retrieval practice+} work{+, in one line+}");
    expect(show("Why, in one line, does it work", "Why does it work")).toBe("Why[-, in one line,-] does it work");
  });

  test("empty sides", () => {
    expect(wordDiff("", "New card")).toEqual([{ text: "New card", kind: "add" }]);
    expect(wordDiff("Old card", "")).toEqual([{ text: "Old card", kind: "del" }]);
  });

  test("joining the pieces of each side gives back each version", () => {
    const a = "When you say Sure, you're right most of the time — why?";
    const b = "When he says Sure, how often is he right, and why does it matter?";
    const d = wordDiff(a, b);
    expect(d.filter((p) => p.kind !== "add").map((p) => p.text).join("")).toBe(a);
    expect(d.filter((p) => p.kind !== "del").map((p) => p.text).join("")).toBe(b);
  });
});
