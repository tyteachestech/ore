import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { quoteSelector } from "./anchoring.ts";
import { annotationRevs, readAnnotations, reviseAnnotation, type Annotation } from "./annotations.ts";
import { stringifyFrontmatter } from "./frontmatter.ts";
import { latestRevs, sha256, writeAtomic } from "./fsutil.ts";
import { ulid } from "./ids.ts";
import { VIDEO_END } from "./ingest/page.ts";
import { findItem, readItemDir, type Item, type ItemMeta } from "./items.ts";
import { paths, type Library } from "./library.ts";
import { withLock } from "./lock.ts";

/** One Markdown block of a body: a paragraph, a heading, one list item (with its indented lines),
 *  a table, a code fence, an image line. `end` takes the blank lines after it, so cutting a run of
 *  blocks leaves the spacing around it as it was. */
export interface Block {
  start: number;
  end: number;
  /** Heading level (1 to 6), 0 for any other block. */
  level: number;
}

const LIST = /^\s{0,3}([-*+]|\d+[.)])\s/;
const FENCE = /^\s{0,3}(```|~~~)/;
const HEADING = /^\s{0,3}(#{1,6})\s/;

export function blocks(body: string): Block[] {
  const lines: { start: number; text: string }[] = [];
  for (let at = 0; at < body.length; ) {
    const nl = body.indexOf("\n", at);
    const end = nl < 0 ? body.length : nl + 1;
    lines.push({ start: at, text: body.slice(at, nl < 0 ? end : nl) });
    at = end;
  }
  const out: Block[] = [];
  let cur: Block | null = null;
  let fence: string | null = null;
  let gap = false;
  const close = (at: number) => {
    if (cur) out.push({ ...cur, end: at });
    cur = null;
  };
  for (const l of lines) {
    const blank = !l.text.trim();
    if (fence) {
      if (l.text.trimStart().startsWith(fence)) fence = null;
      continue;
    }
    if (blank) {
      gap = true; // blank lines belong to the block before them (closed at the next block's start)
      continue;
    }
    const f = FENCE.exec(l.text);
    const h = HEADING.exec(l.text);
    // A new block starts at a fence, a heading, a list item, after a heading, or after a blank line.
    const starts = f || h || LIST.test(l.text) || !cur || (cur as Block).level > 0 || gap || l.text === VIDEO_END;
    gap = false;
    if (starts) {
      close(l.start);
      cur = { start: l.start, end: l.start, level: h ? h[1]!.length : 0 };
      if (f) fence = f[1]!;
    }
  }
  close(body.length);
  return out;
}

/** The span a cut of `[start, end)` removes: every block it touches, or with `section` the heading
 *  at `start` and everything under it up to the next heading of the same or a higher level. */
export function cutSpan(body: string, start: number, end: number, section = false): { start: number; end: number; section: boolean } {
  const all = blocks(body);
  const touched = all.filter((b) => b.start < Math.max(end, start + 1) && b.end > start);
  if (!touched.length) throw new Error("Nothing to remove there.");
  const first = touched[0]!;
  let last = touched[touched.length - 1]!;
  const isSection = section && first.level > 0;
  if (isSection) {
    const next = all.find((b) => b.start > first.start && b.level > 0 && b.level <= first.level);
    last = next ? all[all.indexOf(next) - 1]! : all[all.length - 1]!;
  }
  let s = first.start;
  let e = last.end;
  // At the very end there is no block after to keep the spacing: take the blank lines before instead,
  // so the body still ends with one newline.
  if (e >= body.length && s > 0) s = Math.min(s, body.slice(0, s).trimEnd().length + 1);
  return { start: s, end: e, section: isSection };
}

export interface Cut {
  /** Names this cut for `restoreCut`. */
  id: string;
  item: string;
  /** Where the removed text was, in the body as it was. */
  at: number;
  text: string;
  section: boolean;
  /** Highlights inside the removed text, as they were; removed with it (their cards stay). */
  removed: Annotation[];
}

const stashDir = (lib: Library, item: string) => join(lib.root, ".ore", "cuts", item);

/** Removes junk from a source's text (a site's table of contents, a footer, a misparsed bit): the
 *  blocks `[start, end)` touches, or the section under the heading at `start`. Highlights after it
 *  shift by exactly the removed length, ones inside it are removed (their cards stay; questions stay,
 *  as on Reimport). The video transcript part of a page can't be cut: its words carry the timings.
 *  The original file (source.*) is untouched, so Reimport brings the full text back. */
export async function cutText(lib: Library, ref: string, start: number, end: number, opts: { section?: boolean } = {}): Promise<Cut> {
  const item = findItem(lib, ref);
  if (item.meta.type === "youtube") throw new Error("A video's transcript can't be cut: its words are timed to the video.");
  const body = item.body;
  if (start < 0 || end > body.length || end < start) throw new Error("That text is not in this source any more. Reopen it and try again.");
  const video = body.indexOf(VIDEO_END);
  const span = cutSpan(body, start, end, opts.section);
  if (video >= 0 && span.start < video + VIDEO_END.length) throw new Error("The video transcript can't be cut: its words are timed to the video. Cut the page text below it.");
  const cut = { id: ulid(), item: item.meta.id, at: span.start, text: body.slice(span.start, span.end), section: span.section };
  if (!cut.text.trim()) throw new Error("Nothing to remove there.");
  return apply(lib, item, cut);
}

/** Cuts `cut.text` at `cut.at`, writes its record for Undo and Redo, and returns it with the highlights it took. */
async function apply(lib: Library, item: Item, c: Omit<Cut, "removed">): Promise<Cut> {
  const cut: Cut = { ...c, removed: [] };
  const body = item.body;
  const end = cut.at + cut.text.length;
  await withLock(paths.lock(lib), () => {
    const next = body.slice(0, cut.at) + body.slice(end);
    const len = cut.text.length;
    for (const a of readAnnotations(item)) {
      if (a.end <= cut.at) continue;
      if (a.start >= end) reviseAnnotation(item, a, quoteSelector(next, a.start - len, a.end - len));
      else if (a.intent !== "question") {
        cut.removed.push(a);
        reviseAnnotation(item, a, { status: "deleted" });
      }
    }
    writeAtomic(item.docPath, stringifyFrontmatter({ ...item.meta, text_sha256: sha256(next) }, next));
    mkdirSync(stashDir(lib, item.meta.id), { recursive: true });
    writeAtomic(join(stashDir(lib, item.meta.id), `${cut.id}.json`), JSON.stringify(cut));
  });
  return cut;
}

/** A section at the end of a source's body (an episode's page text, D215), added, taken out and put
 *  back under the library lock, each time from the source as it is then, so two at once or a cut
 *  landing meanwhile is never overwritten. It is recorded as a cut, found again as the body's end
 *  (a cut above it moves it), and `mark` keeps the frontmatter in step: the record's id while the
 *  text is in, undefined once it is out. */
type Mark = (meta: ItemMeta, id: string | undefined) => ItemMeta;

/** Adds `make(item)` (which may refuse, seeing the source as it is under the lock) at the body's end. */
export async function appendText(lib: Library, ref: string, make: (item: Item) => string, mark: Mark): Promise<Cut> {
  const dir = findItem(lib, ref).dir;
  return withLock(paths.lock(lib), () => {
    const item = readItemDir(dir);
    const text = make(item);
    const cut: Cut = { id: ulid(), item: item.meta.id, at: item.body.length, text, section: false, removed: [] };
    write(lib, item, cut, item.body + text, mark(item.meta, cut.id));
    return cut;
  });
}

/** Takes an added end section out again (Undo): its highlights go with it, kept for `putEnd`. */
export async function takeEnd(lib: Library, ref: string, id: string, mark: Mark): Promise<Cut> {
  const dir = findItem(lib, ref).dir;
  return withLock(paths.lock(lib), () => {
    const item = readItemDir(dir);
    const was = readCut(lib, item, id);
    if (!item.body.endsWith(was.text)) throw new Error("That text changed since, so it can’t be taken out in one step.");
    const cut: Cut = { ...was, at: item.body.length - was.text.length, removed: [] };
    const next = item.body.slice(0, cut.at);
    for (const a of readAnnotations(item))
      if (a.end > cut.at && a.intent !== "question") {
        cut.removed.push(a);
        reviseAnnotation(item, a, { status: "deleted" });
      }
    write(lib, item, cut, next, mark(item.meta, undefined));
    return cut;
  });
}

/** Puts an end section back at the body's end (Redo), its highlights with it. */
export async function putEnd(lib: Library, ref: string, id: string, mark: Mark): Promise<Item> {
  const dir = findItem(lib, ref).dir;
  return withLock(paths.lock(lib), () => {
    const item = readItemDir(dir);
    const was = readCut(lib, item, id);
    if (item.body.endsWith(was.text)) throw new Error("That text is already back.");
    const shift = item.body.length - was.at;
    const next = item.body + was.text;
    const now = new Map(latestRevs(annotationRevs(item.dir)).map((a) => [a.id, a]));
    for (const r of was.removed) {
      const c = now.get(r.id);
      if (c?.status === "deleted") reviseAnnotation(item, c, { status: r.status, ...quoteSelector(next, r.start + shift, r.end + shift) });
    }
    write(lib, item, { ...was, at: item.body.length, removed: [] }, next, mark(item.meta, was.id));
    return readItemDir(dir);
  });
}

/** Records text already at the body's end (a Reimport adding the page text again) for `takeEnd`; its id. */
export function recordEnd(lib: Library, item: string, at: number, text: string): string {
  const cut: Cut = { id: ulid(), item, at, text, section: false, removed: [] };
  mkdirSync(stashDir(lib, item), { recursive: true });
  writeAtomic(join(stashDir(lib, item), `${cut.id}.json`), JSON.stringify(cut));
  return cut.id;
}

/** Writes the body and its record; called under the lock. */
function write(lib: Library, item: Item, cut: Cut, next: string, meta: ItemMeta) {
  writeAtomic(item.docPath, stringifyFrontmatter({ ...meta, text_sha256: sha256(next) }, next));
  mkdirSync(stashDir(lib, item.meta.id), { recursive: true });
  writeAtomic(join(stashDir(lib, item.meta.id), `${cut.id}.json`), JSON.stringify(cut));
}

const readCut = (lib: Library, item: Item, id: string): Cut => {
  const file = join(stashDir(lib, item.meta.id), `${id}.json`);
  if (!existsSync(file)) throw new Error("There is no removed text with that id.");
  return JSON.parse(readFileSync(file, "utf8")) as Cut;
};

/** Takes the same text out again after `restoreCut` (Redo). */
export async function redoCut(lib: Library, ref: string, cutId: string): Promise<Cut> {
  const item = findItem(lib, ref);
  const { removed: _, ...cut } = readCut(lib, item, cutId);
  if (item.body.slice(cut.at, cut.at + cut.text.length) !== cut.text) throw new Error("The text changed since; that part can't be removed again.");
  return apply(lib, item, cut);
}

/** Puts a cut's text back where it was, its highlights with it, and shifts the ones after it back. */
export async function restoreCut(lib: Library, ref: string, cutId: string): Promise<Item> {
  const item = findItem(lib, ref);
  const cut = readCut(lib, item, cutId);
  const body = item.body;
  if (cut.at > body.length || body.slice(cut.at, cut.at + cut.text.length) === cut.text) throw new Error("That text is already back, or the source changed since.");
  await withLock(paths.lock(lib), () => {
    const next = body.slice(0, cut.at) + cut.text + body.slice(cut.at);
    const len = cut.text.length;
    for (const a of readAnnotations(item)) if (a.start >= cut.at) reviseAnnotation(item, a, quoteSelector(next, a.start + len, a.end + len));
    const now = new Map(latestRevs(annotationRevs(item.dir)).map((a) => [a.id, a]));
    for (const was of cut.removed) {
      const c = now.get(was.id);
      if (c?.status === "deleted") reviseAnnotation(item, c, { status: was.status, ...quoteSelector(next, was.start, was.end) });
    }
    writeAtomic(item.docPath, stringifyFrontmatter({ ...item.meta, text_sha256: sha256(next) }, next));
  });
  return readItemDir(item.dir);
}
