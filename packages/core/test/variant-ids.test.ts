import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { writeNewCard } from "../src/cards.ts";
import { appendJsonl } from "../src/fsutil.ts";
import { createItem } from "../src/items.ts";
import { paths } from "../src/library.ts";
import { findVariant, rejectVariant, restoreVariant, setVariant } from "../src/remix.ts";
import { tempLibrary } from "./helpers.ts";

test("variant references resolve unique prefixes and suffixes and refuse ambiguity before writes (JSON-03)", async () => {
  for (const reverse of [false, true]) {
    const lib = await tempLibrary();
    const item = await createItem(lib, { type: "markdown", title: "Recall", body: "Recall strengthens memory." });
    const card = writeNewCard(lib, { kind: "prompt", item: item.meta.id, skills: [], topics: [], content_type: "concept", question: "Why recall?", answer: "It strengthens memory.", rubric: ["Recall strengthens memory."] });
    const ids = ["01J00000000000000000000001", "01K00000000000000000000001"];
    const path = paths.variants(lib, card.meta.id);
    for (const id of reverse ? [...ids].reverse() : ids) appendJsonl(path, {
      id, rev: 1, card: card.meta.id, type: "new-case", setting: id, question: "How can Mira practice?", answer: "Recall the melody.",
      rubric: ["Recall strengthens memory."], maps: [0], status: "ready", created: "2026-11-27T00:00:00.000Z", ai: { vendor: "claude", model: "fixture", prompt_version: "variant@1" },
    });
    const before = readFileSync(path, "utf8");
    for (const ref of ["00001", "01"]) {
      await expect(rejectVariant(lib, card.meta.id, ref)).rejects.toThrow(/ambiguous.*more of the id/i);
      await expect(restoreVariant(lib, card.meta.id, ref)).rejects.toThrow(/ambiguous/i);
      await expect(setVariant(lib, card.meta.id, ref, { question: "Changed?" })).rejects.toThrow(/ambiguous/i);
      expect(readFileSync(path, "utf8")).toBe(before);
    }
    expect(findVariant(lib, card.meta.id, "01k").id).toBe(ids[1]!);
    expect(findVariant(lib, card.meta.id, ids[0]!).id).toBe(ids[0]!);
    expect(findVariant(lib, card.meta.id, ids[1]!.slice(2)).id).toBe(ids[1]!);
    expect(() => findVariant(lib, card.meta.id, "missing")).toThrow("has no variant");
    expect((await rejectVariant(lib, card.meta.id, "01K")).status).toBe("rejected");
  }
});
