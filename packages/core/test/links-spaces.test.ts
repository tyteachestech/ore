import { expect, test } from "bun:test";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { backlinks, brokenLinks, renderedLinks } from "../src/links";
import { setNotes } from "../src/notes";
import { parseSkillsFile } from "../src/skills";
import { tempLibrary } from "./helpers";

for (const id of ["A B", "学习 笔记", " A  B "]) {
  test(`rendered links retain the supported spaced skill ID ${JSON.stringify(id)}`, () => {
    expect(parseSkillsFile({ skills: [{ id, name: "Space skill", priority: "P2" }] }).file.skills[0]?.id).toBe(id);
    const markdown = `[Space skill](<ore:skill/${id}>)\n\n[Reference][s]\n\n[s]: <ore:skill/${id}>\n\n\`[Code](<ore:skill/${id}>)\`\n`;
    expect(renderedLinks(markdown)).toEqual([
      { text: "Space skill", target: { kind: "skill", id }, line: 0 },
      { text: "Reference", target: { kind: "skill", id }, line: 2 },
    ]);
  });
}

test("backlinks and broken links resolve hand-written spaced skill IDs without rewriting them", async () => {
  const lib = await tempLibrary();
  try {
    writeFileSync(join(lib.root, "skills.yaml"), 'skills:\n  - {id: "A B", name: "Space skill", priority: P2}\n  - {id: writer, name: Writer, priority: P2}\n');
    await setNotes(lib, { skill: "writer" }, "[Space skill](<ore:skill/A B>)\n");
    expect(backlinks(lib, { kind: "skill", id: "A B" }).map((link) => link.from.id)).toEqual(["writer"]);
    expect(brokenLinks(lib)).toEqual([]);
    await setNotes(lib, { skill: "writer" }, "[Missing skill](<ore:skill/Not here>)\n");
    expect(brokenLinks(lib).map((link) => link.target)).toEqual([{ kind: "skill", id: "Not here" }]);
  } finally {
    rmSync(lib.root, { recursive: true, force: true });
  }
});
