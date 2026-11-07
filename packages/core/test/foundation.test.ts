import { describe, expect, test } from "bun:test";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isUlid, slugify, ulid } from "../src/ids.ts";
import { parseFrontmatter, stringifyFrontmatter } from "../src/frontmatter.ts";
import { appendJsonl, latestRevs, readJsonl, subdirs, visible, writeAtomic } from "../src/fsutil.ts";
import { withLock } from "../src/lock.ts";
import { addSkill, loadSkills, desiredRetention, setSkillLook } from "../src/skills.ts";
import { createItem, listItems, renameItem } from "../src/items.ts";
import { listCards, parseCardBody, renderCardBody, writeNewCard } from "../src/cards.ts";
import { doctor } from "../src/doctor.ts";
import { readReviews } from "../src/reviews.ts";
import { addHighlight, readAnnotations } from "../src/annotations.ts";
import { readSessions } from "../src/sessions.ts";
import { tempLibrary } from "./helpers.ts";

describe("ids", () => {
  test("ulid is 26 chars, valid and monotonic within a millisecond", () => {
    const a = ulid(1000), b = ulid(1000), c = ulid(2000);
    expect(isUlid(a)).toBe(true);
    expect(a < b && b < c).toBe(true);
  });
  test("slugify", () => {
    expect(slugify("Building Effective Agents — Anthropic!")).toBe("building-effective-agents-anthropic");
    expect(slugify("x".repeat(100)).length).toBe(60);
    expect(slugify("???")).toBe("untitled");
  });
});

describe("frontmatter round-trip", () => {
  test("data and body survive parse → stringify → parse byte-exact", () => {
    const data = {
      id: ulid(), type: "article", title: 'Quotes: "x" and colons: y', url: "https://a.b/c?d=1#e",
      skills: ["ai", "learning"], topics: [], prequestions: [{ q: "Why does X matter?" }],
      ai: { vendor: "claude", model: "m", prompt_version: "enrich@1" },
    };
    const body = "\n# Heading\n\nPara with --- inside\n---\nnot frontmatter\n\ntrailing\n";
    const text = stringifyFrontmatter(data, body);
    const parsed = parseFrontmatter(text);
    expect(parsed.data).toEqual(data);
    expect(parsed.body).toBe(body);
    expect(stringifyFrontmatter(parsed.data, parsed.body)).toBe(text);
  });
  test("a card reads back as written, or the write says why it can't", () => {
    const c = { question: "Which is it?\nA --- B", answer: "Use this.\n\n## Why\nBecause.", rubric: ["one", "two"] };
    expect(parseCardBody(renderCardBody(c))).toEqual(c);
    expect(() => renderCardBody({ ...c, question: "Which?\n---\nA or B" })).toThrow("line of just “---”");
    expect(() => renderCardBody({ ...c, answer: "A\n## Rubric\nB" })).toThrow("“## Rubric” line");
  });
  test("no frontmatter → whole text is body", () => {
    expect(parseFrontmatter("hello\n")).toEqual({ data: {}, body: "hello\n" });
  });
  test("undefined values are dropped, empty body allowed", () => {
    const t = stringifyFrontmatter({ a: 1, b: undefined }, "");
    expect(parseFrontmatter(t)).toEqual({ data: { a: 1 }, body: "" });
  });
});

describe("jsonl and atomic writes", () => {
  test("append, read, latest rev wins", async () => {
    const lib = await tempLibrary();
    const p = join(lib.root, "x.jsonl");
    appendJsonl(p, { id: "a", rev: 1, v: "old" });
    appendJsonl(p, { id: "b", rev: 1, v: "b" });
    appendJsonl(p, { id: "a", rev: 2, v: "new" });
    const latest = latestRevs(readJsonl<{ id: string; rev: number; v: string }>(p));
    expect(latest.find((r) => r.id === "a")!.v).toBe("new");
    expect(latest).toHaveLength(2);
    writeAtomic(join(lib.root, "d/e.txt"), "hi");
    expect(readFileSync(join(lib.root, "d/e.txt"), "utf8")).toBe("hi");
  });
});

describe("lock", () => {
  test("serializes holders and releases", async () => {
    const lib = await tempLibrary();
    const lockPath = join(lib.root, ".ore", "lock");
    const order: string[] = [];
    await Promise.all([
      withLock(lockPath, async () => { order.push("a1"); await Bun.sleep(30); order.push("a2"); }),
      withLock(lockPath, async () => { order.push("b1"); order.push("b2"); }),
    ]);
    expect([order.slice(0, 2), order.slice(2)].every(([x, y]) => x![0] === y![0])).toBe(true);
    expect(existsSync(lockPath)).toBe(false);
  });

  test("a stale lock is taken over by one process at a time", async () => {
    const lib = await tempLibrary();
    const lockPath = join(lib.root, ".ore", "lock");
    const log = join(lib.root, "holders.log");
    writeFileSync(lockPath, "2147483646"); // a pid no process has
    const start = Date.now() + 800; // every process tries at once
    const script = `import { appendFileSync } from "node:fs"; import { withLock } from ${JSON.stringify(join(import.meta.dir, "../src/lock.ts"))};
      while (Date.now() < ${start});
      await withLock(${JSON.stringify(lockPath)}, async () => { appendFileSync(${JSON.stringify(log)}, "in\\n"); await Bun.sleep(40); appendFileSync(${JSON.stringify(log)}, "out\\n"); });`;
    const file = join(lib.root, "hold.ts");
    writeFileSync(file, script);
    const procs = Array.from({ length: 8 }, () => Bun.spawn(["bun", file], { stdout: "ignore", stderr: "inherit" }));
    expect(await Promise.all(procs.map((p) => p.exited))).toEqual(Array(8).fill(0));
    expect(readFileSync(log, "utf8")).toBe("in\nout\n".repeat(8));
    expect(existsSync(lockPath)).toBe(false);
  });

  test("doctor names an empty lock left by a crash", async () => {
    const lib = await tempLibrary();
    const lockPath = join(lib.root, ".ore", "lock");
    writeFileSync(lockPath, "");
    utimesSync(lockPath, new Date(Date.now() - 120_000), new Date(Date.now() - 120_000));
    expect((await doctor(lib)).issues.some((i) => i.message.startsWith("stale lock"))).toBe(true);
    expect((await doctor(lib, { fix: true })).fixed).toContain(".ore/lock: removed stale lock");
    expect(existsSync(lockPath)).toBe(false);
  });
});

describe("init", () => {
  test("creates skeleton with 9 skills, AGENTS.md, CLAUDE.md link, git", async () => {
    const lib = await tempLibrary();
    for (const f of ["AGENTS.md", "CLAUDE.md", "skills.yaml", ".gitignore", ".git", "items", "cards", "reviews", "inbox", "topics"]) {
      expect(existsSync(join(lib.root, f))).toBe(true);
    }
    const s = loadSkills(lib).skills;
    expect(s).toHaveLength(9);
    expect(desiredRetention(["habits", "ai"], s)).toBe(0.92);
    expect(desiredRetention(["habits"], s)).toBe(0.8);
  });
});

describe("skill look", () => {
  test("sets and clears icon, color and collection in skills.yaml, keeping comments", async () => {
    const lib = await tempLibrary();
    const set = await setSkillLook(lib, "teaching", { icon: "🎓", color: "blue", collection: "Ty Teaches Tech" });
    expect(set).toMatchObject({ id: "teaching", icon: "🎓", color: "blue", collection: "Ty Teaches Tech", priority: "P1" });
    expect(loadSkills(lib).skills.find((s) => s.id === "teaching")).toEqual(set);
    const cleared = await setSkillLook(lib, "teaching", { color: "", collection: " " });
    expect(cleared).toEqual({ id: "teaching", name: "Teaching", priority: "P1", hook: "Explaining ideas so they land", icon: "🎓" });
    expect(readFileSync(join(lib.root, "skills.yaml"), "utf8")).toContain("# Skills (D25)");
    await expect(setSkillLook(lib, "teaching", { color: "mauve" })).rejects.toThrow("color must be one of");
    await expect(setSkillLook(lib, "teaching", { icon: "ffdasdf" })).rejects.toThrow("icon must be");
    await expect(setSkillLook(lib, "teaching", { icon: "🎓🎓" })).rejects.toThrow("icon must be");
    await expect(setSkillLook(lib, "teaching", { icon: "mc:../book" })).rejects.toThrow("icon must be");
    for (const icon of ["👋🏽", "🇯🇵", "#️⃣", "👩‍💻", "mc:book_2_ai", "mc:IDcard", "ph:book-open"]) expect((await setSkillLook(lib, "teaching", { icon })).icon).toBe(icon);
    await expect(setSkillLook(lib, "nope", { icon: "x" })).rejects.toThrow('unknown skill "nope"');
  });

  test("renames a skill and keeps its ID; refuses a blank name or another skill's name", async () => {
    const lib = await tempLibrary();
    expect(await setSkillLook(lib, "teaching", { name: "  Teaching   Kids " })).toMatchObject({ id: "teaching", name: "Teaching Kids" });
    expect(loadSkills(lib).skills.find((s) => s.id === "teaching")?.name).toBe("Teaching Kids");
    expect((await setSkillLook(lib, "teaching", { name: "teaching kids" })).name).toBe("teaching kids");
    await expect(setSkillLook(lib, "teaching", { name: " " })).rejects.toThrow("a skill needs a name");
    await expect(setSkillLook(lib, "teaching", { name: "habits" })).rejects.toThrow('skill "Habits" already exists');
  });
});

describe("add skill", () => {
  test("appends a named skill at P2 in a collection, and refuses a duplicate or a blank name", async () => {
    const lib = await tempLibrary();
    const s = await addSkill(lib, "  Public   Speaking ", "Ty Teaches Tech");
    expect(s).toEqual({ id: "public-speaking", name: "Public Speaking", priority: "P2", collection: "Ty Teaches Tech" });
    expect(loadSkills(lib).skills.at(-1)).toEqual(s);
    expect(readFileSync(join(lib.root, "skills.yaml"), "utf8")).toContain("# Skills (D25)");
    expect(await addSkill(lib, "Chess")).toEqual({ id: "chess", name: "Chess", priority: "P2" });
    await expect(addSkill(lib, "public speaking")).rejects.toThrow('skill "Public Speaking" already exists');
    await expect(addSkill(lib, "Teaching")).rejects.toThrow("already exists");
    await expect(addSkill(lib, "   ")).rejects.toThrow("a skill needs a name");
  });

  test("names that slug alike are different skills: C# after C++, two in other scripts", async () => {
    const lib = await tempLibrary();
    expect((await addSkill(lib, "C++")).id).toBe("c");
    expect((await addSkill(lib, "C#")).id).toBe("c-2");
    const a = await addSkill(lib, "日本語");
    const b = await addSkill(lib, "Русский");
    expect([a.id, b.id]).toEqual(["日本語", "русский"]);
    expect((await addSkill(lib, "日本語 文法")).id).toBe("日本語-文法");
    expect((await addSkill(lib, "🎸")).id).toBe("untitled");
    expect(loadSkills(lib).skills.map((s) => s.name)).toContain("Русский");
  });

  test("a typo in skills.yaml says which file and where", async () => {
    const lib = await tempLibrary();
    writeFileSync(join(lib.root, "skills.yaml"), "skills:\n  - id: [oops\n");
    expect(() => loadSkills(lib)).toThrow(/skills\.yaml in your library has a typo: .*line \d+/);
  });
});

describe("a file that won't parse", () => {
  test("is left out of lists, not the whole list, and doctor names it", async () => {
    const lib = await tempLibrary();
    const good = await createItem(lib, { type: "markdown", title: "Good", body: "Good text.\n" });
    const bad = await createItem(lib, { type: "markdown", title: "Bad", body: "Bad text.\n" });
    writeFileSync(bad.docPath, "---\ntitle: [broken\n---\nBad text.\n");
    expect(listItems(lib).map((i) => i.meta.id)).toEqual([good.meta.id]);
    const card = writeNewCard(lib, { kind: "card", item: good.meta.id, question: "Q?", answer: "A.", rubric: [], skills: [], topics: [], content_type: "fact" });
    const other = writeNewCard(lib, { kind: "card", item: good.meta.id, question: "Q2?", answer: "A2.", rubric: [], skills: [], topics: [], content_type: "fact" });
    writeFileSync(other.path, "---\nid: [x\n---\nQ\n");
    expect(listCards(lib).map((c) => c.meta.id)).toEqual([card.meta.id]);
    const r = await doctor(lib);
    expect(r.issues.map((i) => i.path)).toEqual(expect.arrayContaining([expect.stringContaining(bad.meta.id), expect.stringContaining(other.meta.id)]));
  });

  test("doctor names the field a schema check failed on, not the first line of its JSON", async () => {
    const lib = await tempLibrary();
    const item = await createItem(lib, { type: "markdown", title: "Odd", body: "Text.\n" });
    writeFileSync(item.docPath, readFileSync(item.docPath, "utf8").replace("status: inbox", "status: bogus"));
    const messages = (await doctor(lib)).issues.map((i) => i.message);
    expect(messages).toContainEqual(expect.stringMatching(/^doc\.md frontmatter invalid: status: /));
    expect(messages.some((m) => m.endsWith("["))).toBe(false);
  });
});

describe("a log line that isn't a record", () => {
  test("(null, an array, an object with no card or time) is skipped; the rest still reads", async () => {
    const lib = await tempLibrary();
    const log = join(lib.root, "reviews", "2026-10.jsonl");
    writeFileSync(log, 'null\n[1,2]\n{"foo":1}\n{"ts":"2026-10-01T00:00:00.000Z","card":"C","undo":"x"}\n');
    expect(readReviews(lib)).toEqual([]);
    writeFileSync(join(lib.root, "sessions", "2026-10.jsonl"), 'null\n{"x":1}\n');
    expect(readSessions(lib)).toEqual([]);
    // A receipt in two device logs (a conflicted copy) counts once, the first copy read; the rest sort by time.
    const a = '{"type":"end","id":"S1","ts":"2026-10-02T00:00:00.000Z","caught_up":true}';
    writeFileSync(join(lib.root, "sessions", "2026-10.mac.jsonl"), `${a}\n{"type":"start","id":"S1","ts":"2026-10-01T00:00:00.000Z"}\n`);
    writeFileSync(join(lib.root, "sessions", "2026-10.phone.jsonl"), `${a.replace("true", "false")}\n`);
    expect(readSessions(lib).map((s) => `${s.type} ${s.id} ${s.caught_up ?? ""}`)).toEqual(["start S1 ", "end S1 true"]);
    const item = await createItem(lib, { type: "markdown", title: "S", body: "Some text here.\n" });
    const kept = addHighlight(item, { exact: "text", intent: "keep" });
    appendFileSync(join(item.dir, "annotations.jsonl"), 'null\n{"id":"X","rev":1}\n');
    expect(readAnnotations(item).map((a) => a.id)).toEqual([kept.id]);
  });
});

describe("folder listings", () => {
  test("come back in name order on every Mac and filesystem, so 'the first copy read' is the same everywhere", () => {
    const dir = mkdtempSync(join(tmpdir(), "ore-order-"));
    const names = Array.from({ length: 40 }, (_, i) => `2026-${String(i).padStart(2, "0")}.${["mac", "phone", "ipad"][i % 3]}.jsonl`);
    for (const n of [...names].reverse()) writeFileSync(join(dir, n), "");
    for (const n of ["b", "a", "c"]) mkdirSync(join(dir, n));
    expect(visible(dir)).toEqual([...names, "a", "b", "c"].sort());
    expect(subdirs(dir)).toEqual(["a", "b", "c"]);
  });
});

describe("source titles", () => {
  test("are one line, on add and on rename", async () => {
    const lib = await tempLibrary();
    const item = await createItem(lib, { type: "markdown", title: "Two\n  lines ", body: "Text.\n" });
    expect(item.meta.title).toBe("Two lines");
    expect((await renameItem(lib, item.meta.id, "New\r\nname")).title).toBe("New name");
  });
});

describe("index", () => {
  test("an outdated index is rebuilt in place, and many processes opening a new one at once all succeed", async () => {
    const lib = await tempLibrary();
    const { addSnippet } = await import("../src/ingest/index.ts");
    const { openIndex } = await import("../src/db.ts");
    const { Database } = await import("bun:sqlite");
    await addSnippet(lib, { text: "Retrieval practice strengthens memory." });
    openIndex(lib).close();
    const path = join(lib.root, ".index", "library.sqlite");
    const old = new Database(path);
    old.run("update meta set value = 'old' where key = 'schema'");
    old.close();
    const index = openIndex(lib);
    expect(index.search("retrieval").length).toBeGreaterThan(0);
    index.close();

    const { rmSync } = await import("node:fs");
    rmSync(join(lib.root, ".index"), { recursive: true });
    const cli = join(import.meta.dir, "../../cli/src/ore.ts");
    const runs = Array.from({ length: 8 }, () => Bun.spawn(["bun", cli, "search", "retrieval", "--json"], { env: { ...process.env, ORE_LIBRARY: lib.root }, stdout: "pipe", stderr: "pipe" }));
    const codes = await Promise.all(runs.map(async (p) => [await p.exited, await new Response(p.stderr).text()] as const));
    expect(codes.filter(([c]) => c !== 0)).toEqual([]);
  });

  test("opening a new index waits while another process holds it, instead of failing 'database is locked'", async () => {
    // Switching a new file to WAL doesn't wait on busy_timeout: on Tyler's Mac, 2 of 8 processes opening a
    // fresh index at once failed at that pragma. Here another connection holds the write lock for 300 ms.
    const lib = await tempLibrary();
    const { Database } = await import("bun:sqlite");
    const { rmSync } = await import("node:fs");
    rmSync(join(lib.root, ".index"), { recursive: true });
    mkdirSync(join(lib.root, ".index"));
    const held = new Database(join(lib.root, ".index", "library.sqlite"), { create: true });
    held.exec("create table held (x)");
    held.exec("begin immediate");
    const cli = join(import.meta.dir, "../../cli/src/ore.ts");
    const run = Bun.spawn(["bun", cli, "search", "retrieval", "--json"], { env: { ...process.env, ORE_LIBRARY: lib.root }, stdout: "pipe", stderr: "pipe" });
    await Bun.sleep(300);
    held.exec("commit");
    held.close();
    expect([await run.exited, await new Response(run.stderr).text()]).toEqual([0, ""]);
  });
});
