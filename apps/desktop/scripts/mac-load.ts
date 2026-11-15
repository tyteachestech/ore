#!/usr/bin/env bun
// Keeps test runs from freezing Tyler's Mac (2026-11-15: five Codex testers at once froze it until it restarted).
//   bun apps/desktop/scripts/mac-load.ts check [--alone]  fails below 25% free memory, or when two Codex testers
//                                                          already run across every thread (--alone: when any runs)
//   bun apps/desktop/scripts/mac-load.ts clean <dir>       stops every process started from <dir> (a worktree)
// `bun run sweep` calls both itself. Written in TypeScript because macOS's /bin/sh (bash 3.2) misparsed the shell version.
import { realpathSync } from "node:fs";
import { homedir } from "node:os";

export const MIN_FREE = 25;
export const MAX_TESTERS = 2;

export type Proc = { pid: number; ppid: number; pgid: number; command: string; cwd?: string };

/** The free percentage from `memory_pressure -Q`, or null when the output doesn't say. */
export function freePercent(out: string): number | null {
  const m = out.match(/free percentage:\s*(\d+)%/);
  return m ? Number(m[1]) : null;
}

/** Codex testers running: `codex … exec` processes, counting a wrapper and the binary it starts as one. */
export function testers(procs: Proc[]): number {
  const isTester = (p: Proc) => /(^|\/)codex(-[\w-]+)?(\.js)?\s(.*\s)?exec(\s|$)/.test(p.command);
  const ids = new Set(procs.filter(isTester).map((p) => p.pid));
  return procs.filter((p) => ids.has(p.pid) && !ids.has(p.ppid)).length;
}

/** Why a new run must wait, or null when it may start. */
export function refusal(free: number | null, running: number, alone = false): string | null {
  if (free === null) return "Couldn't read free memory (memory_pressure -Q).";
  if (free < MIN_FREE) return `Only ${free}% memory free (needs ${MIN_FREE}%): stop stale runs first (mac-load.ts clean <dir>).`;
  if (alone && running > 0) return `This run goes alone, and ${running} Codex tester(s) already run: wait for them.`;
  if (running >= MAX_TESTERS) return `${running} Codex testers already run (at most ${MAX_TESTERS}): wait for one to finish.`;
  return null;
}

/** The folders `clean` refuses: Tyler's own checkout, app and library. */
export function isTylers(dir: string, home = homedir()): boolean {
  return dir === `${home}/Developer/ore` || dir.startsWith("/Applications") || dir === `${home}/Ore` || dir.startsWith(`${home}/Ore/`);
}

/** Processes started from `dir` (its path in their command or their working folder inside it), never `self`,
 *  its ancestors or its process group, and never a Claude session. */
export function toStop(procs: Proc[], dir: string, self: number, spareGroup = true): number[] {
  const byPid = new Map(procs.map((p) => [p.pid, p]));
  const keep = new Set<number>();
  for (let p = byPid.get(self); p && !keep.has(p.pid); p = byPid.get(p.ppid)) keep.add(p.pid);
  const group = spareGroup ? byPid.get(self)?.pgid : undefined;
  const inside = (path?: string) => !!path && (path === dir || path.startsWith(dir + "/"));
  return procs
    .filter((p) => !keep.has(p.pid) && p.pgid !== group && !/claude/i.test(p.command))
    .filter((p) => p.command.includes(dir) || inside(p.cwd))
    .map((p) => p.pid);
}

function sh(cmd: string[]): string {
  const r = Bun.spawnSync(cmd, { stdout: "pipe", stderr: "ignore" });
  return r.stdout.toString();
}

export function processes(withCwd = false): Proc[] {
  const procs = sh(["ps", "-axww", "-o", "pid=,ppid=,pgid=,command="])
    .split("\n")
    .map((l) => l.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => ({ pid: Number(m[1]), ppid: Number(m[2]), pgid: Number(m[3]), command: m[4] }) as Proc);
  if (withCwd) {
    const cwd = new Map<number, string>();
    let pid = 0;
    for (const l of sh(["lsof", "-d", "cwd", "-Fpn"]).split("\n")) {
      if (l.startsWith("p")) pid = Number(l.slice(1));
      else if (l.startsWith("n")) cwd.set(pid, l.slice(1));
    }
    for (const p of procs) p.cwd = cwd.get(p.pid);
  }
  return procs;
}

/** null when a run may start, else why not. Prints what it saw. */
export function check(alone = false, log = console.log): string | null {
  const free = freePercent(sh(["memory_pressure", "-Q"]));
  const running = testers(processes());
  log(`memory free: ${free ?? "?"}%   Codex testers running: ${running}`);
  return refusal(free, running, alone);
}

/** Every process below `pid`, deepest first. */
export function descendants(procs: Proc[], pid: number): number[] {
  const kids = procs.filter((p) => p.ppid === pid).map((p) => p.pid);
  return [...kids.flatMap((k) => descendants(procs, k)), ...kids];
}

/** Stops `pid` and everything it started. */
export function killTree(pid: number): void {
  for (const p of [...descendants(processes(), pid), pid]) try { process.kill(p, "SIGTERM"); } catch {}
}

/** Stops every process started from `dir`; returns how many. `bun run sweep` passes spareGroup false to stop its own. */
export async function clean(dir: string, log = console.log, spareGroup = true): Promise<number> {
  const real = realpathSync(dir);
  if (isTylers(real)) throw new Error(`Refusing ${real}: that is Tyler's own.`);
  const procs = processes(true);
  const pids = toStop(procs, real, process.pid, spareGroup);
  if (!pids.length) return log(`Nothing running from ${real}.`), 0;
  for (const p of procs) if (pids.includes(p.pid)) log(`${p.pid} ${p.command.slice(0, 110)}`);
  const kill = (sig: NodeJS.Signals) => pids.forEach((p) => { try { process.kill(p, sig); } catch {} });
  kill("SIGTERM");
  await Bun.sleep(2000);
  kill("SIGKILL");
  log(`Stopped ${pids.length} processes.`);
  return pids.length;
}

if (import.meta.main) {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === "check") {
    const why = check(process.argv.includes("--alone"));
    if (why) (console.log(why), process.exit(1));
  } else if (cmd === "clean" && arg) {
    await clean(arg).catch((e) => (console.log(e.message), process.exit(1)));
  } else {
    console.log("usage: mac-load.ts check [--alone] | clean <worktree dir>");
    process.exit(1);
  }
}
