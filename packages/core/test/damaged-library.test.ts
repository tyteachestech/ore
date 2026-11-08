import { describe, expect, test } from "bun:test";
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, truncateSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { listCards, writeNewCard } from "../src/cards.ts";
import { openIndex, rebuildIndex } from "../src/db.ts";
import { doctor } from "../src/doctor.ts";
import { appendJsonl, readJsonl } from "../src/fsutil.ts";
import { addSnippet } from "../src/ingest/index.ts";
import { findItem, listItems } from "../src/items.ts";
import { openLibrary, paths } from "../src/library.ts";
import { readReviews } from "../src/reviews.ts";
import { loadParams } from "../src/scheduler.ts";
import { addSkill, loadSkills, matchSkill } from "../src/skills.ts";
import { tempLibrary } from "./helpers.ts";

// The library as a real Mac, iCloud and a text editor leave it (stress test 2026-11-08).
describe("a damaged library", () => {
  test("an append after a last line that lost its newline keeps both records", async () => {
    const lib = await tempLibrary();
    const f = join(lib.root, "reviews", "x.jsonl");
    appendJsonl(f, { a: 1 });
    truncateSync(f, readFileSync(f).length - 1);
    appendJsonl(f, { b: 2 });
    expect(readJsonl(f)).toEqual([{ a: 1 }, { b: 2 }]);
  });

  test("a review line out of range is skipped, not fatal", async () => {
    const lib = await tempLibrary();
    const state = { due: "2026-11-01T00:00:00.000Z", stability: 1, difficulty: 5, elapsed_days: 0, scheduled_days: 1, reps: 1, lapses: 0, state: 2 };
    const good = { ts: "2026-11-01T10:00:00.000Z", card: "C1", confidence: 2, rating: 3, state_before: state, state_after: state };
    const log = join(paths.reviews(lib), "2026-11.jsonl");
    mkdirSync(dirname(log), { recursive: true });
    const lines = [good, { ...good, ts: "2026-11-02T10:00:00.000Z", rating: 5 }, { ...good, ts: "2026-11-03T10:00:00.000Z", rating: 2.5 }, { ...good, ts: "2026-11-04T10:00:00.000Z", state_after: undefined }];
    writeFileSync(log, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
    expect(readReviews(lib).map((r) => r.ts)).toEqual([good.ts]);
    const report = await doctor(lib);
    expect(report.issues.filter((i) => i.message.includes("not a valid review")).length).toBe(3);
  });

  test("a damaged fsrs-params.json falls back to the default weights", async () => {
    const lib = await tempLibrary();
    writeFileSync(paths.fsrsParams(lib), '{"w":[0.2,1.2,');
    expect(loadParams(lib)).toBeUndefined();
    const report = await doctor(lib);
    expect(report.issues.some((i) => i.path === "fsrs-params.json")).toBe(true);
  });

  test("skills.yaml with one bad look value still loads, and doctor names it", async () => {
    const lib = await tempLibrary();
    const text = readFileSync(paths.skills(lib), "utf8").replace("priority: P1", "priority: high\n    color: violet");
    writeFileSync(paths.skills(lib), text);
    const ai = loadSkills(lib).skills[0]!;
    expect(ai.color).toBeUndefined();
    expect(ai.priority).toBe("P2");
    const report = await doctor(lib);
    expect(report.issues.filter((i) => i.path === "skills.yaml").map((i) => i.message).join("\n")).toContain('color "violet"');
  });

  test("skills.yaml that can't be read says which skill and what to do", async () => {
    const lib = await tempLibrary();
    writeFileSync(paths.skills(lib), readFileSync(paths.skills(lib), "utf8").replace("name: AI", "nam: AI"));
    expect(() => loadSkills(lib)).toThrow(/skill 1 \(id ai\) has no usable name\. Fix it in a text editor/);
    writeFileSync(paths.skills(lib), "");
    expect(() => loadSkills(lib)).toThrow(/skills\.yaml in your library is empty/);
  });

  test("a library missing only skills.yaml is not a missing library", async () => {
    const lib = await tempLibrary();
    await addSnippet(lib, { text: "Retrieval practice beats rereading." });
    renameSync(paths.skills(lib), join(lib.root, ".skills.yaml.icloud"));
    expect(() => openLibrary(lib.root)).toThrow(/skills\.yaml is missing from your library.*iCloud/);
    expect(() => openLibrary(join(lib.root, "nowhere"))).toThrow(/^no library at/);
  });

  test("a source folder renamed in Finder still opens", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: "Retrieval practice beats rereading." });
    renameSync(item.dir, join(dirname(item.dir), "My agents notes"));
    expect(findItem(lib, item.meta.id).meta.title).toBe(item.meta.title);
    expect((await doctor(lib)).issues.some((i) => i.message.includes(`rename it back to end in -${item.meta.id}`))).toBe(true);
  });

  test("a copied source folder or card file lists once, and search finds it once", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: "Retrieval practice beats rereading." });
    cpSync(item.dir, `${item.dir} 2`, { recursive: true });
    const card = writeNewCard(lib, { kind: "card", item: item.meta.id, skills: [], topics: [], content_type: "fact", question: "What beats rereading?", answer: "Retrieval practice.", rubric: [] });
    cpSync(card.path, card.path.replace(/\.md$/, " 2.md"));
    expect(listItems(lib).map((i) => i.meta.id)).toEqual([item.meta.id]);
    expect(listCards(lib).map((c) => c.meta.id)).toEqual([card.meta.id]);
    const index = openIndex(lib);
    try {
      expect(index.search("retrieval").filter((h) => h.kind === "item").length).toBe(1);
    } finally {
      index.close();
    }
    expect((await doctor(lib)).issues.some((i) => i.message.startsWith("a copy of"))).toBe(true);
  });

  test("a renamed folder deleted after a search leaves no hits behind", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: "Interleaving mixes problem types." });
    const moved = join(dirname(item.dir), "agents (old)");
    renameSync(item.dir, moved);
    openIndex(lib).close();
    rmSync(moved, { recursive: true });
    const index = openIndex(lib);
    try {
      expect(index.search("interleaving")).toEqual([]);
    } finally {
      index.close();
    }
  });

  test("reindexes run at once all succeed", async () => {
    const lib = await tempLibrary();
    await addSnippet(lib, { text: "Spacing beats massing." });
    openIndex(lib).close();
    const cli = join(import.meta.dir, "../../cli/src/ore.ts");
    const runs = Array.from({ length: 10 }, () => Bun.spawn(["bun", cli, "reindex", "--json"], { env: { ...process.env, ORE_LIBRARY: lib.root }, stdout: "ignore", stderr: "pipe" }));
    const codes = await Promise.all(runs.map((p) => p.exited));
    expect(codes.filter((c) => c !== 0)).toEqual([]);
    expect(rebuildIndex(lib).errors).toEqual([]);
  }, 30_000);

  test("a skill typed with an accent and pasted from a Mac file name is one skill", async () => {
    const lib = await tempLibrary();
    await addSkill(lib, "Café");
    await expect(addSkill(lib, "Café")).rejects.toThrow(/already exists/);
    expect(matchSkill(loadSkills(lib).skills, "CAFÉ")?.name).toBe("Café");
  });

  test("two skills with one id are a doctor error", async () => {
    const lib = await tempLibrary();
    appendFileSync(paths.skills(lib), "  - id: AI\n    name: AI again\n    priority: P2\n");
    expect((await doctor(lib)).issues.some((i) => i.message.includes('two skills have the id "ai"'))).toBe(true);
  });

  test("a stale .git/index.lock is reported, and --fix clears it", async () => {
    const lib = await tempLibrary();
    if (!existsSync(join(lib.root, ".git"))) return;
    const lock = join(lib.root, ".git", "index.lock");
    writeFileSync(lock, "");
    const old = (Date.now() - 5 * 60_000) / 1000;
    utimesSync(lock, old, old);
    expect((await doctor(lib)).issues.some((i) => i.message.includes("library history has stopped saving"))).toBe(true);
    await doctor(lib, { fix: true });
    expect(existsSync(lock)).toBe(false);
  });

  test("a cut-off session or variants log line is reported", async () => {
    const lib = await tempLibrary();
    mkdirSync(paths.sessions(lib), { recursive: true });
    writeFileSync(join(paths.sessions(lib), "2026-11.jsonl"), '{"id":"S1","ts":"2026-11-0');
    expect((await doctor(lib)).issues.some((i) => i.path.startsWith("sessions/") && i.message.includes("cut off"))).toBe(true);
  });

  test("doctor calls the renamed folder the copy, never the one Ore shows", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: "Retrieval practice beats rereading." });
    cpSync(item.dir, join(dirname(item.dir), "aaa renamed"), { recursive: true });
    const copy = (await doctor(lib)).issues.find((i) => i.message.startsWith("a copy of"));
    expect(copy?.path).toContain("aaa renamed");
  });

  test("a folder whose ore init was cut off before skills.yaml can be set up again", async () => {
    const lib = await tempLibrary();
    rmSync(paths.skills(lib));
    expect(() => openLibrary(lib.root)).toThrow(/^no library at/);
  });

  test("a damaged index is rebuilt by reindex", async () => {
    const lib = await tempLibrary();
    await addSnippet(lib, { text: "Spacing beats massing." });
    openIndex(lib).close();
    writeFileSync(paths.index(lib), "not a database at all, just junk bytes ".repeat(200));
    for (const f of [`${paths.index(lib)}-wal`, `${paths.index(lib)}-shm`]) rmSync(f, { force: true });
    expect(rebuildIndex(lib).errors).toEqual([]);
  });

  test("a review line from an older build without confidence still counts", async () => {
    const lib = await tempLibrary();
    const state = { due: "2026-11-01T00:00:00.000Z", stability: 1, difficulty: 5, elapsed_days: 0, scheduled_days: 1, reps: 1, lapses: 0, state: 2 };
    mkdirSync(paths.reviews(lib), { recursive: true });
    writeFileSync(join(paths.reviews(lib), "2026-11.jsonl"), JSON.stringify({ ts: "2026-11-01T10:00:00.000Z", card: "C1", rating: 3, state_before: state, state_after: state }) + "\n");
    expect(readReviews(lib).length).toBe(1);
  });
});
