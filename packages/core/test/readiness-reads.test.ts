import { expect, test } from "bun:test";
import { addHighlight } from "../src/annotations.ts";
import { createItem } from "../src/items.ts";
import { setSkillLook } from "../src/skills.ts";
import { tempLibrary } from "./helpers.ts";
import { readProbe } from "./helpers/read-probe.ts";

test("trying now reads each source and its highlights once across skills, keeping one shared active try", async () => {
  const lib = await tempLibrary();
  const item = await createItem(lib, { type: "snippet", title: "Shared", body: "Try this.", skills: ["ai", "learning"] });
  const tryIt = addHighlight(item, { exact: "Try this.", intent: "apply" });
  const probe = readProbe(lib, `
    const { tryingNow } = await import(core + "tries.ts");
    active = true;
    const result = tryingNow(lib);
  `);
  expect(probe.result.map((t: { id: string }) => t.id)).toEqual([tryIt.id]);
  expect(probe.reads.filter((p) => p.endsWith("/doc.md"))).toHaveLength(1);
  expect(probe.reads.filter((p) => /annotations.*\.jsonl$/.test(p))).toHaveLength(1);
});

test("dig readiness shares one source read across eligible skills", async () => {
  const lib = await tempLibrary();
  const item = await createItem(lib, { type: "snippet", title: "Shared", body: "First idea. Second idea.", skills: ["ai", "learning"] });
  for (const exact of ["First idea.", "Second idea."]) addHighlight(item, { exact, intent: "card" });
  for (const skill of ["ai", "learning"]) await setSkillLook(lib, skill, { goal: "Explain it" });
  const probe = readProbe(lib, `
    const { digReady } = await import(core + "digs.ts");
    active = true;
    const result = digReady(lib);
  `);
  expect(probe.result).toMatchObject({ ready: true, ideas: 2 });
  expect(probe.reads.filter((p) => p.endsWith("/doc.md"))).toHaveLength(1);
});

test("dig readiness reads no source text when no skill has a goal", async () => {
  const lib = await tempLibrary();
  await createItem(lib, { type: "snippet", title: "Unused", body: "An idea.", skills: ["ai"] });
  const probe = readProbe(lib, `
    const { digReady } = await import(core + "digs.ts");
    active = true;
    const result = digReady(lib);
  `);
  expect(probe.result).toBeNull();
  expect(probe.reads.filter((p) => p.endsWith("/doc.md"))).toHaveLength(0);
});

test("trying now keeps the containing source's skill membership for hand-edited annotation references", async () => {
  const { annotationsPath } = await import("../src/annotations.ts");
  const { appendJsonl, deviceLog } = await import("../src/fsutil.ts");
  const { listTries, tryingNow } = await import("../src/tries.ts");
  const lib = await tempLibrary();
  const item = await createItem(lib, { type: "snippet", title: "Shared", body: "Try this.", skills: ["ai"] });
  const tried = addHighlight(item, { exact: "Try this.", intent: "apply" });
  appendJsonl(deviceLog(annotationsPath(item.dir)), { ...tried, item: "older-source-id", rev: 2 });
  const expected = listTries(lib, { skill: "ai" }).filter((t) => t.active);
  expect(expected).toHaveLength(1);
  expect(tryingNow(lib)).toEqual(expected);
});
