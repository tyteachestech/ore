import { describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { snapshot } from "../src/history.ts";
import { addSnippet } from "../src/ingest/index.ts";
import { mergeNotes, notesPath, setNotes } from "../src/notes.ts";
import { findItem } from "../src/items.ts";
import { tempLibrary } from "./helpers.ts";

const log = (root: string) => Bun.spawnSync(["git", "log", "--oneline"], { cwd: root }).stdout.toString().trim().split("\n").filter(Boolean);

describe("library history (D5)", () => {
  test("snapshots at most every ten minutes, unless forced", async () => {
    const lib = await tempLibrary();
    const now = Date.now();
    expect(snapshot(lib, { now }).committed).toBe(true);
    writeFileSync(join(lib.root, "skills.yaml"), readFileSync(join(lib.root, "skills.yaml"), "utf8") + "\n# edit\n");
    expect(snapshot(lib, { now: now + 60_000 }).committed).toBe(false);
    expect(snapshot(lib, { force: true }).committed).toBe(true);
    expect(snapshot(lib, { force: true }).committed).toBe(false); // nothing changed
    expect(log(lib.root)).toHaveLength(2);
  });
});

describe("source note saves never drop outside changes", () => {
  test("mergeNotes keeps his edit and an appended recall", () => {
    const base = "## Main idea\n\nSpacing works.\n";
    const mine = "## Main idea\n\nSpacing works because forgetting helps.\n";
    const theirs = base + "\n## Recall\n\nRetrieval beats restudy.\n";
    expect(mergeNotes(mine, base, theirs)).toBe("## Main idea\n\nSpacing works because forgetting helps.\n\n## Recall\n\nRetrieval beats restudy.\n");
  });

  test("his edit to the last line and an append right after it merge without a copy", () => {
    const base = "My first line.";
    const theirs = "My first line.\n\n## Agent\n\nAgent wrote this.";
    expect(mergeNotes("My first line. And more.", base, theirs)).toBe("My first line. And more.\n\n## Agent\n\nAgent wrote this.");
    expect(mergeNotes("Intro\n\nMy first line.", base, theirs)).toBe("Intro\n\nMy first line.\n\n## Agent\n\nAgent wrote this.");
  });

  test("both changed the same line: both versions stay, his first", () => {
    expect(mergeNotes("a\nmine\nc", "a\nb\nc", "a\ntheirs\nc")).toBe("a\nmine\ntheirs\nc");
  });

  test("setNotes with a stale base merges instead of overwriting", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: "Some source text." });
    const id = item.meta.id;
    await setNotes(lib, id, "One.\n");
    writeFileSync(notesPath(findItem(lib, id)), "One.\n\n## Recall\n\nFrom /ore.\n"); // an agent appends
    const r = await setNotes(lib, id, "One, edited.\n", "One.\n");
    expect(r.merged).toBe(true);
    expect(r.text).toBe("One, edited.\n\n## Recall\n\nFrom /ore.\n");
    expect(readFileSync(notesPath(findItem(lib, id)), "utf8")).toBe(r.text);
    const plain = await setNotes(lib, id, "Fresh.", r.text);
    expect(plain).toMatchObject({ merged: false, text: "Fresh." });
  });
});

test("history skips a half-written change without delaying the next complete snapshot", async () => {
  const { withLock } = await import("../src/lock.ts");
  const { paths } = await import("../src/library.ts");
  const lib = await tempLibrary();
  snapshot(lib, { force: true });
  const marker = join(lib.root, ".ore", "last-snapshot");
  const before = readFileSync(marker, "utf8");
  await withLock(paths.lock(lib), () => {
    writeFileSync(join(lib.root, "first.txt"), "half");
    expect(snapshot(lib, { force: true }).committed).toBe(false);
    expect(log(lib.root)).toHaveLength(1);
    expect(readFileSync(marker, "utf8")).toBe(before);
    writeFileSync(join(lib.root, "second.txt"), "complete");
  });
  expect(snapshot(lib, { force: true }).committed).toBe(true);
  expect(log(lib.root)).toHaveLength(2);
});

// History recovery pass (coverage queue 9): git states an agent's restore can leave, and what a snapshot does there.
describe("library history after a restore (D5)", () => {
  const git = (root: string, ...args: string[]) => Bun.spawnSync(["git", "-c", "user.name=T", "-c", "user.email=t@t", ...args], { cwd: root, stdout: "pipe", stderr: "pipe" });
  const note = (root: string, text: string) => writeFileSync(join(root, "note.md"), text);

  test("a restore left in conflict is never committed: history waits, and doctor says why", async () => {
    const { doctor } = await import("../src/doctor.ts");
    const lib = await tempLibrary();
    note(lib.root, "base\n");
    snapshot(lib, { force: true });
    git(lib.root, "checkout", "-q", "-b", "other");
    note(lib.root, "other\n");
    git(lib.root, "commit", "-qam", "other");
    git(lib.root, "checkout", "-q", "-");
    note(lib.root, "mine\n");
    snapshot(lib, { force: true });
    git(lib.root, "merge", "other");
    expect(git(lib.root, "ls-files", "-u").stdout.toString()).not.toBe("");
    const head = git(lib.root, "rev-parse", "HEAD").stdout.toString();
    expect(snapshot(lib, { force: true }).committed).toBe(false);
    expect(git(lib.root, "rev-parse", "HEAD").stdout.toString()).toBe(head);
    expect(git(lib.root, "ls-files", "-u").stdout.toString()).not.toBe(""); // his conflict is left for him to settle
    expect((await doctor(lib)).issues.map((i) => i.message).join("\n")).toContain("library history is paused");
  });

  test("checked out at an old snapshot, history waits instead of committing where no branch holds it", async () => {
    const lib = await tempLibrary();
    note(lib.root, "old\n");
    snapshot(lib, { force: true });
    const old = git(lib.root, "rev-parse", "HEAD").stdout.toString().trim();
    note(lib.root, "new\n");
    snapshot(lib, { force: true });
    git(lib.root, "checkout", "-q", old);
    note(lib.root, "made while detached\n");
    const all = () => git(lib.root, "rev-list", "--all", "--count").stdout.toString().trim();
    const before = all();
    expect(snapshot(lib, { force: true }).committed).toBe(false);
    expect(git(lib.root, "rev-list", "HEAD@{0}", "-n1").stdout.toString().trim()).toBe(old);
    expect(all()).toBe(before);
  });

  test("a second snapshot while one is running leaves the first one's staged files alone", async () => {
    const { tryWithLock } = await import("../src/lock.ts");
    const lib = await tempLibrary();
    snapshot(lib, { force: true });
    note(lib.root, "half\n");
    const nested = tryWithLock(join(lib.root, ".ore", "snapshot.lock"), () => snapshot(lib, { force: true }));
    expect(nested).toEqual({ committed: false });
    expect(git(lib.root, "diff", "--cached", "--quiet").exitCode).toBe(0); // nothing staged by the second one
  });

  test("session end with no git on PATH still answers with its receipt: history never fails a command", async () => {
    const lib = await tempLibrary();
    const cli = join(import.meta.dir, "../../cli/src/ore.ts");
    const env = { ...process.env, ORE_LIBRARY: lib.root, ORE_NO_ENRICH: "1" };
    expect(Bun.spawnSync([process.execPath, cli, "session", "start", "--json"], { env }).exitCode).toBe(0);
    const end = Bun.spawnSync([process.execPath, cli, "session", "end", "--json"], { env: { ...env, PATH: "/nonexistent" }, stdout: "pipe", stderr: "pipe" });
    expect(end.stderr.toString()).toBe("");
    expect(end.exitCode).toBe(0);
  });
});
