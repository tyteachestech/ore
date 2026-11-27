// DOM half of highlight mapping. Markdown interpretation lives in core for every caller.
import { MATH, plainSkeleton, skipped, sourceSkeleton, type Skeleton } from "../../../packages/core/src/text-map";
export { passageText, plainSkeleton, sourceSkeleton, type Skeleton } from "../../../packages/core/src/text-map";

/** A rendered formula: KaTeX's drawing, or its error showing the TeX it could not draw. */
const MATH_EL = ".katex, .katex-error";

/** Skeleton of the rendered DOM text, with each char's text node and offset. A formula is one MATH
 *  character at its first text node; `math` gives each formula's place. */
export type TextIndex = { chars: string; nodes: Text[]; node: Int32Array; off: Int32Array; first: Map<Text, number>; math: Map<Element, number> };

const mathOf = (n: Node | null): Element | null => (n ? (n.nodeType === 1 ? (n as Element) : n.parentElement)?.closest(MATH_EL) ?? null : null);

export function indexText(root: HTMLElement): TextIndex {
  const nodes: Text[] = [];
  const parts: string[] = [];
  const nodeOf: number[] = [];
  const offOf: number[] = [];
  const first = new Map<Text, number>();
  const math = new Map<Element, number>();
  // A video card's bar and player (D92) sit in the text but are not part of it.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest("[data-noindex]") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    // Rendered math is drawn glyphs, not the TeX in the body: one MATH for the formula, at its first text.
    const f = mathOf(n);
    if (f) {
      if (math.has(f)) continue;
      math.set(f, parts.length);
      first.set(n, parts.length);
      nodeOf.push(nodes.push(n) - 1);
      offOf.push(0);
      parts.push(MATH);
      continue;
    }
    const k = nodes.push(n) - 1;
    first.set(n, parts.length);
    const s = n.data;
    const code = !!n.parentElement?.closest("code");
    for (let i = 0; i < s.length; i++) {
      if (skipped(s[i]!, code)) continue;
      parts.push(s[i]!);
      nodeOf.push(k);
      offOf.push(i);
    }
  }
  return { chars: parts.join(""), nodes, node: Int32Array.from(nodeOf), off: Int32Array.from(offOf), first, math };
}

function occurrences(hay: string, needle: string): number[] {
  const out: number[] = [];
  for (let p = hay.indexOf(needle); p >= 0; p = hay.indexOf(needle, p + 1)) out.push(p);
  return out;
}

/** Where `needle` sits in `hay`: matched with its surrounding context first (repeated words are
 *  common in a book), then alone; several hits go to the one nearest `hint`. */
function find(hay: string, pre: string, needle: string, suf: string, hint: number): number | null {
  const nearest = (hits: number[]) => hits.reduce((a, b) => (Math.abs(b - hint) < Math.abs(a - hint) ? b : a));
  for (const k of [24, 8]) {
    const p = pre.slice(-k);
    const s = suf.slice(0, k);
    if (!p && !s) break;
    const hits = occurrences(hay, p + needle + s);
    if (hits.length) return nearest(hits) + p.length;
  }
  const hits = occurrences(hay, needle);
  return hits.length ? nearest(hits) : null;
}

/** Skeleton offset of a DOM point inside the indexed root. A point inside a formula is before it, or
 *  after it as a selection's `end`: a selection touching a formula takes all of it. */
export function skeletonOffset(idx: TextIndex, node: Node, offset: number, end = false): number {
  const f = idx.math.get(mathOf(node)!);
  if (f !== undefined) return end ? f + 1 : f;
  const base = node.nodeType === Node.TEXT_NODE ? idx.first.get(node as Text) : undefined;
  if (base !== undefined) {
    const code = !!node.parentElement?.closest("code");
    // DOM offsets and the map count UTF-16 units. Counting code points shifted everything
    // after an emoji; use the shared normalization and measure its string in the same units.
    return base + plainSkeleton((node as Text).data.slice(0, offset), code).length;
  }
  // Between elements, or in text left out of the index: the first indexed text after the point.
  const at = document.createRange();
  at.setStart(node, offset);
  let lo = 0;
  let hi = idx.nodes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (at.comparePoint(idx.nodes[mid]!, 0) < 0) lo = mid + 1;
    else hi = mid;
  }
  return lo < idx.nodes.length ? idx.first.get(idx.nodes[lo]!)! : idx.chars.length;
}

/** The skeleton index of the first source character at or after body offset `at`. */
function sourceIndex(src: Skeleton, at: number): number {
  let lo = 0;
  let hi = src.map.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (src.map[mid]! < at) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Roughly where in the body a rendered selection starts, for when it can't be quoted exactly: the core
 *  then saves the match nearest it, not the first in the source. */
export function sourceHint(src: Skeleton, idx: TextIndex, sel: Range): number {
  const at = skeletonOffset(idx, sel.startContainer, sel.startOffset);
  const i = Math.round((at / Math.max(1, idx.chars.length)) * src.chars.length);
  return src.map[Math.min(i, src.map.length - 1)] ?? 0;
}

/** The exact source text and offset for a rendered selection, or null when it cannot be mapped. The
 *  needle is the index's own text between the selection's ends, so it skips what the index skips (math). */
export function sourceQuote(src: Skeleton, body: string, idx: TextIndex, sel: Range): { exact: string; start: number } | null {
  const at = skeletonOffset(idx, sel.startContainer, sel.startOffset);
  const to = skeletonOffset(idx, sel.endContainer, sel.endOffset, true);
  const needle = idx.chars.slice(at, to);
  if (!needle) return null;
  const pre = idx.chars.slice(Math.max(0, at - 24), at);
  const suf = idx.chars.slice(to, to + 24);
  const hint = (at / Math.max(1, idx.chars.length)) * src.chars.length;
  const h = find(src.chars, pre, needle, suf, hint);
  if (h === null) return null;
  const start = src.map[h]!;
  let end = src.map[h + needle.length - 1]! + 1;
  // A character reference ("&amp;") is one character on the page, as a formula is: the quote takes all of it.
  end += (src.refs.get(end - 1) ?? 1) - 1;
  return { exact: body.slice(start, end), start };
}

type Quote = { exact: string; prefix: string; suffix: string; start: number };

/** A DOM range for a stored annotation, located by its quote (context first, then position). A quote
 *  still at its offset is cut from the body's own skeleton, since a piece of code read alone (a
 *  `# comment` line out of its fence) would read as Markdown. */
/** Where a quote that is no longer at its offset now is in the body: the place whose context matches best,
 *  then the nearest. -1 when its words are gone. */
function movedTo(body: string, q: Quote): number {
  let best = -1;
  let score = -1;
  for (let i = body.indexOf(q.exact); i >= 0; i = body.indexOf(q.exact, i + 1)) {
    const s = (q.prefix && body.endsWith(q.prefix, i) ? 2 : 0) + (q.suffix && body.startsWith(q.suffix, i + q.exact.length) ? 2 : 0);
    if (s > score || (s === score && Math.abs(i - q.start) < Math.abs(best - q.start))) [best, score] = [i, s];
  }
  return best;
}

export function rangeFor(idx: TextIndex, src: Skeleton, body: string, q: Quote): Range | null {
  let needle: string;
  let pre: string;
  let suf: string;
  // A quote that moved (text changed before it) is mapped where it now is, as one still in place: code stays code.
  let start = !q.exact ? -1 : body.startsWith(q.exact, q.start) ? q.start : movedTo(body, q);
  // Words found again only where nothing shows (a link's address) are looked for as they read instead.
  if (start >= 0 && start !== q.start && sourceIndex(src, start) === sourceIndex(src, start + q.exact.length)) start = -1;
  if (start >= 0) {
    let a = sourceIndex(src, start);
    // A quote starting inside a formula's TeX (saved before formulas were whole) is on that formula.
    if (a > 0 && src.chars[a - 1] === MATH && src.map[a - 1]! + src.refs.get(src.map[a - 1]!)! > start) a--;
    const b = sourceIndex(src, start + q.exact.length);
    needle = src.chars.slice(a, b);
    pre = src.chars.slice(Math.max(0, a - 24), a);
    suf = src.chars.slice(b, b + 24);
  } else {
    needle = sourceSkeleton(q.exact).chars;
    pre = sourceSkeleton(q.prefix).chars;
    suf = sourceSkeleton(q.suffix).chars;
  }
  if (!needle) return null;
  const hint = ((start >= 0 ? start : q.start) / Math.max(1, body.length)) * idx.chars.length;
  const h = find(idx.chars, pre, needle, suf, hint);
  if (h === null) return null;
  const last = h + needle.length - 1;
  const range = document.createRange();
  range.setStart(idx.nodes[idx.node[h]!]!, idx.off[h]!);
  range.setEnd(idx.nodes[idx.node[last]!]!, idx.off[last]! + 1);
  if (idx.chars[h] === MATH) range.setStartBefore(mathOf(idx.nodes[idx.node[h]!]!)!);
  if (idx.chars[last] === MATH) range.setEndAfter(mathOf(idx.nodes[idx.node[last]!]!)!);
  return range;
}

/** A selection with each end that lies in a formula moved to take the whole formula, as it is saved. */
export function wholeMath(sel: Range): Range {
  const a = mathOf(sel.startContainer);
  const b = mathOf(sel.endContainer);
  if (!a && !b) return sel;
  const r = sel.cloneRange();
  if (a) r.setStartBefore(a);
  if (b) r.setEndAfter(b);
  return r;
}

/** The rendered text node holding the first character at or after source offset `at` (e.g. just
 *  past a `<!-- chapter N -->` marker, which never renders), or null when it cannot be mapped. */
export function renderedNodeAt(src: Skeleton, idx: TextIndex, at: number): Text | null {
  const lo = sourceIndex(src, at);
  if (lo >= src.chars.length) return null;
  const hint = (lo / Math.max(1, src.chars.length)) * idx.chars.length;
  const pre = src.chars.slice(Math.max(0, lo - 24), lo);
  for (const k of [32, 12]) {
    const h = find(idx.chars, pre, src.chars.slice(lo, lo + k), "", hint);
    if (h !== null) return idx.nodes[idx.node[h]!]!;
  }
  return null;
}

/** Of highlights that overlap, the innermost (the shortest): the one his click or selection means,
 *  whatever order they were made or brought back in. */
function innermost(hits: [string, Range][]): [string, Range] | undefined {
  let best: [string, Range] | undefined;
  let len = Infinity;
  for (const h of hits) {
    const n = h[1].toString().length;
    if (n < len) [best, len] = [h, n];
  }
  return best;
}

/** Which stored range is under the point, if any; the innermost where they overlap. */
export function hitTest(ranges: Map<string, Range>, x: number, y: number): string | null {
  const caret = document.caretRangeFromPoint(x, y);
  if (!caret) return null;
  const hits: [string, Range][] = [];
  for (const [id, r] of ranges) {
    try {
      if (r.comparePoint(caret.startContainer, caret.startOffset) !== 0) continue;
    } catch {
      continue;
    }
    for (const b of r.getClientRects()) {
      if (x >= b.left - 1 && x <= b.right + 1 && y >= b.top - 1 && y <= b.bottom + 1) {
        hits.push([id, r]);
        break;
      }
    }
  }
  return innermost(hits)?.[0] ?? null;
}

/** The stored range holding all of `r`, the innermost where several do. */
export const holderOf = (ranges: Map<string, Range>, r: Range): [string, Range] | undefined =>
  innermost([...ranges].filter(([, h]) => h.compareBoundaryPoints(Range.START_TO_START, r) <= 0 && h.compareBoundaryPoints(Range.END_TO_END, r) >= 0));

/** Splits a long Markdown body at blank lines (outside code fences) so a book renders in slices. */
export function chunks(md: string, size = 12000): string[] {
  const out: string[] = [];
  let cur: string[] = [];
  let len = 0;
  let fence = false;
  for (const line of md.split("\n")) {
    if (/^[ \t]*(?:```|~~~)/.test(line)) fence = !fence;
    cur.push(line);
    len += line.length + 1;
    if (!fence && len >= size && line.trim() === "") {
      out.push(cur.join("\n"));
      cur = [];
      len = 0;
    }
  }
  if (cur.length) out.push(cur.join("\n"));
  return out;
}

/** A PDF's body in slices that each start a page (`<!-- page N -->`, core's `pdf.ts`), so the reader can
 *  tell which page of the original is being read (D202). A long page is still cut by `chunks`. */
export function pageChunks(md: string): string[] {
  const out: string[] = [];
  let cur: string[] = [];
  const flush = () => {
    if (cur.join("").trim()) out.push(...chunks(cur.join("\n")));
    cur = [];
  };
  let fence = false;
  for (const line of md.split("\n")) {
    if (/^[ \t]*(?:```|~~~)/.test(line)) fence = !fence;
    if (!fence && PAGE.test(line)) flush();
    cur.push(line);
  }
  flush();
  return out;
}
/** A PDF's page mark, or a deck's slide mark (core's `office.ts`): each is where the original's next page starts. */
const PAGE = /^<!-- (?:page|slide) (\d+) -->$/;
/** The page a slice of `pageChunks` starts, if it starts one. */
export const pageOf = (chunk: string): number | null => Number(PAGE.exec(chunk.slice(0, chunk.indexOf("\n") >>> 0))?.[1]) || null;

/** Footnotes (`[^7]` and `[^7]: …`) as links that keep their text, so they work in any slice of a
 *  long body: GFM footnotes only resolve within one parse, and the body renders in slices (`chunks`),
 *  so a marker would show as "[^7]" and its note would vanish. A marker links to `#fn-7`, its note's
 *  label to `#fnref-7`; both keep "^7", so the text index still matches the source. */
export function footnotes(md: string): string {
  if (!md.includes("[^")) return md;
  let fence = false;
  let inNote = false;
  return md
    .split("\n")
    .map((line) => {
      if (/^[ \t]*(?:```|~~~)/.test(line)) fence = !fence;
      if (fence) return line;
      const def = line.match(/^ {0,3}\[\^([^\]\s]+)\]:/);
      if (def) {
        inNote = true;
        return `[^${def[1]}](#fnref-${encodeURIComponent(def[1]!)})${line.slice(def[0].length)}`.replace(/\[\^([^\]\s]+)\](?![(:])/g, (_, l) => `[^${l}](#fn-${encodeURIComponent(l)})`);
      }
      // A note's later paragraphs are indented under it: outdented, so they read as text, not code.
      if (inNote && /^(?: {4}|\t)/.test(line)) line = line.replace(/^(?: {4}|\t)/, "");
      else if (line.trim()) inNote = false;
      return line.replace(/\[\^([^\]\s]+)\](?![(:])/g, (_, l) => `[^${l}](#fn-${encodeURIComponent(l)})`);
    })
    .join("\n");
}
