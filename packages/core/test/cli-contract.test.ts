// What an agent relies on when it drives `ore` (Codex sweep 3, cli): a command that fails changes nothing
// and exits non-zero, `--json` stays JSON, and what doctor suggests clears what it found.
import { describe, expect, test } from "bun:test";
import { appendFileSync, chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { findCard, writeNewCard } from "../src/cards.ts";
import { doctor } from "../src/doctor.ts";
import { addText } from "../src/ingest/index.ts";
import { findItem, listItems } from "../src/items.ts";
import { paths } from "../src/library.ts";
import { readReviews } from "../src/reviews.ts";
import { tempLibrary } from "./helpers.ts";

const CLI = join(import.meta.dir, "../../cli/src/ore.ts");

async function ore(root: string, args: string[], opts: { stdin?: string; env?: Record<string, string> } = {}) {
  const p = Bun.spawn(["bun", CLI, ...args], { env: { ...process.env, ORE_LIBRARY: root, ORE_NO_ENRICH: "1", ...opts.env }, stdin: opts.stdin === undefined ? "ignore" : new Blob([opts.stdin]), stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
  return { out, err, code };
}

describe("the CLI as an agent drives it", () => {
  test("an edit with an unknown skill changes nothing, not even the title before it", async () => {
    const lib = await tempLibrary();
    const item = await addText(lib, "# Spacing\n\nSpaced practice beats massed practice.");
    const r = await ore(lib.root, ["edit", item.meta.id, "--title", "Changed", "--author", "Someone", "--skills", "missing", "--json"]);
    expect(r.code).not.toBe(0);
    const after = findItem(lib, item.meta.id).meta;
    expect(after.title).toBe(item.meta.title);
    expect(after.author).toBeUndefined();
  });

  test("add --for a question that isn't there adds nothing", async () => {
    const lib = await tempLibrary();
    const r = await ore(lib.root, ["add", "--stdin", "--for", "missing", "--no-enrich", "--json"], { stdin: "# Interleaving\n\nMixing problem types helps." });
    expect(r.code).not.toBe(0);
    expect(listItems(lib)).toHaveLength(0);
  });

  test("add and inbox --add refuse a skill that doesn't exist, as edit does", async () => {
    const lib = await tempLibrary();
    const add = await ore(lib.root, ["add", "--stdin", "--skill", "missing", "--no-enrich", "--json"], { stdin: "# Retrieval\n\nTesting yourself helps." });
    expect(add.code).not.toBe(0);
    expect(JSON.parse(add.out).error).toContain('unknown skill "missing"');
    expect(listItems(lib)).toHaveLength(0);
    const inbox = await ore(lib.root, ["inbox", "--add", "https://example.com/a", "--skill", "missing", "--json"]);
    expect(inbox.code).not.toBe(0);
    // A new library has Learning.
    expect((await ore(lib.root, ["add", "--stdin", "--skill", "learning", "--no-enrich", "--json"], { stdin: "# Retrieval\n\nTesting yourself helps." })).code).toBe(0);
  });

  test("an inbox import where every link fails exits non-zero and keeps them", async () => {
    const lib = await tempLibrary();
    const server = Bun.serve({ port: 0, fetch: () => new Response("gone", { status: 404 }) });
    try {
      // The link check wants a dot in the host, so the local server goes by 127.0.0.1.
      expect((await ore(lib.root, ["inbox", "--add", `http://127.0.0.1:${server.port}/missing`])).code).toBe(0);
      const r = await ore(lib.root, ["inbox", "--import", "--json"]);
      expect(r.code).not.toBe(0);
      expect(JSON.parse(r.out).failed).toHaveLength(1);
      expect(JSON.parse((await ore(lib.root, ["inbox", "--json"])).out)).toHaveLength(1);
    } finally {
      server.stop(true);
    }
  });

  test("card edit with an editor that fails exits non-zero, and --json stays JSON", async () => {
    const lib = await tempLibrary();
    const item = await addText(lib, "# Spacing\n\nSpaced practice beats massed practice.");
    const card = writeNewCard(lib, { kind: "card", item: item.meta.id, skills: [], topics: [], content_type: "fact", question: "Q?", answer: "A", rubric: [] });
    const editor = join(lib.root, "failed-editor");
    writeFileSync(editor, "#!/bin/sh\necho 'Editor failed to open'\nexit 7\n");
    chmodSync(editor, 0o755);
    const r = await ore(lib.root, ["card", "edit", card.meta.id, "--json"], { env: { VISUAL: editor, EDITOR: editor } });
    expect(r.code).not.toBe(0);
    expect(() => JSON.parse(r.out)).not.toThrow();
    expect(JSON.parse(r.out).error).toContain("editor");
  });

  test("an AI rating without its stamp is refused before anything is logged (D21)", async () => {
    const lib = await tempLibrary();
    const item = await addText(lib, "# Spacing\n\nSpaced practice beats massed practice.");
    const card = writeNewCard(lib, { kind: "card", item: item.meta.id, skills: [], topics: [], content_type: "fact", question: "Q?", answer: "A", rubric: [] });
    const r = await ore(lib.root, ["review", card.meta.id, "--rating", "3", "--confidence", "2", "--ai-rating", "2", "--json"]);
    expect(r.code).not.toBe(0);
    expect(JSON.parse(r.out).error).toContain("--ai-by");
    expect(readReviews(lib)).toHaveLength(0);
  });

  test("a feed that isn't there points at a command that works", async () => {
    const lib = await tempLibrary();
    const r = await ore(lib.root, ["feed", "set", "missing", "--name", "x", "--json"]);
    expect(r.code).not.toBe(0);
    const hint = JSON.parse(r.out).error.match(/`?ore (feed[^`;.]*)`?/)?.[1]?.trim().split(/\s+/) ?? [];
    expect(hint.length).toBeGreaterThan(0);
    expect((await ore(lib.root, [...hint, "--json"])).code).toBe(0);
  });

  // F-new-edit-drops-history: Review shows what `card set` answers, so it carries what `card show --review`
  // does, or an edit drops the history dots and "next in …" until the exercise is reopened.
  test("an exercise edited in review keeps its history: card set and card show answer as card show --review does", async () => {
    const lib = await tempLibrary();
    const item = await addText(lib, "# Spacing\n\nSpaced practice beats massed practice.");
    const card = writeNewCard(lib, { kind: "card", item: item.meta.id, skills: [], topics: [], content_type: "fact", question: "Q?", answer: "A", rubric: [] });
    expect((await ore(lib.root, ["review", card.meta.id, "--rating", "3", "--confidence", "3", "--json"])).code).toBe(0);
    const shown = JSON.parse((await ore(lib.root, ["card", "show", card.meta.id, "--review", "--json"])).out);
    expect(shown.history.reviews).toHaveLength(1);
    const saved = JSON.parse((await ore(lib.root, ["card", "set", card.meta.id, "--question", "New Q?", "--json"])).out);
    expect(saved.question).toBe("New Q?");
    // `next` is counted from now, so it moves a few milliseconds between the two runs.
    const past = (h: { reviews: unknown; gem: unknown; next: object }) => ({ reviews: h.reviews, gem: h.gem, next: Object.keys(h.next) });
    expect(past(saved.history)).toEqual(past(shown.history));
    expect(saved.in_head_ok).toBe(shown.in_head_ok);
    // F-new-exercise-markdown: and the source's folder, where the images its text names are.
    expect(saved.source_dir).toBe(findItem(lib, item.meta.id).dir);
    expect(shown.source_dir).toBe(findItem(lib, item.meta.id).dir);
    // Bad version shows the original by a plain `card show`: the same shape.
    const original = JSON.parse((await ore(lib.root, ["card", "show", card.meta.id, "--json"])).out);
    expect(past(original.history)).toEqual(past(shown.history));
    expect(original.in_head_ok).toBe(shown.in_head_ok);
  });

  // F-new-card-show-reads-doc (review of #440): every card show and card set read the source's whole doc.md (a book
  // runs to megabytes) only to learn its folder.
  test("card show names the source's folder without reading its doc.md", async () => {
    const lib = await tempLibrary();
    const item = await addText(lib, "# Spacing\n\nSpaced practice beats massed practice.");
    const card = writeNewCard(lib, { kind: "card", item: item.meta.id, skills: [], topics: [], content_type: "fact", question: "Q?", answer: "A", rubric: [] });
    chmodSync(item.docPath, 0o000);
    try {
      const shown = JSON.parse((await ore(lib.root, ["card", "show", card.meta.id, "--json"])).out);
      expect(shown.source_dir).toBe(item.dir);
    } finally {
      chmodSync(item.docPath, 0o644);
    }
  });
});

describe("doctor", () => {
  test("a session or variant line that parses but isn't a record is reported", async () => {
    const lib = await tempLibrary();
    const item = await addText(lib, "# Spacing\n\nSpaced practice beats massed practice.");
    const card = writeNewCard(lib, { kind: "card", item: item.meta.id, skills: [], topics: [], content_type: "fact", question: "Q?", answer: "A", rubric: [] });
    mkdirSync(paths.sessions(lib), { recursive: true });
    writeFileSync(join(paths.sessions(lib), "2026-11.corruption.jsonl"), JSON.stringify({ id: "bad", event: "start", ts: "yesterday" }) + "\n");
    appendFileSync(paths.variants(lib, card.meta.id), JSON.stringify({ id: "bad", card: "no-card", question: "", answer: "" }) + "\n");
    const r = await doctor(lib);
    expect(r.issues.some((i) => i.path.includes("corruption.jsonl"))).toBe(true);
    expect(r.issues.some((i) => i.path.endsWith(".variants.jsonl"))).toBe(true);
  });

  test("retiring a card whose source is gone, as doctor suggests, clears the error", async () => {
    const lib = await tempLibrary();
    const item = await addText(lib, "# Spacing\n\nSpaced practice beats massed practice.");
    const card = writeNewCard(lib, { kind: "card", item: item.meta.id, skills: [], topics: [], content_type: "fact", question: "Q?", answer: "A", rubric: [] });
    const path = findCard(lib, card.meta.id).path;
    const rel = relative(lib.root, path);
    writeFileSync(path, readFileSync(path, "utf8").replace(`item: ${item.meta.id}`, "item: 01MISSINGSOURCE0000000000"));
    expect((await doctor(lib)).issues.some((i) => i.path === rel && i.level === "error")).toBe(true);
    expect((await ore(lib.root, ["card", "retire", card.meta.id, "--json"])).code).toBe(0);
    expect((await doctor(lib)).issues.filter((i) => i.path === rel)).toEqual([]);
  });
});
