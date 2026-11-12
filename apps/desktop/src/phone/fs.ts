// node:fs for the core on iPhone. The core reads and writes files synchronously, and a web view has no
// synchronous file API, so the library's text files live in memory. On the phone they come from Ore's
// iCloud Drive folder, which is the Mac's library (D78.6, D219): loaded at launch, every write sent back
// to the folder, and the Mac's changes read in again when the app comes back (`mountDisk`). In a browser
// (the e2e journeys, `vite` at phone size) they come from a snapshot, kept in IndexedDB (`mount`).

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
  if (disk) return p.startsWith(disk.prefix + "/") ? queue(p, e && e !== "tombstone" ? e.text : null) : undefined;
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

// ---- on the phone: Ore's iCloud Drive folder (apps/phone/src-tauri/src/lib.rs).

type Invoke = <T>(cmd: string, args: Record<string, unknown>) => Promise<T>;
type Stamped = [rel: string, mtime: number, stamp: string];
type Scan = { files: Stamped[]; waiting: string[] };
let disk: { root: string; prefix: string; invoke: Invoke } | null = null;
/** Each file's stamp (mtime and size) as last read or written, to tell what the Mac changed since. */
const known = new Map<string, string>();
/** Writes (text) and deletes (null) not sent yet, by library path. The last one for a path wins, so an
 *  atomic write's temp file never reaches iCloud. */
const unsent = new Map<string, string | null>();
let sending: Promise<void> = Promise.resolve();
let timer: ReturnType<typeof setTimeout> | undefined;

function queue(p: string, text: string | null) {
  unsent.set(p.slice(disk!.prefix.length + 1), text);
  timer ??= setTimeout(flush, 0);
}

/** Sends the writes made so far to the folder; resolves once they are on disk. */
export function flush(): Promise<void> {
  clearTimeout(timer);
  timer = undefined;
  const ops = [...unsent].filter(([rel, text]) => text !== null || known.has(rel));
  unsent.clear();
  if (!ops.length || !disk) return sending;
  const { root, invoke } = disk;
  sending = sending.then(async () => {
    try {
      for (const [rel, ms, stamp] of await invoke<Stamped[]>("library_apply", { root, ops })) {
        known.set(rel, stamp);
        const e = files.get(`${disk!.prefix}/${rel}`);
        if (e) e.mtime = ms;
      }
      for (const [rel, text] of ops) if (text === null) known.delete(rel);
    } catch (e) {
      // Kept for the next try, unless a newer write replaced it.
      for (const [rel, text] of ops) if (!unsent.has(rel)) unsent.set(rel, text);
      dispatchEvent(new CustomEvent("ore:save-failed", { detail: String(e) }));
    }
  });
  return sending;
}

/** Loads the library from the folder. On a first launch iCloud may still be downloading it: waits for that, up to a minute. */
export async function mountDisk(prefix: string, root: string, invoke: Invoke) {
  disk = { root, prefix, invoke };
  let scan = await invoke<Scan>("library_scan", { root });
  for (let i = 0; scan.waiting.length && i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    scan = await invoke<Scan>("library_scan", { root });
  }
  await read(scan.files);
  // iOS may suspend the app soon after it leaves the screen: what it wrote goes now.
  addEventListener("visibilitychange", () => document.hidden && void flush());
}

async function read(list: Stamped[]) {
  for (let i = 0; i < list.length; i += 400) {
    const part = list.slice(i, i + 400);
    const texts = await disk!.invoke<(string | null)[]>("library_read", { root: disk!.root, paths: part.map(([rel]) => rel) });
    part.forEach(([rel, mtime, stamp], j) => {
      const text = texts[j];
      if (text == null || unsent.has(rel)) return;
      const p = `${disk!.prefix}/${rel}`;
      files.set(p, { text, mtime });
      addDirs(p);
      known.set(rel, stamp);
    });
  }
}

/** Reads in what changed in the folder since (the Mac's edits, through iCloud); true if anything did.
 *  A file this phone is still sending keeps the phone's version. */
export async function rescan(): Promise<boolean> {
  if (!disk) return false;
  await flush();
  const scan = await disk.invoke<Scan>("library_scan", { root: disk.root });
  const seen = new Set([...scan.files.map(([rel]) => rel), ...scan.waiting]);
  const changed = scan.files.filter(([rel, , stamp]) => known.get(rel) !== stamp && !unsent.has(rel));
  const gone = [...known.keys()].filter((rel) => !seen.has(rel) && !unsent.has(rel));
  for (const rel of gone) {
    known.delete(rel);
    files.delete(`${disk.prefix}/${rel}`);
  }
  if (gone.length) pruneDirs();
  await read(changed);
  return changed.length + gone.length > 0;
}

/** Folders left with nothing in them (a source the Mac deleted) go, as they do on disk. */
function pruneDirs() {
  const full = new Set<string>(["/"]);
  for (const f of files.keys()) for (let d = parent(f); !full.has(d); d = parent(d)) full.add(d);
  for (const d of [...dirs]) if (d.startsWith(disk!.prefix + "/") && !full.has(d)) dirs.delete(d);
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
// appendJsonl reads a log's last byte ("r") to see whether it ends in a newline.
const open = new Map<number, string>();
export function openSync(p: string, flags?: string) {
  if (flags === "r") {
    if (!files.has(p)) throw err("ENOENT", p);
  } else {
    if (flags === "wx" && files.has(p)) throw err("EEXIST", p);
    put(p, files.get(p)?.text ?? "");
  }
  const fd = 3 + open.size;
  open.set(fd, p);
  return fd;
}
export function readSync(fd: number, buf: Uint8Array, offset: number, length: number, position: number) {
  // Positions count characters, as statSync's size does here.
  const bytes = new TextEncoder().encode((files.get(open.get(fd) ?? "")?.text ?? "").slice(position, position + length)).subarray(0, length);
  buf.set(bytes, offset);
  return bytes.length;
}
export const writeSync = (_fd: number, s: string) => s.length;
export const closeSync = (fd: number) => void open.delete(fd);
export const symlinkSync = () => {};
export const cpSync = () => {};
export function utimesSync(p: string, _atime: Date | number, mtime: Date | number) {
  const e = files.get(p);
  if (!e) throw err("ENOENT", p);
  put(p, e.text, +mtime);
}

export default {
  existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync, unlinkSync, rmSync, renameSync, copyFileSync, mkdtempSync,
  readdirSync, statSync, lstatSync, realpathSync, openSync, readSync, writeSync, closeSync, symlinkSync, cpSync, utimesSync,
};
