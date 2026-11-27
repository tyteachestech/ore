import { expect, test } from "bun:test";
import { createItem, setItemArchived } from "../src/items";
import { tempLibrary } from "./helpers";
import { readProbe } from "./helpers/read-probe";

test("F294: targeted listing reads a changed archived row without reading unrelated sources", async () => {
  const lib = await tempLibrary();
  const a = await createItem(lib, { type: "snippet", title: "Archived source", body: "Its text." });
  const b = await createItem(lib, { type: "snippet", title: "Untouched source", body: "Other text." });
  await setItemArchived(lib, a.meta.id, true);
  const probe = readProbe(lib, `
    const { itemCommands } = await import(core + "../../cli/src/cmd-items.ts");
    active = true;
    const result = (await itemCommands.ls.run([], { ids: ${JSON.stringify(a.meta.id)} })).data;
  `);
  expect(probe.result.map((i: { id: string }) => i.id)).toEqual([a.meta.id]);
  expect(probe.result[0].archived_at).toBeTruthy();
  expect(probe.reads.filter((p) => p === b.docPath)).toHaveLength(0);
  expect(probe.reads.filter((p) => p === a.docPath)).toHaveLength(1);
});
