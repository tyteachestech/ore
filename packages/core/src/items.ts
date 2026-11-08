import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { parseFrontmatter, stringifyFrontmatter } from "./frontmatter.ts";
import { sha256, subdirs, writeAtomic } from "./fsutil.ts";
import { nowIso, slugify, ulid } from "./ids.ts";
import { paths, type Library } from "./library.ts";
import { withLock } from "./lock.ts";
import { madeThisRun } from "./cancel.ts";

export const ItemType = z.enum(["article", "pdf", "youtube", "markdown", "snippet", "epub"]);
export type ItemType = z.infer<typeof ItemType>;
export const ItemStatus = z.enum(["inbox", "reading", "done"]);
export type ItemStatus = z.infer<typeof ItemStatus>;

export const AiStamp = z.object({ vendor: z.string(), model: z.string(), prompt_version: z.string() });
export type AiStamp = z.infer<typeof AiStamp>;

// A sentence of doc.md that supports a key point, anchored like a highlight (D56).
export const Evidence = z.object({ exact: z.string(), prefix: z.string(), suffix: z.string(), start: z.number().int(), end: z.number().int() });
export type Evidence = z.infer<typeof Evidence>;
export const KeyPoint = z.object({ text: z.string(), evidence: z.array(Evidence) });
export type KeyPoint = z.infer<typeof KeyPoint>;
// Which key points his `after` answer covered: marked by AI, flipped by him (`edited`) (D56).
export const PrequestionCheck = z.object({ covered: z.array(z.boolean()), ai: AiStamp, edited: z.boolean().optional() });

// D18: Tyler's attempt before reading and closed-book answer at finish. Unscored. The quiz (D52 to
// D56) adds his confidence in `after` (1 guess, 2 think so, 3 sure), the key points and the check.
export const Prequestion = z.object({
  q: z.string(),
  before: z.string().optional(),
  after: z.string().optional(),
  confidence: z.number().int().min(1).max(3).optional(),
  points: z.array(KeyPoint).optional(),
  points_ai: AiStamp.optional(),
  check: PrequestionCheck.optional(),
  // Not part of this finish (D100): its answer lies past where he stopped, or he asked to leave it out.
  skipped: z.enum(["past", "left_out"]).optional(),
});
export type Prequestion = z.infer<typeof Prequestion>;
export const RecallFeedback = z.object({
  feedback: z.string(),
  questions: z.array(z.object({ n: z.number().int().positive(), feedback: z.string() })),
  missed: z.array(z.string()),
  section_lines: z.string().nullable().optional(), // one line on his section lines (D32); null when he wrote none
  ai: AiStamp,
});
export type RecallFeedback = z.infer<typeof RecallFeedback>;
// Free recall at finish. text/at are absent when feedback covered only after-answers.
export const Recall = z.object({ text: z.string().optional(), at: z.string().optional(), feedback: RecallFeedback.optional() });
export type Recall = z.infer<typeof Recall>;
// EPUB per-chapter closed-book recall (D18); n is the number in the `<!-- chapter N -->` marker.
export const ChapterRecallFeedback = RecallFeedback.omit({ questions: true });
export const ChapterRecall = z.object({ n: z.number().int().positive(), text: z.string(), at: z.string(), feedback: ChapterRecallFeedback.optional() });
export type ChapterRecall = z.infer<typeof ChapterRecall>;

// A skill the enrich step proposes when none of Tyler's skills is the obvious home (D25).
export const SuggestedSkill = z.object({ name: z.string(), hook: z.string().optional() });

// An open question this source may answer (D75): matched by enrich with the passage that answers it
// (`quote`, anchored, at `start`), or added for it from Begin research (no quote).
export const QuestionMatch = z.object({ question: z.string(), quote: z.string().optional(), start: z.number().int().nonnegative().optional() });
export type QuestionMatch = z.infer<typeof QuestionMatch>;

// A lesson of a course (a Claude Academy course, a YouTube playlist): every lesson is its own source,
// grouped by `id`, listed by `part` (1-based). `title` and `url` are the course's.
export const CourseRef = z.object({ id: z.string(), title: z.string(), part: z.number().int().positive(), url: z.string().optional() });
export type CourseRef = z.infer<typeof CourseRef>;

export const ItemMetaSchema = z.object({
  id: z.string(),
  type: ItemType,
  title: z.string(),
  url: z.string().optional(),
  // A page that plays a video (D92): the video's link; its transcript is `transcript.vtt` beside the source.
  video: z.string().optional(),
  author: z.string().optional(),
  published: z.string().optional(),
  // A PDF's tables or formulas that read as lines of text until Docling reads them (D125).
  structure: z.array(z.enum(["tables", "formulas"])).optional(),
  captured_at: z.string(),
  source_app: z.string().optional(),
  text_sha256: z.string(),
  status: ItemStatus,
  finished_at: z.string().optional(),
  archived_at: z.string().optional(), // archived: hidden from lists and search, files and cards kept
  pinned_at: z.string().optional(), // pinned: listed first, under Pinned, wherever the source is listed
  opened_at: z.string().optional(), // last opened in the reader: To read lists the last touched first (D110)
  // A post opened from the Feed and not kept yet: hidden from every list, deleted on close unless he
  // highlighted or wrote in it, which keeps it as a source (`keepPreview`).
  preview: z.string().optional(),
  course: CourseRef.optional(),
  skills: z.array(z.string()).default([]),
  suggested_skill: SuggestedSkill.optional(),
  topics: z.array(z.string()).default([]),
  prequestions: z.array(Prequestion).optional(),
  recall: Recall.optional(),
  chapter_recalls: z.array(ChapterRecall).optional(),
  question_matches: z.array(QuestionMatch).optional(),
  // A finish partway (D100): `reached` is the body offset he got to (the furthest point read or played);
  // `leave_out` what he asked the finish to leave out, and the AI that judged it against the prequestions.
  reached: z.number().int().nonnegative().optional(),
  leave_out: z.object({ text: z.string(), ai: AiStamp.optional() }).optional(),
  // D118: plain highlights the finish plan has weighed, carded or not, so it never weighs them again.
  planned: z.array(z.string()).optional(),
  notes_drafted: z.string().optional(), // sha256 of notes.md text the last enrich drafted from
  enriched_at: z.string().optional(),
  ai: AiStamp.optional(),
});
export type ItemMeta = z.infer<typeof ItemMetaSchema>;

export interface Item {
  meta: ItemMeta;
  body: string;
  dir: string;
  docPath: string;
}

export interface NewItem {
  type: ItemType;
  title: string;
  body: string;
  url?: string;
  video?: string;
  /** The video's captions (WebVTT), for a page that plays one (D92). */
  transcript?: string;
  author?: string;
  published?: string;
  source_app?: string;
  skills?: string[];
  course?: CourseRef;
  source?: { ext: string; data: string | Uint8Array };
  /** Images the body shows, saved beside it as `assets/<name>` (D96). */
  assets?: Asset[];
  /** Opened from the Feed, not kept yet. */
  preview?: boolean;
  structure?: ("tables" | "formulas")[];
}

export type Asset = { name: string; data: Uint8Array };

/** A title as one line: a PDF's metadata or a pasted rename can carry line breaks and runs of spaces. */
const oneLine = (title: string) => title.replace(/\s+/g, " ").trim();

export async function createItem(lib: Library, input: NewItem): Promise<Item> {
  // Line ends as every read sees them (Windows and old-Mac files too), so offsets and the hash hold.
  const body = input.body.replace(/\r\n?/g, "\n");
  const title = oneLine(input.title) || "Untitled";
  const id = ulid();
  const now = new Date();
  const dir = join(paths.items(lib), String(now.getUTCFullYear()), `${slugify(title)}-${id}`);
  const meta: ItemMeta = {
    id,
    type: input.type,
    title,
    url: input.url,
    video: input.video,
    author: input.author || undefined,
    published: input.published || undefined,
    structure: input.structure,
    captured_at: nowIso(now),
    source_app: input.source_app,
    text_sha256: sha256(body),
    status: "inbox",
    skills: input.skills ?? [],
    topics: [],
    course: input.course,
    preview: input.preview ? nowIso(now) : undefined,
  };
  const docPath = join(dir, "doc.md");
  madeThisRun(dir);
  await withLock(paths.lock(lib), () => {
    if (input.source) writeAtomic(join(dir, `source.${input.source.ext}`), input.source.data);
    if (input.transcript) writeAtomic(join(dir, "transcript.vtt"), input.transcript);
    for (const a of input.assets ?? []) writeAtomic(join(dir, "assets", a.name), a.data);
    writeAtomic(docPath, stringifyFrontmatter(meta, body));
  });
  return { meta, body, dir, docPath };
}

export function readItemDir(dir: string): Item {
  const docPath = join(dir, "doc.md");
  const { data, body } = parseFrontmatter(readFileSync(docPath, "utf8"));
  const meta = ItemMetaSchema.parse(data);
  return { meta, body, dir, docPath };
}

/** Reads each file, leaving out one that won't parse (a hand edit, a sync conflict) instead of failing
 *  the whole list; `ore doctor` names it. */
export const readable = <T>(paths: string[], read: (p: string) => T): T[] =>
  paths.flatMap((p) => {
    try {
      return [read(p)];
    } catch {
      return [];
    }
  });

// The original kept at capture (source.pdf, source.epub, source.html, …), if any.
export function sourceFile(item: Item): string | undefined {
  const name = readdirSync(item.dir).find((f) => f.startsWith("source."));
  return name && join(item.dir, name);
}

export function itemDirs(lib: Library): string[] {
  const root = paths.items(lib);
  if (!existsSync(root)) return [];
  return subdirs(root)
    .flatMap((y) => subdirs(join(root, y)).filter((d) => existsSync(join(root, y, d, "doc.md"))).map((d) => join(root, y, d)))
    .sort();
}

// Accepts a full id or a unique prefix/suffix of one.
export function findItem(lib: Library, ref: string): Item {
  const key = ref.toUpperCase();
  const hits = itemDirs(lib).filter((d) => {
    const id = d.slice(-26);
    return id === key || id.startsWith(key) || id.endsWith(key);
  });
  if (hits.length > 1) throw new Error(`"${ref}" matches ${hits.length} items; use more of the id`);
  if (hits.length === 1) return readItemDir(hits[0]!);
  // A folder renamed in Finder no longer ends in its id, but its doc.md still names it.
  const renamed = readable(itemDirs(lib).filter((d) => !ID_END.test(d)), readItemDir).filter((i) => i.meta.id === key || i.meta.id.startsWith(key) || i.meta.id.endsWith(key));
  if (renamed.length === 1) return renamed[0]!;
  if (renamed.length > 1) throw new Error(`"${ref}" matches ${renamed.length} items; use more of the id`);
  throw new Error(`no item matches "${ref}"`);
}

/** A folder named as Ore names it: `<slug>-<26-letter id>`. */
export const ID_END = /-[0-9A-HJKMNP-TV-Z]{26}$/;

/** One item per id: a copy Finder or iCloud made ("… 2", "… copy") lists once, as the folder ending in
 *  the id; `ore doctor` names the copy. */
const oncePerId = (items: Item[]): Item[] => {
  const best = new Map<string, Item>();
  for (const i of items) {
    const had = best.get(i.meta.id);
    if (!had || (!had.dir.endsWith(i.meta.id) && i.dir.endsWith(i.meta.id))) best.set(i.meta.id, i);
  }
  return items.filter((i) => best.get(i.meta.id) === i);
};

/** Every item, without archived ones unless `archived` (then only archived ones). Feed posts being
 *  previewed are never listed, unless `preview` (then only those). */
export function listItems(lib: Library, opts: { archived?: boolean; preview?: boolean } = {}): Item[] {
  return oncePerId(readable(itemDirs(lib), readItemDir)).filter((i) => !!i.meta.preview === !!opts.preview && (opts.preview || !!i.meta.archived_at === !!opts.archived));
}

/** Live and archived sources in one read; with `preview`, the Feed's previews too. */
export function allItems(lib: Library, opts: { preview?: boolean } = {}): Item[] {
  return oncePerId(readable(itemDirs(lib), readItemDir)).filter((i) => opts.preview || !i.meta.preview);
}

// Read-modify-write of item frontmatter under the library lock. Body untouched.
export async function updateItemMeta(lib: Library, id: string, patch: (m: ItemMeta) => ItemMeta): Promise<ItemMeta> {
  return withLock(paths.lock(lib), () => {
    const item = findItem(lib, id);
    const next = ItemMetaSchema.parse(patch(item.meta));
    writeAtomic(item.docPath, stringifyFrontmatter(next, item.body));
    return next;
  });
}

export async function setItemStatus(lib: Library, id: string, status: ItemStatus): Promise<ItemMeta> {
  return updateItemMeta(lib, id, (m) => ({
    ...m,
    status,
    finished_at: status === "done" ? (m.status === "done" && m.finished_at ? m.finished_at : nowIso()) : undefined,
  }));
}

/** Opening a source starts it (inbox → reading) and stamps `opened_at`, which orders To read (D110).
 *  Opening it again within OPEN_STAMP_MS leaves the file alone, so flipping between sources doesn't rewrite them. */
export const OPEN_STAMP_MS = 10 * 60 * 1000;
export async function markOpened(lib: Library, id: string, now = new Date()): Promise<ItemMeta> {
  const m = findItem(lib, id).meta;
  if (m.status !== "inbox" && m.opened_at && now.getTime() - Date.parse(m.opened_at) < OPEN_STAMP_MS) return m;
  return updateItemMeta(lib, id, (x) => ({ ...x, status: x.status === "inbox" ? "reading" : x.status, opened_at: nowIso(now) }));
}

// Archive hides a source from lists and search; nothing is deleted (SPEC: core never deletes item
// folders) and its cards keep reviewing. `false` brings it back.
/** A previewed Feed post kept as a source: he highlighted or wrote in it. */
export async function keepPreview(lib: Library, id: string): Promise<boolean> {
  if (!findItem(lib, id).meta.preview) return false;
  await updateItemMeta(lib, id, (m) => ({ ...m, preview: undefined }));
  return true;
}

export async function setItemArchived(lib: Library, id: string, archived: boolean): Promise<ItemMeta> {
  return updateItemMeta(lib, id, (m) => ({ ...m, archived_at: archived ? (m.archived_at ?? nowIso()) : undefined }));
}

/** Pins a source to the top of every list it is in (Raycast's Pinned); `false` unpins it. Pinned
 *  sources list in `pinned_at` order, so `at` (a time between two others) moves it among them. */
export async function setItemPinned(lib: Library, id: string, pinned: boolean, at?: string): Promise<ItemMeta> {
  if (at !== undefined && (!pinned || Number.isNaN(Date.parse(at)) || new Date(Date.parse(at)).toISOString() !== at)) throw new Error(`pin: --at needs an ISO time like 2026-11-07T08:00:00.000Z, not "${at}"`);
  return updateItemMeta(lib, id, (m) => ({ ...m, pinned_at: pinned ? (at ?? m.pinned_at ?? nowIso()) : undefined }));
}

/** Renames a source; links store ids, so nothing that points at it breaks (D39). */
export async function renameItem(lib: Library, id: string, title: string): Promise<ItemMeta> {
  const t = oneLine(title);
  if (!t) throw new Error("a source needs a title");
  return updateItemMeta(lib, id, (m) => ({ ...m, title: t }));
}

/** Sets a source's author by hand (one line); empty clears it. */
export async function setItemAuthor(lib: Library, id: string, author: string): Promise<ItemMeta> {
  const a = oneLine(author) || undefined;
  return updateItemMeta(lib, id, (m) => ({ ...m, author: a }));
}

export const hasAttempts = (m: ItemMeta): boolean => (m.prequestions ?? []).some((p) => p.before !== undefined || p.after !== undefined);

/** Replaces prequestion `n` (1-based) of an item with what `f` returns. */
export async function updatePrequestion(lib: Library, ref: string, n: number, f: (p: Prequestion) => Prequestion) {
  const meta = await updateItemMeta(lib, ref, (m) => {
    const qs = m.prequestions ?? [];
    if (!qs.length) throw new Error(`item ${m.id} has no prequestions (ore enrich ${m.id})`);
    if (!Number.isInteger(n) || n < 1 || n > qs.length) throw new Error(`prequestion ${n} out of range (1-${qs.length})`);
    return { ...m, prequestions: qs.map((p, i) => (i === n - 1 ? f(p) : p)) };
  });
  return { item: meta.id, n, ...meta.prequestions![n - 1]! };
}

// Record one prequestion attempt (n is 1-based). Exactly one of before/after; a confidence only
// with after. A new after answer drops the check of the old one.
export async function setPrequestionAttempt(lib: Library, ref: string, n: number, attempt: { before?: string; after?: string; confidence?: number }) {
  const given = (["before", "after"] as const).filter((k) => attempt[k] !== undefined);
  if (given.length !== 1) throw new Error("give exactly one of --before or --after");
  const key = given[0]!;
  const text = attempt[key]!.trim();
  if (!text) throw new Error(`--${key} is empty (use "no idea" if you have no answer)`);
  const c = attempt.confidence;
  if (c !== undefined && (key !== "after" || !Number.isInteger(c) || c < 1 || c > 3)) throw new Error("--confidence is 1, 2 or 3 and goes with --after");
  return updatePrequestion(lib, ref, n, (p) => {
    if (key === "before") return { ...p, before: text };
    const { check: _old, confidence: _c, ...rest } = p;
    return { ...rest, after: text, ...(c !== undefined ? { confidence: c } : {}), ...(p.after === text && p.check ? { check: p.check } : {}) };
  });
}
