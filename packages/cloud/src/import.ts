import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";
import { addSource, initLibrary } from "@ore/core";
import { VIDEO_SITE } from "@ore/core/ingest/index";
import { isYoutubeUrl } from "@ore/core/ingest/youtube";

/** What the phone sends (#549): a link, or a file's name and bytes, with the files it links to beside it
 *  (a Markdown note's images), by name, so they come in as they do on the Mac. */
export type ImportJob = { url: string } | { name: string; bytes: Uint8Array; beside?: Record<string, Uint8Array> };

/** The item's folder as the Mac's `ore add` writes it (doc.md, the kept original, assets), by path inside
 *  the folder; or why it can't come in, with the next step (D96). */
export type ImportReply = { id: string; files: Record<string, Uint8Array> } | { refused: string };

const ON_THE_MAC = "Add it on your Mac: Ore's server can't read this kind of source yet.";
const FAILED = "Ore's server couldn't read that just now. Try again, or add it on your Mac.";
/** A refusal whose next step is a Mac's (install a tool there) is no step on a phone. */
const MAC_STEP = /brew install|in Terminal/;

/** A file name the job may write: its last part, never `.`, `..` or empty. */
const safeName = (name: string) => {
  const n = basename(name);
  return n && n !== "." && n !== ".." ? n : null;
};

/** Reads one source with the same core ingest the Mac runs, into a library made for this job alone, and
 *  hands back the item's files. The library is deleted before the reply, whatever happens: the server keeps
 *  nothing (#545). Video and audio aren't the server's (#545 corrections: YouTube blocks servers, the phone
 *  hears audio itself), so a video link is refused, and an episode, which comes in owed, is refused, never
 *  sent back half read. A file's images are read only from what was sent with it. */
export async function importJob(job: ImportJob): Promise<ImportReply> {
  if ("url" in job && (isYoutubeUrl(job.url) || VIDEO_SITE.test(job.url))) return { refused: ON_THE_MAC };
  const name = "name" in job ? safeName(job.name) : null;
  if ("name" in job && !name) return { refused: "That file has no name Ore can read. Rename it and try again." };
  const root = mkdtempSync(join(tmpdir(), "ore-cloud-"));
  try {
    const lib = { root: (await initLibrary(join(root, "lib"))).root };
    const upload = join(root, "upload");
    let input: string;
    if ("url" in job) input = job.url;
    else {
      mkdirSync(upload);
      input = join(upload, name!);
      writeFileSync(input, job.bytes);
      for (const [n, bytes] of Object.entries(job.beside ?? {})) {
        const b = safeName(n);
        if (b && b !== name) writeFileSync(join(upload, b), bytes);
      }
    }
    let item;
    try {
      item = await addSource(lib, input, { owe: true, imagesIn: upload });
    } catch (e) {
      // Ore's own refusals say what to do next; anything else (a disk error with its paths) stays here.
      const why = e instanceof Error ? e.message : String(e);
      if ((e as { code?: unknown }).code !== undefined || !why) {
        console.error("import failed:", e);
        return { refused: FAILED };
      }
      return { refused: MAC_STEP.test(why) ? ON_THE_MAC : why };
    }
    if (item.meta.owed?.length) return { refused: ON_THE_MAC };
    return { id: item.meta.id, files: folder(item.dir) };
  } catch (e) {
    console.error("import failed:", e);
    return { refused: FAILED };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function folder(dir: string): Record<string, Uint8Array> {
  const out: Record<string, Uint8Array> = {};
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out[relative(dir, p)] = new Uint8Array(readFileSync(p));
    }
  };
  walk(dir);
  return out;
}
