// The corpus audit: what a doc.md holds (its fingerprint, compared run to run) and what in it looks
// broken (its flags), with no hand-written key. A flag is a lead, not a verdict: read the doc and its
// original before calling it a bug. Each rule names the bug that taught it.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { words, type Original } from "./original.ts";

export interface Fingerprint {
  type: string;
  title: string;
  author?: string;
  published?: string;
  words: number;
  /** Each heading as `##` marks and its text, in order. */
  headings: string[];
  code: number;
  tables: number;
  math: number;
  images: number;
  first: string;
  last: string;
}

export interface Flag {
  rule: string;
  /** What was seen: a count, a ratio, an example line. */
  detail: string;
}

/** A body's lines outside code blocks, and its code blocks' contents. */
function split(body: string): { prose: string[]; code: string[][] } {
  const prose: string[] = [];
  const code: string[][] = [];
  let open: string[] | null = null;
  let fence = "";
  for (const line of body.split("\n")) {
    const m = line.match(/^\s*(`{3,}|~{3,})/);
    if (open) {
      if (m && m[1][0] === fence[0] && m[1].length >= fence.length && !line.trim().slice(m[1].length).trim()) {
        code.push(open);
        open = null;
      } else open.push(line);
    } else if (m) {
      open = [];
      fence = m[1];
    } else prose.push(line);
  }
  if (open) code.push(open);
  return { prose, code };
}

const HEADING = /^(#{1,6})\s+(.*)$/;

export function fingerprint(meta: Record<string, unknown>, body: string): Fingerprint {
  const { prose, code } = split(body);
  const text = prose.join("\n");
  const w = words(text.replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\]\([^)]*\)/g, "]"));
  return {
    type: String(meta.type ?? ""),
    title: String(meta.title ?? ""),
    ...(meta.author ? { author: String(meta.author) } : {}),
    ...(meta.published ? { published: String(meta.published) } : {}),
    words: w.length,
    headings: prose.flatMap((l) => {
      const m = l.match(HEADING);
      return m ? [`${m[1]} ${m[2].trim()}`] : [];
    }),
    code: code.length,
    tables: prose.filter((l, i) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(l) && i > 0).length,
    math: (text.match(/\$\$[\s\S]+?\$\$/g) ?? []).length + (text.replace(/\$\$[\s\S]+?\$\$/g, "").match(/(?<![\\$])\$(?!\s)[^$\n]+?(?<!\s)\$(?!\d)/g) ?? []).length,
    images: (text.match(/!\[[^\]]*\]\([^)]+\)/g) ?? []).length,
    first: w.slice(0, 12).join(" "),
    last: w.slice(-12).join(" "),
  };
}

/** What changed between two runs' fingerprints, as one line each. */
export function changes(was: Fingerprint, now: Fingerprint): string[] {
  const out: string[] = [];
  for (const k of ["type", "title", "author", "published", "first", "last"] as const)
    if ((was[k] ?? "") !== (now[k] ?? "")) out.push(`${k}: “${was[k] ?? ""}” → “${now[k] ?? ""}”`);
  for (const k of ["code", "tables", "math", "images"] as const) if (was[k] !== now[k]) out.push(`${k}: ${was[k]} → ${now[k]}`);
  if (Math.abs(was.words - now.words) > Math.max(5, was.words * 0.002)) out.push(`words: ${was.words} → ${now.words}`);
  const gone = was.headings.filter((h) => !now.headings.includes(h));
  const added = now.headings.filter((h) => !was.headings.includes(h));
  if (gone.length || added.length || was.headings.length !== now.headings.length)
    out.push(`headings: ${was.headings.length} → ${now.headings.length}` + (gone.length ? `; gone “${gone.slice(0, 3).join("”, “")}”` : "") + (added.length ? `; new “${added.slice(0, 3).join("”, “")}”` : ""));
  return out;
}

/** Words of the original also in the doc, counted with repeats: how much of the text came in. */
function kept(orig: string[], doc: string[]): number {
  const have = new Map<string, number>();
  for (const w of doc) have.set(w, (have.get(w) ?? 0) + 1);
  let n = 0;
  for (const w of orig) {
    const c = have.get(w) ?? 0;
    if (c > 0) {
      n++;
      have.set(w, c - 1);
    }
  }
  return n;
}

/** How much of the original's order the doc keeps: runs of eight words taken evenly through the original,
 *  found in the doc, and the longest share of them that come in the same order. 1 is the same order. */
function order(orig: string[], doc: string[]): { found: number; inOrder: number } {
  const N = 8;
  const at = new Map<string, number>();
  for (let i = 0; i + N <= doc.length; i++) {
    const k = doc.slice(i, i + N).join(" ");
    // A run the doc has twice (a paragraph a document repeats) can't say where it sits: -1.
    at.set(k, at.has(k) ? -1 : i);
  }
  const step = Math.max(N, Math.floor(orig.length / 300));
  const seen: number[] = [];
  let tried = 0;
  let found = 0;
  for (let i = 0; i + N <= orig.length; i += step) {
    tried++;
    const p = at.get(orig.slice(i, i + N).join(" "));
    if (p !== undefined) found++;
    if (p !== undefined && p >= 0) seen.push(p);
  }
  // Longest increasing run of positions (patience sort).
  const tails: number[] = [];
  for (const p of seen) {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tails[mid] < p) lo = mid + 1;
      else hi = mid;
    }
    tails[lo] = p;
  }
  return { found: tried ? found / tried : 1, inOrder: seen.length ? tails.length / seen.length : 1 };
}

/** How much of the original's text the doc kept (`lost`: share of its words missing), what it added that the
 *  original doesn't say, and whether passages come in the original's order. Undefined for a short original. */
export function coverage(orig: Original, body: string): { lost: number; added: number; found: number; inOrder: number } | undefined {
  if (orig.words.length <= 200) return undefined;
  // The whole body in its order, code included, without links' and pictures' addresses.
  // TeX the doc draws a formula with (\frac, \lambda) is not words of the original: MathML holds λ.
  const docWords = words(body.replace(/\\[a-zA-Z]+/g, " ").replace(/^\s*(?:`{3,}|~{3,}).*$/gm, "").replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\]\([^)]*\)/g, "]"));
  const k = kept(orig.words, docWords);
  const o = order(orig.words, docWords);
  const r = (x: number) => Math.round(x * 1000) / 1000;
  return { lost: r(1 - k / orig.words.length), added: r(1 - k / Math.max(1, docWords.length)), found: r(o.found), inOrder: r(o.inOrder) };
}

const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;

/** What in a doc.md looks broken. `dir` is the source's folder (for its pictures), `orig` what its original holds. */
export function audit(meta: Record<string, unknown>, body: string, dir?: string, orig?: Original): Flag[] {
  const flags: Flag[] = [];
  const flag = (rule: string, detail: string) => flags.push({ rule, detail });
  const { prose, code } = split(body);
  const fp = fingerprint(meta, body);
  const headings = prose.map((l) => l.match(HEADING)?.[2]?.trim()).filter((h): h is string => !!h);

  // An EPUB whose publisher marks code lines as headings (#586).
  const codeLike = headings.filter((h) => /[;{}]\s*$|^\s*(?:def|class|import|from|return|const|let|var|function|public|private|if|for|while|print)\b.*[(=:{]|=>|\)\s*[{:]\s*$|^[\w.]+\([^)]*\)\s*;?$/.test(h));
  if (codeLike.length >= 2) flag("heading-looks-like-code", `${codeLike.length}: “${codeLike.slice(0, 2).join("”, “")}”`);
  // A paragraph taken for a heading.
  const long = headings.filter((h) => words(h).length > 25);
  if (long.length) flag("heading-is-a-paragraph", `${long.length}: “${long[0].slice(0, 90)}…”`);
  const blocks = prose.join("\n").split(/\n\s*\n/).filter((b) => b.trim()).length;
  if (headings.length > 20 && headings.length / blocks > 0.35) flag("headings-flood", `${headings.length} headings in ${blocks} blocks`);
  if (!headings.length && fp.words > 8000 && !/video|podcast|audio/.test(fp.type)) flag("no-outline", `${fp.words} words, no headings`);
  const empty = headings.length > 3 && prose.join("\n").split(/^#{1,6} .*$/m).slice(1, -1).filter((s) => !s.trim()).length;
  if (empty && empty > headings.length * 0.5 && empty > 5) flag("empty-sections", `${empty} of ${headings.length} headings have nothing under them`);
  const repeated = new Map<string, number>();
  for (const h of headings) repeated.set(h, (repeated.get(h) ?? 0) + 1);
  const most = [...repeated].sort((a, b) => b[1] - a[1])[0];
  if (most && most[1] >= 8 && most[1] > headings.length * 0.2) flag("same-heading-repeated", `“${most[0].slice(0, 60)}” ×${most[1]}`);

  const text = prose.join("\n");
  // Text decoded in the wrong encoding, or characters lost.
  const moji = text.match(/Ã[\u0080-¿]|â€[\u0080-¿™œ\u009d]|Â[ -¿]|�/g);
  if (moji && moji.length >= 3) flag("mojibake", `${moji.length}: “${moji.slice(0, 3).join(" ")}”`);
  const html = text.replace(/`[^`\n]*`/g, "").match(/<\/?(?:div|span|p|a|img|table|tr|td|br|sup|sub|section|figure|font|em|strong|b|i)(?:\s[^>]*)?>/gi);
  if (html && html.length >= 3) flag("html-left-in", `${html.length}: ${html.slice(0, 3).join(" ")}`);
  const ents = text.replace(/`[^`\n]*`/g, "").match(/&(?:amp|lt|gt|quot|nbsp|apos|#\d+|#x[\da-f]+);/gi);
  if (ents && ents.length >= 3) flag("entities-left-in", `${ents.length}: ${ents.slice(0, 3).join(" ")}`);
  if ((body.match(/^\s*(`{3,}|~{3,})/gm) ?? []).length % 2) flag("code-fence-unclosed", "an odd number of fences");
  // Words broken across lines and never joined ("infor- mation").
  const broken = text.match(/\b\p{Ll}{2,}- \p{Ll}{2,}\b/gu)?.filter((m) => !/- (?:or|and|to|nor|in|on|the|a|an|than|through|versus|vs)$/.test(m) && !/^(?:and|or|to|non|self|well|one|two|three|four|five|pre|post|anti|co|re|sub|over|under|semi|mid|multi|cross|half|long|short|high|low|full|part|first|second|third)-/.test(m));
  if (broken && broken.length >= 5) flag("words-split-at-line-ends", `${broken.length}: “${broken.slice(0, 3).join("”, “")}”`);
  // Paragraphs cut at line ends: a block that stops mid-sentence and a next one starting lower case.
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p && !/^(?:#|\||!\[|[-*+>]|\d+[.)]|\$\$)/.test(p));
  let cut = 0;
  for (let i = 1; i < paras.length; i++) if (/[\p{Ll},]$/u.test(paras[i - 1]) && /^\p{Ll}/u.test(paras[i])) cut++;
  if (paras.length > 20 && cut > Math.max(5, paras.length * 0.08)) flag("paragraphs-cut", `${cut} of ${paras.length} paragraphs end mid-sentence and the next goes on`);
  // The same long paragraph again and again: a running head or a page footer kept as text.
  const seen = new Map<string, number>();
  for (const p of paras) if (p.length > 25 && p.length < 400) seen.set(p, (seen.get(p) ?? 0) + 1);
  const dup = [...seen].filter(([, n]) => n >= 4).sort((a, b) => b[1] - a[1]);
  if (dup.length) flag("line-repeated", `${dup.length}, most “${dup[0][0].slice(0, 70)}” ×${dup[0][1]}`);
  // Tables whose rows don't line up.
  let ragged = 0;
  for (const t of text.split(/\n[ \t]*\n/).filter((b) => /^\s*\|.*\|\s*$/m.test(b))) {
    const rows = t.split("\n").filter((l) => /^\s*\|/.test(l)).map((l) => l.replace(/\\\|/g, "").trim().replace(/^\||\|$/g, "").split("|").length);
    if (rows.length > 1 && new Set(rows).size > 1) ragged++;
  }
  if (ragged) flag("table-rows-ragged", `${ragged} tables`);
  if ((text.match(/\$\$/g) ?? []).length % 2) flag("math-unclosed", "an odd number of $$");
  // Pictures the doc shows that aren't in the source's folder.
  if (dir) {
    const missing = [...text.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)].map((m) => m[1]).filter((p) => !/^[a-z]+:/i.test(p) && !existsSync(join(dir, decodeURIComponent(p))));
    if (missing.length) flag("picture-missing", `${missing.length}: ${missing[0]}`);
  }
  // Code blocks that are prose, or empty.
  const emptyCode = code.filter((c) => !c.join("").trim()).length;
  if (emptyCode >= 2) flag("code-block-empty", `${emptyCode}`);
  // Metadata.
  const title = fp.title.trim();
  if (!title || /^(?:untitled|cover|title page|unknown|document\d*|microsoft word - .*|.*\.(?:docx?|pdf|epub|indd|qxd))$/i.test(title) || /^[\w-]+_[\w_-]+$/.test(title) || /^\d{10,13}$/.test(title))
    flag("title-bad", `“${title}”`);
  if (title.length > 180) flag("title-too-long", `${title.length} letters`);
  if (fp.author && (/^(?:unknown|admin|user|calibre|by)$/i.test(fp.author) || fp.author.length > 150)) flag("author-bad", `“${fp.author.slice(0, 80)}”`);

  if (orig) {
    const c = coverage(orig, body);
    if (c) {
      // A PDF's running heads, feet and stamps are its own text that Ore leaves out on purpose: up to a tenth of a paper.
      if (c.lost > (fp.type === "pdf" ? 0.12 : 0.06)) flag("text-lost", `${pct(c.lost)} of the original's ${orig.words.length} words are not in the doc`);
      if (c.added > 0.08) flag("text-added", `${pct(c.added)} of the doc's words are not in the original`);
      if (c.found > 0.3 && c.inOrder < 0.9) flag("order-changed", `${pct(c.inOrder)} of found passages in the original's order`);
    }
    const less = (rule: string, had: number | undefined, has: number, min = 3) => {
      if (had !== undefined && had >= min && has < had * 0.5) flag(rule, `original ${had}, doc ${has}`);
    };
    less("headings-lost", orig.headings, fp.headings.length);
    less("code-lost", orig.code, fp.code);
    less("tables-lost", orig.tables, fp.tables, 2);
    less("math-lost", orig.math, fp.math);
    // A picture the book names but doesn't hold is a marked gap (D351), not a loss.
    less("pictures-lost", orig.images, fp.images + (text.match(/\[missing figure/g) ?? []).length);
    if (orig.author && !fp.author) flag("author-lost", `original says “${orig.author.slice(0, 60)}”`);
  }
  return flags;
}
