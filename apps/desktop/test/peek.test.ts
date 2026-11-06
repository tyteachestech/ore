import { expect, test } from "bun:test";
import { firstLines } from "../src/Peek";

test("a peek shows the first lines as plain text, without Markdown marks, images or frontmatter", () => {
  expect(firstLines("---\nid: x\n---\n# Heading\n\n![pic](a.png)\n- **Bold** point with [a link](ore:item/1)\n> quoted `code`")).toBe("Heading Bold point with a link quoted code");
  expect(firstLines("# Agents\n\nAgents are loops.", 280, "Agents")).toBe("Agents are loops.");
  expect(firstLines("word ".repeat(100), 20)).toBe("word word word word…");
});
