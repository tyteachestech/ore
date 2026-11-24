import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// On iPhone the core runs in the web view, where `require` is the stand-in in src/phone/core.ts: a module
// the core loads on first use with `require("…")` and the stand-in doesn't answer throws there, and the
// feature that needs it (Linked from, for mdast-util-from-markdown) is gone on the phone.
test("the phone's require answers every module the core loads on first use (F609)", () => {
  const repo = join(import.meta.dir, "../../..");
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : /\.(ts|tsx|mts)$/.test(e.name) ? [join(dir, e.name)] : []));
  const wanted = new Set(["packages/core/src", "packages/cli/src"].flatMap((d) => files(join(repo, d))).flatMap((f) => [...readFileSync(f, "utf8").matchAll(/\brequire\((["'`])([^"'`]+)\1\)/g)].map((m) => m[2]!)));
  const shim = readFileSync(join(import.meta.dir, "../src/phone/core.ts"), "utf8");
  const answered = new Set([...shim.matchAll(/m === (["'`])([^"'`]+)\1/g)].map((m) => m[2]!));
  expect([...wanted].filter((m) => !answered.has(m))).toEqual([]);
});

// The same for hashes: the phone's `node:crypto` (src/phone/node.ts) is real only for the kinds it implements, so
// a core hash of another kind throws there (an Undo of a rating, whose line id was sha1, failed on the phone).
test("the phone's createHash makes every kind of hash the core asks for (F595)", async () => {
  const repo = join(import.meta.dir, "../../..");
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : /\.(ts|tsx|mts)$/.test(e.name) ? [join(dir, e.name)] : []));
  const kinds = new Set(["packages/core/src", "packages/cli/src"].flatMap((d) => files(join(repo, d))).flatMap((f) => [...readFileSync(f, "utf8").matchAll(/\bcreateHash\((["'`])([^"'`]+)\1\)/g)].map((m) => m[2]!)));
  const { createHash } = await import("../src/phone/node.ts");
  const broken = [...kinds].filter((k) => {
    try {
      createHash(k).update("x").digest("hex");
      return false;
    } catch {
      return true;
    }
  });
  expect(broken).toEqual([]);
});
