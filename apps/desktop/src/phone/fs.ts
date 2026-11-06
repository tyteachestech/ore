// node:fs for the core on iPhone (phase 0 feel test). The core reads and writes files synchronously,
// and a web view has no synchronous file API, so the library's text files live in memory: loaded at
// launch from the snapshot shipped with the app, with every write kept in IndexedDB so it survives
// a relaunch and across new builds (see `mount`).

type Entry = { text: string; mtime: number };
const files = new Map<string, Entry>();
/** The snapshot's paths: only these need a tombstone when deleted. */
const shipped = new Set<string>();
const dirs = new Set<string>(["/"]);

const parent = (p: string) => p.slice(0, p.lastIndexOf("/")) || "/";
function addDirs(p: string) {
  for (let d = parent(p); !dirs.has(d); d = parent(d)) dirs.add(d);
}
const err = (code: string, p: string) => Object.assign(new Error(`${code}: ${p}`), { code });

// ---- persistence: writes and deletes go to IndexedDB in the background, in order.

let db: IDBDatabase | null = null;
let chain: Promise<void> = Promise.resolve();
/** `e`: the file to keep, "tombstone" for a deleted snapshot file, null to forget the path. */
function persist(p: string, e: Entry | "tombstone" | null) {
  if (!db) return;
  const store = () => db!.transaction("files", "readwrite").objectStore("files");
  chain = chain.then(
    () =>
      new Promise<void>((done) => {
        const r = e === "tombstone" ? store().put(null, p) : e ? store().put(e, p) : store().delete(p);
        r.onsuccess = r.onerror = () => done();
      }),
  );
}

/** Loads the shipped snapshot, then the writes made on this phone on top, kept across new builds. Until
 *  sync, a new build is the only way the Mac's changes arrive, so on a new snapshot each file the Mac
 *  changed (or added, or deleted) since the last one takes the Mac's version; every other phone write
 *  stays, and the phone's own logs (`*.iphone.jsonl`, D78) always do. */
export async function mount(snapshot: Record<string, string>, id: string) {
  for (const [p, text] of Object.entries(snapshot)) {
    files.set(p, { text, mtime: 1 });
    shipped.add(p);
    addDirs(p);
  }
  // Ask iOS not to clear the phone's library when storage runs low.
  await navigator.storage?.persist?.().catch(() => false);
  db = await new Promise<IDBDatabase>((ok, fail) => {
    const r = indexedDB.open("ore-phone", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("files");
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fail(r.error);
  });
  const store = (mode: IDBTransactionMode) => db!.transaction("files", mode).objectStore("files");
  const get = (key: string) =>
    new Promise<unknown>((done) => {
      const r = store("readonly").get(key);
      r.onsuccess = () => done(r.result);
      r.onerror = () => done(null);
    });
  const fresh = Object.fromEntries(Object.entries(snapshot).map(([p, t]) => [p, hash(t)]));
  if ((await get(SNAPSHOT)) !== id) {
    const before = ((await get(HASHES)) ?? null) as Record<string, string> | null;
    const keys = await new Promise<string[]>((done) => {
      const r = store("readonly").getAllKeys();
      r.onsuccess = () => done(r.result.map(String));
      r.onerror = () => done([]);
    });
    const macChanged = (p: string) => !before || before[p] !== fresh[p];
    await new Promise<void>((done) => {
      const s = store("readwrite");
      for (const p of keys) if (p !== SNAPSHOT && p !== HASHES && !OWN_LOG.test(p) && macChanged(p)) s.delete(p);
      s.put(id, SNAPSHOT);
      const r = s.put(fresh, HASHES);
      r.onsuccess = r.onerror = () => done();
    });
  }
  await new Promise<void>((done) => {
    const r = store("readonly").openCursor();
    r.onsuccess = () => {
      const c = r.result;
      if (!c) return done();
      const p = String(c.key);
      if (p === SNAPSHOT || p === HASHES) return c.continue();
      if (c.value === null) files.delete(p);
      else {
        files.set(p, c.value as Entry);
        addDirs(p);
      }
      c.continue();
    };
    r.onerror = () => done();
  });
}

/** The phone's own append-only logs: only the phone writes them. */
const OWN_LOG = /\.iphone\.jsonl$/;
/** The IndexedDB key holding each snapshot file's hash, to tell which files the Mac changed between builds. */
const HASHES = "#snapshot-files";
/** FNV-1a: enough to tell whether a file changed between two snapshots. */
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36) + s.length.toString(36);
}

/** The IndexedDB key that holds which snapshot the phone's writes sit on. */
const SNAPSHOT = "#snapshot";

function put(p: string, text: string, mtime = Date.now()) {
  const e = { text, mtime };
  files.set(p, e);
  addDirs(p);
  if (!SCRATCH.test(p)) persist(p, e);
}
/** The lock and the search index are rebuilt each launch, never kept. */
const SCRATCH = /\/\.(ore|index)\//;
function drop(p: string) {
  files.delete(p);
  if (SCRATCH.test(p)) return;
  // A file from the snapshot gets a tombstone, so it stays deleted after a relaunch. One made on the
  // phone (every atomic write's temp file among them) is simply removed, or IndexedDB would keep a
  // dead key for each save.
  persist(p, shipped.has(p) ? "tombstone" : null);
}

// ---- the node:fs functions the core uses.

export const existsSync = (p: string) => files.has(p) || dirs.has(p);
export function readFileSync(p: string, _enc?: unknown): string {
  const e = files.get(p);
  if (!e) throw err("ENOENT", p);
  return e.text;
}
export const writeFileSync = (p: string, s: string | Uint8Array) => put(p, typeof s === "string" ? s : new TextDecoder().decode(s));
export const appendFileSync = (p: string, s: string) => put(p, (files.get(p)?.text ?? "") + s);
export function mkdirSync(p: string, _o?: unknown) {
  dirs.add(p);
  addDirs(p + "/x");
}
export const unlinkSync = (p: string) => {
  if (!files.has(p)) throw err("ENOENT", p);
  drop(p);
};
export function rmSync(p: string, _o?: unknown) {
  for (const f of [...files.keys()]) if (f === p || f.startsWith(p + "/")) drop(f);
  for (const d of [...dirs]) if (d === p || d.startsWith(p + "/")) dirs.delete(d);
}
export function renameSync(a: string, b: string) {
  put(b, readFileSync(a));
  drop(a);
}
export const copyFileSync = (a: string, b: string) => put(b, readFileSync(a));
export const mkdtempSync = (prefix: string) => {
  const d = `${prefix}${Math.random().toString(36).slice(2, 8)}`;
  mkdirSync(d);
  return d;
};

type Dirent = { name: string; isDirectory: () => boolean; isFile: () => boolean };
export function readdirSync(p: string, o?: { withFileTypes?: boolean }): any {
  if (!dirs.has(p)) throw err("ENOENT", p);
  const pre = p.endsWith("/") ? p : p + "/";
  const names = new Map<string, boolean>();
  for (const f of files.keys()) {
    if (!f.startsWith(pre)) continue;
    const rest = f.slice(pre.length);
    const i = rest.indexOf("/");
    names.set(i < 0 ? rest : rest.slice(0, i), i >= 0);
  }
  for (const d of dirs) if (d.startsWith(pre) && d.length > pre.length && !d.slice(pre.length).includes("/")) names.set(d.slice(pre.length), true);
  const list = [...names].sort(([a], [b]) => (a < b ? -1 : 1));
  return o?.withFileTypes ? list.map(([name, dir]): Dirent => ({ name, isDirectory: () => dir, isFile: () => !dir })) : list.map(([n]) => n);
}
export function statSync(p: string) {
  if (!existsSync(p)) throw err("ENOENT", p);
  const e = files.get(p);
  const m = e?.mtime ?? 1;
  return { mtimeMs: m, mtime: new Date(m), size: e?.text.length ?? 0, isDirectory: () => !e, isFile: () => !!e };
}
export const lstatSync = statSync;
export const realpathSync = (p: string) => p;

// The library lock (lock.ts) is a file opened exclusively; the phone runs one command at a time.
export function openSync(p: string, flags?: string) {
  if (flags === "wx" && files.has(p)) throw err("EEXIST", p);
  put(p, files.get(p)?.text ?? "");
  return 3;
}
export const writeSync = (_fd: number, s: string) => s.length;
export const closeSync = (_fd: number) => {};
export const symlinkSync = () => {};
export const cpSync = () => {};
export function utimesSync(p: string, _atime: Date | number, mtime: Date | number) {
  const e = files.get(p);
  if (!e) throw err("ENOENT", p);
  put(p, e.text, +mtime);
}

export default {
  existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync, unlinkSync, rmSync, renameSync, copyFileSync, mkdtempSync,
  readdirSync, statSync, lstatSync, realpathSync, openSync, writeSync, closeSync, symlinkSync, cpSync, utimesSync,
};
