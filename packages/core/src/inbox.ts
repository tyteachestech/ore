import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, unlinkSync } from "node:fs";
import { basename, join } from "node:path";
import { deviceName, writeAtomic } from "./fsutil.ts";
import { nowIso, ulid } from "./ids.ts";
import { paths, type Library } from "./library.ts";

// A link added on a device waits in inbox/ as `<id>.link.json` until a device imports it (D223, D227).
// The device that captured it goes first: another one leaves it alone for a few minutes, so the two don't
// both import it while iCloud is still carrying the news, and takes it at once when the first one couldn't.

/** A link, or a file (`file`, with the name it had), waiting to be imported. */
export interface QueuedLink {
  id: string;
  /** The link; a file's name for a file, so every list has one thing to show. */
  url: string;
  /** A file's place under inbox/ (`<id>/<name>`): it waits beside its item, and iCloud carries both. */
  file?: string;
  skills: string[];
  added: string;
  device: string;
  /** Why the last device to try couldn't import it; it is tried again on the next import. */
  error?: string;
}

const LINK = ".link.json";
const FILE = ".file.json";
const SUFFIX = /\.(link|file)\.json$/;
const item = (lib: Library, l: Pick<QueuedLink, "id" | "file">) => join(paths.inbox(lib), `${l.id}${l.file ? FILE : LINK}`);
/** A file's place that would leave inbox/: only whole `.` and `..` parts, since a name may hold dots ("a..b.pdf"). */
export const strays = (file: string) => file.split(/[\\/]/).some((part) => !part || part === "." || part === "..");
const find = (lib: Library, id: string) => [LINK, FILE].map((x) => join(paths.inbox(lib), `${id}${x}`)).find((f) => existsSync(f));

export function queueLink(lib: Library, url: string, skills: string[] = []): QueuedLink {
  // A link shared without its scheme ("example.com/a") gets https://, as Raindrop does.
  const t = url.trim();
  const u = /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`;
  if (!/^https?:\/\/[^\s/]+\.[^\s.]+\S*$/i.test(u)) throw new Error("That isn’t a link: paste one that starts with https://");
  const link: QueuedLink = { id: ulid(), url: u, skills, added: nowIso(), device: deviceName() };
  mkdirSync(paths.inbox(lib), { recursive: true });
  writeAtomic(item(lib, link), JSON.stringify(link, null, 2) + "\n");
  return link;
}

/** A file picked or shared on a device (a PDF, a book, a photo): copied under inbox/ with its own name, which
 *  titles the source, and its item written last, so no device sees the item before the file. */
export function queueFile(lib: Library, path: string, skills: string[] = [], name = basename(path)): QueuedLink {
  if (!existsSync(path)) throw new Error(`There’s no file at ${path}.`);
  const id = ulid();
  const safe = name.replace(/[\/\\:\0]/g, "-").replace(/^\.+/, "") || "file";
  mkdirSync(join(paths.inbox(lib), id), { recursive: true });
  copyFileSync(path, join(paths.inbox(lib), id, safe));
  const q: QueuedLink = { id, url: safe, file: `${id}/${safe}`, skills, added: nowIso(), device: deviceName() };
  writeAtomic(item(lib, q), JSON.stringify(q, null, 2) + "\n");
  return q;
}

/** What is waiting, oldest first. An item that doesn't parse (a half-synced copy) is skipped, and so is a
 *  file's item whose file iCloud hasn't brought yet. */
export function queuedLinks(lib: Library): QueuedLink[] {
  if (!existsSync(paths.inbox(lib))) return [];
  const out: QueuedLink[] = [];
  for (const name of readdirSync(paths.inbox(lib)).sort()) {
    if (!SUFFIX.test(name) || name.startsWith(".")) continue;
    try {
      const l = JSON.parse(readFileSync(join(paths.inbox(lib), name), "utf8")) as QueuedLink;
      const isFile = name.endsWith(FILE);
      if (isFile ? typeof l.file !== "string" || strays(l.file) || !existsSync(join(paths.inbox(lib), l.file)) : typeof l.url !== "string") continue;
      // The id is the item's name, so a synced copy ("<id> 2") is its own entry, removable on its own.
      out.push({ ...l, id: name.replace(SUFFIX, ""), url: typeof l.url === "string" ? l.url : basename(l.file!), skills: Array.isArray(l.skills) ? l.skills : [] });
    } catch {}
  }
  return out;
}

export function removeQueuedLink(lib: Library, id: string): void {
  const f = find(lib, id);
  if (!f) throw new Error(`no link ${id} waiting`);
  // A file's folder goes with it: named by the id it was saved under, which a synced copy's name isn't.
  let dir: string | undefined;
  try {
    const at = (JSON.parse(readFileSync(f, "utf8")) as QueuedLink).file?.split("/")[0];
    if (f.endsWith(FILE) && at && at !== ".." && at !== ".") dir = join(paths.inbox(lib), at);
  } catch {}
  unlinkSync(f);
  if (dir) rmSync(dir, { recursive: true, force: true });
}

/** How long another device's link is left for that device to import itself. */
export const THEIRS_FIRST_MS = 5 * 60_000;

/** Whether this device imports the link now: its own always; another device's once that one has failed,
 *  or has had its few minutes (its app may never have opened: a link shared from Safari). */
export function mine(l: QueuedLink, now = Date.now(), device = deviceName()): boolean {
  if (l.device === device || l.error) return true;
  const at = Date.parse(l.added);
  return Number.isNaN(at) || now - at >= THEIRS_FIRST_MS;
}

/** Imports each waiting link that is this device's to import (`mine`) with `add`, the whole import. A link that fails keeps its reason for the phone
 *  to show and is tried again next time (the Mac may just have been offline); `failed` lists only new reasons, so
 *  the same failure isn't announced on every import. */
export async function importQueued<T extends { id: string; title: string }>(lib: Library, add: (input: string, skills: string[]) => Promise<T>, now = Date.now()): Promise<{ added: (T & { url: string })[]; failed: QueuedLink[] }> {
  const added: (T & { url: string })[] = [];
  const failed: QueuedLink[] = [];
  for (const l of queuedLinks(lib)) {
    if (!mine(l, now)) continue;
    let got: T;
    try {
      got = await add(l.file ? join(paths.inbox(lib), l.file) : l.url, l.skills);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      // Removed on the phone while it was being imported: nothing to keep.
      if (!existsSync(item(lib, l))) continue;
      writeAtomic(item(lib, l), JSON.stringify({ ...l, error }, null, 2) + "\n");
      if (error !== l.error) failed.push({ ...l, error });
      continue;
    }
    try {
      removeQueuedLink(lib, l.id);
    } catch {}
    added.push({ ...got, url: l.url });
  }
  return { added, failed };
}
