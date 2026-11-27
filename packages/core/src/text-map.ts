// Shared Markdown-to-shown-text map for core anchoring and the Mac/iPhone reader.
// This module has no DOM or platform dependencies.
// Both sides are reduced to a "skeleton": the characters that render as text, minus whitespace
// and, outside code, the punctuation Markdown uses for emphasis, code, links and tables (in code each
// one is a character he reads, `items[0]`). A formula is one character of its own (MATH), drawn by
// KaTeX from its TeX: a selection touching it takes all of it, quoted as its `$$…$$`. A selection is matched
// in the source skeleton to recover the exact source text (so `ore highlight` gets an exact
// match), and a stored annotation's `exact` is matched in the rendered skeleton to paint it.

import { decodeNamedCharacterReference } from "decode-named-character-reference";

const BLANK = new Set([..." \t\n\r\f\v   "]);
const IGNORED = new Set([...BLANK, ..."*_`[]|~"]);
/** A formula's place in both skeletons: one character, never one of the text's. */
export const MATH = "\uFFFC";
export const skipped = (c: string, code: boolean) => (code ? BLANK : IGNORED).has(c);

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

/** A line's indent in columns (a tab to the next multiple of 4) and where its text starts. */
function indentOf(line: string): { cols: number; lead: number } {
  let cols = 0;
  let lead = 0;
  for (; line[lead] === " " || line[lead] === "\t"; lead++) cols = line[lead] === "\t" ? cols + 4 - (cols % 4) : cols + 1;
  return { cols, lead };
}
const LIST_ITEM = /^( {0,3}(?:[-+*]|\d{1,9}[.)]))([ \t]+|$)/;

/** Which characters are code (a fenced block's lines, an indented block's, a code span's text), where Markdown
 *  syntax does not apply: the reader shows each one as written. 1 marks code, 2 a fence line (never shown).
 *  An indented block is CommonMark's: 4 columns in, not a paragraph's lazy line, and in a list 4 past the item's text. */
function codeOf(md: string): Uint8Array {
  const code = new Uint8Array(md.length);
  let open: { ch: string; len: number; quotes: number } | null = null;
  let at = 0;
  /** The line before was a paragraph's (an indented line then continues it), and the open list's text column. */
  let para = false;
  let list = -1;
  for (const line of md.split("\n")) {
    const end = at + line.length;
    const { cols, lead } = indentOf(line);
    const blank = lead === line.length;
    if (!open && !blank) {
      if (list >= 0 && cols < list && !LIST_ITEM.test(line) && !para) list = -1; // a line left of the item's text ends the list
      if (!para && cols >= (list >= 0 ? list : 0) + 4) {
        code.fill(1, at + lead, end);
        at = end + 1;
        continue;
      }
    }
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
    if (!open && !blank) {
      const item = line.match(LIST_ITEM);
      // Its text starts past the marker and 1 to 4 spaces (more, and the text is 1 past the marker: code).
      const w = item && indentOf(item[2]!).cols;
      if (item) list = item[1]!.length + (w! >= 1 && w! <= 4 ? w! : 1);
    }
    // A paragraph goes on until a blank line; a heading, a fence or a rule is a line of its own.
    para = !blank && !open && !code[at + lead] && !/^ {0,3}(#{1,6}([ \t]|$)|(\*[ \t]*){3,}$|(-[ \t]*){3,}$|(_[ \t]*){3,}$)/.test(line);
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
 *  to the caller (the skeleton ignores them outside code). `math` is each formula's start and length. */
function shown(md: string): { code: Uint8Array; mask: Uint8Array; sub: Map<number, { text: string; len: number }>; math: Map<number, number> } {
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
  // Math, drawn by KaTeX: hidden as text (the caller shows each formula whole, at its start) and blanked
  // like code, so no pattern below reads its TeX as Markdown.
  const math = new Map<number, number>();
  for (const m of prose.matchAll(/\$\$[\s\S]*?\$\$/g)) {
    if (mask[m.index]) continue;
    math.set(m.index, m[0].length);
    mask.fill(1, m.index, m.index + m[0].length);
  }
  if (math.size) {
    const cs = prose.split("");
    for (const [at, len] of math) for (let i = at; i < at + len; i++) if (cs[i] !== "\n") cs[i] = "\x01";
    prose = cs.join("");
  }
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
  return { code, mask, sub, math };
}

/** Skeleton of Markdown source; `map[i]` is the source offset of skeleton char i. */
export function sourceSkeleton(md: string): Skeleton {
  const { code, mask, sub, math } = shown(md);
  const parts: string[] = [];
  const map: number[] = [];
  const refs = new Map<number, number>();
  for (const [at, r] of sub) refs.set(at, r.len);
  for (const [at, len] of math) refs.set(at, len);
  for (let i = 0; i < md.length; i++) {
    if (math.has(i)) {
      parts.push(MATH);
      map.push(i);
      continue;
    }
    if (mask[i]) continue;
    const t = sub.get(i)?.text ?? md[i]!;
    for (let k = 0; k < t.length; k++) {
      if (skipped(t[k]!, code[i] === 1)) continue;
      parts.push(t[k]!);
      map.push(i);
    }
  }
  return { chars: parts.join(""), map, refs };
}

/** A passage's Markdown as it reads on the page, on one line (a highlight in a list): `a [link](…)` is
 *  "a link", `\#` "#", `**bold**` "bold"; code keeps every character. */
export function passageText(md: string): string {
  const { code, mask, sub, math } = shown(md);
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
    const tex = math.get(i);
    if (tex) out += md.slice(i + 2, i + tex - 2); // a formula reads as its TeX
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

/** Skeleton of plain rendered text. Code keeps its literal punctuation, as the DOM index does. */
export function plainSkeleton(text: string, code = false): string {
  let out = "";
  for (const c of text) if (!skipped(c, code)) out += c;
  return out;
}

