import { expect, test } from "bun:test";
import { hasIcon, iconUrl } from "../src/IconPicker";

// F-new-icon-hole: any "mc:<name>" became a mask URL, so a name the set lacks (an older set's, a hand edit of
// skills.yaml) loaded nothing and left an empty slot where the dot or the letter should be.
test("a skill icon the set can't draw counts as no icon, so the row falls back to its dot or letter", () => {
  expect(iconUrl("mc:brain")).toBe("url(/mingcute-px/brain.svg)");
  expect(iconUrl("mc:battery_2")).toBeNull();
  expect(iconUrl("🔥")).toBeNull();
  expect(hasIcon("mc:brain")).toBe(true);
  expect(hasIcon("mc:battery_2")).toBe(false);
  expect(hasIcon(undefined)).toBe(false);
});
