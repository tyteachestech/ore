const files = new Map();
/** The snapshot's paths: only these need a tombstone when deleted. */
const shipped = new Set();
const dirs = new Set(["/"]);
const parent = (p) => p.slice(0, p.lastIndexOf("/")) || "/";
function addDirs(p) {
	for (let d = parent(p); !dirs.has(d); d = parent(d)) dirs.add(d);
}
const err = (code, p) => Object.assign(new Error(`${code}: ${p}`), { code });
// ---- persistence: writes and deletes go to IndexedDB in the background, in order.
let db = null;
let chain = Promise.resolve();
/** `e`: the file to keep, "tombstone" for a deleted snapshot file, null to forget the path. */
function persist(p, e) {
	if (disk) return p.startsWith(disk.prefix + "/") ? queue(p, e && e !== "tombstone" ? { text: e.text } : null) : undefined;
	if (!db) return;
	chain = chain.then(() => new Promise((done) => {
		// Done once the transaction has committed, not when the request answers: a reload in between drops the write.
		const tx = db.transaction("files", "readwrite"), store = tx.objectStore("files");
		if (e === "tombstone") store.put(null, p);
		else if (e) store.put(e, p);
		else store.delete(p);
		tx.oncomplete = tx.onerror = tx.onabort = () => done();
	}));
}
/** Resolves once every write made so far is in IndexedDB (the browser build; the phone's folder has `flush`). */
export const saved = () => chain;
/** Loads the shipped snapshot, then the writes made on this phone on top, kept across new builds. Until
*  sync, a new build is the only way the Mac's changes arrive, so on a new snapshot each file the Mac
*  changed (or added, or deleted) since the last one takes the Mac's version; every other phone write
*  stays, and the phone's own logs (`*.iphone.jsonl`, D78) always do. */
export async function mount(listed, id) {
	const snapshot = {};
	for (const [p, text] of Object.entries(listed)) {
		addDirs(p);
		// A file the phone doesn't load (audio, a PDF): listed only, as the folder's listing names it.
		if (text === null) {
			files.set(p, {
				text: "",
				mtime: 0,
				unread: true
			});
			continue;
		}
		snapshot[p] = text;
		files.set(p, {
			text,
			mtime: 1
		});
		shipped.add(p);
	}
	// Ask iOS not to clear the phone's library when storage runs low.
	await navigator.storage?.persist?.().catch(() => false);
	db = await new Promise((ok, fail) => {
		const r = indexedDB.open("ore-phone", 1);
		r.onupgradeneeded = () => r.result.createObjectStore("files");
		r.onsuccess = () => ok(r.result);
		r.onerror = () => fail(r.error);
	});
	const store = (mode) => db.transaction("files", mode).objectStore("files");
	const get = (key) => new Promise((done) => {
		const r = store("readonly").get(key);
		r.onsuccess = () => done(r.result);
		r.onerror = () => done(null);
	});
	const fresh = Object.fromEntries(Object.entries(snapshot).map(([p, t]) => [p, hash(t)]));
	if (await get(SNAPSHOT) !== id) {
		const before = await get(HASHES) ?? null;
		const keys = await new Promise((done) => {
			const r = store("readonly").getAllKeys();
			r.onsuccess = () => done(r.result.map(String));
			r.onerror = () => done([]);
		});
		const macChanged = (p) => !before || before[p] !== fresh[p];
		await new Promise((done) => {
			const s = store("readwrite");
			for (const p of keys) if (p !== SNAPSHOT && p !== HASHES && !OWN_LOG.test(p) && macChanged(p)) s.delete(p);
			s.put(id, SNAPSHOT);
			const r = s.put(fresh, HASHES);
			r.onsuccess = r.onerror = () => done();
		});
	}
	await new Promise((done) => {
		const r = store("readonly").openCursor();
		r.onsuccess = () => {
			const c = r.result;
			if (!c) return done();
			const p = String(c.key);
			if (p === SNAPSHOT || p === HASHES) return c.continue();
			if (c.value === null) files.delete(p);
			else {
				files.set(p, c.value);
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
function hash(s) {
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
	return (h >>> 0).toString(36) + s.length.toString(36);
}
/** The IndexedDB key that holds which snapshot the phone's writes sit on. */
const SNAPSHOT = "#snapshot";
/** A binary file's entry. Its text is made only when read (a shared .txt or .csv is), never kept: decoded
*  up front, an hour's audio was a second copy twice its size. */
const binary = (bytes, mtime, unread) => ({
	mtime,
	bytes,
	...unread && { unread },
	get text() {
		return new TextDecoder().decode(bytes);
	}
});
/** `text` is the file's, or ignored when `bytes` are given. */
function put(p, text, mtime = Date.now(), bytes) {
	if (disk && downloading.has(rel(p))) throw Object.assign(new Error("This file is still downloading from iCloud: try again in a moment"), { code: "EBUSY" });
	const e = bytes ? binary(bytes, mtime) : {
		text,
		mtime
	};
	files.set(p, e);
	addDirs(p);
	if (SCRATCH.test(p)) return;
	if (bytes && disk) return p.startsWith(disk.prefix + "/") ? queue(p, { bytes }) : undefined;
	persist(p, e);
}
/** The lock and the search index are rebuilt each launch, never kept. */
const SCRATCH = /\/\.(ore|index)\//;
function drop(p) {
	files.delete(p);
	if (SCRATCH.test(p)) return;
	// A file from the snapshot gets a tombstone, so it stays deleted after a relaunch. One made on the
	// phone (every atomic write's temp file among them) is simply removed, or IndexedDB would keep a
	// dead key for each save.
	persist(p, shipped.has(p) ? "tombstone" : null);
}
let disk = null;
/** Each file's stamp (mtime and size) as last read or written, to tell what the Mac changed since. */
const known = new Map();
/** Files whose read came back null, by stamp, and how many times at it: a failed read may pass on the next
*  scan (iCloud still writing it), but one that never reads (not UTF-8) is asked again only once it changes. */
const failed = new Map();
const TRIES = 3;
const unsent = new Map();
/** Paths this phone has sent or asked to delete since launch: a delete of one still goes to the folder
*  even before the folder's stamp for it comes back (or a folder, which has no stamp). */
const sent = new Set();
/** The flush that last sent each path: a failed batch keeps a path for the next try only while no newer
*  flush has taken it, or a retry would put back an older write over a newer one that went through. */
const sentBy = new Map();
let flushes = 0;
/** Files iCloud hasn't downloaded yet. Writing one would replace the real file with what the phone
*  wrongly thinks is there (an empty log, say), so that waits until it arrives. */
const downloading = new Set();
let sending = Promise.resolve();
/** For Settings: when the folder last took a write or a scan, and the last write it refused. */
let lastSync = 0;
let lastError = null;
export const syncState = () => ({
	icloud: !!disk,
	at: lastSync,
	unsent: unsent.size,
	downloading: downloading.size,
	error: lastError
});
let timer;
const rel = (p) => p.slice(disk.prefix.length + 1);
function queue(p, op) {
	unsent.set(rel(p), op);
	timer ??= setTimeout(flush, 0);
}
/** The files the folder's listing reports (apps/phone/src-tauri/src/lib.rs `wanted`); only these are
*  watched for the Mac's changes. */
const LISTED = /(\.(md|ya?ml|jsonl?|excalidraw|vtt)|\/(thumbnail|course-cover)\.(jpe?g|png|webp|gif))$/i;
const HEAVY = /\.(mp3|m4a|wav|aac|aiff|flac|mp4|mov|m4v)$/i;
/** Sends the writes made so far to the folder; resolves once they are on disk. */
export function flush() {
	clearTimeout(timer);
	timer = undefined;
	const ops = [...unsent].filter(([r, op]) => op !== null || known.has(r) || sent.has(r));
	unsent.clear();
	if (!ops.length || !disk) return sending;
	const n = ++flushes;
	for (const [r] of ops) sent.add(r), sentBy.set(r, n);
	const { root, invoke } = disk;
	sending = sending.then(async () => {
		try {
			const stamps = [];
			const enc = encodeURIComponent;
			// In the order they were made (a folder's delete before a file written into it), text and deletes in batches.
			let batch = [];
			const send = async () => {
				if (batch.length) stamps.push(...await invoke("library_apply", {
					root,
					ops: batch
				}));
				batch = [];
			};
			for (const [r, op] of ops) {
				if (!op || "text" in op) batch.push([
					r,
					op?.text ?? null,
					false
				]);
				else await send(), stamps.push(await invoke("library_write", op.bytes, { headers: {
					"x-root": enc(root),
					"x-path": enc(r)
				} }));
			}
			await send();
			// Audio and video on disk leave memory: nothing reads them back here (they play from the folder), and an
			// hour's episode is 60 MB or more. Listed like any file the phone doesn't load.
			for (const [r, op] of ops) {
				const p = `${disk.prefix}/${r}`;
				if (op && "bytes" in op && HEAVY.test(r) && files.get(p)?.bytes === op.bytes) files.set(p, {
					text: "",
					mtime: Date.now(),
					unread: true
				});
			}
			for (const [r, ms, stamp] of stamps) {
				if (LISTED.test("/" + r)) known.set(r, stamp);
				const e = files.get(`${disk.prefix}/${r}`);
				if (e) e.mtime = ms;
			}
			[lastSync, lastError] = [Date.now(), null];
			for (const [r, op] of ops) if (op === null) {
				for (const k of [...known.keys()]) if (k === r || k.startsWith(r + "/")) known.delete(k);
			}
		} catch (e) {
			// Kept for the next try, unless a newer write replaced it (still unsent, or sent since).
			for (const [r, op] of ops) if (!unsent.has(r) && sentBy.get(r) === n) unsent.set(r, op);
			lastError = String(e);
			dispatchEvent(new CustomEvent("ore:save-failed", { detail: String(e) }));
		}
	});
	return sending;
}
/** Loads the library from the folder. On a first launch iCloud may still be downloading it: waits for
*  that (transcripts aside), up to a minute; what still hasn't come keeps the phone from writing over it (`downloading`). */
export async function mountDisk(prefix, root, invoke) {
	disk = {
		root,
		prefix,
		invoke
	};
	let scan = await invoke("library_scan", { root });
	// Only for what the lists need: a transcript still on its way (they are large, and many) comes in with a
	// later look at the folder, and never holds up the launch (it once did, for 72 s).
	const held = () => scan.waiting.some((r) => !/\.vtt$/i.test(r));
	for (let i = 0; held() && i < 60; i++) {
		await new Promise((r) => setTimeout(r, 1e3));
		scan = await invoke("library_scan", { root });
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
function listOthers(other = []) {
	// One the Mac deleted since leaves the listing too.
	const now = new Set(other.map((r) => `${disk.prefix}/${r}`));
	let gone = false;
	for (const [p, e] of files) if (e.unread && !now.has(p)) gone = files.delete(p);
	if (gone) pruneDirs();
	for (const r of other) {
		const p = `${disk.prefix}/${r}`;
		if (files.has(p)) continue;
		files.set(p, {
			text: "",
			mtime: 0,
			unread: true
		});
		addDirs(p);
	}
}
/** Loads one listed file's bytes from the folder, so the core can read it: a file the share sheet saved to
*  the inbox. False when it isn't there to load. */
export async function load(p) {
	const e = files.get(p);
	if (!e) return false;
	if (!e.unread || e.bytes) return true;
	if (!disk) return false;
	const b64 = await disk.invoke("library_bytes", {
		root: disk.root,
		path: rel(p)
	});
	if (b64 == null) return false;
	files.set(p, binary(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)), e.mtime, true));
	return true;
}
function setDownloading(waiting) {
	downloading.clear();
	for (const r of waiting) downloading.add(r);
}
/** Reads in `list`; how many came in. One that can't be read (gone, a failed read, not UTF-8: lib.rs answers
*  null for each) isn't marked as seen, so the next rescans ask again (TRIES in all) rather than keep stale text. */
async function read(list) {
	let landed = 0;
	const parts = [];
	for (let i = 0; i < list.length; i += 400) parts.push(list.slice(i, i + 400));
	// Asked for together: one after another, seven parts of a 950-source library held the launch about 260 ms.
	const got = await Promise.all(parts.map((part) => disk.invoke("library_read", {
		root: disk.root,
		paths: part.map(([r]) => r)
	})));
	parts.forEach((part, n) => {
		const texts = got[n];
		part.forEach(([r, mtime, stamp], j) => {
			if (unsent.has(r)) return;
			const text = texts[j];
			if (text == null) {
				const f = failed.get(r);
				failed.set(r, {
					stamp,
					tries: f?.stamp === stamp ? f.tries + 1 : 1
				});
				return;
			}
			failed.delete(r);
			known.set(r, stamp);
			landed++;
			const p = `${disk.prefix}/${r}`;
			files.set(p, {
				text,
				mtime
			});
			addDirs(p);
		});
	});
	return landed;
}
/** Reads in what changed in the folder since (the Mac's edits, through iCloud); true if anything did.
*  A file this phone is still sending keeps the phone's version. */
export async function rescan() {
	if (!disk) return false;
	await flush();
	const scan = await disk.invoke("library_scan", { root: disk.root });
	setDownloading(scan.waiting);
	const seen = new Set([...scan.files.map(([rel]) => rel), ...scan.waiting]);
	const given = (r, stamp) => failed.get(r)?.stamp === stamp && failed.get(r).tries >= TRIES;
	const changed = scan.files.filter(([r, , stamp]) => known.get(r) !== stamp && !unsent.has(r) && !given(r, stamp));
	const gone = [...known.keys()].filter((r) => !seen.has(r) && !unsent.has(r));
	for (const r of gone) {
		known.delete(r);
		files.delete(`${disk.prefix}/${r}`);
	}
	if (gone.length) pruneDirs();
	for (const r of failed.keys()) if (!seen.has(r)) failed.delete(r);
	const landed = await read(changed);
	listOthers(scan.other);
	lastSync = Date.now();
	// Only what came in counts: a file that still can't be read is asked again, but changes nothing.
	return landed + gone.length > 0;
}
/** Folders left with nothing in them (a source the Mac deleted) go, as they do on disk. */
function pruneDirs() {
	const full = new Set(["/"]);
	for (const f of files.keys()) for (let d = parent(f); !full.has(d); d = parent(d)) full.add(d);
	for (const d of [...dirs]) if (d.startsWith(disk.prefix + "/") && !full.has(d)) dirs.delete(d);
}
// ---- the node:fs functions the core uses.
export const existsSync = (p) => files.has(p) || dirs.has(p);
/** A binary file read with no encoding, as Node's Buffer is: its bytes, and its text if printed. */
class Bytes extends Uint8Array {
	toString() {
		return new TextDecoder().decode(this);
	}
}
/** With an encoding, the text. With none, a file saved as bytes (a picked PDF, a picture) comes back as its
*  bytes, as Node gives a Buffer; a text file still comes back as text, which every caller here expects. */
function __deep_readFileSync(p, enc) {
	const e = files.get(p);
	if (!e) throw err("ENOENT", p);
	if (e.unread && !e.bytes) throw Object.assign(new Error(`not loaded on iPhone: ${p}`), { code: "EISDIR" });
	// One block copy: Bytes.from walked an hour's audio byte by byte and held over a gigabyte while it did.
	if (enc === undefined && e.bytes) return new Bytes(e.bytes);
	return e.text;
}
export const writeFileSync = (p, s) => typeof s === "string" ? put(p, s) : put(p, "", Date.now(), s);
export const appendFileSync = (p, s) => put(p, (files.get(p)?.text ?? "") + s);
export function mkdirSync(p, _o) {
	// The folder and every parent not made yet: adding p first stopped addDirs at once (it stops at a known
	// folder), so a first source in an empty library left items/ unlisted and the source nowhere.
	addDirs(p + "/x");
}
export const unlinkSync = (p) => {
	if (!files.has(p)) throw err("ENOENT", p);
	drop(p);
};
export function rmSync(p, _o) {
	// A folder goes whole on disk, with what the phone never loaded (a source's original PDF).
	if (disk && dirs.has(p) && p.startsWith(disk.prefix + "/")) {
		sent.add(rel(p));
		queue(p, null);
	}
	for (const f of [...files.keys()]) if (f === p || f.startsWith(p + "/")) drop(f);
	for (const d of [...dirs]) if (d === p || d.startsWith(p + "/")) dirs.delete(d);
}
export function renameSync(a, b) {
	copyFileSync(a, b);
	drop(a);
}
export const copyFileSync = (a, b) => {
	readFileSync(a);
	const e = files.get(a);
	put(b, e.bytes ? "" : e.text, Date.now(), e.bytes);
};
// copyFileSync's flags (core asks for a clone, COPYFILE_FICLONE): the phone's copy is in memory either way.
export const constants = { COPYFILE_FICLONE: 2 };
export const mkdtempSync = (prefix) => {
	const d = `${prefix}${Math.random().toString(36).slice(2, 8)}`;
	mkdirSync(d);
	return d;
};
function __deep_readdirSync(p, o) {
	if (!dirs.has(p)) throw err("ENOENT", p);
	const pre = p.endsWith("/") ? p : p + "/";
	const names = new Map();
	for (const f of files.keys()) {
		if (!f.startsWith(pre)) continue;
		const rest = f.slice(pre.length);
		const i = rest.indexOf("/");
		names.set(i < 0 ? rest : rest.slice(0, i), i >= 0);
	}
	for (const d of dirs) if (d.startsWith(pre) && d.length > pre.length && !d.slice(pre.length).includes("/")) names.set(d.slice(pre.length), true);
	const list = [...names].sort(([a], [b]) => a < b ? -1 : 1);
	return o?.withFileTypes ? list.map(([name, dir]) => ({
		name,
		isDirectory: () => dir,
		isFile: () => !dir
	})) : list.map(([n]) => n);
}
function __deep_statSync(p) {
	if (!existsSync(p)) throw err("ENOENT", p);
	const e = files.get(p);
	const m = e?.mtime ?? 1;
	return {
		mtimeMs: m,
		mtime: new Date(m),
		size: e?.bytes?.length ?? e?.text.length ?? 0,
		isDirectory: () => !e,
		isFile: () => !!e
	};
}
export const lstatSync = statSync;
export const realpathSync = (p) => p;
// The library lock (lock.ts) is a file opened exclusively; the phone runs one command at a time.
// appendJsonl reads a log's last byte ("r") to see whether it ends in a newline.
const open = new Map();
export function openSync(p, flags) {
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
export function readSync(fd, buf, offset, length, position) {
	// Positions count characters, as statSync's size does here.
	const bytes = new TextEncoder().encode((files.get(open.get(fd) ?? "")?.text ?? "").slice(position, position + length)).subarray(0, length);
	buf.set(bytes, offset);
	return bytes.length;
}
export const writeSync = (_fd, s) => s.length;
export const closeSync = (fd) => void open.delete(fd);
export const symlinkSync = () => {};
export const cpSync = () => {};
export function utimesSync(p, _atime, mtime) {
	const e = files.get(p);
	if (!e) throw err("ENOENT", p);
	put(p, e.text, +mtime);
}
export default {
	existsSync,
	readFileSync,
	writeFileSync,
	appendFileSync,
	mkdirSync,
	unlinkSync,
	rmSync,
	renameSync,
	copyFileSync,
	constants,
	mkdtempSync,
	readdirSync,
	statSync,
	lstatSync,
	realpathSync,
	openSync,
	readSync,
	writeSync,
	closeSync,
	symlinkSync,
	cpSync,
	utimesSync
};

//# sourceMappingURL=data:application/json;base64,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O0NBQVc7Q0FBYztDQUFVO0NBQVU7Q0FBVztDQUFXO0NBQWE7Q0FBUTtBQUNqSCIsIm5hbWVzIjpbXSwic291cmNlcyI6WyJmcy50cyJdLCJ2ZXJzaW9uIjozLCJzb3VyY2VzQ29udGVudCI6WyIvLyBub2RlOmZzIGZvciB0aGUgY29yZSBvbiBpUGhvbmUuIFRoZSBjb3JlIHJlYWRzIGFuZCB3cml0ZXMgZmlsZXMgc3luY2hyb25vdXNseSwgYW5kIGEgd2ViIHZpZXcgaGFzIG5vXG4vLyBzeW5jaHJvbm91cyBmaWxlIEFQSSwgc28gdGhlIGxpYnJhcnkncyB0ZXh0IGZpbGVzIGxpdmUgaW4gbWVtb3J5LiBPbiB0aGUgcGhvbmUgdGhleSBjb21lIGZyb20gT3JlJ3Ncbi8vIGlDbG91ZCBEcml2ZSBmb2xkZXIsIHdoaWNoIGlzIHRoZSBNYWMncyBsaWJyYXJ5IChENzguNiwgRDIyMik6IGxvYWRlZCBhdCBsYXVuY2gsIGV2ZXJ5IHdyaXRlIHNlbnQgYmFja1xuLy8gdG8gdGhlIGZvbGRlciwgYW5kIHRoZSBNYWMncyBjaGFuZ2VzIHJlYWQgaW4gYWdhaW4gd2hlbiB0aGUgYXBwIGNvbWVzIGJhY2sgKGBtb3VudERpc2tgKS4gSW4gYSBicm93c2VyXG4vLyAodGhlIGUyZSBqb3VybmV5cywgYHZpdGVgIGF0IHBob25lIHNpemUpIHRoZXkgY29tZSBmcm9tIGEgc25hcHNob3QsIGtlcHQgaW4gSW5kZXhlZERCIChgbW91bnRgKS5cblxuLyoqIGBieXRlc2A6IGEgYmluYXJ5IGZpbGUgKGFuIGltYWdlLCBhIFBERikgYXMgd3JpdHRlbiwgc28gYSByZW5hbWUgb3IgY29weSBtb3ZlcyBpdCB3aG9sZS4gKi9cbnR5cGUgRW50cnkgPSB7IHRleHQ6IHN0cmluZzsgbXRpbWU6IG51bWJlcjsgYnl0ZXM/OiBVaW50OEFycmF5OyB1bnJlYWQ/OiB0cnVlIH07XG5jb25zdCBmaWxlcyA9IG5ldyBNYXA8c3RyaW5nLCBFbnRyeT4oKTtcbi8qKiBUaGUgc25hcHNob3QncyBwYXRoczogb25seSB0aGVzZSBuZWVkIGEgdG9tYnN0b25lIHdoZW4gZGVsZXRlZC4gKi9cbmNvbnN0IHNoaXBwZWQgPSBuZXcgU2V0PHN0cmluZz4oKTtcbmNvbnN0IGRpcnMgPSBuZXcgU2V0PHN0cmluZz4oW1wiL1wiXSk7XG5cbmNvbnN0IHBhcmVudCA9IChwOiBzdHJpbmcpID0+IHAuc2xpY2UoMCwgcC5sYXN0SW5kZXhPZihcIi9cIikpIHx8IFwiL1wiO1xuZnVuY3Rpb24gYWRkRGlycyhwOiBzdHJpbmcpIHtcbiAgZm9yIChsZXQgZCA9IHBhcmVudChwKTsgIWRpcnMuaGFzKGQpOyBkID0gcGFyZW50KGQpKSBkaXJzLmFkZChkKTtcbn1cbmNvbnN0IGVyciA9IChjb2RlOiBzdHJpbmcsIHA6IHN0cmluZykgPT4gT2JqZWN0LmFzc2lnbihuZXcgRXJyb3IoYCR7Y29kZX06ICR7cH1gKSwgeyBjb2RlIH0pO1xuXG4vLyAtLS0tIHBlcnNpc3RlbmNlOiB3cml0ZXMgYW5kIGRlbGV0ZXMgZ28gdG8gSW5kZXhlZERCIGluIHRoZSBiYWNrZ3JvdW5kLCBpbiBvcmRlci5cblxubGV0IGRiOiBJREJEYXRhYmFzZSB8IG51bGwgPSBudWxsO1xubGV0IGNoYWluOiBQcm9taXNlPHZvaWQ+ID0gUHJvbWlzZS5yZXNvbHZlKCk7XG4vKiogYGVgOiB0aGUgZmlsZSB0byBrZWVwLCBcInRvbWJzdG9uZVwiIGZvciBhIGRlbGV0ZWQgc25hcHNob3QgZmlsZSwgbnVsbCB0byBmb3JnZXQgdGhlIHBhdGguICovXG5mdW5jdGlvbiBwZXJzaXN0KHA6IHN0cmluZywgZTogRW50cnkgfCBcInRvbWJzdG9uZVwiIHwgbnVsbCkge1xuICBpZiAoZGlzaykgcmV0dXJuIHAuc3RhcnRzV2l0aChkaXNrLnByZWZpeCArIFwiL1wiKSA/IHF1ZXVlKHAsIGUgJiYgZSAhPT0gXCJ0b21ic3RvbmVcIiA/IHsgdGV4dDogZS50ZXh0IH0gOiBudWxsKSA6IHVuZGVmaW5lZDtcbiAgaWYgKCFkYikgcmV0dXJuO1xuICBjaGFpbiA9IGNoYWluLnRoZW4oXG4gICAgKCkgPT5cbiAgICAgIG5ldyBQcm9taXNlPHZvaWQ+KChkb25lKSA9PiB7XG4gICAgICAgIC8vIERvbmUgb25jZSB0aGUgdHJhbnNhY3Rpb24gaGFzIGNvbW1pdHRlZCwgbm90IHdoZW4gdGhlIHJlcXVlc3QgYW5zd2VyczogYSByZWxvYWQgaW4gYmV0d2VlbiBkcm9wcyB0aGUgd3JpdGUuXG4gICAgICAgIGNvbnN0IHR4ID0gZGIhLnRyYW5zYWN0aW9uKFwiZmlsZXNcIiwgXCJyZWFkd3JpdGVcIiksIHN0b3JlID0gdHgub2JqZWN0U3RvcmUoXCJmaWxlc1wiKTtcbiAgICAgICAgaWYgKGUgPT09IFwidG9tYnN0b25lXCIpIHN0b3JlLnB1dChudWxsLCBwKTtcbiAgICAgICAgZWxzZSBpZiAoZSkgc3RvcmUucHV0KGUsIHApO1xuICAgICAgICBlbHNlIHN0b3JlLmRlbGV0ZShwKTtcbiAgICAgICAgdHgub25jb21wbGV0ZSA9IHR4Lm9uZXJyb3IgPSB0eC5vbmFib3J0ID0gKCkgPT4gZG9uZSgpO1xuICAgICAgfSksXG4gICk7XG59XG4vKiogUmVzb2x2ZXMgb25jZSBldmVyeSB3cml0ZSBtYWRlIHNvIGZhciBpcyBpbiBJbmRleGVkREIgKHRoZSBicm93c2VyIGJ1aWxkOyB0aGUgcGhvbmUncyBmb2xkZXIgaGFzIGBmbHVzaGApLiAqL1xuZXhwb3J0IGNvbnN0IHNhdmVkID0gKCk6IFByb21pc2U8dm9pZD4gPT4gY2hhaW47XG5cbi8qKiBMb2FkcyB0aGUgc2hpcHBlZCBzbmFwc2hvdCwgdGhlbiB0aGUgd3JpdGVzIG1hZGUgb24gdGhpcyBwaG9uZSBvbiB0b3AsIGtlcHQgYWNyb3NzIG5ldyBidWlsZHMuIFVudGlsXG4gKiAgc3luYywgYSBuZXcgYnVpbGQgaXMgdGhlIG9ubHkgd2F5IHRoZSBNYWMncyBjaGFuZ2VzIGFycml2ZSwgc28gb24gYSBuZXcgc25hcHNob3QgZWFjaCBmaWxlIHRoZSBNYWNcbiAqICBjaGFuZ2VkIChvciBhZGRlZCwgb3IgZGVsZXRlZCkgc2luY2UgdGhlIGxhc3Qgb25lIHRha2VzIHRoZSBNYWMncyB2ZXJzaW9uOyBldmVyeSBvdGhlciBwaG9uZSB3cml0ZVxuICogIHN0YXlzLCBhbmQgdGhlIHBob25lJ3Mgb3duIGxvZ3MgKGAqLmlwaG9uZS5qc29ubGAsIEQ3OCkgYWx3YXlzIGRvLiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG1vdW50KGxpc3RlZDogUmVjb3JkPHN0cmluZywgc3RyaW5nIHwgbnVsbD4sIGlkOiBzdHJpbmcpIHtcbiAgY29uc3Qgc25hcHNob3Q6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcbiAgZm9yIChjb25zdCBbcCwgdGV4dF0gb2YgT2JqZWN0LmVudHJpZXMobGlzdGVkKSkge1xuICAgIGFkZERpcnMocCk7XG4gICAgLy8gQSBmaWxlIHRoZSBwaG9uZSBkb2Vzbid0IGxvYWQgKGF1ZGlvLCBhIFBERik6IGxpc3RlZCBvbmx5LCBhcyB0aGUgZm9sZGVyJ3MgbGlzdGluZyBuYW1lcyBpdC5cbiAgICBpZiAodGV4dCA9PT0gbnVsbCkge1xuICAgICAgZmlsZXMuc2V0KHAsIHsgdGV4dDogXCJcIiwgbXRpbWU6IDAsIHVucmVhZDogdHJ1ZSB9KTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBzbmFwc2hvdFtwXSA9IHRleHQ7XG4gICAgZmlsZXMuc2V0KHAsIHsgdGV4dCwgbXRpbWU6IDEgfSk7XG4gICAgc2hpcHBlZC5hZGQocCk7XG4gIH1cbiAgLy8gQXNrIGlPUyBub3QgdG8gY2xlYXIgdGhlIHBob25lJ3MgbGlicmFyeSB3aGVuIHN0b3JhZ2UgcnVucyBsb3cuXG4gIGF3YWl0IG5hdmlnYXRvci5zdG9yYWdlPy5wZXJzaXN0Py4oKS5jYXRjaCgoKSA9PiBmYWxzZSk7XG4gIGRiID0gYXdhaXQgbmV3IFByb21pc2U8SURCRGF0YWJhc2U+KChvaywgZmFpbCkgPT4ge1xuICAgIGNvbnN0IHIgPSBpbmRleGVkREIub3BlbihcIm9yZS1waG9uZVwiLCAxKTtcbiAgICByLm9udXBncmFkZW5lZWRlZCA9ICgpID0+IHIucmVzdWx0LmNyZWF0ZU9iamVjdFN0b3JlKFwiZmlsZXNcIik7XG4gICAgci5vbnN1Y2Nlc3MgPSAoKSA9PiBvayhyLnJlc3VsdCk7XG4gICAgci5vbmVycm9yID0gKCkgPT4gZmFpbChyLmVycm9yKTtcbiAgfSk7XG4gIGNvbnN0IHN0b3JlID0gKG1vZGU6IElEQlRyYW5zYWN0aW9uTW9kZSkgPT4gZGIhLnRyYW5zYWN0aW9uKFwiZmlsZXNcIiwgbW9kZSkub2JqZWN0U3RvcmUoXCJmaWxlc1wiKTtcbiAgY29uc3QgZ2V0ID0gKGtleTogc3RyaW5nKSA9PlxuICAgIG5ldyBQcm9taXNlPHVua25vd24+KChkb25lKSA9PiB7XG4gICAgICBjb25zdCByID0gc3RvcmUoXCJyZWFkb25seVwiKS5nZXQoa2V5KTtcbiAgICAgIHIub25zdWNjZXNzID0gKCkgPT4gZG9uZShyLnJlc3VsdCk7XG4gICAgICByLm9uZXJyb3IgPSAoKSA9PiBkb25lKG51bGwpO1xuICAgIH0pO1xuICBjb25zdCBmcmVzaCA9IE9iamVjdC5mcm9tRW50cmllcyhPYmplY3QuZW50cmllcyhzbmFwc2hvdCkubWFwKChbcCwgdF0pID0+IFtwLCBoYXNoKHQpXSkpO1xuICBpZiAoKGF3YWl0IGdldChTTkFQU0hPVCkpICE9PSBpZCkge1xuICAgIGNvbnN0IGJlZm9yZSA9ICgoYXdhaXQgZ2V0KEhBU0hFUykpID8/IG51bGwpIGFzIFJlY29yZDxzdHJpbmcsIHN0cmluZz4gfCBudWxsO1xuICAgIGNvbnN0IGtleXMgPSBhd2FpdCBuZXcgUHJvbWlzZTxzdHJpbmdbXT4oKGRvbmUpID0+IHtcbiAgICAgIGNvbnN0IHIgPSBzdG9yZShcInJlYWRvbmx5XCIpLmdldEFsbEtleXMoKTtcbiAgICAgIHIub25zdWNjZXNzID0gKCkgPT4gZG9uZShyLnJlc3VsdC5tYXAoU3RyaW5nKSk7XG4gICAgICByLm9uZXJyb3IgPSAoKSA9PiBkb25lKFtdKTtcbiAgICB9KTtcbiAgICBjb25zdCBtYWNDaGFuZ2VkID0gKHA6IHN0cmluZykgPT4gIWJlZm9yZSB8fCBiZWZvcmVbcF0gIT09IGZyZXNoW3BdO1xuICAgIGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KChkb25lKSA9PiB7XG4gICAgICBjb25zdCBzID0gc3RvcmUoXCJyZWFkd3JpdGVcIik7XG4gICAgICBmb3IgKGNvbnN0IHAgb2Yga2V5cykgaWYgKHAgIT09IFNOQVBTSE9UICYmIHAgIT09IEhBU0hFUyAmJiAhT1dOX0xPRy50ZXN0KHApICYmIG1hY0NoYW5nZWQocCkpIHMuZGVsZXRlKHApO1xuICAgICAgcy5wdXQoaWQsIFNOQVBTSE9UKTtcbiAgICAgIGNvbnN0IHIgPSBzLnB1dChmcmVzaCwgSEFTSEVTKTtcbiAgICAgIHIub25zdWNjZXNzID0gci5vbmVycm9yID0gKCkgPT4gZG9uZSgpO1xuICAgIH0pO1xuICB9XG4gIGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KChkb25lKSA9PiB7XG4gICAgY29uc3QgciA9IHN0b3JlKFwicmVhZG9ubHlcIikub3BlbkN1cnNvcigpO1xuICAgIHIub25zdWNjZXNzID0gKCkgPT4ge1xuICAgICAgY29uc3QgYyA9IHIucmVzdWx0O1xuICAgICAgaWYgKCFjKSByZXR1cm4gZG9uZSgpO1xuICAgICAgY29uc3QgcCA9IFN0cmluZyhjLmtleSk7XG4gICAgICBpZiAocCA9PT0gU05BUFNIT1QgfHwgcCA9PT0gSEFTSEVTKSByZXR1cm4gYy5jb250aW51ZSgpO1xuICAgICAgaWYgKGMudmFsdWUgPT09IG51bGwpIGZpbGVzLmRlbGV0ZShwKTtcbiAgICAgIGVsc2Uge1xuICAgICAgICBmaWxlcy5zZXQocCwgYy52YWx1ZSBhcyBFbnRyeSk7XG4gICAgICAgIGFkZERpcnMocCk7XG4gICAgICB9XG4gICAgICBjLmNvbnRpbnVlKCk7XG4gICAgfTtcbiAgICByLm9uZXJyb3IgPSAoKSA9PiBkb25lKCk7XG4gIH0pO1xufVxuXG4vKiogVGhlIHBob25lJ3Mgb3duIGFwcGVuZC1vbmx5IGxvZ3M6IG9ubHkgdGhlIHBob25lIHdyaXRlcyB0aGVtLiAqL1xuY29uc3QgT1dOX0xPRyA9IC9cXC5pcGhvbmVcXC5qc29ubCQvO1xuLyoqIFRoZSBJbmRleGVkREIga2V5IGhvbGRpbmcgZWFjaCBzbmFwc2hvdCBmaWxlJ3MgaGFzaCwgdG8gdGVsbCB3aGljaCBmaWxlcyB0aGUgTWFjIGNoYW5nZWQgYmV0d2VlbiBidWlsZHMuICovXG5jb25zdCBIQVNIRVMgPSBcIiNzbmFwc2hvdC1maWxlc1wiO1xuLyoqIEZOVi0xYTogZW5vdWdoIHRvIHRlbGwgd2hldGhlciBhIGZpbGUgY2hhbmdlZCBiZXR3ZWVuIHR3byBzbmFwc2hvdHMuICovXG5mdW5jdGlvbiBoYXNoKHM6IHN0cmluZyk6IHN0cmluZyB7XG4gIGxldCBoID0gMHg4MTFjOWRjNTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBzLmxlbmd0aDsgaSsrKSBoID0gTWF0aC5pbXVsKGggXiBzLmNoYXJDb2RlQXQoaSksIDB4MDEwMDAxOTMpO1xuICByZXR1cm4gKGggPj4+IDApLnRvU3RyaW5nKDM2KSArIHMubGVuZ3RoLnRvU3RyaW5nKDM2KTtcbn1cblxuLyoqIFRoZSBJbmRleGVkREIga2V5IHRoYXQgaG9sZHMgd2hpY2ggc25hcHNob3QgdGhlIHBob25lJ3Mgd3JpdGVzIHNpdCBvbi4gKi9cbmNvbnN0IFNOQVBTSE9UID0gXCIjc25hcHNob3RcIjtcblxuLyoqIEEgYmluYXJ5IGZpbGUncyBlbnRyeS4gSXRzIHRleHQgaXMgbWFkZSBvbmx5IHdoZW4gcmVhZCAoYSBzaGFyZWQgLnR4dCBvciAuY3N2IGlzKSwgbmV2ZXIga2VwdDogZGVjb2RlZFxuICogIHVwIGZyb250LCBhbiBob3VyJ3MgYXVkaW8gd2FzIGEgc2Vjb25kIGNvcHkgdHdpY2UgaXRzIHNpemUuICovXG5jb25zdCBiaW5hcnkgPSAoYnl0ZXM6IFVpbnQ4QXJyYXksIG10aW1lOiBudW1iZXIsIHVucmVhZD86IHRydWUpOiBFbnRyeSA9PiAoe1xuICBtdGltZSxcbiAgYnl0ZXMsXG4gIC4uLih1bnJlYWQgJiYgeyB1bnJlYWQgfSksXG4gIGdldCB0ZXh0KCkge1xuICAgIHJldHVybiBuZXcgVGV4dERlY29kZXIoKS5kZWNvZGUoYnl0ZXMpO1xuICB9LFxufSk7XG4vKiogYHRleHRgIGlzIHRoZSBmaWxlJ3MsIG9yIGlnbm9yZWQgd2hlbiBgYnl0ZXNgIGFyZSBnaXZlbi4gKi9cbmZ1bmN0aW9uIHB1dChwOiBzdHJpbmcsIHRleHQ6IHN0cmluZywgbXRpbWUgPSBEYXRlLm5vdygpLCBieXRlcz86IFVpbnQ4QXJyYXkpIHtcbiAgaWYgKGRpc2sgJiYgZG93bmxvYWRpbmcuaGFzKHJlbChwKSkpIHRocm93IE9iamVjdC5hc3NpZ24obmV3IEVycm9yKFwiVGhpcyBmaWxlIGlzIHN0aWxsIGRvd25sb2FkaW5nIGZyb20gaUNsb3VkOiB0cnkgYWdhaW4gaW4gYSBtb21lbnRcIiksIHsgY29kZTogXCJFQlVTWVwiIH0pO1xuICBjb25zdCBlOiBFbnRyeSA9IGJ5dGVzID8gYmluYXJ5KGJ5dGVzLCBtdGltZSkgOiB7IHRleHQsIG10aW1lIH07XG4gIGZpbGVzLnNldChwLCBlKTtcbiAgYWRkRGlycyhwKTtcbiAgaWYgKFNDUkFUQ0gudGVzdChwKSkgcmV0dXJuO1xuICBpZiAoYnl0ZXMgJiYgZGlzaykgcmV0dXJuIHAuc3RhcnRzV2l0aChkaXNrLnByZWZpeCArIFwiL1wiKSA/IHF1ZXVlKHAsIHsgYnl0ZXMgfSkgOiB1bmRlZmluZWQ7XG4gIHBlcnNpc3QocCwgZSk7XG59XG4vKiogVGhlIGxvY2sgYW5kIHRoZSBzZWFyY2ggaW5kZXggYXJlIHJlYnVpbHQgZWFjaCBsYXVuY2gsIG5ldmVyIGtlcHQuICovXG5jb25zdCBTQ1JBVENIID0gL1xcL1xcLihvcmV8aW5kZXgpXFwvLztcbmZ1bmN0aW9uIGRyb3AocDogc3RyaW5nKSB7XG4gIGZpbGVzLmRlbGV0ZShwKTtcbiAgaWYgKFNDUkFUQ0gudGVzdChwKSkgcmV0dXJuO1xuICAvLyBBIGZpbGUgZnJvbSB0aGUgc25hcHNob3QgZ2V0cyBhIHRvbWJzdG9uZSwgc28gaXQgc3RheXMgZGVsZXRlZCBhZnRlciBhIHJlbGF1bmNoLiBPbmUgbWFkZSBvbiB0aGVcbiAgLy8gcGhvbmUgKGV2ZXJ5IGF0b21pYyB3cml0ZSdzIHRlbXAgZmlsZSBhbW9uZyB0aGVtKSBpcyBzaW1wbHkgcmVtb3ZlZCwgb3IgSW5kZXhlZERCIHdvdWxkIGtlZXAgYVxuICAvLyBkZWFkIGtleSBmb3IgZWFjaCBzYXZlLlxuICBwZXJzaXN0KHAsIHNoaXBwZWQuaGFzKHApID8gXCJ0b21ic3RvbmVcIiA6IG51bGwpO1xufVxuXG4vLyAtLS0tIG9uIHRoZSBwaG9uZTogT3JlJ3MgaUNsb3VkIERyaXZlIGZvbGRlciAoYXBwcy9waG9uZS9zcmMtdGF1cmkvc3JjL2xpYi5ycykuXG5cbnR5cGUgSW52b2tlID0gPFQ+KGNtZDogc3RyaW5nLCBhcmdzOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB8IFVpbnQ4QXJyYXksIG9wdGlvbnM/OiB7IGhlYWRlcnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gfSkgPT4gUHJvbWlzZTxUPjtcbnR5cGUgU3RhbXBlZCA9IFtyZWw6IHN0cmluZywgbXRpbWU6IG51bWJlciwgc3RhbXA6IHN0cmluZ107XG50eXBlIFNjYW4gPSB7IGZpbGVzOiBTdGFtcGVkW107IHdhaXRpbmc6IHN0cmluZ1tdOyBvdGhlcj86IHN0cmluZ1tdIH07XG5sZXQgZGlzazogeyByb290OiBzdHJpbmc7IHByZWZpeDogc3RyaW5nOyBpbnZva2U6IEludm9rZSB9IHwgbnVsbCA9IG51bGw7XG4vKiogRWFjaCBmaWxlJ3Mgc3RhbXAgKG10aW1lIGFuZCBzaXplKSBhcyBsYXN0IHJlYWQgb3Igd3JpdHRlbiwgdG8gdGVsbCB3aGF0IHRoZSBNYWMgY2hhbmdlZCBzaW5jZS4gKi9cbmNvbnN0IGtub3duID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbi8qKiBGaWxlcyB3aG9zZSByZWFkIGNhbWUgYmFjayBudWxsLCBieSBzdGFtcCwgYW5kIGhvdyBtYW55IHRpbWVzIGF0IGl0OiBhIGZhaWxlZCByZWFkIG1heSBwYXNzIG9uIHRoZSBuZXh0XG4gKiAgc2NhbiAoaUNsb3VkIHN0aWxsIHdyaXRpbmcgaXQpLCBidXQgb25lIHRoYXQgbmV2ZXIgcmVhZHMgKG5vdCBVVEYtOCkgaXMgYXNrZWQgYWdhaW4gb25seSBvbmNlIGl0IGNoYW5nZXMuICovXG5jb25zdCBmYWlsZWQgPSBuZXcgTWFwPHN0cmluZywgeyBzdGFtcDogc3RyaW5nOyB0cmllczogbnVtYmVyIH0+KCk7XG5jb25zdCBUUklFUyA9IDM7XG4vKiogV3JpdGVzIGFuZCBkZWxldGVzIChudWxsKSBub3Qgc2VudCB5ZXQsIGJ5IGxpYnJhcnkgcGF0aC4gVGhlIGxhc3Qgb25lIGZvciBhIHBhdGggd2lucywgc28gYW4gYXRvbWljXG4gKiAgd3JpdGUncyB0ZW1wIGZpbGUgbmV2ZXIgcmVhY2hlcyBpQ2xvdWQuIEEgcGljdHVyZSwgYXVkaW8gb3Igb3RoZXIgYmluYXJ5IGdvZXMgYXMgaXRzIHJhdyBieXRlcywgb25lXG4gKiAgY2FsbCBlYWNoIChsaWIucnMgYGxpYnJhcnlfd3JpdGVgKTogYXMgYmFzZTY0IHRleHQgYW4gaG91cidzIGF1ZGlvIGNvc3Qgc2V2ZXJhbCB0aW1lcyBpdHMgc2l6ZS4gKi9cbnR5cGUgT3AgPSB7IHRleHQ6IHN0cmluZyB9IHwgeyBieXRlczogVWludDhBcnJheSB9IHwgbnVsbDtcbmNvbnN0IHVuc2VudCA9IG5ldyBNYXA8c3RyaW5nLCBPcD4oKTtcbi8qKiBQYXRocyB0aGlzIHBob25lIGhhcyBzZW50IG9yIGFza2VkIHRvIGRlbGV0ZSBzaW5jZSBsYXVuY2g6IGEgZGVsZXRlIG9mIG9uZSBzdGlsbCBnb2VzIHRvIHRoZSBmb2xkZXJcbiAqICBldmVuIGJlZm9yZSB0aGUgZm9sZGVyJ3Mgc3RhbXAgZm9yIGl0IGNvbWVzIGJhY2sgKG9yIGEgZm9sZGVyLCB3aGljaCBoYXMgbm8gc3RhbXApLiAqL1xuY29uc3Qgc2VudCA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuLyoqIFRoZSBmbHVzaCB0aGF0IGxhc3Qgc2VudCBlYWNoIHBhdGg6IGEgZmFpbGVkIGJhdGNoIGtlZXBzIGEgcGF0aCBmb3IgdGhlIG5leHQgdHJ5IG9ubHkgd2hpbGUgbm8gbmV3ZXJcbiAqICBmbHVzaCBoYXMgdGFrZW4gaXQsIG9yIGEgcmV0cnkgd291bGQgcHV0IGJhY2sgYW4gb2xkZXIgd3JpdGUgb3ZlciBhIG5ld2VyIG9uZSB0aGF0IHdlbnQgdGhyb3VnaC4gKi9cbmNvbnN0IHNlbnRCeSA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG5sZXQgZmx1c2hlcyA9IDA7XG4vKiogRmlsZXMgaUNsb3VkIGhhc24ndCBkb3dubG9hZGVkIHlldC4gV3JpdGluZyBvbmUgd291bGQgcmVwbGFjZSB0aGUgcmVhbCBmaWxlIHdpdGggd2hhdCB0aGUgcGhvbmVcbiAqICB3cm9uZ2x5IHRoaW5rcyBpcyB0aGVyZSAoYW4gZW1wdHkgbG9nLCBzYXkpLCBzbyB0aGF0IHdhaXRzIHVudGlsIGl0IGFycml2ZXMuICovXG5jb25zdCBkb3dubG9hZGluZyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xubGV0IHNlbmRpbmc6IFByb21pc2U8dm9pZD4gPSBQcm9taXNlLnJlc29sdmUoKTtcbi8qKiBGb3IgU2V0dGluZ3M6IHdoZW4gdGhlIGZvbGRlciBsYXN0IHRvb2sgYSB3cml0ZSBvciBhIHNjYW4sIGFuZCB0aGUgbGFzdCB3cml0ZSBpdCByZWZ1c2VkLiAqL1xubGV0IGxhc3RTeW5jID0gMDtcbmxldCBsYXN0RXJyb3I6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuZXhwb3J0IGNvbnN0IHN5bmNTdGF0ZSA9ICgpID0+ICh7IGljbG91ZDogISFkaXNrLCBhdDogbGFzdFN5bmMsIHVuc2VudDogdW5zZW50LnNpemUsIGRvd25sb2FkaW5nOiBkb3dubG9hZGluZy5zaXplLCBlcnJvcjogbGFzdEVycm9yIH0pO1xubGV0IHRpbWVyOiBSZXR1cm5UeXBlPHR5cGVvZiBzZXRUaW1lb3V0PiB8IHVuZGVmaW5lZDtcblxuY29uc3QgcmVsID0gKHA6IHN0cmluZykgPT4gcC5zbGljZShkaXNrIS5wcmVmaXgubGVuZ3RoICsgMSk7XG5mdW5jdGlvbiBxdWV1ZShwOiBzdHJpbmcsIG9wOiBPcCkge1xuICB1bnNlbnQuc2V0KHJlbChwKSwgb3ApO1xuICB0aW1lciA/Pz0gc2V0VGltZW91dChmbHVzaCwgMCk7XG59XG5cbi8qKiBUaGUgZmlsZXMgdGhlIGZvbGRlcidzIGxpc3RpbmcgcmVwb3J0cyAoYXBwcy9waG9uZS9zcmMtdGF1cmkvc3JjL2xpYi5ycyBgd2FudGVkYCk7IG9ubHkgdGhlc2UgYXJlXG4gKiAgd2F0Y2hlZCBmb3IgdGhlIE1hYydzIGNoYW5nZXMuICovXG5jb25zdCBMSVNURUQgPSAvKFxcLihtZHx5YT9tbHxqc29ubD98ZXhjYWxpZHJhd3x2dHQpfFxcLyh0aHVtYm5haWx8Y291cnNlLWNvdmVyKVxcLihqcGU/Z3xwbmd8d2VicHxnaWYpKSQvaTtcblxuY29uc3QgSEVBVlkgPSAvXFwuKG1wM3xtNGF8d2F2fGFhY3xhaWZmfGZsYWN8bXA0fG1vdnxtNHYpJC9pO1xuXG4vKiogU2VuZHMgdGhlIHdyaXRlcyBtYWRlIHNvIGZhciB0byB0aGUgZm9sZGVyOyByZXNvbHZlcyBvbmNlIHRoZXkgYXJlIG9uIGRpc2suICovXG5leHBvcnQgZnVuY3Rpb24gZmx1c2goKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNsZWFyVGltZW91dCh0aW1lcik7XG4gIHRpbWVyID0gdW5kZWZpbmVkO1xuICBjb25zdCBvcHMgPSBbLi4udW5zZW50XS5maWx0ZXIoKFtyLCBvcF0pID0+IG9wICE9PSBudWxsIHx8IGtub3duLmhhcyhyKSB8fCBzZW50LmhhcyhyKSk7XG4gIHVuc2VudC5jbGVhcigpO1xuICBpZiAoIW9wcy5sZW5ndGggfHwgIWRpc2spIHJldHVybiBzZW5kaW5nO1xuICBjb25zdCBuID0gKytmbHVzaGVzO1xuICBmb3IgKGNvbnN0IFtyXSBvZiBvcHMpIHNlbnQuYWRkKHIpLCBzZW50Qnkuc2V0KHIsIG4pO1xuICBjb25zdCB7IHJvb3QsIGludm9rZSB9ID0gZGlzaztcbiAgc2VuZGluZyA9IHNlbmRpbmcudGhlbihhc3luYyAoKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHN0YW1wczogU3RhbXBlZFtdID0gW107XG4gICAgICBjb25zdCBlbmMgPSBlbmNvZGVVUklDb21wb25lbnQ7XG4gICAgICAvLyBJbiB0aGUgb3JkZXIgdGhleSB3ZXJlIG1hZGUgKGEgZm9sZGVyJ3MgZGVsZXRlIGJlZm9yZSBhIGZpbGUgd3JpdHRlbiBpbnRvIGl0KSwgdGV4dCBhbmQgZGVsZXRlcyBpbiBiYXRjaGVzLlxuICAgICAgbGV0IGJhdGNoOiBbc3RyaW5nLCBzdHJpbmcgfCBudWxsLCBib29sZWFuXVtdID0gW107XG4gICAgICBjb25zdCBzZW5kID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICBpZiAoYmF0Y2gubGVuZ3RoKSBzdGFtcHMucHVzaCguLi4oYXdhaXQgaW52b2tlPFN0YW1wZWRbXT4oXCJsaWJyYXJ5X2FwcGx5XCIsIHsgcm9vdCwgb3BzOiBiYXRjaCB9KSkpO1xuICAgICAgICBiYXRjaCA9IFtdO1xuICAgICAgfTtcbiAgICAgIGZvciAoY29uc3QgW3IsIG9wXSBvZiBvcHMpIHtcbiAgICAgICAgaWYgKCFvcCB8fCBcInRleHRcIiBpbiBvcCkgYmF0Y2gucHVzaChbciwgb3A/LnRleHQgPz8gbnVsbCwgZmFsc2VdKTtcbiAgICAgICAgZWxzZSAoYXdhaXQgc2VuZCgpLCBzdGFtcHMucHVzaChhd2FpdCBpbnZva2U8U3RhbXBlZD4oXCJsaWJyYXJ5X3dyaXRlXCIsIG9wLmJ5dGVzLCB7IGhlYWRlcnM6IHsgXCJ4LXJvb3RcIjogZW5jKHJvb3QpLCBcIngtcGF0aFwiOiBlbmMocikgfSB9KSkpO1xuICAgICAgfVxuICAgICAgYXdhaXQgc2VuZCgpO1xuICAgICAgLy8gQXVkaW8gYW5kIHZpZGVvIG9uIGRpc2sgbGVhdmUgbWVtb3J5OiBub3RoaW5nIHJlYWRzIHRoZW0gYmFjayBoZXJlICh0aGV5IHBsYXkgZnJvbSB0aGUgZm9sZGVyKSwgYW5kIGFuXG4gICAgICAvLyBob3VyJ3MgZXBpc29kZSBpcyA2MCBNQiBvciBtb3JlLiBMaXN0ZWQgbGlrZSBhbnkgZmlsZSB0aGUgcGhvbmUgZG9lc24ndCBsb2FkLlxuICAgICAgZm9yIChjb25zdCBbciwgb3BdIG9mIG9wcykge1xuICAgICAgICBjb25zdCBwID0gYCR7ZGlzayEucHJlZml4fS8ke3J9YDtcbiAgICAgICAgaWYgKG9wICYmIFwiYnl0ZXNcIiBpbiBvcCAmJiBIRUFWWS50ZXN0KHIpICYmIGZpbGVzLmdldChwKT8uYnl0ZXMgPT09IG9wLmJ5dGVzKSBmaWxlcy5zZXQocCwgeyB0ZXh0OiBcIlwiLCBtdGltZTogRGF0ZS5ub3coKSwgdW5yZWFkOiB0cnVlIH0pO1xuICAgICAgfVxuICAgICAgZm9yIChjb25zdCBbciwgbXMsIHN0YW1wXSBvZiBzdGFtcHMpIHtcbiAgICAgICAgaWYgKExJU1RFRC50ZXN0KFwiL1wiICsgcikpIGtub3duLnNldChyLCBzdGFtcCk7XG4gICAgICAgIGNvbnN0IGUgPSBmaWxlcy5nZXQoYCR7ZGlzayEucHJlZml4fS8ke3J9YCk7XG4gICAgICAgIGlmIChlKSBlLm10aW1lID0gbXM7XG4gICAgICB9XG4gICAgICBbbGFzdFN5bmMsIGxhc3RFcnJvcl0gPSBbRGF0ZS5ub3coKSwgbnVsbF07XG4gICAgICBmb3IgKGNvbnN0IFtyLCBvcF0gb2Ygb3BzKSBpZiAob3AgPT09IG51bGwpIGZvciAoY29uc3QgayBvZiBbLi4ua25vd24ua2V5cygpXSkgaWYgKGsgPT09IHIgfHwgay5zdGFydHNXaXRoKHIgKyBcIi9cIikpIGtub3duLmRlbGV0ZShrKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAvLyBLZXB0IGZvciB0aGUgbmV4dCB0cnksIHVubGVzcyBhIG5ld2VyIHdyaXRlIHJlcGxhY2VkIGl0IChzdGlsbCB1bnNlbnQsIG9yIHNlbnQgc2luY2UpLlxuICAgICAgZm9yIChjb25zdCBbciwgb3BdIG9mIG9wcykgaWYgKCF1bnNlbnQuaGFzKHIpICYmIHNlbnRCeS5nZXQocikgPT09IG4pIHVuc2VudC5zZXQociwgb3ApO1xuICAgICAgbGFzdEVycm9yID0gU3RyaW5nKGUpO1xuICAgICAgZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoXCJvcmU6c2F2ZS1mYWlsZWRcIiwgeyBkZXRhaWw6IFN0cmluZyhlKSB9KSk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIHNlbmRpbmc7XG59XG5cbi8qKiBMb2FkcyB0aGUgbGlicmFyeSBmcm9tIHRoZSBmb2xkZXIuIE9uIGEgZmlyc3QgbGF1bmNoIGlDbG91ZCBtYXkgc3RpbGwgYmUgZG93bmxvYWRpbmcgaXQ6IHdhaXRzIGZvclxuICogIHRoYXQgKHRyYW5zY3JpcHRzIGFzaWRlKSwgdXAgdG8gYSBtaW51dGU7IHdoYXQgc3RpbGwgaGFzbid0IGNvbWUga2VlcHMgdGhlIHBob25lIGZyb20gd3JpdGluZyBvdmVyIGl0IChgZG93bmxvYWRpbmdgKS4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBtb3VudERpc2socHJlZml4OiBzdHJpbmcsIHJvb3Q6IHN0cmluZywgaW52b2tlOiBJbnZva2UpIHtcbiAgZGlzayA9IHsgcm9vdCwgcHJlZml4LCBpbnZva2UgfTtcbiAgbGV0IHNjYW4gPSBhd2FpdCBpbnZva2U8U2Nhbj4oXCJsaWJyYXJ5X3NjYW5cIiwgeyByb290IH0pO1xuICAvLyBPbmx5IGZvciB3aGF0IHRoZSBsaXN0cyBuZWVkOiBhIHRyYW5zY3JpcHQgc3RpbGwgb24gaXRzIHdheSAodGhleSBhcmUgbGFyZ2UsIGFuZCBtYW55KSBjb21lcyBpbiB3aXRoIGFcbiAgLy8gbGF0ZXIgbG9vayBhdCB0aGUgZm9sZGVyLCBhbmQgbmV2ZXIgaG9sZHMgdXAgdGhlIGxhdW5jaCAoaXQgb25jZSBkaWQsIGZvciA3MiBzKS5cbiAgY29uc3QgaGVsZCA9ICgpID0+IHNjYW4ud2FpdGluZy5zb21lKChyKSA9PiAhL1xcLnZ0dCQvaS50ZXN0KHIpKTtcbiAgZm9yIChsZXQgaSA9IDA7IGhlbGQoKSAmJiBpIDwgNjA7IGkrKykge1xuICAgIGF3YWl0IG5ldyBQcm9taXNlKChyKSA9PiBzZXRUaW1lb3V0KHIsIDEwMDApKTtcbiAgICBzY2FuID0gYXdhaXQgaW52b2tlPFNjYW4+KFwibGlicmFyeV9zY2FuXCIsIHsgcm9vdCB9KTtcbiAgfVxuICBzZXREb3dubG9hZGluZyhzY2FuLndhaXRpbmcpO1xuICBhd2FpdCByZWFkKHNjYW4uZmlsZXMpO1xuICBsaXN0T3RoZXJzKHNjYW4ub3RoZXIpO1xuICBsYXN0U3luYyA9IERhdGUubm93KCk7XG4gIC8vIGlPUyBtYXkgc3VzcGVuZCB0aGUgYXBwIHNvb24gYWZ0ZXIgaXQgbGVhdmVzIHRoZSBzY3JlZW46IHdoYXQgaXQgd3JvdGUgZ29lcyBub3cuXG4gIGFkZEV2ZW50TGlzdGVuZXIoXCJ2aXNpYmlsaXR5Y2hhbmdlXCIsICgpID0+IGRvY3VtZW50LmhpZGRlbiAmJiB2b2lkIGZsdXNoKCkpO1xufVxuXG4vKiogRmlsZXMgdGhlIHBob25lIGRvZXNuJ3QgbG9hZCAoYSBzb3VyY2UncyBhdWRpbyBvciBQREYpIHN0aWxsIHNob3cgaW4gdGhlIGZvbGRlcidzIGxpc3RpbmcsIHNvIHRoZSBjb3JlXG4gKiAgZmluZHMgdGhlbSAoYHNvdXJjZUZpbGVgKTsgdGhlIHNjcmVlbnMgb3BlbiB0aGVtIGZyb20gZGlzayAoY29udmVydEZpbGVTcmMpLiAqL1xuZnVuY3Rpb24gbGlzdE90aGVycyhvdGhlcjogc3RyaW5nW10gPSBbXSkge1xuICAvLyBPbmUgdGhlIE1hYyBkZWxldGVkIHNpbmNlIGxlYXZlcyB0aGUgbGlzdGluZyB0b28uXG4gIGNvbnN0IG5vdyA9IG5ldyBTZXQob3RoZXIubWFwKChyKSA9PiBgJHtkaXNrIS5wcmVmaXh9LyR7cn1gKSk7XG4gIGxldCBnb25lID0gZmFsc2U7XG4gIGZvciAoY29uc3QgW3AsIGVdIG9mIGZpbGVzKSBpZiAoZS51bnJlYWQgJiYgIW5vdy5oYXMocCkpIGdvbmUgPSBmaWxlcy5kZWxldGUocCk7XG4gIGlmIChnb25lKSBwcnVuZURpcnMoKTtcbiAgZm9yIChjb25zdCByIG9mIG90aGVyKSB7XG4gICAgY29uc3QgcCA9IGAke2Rpc2shLnByZWZpeH0vJHtyfWA7XG4gICAgaWYgKGZpbGVzLmhhcyhwKSkgY29udGludWU7XG4gICAgZmlsZXMuc2V0KHAsIHsgdGV4dDogXCJcIiwgbXRpbWU6IDAsIHVucmVhZDogdHJ1ZSB9KTtcbiAgICBhZGREaXJzKHApO1xuICB9XG59XG5cbi8qKiBMb2FkcyBvbmUgbGlzdGVkIGZpbGUncyBieXRlcyBmcm9tIHRoZSBmb2xkZXIsIHNvIHRoZSBjb3JlIGNhbiByZWFkIGl0OiBhIGZpbGUgdGhlIHNoYXJlIHNoZWV0IHNhdmVkIHRvXG4gKiAgdGhlIGluYm94LiBGYWxzZSB3aGVuIGl0IGlzbid0IHRoZXJlIHRvIGxvYWQuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbG9hZChwOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgY29uc3QgZSA9IGZpbGVzLmdldChwKTtcbiAgaWYgKCFlKSByZXR1cm4gZmFsc2U7XG4gIGlmICghZS51bnJlYWQgfHwgZS5ieXRlcykgcmV0dXJuIHRydWU7XG4gIGlmICghZGlzaykgcmV0dXJuIGZhbHNlO1xuICBjb25zdCBiNjQgPSBhd2FpdCBkaXNrLmludm9rZTxzdHJpbmcgfCBudWxsPihcImxpYnJhcnlfYnl0ZXNcIiwgeyByb290OiBkaXNrLnJvb3QsIHBhdGg6IHJlbChwKSB9KTtcbiAgaWYgKGI2NCA9PSBudWxsKSByZXR1cm4gZmFsc2U7XG4gIGZpbGVzLnNldChwLCBiaW5hcnkoVWludDhBcnJheS5mcm9tKGF0b2IoYjY0KSwgKGMpID0+IGMuY2hhckNvZGVBdCgwKSksIGUubXRpbWUsIHRydWUpKTtcbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIHNldERvd25sb2FkaW5nKHdhaXRpbmc6IHN0cmluZ1tdKSB7XG4gIGRvd25sb2FkaW5nLmNsZWFyKCk7XG4gIGZvciAoY29uc3QgciBvZiB3YWl0aW5nKSBkb3dubG9hZGluZy5hZGQocik7XG59XG5cbi8qKiBSZWFkcyBpbiBgbGlzdGA7IGhvdyBtYW55IGNhbWUgaW4uIE9uZSB0aGF0IGNhbid0IGJlIHJlYWQgKGdvbmUsIGEgZmFpbGVkIHJlYWQsIG5vdCBVVEYtODogbGliLnJzIGFuc3dlcnNcbiAqICBudWxsIGZvciBlYWNoKSBpc24ndCBtYXJrZWQgYXMgc2Vlbiwgc28gdGhlIG5leHQgcmVzY2FucyBhc2sgYWdhaW4gKFRSSUVTIGluIGFsbCkgcmF0aGVyIHRoYW4ga2VlcCBzdGFsZSB0ZXh0LiAqL1xuYXN5bmMgZnVuY3Rpb24gcmVhZChsaXN0OiBTdGFtcGVkW10pOiBQcm9taXNlPG51bWJlcj4ge1xuICBsZXQgbGFuZGVkID0gMDtcbiAgY29uc3QgcGFydHM6IFN0YW1wZWRbXVtdID0gW107XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkgKz0gNDAwKSBwYXJ0cy5wdXNoKGxpc3Quc2xpY2UoaSwgaSArIDQwMCkpO1xuICAvLyBBc2tlZCBmb3IgdG9nZXRoZXI6IG9uZSBhZnRlciBhbm90aGVyLCBzZXZlbiBwYXJ0cyBvZiBhIDk1MC1zb3VyY2UgbGlicmFyeSBoZWxkIHRoZSBsYXVuY2ggYWJvdXQgMjYwIG1zLlxuICBjb25zdCBnb3QgPSBhd2FpdCBQcm9taXNlLmFsbChwYXJ0cy5tYXAoKHBhcnQpID0+IGRpc2shLmludm9rZTwoc3RyaW5nIHwgbnVsbClbXT4oXCJsaWJyYXJ5X3JlYWRcIiwgeyByb290OiBkaXNrIS5yb290LCBwYXRoczogcGFydC5tYXAoKFtyXSkgPT4gcikgfSkpKTtcbiAgcGFydHMuZm9yRWFjaCgocGFydCwgbikgPT4ge1xuICAgIGNvbnN0IHRleHRzID0gZ290W25dITtcbiAgICBwYXJ0LmZvckVhY2goKFtyLCBtdGltZSwgc3RhbXBdLCBqKSA9PiB7XG4gICAgICBpZiAodW5zZW50LmhhcyhyKSkgcmV0dXJuO1xuICAgICAgY29uc3QgdGV4dCA9IHRleHRzW2pdO1xuICAgICAgaWYgKHRleHQgPT0gbnVsbCkge1xuICAgICAgICBjb25zdCBmID0gZmFpbGVkLmdldChyKTtcbiAgICAgICAgZmFpbGVkLnNldChyLCB7IHN0YW1wLCB0cmllczogZj8uc3RhbXAgPT09IHN0YW1wID8gZi50cmllcyArIDEgOiAxIH0pO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBmYWlsZWQuZGVsZXRlKHIpO1xuICAgICAga25vd24uc2V0KHIsIHN0YW1wKTtcbiAgICAgIGxhbmRlZCsrO1xuICAgICAgY29uc3QgcCA9IGAke2Rpc2shLnByZWZpeH0vJHtyfWA7XG4gICAgICBmaWxlcy5zZXQocCwgeyB0ZXh0LCBtdGltZSB9KTtcbiAgICAgIGFkZERpcnMocCk7XG4gICAgfSk7XG4gIH0pO1xuICByZXR1cm4gbGFuZGVkO1xufVxuXG4vKiogUmVhZHMgaW4gd2hhdCBjaGFuZ2VkIGluIHRoZSBmb2xkZXIgc2luY2UgKHRoZSBNYWMncyBlZGl0cywgdGhyb3VnaCBpQ2xvdWQpOyB0cnVlIGlmIGFueXRoaW5nIGRpZC5cbiAqICBBIGZpbGUgdGhpcyBwaG9uZSBpcyBzdGlsbCBzZW5kaW5nIGtlZXBzIHRoZSBwaG9uZSdzIHZlcnNpb24uICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVzY2FuKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICBpZiAoIWRpc2spIHJldHVybiBmYWxzZTtcbiAgYXdhaXQgZmx1c2goKTtcbiAgY29uc3Qgc2NhbiA9IGF3YWl0IGRpc2suaW52b2tlPFNjYW4+KFwibGlicmFyeV9zY2FuXCIsIHsgcm9vdDogZGlzay5yb290IH0pO1xuICBzZXREb3dubG9hZGluZyhzY2FuLndhaXRpbmcpO1xuICBjb25zdCBzZWVuID0gbmV3IFNldChbLi4uc2Nhbi5maWxlcy5tYXAoKFtyZWxdKSA9PiByZWwpLCAuLi5zY2FuLndhaXRpbmddKTtcbiAgY29uc3QgZ2l2ZW4gPSAocjogc3RyaW5nLCBzdGFtcDogc3RyaW5nKSA9PiBmYWlsZWQuZ2V0KHIpPy5zdGFtcCA9PT0gc3RhbXAgJiYgZmFpbGVkLmdldChyKSEudHJpZXMgPj0gVFJJRVM7XG4gIGNvbnN0IGNoYW5nZWQgPSBzY2FuLmZpbGVzLmZpbHRlcigoW3IsICwgc3RhbXBdKSA9PiBrbm93bi5nZXQocikgIT09IHN0YW1wICYmICF1bnNlbnQuaGFzKHIpICYmICFnaXZlbihyLCBzdGFtcCkpO1xuICBjb25zdCBnb25lID0gWy4uLmtub3duLmtleXMoKV0uZmlsdGVyKChyKSA9PiAhc2Vlbi5oYXMocikgJiYgIXVuc2VudC5oYXMocikpO1xuICBmb3IgKGNvbnN0IHIgb2YgZ29uZSkge1xuICAgIGtub3duLmRlbGV0ZShyKTtcbiAgICBmaWxlcy5kZWxldGUoYCR7ZGlzay5wcmVmaXh9LyR7cn1gKTtcbiAgfVxuICBpZiAoZ29uZS5sZW5ndGgpIHBydW5lRGlycygpO1xuICBmb3IgKGNvbnN0IHIgb2YgZmFpbGVkLmtleXMoKSkgaWYgKCFzZWVuLmhhcyhyKSkgZmFpbGVkLmRlbGV0ZShyKTtcbiAgY29uc3QgbGFuZGVkID0gYXdhaXQgcmVhZChjaGFuZ2VkKTtcbiAgbGlzdE90aGVycyhzY2FuLm90aGVyKTtcbiAgbGFzdFN5bmMgPSBEYXRlLm5vdygpO1xuICAvLyBPbmx5IHdoYXQgY2FtZSBpbiBjb3VudHM6IGEgZmlsZSB0aGF0IHN0aWxsIGNhbid0IGJlIHJlYWQgaXMgYXNrZWQgYWdhaW4sIGJ1dCBjaGFuZ2VzIG5vdGhpbmcuXG4gIHJldHVybiBsYW5kZWQgKyBnb25lLmxlbmd0aCA+IDA7XG59XG5cbi8qKiBGb2xkZXJzIGxlZnQgd2l0aCBub3RoaW5nIGluIHRoZW0gKGEgc291cmNlIHRoZSBNYWMgZGVsZXRlZCkgZ28sIGFzIHRoZXkgZG8gb24gZGlzay4gKi9cbmZ1bmN0aW9uIHBydW5lRGlycygpIHtcbiAgY29uc3QgZnVsbCA9IG5ldyBTZXQ8c3RyaW5nPihbXCIvXCJdKTtcbiAgZm9yIChjb25zdCBmIG9mIGZpbGVzLmtleXMoKSkgZm9yIChsZXQgZCA9IHBhcmVudChmKTsgIWZ1bGwuaGFzKGQpOyBkID0gcGFyZW50KGQpKSBmdWxsLmFkZChkKTtcbiAgZm9yIChjb25zdCBkIG9mIFsuLi5kaXJzXSkgaWYgKGQuc3RhcnRzV2l0aChkaXNrIS5wcmVmaXggKyBcIi9cIikgJiYgIWZ1bGwuaGFzKGQpKSBkaXJzLmRlbGV0ZShkKTtcbn1cblxuLy8gLS0tLSB0aGUgbm9kZTpmcyBmdW5jdGlvbnMgdGhlIGNvcmUgdXNlcy5cblxuZXhwb3J0IGNvbnN0IGV4aXN0c1N5bmMgPSAocDogc3RyaW5nKSA9PiBmaWxlcy5oYXMocCkgfHwgZGlycy5oYXMocCk7XG4vKiogQSBiaW5hcnkgZmlsZSByZWFkIHdpdGggbm8gZW5jb2RpbmcsIGFzIE5vZGUncyBCdWZmZXIgaXM6IGl0cyBieXRlcywgYW5kIGl0cyB0ZXh0IGlmIHByaW50ZWQuICovXG5jbGFzcyBCeXRlcyBleHRlbmRzIFVpbnQ4QXJyYXkge1xuICB0b1N0cmluZygpIHtcbiAgICByZXR1cm4gbmV3IFRleHREZWNvZGVyKCkuZGVjb2RlKHRoaXMpO1xuICB9XG59XG4vKiogV2l0aCBhbiBlbmNvZGluZywgdGhlIHRleHQuIFdpdGggbm9uZSwgYSBmaWxlIHNhdmVkIGFzIGJ5dGVzIChhIHBpY2tlZCBQREYsIGEgcGljdHVyZSkgY29tZXMgYmFjayBhcyBpdHNcbiAqICBieXRlcywgYXMgTm9kZSBnaXZlcyBhIEJ1ZmZlcjsgYSB0ZXh0IGZpbGUgc3RpbGwgY29tZXMgYmFjayBhcyB0ZXh0LCB3aGljaCBldmVyeSBjYWxsZXIgaGVyZSBleHBlY3RzLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlYWRGaWxlU3luYyhwOiBzdHJpbmcsIGVuYz86IHVua25vd24pOiBzdHJpbmcge1xuICBjb25zdCBlID0gZmlsZXMuZ2V0KHApO1xuICBpZiAoIWUpIHRocm93IGVycihcIkVOT0VOVFwiLCBwKTtcbiAgaWYgKGUudW5yZWFkICYmICFlLmJ5dGVzKSB0aHJvdyBPYmplY3QuYXNzaWduKG5ldyBFcnJvcihgbm90IGxvYWRlZCBvbiBpUGhvbmU6ICR7cH1gKSwgeyBjb2RlOiBcIkVJU0RJUlwiIH0pO1xuICAvLyBPbmUgYmxvY2sgY29weTogQnl0ZXMuZnJvbSB3YWxrZWQgYW4gaG91cidzIGF1ZGlvIGJ5dGUgYnkgYnl0ZSBhbmQgaGVsZCBvdmVyIGEgZ2lnYWJ5dGUgd2hpbGUgaXQgZGlkLlxuICBpZiAoZW5jID09PSB1bmRlZmluZWQgJiYgZS5ieXRlcykgcmV0dXJuIG5ldyBCeXRlcyhlLmJ5dGVzKSBhcyB1bmtub3duIGFzIHN0cmluZztcbiAgcmV0dXJuIGUudGV4dDtcbn1cbmV4cG9ydCBjb25zdCB3cml0ZUZpbGVTeW5jID0gKHA6IHN0cmluZywgczogc3RyaW5nIHwgVWludDhBcnJheSkgPT4gKHR5cGVvZiBzID09PSBcInN0cmluZ1wiID8gcHV0KHAsIHMpIDogcHV0KHAsIFwiXCIsIERhdGUubm93KCksIHMpKTtcbmV4cG9ydCBjb25zdCBhcHBlbmRGaWxlU3luYyA9IChwOiBzdHJpbmcsIHM6IHN0cmluZykgPT4gcHV0KHAsIChmaWxlcy5nZXQocCk/LnRleHQgPz8gXCJcIikgKyBzKTtcbmV4cG9ydCBmdW5jdGlvbiBta2RpclN5bmMocDogc3RyaW5nLCBfbz86IHVua25vd24pIHtcbiAgLy8gVGhlIGZvbGRlciBhbmQgZXZlcnkgcGFyZW50IG5vdCBtYWRlIHlldDogYWRkaW5nIHAgZmlyc3Qgc3RvcHBlZCBhZGREaXJzIGF0IG9uY2UgKGl0IHN0b3BzIGF0IGEga25vd25cbiAgLy8gZm9sZGVyKSwgc28gYSBmaXJzdCBzb3VyY2UgaW4gYW4gZW1wdHkgbGlicmFyeSBsZWZ0IGl0ZW1zLyB1bmxpc3RlZCBhbmQgdGhlIHNvdXJjZSBub3doZXJlLlxuICBhZGREaXJzKHAgKyBcIi94XCIpO1xufVxuZXhwb3J0IGNvbnN0IHVubGlua1N5bmMgPSAocDogc3RyaW5nKSA9PiB7XG4gIGlmICghZmlsZXMuaGFzKHApKSB0aHJvdyBlcnIoXCJFTk9FTlRcIiwgcCk7XG4gIGRyb3AocCk7XG59O1xuZXhwb3J0IGZ1bmN0aW9uIHJtU3luYyhwOiBzdHJpbmcsIF9vPzogdW5rbm93bikge1xuICAvLyBBIGZvbGRlciBnb2VzIHdob2xlIG9uIGRpc2ssIHdpdGggd2hhdCB0aGUgcGhvbmUgbmV2ZXIgbG9hZGVkIChhIHNvdXJjZSdzIG9yaWdpbmFsIFBERikuXG4gIGlmIChkaXNrICYmIGRpcnMuaGFzKHApICYmIHAuc3RhcnRzV2l0aChkaXNrLnByZWZpeCArIFwiL1wiKSkge1xuICAgIHNlbnQuYWRkKHJlbChwKSk7XG4gICAgcXVldWUocCwgbnVsbCk7XG4gIH1cbiAgZm9yIChjb25zdCBmIG9mIFsuLi5maWxlcy5rZXlzKCldKSBpZiAoZiA9PT0gcCB8fCBmLnN0YXJ0c1dpdGgocCArIFwiL1wiKSkgZHJvcChmKTtcbiAgZm9yIChjb25zdCBkIG9mIFsuLi5kaXJzXSkgaWYgKGQgPT09IHAgfHwgZC5zdGFydHNXaXRoKHAgKyBcIi9cIikpIGRpcnMuZGVsZXRlKGQpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIHJlbmFtZVN5bmMoYTogc3RyaW5nLCBiOiBzdHJpbmcpIHtcbiAgY29weUZpbGVTeW5jKGEsIGIpO1xuICBkcm9wKGEpO1xufVxuZXhwb3J0IGNvbnN0IGNvcHlGaWxlU3luYyA9IChhOiBzdHJpbmcsIGI6IHN0cmluZykgPT4ge1xuICByZWFkRmlsZVN5bmMoYSk7IC8vIHRocm93cyBmb3IgYSBtaXNzaW5nIGZpbGUsIGFuZCBmb3Igb25lIHRoZSBwaG9uZSBsaXN0cyBidXQgaGFzbid0IGxvYWRlZFxuICBjb25zdCBlID0gZmlsZXMuZ2V0KGEpITtcbiAgcHV0KGIsIGUuYnl0ZXMgPyBcIlwiIDogZS50ZXh0LCBEYXRlLm5vdygpLCBlLmJ5dGVzKTtcbn07XG4vLyBjb3B5RmlsZVN5bmMncyBmbGFncyAoY29yZSBhc2tzIGZvciBhIGNsb25lLCBDT1BZRklMRV9GSUNMT05FKTogdGhlIHBob25lJ3MgY29weSBpcyBpbiBtZW1vcnkgZWl0aGVyIHdheS5cbmV4cG9ydCBjb25zdCBjb25zdGFudHMgPSB7IENPUFlGSUxFX0ZJQ0xPTkU6IDIgfTtcbmV4cG9ydCBjb25zdCBta2R0ZW1wU3luYyA9IChwcmVmaXg6IHN0cmluZykgPT4ge1xuICBjb25zdCBkID0gYCR7cHJlZml4fSR7TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc2xpY2UoMiwgOCl9YDtcbiAgbWtkaXJTeW5jKGQpO1xuICByZXR1cm4gZDtcbn07XG5cbnR5cGUgRGlyZW50ID0geyBuYW1lOiBzdHJpbmc7IGlzRGlyZWN0b3J5OiAoKSA9PiBib29sZWFuOyBpc0ZpbGU6ICgpID0+IGJvb2xlYW4gfTtcbmV4cG9ydCBmdW5jdGlvbiByZWFkZGlyU3luYyhwOiBzdHJpbmcsIG8/OiB7IHdpdGhGaWxlVHlwZXM/OiBib29sZWFuIH0pOiBhbnkge1xuICBpZiAoIWRpcnMuaGFzKHApKSB0aHJvdyBlcnIoXCJFTk9FTlRcIiwgcCk7XG4gIGNvbnN0IHByZSA9IHAuZW5kc1dpdGgoXCIvXCIpID8gcCA6IHAgKyBcIi9cIjtcbiAgY29uc3QgbmFtZXMgPSBuZXcgTWFwPHN0cmluZywgYm9vbGVhbj4oKTtcbiAgZm9yIChjb25zdCBmIG9mIGZpbGVzLmtleXMoKSkge1xuICAgIGlmICghZi5zdGFydHNXaXRoKHByZSkpIGNvbnRpbnVlO1xuICAgIGNvbnN0IHJlc3QgPSBmLnNsaWNlKHByZS5sZW5ndGgpO1xuICAgIGNvbnN0IGkgPSByZXN0LmluZGV4T2YoXCIvXCIpO1xuICAgIG5hbWVzLnNldChpIDwgMCA/IHJlc3QgOiByZXN0LnNsaWNlKDAsIGkpLCBpID49IDApO1xuICB9XG4gIGZvciAoY29uc3QgZCBvZiBkaXJzKSBpZiAoZC5zdGFydHNXaXRoKHByZSkgJiYgZC5sZW5ndGggPiBwcmUubGVuZ3RoICYmICFkLnNsaWNlKHByZS5sZW5ndGgpLmluY2x1ZGVzKFwiL1wiKSkgbmFtZXMuc2V0KGQuc2xpY2UocHJlLmxlbmd0aCksIHRydWUpO1xuICBjb25zdCBsaXN0ID0gWy4uLm5hbWVzXS5zb3J0KChbYV0sIFtiXSkgPT4gKGEgPCBiID8gLTEgOiAxKSk7XG4gIHJldHVybiBvPy53aXRoRmlsZVR5cGVzID8gbGlzdC5tYXAoKFtuYW1lLCBkaXJdKTogRGlyZW50ID0+ICh7IG5hbWUsIGlzRGlyZWN0b3J5OiAoKSA9PiBkaXIsIGlzRmlsZTogKCkgPT4gIWRpciB9KSkgOiBsaXN0Lm1hcCgoW25dKSA9PiBuKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBzdGF0U3luYyhwOiBzdHJpbmcpIHtcbiAgaWYgKCFleGlzdHNTeW5jKHApKSB0aHJvdyBlcnIoXCJFTk9FTlRcIiwgcCk7XG4gIGNvbnN0IGUgPSBmaWxlcy5nZXQocCk7XG4gIGNvbnN0IG0gPSBlPy5tdGltZSA/PyAxO1xuICByZXR1cm4geyBtdGltZU1zOiBtLCBtdGltZTogbmV3IERhdGUobSksIHNpemU6IGU/LmJ5dGVzPy5sZW5ndGggPz8gZT8udGV4dC5sZW5ndGggPz8gMCwgaXNEaXJlY3Rvcnk6ICgpID0+ICFlLCBpc0ZpbGU6ICgpID0+ICEhZSB9O1xufVxuZXhwb3J0IGNvbnN0IGxzdGF0U3luYyA9IHN0YXRTeW5jO1xuZXhwb3J0IGNvbnN0IHJlYWxwYXRoU3luYyA9IChwOiBzdHJpbmcpID0+IHA7XG5cbi8vIFRoZSBsaWJyYXJ5IGxvY2sgKGxvY2sudHMpIGlzIGEgZmlsZSBvcGVuZWQgZXhjbHVzaXZlbHk7IHRoZSBwaG9uZSBydW5zIG9uZSBjb21tYW5kIGF0IGEgdGltZS5cbi8vIGFwcGVuZEpzb25sIHJlYWRzIGEgbG9nJ3MgbGFzdCBieXRlIChcInJcIikgdG8gc2VlIHdoZXRoZXIgaXQgZW5kcyBpbiBhIG5ld2xpbmUuXG5jb25zdCBvcGVuID0gbmV3IE1hcDxudW1iZXIsIHN0cmluZz4oKTtcbmV4cG9ydCBmdW5jdGlvbiBvcGVuU3luYyhwOiBzdHJpbmcsIGZsYWdzPzogc3RyaW5nKSB7XG4gIGlmIChmbGFncyA9PT0gXCJyXCIpIHtcbiAgICBpZiAoIWZpbGVzLmhhcyhwKSkgdGhyb3cgZXJyKFwiRU5PRU5UXCIsIHApO1xuICB9IGVsc2Uge1xuICAgIGlmIChmbGFncyA9PT0gXCJ3eFwiICYmIGZpbGVzLmhhcyhwKSkgdGhyb3cgZXJyKFwiRUVYSVNUXCIsIHApO1xuICAgIHB1dChwLCBmaWxlcy5nZXQocCk/LnRleHQgPz8gXCJcIik7XG4gIH1cbiAgY29uc3QgZmQgPSAzICsgb3Blbi5zaXplO1xuICBvcGVuLnNldChmZCwgcCk7XG4gIHJldHVybiBmZDtcbn1cbmV4cG9ydCBmdW5jdGlvbiByZWFkU3luYyhmZDogbnVtYmVyLCBidWY6IFVpbnQ4QXJyYXksIG9mZnNldDogbnVtYmVyLCBsZW5ndGg6IG51bWJlciwgcG9zaXRpb246IG51bWJlcikge1xuICAvLyBQb3NpdGlvbnMgY291bnQgY2hhcmFjdGVycywgYXMgc3RhdFN5bmMncyBzaXplIGRvZXMgaGVyZS5cbiAgY29uc3QgYnl0ZXMgPSBuZXcgVGV4dEVuY29kZXIoKS5lbmNvZGUoKGZpbGVzLmdldChvcGVuLmdldChmZCkgPz8gXCJcIik/LnRleHQgPz8gXCJcIikuc2xpY2UocG9zaXRpb24sIHBvc2l0aW9uICsgbGVuZ3RoKSkuc3ViYXJyYXkoMCwgbGVuZ3RoKTtcbiAgYnVmLnNldChieXRlcywgb2Zmc2V0KTtcbiAgcmV0dXJuIGJ5dGVzLmxlbmd0aDtcbn1cbmV4cG9ydCBjb25zdCB3cml0ZVN5bmMgPSAoX2ZkOiBudW1iZXIsIHM6IHN0cmluZykgPT4gcy5sZW5ndGg7XG5leHBvcnQgY29uc3QgY2xvc2VTeW5jID0gKGZkOiBudW1iZXIpID0+IHZvaWQgb3Blbi5kZWxldGUoZmQpO1xuZXhwb3J0IGNvbnN0IHN5bWxpbmtTeW5jID0gKCkgPT4ge307XG5leHBvcnQgY29uc3QgY3BTeW5jID0gKCkgPT4ge307XG5leHBvcnQgZnVuY3Rpb24gdXRpbWVzU3luYyhwOiBzdHJpbmcsIF9hdGltZTogRGF0ZSB8IG51bWJlciwgbXRpbWU6IERhdGUgfCBudW1iZXIpIHtcbiAgY29uc3QgZSA9IGZpbGVzLmdldChwKTtcbiAgaWYgKCFlKSB0aHJvdyBlcnIoXCJFTk9FTlRcIiwgcCk7XG4gIHB1dChwLCBlLnRleHQsICttdGltZSk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgZXhpc3RzU3luYywgcmVhZEZpbGVTeW5jLCB3cml0ZUZpbGVTeW5jLCBhcHBlbmRGaWxlU3luYywgbWtkaXJTeW5jLCB1bmxpbmtTeW5jLCBybVN5bmMsIHJlbmFtZVN5bmMsIGNvcHlGaWxlU3luYywgY29uc3RhbnRzLCBta2R0ZW1wU3luYyxcbiAgcmVhZGRpclN5bmMsIHN0YXRTeW5jLCBsc3RhdFN5bmMsIHJlYWxwYXRoU3luYywgb3BlblN5bmMsIHJlYWRTeW5jLCB3cml0ZVN5bmMsIGNsb3NlU3luYywgc3ltbGlua1N5bmMsIGNwU3luYywgdXRpbWVzU3luYyxcbn07XG4iXX0=
export function readFileSync(...args){const t=performance.now();try{return __deep_readFileSync(...args);}finally{const key=(globalThis.__DEEP_ACTIVE||'boot')+':readFileSync';const r=globalThis.__DEEP_FS[key]??={calls:0,ms:0,entries:0,stack:new Error().stack};r.calls++;r.ms+=performance.now()-t;}}

export function readdirSync(...args){const t=performance.now();try{return __deep_readdirSync(...args);}finally{const key=(globalThis.__DEEP_ACTIVE||'boot')+':readdirSync';const r=globalThis.__DEEP_FS[key]??={calls:0,ms:0,entries:0,stack:new Error().stack};r.calls++;r.ms+=performance.now()-t;r.entries+=files.size+dirs.size;}}

export function statSync(...args){const t=performance.now();try{return __deep_statSync(...args);}finally{const key=(globalThis.__DEEP_ACTIVE||'boot')+':statSync';const r=globalThis.__DEEP_FS[key]??={calls:0,ms:0,entries:0,stack:new Error().stack};r.calls++;r.ms+=performance.now()-t;}}
