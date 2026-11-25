import { expect, test } from "bun:test";

// The finish panel's Continue while it works. A source finished partway waits there for the AI's key points (they
// say which questions he hasn't reached, D100), up to a minute, under "Saving…": he took a save for stuck
// (F-new-finish-saving, the simulated learner run of 2026-11-25).
(globalThis as Record<string, unknown>).localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const { finishBusy } = await import("../src/finish-busy");

test("Continue says what it is waiting for: a save, a part left out, or the key points of a source finished partway", () => {
  expect(finishBusy("", false)).toBe("Saving…");
  expect(finishBusy("skip the appendix", false)).toBe("Leaving that out…");
  expect(finishBusy(" ", true)).toBe("Finding the key points…");
  expect(finishBusy("skip the appendix", true)).toBe("Leaving that out…");
});
