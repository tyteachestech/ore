import { expect, test } from "bun:test";
import { numbers, ordered, renumber } from "../scripts/ids.ts";

const findings = "| F1 | x |\n| F2 | x |\n| F-new-tab-focus | a |\n| F-new-drop-undo | b |\n| F-new-x | c |\n";
const decisions = "- D1. a\n- D7. b\n- D-new-home-list. c\n";

test("ids: placeholders take the next free numbers in the order their rows appear", () => {
  const map = numbers(findings, decisions);
  expect(Object.fromEntries(map)).toEqual({ "F-new-tab-focus": "F3", "F-new-drop-undo": "F4", "F-new-x": "F5", "D-new-home-list": "D8" });
  expect(renumber("guard `F-new-drop-undo` (D-new-home-list), F-new-tab-focus, F-new-x.", map)).toBe("guard `F4` (D8), F3, F5.");
});

test("ids: a placeholder with no row is refused", () => {
  expect(() => renumber("see F-new-missing", numbers(findings, decisions))).toThrow(/no row/);
});

test("ids: rows a merge left above master's newer ones go back in number order, the rest of the file untouched", () => {
  expect(ordered("intro F9\n\n| ID |\n| F1 | a |\n| F4 | mine |\n| F2 | b |\n| F3 | c |\n\nend\n")).toBe("intro F9\n\n| ID |\n| F1 | a |\n| F2 | b |\n| F3 | c |\n| F4 | mine |\n\nend\n");
});

test("ids: a file not yet added to git is renumbered too (the #408 slip: a new test reached master with its placeholder)", () => {
  const { mkdtempSync, mkdirSync, writeFileSync, readFileSync } = require("node:fs") as typeof import("node:fs");
  const { execFileSync } = require("node:child_process") as typeof import("node:child_process");
  const { join } = require("node:path") as typeof import("node:path");
  const dir = mkdtempSync(join(require("node:os").tmpdir(), "ore-ids-"));
  const git = (...a: string[]) => execFileSync("git", a, { cwd: dir, stdio: "pipe" });
  mkdirSync(join(dir, "docs/reviews"), { recursive: true });
  writeFileSync(join(dir, "docs/reviews/findings.md"), "| ID |\n|---|\n| F1 | a |\n| F-new-thing | b |\n");
  writeFileSync(join(dir, "docs/DECISIONS.md"), "- D1. one\n- D-new-choice. two\n");
  git("init", "-q");
  git("add", "-A");
  writeFileSync(join(dir, "fresh.test.ts"), "// F-new-thing, D-new-choice\n"); // written on the branch, never added
  execFileSync("bun", [join(import.meta.dir, "../scripts/ids.ts")], { cwd: dir, stdio: "pipe" });
  expect(readFileSync(join(dir, "fresh.test.ts"), "utf8")).toBe("// F2, D2\n");
});

test("ids --check: any placeholder left on master fails and names its file, so no branch inherits one (#408, #410)", () => {
  const { mkdtempSync, mkdirSync, writeFileSync } = require("node:fs") as typeof import("node:fs");
  const { execFileSync, spawnSync } = require("node:child_process") as typeof import("node:child_process");
  const { join } = require("node:path") as typeof import("node:path");
  const dir = mkdtempSync(join(require("node:os").tmpdir(), "ore-ids-"));
  mkdirSync(join(dir, "docs/reviews"), { recursive: true });
  writeFileSync(join(dir, "docs/reviews/findings.md"), "| ID |\n|---|\n| F1 | a |\n");
  writeFileSync(join(dir, "docs/DECISIONS.md"), "- D1. one\n");
  writeFileSync(join(dir, "sfx.ts"), "// sounds (D1)\n");
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["add", "-A"], { cwd: dir });
  const check = () => spawnSync("bun", [join(import.meta.dir, "../scripts/ids.ts"), "--check"], { cwd: dir, encoding: "utf8" });
  expect(check().status).toBe(0);
  writeFileSync(join(dir, "sfx.ts"), "// sounds (D-new-review-sounds)\n");
  execFileSync("git", ["add", "-A"], { cwd: dir });
  const r = check();
  expect(r.status).toBe(1);
  expect(r.stderr).toContain("sfx.ts");
  expect(r.stderr).toContain("D-new-review-sounds");
});
