// A highlight's edges snap to whole words, as Kindle and Apple Books do: nobody means half a word, and a
// key point or card quoted from it should read cleanly. A start inside a word goes back to where the word
// begins; an end inside a word goes on to where it ends, taking the sentence's closing punctuation (and a
// closing quote or bracket with it) when the word ends a sentence. An edge already between words stays
// where he put it, so a selection that starts on an opening quote keeps it. Words are the system's own
// (Intl.Segmenter), so Japanese or Chinese, which have no spaces, snap to the words it finds; code and
// math snap to nothing. ⌥ while selecting or dragging turns snapping off (the callers check it).

export type Side = "start" | "end";

const words = new Intl.Segmenter(undefined, { granularity: "word" });
/** Sentence ends, and what may close around them: `thing.` `thing."` `thing”.` `(thing).` */
const CLOSERS = /^[.!?…"'”’»)\]}]+/u;
const ENDS = /[.!?…]/u;

/** The snapped offset of an edge at `offset` in `text`. */
export function snapText(text: string, offset: number, side: Side): number {
  let o = offset;
  for (const s of words.segment(text)) {
    const a = s.index;
    const z = a + s.segment.length;
    if (z < o || a > o) continue;
    if (!s.isWordLike) continue;
    // The word around the edge, or the one it touches: a start just inside its first letter, an end just past its last.
    if (side === "start" && a < o && o < z) o = a;
    if (side === "end" && a < o && o <= z) o = z;
    if (o === a || o === z) break;
  }
  if (side === "end" && o > 0 && /[\p{L}\p{N}\p{M}]/u.test(text[o - 1]!)) {
    const run = CLOSERS.exec(text.slice(o))?.[0];
    if (run && ENDS.test(run)) o += run.length;
  }
  // Never the space beside it: a start in a run of spaces goes on to the next word, an end back to the last.
  if (side === "start") while (o < text.length && /\s/.test(text[o]!)) o++;
  else while (o > 0 && /\s/.test(text[o - 1]!)) o--;
  return o;
}

const BLOCK = "p, li, h1, h2, h3, h4, h5, h6, pre, blockquote, td, th, figcaption, dt, dd, div, article";
const RAW = "code, pre, .katex";
/** Text that isn't the passage (a transcript's timestamps): it counts as a space between words. */
const SKIP = "[data-noindex], .ts";

/** The text of the block around `node`, and where each of its text nodes starts in it. */
function blockText(node: Text): { text: string; at: Map<Text, number> } {
  const block = node.parentElement?.closest(BLOCK) ?? node.parentElement!;
  const at = new Map<Text, number>();
  let text = "";
  const walk = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode() as Text | null; n; n = walk.nextNode() as Text | null) {
    if (n.parentElement?.closest(SKIP)) {
      text += " ".repeat(n.data.length);
      continue;
    }
    at.set(n, text.length);
    text += n.data;
  }
  return { text, at };
}

/** The text node and offset at `o` in a block's text, on the side the edge leans to. */
function pointAt(at: Map<Text, number>, o: number, side: Side): [Text, number] | null {
  let best: [Text, number] | null = null;
  for (const [n, a] of at) {
    const z = a + n.data.length;
    if (o < a || o > z) continue;
    // At a seam between two nodes, a start belongs to the next one and an end to the one before.
    if (side === "end") return [n, o - a];
    best = [n, o - a];
  }
  return best;
}

/** One edge, snapped: also a highlight's edge as it is dragged (D117). */
export function snapEdge(node: Node, offset: number, side: Side): [Node, number] {
  if (node.nodeType !== Node.TEXT_NODE || node.parentElement?.closest(RAW)) return [node, offset];
  const { text, at } = blockText(node as Text);
  const from = at.get(node as Text);
  if (from === undefined) return [node, offset];
  return pointAt(at, snapText(text, from + offset, side), side) ?? [node, offset];
}

/** A selection snapped to whole words; unchanged where snapping would leave nothing. */
export function snapRange(r: Range): Range {
  const out = r.cloneRange();
  const [sn, so] = snapEdge(r.startContainer, r.startOffset, "start");
  const [en, eo] = snapEdge(r.endContainer, r.endOffset, "end");
  out.setStart(sn, so);
  out.setEnd(en, eo);
  return out.collapsed || !out.toString().trim() ? r.cloneRange() : out;
}


const sentences = new Intl.Segmenter(undefined, { granularity: "sentence" });
/** A break the system puts after an abbreviation goes on (it already does before a lowercase word or a
 *  number): an initial or a run of them (J. R., U.S.), or a title, a reference or a month before a name
 *  or a number. "etc." is left out, as it often ends a sentence. */
const ABBREV = /(?:^|[\s(\[“"'])(?:\p{Lu}|(?:\p{L}\.)+\p{L}|Mr|Mrs|Ms|Mx|Dr|Prof|Sr|Jr|St|Mt|Gen|Gov|Col|Capt|Lt|Sgt|Rev|Hon|Pres|Sen|Rep|No|Nos|Vol|Fig|Figs|Eq|Ch|Sec|pp?|vs|al|Inc|Ltd|Co|Corp|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.\s*$/u;

/** The span of `text` from `a` to `z` with the spaces at either end left out, as a range; null if nothing is left. */
function trimmed(at: Map<Text, number>, text: string, a: number, z: number): Range | null {
  while (a < z && /\s/.test(text[a]!)) a++;
  while (z > a && /\s/.test(text[z - 1]!)) z--;
  const start = pointAt(at, a, "start");
  const end = pointAt(at, z, "end");
  if (a >= z || !start || !end) return null;
  const r = document.createRange();
  r.setStart(...start);
  r.setEnd(...end);
  return r;
}

/** A double click's word grown to its sentence (D224), by the system's own sentence breaks; code and
 *  math, which have no sentences, keep the word. */
export function sentenceRange(word: Range): Range {
  let node: Node | null = word.startContainer;
  let offset = word.startOffset;
  // A start between elements (just after a link, in WebKit): the text that follows it.
  if (node.nodeType !== Node.TEXT_NODE) {
    const after: Node | null = node.childNodes[offset] ?? null;
    node = after && (after.nodeType === Node.TEXT_NODE ? after : document.createTreeWalker(after, NodeFilter.SHOW_TEXT).nextNode());
    offset = 0;
  }
  if (!node || node.nodeType !== Node.TEXT_NODE || node.parentElement?.closest(RAW)) return snapRange(word);
  const { text, at } = blockText(node as Text);
  const from = at.get(node as Text);
  if (from === undefined) return snapRange(word);
  const o = from + offset;
  let a = 0;
  for (const s of sentences.segment(text)) {
    const z = s.index + s.segment.length;
    if (ABBREV.test(s.segment) && z < text.length) continue; // "Dr. | Smith": one sentence
    if (o < z) return trimmed(at, text, a, z) ?? snapRange(word);
    a = z;
  }
  return snapRange(word);
}

/** Blocks a double tap highlights whole (D224): a heading is a label, not a passage, and a page's
 *  outer box would be all of it. */
const PARAGRAPH = "p, li, td, th, figcaption, dt, dd, pre, blockquote";

/** The paragraph around `node` (the innermost one, so a list item's own line without the list nested in
 *  it, a table's cell), or null. */
export function paragraphRange(node: Node): Range | null {
  const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
  const block = el?.closest(BLOCK);
  if (!block?.matches(PARAGRAPH)) return null;
  const first = document.createTreeWalker(block, NodeFilter.SHOW_TEXT).nextNode() as Text | null;
  if (!first) return null;
  const { text, at } = blockText(first);
  // Its own text runs up to the first block nested in it.
  let z = text.length;
  for (const [n, a] of at)
    if (n.parentElement?.closest(BLOCK) !== block) {
      z = Math.min(z, a);
      break;
    }
  return trimmed(at, text, 0, z);
}
