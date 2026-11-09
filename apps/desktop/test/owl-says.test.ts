import { expect, test } from "bun:test";
import { firstWords, landedClosed } from "../src/owl-says";
import type { TutorTurn } from "../src/Tutor";

const turn = (id: string, p: Partial<TutorTurn> = {}): TutorTurn => ({ id, message: "Why?", ...p });

test("the owl says a reply that lands while the tutor is closed, once (D159)", () => {
  const asked = new Set<string>();
  expect(landedClosed([turn("a")], asked, false)).toBeNull(); // still waiting
  expect(landedClosed([turn("a", { reply: "Because." })], asked, false)?.id).toBe("a");
  // Heard: the same reply again (a re-render) says nothing new.
  expect(landedClosed([turn("a", { reply: "Because." })], asked, false)).toBeNull();
});

test("a reply that lands while the tutor is open is heard there, not said by the owl", () => {
  const asked = new Set<string>();
  landedClosed([turn("a")], asked, true);
  expect(landedClosed([turn("a", { reply: "Because." })], asked, true)).toBeNull();
  expect(landedClosed([turn("a", { reply: "Because." })], asked, false)).toBeNull();
});

test("an error lands too, and Try again waits afresh", () => {
  const asked = new Set<string>();
  landedClosed([turn("a")], asked, false);
  expect(landedClosed([turn("a", { error: "Couldn’t answer that." })], asked, false)?.id).toBe("a");
  landedClosed([turn("a")], asked, false); // retried
  expect(landedClosed([turn("a", { reply: "Now it works." })], asked, false)?.id).toBe("a");
});

test("the owl says the reply as plain text: no citation markers, links or Markdown", () => {
  expect(firstWords({ reply: "**Retrieval** changes the memory [1][2]. See [the study](https://x.org) and `code`.\n\n# More" })).toBe("Retrieval changes the memory. See the study and code. More");
  expect(firstWords({ error: "Couldn’t answer that: offline" })).toBe("Couldn’t answer that: offline");
});

test("Markdown goes, but a # or * or > that is the content stays", () => {
  expect(firstWords({ reply: "In C#, x > 3 means a*b grows -> fast." })).toBe("In C#, x > 3 means a*b grows -> fast.");
  expect(firstWords({ reply: "## Why\n- *Spacing* helps\n1. Testing too\n> a quote" })).toBe("Why Spacing helps Testing too a quote");
});

test("a turn set aside by New chat is forgotten, so Undo bringing it back landed says nothing", () => {
  const asked = new Set<string>();
  landedClosed([turn("a")], asked, false);
  landedClosed([], asked, false); // New chat
  expect(asked.size).toBe(0);
  expect(landedClosed([turn("a", { reply: "Old reply." })], asked, false)).toBeNull(); // Undo
});
