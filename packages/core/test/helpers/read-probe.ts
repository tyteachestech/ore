import { expect } from "bun:test";
import type { Library } from "../../src/library.ts";

/** Isolate builtin instrumentation so it cannot affect another test's imports. */
export function readProbe(lib: Library, body: string): { reads: string[]; checks: string[]; result: any } {
  const script = `
    import fs from "node:fs";
    import { mock } from "bun:test";
    const reads = [], checks = [];
    let active = false;
    const read = fs.readFileSync, exists = fs.existsSync;
    mock.module("node:fs", () => ({ ...fs,
      readFileSync(p, ...args) { if (active) reads.push(String(p)); return read(p, ...args); },
      existsSync(p) { if (active) checks.push(String(p)); return exists(p); }
    }));
    const lib = ${JSON.stringify(lib)};
    const core = ${JSON.stringify(new URL("../../src/", import.meta.url).pathname)};
    ${body}
    console.log(JSON.stringify({ reads, checks, result }));
  `;
  const run = Bun.spawnSync([process.execPath, "--eval", script], { env: { ...process.env, ORE_NO_ENRICH: "1", ORE_LIBRARY: lib.root }, stdout: "pipe", stderr: "pipe" });
  expect(run.stderr.toString()).toBe("");
  expect(run.exitCode).toBe(0);
  return JSON.parse(run.stdout.toString());
}
