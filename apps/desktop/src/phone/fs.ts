// node:fs for the core on iPhone. The core reads and writes files synchronously, and a web view has no
// synchronous file API, so the library's text files live in memory. On the phone they come from Ore's
// iCloud Drive folder, which is the Mac's library (D78.6, D222): loaded at launch, every write sent back
// to the folder, and the Mac's changes read in again when the app comes back (`mountDisk`). In a browser
// (the e2e journeys, `vite` at phone size) they come from a snapshot, kept in IndexedDB (`mount`).

/** `bytes`: a binary file (an image, a PDF) as written, so a rename or copy moves it whole. */
type Entry = { text: string; mtime: number; bytes?: Uint8Array; unread?: true };
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
  if (disk) return p.startsWith(disk.prefix + "/") ? queue(p, e && e !== "tombstone" ? { text: e.text } : null) : undefined;
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
export async function mount(listed: Record<string, string | null>, id: string) {
  const snapshot: Record<string, string> = {};
  for (const [p, text] of Object.entries(listed)) {
    addDirs(p);
    // A file the phone doesn't load (audio, a PDF): listed only, as the folder's listing names it.
    if (text === null) {
      files.set(p, { text: "", mtime: 0, unread: true });
      continue;
    }
    snapshot[p] = text;
    files.set(p, { text, mtime: 1 });
    shipped.add(p);
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

/** A binary file's entry. Its text is made only when read (a shared .txt or .csv is), never kept: decoded
 *  up front, an hour's audio was a second copy twice its size. */
const binary = (bytes: Uint8Array, mtime: number, unread?: true): Entry => ({
  mtime,
  bytes,
  ...(unread && { unread }),
  get text() {
    return new TextDecoder().decode(bytes);
  },
});
/** `text` is the file's, or ignored when `bytes` are given. */
function put(p: string, text: string, mtime = Date.now(), bytes?: Uint8Array) {
  if (disk && downloading.has(rel(p))) throw Object.assign(new Error("This file is still downloading from iCloud: try again in a moment"), { code: "EBUSY" });
  const e: Entry = bytes ? binary(bytes, mtime) : { text, mtime };
  files.set(p, e);
  addDirs(p);
  if (SCRATCH.test(p)) return;
  if (bytes && disk) return p.startsWith(disk.prefix + "/") ? queue(p, { bytes }) : undefined;
  persist(p, e);
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

type Invoke = <T>(cmd: string, args: Record<string, unknown> | Uint8Array, options?: { headers: Record<string, string> }) => Promise<T>;
type Stamped = [rel: string, mtime: number, stamp: string];
type Scan = { files: Stamped[]; waiting: string[]; other?: string[] };
let disk: { root: string; prefix: string; invoke: Invoke } | null = null;
/** Each file's stamp (mtime and size) as last read or written, to tell what the Mac changed since. */
const known = new Map<string, string>();
/** Writes and deletes (null) not sent yet, by library path. The last one for a path wins, so an atomic
 *  write's temp file never reaches iCloud. A picture, audio or other binary goes as its raw bytes, one
 *  call each (lib.rs `library_write`): as base64 text an hour's audio cost several times its size. */
type Op = { text: string } | { bytes: Uint8Array } | null;
const unsent = new Map<string, Op>();
/** Paths this phone has sent or asked to delete since launch: a delete of one still goes to the folder
 *  even before the folder's stamp for it comes back (or a folder, which has no stamp). */
const sent = new Set<string>();
/** Files iCloud hasn't downloaded yet. Writing one would replace the real file with what the phone
 *  wrongly thinks is there (an empty log, say), so that waits until it arrives. */
const downloading = new Set<string>();
let sending: Promise<void> = Promise.resolve();
/** For Settings: when the folder last took a write or a scan, and the last write it refused. */
let lastSync = 0;
let lastError: string | null = null;
export const syncState = () => ({ icloud: !!disk, at: lastSync, unsent: unsent.size, downloading: downloading.size, error: lastError });
let timer: ReturnType<typeof setTimeout> | undefined;

const rel = (p: string) => p.slice(disk!.prefix.length + 1);
function queue(p: string, op: Op) {
  unsent.set(rel(p), op);
  timer ??= setTimeout(flush, 0);
}

/** The files the folder's listing reports (apps/phone/src-tauri/src/lib.rs `wanted`); only these are
 *  watched for the Mac's changes. */
const LISTED = /(\.(md|ya?ml|jsonl?|excalidraw|vtt)|\/(thumbnail|course-cover)\.(jpe?g|png|webp|gif))$/i;

const HEAVY = /\.(mp3|m4a|wav|aac|aiff|flac|mp4|mov|m4v)$/i;

/** Sends the writes made so far to the folder; resolves once they are on disk. */
export function flush(): Promise<void> {
  clearTimeout(timer);
  timer = undefined;
  const ops = [...unsent].filter(([r, op]) => op !== null || known.has(r) || sent.has(r));
  unsent.clear();
  if (!ops.length || !disk) return sending;
  for (const [r] of ops) sent.add(r);
  const { root, invoke } = disk;
  sending = sending.then(async () => {
    try {
      const stamps: Stamped[] = [];
      const enc = encodeURIComponent;
      // In the order they were made (a folder's delete before a file written into it), text and deletes in batches.
      let batch: [string, string | null, boolean][] = [];
      const send = async () => {
        if (batch.length) stamps.push(...(await invoke<Stamped[]>("library_apply", { root, ops: batch })));
        batch = [];
      };
      for (const [r, op] of ops) {
        if (!op || "text" in op) batch.push([r, op?.text ?? null, false]);
        else (await send(), stamps.push(await invoke<Stamped>("library_write", op.bytes, { headers: { "x-root": enc(root), "x-path": enc(r) } })));
      }
      await send();
      // Audio and video on disk leave memory: nothing reads them back here (they play from the folder), and an
      // hour's episode is 60 MB or more. Listed like any file the phone doesn't load.
      for (const [r, op] of ops) {
        const p = `${disk!.prefix}/${r}`;
        if (op && "bytes" in op && HEAVY.test(r) && files.get(p)?.bytes === op.bytes) files.set(p, { text: "", mtime: Date.now(), unread: true });
      }
      for (const [r, ms, stamp] of stamps) {
        if (LISTED.test("/" + r)) known.set(r, stamp);
        const e = files.get(`${disk!.prefix}/${r}`);
        if (e) e.mtime = ms;
      }
      [lastSync, lastError] = [Date.now(), null];
      for (const [r, op] of ops) if (op === null) for (const k of [...known.keys()]) if (k === r || k.startsWith(r + "/")) known.delete(k);
    } catch (e) {
      // Kept for the next try, unless a newer write replaced it.
      for (const [r, op] of ops) if (!unsent.has(r)) unsent.set(r, op);
      lastError = String(e);
      dispatchEvent(new CustomEvent("ore:save-failed", { detail: String(e) }));
    }
  });
  return sending;
}

/** Loads the library from the folder. On a first launch iCloud may still be downloading it: waits for
 *  that (transcripts aside), up to a minute; what still hasn't come keeps the phone from writing over it (`downloading`). */
export async function mountDisk(prefix: string, root: string, invoke: Invoke) {
  disk = { root, prefix, invoke };
  let scan = await invoke<Scan>("library_scan", { root });
  // Only for what the lists need: a transcript still on its way (they are large, and many) comes in with a
  // later look at the folder, and never holds up the launch (it once did, for 72 s).
  const held = () => scan.waiting.some((r) => !/\.vtt$/i.test(r));
  for (let i = 0; held() && i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    scan = await invoke<Scan>("library_scan", { root });
  }
  setDownloading(scan.waiting);
  await read(scan.files);
  listOthers(scan.other);
  lastSync = Date.now();
  // iOS may suspend the app soon after it leaves the screen: what it wrote goes now.
  addEventListener("visibilitychange", () => document.hidden && void flush());
}

/** Files the phone doesn't load (a source's audio or PDF) still show in the folder's listing, so the core
 *  finds them (`sourceFile`); the screens open them from disk (convertFileSrc). */
function listOthers(other: string[] = []) {
  // One the Mac deleted since leaves the listing too.
  const now = new Set(other.map((r) => `${disk!.prefix}/${r}`));
  let gone = false;
  for (const [p, e] of files) if (e.unread && !now.has(p)) gone = files.delete(p);
  if (gone) pruneDirs();
  for (const r of other) {
    const p = `${disk!.prefix}/${r}`;
    if (files.has(p)) continue;
    files.set(p, { text: "", mtime: 0, unread: true });
    addDirs(p);
  }
}

/** Loads one listed file's bytes from the folder, so the core can read it: a file the share sheet saved to
 *  the inbox. False when it isn't there to load. */
export async function load(p: string): Promise<boolean> {
  const e = files.get(p);
  if (!e) return false;
  if (!e.unread || e.bytes) return true;
  if (!disk) return false;
  const b64 = await disk.invoke<string | null>("library_bytes", { root: disk.root, path: rel(p) });
  if (b64 == null) return false;
  files.set(p, binary(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)), e.mtime, true));
  return true;
}

function setDownloading(waiting: string[]) {
  downloading.clear();
  for (const r of waiting) downloading.add(r);
}

async function read(list: Stamped[]) {
  for (let i = 0; i < list.length; i += 400) {
    const part = list.slice(i, i + 400);
    const texts = await disk!.invoke<(string | null)[]>("library_read", { root: disk!.root, paths: part.map(([r]) => r) });
    part.forEach(([r, mtime, stamp], j) => {
      if (unsent.has(r)) return;
      // One that can't be read (not UTF-8) is still marked as seen, or every rescan would count it as changed.
      known.set(r, stamp);
      const text = texts[j];
      if (text == null) return;
      const p = `${disk!.prefix}/${r}`;
      files.set(p, { text, mtime });
      addDirs(p);
    });
  }
}

/** Reads in what changed in the folder since (the Mac's edits, through iCloud); true if anything did.
 *  A file this phone is still sending keeps the phone's version. */
export async function rescan(): Promise<boolean> {
  if (!disk) return false;
  await flush();
  const scan = await disk.invoke<Scan>("library_scan", { root: disk.root });
  setDownloading(scan.waiting);
  const seen = new Set([...scan.files.map(([rel]) => rel), ...scan.waiting]);
  const changed = scan.files.filter(([r, , stamp]) => known.get(r) !== stamp && !unsent.has(r));
  const gone = [...known.keys()].filter((r) => !seen.has(r) && !unsent.has(r));
  for (const r of gone) {
    known.delete(r);
    files.delete(`${disk.prefix}/${r}`);
  }
  if (gone.length) pruneDirs();
  await read(changed);
  listOthers(scan.other);
  lastSync = Date.now();
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
/** A binary file read with no encoding, as Node's Buffer is: its bytes, and its text if printed. */
class Bytes extends Uint8Array {
  toString() {
    return new TextDecoder().decode(this);
  }
}
/** With an encoding, the text. With none, a file saved as bytes (a picked PDF, a picture) comes back as its
 *  bytes, as Node gives a Buffer; a text file still comes back as text, which every caller here expects. */
export function readFileSync(p: string, enc?: unknown): string {
  const e = files.get(p);
  if (!e) throw err("ENOENT", p);
  if (e.unread && !e.bytes) throw Object.assign(new Error(`not loaded on iPhone: ${p}`), { code: "EISDIR" });
  if (enc === undefined && e.bytes) return Bytes.from(e.bytes) as unknown as string;
  return e.text;
}
export const writeFileSync = (p: string, s: string | Uint8Array) => (typeof s === "string" ? put(p, s) : put(p, "", Date.now(), s));
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
  // A folder goes whole on disk, with what the phone never loaded (a source's original PDF).
  if (disk && dirs.has(p) && p.startsWith(disk.prefix + "/")) {
    sent.add(rel(p));
    queue(p, null);
  }
  for (const f of [...files.keys()]) if (f === p || f.startsWith(p + "/")) drop(f);
  for (const d of [...dirs]) if (d === p || d.startsWith(p + "/")) dirs.delete(d);
}
export function renameSync(a: string, b: string) {
  copyFileSync(a, b);
  drop(a);
}
export const copyFileSync = (a: string, b: string) => {
  readFileSync(a); // throws for a missing file, and for one the phone lists but hasn't loaded
  const e = files.get(a)!;
  put(b, e.bytes ? "" : e.text, Date.now(), e.bytes);
};
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
  return { mtimeMs: m, mtime: new Date(m), size: e?.bytes?.length ?? e?.text.length ?? 0, isDirectory: () => !e, isFile: () => !!e };
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
