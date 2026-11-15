// The Codex sweep runner and its Mac load guard (retro 2026-11-15: five testers at once froze Tyler's Mac).
import { describe, expect, test } from "bun:test";
import { freePercent, isClaude, isTylers, refusal, testers, toStop, type Proc } from "../scripts/mac-load";
import { alone, copyLibrary, fill, next, pickPorts, seedLabel, type Tester } from "../scripts/sweep";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const proc = (pid: number, ppid: number, command: string, cwd?: string, pgid = pid): Proc => ({ pid, ppid, pgid, command, cwd });

describe("mac load", () => {
  test("reads free memory from memory_pressure", () => {
    expect(freePercent("The system has 38654705664 (2359296 pages with a page size of 16384).\nSystem-wide memory free percentage: 80%\n")).toBe(80);
    expect(freePercent("garbage")).toBeNull();
  });

  test("a Codex wrapper and the binary it starts count as one tester", () => {
    const ps = [
      proc(10, 1, "node /usr/local/bin/codex exec -m gpt-6-astra prompt"),
      proc(11, 10, "/x/codex-darwin-arm64/vendor/aarch64-apple-darwin/codex/codex exec -m gpt-6-astra prompt"),
      proc(12, 1, "/x/codex-darwin-arm64/vendor/aarch64-apple-darwin/codex/codex exec other"),
      proc(13, 11, "node codex-out/notes/session.cjs"),
      proc(14, 1, "grep codex exec"),
    ];
    expect(testers(ps)).toBe(2);
  });

  test("refuses on tight memory, two testers, or a run that must go alone", () => {
    expect(refusal(24, 0)).toContain("24%");
    expect(refusal(null, 0)).toContain("Couldn't read");
    expect(refusal(80, 2)).toContain("at most 2");
    expect(refusal(80, 1)).toBeNull();
    expect(refusal(80, 1, true)).toContain("alone");
    expect(refusal(80, 0, true)).toBeNull();
  });

  test("clean stops what a worktree started, never itself, its shells, a Claude session or a sibling folder", () => {
    const dir = "/u/Developer/ore-wt/sweep4";
    const ps = [
      proc(1, 0, "launchd"),
      proc(100, 1, "/bin/zsh", "/u"),
      proc(101, 100, `bun ${dir}/../retro/apps/desktop/scripts/mac-load.ts clean ${dir}`, dir, 101),
      proc(200, 1, "bunx vite --port 1763", `${dir}/apps/desktop`),
      proc(201, 1, `bun ${dir}/codex-out/serve.ts`, "/u"),
      proc(202, 1, "claude --resume", dir),
      proc(203, 1, "bun serve.ts", `${dir}2`),
      proc(204, 101, `sh -c pgrep -f ${dir}`, dir, 101),
      proc(205, 1, `bun ${dir}-retry/codex-out/serve.ts`, "/u"),
      proc(206, 1, `codex exec -C ${dir} "read CLAUDE.md first"`, dir),
    ];
    expect(toStop(ps, dir, 101).sort()).toEqual([200, 201, 206]);
    expect(toStop(ps, dir, 101, false).sort()).toEqual([200, 201, 204, 206]);
    expect(isTylers("/u/Developer/ore", "/u")).toBe(true);
    expect(isTylers("/u/Ore/items", "/u")).toBe(true);
    expect(isTylers("/u/Developer/ore/apps", "/u")).toBe(true);
    expect(isTylers("/u/Developer", "/u")).toBe(true);
    expect(isTylers("/u", "/u")).toBe(true);
    expect(isTylers("/u/Developer/ore-wt/sweep4", "/u")).toBe(false);
    expect(isTylers("/u/Developer/ore-wt", "/u")).toBe(false);
  });
});

test("a Claude session is known by its program, not by words in its arguments", () => {
  expect(isClaude("/Users/t/Library/Application Support/Claude/claude-code/2.1/x/claude.app/Contents/MacOS/claude --output-format stream-json")).toBe(true);
  expect(isClaude("claude --resume")).toBe(true);
  expect(isClaude("/Applications/Claude.app/Contents/MacOS/Claude")).toBe(true);
  expect(isClaude("/bin/zsh -c source /Users/t/.claude/shell-snapshots/snapshot-zsh-1.sh && bun test")).toBe(true);
  expect(isClaude("codex exec -C /u/Developer/ore-wt/claude-x read CLAUDE.md")).toBe(false);
});

describe("sweep runner", () => {
  test("ports skip the ones WebKit refuses and the ones in use", () => {
    expect(pickPorts(4, 1719, (p) => p !== 1722)).toEqual([1721, 1724, 1725, 1726]);
  });

  test("prompts get this run's ports and folders, and other braces stay", () => {
    expect(fill("page {{mac}}, bridge {{bridge}}, {{unknown}}, { a: 1 }", { mac: 1761, bridge: 1762 })).toBe("page 1761, bridge 1762, {{unknown}}, { a: 1 }");
  });

  test("two testers at most, and a big library alone", () => {
    const t = (name: string, extra: Partial<Tester> = {}): Tester => ({ name, seed: "seed", ...extra });
    const big = t("scale", { seed: "big", scale: 5 });
    expect(alone(big)).toBe(true);
    expect(alone(t("settings", { seed: "big" }))).toBe(false);
    expect(next([t("a"), t("b")], [])?.name).toBe("a");
    expect(next([t("c")], [t("a"), t("b")])).toBeUndefined();
    expect(next([big, t("b")], [t("a")])?.name).toBe("b");
    expect(next([big], [])?.name).toBe("scale");
    expect(next([t("b")], [big])).toBeUndefined();
  });
});

// Review of #442 (F360): `cp -R from lib` into a lib left by an earlier run made lib/<from's name>.
describe("a tester from a library folder (F360)", () => {
  test("its library is a copy of the folder, even where an earlier run left one", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ore-sweep-"));
    const from = join(dir, "old-ore");
    mkdirSync(from);
    writeFileSync(join(from, "skills.yaml"), "ai: claude\n");
    const lib = join(dir, "lib");
    await copyLibrary(from, lib);
    await copyLibrary(from, lib);
    expect(existsSync(join(lib, "skills.yaml"))).toBe(true);
    expect(existsSync(join(lib, "old-ore"))).toBe(false);
  });
  test("is said as its folder, with no seed or scale", () => {
    expect(seedLabel({ name: "old", seed: "seed", scale: 5, from: "libs/old" })).toBe("from libs/old");
    expect(seedLabel({ name: "big", seed: "big", scale: 5 })).toBe("seed big ×5");
  });
});
