import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { hostname, tmpdir, uptime } from "node:os";
import { join } from "node:path";
import { lockStale, withLock } from "../src/lock.ts";
import { tempLibrary } from "./helpers.ts";

test("a paused live writer keeps its lock past one minute", async () => {
  const lib = await tempLibrary();
  const path = join(lib.root, ".ore", "lock");
  await withLock(path, async () => {
    const old = new Date(Date.now() - 120_000);
    utimesSync(path, old, old);
    expect(lockStale(path)).toBe(false);
    let entered = false;
    await expect(withLock(path, () => { entered = true; }, 1)).rejects.toThrow("locked");
    expect(entered).toBe(false);
    expect(readFileSync(path, "utf8")).toContain(String(process.pid));
  });
});

test("a lock from another host is never judged by a local pid, and goes stale only by age", async () => {
  const lib = await tempLibrary();
  const path = join(lib.root, ".ore", "lock");
  writeFileSync(path, JSON.stringify({ pid: 2147483646, host: hostname() + "-other" }));
  expect(lockStale(path)).toBe(false); // that pid is dead here, but it is not ours to ask
  const old = new Date(Date.now() - 120_000);
  utimesSync(path, old, old);
  expect(lockStale(path)).toBe(true);
});

test("a crash while publishing a lock lets the next save proceed immediately", async () => {
  const lib = await tempLibrary();
  const path = join(lib.root, ".ore", "lock");
  const code = `
    import { mock } from "bun:test";
    import * as fs from "node:fs";
    const open = fs.openSync, link = fs.linkSync;
    const target = ${JSON.stringify(path)};
    const openSync = (p,...args) => { const fd = open(p,...args); if(String(p) === target) process.kill(process.pid,"SIGKILL"); return fd; };
    const linkSync = (from,to) => { link(from,to); if(String(to) === target) process.kill(process.pid,"SIGKILL"); };
    mock.module("node:fs", () => ({ ...fs, openSync, linkSync, default: { ...fs.default, openSync, linkSync } }));
    const { withLock } = await import(${JSON.stringify(join(import.meta.dir, "../src/lock.ts"))});
    await withLock(target, () => {});
  `;
  const child = Bun.spawnSync([process.execPath, "-e", code], { env: { ...process.env, ORE_NO_ENRICH: "1" } });
  expect(child.signalCode).toBe("SIGKILL");
  let saved = false;
  await withLock(path, () => { saved = true; }, 100);
  expect(saved).toBe(true);
});

test("a lock left before this machine last started is stale, though a new process has its pid", () => {
  const dir = mkdtempSync(join(tmpdir(), "ore-lock-"));
  const path = join(dir, "lock");
  const boot = Math.round(Date.now() / 1000 - uptime());
  writeFileSync(path, JSON.stringify({ pid: process.pid, host: hostname(), boot: boot - 3600 }));
  expect(lockStale(path)).toBe(true);
  writeFileSync(path, JSON.stringify({ pid: process.pid, host: hostname(), boot }));
  expect(lockStale(path)).toBe(false);
});

// F-new-lock-sleep: the real time was performance.timeOrigin + performance.now(), a monotonic clock that stops while
// a Mac sleeps. An `ore` that ran across a sleep (an enrich left running as the lid closed) wrote its lock's boot that
// many seconds early, so every other `ore` took its live lock for one from before a restart and wrote alongside it.
test("a writer that ran across a sleep keeps its lock: its boot comes from the wall clock, not one that stops in sleep", async () => {
  const lib = await tempLibrary();
  const path = join(lib.root, ".ore", "lock");
  const now = performance.now.bind(performance);
  // The monotonic clock behind by ten minutes of sleep.
  performance.now = () => now() - 600_000;
  try {
    await withLock(path, async () => {
      performance.now = now;
      expect(lockStale(path)).toBe(false);
    });
  } finally {
    performance.now = now;
  }
});
