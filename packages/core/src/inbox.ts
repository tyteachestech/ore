import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { deviceName, writeAtomic } from "./fsutil.ts";
import { nowIso, ulid } from "./ids.ts";
import { paths, type Library } from "./library.ts";

// A link added on the iPhone waits in inbox/ as `<id>.link.json` until the Mac imports it (D223): the
// phone can't run the whole import (D96) or the AI (D78.3), and iCloud brings the file to the Mac.

export interface QueuedLink {
  id: string;
  url: string;
  skills: string[];
  added: string;
  device: string;
  /** Why the Mac couldn't import it; it stays until he removes it. */
  error?: string;
}

const SUFFIX = ".link.json";
const file = (lib: Library, id: string) => join(paths.inbox(lib), `${id}${SUFFIX}`);

export function queueLink(lib: Library, url: string, skills: string[] = []): QueuedLink {
  const u = url.trim();
  if (!/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(u)) throw new Error("That isn’t a link: paste one that starts with https://");
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
      if (typeof l.url === "string" && typeof l.id === "string") out.push({ ...l, skills: Array.isArray(l.skills) ? l.skills : [] });
    } catch {}
  }
  return out;
}

export function removeQueuedLink(lib: Library, id: string): void {
  if (!existsSync(file(lib, id))) throw new Error(`no link ${id} waiting`);
  unlinkSync(file(lib, id));
}

/** Imports each waiting link with `add` (the Mac's whole import); a link that fails keeps its reason for the phone to show. */
export async function importQueued(lib: Library, add: (url: string, skills: string[]) => Promise<{ id: string; title: string }>): Promise<{ added: { id: string; title: string; url: string }[]; failed: QueuedLink[] }> {
  const added: { id: string; title: string; url: string }[] = [];
  const failed: QueuedLink[] = [];
  for (const l of queuedLinks(lib)) {
    if (l.error) continue;
    try {
      const item = await add(l.url, l.skills);
      unlinkSync(file(lib, l.id));
      added.push({ ...item, url: l.url });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      writeAtomic(file(lib, l.id), JSON.stringify({ ...l, error }, null, 2) + "\n");
      failed.push({ ...l, error });
    }
  }
  return { added, failed };
}
