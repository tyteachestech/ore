import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, extname, join, relative } from "node:path";
import { diff3Merge } from "node-diff3";
import { sha256, writeAtomic } from "./fsutil.ts";
import { slugify } from "./ids.ts";
import { nowIso } from "./ids.ts";
import { findItem, updateItemMeta, type Item } from "./items.ts";
import { proseLines } from "./links.ts";
import { paths, type Library } from "./library.ts";
import { withLock } from "./lock.ts";
import { loadSkills } from "./skills.ts";

// Source note (D31): items/<yyyy>/<slug>-<id>/notes.md, plain Markdown, Tyler's
// writing only. Outside doc.md, so it never changes text_sha256.
export const notesPath = (item: Item) => join(item.dir, "notes.md");

export function readNotes(item: Item): string {
  const p = notesPath(item);
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

// Notes text that enrich has not drafted from yet, or null.
export function pendingNotes(item: Item): string | null {
  const text = readNotes(item);
  return text.trim() && sha256(text) !== item.meta.notes_drafted ? text : null;
}

// Append rule shared by recall, chapter recall and `ore notes --append`:
// skip text already present verbatim; else add it at the end of the
// `## <heading>` block, or under a new heading at the end.
export function appendNoteText(current: string, text: string, heading: string): string {
  const t = text.trim();
  if (current.includes(t)) return current;
  const h = `## ${heading.trim()}`;
  const lines = current.split("\n");
  // Headings in fenced code are code: a recall never lands inside a code block.
  const prose = proseLines(current);
  const at = prose.findIndex((l) => l.trimEnd() === h);
  if (at === -1) return current.trim() ? `${current.trimEnd()}\n\n${h}\n\n${t}` : `${h}\n\n${t}`;
  const next = prose.findIndex((l, i) => i > at && l.startsWith("## "));
  const block = lines.slice(0, next === -1 ? lines.length : next).join("\n").trimEnd();
  const rest = next === -1 ? "" : `\n\n${lines.slice(next).join("\n")}`;
  return `${block}\n\n${t}${rest}`;
}

// Headings the app and CLI write for recalls and the finish line; every other
// `## ` block in the source note holds his section lines (D32).
const RESERVED = /^(Recall|Chapter \d+ recall|Use and connections|Use or dispute|Goal try, \d{4}-\d{2}-\d{2})$/;

// His section lines: the non-empty blocks under `## ` headings that are not reserved.
export function sectionLines(notes: string): { heading: string; text: string }[] {
  const out: { heading: string; text: string }[] = [];
  let cur: { heading: string; lines: string[] } | null = null;
  const flush = () => {
    const text = cur?.lines.join("\n").trim();
    if (cur && text && !RESERVED.test(cur.heading)) out.push({ heading: cur.heading, text });
  };
  const prose = proseLines(notes);
  for (const [i, l] of notes.split("\n").entries()) {
    if (prose[i]!.startsWith("## ")) {
      flush();
      cur = { heading: l.slice(3).trim(), lines: [] };
    } else cur?.lines.push(l);
  }
  flush();
  return out;
}

// Skill notes (D41): skills/<skill-id>/notes.md, one per skill, his writing only.
export const skillNotesPath = (lib: Library, skill: string) => join(paths.skillNotes(lib), skill, "notes.md");

// Which note: a source note (an item ref) or a skill's note.
export type NoteRef = string | { skill: string };

export interface NotesResult {
  item?: string;
  skill?: string;
  text: string;
  path: string; // relative to the library root
  dir: string; // the note's folder, absolute (images/ lives here)
}

function noteFile(lib: Library, ref: NoteRef): { path: string; key: { item: string } | { skill: string } } {
  if (typeof ref === "string") {
    const item = findItem(lib, ref);
    return { path: notesPath(item), key: { item: item.meta.id } };
  }
  if (!loadSkills(lib).skills.some((s) => s.id === ref.skill)) throw new Error(`unknown skill "${ref.skill}"`);
  return { path: skillNotesPath(lib, ref.skill), key: { skill: ref.skill } };
}

const read = (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : "");
const result = (lib: Library, f: ReturnType<typeof noteFile>, text: string): NotesResult => ({ ...f.key, text, path: relative(lib.root, f.path), dir: dirname(f.path) });

export function getNotes(lib: Library, ref: NoteRef): NotesResult {
  const f = noteFile(lib, ref);
  return result(lib, f, read(f.path));
}

// Line-level three-way merge of his edit (`mine`, made from `base`) with the file as it now
// stands (`theirs`: an agent or a recall appended meanwhile). Where both changed the same lines
// both versions are kept, his first, so no words are lost.
export function mergeNotes(mine: string, base: string, theirs: string): string {
  const out: string[] = [];
  for (const r of diff3Merge(mine.split("\n"), base.split("\n"), theirs.split("\n"))) {
    if (r.ok) out.push(...r.ok);
    else if (r.conflict) out.push(...resolve(r.conflict.a, r.conflict.o, r.conflict.b));
  }
  return out.join("\n");
}

const starts = (xs: string[], p: string[]) => p.length <= xs.length && p.every((x, i) => xs[i] === x);
const ends = (xs: string[], p: string[]) => starts(xs.slice(xs.length - p.length), p);

// diff3 calls edits on neighbouring lines a conflict: he changed a line and an append landed
// right after it. When one side only added lines around the base, his edit plus those lines is
// the merge; otherwise both versions stay.
function resolve(a: string[], o: string[], b: string[]): string[] {
  if (o.length) {
    if (starts(b, o)) return [...a, ...b.slice(o.length)];
    if (ends(b, o)) return [...b.slice(0, b.length - o.length), ...a];
    if (starts(a, o)) return [...b, ...a.slice(o.length)];
    if (ends(a, o)) return [...a.slice(0, a.length - o.length), ...b];
  }
  return [...a, ...(a.join("\n").includes(b.join("\n")) ? [] : b)];
}

// Replace notes.md (the app autosaves through this). "" keeps an empty file. With `base`, the
// text his edit started from, a file changed by someone else since is merged rather than
// overwritten; the result's text is what was written, `merged` says whether that happened.
export async function setNotes(lib: Library, ref: NoteRef, text: string, base?: string): Promise<NotesResult & { merged: boolean }> {
  return withLock(paths.lock(lib), () => {
    const f = noteFile(lib, ref);
    const current = read(f.path);
    const merged = base !== undefined && current !== base && current !== text;
    const next = merged ? mergeNotes(text, base, current) : text;
    writeAtomic(f.path, next);
    return { ...result(lib, f, next), merged };
  });
}

export async function appendNote(lib: Library, ref: NoteRef, text: string, heading: string): Promise<NotesResult> {
  if (!text.trim()) throw new Error("note text is empty");
  // An agent may pass the heading as Markdown ("## Recall"); it is written as one.
  heading = heading.trim().replace(/^#+\s*/, "");
  if (!heading) throw new Error("heading is empty");
  return withLock(paths.lock(lib), () => {
    const f = noteFile(lib, ref);
    const current = read(f.path);
    const next = appendNoteText(current, text, heading);
    if (next !== current) writeAtomic(f.path, next);
    return result(lib, f, next);
  });
}

// Copy an image into images/ beside the note (D38); returns its path relative to notes.md,
// for a Markdown image link. The note text itself is not changed.
export async function attachToNote(lib: Library, ref: NoteRef, file: string): Promise<NotesResult & { attached: string }> {
  if (!existsSync(file)) throw new Error(`no file at ${file}`);
  const ext = extname(file).toLowerCase();
  if (![".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"].includes(ext)) throw new Error("attach an image (png, jpg, gif, webp, svg)");
  return withLock(paths.lock(lib), () => {
    const f = noteFile(lib, ref);
    const dir = join(dirname(f.path), "images");
    mkdirSync(dir, { recursive: true });
    const stem = slugify(basename(file, extname(file)));
    const taken = new Set(readdirSync(dir));
    let name = `${stem}${ext}`;
    for (let n = 2; taken.has(name); n++) name = `${stem}-${n}${ext}`;
    copyFileSync(file, join(dir, name));
    return { ...result(lib, f, read(f.path)), attached: `images/${name}` };
  });
}

// Store free recall text (finish step, D18); replaces earlier text and drops
// its feedback. The text also becomes the first draft in the source note (D31).
export async function setRecall(lib: Library, ref: string, text: string) {
  const t = text.trim();
  if (!t) throw new Error("recall text is empty");
  const meta = await updateItemMeta(lib, ref, (m) => ({ ...m, recall: { text: t, at: nowIso() } }));
  const notes = await appendNote(lib, meta.id, t, "Recall");
  return { item: meta.id, recall: { text: meta.recall!.text!, at: meta.recall!.at! }, notes: notes.text };
}

export const chapterMarker = (n: number) => `<!-- chapter ${n} -->`;

// EPUB chapter recall: upsert chapter_recalls[n] (new text drops feedback)
// and append it to the source note under `heading` (the chapter's title, D115;
// "Chapter N recall" when none is given). Text already in the note is not added again.
export async function setChapterRecall(lib: Library, ref: string, n: number, text: string, heading = `Chapter ${n} recall`) {
  const t = text.trim();
  if (!t) throw new Error("recall text is empty");
  if (!Number.isInteger(n) || n < 1) throw new Error("--chapter must be a positive integer");
  const item = findItem(lib, ref);
  if (!item.body.includes(chapterMarker(n))) throw new Error(`item ${item.meta.id} has no ${chapterMarker(n)} marker`);
  const meta = await updateItemMeta(lib, item.meta.id, (m) => {
    const others = (m.chapter_recalls ?? []).filter((c) => c.n !== n);
    return { ...m, chapter_recalls: [...others, { n, text: t, at: nowIso() }].sort((a, b) => a.n - b.n) };
  });
  const r = meta.chapter_recalls!.find((c) => c.n === n)!;
  const notes = await appendNote(lib, meta.id, t, heading);
  return { item: meta.id, chapter: n, recall: { text: r.text, at: r.at }, notes: notes.text };
}
