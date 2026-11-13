import { expect, test } from "bun:test";
import { numbers, renumber } from "../scripts/ids.ts";

const findings = "| F1 | x |\n| F2 | x |\n| F-new-tab-focus | a |\n| F-new-drop-undo | b |\n| F-new-x | c |\n";
const decisions = "- D1. a\n- D7. b\n- D-new-home-list. c\n";

test("ids: placeholders take the next free numbers in the order their rows appear", () => {
  const map = numbers(findings, decisions);
  expect(Object.fromEntries(map)).toEqual({ "F-new-tab-focus": "F3", "F-new-drop-undo": "F4", "F-new-x": "F5", "D-new-home-list": "D8" });
  expect(renumber("guard `F-new-drop-undo` (D-new-home-list), F-new-tab-focus, F-new-x.", map)).toBe("guard `F4` (D8), F3, F5.");
});

test("ids: a placeholder with no row is refused", () => {
  expect(() => renumber("see F-new-missing", numbers(findings, decisions))).toThrow(/no row/);
});
