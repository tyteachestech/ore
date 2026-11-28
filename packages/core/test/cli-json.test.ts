import { expect, test } from "bun:test";
import { readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { addHighlight, findAnnotation } from "../src/annotations.ts";
import { writeNewCard } from "../src/cards.ts";
import { createItem, findItem, updateItemMeta } from "../src/items.ts";
import type { Library } from "../src/library.ts";
import { loadSkills } from "../src/skills.ts";
import { tempLibrary } from "./helpers.ts";

async function ore(lib: Library, args: string[]) {
  const child = Bun.spawn(["bun", join(import.meta.dir, "../../cli/src/ore.ts"), ...args, "--json"], {
    env: { ...process.env, ORE_LIBRARY: lib.root, ORE_NO_ENRICH: "1", ORE_AI: "", ORE_AI_MODEL: "" },
    stdin: "ignore", stdout: "pipe", stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  return { code, data: JSON.parse(stdout), stderr };
}

// Compare saved library bytes, not the disposable index or automatic history snapshots.
function saved(lib: Library): Record<string, string> {
  const files: Record<string, string> = {};
  function walk(dir: string, prefix = "") {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!prefix && [".git", ".ore", ".index"].includes(entry.name)) continue;
      const rel = join(prefix, entry.name), path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path, rel);
      else files[rel] = readFileSync(path).toString("base64");
    }
  }
  walk(lib.root);
  return files;
}

test("annotate validates every flag before moving a passage (JSON-04)", async () => {
  const lib = await tempLibrary();
  const item = await createItem(lib, { type: "markdown", title: "Learning", body: "Recall improves memory.\n\nSpacing practice helps retention." });
  const a = addHighlight(item, { exact: "Recall improves memory.", intent: "card" });
  for (const flag of ["--status", "--intent"]) {
    const before = saved(lib);
    const result = await ore(lib, ["annotate", a.id, "--exact", "Spacing practice helps retention.", flag, "invalid"]);
    expect(result.code).toBe(1);
    expect(result.data.error).toContain(flag);
    expect(saved(lib)).toEqual(before);
  }
  const result = await ore(lib, ["annotate", a.id, "--exact", "Spacing practice helps retention.", "--status", "done", "--note", "Keep practicing"]);
  expect(result.code).toBe(0);
  expect(findAnnotation(lib, a.id).annotation).toMatchObject({ exact: "Spacing practice helps retention.", status: "done", note: "Keep practicing" });
});

test("course set refuses invalid filing before renaming any lesson (JSON-05)", async () => {
  const lib = await tempLibrary();
  for (const part of [1, 2]) {
    const item = await createItem(lib, { type: "markdown", title: `Lesson ${part}`, body: "Recall improves memory.", skills: ["learning"] });
    await updateItemMeta(lib, item.meta.id, (m) => ({ ...m, course: { id: "course-test", title: "Original course", part } }));
  }
  const before = saved(lib);
  const result = await ore(lib, ["course", "set", "course-test", "--title", "Changed", "--skills", "missing"]);
  expect(result.code).toBe(1);
  expect(result.data.error).toContain('unknown skill "missing"');
  expect(saved(lib)).toEqual(before);
  expect((await ore(lib, ["course", "set", "course-test", "--title", "Changed", "--skills", "learning"])).code).toBe(0);
});

test("edit validates card map syntax, shape and skills before saving metadata (JSON-06)", async () => {
  const lib = await tempLibrary();
  const item = await createItem(lib, { type: "markdown", title: "Learning", body: "Recall helps.", skills: ["learning"] });
  const card = writeNewCard(lib, { kind: "card", item: item.meta.id, skills: ["learning"], topics: [], content_type: "fact", question: "What helps?", answer: "Recall", rubric: [] });
  const before = saved(lib);
  for (const cards of ["{", "null", "[]", JSON.stringify({ [card.meta.id]: "learning" }), JSON.stringify({ [card.meta.id]: ["missing"] }), JSON.stringify({ [card.meta.id]: [""] })]) {
    const result = await ore(lib, ["edit", item.meta.id, "--title", "Changed", "--author", "Someone", "--priority", "P1", "--skills", "learning", "--cards", cards]);
    expect(result.code).toBe(1);
    expect(saved(lib)).toEqual(before);
    expect(result.data.error).toMatch(/--cards|unknown skill/);
  }
  const result = await ore(lib, ["edit", item.meta.id, "--title", "Changed", "--skills", "learning", "--cards", JSON.stringify({ [card.meta.id]: [] })]);
  expect(result.code).toBe(0);
  expect(result.data.cards_before).toEqual({ [card.meta.id]: ["learning"] });
  expect(findItem(lib, item.meta.id).meta.title).toBe("Changed");
});

test("settings validates a model before changing the library AI vendor (JSON-07)", async () => {
  const lib = await tempLibrary();
  const before = saved(lib);
  const result = await ore(lib, ["settings", "--ai", "codex", "--model", "bad model name"]);
  expect(result.code).toBe(1);
  expect(result.data.error).toContain("isn’t a model name");
  expect(saved(lib)).toEqual(before);
  const valid = await ore(lib, ["settings", "--ai", "codex", "--model", " gpt-test "]);
  expect(valid.code).toBe(0);
  expect(loadSkills(lib)).toMatchObject({ ai: "codex", models: { codex: "gpt-test" } });
  expect((await ore(lib, ["settings", "--model", ""])).code).toBe(0);
  expect(loadSkills(lib).models?.codex).toBeUndefined();
});

test("cards --item resolves the same source references as show (JSON-08)", async () => {
  const lib = await tempLibrary();
  const item = await createItem(lib, { type: "markdown", title: "Learning", body: "Recall helps." });
  const card = writeNewCard(lib, { kind: "card", item: item.meta.id, skills: [], topics: [], content_type: "fact", question: "What helps?", answer: "Recall", rubric: [] });
  for (const ref of [item.meta.id, item.meta.id.slice(0, 12).toLowerCase(), item.meta.id.slice(-12).toLowerCase()]) {
    expect((await ore(lib, ["show", ref])).data.id).toBe(item.meta.id);
    const result = await ore(lib, ["cards", "--item", ref]);
    expect(result.code).toBe(0);
    expect(result.data.map((c: { id: string }) => c.id)).toEqual([card.meta.id]);
  }
  const empty = await createItem(lib, { type: "markdown", title: "No exercises", body: "More to learn." });
  expect((await ore(lib, ["cards", "--item", empty.meta.id])).data).toEqual([]);
  const missing = await ore(lib, ["cards", "--item", "missing"]);
  expect(missing.code).toBe(1);
  expect(missing.data.error).toContain("no item matches");
  const ambiguous = await ore(lib, ["cards", "--item", item.meta.id.slice(0, 2)]);
  expect(ambiguous.code).toBe(1);
  expect(ambiguous.data.error).toContain("use more of the id");
  // A source whose folder is gone: doctor says to find its exercises and retire them, so its full id still lists them.
  rmSync(item.dir, { recursive: true, force: true });
  expect((await ore(lib, ["cards", "--item", item.meta.id])).data.map((c: { id: string }) => c.id)).toEqual([card.meta.id]);
});

test("try mutations return the same source title and section as tries (JSON-09)", async () => {
  const lib = await tempLibrary();
  const added = await ore(lib, ["try", "--skill", "learning", "--plan", "Recall one idea"]);
  expect(added.code).toBe(0);
  const check = async (args: string[]) => {
    const result = await ore(lib, args);
    expect(result.code).toBe(0);
    const listed = (await ore(lib, ["tries"])).data.find((t: { id: string }) => t.id === result.data.id);
    expect(typeof result.data.item_title).toBe("string");
    expect(result.data.item_title).toBe(listed.item_title);
    expect(result.data.section).toBe(listed.section);
  };
  expect(added.data.item_title).toBe(findItem(lib, added.data.item).meta.title);
  await check(["try", added.data.id, "--when", "After coffee"]);
  await check(["tried", added.data.id]);
  await check(["tried", added.data.id, "--undo"]);
  const item = await createItem(lib, { type: "markdown", title: "Practice", body: "# Retrieval\n\nRecall strengthens memory." });
  const a = addHighlight(item, { exact: "Recall strengthens memory.", intent: "apply" });
  await check(["try", a.id, "--plan", "Try recall"]);
  await check(["tried", a.id]);
});

test("edit --cards without --skills is refused, not saved as nothing", async () => {
  const lib = await tempLibrary();
  const item = await createItem(lib, { type: "markdown", title: "Learning", body: "Recall helps." });
  const r = await ore(lib, ["edit", item.meta.id, "--title", "Renamed", "--cards", "{}"]);
  expect(r.code).toBe(1);
  expect(r.data.error).toContain("--cards goes with --skills");
  expect(findItem(lib, item.meta.id).meta.title).toBe("Learning");
});
