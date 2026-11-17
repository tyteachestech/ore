import { expect, test } from "bun:test";
import { BASE, LAG, sharedStart, steadyRate, steadyStep } from "../src/steady";

// D321: the tutor's reply is typed at a steady pace, never more than LAG behind the model.
const typeOut = (shown: number, target: number) => {
  const rate = steadyRate(shown, target);
  let ms = 0;
  while (shown < target && ms < 10_000) {
    shown = steadyStep(shown, target, rate, 16);
    ms += 16;
  }
  return { shown, ms };
};

test("types at the base pace when the model is not ahead", () => {
  expect(steadyRate(10, 20)).toBe(BASE);
  expect(steadyStep(10, 20, BASE, 100)).toBeCloseTo(10 + BASE / 10);
});

test("never passes what the model sent", () => {
  expect(steadyStep(18, 20, BASE, 1000)).toBe(20);
});

test("a clump or a whole reply (Codex) is on screen within LAG, however long", () => {
  for (const target of [200, 600, 5000]) {
    const { shown, ms } = typeOut(0, target);
    expect(shown).toBe(target);
    expect(ms).toBeLessThanOrEqual(LAG * 1000 + 16);
  }
});

test("a few letters type at the base pace, not in a flash", () => {
  expect(typeOut(0, 14).ms).toBeGreaterThanOrEqual(180);
});

test("when the model starts over, the letters that still match stay", () => {
  expect(sharedStart("Spacing beats cram", "Spacing works")).toBe(8);
  expect(sharedStart("", "abc")).toBe(0);
  expect(sharedStart("abc", "abc")).toBe(3);
});
