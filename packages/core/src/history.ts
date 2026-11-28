import { existsSync, mkdirSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tryWithLock } from "./lock.ts";
import { paths, type Library } from "./library.ts";

// The library is a local git repo (D5), never pushed. Writes are snapshotted at most every
// ten minutes, so an overwritten note or a bad edit can be recovered from its history.
const EVERY_MS = 10 * 60_000;

const marker = (lib: Library) => join(lib.root, ".ore", "last-snapshot");

const git = (lib: Library, ...args: string[]) =>
  Bun.spawnSync(["git", "-c", "user.name=Ore", "-c", "user.email=ore@localhost", ...args], { cwd: lib.root, stdout: "pipe", stderr: "pipe" });

/** Why a snapshot would do harm now, in his words with the next step, or null. A restore an agent left half done
 *  (a merge, revert, rebase or stash pop in conflict) would be committed with its conflict marks as if settled, and
 *  one checked out at an old snapshot would commit where no branch holds it (history recovery pass, restore-01,
 *  SNAPSHOT-02, SNAPSHOT-05). History waits for him or the agent to finish instead. */
export function historyPaused(lib: Library): string | null {
  if (!existsSync(join(lib.root, ".git"))) return null;
  const dir = git(lib, "rev-parse", "--git-dir");
  if (dir.exitCode !== 0) return null;
  const gitDir = join(lib.root, dir.stdout.toString().trim());
  const op = [["MERGE_HEAD", "merge"], ["REVERT_HEAD", "revert"], ["CHERRY_PICK_HEAD", "cherry-pick"], ["rebase-merge", "rebase"], ["rebase-apply", "rebase"]].find(([f]) => existsSync(join(gitDir, f!)));
  if (op) return `a git ${op[1]} in the library isn't finished: finish it (git ${op[1]} --continue) or take it back (git ${op[1]} --abort)`;
  if (git(lib, "ls-files", "-u").stdout.length) return "a restore left files in conflict: settle them and commit, or take it back with git checkout HEAD -- <file>";
  if (git(lib, "symbolic-ref", "-q", "HEAD").exitCode !== 0) return "the library is checked out at an old snapshot: go back with git switch - (restore a file with git checkout <sha> -- <path> instead)";
  return null;
}

export function snapshot(lib: Library, opts: { force?: boolean; now?: number } = {}): { committed: boolean } {
  // Best effort, for every caller: no git, a broken repo or a busy one never fails a command (SPEC History;
  // session end forces one and had no catch, SNAPSHOT-03).
  try {
    if (!existsSync(join(lib.root, ".git"))) return { committed: false };
    const m = marker(lib);
    const now = opts.now ?? Date.now();
    if (!opts.force && existsSync(m) && now - statSync(m).mtimeMs < EVERY_MS) return { committed: false };
    mkdirSync(join(lib.root, ".ore"), { recursive: true });
    // One snapshot at a time: a second one's staging, outside the library lock, changed the files the first had
    // staged before it committed, so a snapshot could hold half of a later write (SNAPSHOT-01, F643's guard).
    return tryWithLock(join(lib.root, ".ore", "snapshot.lock"), () => take(lib, m, now)) ?? { committed: false };
  } catch {
    return { committed: false };
  }
}

function take(lib: Library, m: string, now: number): { committed: boolean } {
  writeFileSync(m, ""); // before git runs: a library where git fails tries again in ten minutes, not on every command
  if (historyPaused(lib)) return { committed: false };
  // Hashing a big new file (a recording, a PDF) is done first, outside the lock, so no write waits on it.
  if (git(lib, "add", "-A").exitCode !== 0) return { committed: false };
  // Then staged again under the library lock, which only rehashes what changed meanwhile: the snapshot never
  // holds half a write (deep scan 4, EDGES-05). With a write out it waits for the next one.
  const staged = tryWithLock(paths.lock(lib), () => git(lib, "add", "-A").exitCode === 0);
  if (!staged) {
    writeFileSync(m, "");
    utimesSync(m, new Date(0), new Date(0)); // a write was out: the next command snapshots, not one ten minutes on
    return { committed: false };
  }
  if (git(lib, "diff", "--cached", "--quiet").exitCode === 0) return { committed: false };
  return { committed: git(lib, "commit", "-q", "--no-verify", "-m", `Snapshot ${new Date(now).toISOString()}`).exitCode === 0 };
}
