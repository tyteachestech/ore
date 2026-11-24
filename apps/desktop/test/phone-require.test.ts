import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// On iPhone the core runs in the web view, where `require` is the stand-in in src/phone/core.ts: a module
// the core loads on first use with `require("…")` and the stand-in doesn't answer throws there, and the
// feature that needs it (Linked from, for mdast-util-from-markdown) is gone on the phone.
test("the phone's require answers every module the core loads on first use (F-new-links-rendered-only)", () => {
  const repo = join(import.meta.dir, "../../..");
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : /\.(ts|tsx|mts)$/.test(e.name) ? [join(dir, e.name)] : []));
  const wanted = new Set(["packages/core/src", "packages/cli/src"].flatMap((d) => files(join(repo, d))).flatMap((f) => [...readFileSync(f, "utf8").matchAll(/\brequire\((["'`])([^"'`]+)\1\)/g)].map((m) => m[2]!)));
  const shim = readFileSync(join(import.meta.dir, "../src/phone/core.ts"), "utf8");
  const answered = new Set([...shim.matchAll(/m === (["'`])([^"'`]+)\1/g)].map((m) => m[2]!));
  expect([...wanted].filter((m) => !answered.has(m))).toEqual([]);
});
