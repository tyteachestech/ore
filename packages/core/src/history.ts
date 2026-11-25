import { existsSync, mkdirSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tryWithLock } from "./lock.ts";
import { paths, type Library } from "./library.ts";

// The library is a local git repo (D5), never pushed. Writes are snapshotted at most every
// ten minutes, so an overwritten note or a bad edit can be recovered from its history.
const EVERY_MS = 10 * 60_000;

const marker = (lib: Library) => join(lib.root, ".ore", "last-snapshot");

export function snapshot(lib: Library, opts: { force?: boolean; now?: number } = {}): { committed: boolean } {
  if (!existsSync(join(lib.root, ".git"))) return { committed: false };
  const m = marker(lib);
  const now = opts.now ?? Date.now();
  if (!opts.force && existsSync(m) && now - statSync(m).mtimeMs < EVERY_MS) return { committed: false };
  const git = (...args: string[]) =>
    Bun.spawnSync(["git", "-c", "user.name=Ore", "-c", "user.email=ore@localhost", ...args], { cwd: lib.root, stdout: "pipe", stderr: "pipe" });
  mkdirSync(join(lib.root, ".ore"), { recursive: true });
  writeFileSync(m, ""); // before git runs: a library where git fails tries again in ten minutes, not on every command
  // Hashing a big new file (a recording, a PDF) is done first, outside the lock, so no write waits on it.
  if (git("add", "-A").exitCode !== 0) return { committed: false };
  // Then staged again under the library lock, which only rehashes what changed meanwhile: the snapshot never
  // holds half a write (deep scan 4, EDGES-05). With a write out it waits for the next one.
  const staged = tryWithLock(paths.lock(lib), () => git("add", "-A").exitCode === 0);
  if (!staged) {
    writeFileSync(m, "");
    utimesSync(m, new Date(0), new Date(0)); // a write was out: the next command snapshots, not one ten minutes on
    return { committed: false };
  }
  if (git("diff", "--cached", "--quiet").exitCode === 0) return { committed: false };
  return { committed: git("commit", "-q", "--no-verify", "-m", `Snapshot ${new Date(now).toISOString()}`).exitCode === 0 };
}
