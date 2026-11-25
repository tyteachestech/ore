import fs, { existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { hostname, uptime } from "node:os";
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

/** When this machine started, in seconds, to tell a lock from before a restart: its pid may belong to a new
 *  process now. NaN on the iPhone, whose `.ore` is rebuilt each launch anyway. */
const bootedAt = () => Math.round(Date.now() / 1000 - uptime());

/** A lock is stale when its owner is gone: a dead local pid, or one from before this machine last started
 *  (code review of #538: a reused pid would hold it for good). A live local owner keeps its lock however long it writes (deep scan 4, EDGES-02). A lock
 *  from another host (a copied or synced `.ore`) can't be asked, so it goes stale by age, as an empty one did.
 *  Locks are written whole (`acquire`), so an empty one is a lock from an older Ore. */
export function lockStale(path: string): boolean {
  try {
    const raw = readFileSync(path, "utf8").trim();
    const owner = raw.startsWith("{") ? JSON.parse(raw) as { pid: number; host: string; boot?: number } : { pid: Number(raw), host: hostname() };
    const age = Date.now() - statSync(path).mtimeMs;
    if (owner.host !== hostname() || !(Number.isInteger(owner.pid) && owner.pid > 0)) return age > STALE_MS;
    const boot = bootedAt();
    if (Number.isFinite(boot) && typeof owner.boot === "number" && Math.abs(owner.boot - boot) > 120) return true;
    return !isAlive(owner.pid);
  } catch {
    return false;
  }
}

/** Publish a fully populated owner record in one exclusive operation. A process
 * killed before publication leaves only an unused temp file, never an empty lock. */
function acquire(path: string): string | undefined {
  const owner = JSON.stringify({ pid: process.pid, host: hostname(), boot: bootedAt(), token: crypto.randomUUID() });
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
