// Real updater pass and install hook; every subprocess, checkout and install is a scratch fake.
// This runs in a separate process so its child_process mock cannot affect other tests.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync as realSpawnSync } from "node:child_process";
import { mock } from "bun:test";

const shellSpawn = realSpawnSync;
const base = mkdtempSync(join(tmpdir(), "ore-update-retry-"));
process.on("exit", () => rmSync(base, { recursive: true, force: true }));
const cache = join(base, "cache"), bin = join(base, "bin");
mkdirSync(cache);
mkdirSync(bin);
mkdirSync(join(base, "repo"));
const mode = process.argv[2] ?? "transient-failure";
writeFileSync(join(base, "installed"), mode === "current" ? "new" : "old");
if (mode === "transient-failure") writeFileSync(join(base, "fail"), "1");
if (mode === "current") writeFileSync(join(cache, "app-built"), "new");
if (mode === "docs-only") writeFileSync(join(cache, "app-built"), "old");
const executable = (name: string, body: string) => writeFileSync(join(bin, name), "#!/bin/sh\n" + body, { mode: 0o755 });
executable("git", `case "$*" in
 'rev-parse --abbrev-ref HEAD') echo master;;
 'diff --name-only '*|'diff-tree '*) echo packages/core/src/queue.ts;;
 'rev-parse --show-toplevel') echo "$SHELL_CASE/repo";;
 'rev-parse HEAD'|'rev-parse --short HEAD') echo new;;
 *) exit 99;;
esac
`);
executable("bun", `if [ "$*" = 'install --frozen-lockfile' ]; then exit 0; fi
if [ "$*" != 'run app:install' ]; then exit 99; fi
echo attempt >> "$SHELL_CASE/attempts"
if [ -f "$SHELL_CASE/fail" ]; then echo 'transient build failure'; exit 1; fi
echo new > "$SHELL_CASE/installed"
`);
executable("lsappinfo", "exit 0\n"); // No running app: never quit or open anything.

// Redirect the cache and await the hook's otherwise detached subshell. Its build logic is unchanged.
const hook = readFileSync(".githooks/post-commit", "utf8")
  .replace('cache="$HOME/Library/Caches/ore"', `cache='${cache}'`)
  .replace(/2>&1 &\s*$/, "2>&1\n");
const hookPath = join(base, "post-commit");
writeFileSync(hookPath, hook);
let head = ["current", "docs-only", "missing-stamp"].includes(mode) ? "new" : "old";
let pulls = 0;
const runHook = (retry: boolean) => {
  const result = shellSpawn("/bin/sh", [hookPath], {
    cwd: base, encoding: "utf8", timeout: 5000,
    env: { ...process.env, PATH: `${bin}:/usr/bin:/bin`, SHELL_CASE: base, ORE_HOOK_RANGE: "old..new", ORE_INSTALL_RETRY: retry ? "1" : "" },
  });
  assert.equal(result.status, 0, `hook must end: ${result.stderr}`);
};
const ok = (out = "") => ({ status: 0, stdout: out, stderr: "" });
mock.module("node:child_process", () => ({
  spawnSync: (cmd: string, args: string[]) => {
    if (cmd === "ps") return ok();
    if (cmd === "memory_pressure") return ok("System-wide memory free percentage: 80%");
    if (cmd === "git") {
      const a = args.slice(2);
      if (a[0] === "fetch") return ok();
      if (a[0] === "diff") return ok(mode === "docs-only" ? "docs/WORKFLOW.md" : "packages/core/src/queue.ts");
      if (a.join(" ") === "rev-parse --abbrev-ref HEAD") return ok("master");
      if (a.join(" ") === "rev-parse HEAD") return ok(head);
      if (a.join(" ") === "rev-parse origin/master") return ok("new");
      if (a.join(" ") === "rev-parse --short HEAD") return ok(head);
      if (a[0] === "pull") {
        head = "new";
        pulls++;
        runHook(false);
        return ok();
      }
    }
    if (cmd === "/bin/sh" && args[0]?.endsWith(".githooks/post-commit")) { runHook(true); return ok(); }
    if (cmd === "bun" && args.join(" ") === "run phone:install --status") return { status: 1, stdout: "", stderr: "offline fixture" };
    throw Error(`Unexpected subprocess: ${cmd} ${args.join(" ")}`);
  },
}));
const original = readFileSync("apps/desktop/scripts/auto-update.ts", "utf8");
const copy = original.replace("function pass() {", "export function pass() {")
  .replace('from "./mac-load"', `from "${resolve("apps/desktop/scripts/mac-load")}"`)
  .replace('const cache = join(homedir(), "Library/Caches/ore");', `const cache = ${JSON.stringify(cache)};`);
const copyPath = join(base, "update-copy.ts");
writeFileSync(copyPath, copy);
const { pass } = await import(copyPath);
pass();
const afterFirst = existsSync(join(cache, "app-built")) ? readFileSync(join(cache, "app-built"), "utf8").trim() : null;
rmSync(join(base, "fail"), { force: true });
pass();
pass();
const attempts = existsSync(join(base, "attempts")) ? readFileSync(join(base, "attempts"), "utf8").trim().split("\n").length : 0;
const installed = readFileSync(join(base, "installed"), "utf8").trim();
const stamp = existsSync(join(cache, "app-built")) ? readFileSync(join(cache, "app-built"), "utf8").trim() : null;
console.log(JSON.stringify({ mode, attempts, installed, stamp, pulls, afterFirst }));
