// Mapping between the rendered reader text and the Markdown source, for highlights.
// Both sides are reduced to a "skeleton": the characters that render as text, minus whitespace
// and the punctuation Markdown uses for emphasis, code, links and tables. A selection is matched
// in the source skeleton to recover the exact source text (so `ore highlight` gets an exact
// match), and a stored annotation's `exact` is matched in the rendered skeleton to paint it.

import { decodeNamedCharacterReference } from "decode-named-character-reference";

const IGNORED = new Set([..." \t\n\r\f\v   *_`[]|~"]);

/** `refs`: where a character reference (`&amp;`) starts in the source, and how long it is there. */
export type Skeleton = { chars: string; map: number[]; refs: Map<number, number> };

// A link's destination and optional title (CommonMark): balanced or escaped parens, `<…>`, or a quoted
// title, as Wikipedia writes them (`…/Memory_\(psychology\) "Memory (psychology)"`).
const DEST = String.raw`(?:<[^<>\n]*>|(?:[^\s()\\]|\\.|\((?:[^\s()\\]|\\.)*\))*)`;
const TITLE = String.raw`(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\((?:[^()\\]|\\.)*\))`;
const TAIL = String.raw`\(\s*${DEST}(?:\s+${TITLE})?\s*\)`;
const LABEL = String.raw`(?:[^\[\]\\\n]|\\.)*`;
const label = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const IMAGE = new RegExp(String.raw`!\[[^\]\n]*\]${TAIL}`, "g");
const LINK_TAIL = new RegExp(String.raw`\]${TAIL}`, "g");
const DEFINITION = new RegExp(String.raw`^ {0,3}\[(${LABEL})\]:[ \t]*(?:<[^<>\n]*>|\S+)(?:[ \t]+${TITLE})?[ \t]*$`, "gm");
const FULL_REF = new RegExp(String.raw`\[(${LABEL})\]\[(${LABEL})\]`, "g");
const FOOTNOTE_REF = /\[\^[^\]\s]+\]/g;
const WORD = /[\p{L}\p{N}]/u;
const SPACE = /\s/;

/** Which characters are code (a fenced block's lines, a code span's text), where Markdown syntax does
 *  not apply: the reader shows each one as written. 1 marks code, 2 a fence line (never shown). */
function codeOf(md: string): Uint8Array {
  const code = new Uint8Array(md.length);
  let open: { ch: string; len: number; quotes: number } | null = null;
  let at = 0;
  for (const line of md.split("\n")) {
    const end = at + line.length;
    if (open) {
      const close = line.match(/^[ \t>]*(`{3,}|~{3,})[ \t]*$/);
      if (close && close[1]![0] === open.ch && close[1]!.length >= open.len) {
        open = null;
        code.fill(2, at + line.indexOf(close[1]!), end);
      } else {
        // Inside a quote each code line starts with the quote's ">", which is not code.
        let lead = 0;
        for (let q = 0; q < open.quotes; q++) {
          let k = lead;
          while (line[k] === " " || line[k] === "\t") k++;
          if (line[k] !== ">") break;
          lead = k + 1 + (line[k + 1] === " " || line[k + 1] === "\t" ? 1 : 0);
        }
        while (line[lead] === " " || line[lead] === "\t") lead++;
        code.fill(1, at + lead, end);
      }
    } else {
      const m = line.match(/^((?:[ \t]*(?:>[ \t]?|[-+*][ \t]+|\d{1,9}[.)][ \t]+))*[ \t]*)(`{3,}|~{3,})(.*)$/);
      if (m && !(m[2]![0] === "`" && m[3]!.includes("`"))) {
        open = { ch: m[2]![0]!, len: m[2]!.length, quotes: (m[1]!.match(/>/g) ?? []).length };
        code.fill(2, at + m[1]!.length, end);
      }
    }
    at = end + 1;
  }
  // Code spans: a run of backticks up to the next run of the same length in the same paragraph.
  const blank = /\n[ \t]*\n/g;
  for (let i = 0; i < md.length; i++) {
    if (md[i] !== "`" || code[i]) continue;
    let n = 1;
    while (md[i + n] === "`") n++;
    blank.lastIndex = i;
    const stop = md[i - 1] === "\\" ? -1 : (blank.exec(md)?.index ?? md.length);
    let close = -1;
    for (let j = md.indexOf("`", i + n); j >= 0 && j < stop && !code[j]; ) {
      let m = 1;
      while (md[j + m] === "`") m++;
      if (m === n) {
        close = j;
        break;
      }
      j = md.indexOf("`", j + m);
    }
    if (close >= 0) code.fill(1, i + n, close);
    i = (close >= 0 ? close : i) + n - 1;
  }
  return code;
}

/** The text an HTML character reference shows as (`&amp;` is "&"), or null when it is not one. */
function entity(ref: string): string | null {
  const num = ref.match(/^&#(?:(\d{1,7})|[xX]([0-9a-fA-F]{1,6}));$/);
  if (num) {
    const cp = num[1] ? parseInt(num[1], 10) : parseInt(num[2]!, 16);
    return cp === 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff) ? "�" : String.fromCodePoint(cp);
  }
  const named = decodeNamedCharacterReference(ref.slice(1, -1));
  return named === false ? null : named;
}

/** What of Markdown source shows on the page: `mask` 1 hides a character, `sub` gives one that shows
 *  as other text (a character reference), `code` marks code. Syntax is looked for outside code only, so a
 *  `# comment`, `List<String>` or `echo $$` in code stays text. Emphasis, code and link brackets are left
 *  to the caller (the skeleton ignores them everywhere). */
function shown(md: string): { code: Uint8Array; mask: Uint8Array; sub: Map<number, { text: string; len: number }> } {
  const code = codeOf(md);
  // Code is blanked out (same length, lines kept), so the patterns below never match inside it.
  let prose = md;
  if (code.includes(1)) {
    const cs: string[] = [];
    for (let i = 0; i < md.length; i++) cs.push(code[i] === 1 && md[i] !== "\n" ? "\x01" : md[i]!);
    prose = cs.join("");
  }
  const mask = code.map((c) => (c === 2 ? 1 : 0)); // code fences and their info strings
  const hide = (re: RegExp, from = 0) => {
    for (const m of prose.matchAll(re)) mask.fill(1, m.index + from, m.index + m[0].length);
  };
  hide(/<!--[\s\S]*?-->/g);
  hide(/\$\$[\s\S]*?\$\$/g); // math: rendered by KaTeX, outside the text index
  hide(IMAGE); // images
  hide(LINK_TAIL, 1); // link destinations
  // Reference links: a definition never shows, and `[text][label]` shows only its text.
  const defined = new Set<string>();
  for (const m of prose.matchAll(DEFINITION)) {
    if (m[1]!.startsWith("^") || !label(m[1]!)) continue;
    defined.add(label(m[1]!));
    mask.fill(1, m.index, m.index + m[0].length);
  }
  for (const m of prose.matchAll(FULL_REF)) {
    if (defined.has(label(m[2]! || m[1]!))) mask.fill(1, m.index + m[1]!.length + 2, m.index + m[0].length);
  }
  // An autolink shows without its angle brackets.
  for (const m of prose.matchAll(/<(?:[A-Za-z][A-Za-z0-9+.-]{1,31}:[^\s<>]*|[^\s<>@]+@[^\s<>@]+)>/g)) mask[m.index] = mask[m.index + m[0].length - 1] = 1;
  hide(/<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^>\n]*)?\/?>/g); // inline HTML tags (never rendered)
  hide(/^[ \t]*(?:#{1,6}[ \t]+|(?:>[ \t]?)+|(?:[-+*]|\d{1,9}[.)])[ \t]+)+/gm); // block markers
  hide(/^[ \t]*(?:[-*_][ \t]*){3,}$/gm); // thematic breaks
  hide(/^[ \t|:-]*-{3,}[ \t|:-]*$/gm); // table separator rows
  for (const m of prose.matchAll(/\\[!-/:-@[-`{-~]/g)) mask[m.index] = 1; // backslash escapes: the "\" goes, the mark stays
  hide(/(?<=^ {0,3}\[\^[^\]\s]+\]):/gm); // a footnote's "[^7]:" shows as its number alone (`footnotes`)
  // A character reference shows as its character ("&amp;" is "&"), kept at its "&".
  const sub = new Map<number, { text: string; len: number }>();
  for (const m of prose.matchAll(/(?<!\\)&(?:#\d{1,7}|#[xX][0-9a-fA-F]{1,6}|[A-Za-z][A-Za-z0-9]{1,31});/g)) {
    const text = mask[m.index] ? null : entity(m[0]);
    if (text === null) continue;
    sub.set(m.index, { text, len: m[0].length });
    mask.fill(1, m.index + 1, m.index + m[0].length);
  }
  return { code, mask, sub };
}

/** Skeleton of Markdown source; `map[i]` is the source offset of skeleton char i. */
export function sourceSkeleton(md: string): Skeleton {
  const { mask, sub } = shown(md);
  const parts: string[] = [];
  const map: number[] = [];
  const refs = new Map<number, number>();
  for (const [at, r] of sub) refs.set(at, r.len);
  for (let i = 0; i < md.length; i++) {
    if (mask[i]) continue;
    const t = sub.get(i)?.text ?? md[i]!;
    for (let k = 0; k < t.length; k++) {
      if (IGNORED.has(t[k]!)) continue;
      parts.push(t[k]!);
      map.push(i);
    }
  }
  return { chars: parts.join(""), map, refs };
}

/** A passage's Markdown as it reads on the page, on one line (a highlight in a list): `a [link](…)` is
 *  "a link", `\#` "#", `**bold**` "bold"; code keeps every character. */
export function passageText(md: string): string {
  const { code, mask, sub } = shown(md);
  // Cut from the body, a passage has no definitions: `[text][label]` shows its text alone, and a
  // footnote mark (a raised number on the page) goes; a note's own "[^3]:" shows its number.
  for (const m of md.matchAll(FULL_REF)) {
    const at = m.index + m[1]!.length + 2;
    if (code[at] !== 1 && !mask[at]) mask.fill(1, at, m.index + m[0].length);
  }
  for (const m of md.matchAll(FOOTNOTE_REF)) {
    if (code[m.index] === 1 || mask[m.index]) continue;
    const end = m.index + m[0].length;
    if (md[end] === ":") {
      mask.fill(1, m.index, m.index + 2);
      mask[end - 1] = 1;
    } else mask.fill(1, m.index, end);
  }
  const syntax = (i: number) => !mask[i] && code[i] !== 1 && md[i - 1] !== "\\";
  // A closed pair of brackets that isn't a link's is text ("[1]"); one the passage's edge cuts off is a link's.
  const text = new Set<number>();
  const open: number[] = [];
  for (let i = 0; i < md.length; i++) {
    if (!syntax(i)) continue;
    if (md[i] === "[") open.push(i);
    else if (md[i] === "]" && open.length) {
      const o = open.pop()!;
      if (md[i + 1] !== "(" && md[i + 1] !== "[") text.add(o).add(i);
    }
  }
  const word = (c: string | undefined) => !!c && WORD.test(c);
  let out = "";
  for (let i = 0; i < md.length; i++) {
    if (mask[i]) continue;
    const c = md[i]!;
    if (syntax(i)) {
      if (c === "`" || ((c === "[" || c === "]") && !text.has(i)) || (c === "~" && (md[i + 1] === "~" || md[i - 1] === "~"))) continue;
      if (c === "*" || c === "_") {
        // Emphasis: a run that touches a word on one side; an underscore inside a word is text.
        let a = i;
        let b = i;
        while (md[a - 1] === c) a--;
        while (md[b + 1] === c) b++;
        const before = md[a - 1];
        const after = md[b + 1];
        const flanks = (!!before && !SPACE.test(before)) || (!!after && !SPACE.test(after));
        if (flanks && !(c === "_" && word(before) && word(after))) continue;
      }
    }
    out += sub.get(i)?.text ?? c;
  }
  return out.replace(/\s+/g, " ").trim();
}

/** Skeleton of plain rendered text. */
export function plainSkeleton(text: string): string {
  let out = "";
  for (const c of text) if (!IGNORED.has(c)) out += c;
  return out;
}

/** Skeleton of the rendered DOM text, with each char's text node and offset. */
export type TextIndex = { chars: string; nodes: Text[]; node: Int32Array; off: Int32Array; first: Map<Text, number> };

export function indexText(root: HTMLElement): TextIndex {
  const nodes: Text[] = [];
  const parts: string[] = [];
  const nodeOf: number[] = [];
  const offOf: number[] = [];
  const first = new Map<Text, number>();
  // Rendered math is drawn glyphs, not the TeX in the body: left out, as the skeleton leaves out `$$…$$`. So is
  // a video card's bar and player (D92), which sit in the text but are not part of it.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest(".katex, [data-noindex]") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    const k = nodes.push(n) - 1;
    first.set(n, parts.length);
    const s = n.data;
    for (let i = 0; i < s.length; i++) {
      if (IGNORED.has(s[i]!)) continue;
      parts.push(s[i]!);
      nodeOf.push(k);
      offOf.push(i);
    }
  }
  return { chars: parts.join(""), nodes, node: Int32Array.from(nodeOf), off: Int32Array.from(offOf), first };
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

/** Skeleton offset of a DOM point inside the indexed root. */
export function skeletonOffset(idx: TextIndex, node: Node, offset: number): number {
  const base = node.nodeType === Node.TEXT_NODE ? idx.first.get(node as Text) : undefined;
  if (base !== undefined) return base + plainSkeleton((node as Text).data.slice(0, offset)).length;
  // Between elements, or in text left out of the index (math): the first indexed text after the point.
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
  const to = skeletonOffset(idx, sel.endContainer, sel.endOffset);
  const needle = idx.chars.slice(at, to);
  if (!needle) return null;
  const pre = idx.chars.slice(Math.max(0, at - 24), at);
  const suf = idx.chars.slice(to, to + 24);
  const hint = (at / Math.max(1, idx.chars.length)) * src.chars.length;
  const h = find(src.chars, pre, needle, suf, hint);
  if (h === null) return null;
  const start = src.map[h]!;
  let end = src.map[h + needle.length - 1]! + 1;
  // A character reference ("&amp;") is one character on the page: the quote takes all of it.
  end += (src.refs.get(end - 1) ?? 1) - 1;
  return { exact: body.slice(start, end), start };
}

type Quote = { exact: string; prefix: string; suffix: string; start: number };

/** A DOM range for a stored annotation, located by its quote (context first, then position). A quote
 *  still at its offset is cut from the body's own skeleton, since a piece of code read alone (a
 *  `# comment` line out of its fence) would read as Markdown. */
export function rangeFor(idx: TextIndex, src: Skeleton, body: string, q: Quote): Range | null {
  let needle: string;
  let pre: string;
  let suf: string;
  if (q.exact && body.startsWith(q.exact, q.start)) {
    const a = sourceIndex(src, q.start);
    const b = sourceIndex(src, q.start + q.exact.length);
    needle = src.chars.slice(a, b);
    pre = src.chars.slice(Math.max(0, a - 24), a);
    suf = src.chars.slice(b, b + 24);
  } else {
    needle = sourceSkeleton(q.exact).chars;
    pre = sourceSkeleton(q.prefix).chars;
    suf = sourceSkeleton(q.suffix).chars;
  }
  if (!needle) return null;
  const hint = (q.start / Math.max(1, body.length)) * idx.chars.length;
  const h = find(idx.chars, pre, needle, suf, hint);
  if (h === null) return null;
  const last = h + needle.length - 1;
  const range = document.createRange();
  range.setStart(idx.nodes[idx.node[h]!]!, idx.off[h]!);
  range.setEnd(idx.nodes[idx.node[last]!]!, idx.off[last]! + 1);
  return range;
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

/** Which stored range is under the point, if any. */
export function hitTest(ranges: Map<string, Range>, x: number, y: number): string | null {
  const caret = document.caretRangeFromPoint(x, y);
  if (!caret) return null;
  for (const [id, r] of ranges) {
    try {
      if (r.comparePoint(caret.startContainer, caret.startOffset) !== 0) continue;
    } catch {
      continue;
    }
    for (const b of r.getClientRects()) {
      if (x >= b.left - 1 && x <= b.right + 1 && y >= b.top - 1 && y <= b.bottom + 1) return id;
    }
  }
  return null;
}

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
const PAGE = /^<!-- page (\d+) -->$/;
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
