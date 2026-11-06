import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Library } from "./library.ts";

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
  writeFileSync(m, "");
  if (git("add", "-A").exitCode !== 0) return { committed: false };
  if (git("diff", "--cached", "--quiet").exitCode === 0) return { committed: false };
  return { committed: git("commit", "-q", "--no-verify", "-m", `Snapshot ${new Date(now).toISOString()}`).exitCode === 0 };
}
