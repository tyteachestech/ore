import { expect, test } from "bun:test";
import { readFileSync, utimesSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
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

test("a foreign host lock never probes a local PID or expires by age", async () => {
  const lib = await tempLibrary();
  const path = join(lib.root, ".ore", "lock");
  writeFileSync(path, JSON.stringify({ pid: 2147483646, host: hostname() + "-other" }));
  const old = new Date(Date.now() - 120_000);
  utimesSync(path, old, old);
  expect(lockStale(path)).toBe(false);
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
