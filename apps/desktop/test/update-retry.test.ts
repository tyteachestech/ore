import { expect, test } from "bun:test";
import { resolve } from "node:path";

// Run the real updater and hook with fake processes in a disposable directory. The subprocess
// keeps its child_process mock out of every other test; no real Git fetch, build or app is run.
function run(mode: string) {
  const result = Bun.spawnSync([process.execPath, resolve(import.meta.dir, "fixtures/update-retry.ts"), mode], {
    cwd: resolve(import.meta.dir, "../../.."), timeout: 10_000,
  });
  expect(result.exitCode).toBe(0);
  return JSON.parse(result.stdout.toString().trim().split("\n").at(-1)!);
}

test("a failed Mac install is retried at unchanged HEAD, and only success marks it installed", () => {
  expect(run("transient-failure")).toMatchObject({ attempts: 2, installed: "new", stamp: "new", pulls: 1, afterFirst: null });
});

test("a successful pull install is not repeated on later updater passes", () => {
  expect(run("healthy")).toMatchObject({ attempts: 1, installed: "new", stamp: "new", pulls: 1 });
});

test("an already current Mac build needs neither another pull nor an install", () => {
  expect(run("current")).toMatchObject({ attempts: 0, stamp: "new", pulls: 0 });
});

test("documentation-only changes advance the Mac marker without rebuilding", () => {
  expect(run("docs-only")).toMatchObject({ attempts: 0, stamp: "new", pulls: 0 });
});

test("a checkout with no successful-install marker installs once even without a pull", () => {
  expect(run("missing-stamp")).toMatchObject({ attempts: 1, installed: "new", stamp: "new", pulls: 0 });
});
