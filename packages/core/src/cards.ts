import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { parseFrontmatter, stringifyFrontmatter } from "./frontmatter.ts";
import { visible, writeAtomic } from "./fsutil.ts";
import { nowIso, ulid } from "./ids.ts";
import { AiStamp, Evidence, readable } from "./items.ts";
import { paths, type Library } from "./library.ts";
import { readReviews } from "./reviews.ts";

export const CardKind = z.enum(["card", "prompt"]);
export const ContentType = z.enum(["definition", "concept", "procedure", "fact"]);
export const CardState = z.enum(["draft", "live", "retired"]);
export type CardKind = z.infer<typeof CardKind>;
export type ContentType = z.infer<typeof ContentType>;
export type CardState = z.infer<typeof CardState>;

export const CardMetaSchema = z.object({
  id: z.string(),
  kind: CardKind,
  item: z.string(),
  annotation: z.string().optional(),
  // D118: the other highlights a card was planned from, when one idea spans several (the first is `annotation`).
  also: z.array(z.string()).optional(),
  from: z.enum(["notes", "prequestion", "tutor"]).optional(), // drafted from My notes (D19 credit), from a prequestion after the finish (D19), or kept from a tutor reply (D128)
  prequestion: z.number().int().positive().optional(), // with from: prequestion, its number (1-based)
  skills: z.array(z.string()).default([]),
  topics: z.array(z.string()).default([]),
  content_type: ContentType,
  state: CardState,
  created: z.string(),
  ai: AiStamp.optional(),
  // A card from a line he typed ("Card here"): the passages of the source that answer it, found in the text.
  evidence: z.array(Evidence).optional(),
  // D166: a card from a figure: the image as its source's doc.md names it, and the box hidden in review, as
  // fractions of the image's width and height (x, y, w, h), so it fits the figure at any size.
  figure: z.object({ src: z.string().min(1), box: z.tuple([z.number(), z.number(), z.number(), z.number()]) }).optional(),
});
export type CardMeta = z.infer<typeof CardMetaSchema>;

export interface CardContent {
  question: string;
  answer: string;
  rubric: string[];
}

export interface Card extends CardContent {
  meta: CardMeta;
  path: string;
}

// Body: question, a line `---`, answer; prompts add `## Rubric` with bullets.
export function parseCardBody(body: string): CardContent {
  const lines = body.split("\n");
  const sep = lines.findIndex((l) => l.trim() === "---");
  if (sep === -1) throw new Error("card body needs a `---` line between question and answer");
  const question = lines.slice(0, sep).join("\n").trim();
  const rest = lines.slice(sep + 1);
  const rub = rest.findIndex((l) => /^##\s+Rubric\s*$/i.test(l.trim()));
  const answer = (rub === -1 ? rest : rest.slice(0, rub)).join("\n").trim();
  const rubric = rub === -1 ? [] : rest.slice(rub + 1).filter((l) => /^\s*[-*]\s+/.test(l)).map((l) => l.replace(/^\s*[-*]\s+/, "").trim());
  if (!question) throw new Error("card question is empty");
  if (!answer) throw new Error("card answer is empty");
  return { question, answer, rubric };
}

/** Why this text would not read back as the same card, or null: a `---` line in the question ends it,
 *  and a `## Rubric` line in the answer starts the rubric. */
export function cardTextProblem(c: { question: string; answer: string }): string | null {
  if (c.question.split("\n").some((l) => l.trim() === "---")) return "A card’s question can’t have a line of just “---”: that line is where the answer starts. Use *** for a rule instead.";
  if (c.answer.split("\n").some((l) => /^##\s+Rubric\s*$/i.test(l.trim()))) return "A card’s answer can’t have a “## Rubric” line: that heading is where the rubric starts. Name the heading something else.";
  return null;
}

export function renderCardBody(c: CardContent): string {
  const problem = cardTextProblem(c);
  if (problem) throw new Error(problem);
  const rubric = c.rubric.length ? `\n## Rubric\n${c.rubric.map((b) => `- ${b}`).join("\n")}\n` : "";
  return `${c.question.trim()}\n---\n${c.answer.trim()}\n${rubric}`;
}

export function readCardFile(path: string): Card {
  const { data, body } = parseFrontmatter(readFileSync(path, "utf8"));
  const parsed = CardMetaSchema.safeParse(data);
  if (!parsed.success) throw new Error(`${path}: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
  return { meta: parsed.data, path, ...parseCardBody(body) };
}

export function cardFiles(lib: Library): string[] {
  const dir = paths.cards(lib);
  if (!existsSync(dir)) return [];
  return visible(dir).filter((f) => f.endsWith(".md")).sort().map((f) => join(dir, f));
}

/** Every card, once per id: a copy iCloud or Finder made ("<id> 2.md") is left out for the file named
 *  by the id; `ore doctor` names the copy. */
export function listCards(lib: Library): Card[] {
  const cards = readable(cardFiles(lib), readCardFile);
  const own = new Set(cards.filter((c) => c.path.endsWith(`${c.meta.id}.md`)).map((c) => c.meta.id));
  const seen = new Set<string>();
  return cards.filter((c) => {
    if (seen.has(c.meta.id) || (own.has(c.meta.id) && !c.path.endsWith(`${c.meta.id}.md`))) return false;
    seen.add(c.meta.id);
    return true;
  });
}

export function findCard(lib: Library, ref: string): Card {
  const key = ref.toUpperCase();
  const exact = paths.card(lib, key);
  if (existsSync(exact)) return readCardFile(exact);
  const hits = cardFiles(lib).filter((p) => {
    const id = p.slice(-29, -3);
    return id.startsWith(key) || id.endsWith(key);
  });
  if (hits.length === 0) throw new Error(`no card matches "${ref}"`);
  if (hits.length > 1) throw new Error(`"${ref}" matches ${hits.length} cards; use more of the id`);
  return readCardFile(hits[0]!);
}

export interface NewCard extends CardContent {
  kind: CardKind;
  item: string;
  annotation?: string;
  also?: string[];
  from?: "notes" | "prequestion" | "tutor";
  prequestion?: number;
  skills: string[];
  topics: string[];
  content_type: ContentType;
  ai?: AiStamp;
  evidence?: Evidence[];
  figure?: CardMeta["figure"];
}

// Caller holds the library lock when writing several files together.
export function writeNewCard(lib: Library, c: NewCard): Card {
  const meta: CardMeta = {
    id: ulid(),
    kind: c.kind,
    item: c.item,
    annotation: c.annotation,
    also: c.also?.length ? c.also : undefined,
    from: c.from,
    prequestion: c.prequestion,
    skills: c.skills,
    topics: c.topics,
    content_type: c.content_type,
    state: "draft",
    created: nowIso(),
    ai: c.ai,
    evidence: c.evidence?.length ? c.evidence : undefined,
    figure: c.figure,
  };
  const path = paths.card(lib, meta.id);
  const content = { question: c.question, answer: c.answer, rubric: c.rubric };
  writeAtomic(path, stringifyFrontmatter(meta, renderCardBody(content)));
  return { meta, path, ...content };
}

// Rewrites only the frontmatter; the body is kept byte-exact.
export function writeCardMeta(card: Card, meta: CardMeta): void {
  const { body } = parseFrontmatter(readFileSync(card.path, "utf8"));
  writeAtomic(card.path, stringifyFrontmatter(CardMetaSchema.parse(meta), body));
}

/** Why these key points can't be an Explain card's rubric (D59: the grader marks one per point), or null.
 *  Each is one line of the card's "## Rubric" list; a Fact card has none. */
export function rubricProblem(kind: Card["meta"]["kind"], rubric: string[]): string | null {
  if (kind === "card") return rubric.length ? "A Fact card has no key points." : null;
  if (!rubric.length) return "An Explain card needs at least one key point: they are what its answer is marked against.";
  if (rubric.some((p) => !p.trim())) return "A key point can’t be empty.";
  if (rubric.some((p) => /[\r\n]/.test(p.trim()))) return "Each key point is one line.";
  return null;
}

// Edit a card's question, answer or key points in place (D59: a new draft is finished in review);
// what isn't given and the frontmatter are kept. The caller holds the library lock.
export function writeCardContent(card: Card, edit: { question?: string; answer?: string; rubric?: string[] }): Card {
  const rubric = edit.rubric?.map((p) => p.trim()) ?? card.rubric;
  if (edit.rubric) {
    const problem = rubricProblem(card.meta.kind, edit.rubric);
    if (problem) throw new Error(problem);
  }
  const content = { question: edit.question?.trim() || card.question, answer: edit.answer?.trim() || card.answer, rubric };
  writeAtomic(card.path, stringifyFrontmatter(card.meta, renderCardBody(content)));
  return readCardFile(card.path);
}

/** Each card's state as review sees it: a draft is live once it has a review (its finishing step, D20),
 *  which lives in the review log rather than the card file. Reads the log once for many cards. */
export function cardStates(lib: Library): (c: Card) => CardState {
  const reviewed = new Set(readReviews(lib).map((r) => r.card));
  return (c) => (c.meta.state === "draft" && reviewed.has(c.meta.id) ? "live" : c.meta.state);
}
