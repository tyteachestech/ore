import { closeSync, mkdirSync, openSync, readFileSync, statSync, unlinkSync, writeSync } from "node:fs";
import { dirname } from "node:path";

const STALE_MS = 60_000;

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** A lock left by a dead process, or older than a minute. An empty or unreadable pid (a crash
 *  between create and write) goes stale by age only, since a live taker writes it a moment later. */
export function lockStale(path: string): boolean {
  try {
    const pid = Number(readFileSync(path, "utf8").trim());
    if (Number.isInteger(pid) && pid > 0 && !isAlive(pid)) return true;
    return Date.now() - statSync(path).mtimeMs > STALE_MS;
  } catch {
    return false;
  }
}

// Removes a stale lock. Two waiters can both see it stale; without a guard the second would
// delete the lock the first had just taken, and both would run. The takeover file lets one
// waiter check and remove at a time; a takeover file left by a crash is cleared after 5 s.
function takeOver(path: string): boolean {
  const guard = path + ".takeover";
  try {
    closeSync(openSync(guard, "wx"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    try { if (Date.now() - statSync(guard).mtimeMs > 5_000) unlinkSync(guard); } catch { /* gone */ }
    return false;
  }
  try {
    if (lockStale(path)) unlinkSync(path);
    return true;
  } catch {
    return true; // gone already: retry the create
  } finally {
    try { unlinkSync(guard); } catch { /* gone */ }
  }
}

// Advisory lock: exclusive-create a lockfile holding our pid. Stale locks
// (dead pid or older than a minute) are taken over.
export async function withLock<T>(path: string, fn: () => T | Promise<T>, timeoutMs = 15_000): Promise<T> {
  mkdirSync(dirname(path), { recursive: true });
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const fd = openSync(path, "wx");
      writeSync(fd, String(process.pid));
      closeSync(fd);
      break;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      if (lockStale(path) && takeOver(path)) continue;
      if (Date.now() > deadline) throw new Error(`library is locked (${path}); retry, or delete it if no ore process is running`);
      await Bun.sleep(50);
    }
  }
  try {
    return await fn();
  } finally {
    try { unlinkSync(path); } catch { /* already gone */ }
  }
}
