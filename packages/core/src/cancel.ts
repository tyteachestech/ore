import { rmSync } from "node:fs";

// What a run wrote that must come back out if it is stopped midway (the app's Cancel on an add,
// which ends `ore add` with SIGTERM): a source half-added is never left in the library.
const written = new Set<string>();

/** A folder this run made; `cancelRun` removes it. */
export function madeThisRun(dir: string): void {
  written.add(dir);
}

/** Removes every folder this run made, newest first. */
export function cancelRun(): void {
  for (const dir of [...written].reverse()) rmSync(dir, { recursive: true, force: true });
  written.clear();
}
