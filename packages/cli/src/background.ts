import { mkdirSync, openSync } from "node:fs";
import { join } from "node:path";
import { catchUpDue, markCatchUp, markTablesReading, paths, type Library } from "@ore/core";

// Run `ore enrich <id>` detached so `ore add` returns immediately.
// Output goes to .ore/logs/enrich-<id>.log.
export function startEnrich(lib: Library, itemId: string): "started" | "skipped" {
  return startBackground(lib, ["enrich", itemId], `enrich-${itemId}`);
}

// Several sources (a course's lessons) enriched one after another in one detached run, each with its own error file.
export function startEnrichMany(lib: Library, itemIds: string[]): "started" | "skipped" {
  if (!itemIds.length) return "skipped";
  return startBackground(lib, ["enrich", ...itemIds], `enrich-${itemIds[0]}`);
}

// Write card variants ahead of review (D66), never during it: `ore remix <ids>` detached.
export function startRemix(lib: Library, cardIds: string[]): "started" | "skipped" {
  if (!cardIds.length) return "skipped";
  return startBackground(lib, ["remix", ...cardIds], "remix");
}

// A PDF's tables and formulas (D125): `ore tables <id>` detached, since Docling takes seconds to minutes.
// Marked as being read before `ore add` returns, so the reader opened next shows it waiting.
export function startTables(lib: Library, itemId: string): "started" | "skipped" {
  return startBackground(lib, ["tables", itemId], `tables-${itemId}`, (pid) => markTablesReading(lib, itemId, pid));
}

// The day's catch-up (D8, D10): `ore catch-up` detached, at most once in 20 hours. Started from Home,
// a review session and the reminder agent, so it runs whether or not the app is open.
export function startCatchUp(lib: Library): "started" | "skipped" {
  if (process.env.ORE_NO_ENRICH || !catchUpDue(lib)) return "skipped";
  markCatchUp(lib);
  return startBackground(lib, ["catch-up"], "catch-up");
}

function startBackground(lib: Library, args: string[], logName: string, started?: (pid: number) => void): "started" | "skipped" {
  if (process.env.ORE_NO_ENRICH) return "skipped";
  mkdirSync(paths.logs(lib), { recursive: true });
  const log = openSync(join(paths.logs(lib), `${logName}.log`), "a");
  // Compiled into the app (one file), `ore` is process.execPath itself; from a checkout, Bun runs ore.ts.
  // Bun.main says which: compiled, it is a path inside the file ("/$bunfs/…"). import.meta.dir does not:
  // a --bytecode build keeps the checkout's path there (apps/desktop/test/compiled-cli.test.ts).
  const self = Bun.main.startsWith("/$bunfs") ? [process.execPath] : [process.execPath, join(import.meta.dir, "ore.ts")];
  const proc = Bun.spawn([...self, ...args], {
    cwd: lib.root,
    env: { ...process.env, ORE_LIBRARY: lib.root },
    stdio: ["ignore", log, log],
    detached: true,
  });
  started?.(proc.pid);
  proc.unref();
  return "started";
}
