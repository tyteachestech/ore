// Rewrites a saved page's words so the fixture holds the site's markup but none of its author's text
// (the repo is public, AGPL). Tags, attributes, links, numbers, punctuation, math and the page's
// title stay; every other word becomes one of ours of about the same length, and short function
// words stay so sentences keep their shape. Run once per page: bun rewrite-page.ts [--keep "names"] web/essay.html
import { readFileSync, writeFileSync } from "node:fs";

const KEEP = new Set(
  "a an the of to in on at by for from with and or but nor so as is are was were be been it its this that these those i we you he she they me us him her them my our your his their not no yes if then than when where who what which how all any each one two january february march april may june july august september october november december".split(" "),
);
const VOCAB = `
recall cue card gap test note fact idea mind skill plan step read learn pause sleep focus spaced review
memory lesson answer prompt habit trace chunk index deck topic level sense guess check model drill
practice attention question retrieval interval forgetting reading writing example pattern concept
strength teacher student session problem exercise schedule feedback evidence research knowledge
understanding elaboration interleaving consolidation comprehension generation
`.split(/\s+/).filter(Boolean);

// A fixed seed, so a rerun writes the same page.
let seed = 0x9e3779b9;
const rand = () => ((seed = (Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0) / 2 ** 32);
const byLength = (n: number) => {
  const near = VOCAB.filter((w) => Math.abs(w.length - n) <= 1);
  return (near.length ? near : VOCAB)[Math.floor(rand() * (near.length || VOCAB.length))]!;
};
function word(w: string): string {
  if (w.length <= 2 || KEEP.has(w.toLowerCase())) return w;
  const n = byLength(w.length);
  if (w === w.toUpperCase() && w.length > 1) return n.toUpperCase();
  return /^[A-Z]/.test(w) ? n[0]!.toUpperCase() + n.slice(1) : n;
}
/** Words in plain text; entities, links and addresses are left as they are. */
const text = (s: string) => s.replace(/&#?\w+;|\\u[0-9a-fA-F]{4}|\\.|https?:\/\/\S+|[\w.+-]+@[\w.-]+|\p{L}+/gu, (t) => (/^\p{L}+$/u.test(t) ? word(t) : t));

const SKIP = /^(?:script|style|title|math|svg|guid|pubDate|itunes:duration)$/i;
const ATTRS = /\b(alt|title|aria-label|content)="([^"]*)"/g;

export function rewrite(page: string): string {
  // A feed's own name is its first title; its episodes' titles are rewritten.
  let titles = page.startsWith("<?xml") ? 1 : Infinity;
  // The page's own title and author stay, wherever the page repeats them.
  const named = [page.match(/<title[^>]*>([^<]*)/i)?.[1] ?? "", ...[...page.matchAll(/<meta[^>]+(?:name|property)="(?:author|og:title|twitter:title|article:author)"[^>]*content="([^"]*)"/gi)].map((m) => m[1]!)];
  for (const w of named.join(" ").match(/\p{L}+/gu) ?? []) KEEP.add(w.toLowerCase());
  const out: string[] = [];
  let skip: string | undefined;
  for (const part of page.split(/(<!--[\s\S]*?-->|<!\[CDATA\[|\]\]>|<[^>]*>)/)) {
    if (!part) continue;
    if (part.startsWith("<")) {
      const tag = part.match(/^<\/?([\w:-]+)/)?.[1];
      if (skip) {
        if (tag && part.startsWith("</") && tag.toLowerCase() === skip) skip = undefined;
        out.push(part);
        continue;
      }
      if (tag && !part.startsWith("</") && !part.endsWith("/>") && SKIP.test(tag) && !(tag === "title" && titles-- <= 0)) skip = tag.toLowerCase();
      if (part.startsWith("<!--")) {
        out.push(text(part));
        continue;
      }
      // A meta tag's content is rewritten only for a description; alt and title text always.
      const meta = /^<meta\b/i.test(part);
      out.push(part.replace(ATTRS, (m, k: string, v: string) => (k === "content" && !(meta && /description/i.test(part)) ? m : `${k}="${text(v)}"`)));
      continue;
    }
    out.push(skip ? part : text(part));
  }
  return ld(out.join(""));
}

/** Data in scripts (JSON-LD, a page's state) keeps its shape; any string of five words or more is rewritten. */
function ld(page: string): string {
  return page.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (_, a, js: string, b) => a + js.replace(/"((?:\\.|[^"\\])*)"/g, (m, v: string) => (v.split(/\s+/).length >= 5 ? `"${text(v)}"` : m)) + b);
}

// --keep "Ada Lovelace, Alan Turing": names the page shows (its authors) that stay as written.
if (import.meta.main) {
  const args = process.argv.slice(2);
  const k = args.indexOf("--keep");
  if (k >= 0) for (const w of args.splice(k, 2)[1]!.match(/\p{L}+/gu) ?? []) KEEP.add(w.toLowerCase());
  for (const f of args) writeFileSync(f, rewrite(readFileSync(f, "utf8")));
}
