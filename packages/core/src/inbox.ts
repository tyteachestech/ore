import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { deviceName, writeAtomic } from "./fsutil.ts";
import { nowIso, ulid } from "./ids.ts";
import { paths, type Library } from "./library.ts";

// A link added on a device waits in inbox/ as `<id>.link.json` until a device imports it (D223, D227).
// The device that captured it goes first: another one leaves it alone for a few minutes, so the two don't
// both import it while iCloud is still carrying the news, and takes it at once when the first one couldn't.

export interface QueuedLink {
  id: string;
  url: string;
  skills: string[];
  added: string;
  device: string;
  /** Why the last device to try couldn't import it; it is tried again on the next import. */
  error?: string;
}

const SUFFIX = ".link.json";
const file = (lib: Library, id: string) => join(paths.inbox(lib), `${id}${SUFFIX}`);

export function queueLink(lib: Library, url: string, skills: string[] = []): QueuedLink {
  // A link shared without its scheme ("example.com/a") gets https://, as Raindrop does.
  const t = url.trim();
  const u = /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`;
  if (!/^https?:\/\/[^\s/]+\.[^\s.]+\S*$/i.test(u)) throw new Error("That isn’t a link: paste one that starts with https://");
  const link: QueuedLink = { id: ulid(), url: u, skills, added: nowIso(), device: deviceName() };
  mkdirSync(paths.inbox(lib), { recursive: true });
  writeAtomic(file(lib, link.id), JSON.stringify(link, null, 2) + "\n");
  return link;
}

/** The links waiting, oldest first. A file that doesn't parse (a half-synced copy) is skipped. */
export function queuedLinks(lib: Library): QueuedLink[] {
  if (!existsSync(paths.inbox(lib))) return [];
  const out: QueuedLink[] = [];
  for (const name of readdirSync(paths.inbox(lib)).sort()) {
    if (!name.endsWith(SUFFIX) || name.startsWith(".")) continue;
    try {
      const l = JSON.parse(readFileSync(join(paths.inbox(lib), name), "utf8")) as QueuedLink;
      // The id is the file's name, so a synced copy ("<id> 2") is its own entry, removable on its own.
      if (typeof l.url === "string") out.push({ ...l, id: name.slice(0, -SUFFIX.length), skills: Array.isArray(l.skills) ? l.skills : [] });
    } catch {}
  }
  return out;
}

export function removeQueuedLink(lib: Library, id: string): void {
  if (!existsSync(file(lib, id))) throw new Error(`no link ${id} waiting`);
  unlinkSync(file(lib, id));
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
export async function importQueued<T extends { id: string; title: string }>(lib: Library, add: (url: string, skills: string[]) => Promise<T>, now = Date.now()): Promise<{ added: (T & { url: string })[]; failed: QueuedLink[] }> {
  const added: (T & { url: string })[] = [];
  const failed: QueuedLink[] = [];
  for (const l of queuedLinks(lib)) {
    if (!mine(l, now)) continue;
    let item: T;
    try {
      item = await add(l.url, l.skills);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      // Removed on the phone while it was being imported: nothing to keep.
      if (!existsSync(file(lib, l.id))) continue;
      writeAtomic(file(lib, l.id), JSON.stringify({ ...l, error }, null, 2) + "\n");
      if (error !== l.error) failed.push({ ...l, error });
      continue;
    }
    try {
      unlinkSync(file(lib, l.id));
    } catch {}
    added.push({ ...item, url: l.url });
  }
  return { added, failed };
}
