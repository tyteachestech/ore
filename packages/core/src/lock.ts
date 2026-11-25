import fs, { existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { dirname } from "node:path";

const STALE_MS = 60_000;

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

/** .ore is device-local in sync (the phone serializes commands). New locks also name
 * their host so a copied/shared library never treats a remote PID as local. Legacy
 * numeric locks are local. Only a dead local owner can lose its lock by takeover. */
export function lockStale(path: string): boolean {
  try {
    const raw = readFileSync(path, "utf8").trim();
    const owner = raw.startsWith("{") ? JSON.parse(raw) as { pid: number; host: string } : { pid: Number(raw), host: hostname() };
    if (owner.host !== hostname()) return false;
    if (Number.isInteger(owner.pid) && owner.pid > 0) return !isAlive(owner.pid);
    return Date.now() - statSync(path).mtimeMs > STALE_MS;
  } catch {
    return false;
  }
}

/** Publish a fully populated owner record in one exclusive operation. A process
 * killed before publication leaves only an unused temp file, never an empty lock. */
function acquire(path: string): string | undefined {
  const owner = JSON.stringify({ pid: process.pid, host: hostname(), token: crypto.randomUUID() });
  const tmp = `${path}.${crypto.randomUUID()}.tmp`;
  writeFileSync(tmp, owner, { flag: "wx" });
  try {
    if (typeof fs.linkSync === "function") fs.linkSync(tmp, path);
    else {
      // The phone's ephemeral filesystem has no hard links and runs one command
      // at a time. This synchronous check/rename cannot interleave there.
      if (existsSync(path)) return undefined;
      renameSync(tmp, path);
    }
    return owner;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    return undefined;
  } finally {
    try { unlinkSync(tmp); } catch { /* renamed on the phone, or already gone */ }
  }
}

function release(path: string, owner: string): void {
  try {
    if (readFileSync(path, "utf8") === owner) unlinkSync(path);
  } catch { /* already gone */ }
}

// Serialize stale-owner removal, including a guard whose own owner crashed.
// Guards use the same populated record and liveness rules as the main lock.
function takeOver(path: string): boolean {
  const guard = path + ".takeover";
  const owner = acquire(guard);
  if (!owner) {
    if (lockStale(guard)) takeOver(guard);
    return false;
  }
  try {
    if (lockStale(path)) unlinkSync(path);
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    return true;
  } finally { release(guard, owner); }
}

/** Synchronous best-effort work: skip a busy library without touching its files. */
export function tryWithLock<T>(path: string, fn: () => T): T | undefined {
  mkdirSync(dirname(path), { recursive: true });
  let owner = acquire(path);
  if (!owner && lockStale(path) && takeOver(path)) owner = acquire(path);
  if (!owner) return undefined;
  try { return fn(); }
  finally { release(path, owner); }
}

// Advisory lock. Live local owners never expire; dead owners can be reclaimed.
export async function withLock<T>(path: string, fn: () => T | Promise<T>, timeoutMs = 15_000): Promise<T> {
  mkdirSync(dirname(path), { recursive: true });
  const deadline = Date.now() + timeoutMs;
  let owner: string | undefined;
  for (;;) {
    owner = acquire(path);
    if (owner) break;
    if (lockStale(path) && takeOver(path)) continue;
    if (Date.now() > deadline) throw new Error(`library is locked (${path}); retry, or delete it if no ore process is running`);
    await Bun.sleep(50);
  }
  try { return await fn(); }
  finally { release(path, owner); }
}
