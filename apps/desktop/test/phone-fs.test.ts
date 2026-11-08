// The in-memory node:fs the core runs on inside the iPhone app (D78). The core's file habits (atomic
// writes by rename, append-only logs, listing a source's revisions, the lock opened exclusively) all
// go through it, and a shim slip breaks the phone and nothing else, so each habit is checked here.
import { afterEach, describe, expect, test } from "bun:test";
import fs from "../src/phone/fs";

const ROOT = "/lib";
afterEach(() => fs.rmSync(ROOT, { recursive: true, force: true }));

describe("phone fs stand-in", () => {
  test("a write makes its folders; a read of what isn't there says ENOENT", () => {
    fs.writeFileSync(`${ROOT}/items/01A/doc.md`, "# Hi");
    expect(fs.existsSync(`${ROOT}/items`)).toBe(true);
    expect(fs.existsSync(`${ROOT}/items/01A`)).toBe(true);
    expect(fs.readFileSync(`${ROOT}/items/01A/doc.md`, "utf8")).toBe("# Hi");
    expect(fs.statSync(`${ROOT}/items`).isDirectory()).toBe(true);
    expect(fs.statSync(`${ROOT}/items/01A/doc.md`).isFile()).toBe(true);
    expect(() => fs.readFileSync(`${ROOT}/nope`)).toThrow(/ENOENT/);
    expect(() => fs.statSync(`${ROOT}/nope`)).toThrow(/ENOENT/);
    expect(() => fs.readdirSync(`${ROOT}/nope`)).toThrow(/ENOENT/);
  });

  test("an atomic write (temp file, then rename over the file) leaves one file with the new text", () => {
    fs.writeFileSync(`${ROOT}/skills.yaml`, "old");
    fs.writeFileSync(`${ROOT}/.skills.yaml.tmp`, "new");
    fs.renameSync(`${ROOT}/.skills.yaml.tmp`, `${ROOT}/skills.yaml`);
    expect(fs.readFileSync(`${ROOT}/skills.yaml`)).toBe("new");
    expect(fs.existsSync(`${ROOT}/.skills.yaml.tmp`)).toBe(false);
    expect(fs.readdirSync(ROOT)).toEqual(["skills.yaml"]);
  });

  test("a log appends in order, and its last byte can be read to see whether it ends in a newline", () => {
    const log = `${ROOT}/reviews.jsonl`;
    fs.appendFileSync(log, '{"a":1}\n');
    fs.appendFileSync(log, '{"b":2}');
    expect(fs.readFileSync(log)).toBe('{"a":1}\n{"b":2}');
    const fd = fs.openSync(log, "r");
    const buf = new Uint8Array(1);
    expect(fs.readSync(fd, buf, 0, 1, fs.statSync(log).size - 1)).toBe(1);
    expect(String.fromCharCode(buf[0]!)).toBe("}");
    fs.closeSync(fd);
    expect(() => fs.openSync(`${ROOT}/none.jsonl`, "r")).toThrow(/ENOENT/);
  });

  test("listing a folder gives files and subfolders once each, sorted, with their kinds", () => {
    fs.writeFileSync(`${ROOT}/items/01B/doc.md`, "b");
    fs.writeFileSync(`${ROOT}/items/01A/doc.md`, "a");
    fs.writeFileSync(`${ROOT}/items/01A/notes.md`, "n");
    fs.writeFileSync(`${ROOT}/items/01A/annotations/x.json`, "{}");
    fs.mkdirSync(`${ROOT}/items/empty`);
    expect(fs.readdirSync(`${ROOT}/items`)).toEqual(["01A", "01B", "empty"]);
    const kinds = fs.readdirSync(`${ROOT}/items/01A`, { withFileTypes: true }).map((d: { name: string; isDirectory: () => boolean }) => [d.name, d.isDirectory()]);
    expect(kinds).toEqual([["annotations", true], ["doc.md", false], ["notes.md", false]]);
    expect(fs.readdirSync(`${ROOT}/items/empty`)).toEqual([]);
  });

  test("removing a folder takes its files and subfolders; unlinking a missing file says so", () => {
    fs.writeFileSync(`${ROOT}/items/01A/doc.md`, "a");
    fs.writeFileSync(`${ROOT}/items/01A/annotations/x.json`, "{}");
    fs.writeFileSync(`${ROOT}/items/01AB/doc.md`, "b"); // a sibling whose name starts the same way stays
    fs.rmSync(`${ROOT}/items/01A`, { recursive: true, force: true });
    expect(fs.existsSync(`${ROOT}/items/01A`)).toBe(false);
    expect(fs.existsSync(`${ROOT}/items/01A/annotations`)).toBe(false);
    expect(fs.readdirSync(`${ROOT}/items`)).toEqual(["01AB"]);
    expect(() => fs.unlinkSync(`${ROOT}/items/01A/doc.md`)).toThrow(/ENOENT/);
    fs.rmSync(`${ROOT}/items/gone`, { force: true }); // force: a missing path is nothing to do
  });

  test("the lock: opened exclusively, a second open fails with EEXIST until it is unlinked", () => {
    const lock = `${ROOT}/.ore/lock`;
    const fd = fs.openSync(lock, "wx");
    expect(() => fs.openSync(lock, "wx")).toThrow(/EEXIST/);
    fs.closeSync(fd);
    fs.unlinkSync(lock);
    fs.closeSync(fs.openSync(lock, "wx"));
  });

  test("a file's time is the write's, moves with utimes, and a copy keeps the text", () => {
    const p = `${ROOT}/items/01A/doc.md`;
    fs.writeFileSync(p, "a");
    expect(fs.statSync(p).mtimeMs).toBeGreaterThan(Date.now() - 5000);
    fs.utimesSync(p, 0, new Date(1_700_000_000_000));
    expect(fs.statSync(p).mtimeMs).toBe(1_700_000_000_000);
    expect(fs.readFileSync(p)).toBe("a");
    fs.copyFileSync(p, `${ROOT}/items/01A/copy.md`);
    expect(fs.readFileSync(`${ROOT}/items/01A/copy.md`)).toBe("a");
    expect(() => fs.utimesSync(`${ROOT}/none`, 0, 0)).toThrow(/ENOENT/);
  });
});
