import { expect, test } from "bun:test";
import { join } from "node:path";
import { findCard, writeNewCard } from "../src/cards.ts";
import { addText } from "../src/ingest/index.ts";
import { findItem } from "../src/items.ts";
import { setItemSkills } from "../src/skills.ts";
import { tempLibrary } from "./helpers.ts";

for (const boundary of ["source", "first exercise"]) test(`retrying a filing interrupted after its ${boundary} moves every exercise`, async () => {
  const lib = await tempLibrary();
  const item = await addText(lib, "# Filing\n\nMemory matters.", { skills: ["learning"] });
  const cards = [0, 1].map(() => writeNewCard(lib, { kind: "card", item: item.meta.id, skills: ["learning", "ai"], topics: [], content_type: "concept", question: "What matters?", answer: "Memory.", rubric: [] }));
  const stop = boundary === "source" ? item.docPath : cards[0]!.path;
  const util = join(import.meta.dir, "../src/fsutil.ts");
  const code = `
    import { mock } from "bun:test";
    import * as util from ${JSON.stringify(util)};
    const write = util.writeAtomic;
    mock.module(${JSON.stringify(util)}, () => ({ ...util, writeAtomic(p,c) { write(p,c); if(p === ${JSON.stringify(stop)}) process.kill(process.pid, "SIGKILL"); } }));
    const { setItemSkills } = await import(${JSON.stringify(join(import.meta.dir, "../src/skills.ts"))});
    await setItemSkills(${JSON.stringify(lib)}, ${JSON.stringify(item.meta.id)}, ["habits"]);
  `;
  const result = Bun.spawnSync([process.execPath, "-e", code], { env: { ...process.env, ORE_NO_ENRICH: "1" } });
  expect(result.signalCode).toBe("SIGKILL");
  await setItemSkills(lib, item.meta.id, ["habits"]);
  expect(findItem(lib, item.meta.id).meta.skills).toEqual(["habits"]);
  for (const card of cards) expect(findCard(lib, card.meta.id).meta.skills).toEqual(["ai", "habits"]);
});
