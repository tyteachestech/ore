import { expect, test } from "bun:test";
import fs from "../src/phone/fs";

test("listing one phone directory never inspects unrelated paths", () => {
  const root = "/perf-directory";
  try {
    fs.writeFileSync(`${root}/target/note.md`, "mine");
    fs.mkdirSync(`${root}/target/empty`);
    for (let i = 0; i < 20; i++) fs.writeFileSync(`${root}/unrelated-${i}/doc.md`, "other");
    const startsWith = String.prototype.startsWith;
    let unrelated = 0;
    String.prototype.startsWith = function (...args: Parameters<typeof startsWith>) {
      if (startsWith.call(String(this), `${root}/unrelated-`)) unrelated++;
      return startsWith.apply(String(this), args);
    };
    let entries: string[];
    try { entries = fs.readdirSync(`${root}/target`); }
    finally { String.prototype.startsWith = startsWith; }
    expect(entries).toEqual(["empty", "note.md"]);
    expect(unrelated).toBe(0);
  } finally { fs.rmSync(root, { recursive: true }); }
});

test("phone directory listings track atomic replacement, copies, removal and recreation", () => {
  const root = "/perf-directory-mutations";
  try {
    fs.writeFileSync(`${root}/a/doc.md`, "old");
    fs.writeFileSync(`${root}/a/.tmp`, "new");
    fs.renameSync(`${root}/a/.tmp`, `${root}/a/doc.md`);
    fs.copyFileSync(`${root}/a/doc.md`, `${root}/b/copy.md`);
    expect(fs.readdirSync(root)).toEqual(["a", "b"]);
    expect(fs.readdirSync(`${root}/a`)).toEqual(["doc.md"]);
    fs.unlinkSync(`${root}/a/doc.md`);
    expect(fs.readdirSync(`${root}/a`)).toEqual([]);
    fs.rmSync(`${root}/b`, { recursive: true });
    expect(fs.readdirSync(root)).toEqual(["a"]);
    fs.mkdirSync(`${root}/b/nested`);
    fs.writeFileSync(`${root}/b/new.md`, "fresh");
    expect(fs.readdirSync(`${root}/b`, { withFileTypes: true }).map((e: { name: string; isDirectory(): boolean }) => [e.name, e.isDirectory()])).toEqual([["nested", true], ["new.md", false]]);
  } finally { fs.rmSync(root, { recursive: true }); }
});
