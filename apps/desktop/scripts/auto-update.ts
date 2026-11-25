#!/usr/bin/env bun
// Keeps Ore on Tyler's Mac and iPhone at the latest master without anyone pulling (Tyler, 2026-11-17).
//   bun run auto-update install    writes and loads the launchd job (every 15 minutes, and at login)
//   bun run auto-update uninstall  unloads and removes it
//   bun run auto-update run        one pass: what the job runs
// A pass, from ~/Developer/ore only while it sits on master: fetch master; if it moved, `git pull --ff-only`, whose
// post-merge hook reinstalls the Mac app (and leaves Ore alone while it is in front). Then, if the phone answers and
// its build is behind a commit that touched what the phone app is built from, `bun run phone:install`.
// Skips a pass while the Mac is loaded (mac-load.ts) so a pull never lands on a running tester.
// Log: ~/Library/Caches/ore/auto-update.log
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { freePercent, refusal, testers } from "./mac-load";

const LABEL = "com.tylerpoelking.ore.auto-update";
const repo = resolve(import.meta.dir, "../../..");
const cache = join(homedir(), "Library/Caches/ore");
const appStamp = join(cache, "app-built");
const phoneStamp = join(cache, "phone-built");
const plist = join(homedir(), "Library/LaunchAgents", `${LABEL}.plist`);

/** Whether commits that changed these files need a new phone build: the phone app is apps/phone plus the desktop
 *  app's phone screens and packages/core. */
export function phoneNeeds(changed: string[]): boolean {
  return changed.some((f) => /^(apps\/(phone|desktop)|packages)\/|^(package\.json|bun\.lock|tsconfig\.json)$/.test(f));
}

function git(...args: string[]) {
  const r = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
  return { ok: r.status === 0, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
}

const log = (msg: string) => console.log(`${new Date().toISOString()} ${msg}`);

function loaded(): string | null {
  const ps = spawnSync("ps", ["-axo", "pid=,ppid=,pgid=,command="], { encoding: "utf8" }).stdout ?? "";
  const procs = ps.split("\n").filter(Boolean).map((l) => {
    const [pid, ppid, pgid, ...rest] = l.trim().split(/\s+/);
    return { pid: Number(pid), ppid: Number(ppid), pgid: Number(pgid), command: rest.join(" ") };
  });
  return refusal(freePercent(spawnSync("memory_pressure", ["-Q"], { encoding: "utf8" }).stdout ?? ""), testers(procs), true);
}

function pass() {
  if (git("rev-parse", "--abbrev-ref", "HEAD").out !== "master") return log("checkout isn't on master: skipped");
  const why = loaded();
  if (why) return log(`skipped: ${why}`);
  if (!git("fetch", "-q", "origin", "master").ok) return log("fetch failed (offline?)");
  let pulled = false;
  if (git("rev-parse", "HEAD").out !== git("rev-parse", "origin/master").out) {
    const pull = git("pull", "--ff-only", "-q", "origin", "master");
    log(pull.ok ? `pulled to ${git("rev-parse", "--short", "HEAD").out}` : `pull refused: ${pull.err}`);
    if (!pull.ok) return;
    pulled = true;
  }

  const head = git("rev-parse", "HEAD").out;
  // Git may already be current after a failed build. Retry through the same serialized hook;
  // the hook records a HEAD only after installation succeeds, and a live build keeps its lock.
  const installed = existsSync(appStamp) ? readFileSync(appStamp, "utf8").trim() : "";
  if (!pulled && installed !== head) {
    const changed = installed ? git("diff", "--name-only", `${installed}..${head}`) : { ok: false, out: "" };
    if (changed.ok && !changed.out.split("\n").some((f) => /^(apps\/desktop|packages)\/|^(package\.json|bun\.lock|tsconfig\.json)$/.test(f))) {
      const tmp = `${appStamp}.${process.pid}.tmp`;
      writeFileSync(tmp, head);
      renameSync(tmp, appStamp);
    } else {
      const retry = spawnSync("/bin/sh", [join(repo, ".githooks/post-commit")], {
        cwd: repo, encoding: "utf8", env: { ...process.env, ORE_INSTALL_RETRY: "1" },
      });
      if (retry.status !== 0) log(`Mac install hook failed: ${retry.stderr}`);
    }
  }

  const last = existsSync(phoneStamp) ? readFileSync(phoneStamp, "utf8").trim() : "";
  if (last === head) return;
  const diff = last ? git("diff", "--name-only", `${last}..${head}`) : { ok: false, out: "" };
  if (diff.ok && !phoneNeeds(diff.out.split("\n"))) return writeFileSync(phoneStamp, head);
  // --status reaches the phone; it fails when the phone is off Wi-Fi, asleep a long while, or unpaired.
  const status = spawnSync("bun", ["run", "phone:install", "--status"], { cwd: repo, encoding: "utf8" });
  if (status.status !== 0) return log("phone not reachable: it updates on a later pass");
  if (status.stdout.includes("this checkout's")) return writeFileSync(phoneStamp, head);
  log("building for the iPhone");
  const install = spawnSync("bun", ["run", "phone:install"], { cwd: repo, encoding: "utf8" });
  if (install.status === 0) {
    writeFileSync(phoneStamp, head);
    log(install.stdout.trim().split("\n").pop() ?? "phone installed");
  } else log(`phone install FAILED:\n${(install.stdout + install.stderr).trim().split("\n").slice(-15).join("\n")}`);
}

function launchctl(...args: string[]) {
  return spawnSync("launchctl", args, { encoding: "utf8" });
}

const domain = `gui/${process.getuid?.()}`;
const cmd = process.argv[2];
if (import.meta.main) {
  mkdirSync(cache, { recursive: true });
  if (cmd === "run") pass();
  else if (cmd === "install") {
    const bun = process.execPath;
    const path = `${join(homedir(), ".bun/bin")}:${join(homedir(), ".cargo/bin")}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`;
    writeFileSync(plist, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<!-- Written by ${repo}/apps/desktop/scripts/auto-update.ts: keeps Ore on the Mac and iPhone at master. -->
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array><string>${bun}</string><string>${join(repo, "apps/desktop/scripts/auto-update.ts")}</string><string>run</string></array>
  <key>WorkingDirectory</key><string>${repo}</string>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>${path}</string></dict>
  <key>StartInterval</key><integer>900</integer>
  <key>RunAtLoad</key><true/>
  <key>ProcessType</key><string>Background</string>
  <!-- The post-merge hook reinstalls in a background subshell; without this launchd kills it when the pass ends. -->
  <key>AbandonProcessGroup</key><true/>
  <key>StandardOutPath</key><string>${join(cache, "auto-update.log")}</string>
  <key>StandardErrorPath</key><string>${join(cache, "auto-update.log")}</string>
</dict>
</plist>
`);
    launchctl("bootout", `${domain}/${LABEL}`);
    const r = launchctl("bootstrap", domain, plist);
    console.log(r.status === 0 ? `loaded ${LABEL}: a pass every 15 minutes, log ${join(cache, "auto-update.log")}` : `bootstrap failed: ${r.stderr}`);
    process.exit(r.status ?? 1);
  } else if (cmd === "uninstall") {
    launchctl("bootout", `${domain}/${LABEL}`);
    rmSync(plist, { force: true });
    console.log(`removed ${LABEL}`);
  } else {
    console.error("usage: bun run auto-update install|uninstall|run");
    process.exit(1);
  }
}
