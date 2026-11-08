import { z } from "zod";
import { locate } from "../anchoring.ts";
import { openIndex } from "../db.ts";
import { findItem } from "../items.ts";
import type { Library } from "../library.ts";
import { runAgent, type Usage } from "./adapter.ts";

// Ask your library: a question answered from across his sources, every claim cited to the passage it
// came from. Retrieval is the FTS5 index (no embeddings): the sources that hold any of the question's
// words, cut into passages, ranked by how many of its rarer words each passage holds.

const STOP = new Set("a an and are as at be been but by can could did do does for from had has have how i if in into is it its me my of on or our so than that the their them then there these they this those to was we were what when where which who whom why will with would you your about tell explain say said says".split(" "));

/** The words worth searching for, cut to a stem so "spacing" finds "spaced" and "space". */
export function queryTerms(text: string): string[] {
  const words = (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((w) => w.length > 1 && !STOP.has(w));
  return [...new Set(words.map(stem))];
}
const stem = (w: string) => w.replace(/(?<=\p{L}{3})(ing|ed|es|ly|s)$/u, "");

export interface Passage { id: string; item: string; title: string; heading: string; text: string; start: number; end: number }

const LIST = /^\s*(?:[-*+]|\d+[.)])\s/;

/** A source's body cut into passages: paragraphs (short ones, and a list with its lead-in, joined to the one before under the
 *  same heading), each with its heading and its place in doc.md. Page markers and bare images are left out. */
export function splitPassages(body: string): Omit<Passage, "id" | "item" | "title">[] {
  const out: Omit<Passage, "id" | "item" | "title">[] = [];
  let heading = "";
  for (const m of body.matchAll(/(?:[^\n]*\S[^\n]*(?:\n|$))+/g)) {
    const t = m[0].trim();
    const start = m.index + m[0].indexOf(t);
    const end = start + t.length;
    if (/^#{1,6}\s/.test(t) && !t.includes("\n")) { heading = t.replace(/^#+\s*/, "").replace(/\\/g, ""); continue; }
    if (/^<!--[^]*-->$/.test(t) || /^!\[[^\]]*\]\([^)]*\)$/.test(t)) continue;
    const last = out[out.length - 1];
    const words = last ? last.text.split(/\s+/).length : 0;
    // A list item stays with the list and the line leading into it, up to a long passage.
    const list = LIST.test(t) && !!last && (/:\s*$/.test(last.text) || LIST.test(last.text.slice(last.text.lastIndexOf("\n") + 1))) && words < 250;
    if (last && last.heading === heading && (words < 40 || list)) {
      last.text = body.slice(last.start, end);
      last.end = end;
    } else out.push({ heading, text: t, start, end });
  }
  return out;
}

/** The passages most likely to answer the question: up to `max` in all, at most five per source.
 *  `only` searches that one source (no cap per source) or those sources instead of the whole library
 *  (the tutor's "this source", or the sources he @-mentioned). */
export function retrieve(lib: Library, question: string, max = 10, only?: string | string[]): Passage[] {
  const terms = queryTerms(question);
  if (!terms.length) return [];
  let ids: string[] = only === undefined ? [] : [only].flat();
  if (only === undefined) {
    const index = openIndex(lib);
    try {
      ids = index.sourcesMatching(terms, 6);
    } finally {
      index.close();
    }
  }
  // Link targets and footnote marks aren't words he reads; the title and heading count half.
  const words = (s: string) => new Set(s.replace(/\]\([^)]*\)|\[\^\d+\]/g, " ").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
  const cands: (Passage & { body: Set<string>; around: Set<string>; note: boolean })[] = [];
  for (const id of ids) {
    let item;
    try { item = findItem(lib, id); } catch { continue; } // gone since the index was built
    for (const p of splitPassages(item.body))
      cands.push({ ...p, id: "", item: item.meta.id, title: item.meta.title, body: words(p.text), around: words(`${item.meta.title} ${p.heading}`), note: p.text.startsWith("[^") });
  }
  const has = (ws: Set<string>, t: string) => [...ws].some((w) => w.startsWith(t));
  const idf = new Map(terms.map((t) => [t, Math.log(1 + cands.length / (1 + cands.filter((c) => has(c.body, t)).length))]));
  const scored = cands
    // A footnote (often a reference list entry) counts half.
    .map((c) => ({ c, score: (c.note ? 0.5 : 1) * terms.reduce((s, t) => s + idf.get(t)! * (has(c.body, t) ? 1 : has(c.around, t) ? 0.5 : 0), 0) }))
    .filter((x) => x.score > 0 && terms.some((t) => has(x.c.body, t)))
    .sort((a, b) => b.score - a.score);
  const per = new Map<string, number>();
  const out: Passage[] = [];
  for (const { c } of scored) {
    if (out.length >= max) break;
    if (typeof only !== "string" && (per.get(c.item) ?? 0) >= 5) continue;
    per.set(c.item, (per.get(c.item) ?? 0) + 1);
    const { body: _, around: __, note: ___, ...p } = c;
    out.push({ ...p, id: `P${out.length + 1}` });
  }
  return out;
}

export const AskLibraryOutput = z.strictObject({
  found: z.boolean(),
  answer: z.string().min(1),
  citations: z.array(z.strictObject({ passage: z.string(), quote: z.string().min(1) })),
});

/** `quote` is the exact Markdown at start..end (for the jump); `text` is how it reads. */
export interface Citation { n: number; item: string; title: string; heading: string; quote: string; text: string; start: number; end: number }
/** A web page the tutor's search found, cited like a passage: `quote` is words the search returned from it. */
export interface WebCitation { n: number; url: string; title: string; site: string; quote: string; text: string }

/** Markdown as it reads: a link's text without its URL, no emphasis or code marks, no footnote marks. */
export const plainText = (md: string) =>
  md.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\[\^\d+\]/g, "").replace(/(\*\*|__|\*|`)/g, "").replace(/\s+/g, " ").trim();
export interface AskTurn { question: string; answer: string }

export const NOT_FOUND = "Nothing in your library mentions that.";

/** One question to the whole library. `earlier` is the conversation so far, for follow-ups. Each
 *  citation's quote is placed in its source's doc.md (start, end), so the reader can jump to it. */
export async function askLibrary(lib: Library, question: string, earlier: AskTurn[] = []) {
  const q = question.trim();
  if (!q) throw new Error("question is empty");
  const recent = earlier.slice(-3);
  const passages = retrieve(lib, [...recent.map((t) => t.question), q].join(" "));
  if (!passages.length) return { question: q, found: false, answer: NOT_FOUND, citations: [] as Citation[], ai: null, usage: null as Usage | null };
  const byId = new Map(passages.map((p) => [p.id, p]));
  const { data, ai, usage } = await runAgent(lib, {
    prompt: "ask-library",
    cwd: lib.root,
    schema: AskLibraryOutput,
    input: { question: q, earlier: recent, passages: passages.map(({ id, title, heading, text }) => ({ id, source: title, heading, text })) },
    check: (d) => {
      if (!d.found) return d.citations.length ? "citations must be empty when found is false" : null;
      if (!d.citations.length) return "an answer needs at least one citation";
      for (const c of d.citations) {
        const p = byId.get(c.passage);
        if (!p) return `no passage ${c.passage}; cite one of ${passages.map((x) => x.id).join(", ")}`;
        if (!locate(p.text, c.quote)) return `the quote "${c.quote}" is not in ${c.passage}: copy its exact words`;
      }
      const top = Math.max(0, ...[...d.answer.matchAll(/\[(\d+)\]/g)].map((m) => +m[1]!));
      return top > d.citations.length ? `marker [${top}] has no citation` : null;
    },
  });
  const citations: Citation[] = data.found
    ? data.citations.map((c, i) => {
        const p = byId.get(c.passage)!;
        const at = locate(p.text, c.quote)!;
        const quote = p.text.slice(at.start, at.end);
        return { n: i + 1, item: p.item, title: p.title, heading: p.heading, quote, text: plainText(quote), start: p.start + at.start, end: p.start + at.end };
      })
    : [];
  return { question: q, found: data.found, answer: data.answer, citations, ai, usage };
}
