import { expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { studyCommands } from "../../cli/src/cmd-study.ts";
import { findCard, writeNewCard } from "../src/cards.ts";
import { appendJsonl } from "../src/fsutil.ts";
import { addText } from "../src/ingest/index.ts";
import { paths } from "../src/library.ts";
import { findVariant } from "../src/remix.ts";
import { tempLibrary } from "./helpers.ts";

const original = { vendor: "claude", model: "first", prompt_version: "enrich@25" };
const rewrite = { vendor: "codex", model: "second", prompt_version: "chat@2" };

test("card set saves AI wording and attribution together, and restores an unstamped original", async () => {
  const lib = await tempLibrary();
  const env = process.env.ORE_LIBRARY;
  process.env.ORE_LIBRARY = lib.root;
  try {
    const item = await addText(lib, "Memory grows through retrieval.");
    for (const ai of [undefined, original]) {
      const c = writeNewCard(lib, { kind: "card", item: item.meta.id, skills: [], topics: [], content_type: "fact", question: "What helps?", answer: "Recall.", rubric: [], ai });
      await studyCommands.card!.run(["set", c.meta.id], { question: "What strengthens memory?", ai: JSON.stringify(rewrite) });
      expect(findCard(lib, c.meta.id).meta.ai).toEqual(rewrite);
      await studyCommands.card!.run(["set", c.meta.id], { question: c.question, ai: JSON.stringify(ai ?? null) });
      expect(findCard(lib, c.meta.id).meta).toEqual(c.meta);
      await studyCommands.card!.run(["set", c.meta.id], { answer: "Retrieval." });
      expect(findCard(lib, c.meta.id).meta.ai).toEqual(ai);
    }
  } finally {
    if (env === undefined) delete process.env.ORE_LIBRARY; else process.env.ORE_LIBRARY = env;
    rmSync(lib.root, { recursive: true, force: true });
  }
});

test("rewriting a variant saves and returns its own author without changing the original", async () => {
  const lib = await tempLibrary();
  const env = process.env.ORE_LIBRARY;
  process.env.ORE_LIBRARY = lib.root;
  try {
    const item = await addText(lib, "Memory grows through retrieval.");
    const c = writeNewCard(lib, { kind: "prompt", item: item.meta.id, skills: [], topics: [], content_type: "concept", question: "Why recall?", answer: "Effort.", rubric: ["Effort"], ai: original });
    appendJsonl(paths.variants(lib, c.meta.id), { id: "V1", card: c.meta.id, rev: 1, type: "new-case", setting: "School", question: "Why quiz?", answer: "Effort.", rubric: ["Effort"], maps: [0], ai: original, status: "ready", created: new Date().toISOString() });
    const result = await studyCommands.card!.run(["set", c.meta.id], { variant: "V1", question: "Why test yourself?", ai: JSON.stringify(rewrite) });
    expect(findVariant(lib, c.meta.id, "V1").ai).toEqual(rewrite);
    expect(result.data).toMatchObject({ ai: rewrite });
    expect(findCard(lib, c.meta.id).meta.ai).toEqual(original);
  } finally {
    if (env === undefined) delete process.env.ORE_LIBRARY; else process.env.ORE_LIBRARY = env;
    rmSync(lib.root, { recursive: true, force: true });
  }
});
