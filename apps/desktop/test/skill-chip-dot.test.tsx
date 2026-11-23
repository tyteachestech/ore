import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SkillChip } from "../src/Skills";

// F540: a skill with no icon drew nothing before its name on a source's row, so the name ran on from the
// author ("Ana Ruiz Self-Regulation & Motivation"). The sidebar, the filter and Home's skill rows draw its dot.
test("a skill with no icon shows its dot on a source's row, as in the sidebar", () => {
  expect(renderToStaticMarkup(<SkillChip skill={{ id: "focus", name: "Focus", color: "green" }} />)).toContain("skill-icon dot");
  expect(renderToStaticMarkup(<SkillChip skill={{ id: "old", name: "Old", icon: "mc:battery_2" }} />)).toContain("skill-icon dot");
  expect(renderToStaticMarkup(<SkillChip skill={{ id: "ai", name: "AI", icon: "mc:brain" }} />)).toContain("skill-icon glyph");
});
