import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { dirname, basename, join } from "node:path";
import { slugify } from "./ids.ts";

/** A library folder's entries, without dotfiles (Finder's .DS_Store, AppleDouble ._ files, our temp files),
 *  in name order: the filesystem's own order differs by Mac and Bun, and readers keep the first copy they read. */
export const visible = (dir: string): string[] => (existsSync(dir) ? readdirSync(dir).filter((n) => !n.startsWith(".")).sort() : []);

/** A library folder's subfolders, without dotfolders or stray files. */
export const subdirs = (dir: string): string[] =>
  existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith(".")).map((d) => d.name).sort() : [];

// Atomic write: temp file in the same directory, then rename.
export function writeAtomic(path: string, content: string | Uint8Array): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = join(dirname(path), `.${basename(path)}.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(tmp, content);
  renameSync(tmp, path);
}

// One JSON object per line. O_APPEND keeps concurrent single-line appends intact. A file whose last line
// lost its newline (a crash or a sync mid-write, an editor that drops the final newline) gets one first,
// so the new record never joins that line and makes both unreadable.
export function appendJsonl(path: string, record: object): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, (endsOpen(path) ? "\n" : "") + JSON.stringify(record) + "\n");
}

function endsOpen(path: string): boolean {
  if (!existsSync(path)) return false;
  // The whole file, not its last byte: the iPhone build's fs stand-in has no file handles, and a log is
  // a month's or one source's lines, which every reader reads whole anyway.
  const text = readFileSync(path, "utf8");
  return text.length > 0 && !text.endsWith("\n");
}

export interface JsonlLine<T> {
  line: number;
  value?: T;
  error?: string;
}

export function readJsonlLines<T>(path: string): JsonlLine<T>[] {
  if (!existsSync(path)) return [];
  const out: JsonlLine<T>[] = [];
  readFileSync(path, "utf8")
    .split("\n")
    .forEach((raw, i) => {
      if (!raw.trim()) return;
      try {
        const value = JSON.parse(raw);
        // A record is an object; anything else (a stray `null`, an array) is a bad line, skipped like broken JSON.
        out.push(value && typeof value === "object" && !Array.isArray(value) ? { line: i + 1, value: value as T } : { line: i + 1, error: "not a JSON object" });
      } catch (e) {
        out.push({ line: i + 1, error: (e as Error).message });
      }
    });
  return out;
}

export function readJsonl<T>(path: string): T[] {
  return readJsonlLines<T>(path).flatMap((l) => (l.value === undefined ? [] : [l.value]));
}

// Latest revision per id ("rev" semantics for append-only edit logs). Two devices can each write the
// same rev; the later one wins.
export function latestRevs<T extends { id: string; rev: number; ts?: string }>(records: T[]): T[] {
  const byId = new Map<string, T>();
  for (const r of records) {
    const prev = byId.get(r.id);
    if (!prev || r.rev > prev.rev || (r.rev === prev.rev && (r.ts ?? "") >= (prev.ts ?? ""))) byId.set(r.id, r);
  }
  return [...byId.values()];
}

// ---- Logs shared by several devices (iPhone + Mac). A synced folder turns two devices appending to one
// file into a conflicted copy, so each device appends to its own file beside it (`2026-10.jsonl` →
// `2026-10.tys-mac.jsonl`) and readers take the union. Files without a device part, written before,
// and conflicted copies (`2026-10 2.jsonl`) are read too; readers drop the duplicates.

/** This device's name in log file names: ORE_DEVICE, else the computer's name. */
export const deviceName = (): string => slugify(process.env.ORE_DEVICE || hostname().replace(/\.local$/, "")) || "device";

/** The file this device appends to for the log at `path` (`x.jsonl` → `x.<device>.jsonl`). */
export const deviceLog = (path: string): string => path.replace(/\.jsonl$/, `.${deviceName()}.jsonl`);

/** Every file of the log at `path`: the shared one, each device's, and conflicted copies of either. */
export function logFiles(path: string): string[] {
  const dir = dirname(path);
  const stem = basename(path, ".jsonl");
  return visible(dir)
    .filter((f) => f.endsWith(".jsonl") && (f === `${stem}.jsonl` || f.startsWith(`${stem}.`) || f.startsWith(`${stem} `)))
    .sort()
    .map((f) => join(dir, f));
}

/** The records of a log across all its files. */
export const readLog = <T>(path: string): T[] => logFiles(path).flatMap((f) => readJsonl<T>(f));

/** An error as one line for the user: a schema check names the field and what was wrong, not the JSON of its issues. */
export function errorLine(e: unknown): string {
  const issues = (e as { issues?: { path: PropertyKey[]; message: string }[] } | null)?.issues;
  if (Array.isArray(issues) && issues.length) return issues.map((i) => `${i.path.map(String).join(".") || "value"}: ${i.message}`).join("; ");
  // A folder or file he (or a sync) made read-only: say where and what to check, not the raw EACCES with a temp name.
  const code = (e as { code?: string } | null)?.code;
  const path = (e as { path?: string } | null)?.path;
  if ((code === "EACCES" || code === "EPERM") && path) return `Ore doesn’t have permission to use ${dirname(path)}: check its permissions in Finder › Get Info (Sharing & Permissions)`;
  return (e instanceof Error ? e.message : String(e)).split("\n")[0]!;
}

export const sha256 =(text: string): string => new Bun.CryptoHasher("sha256").update(text).digest("hex");
