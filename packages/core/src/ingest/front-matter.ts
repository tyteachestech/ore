// A book's front matter: the publisher's pages before the text (title page, copyright, contents, dedication,
// praise, "also by", a newsletter page). They stay in doc.md, whole and in the book's order (D122); FRONT_END
// marks where they stop, and the reader folds what is above it.
//
// A page is folded only on evidence that it is one of those pages, and the fold stops at the first page that
// could be the author's text: a foreword, preface, introduction, prologue or note is the book, whatever
// `epub:type="frontmatter"` or a "start reading here" mark says (publishers put both on the wrong pages).

/** Ends the front matter in a book's doc.md: the reader folds what is above it. */
export const FRONT_END = "<!-- end of front matter -->";

/** Starts the back matter in a book's doc.md, when it ends on publisher's pages (also by, about the author, a
 *  newsletter page, a second copyright page): the reader folds what is below it. */
export const BACK_START = "<!-- back matter -->";

/** What one page of a book says about itself. */
export interface PageFacts {
  /** Its `epub:type` and `role` words, and the kinds the book's guide and landmarks give its file. */
  types: string[];
  /** What the book's table of contents calls it (every entry that points into its file). */
  labels: string[];
  /** Its first heading, when it starts with one. */
  heading?: string;
  /** Its words as plain text. */
  text: string;
  /** Links on the page and the words inside them. */
  links: number;
  linkWords: number;
}

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const count = (s: string) => (s.match(/\S+/g) ?? []).length;

// Names a publisher's page goes by, in its marks, its contents entry or its heading.
const FOLD = /^(?:(?:front |book )?cover(?: page| image)?|(?:half |series |full |book )?title(?: ?page)?|halftitle(?:page)?|frontispiece|copyright(?: ?page| notice| information| and permissions)?|(?:table of |brief |detailed )?contents|toc|landmarks|dedication|epigraph|imprint|colophon|seriespage|other credits|loi|lot|list of (?:figures|tables|illustrations|maps|exhibits|plates)\b.*|also by\b.*|(?:other |more )?(?:books|titles|works) by\b.*|by the same author|(?:advance |more )?praise\b.*|what (?:people|readers|others) (?:are saying|have said|say)\b.*|about the (?:authors?|publisher)|a note about the authors?|newsletter(?: sign ?up)?|sign up)$/;
// Pages that are the book, however short and wherever they sit.
const TEXT = /^(?:introduction|preface|foreword|prologue|preamble|prelude|overture|abstract|chapter|part|book|section|lesson|module|authors? note|a note (?:to|from|on|about the (?:text|translation|book))|note (?:to|from|on)|to the reader|how to (?:use|read)|acknowledge?ments|overview|start here|before you (?:begin|start)|\d+)\b/;
const TEXT_TYPES = new Set("chapter part volume division foreword preface introduction prologue preamble abstract acknowledgments acknowledgements epilogue afterword conclusion appendix backmatter glossary bibliography index".split(" "));
// At a book's end these are the book too: what the author wrote after the last chapter, and what a learner looks things up in.
const BACK_TEXT = /^(?:afterword|epilogue|conclusions?|coda|postscript|postface|appendi(?:x|ces)|notes?|endnotes|footnotes|index|bibliography|references|glossary|(?:further|recommended|suggested) (?:reading|resources)|sources|works cited|resources|credits|(?:image|photo|illustration|picture|text) credits|permissions|discussion (?:questions|guide)|reading group\b.*|questions for\b.*|timeline|chronology|abbreviations|a note on\b.*|about this book|key terms|exercises|answers|solutions)\b/;
// Marks on a book's last pages that say the same.
const BACK_TYPES = new Set("endnotes rearnotes rearnote footnotes notes credits credit contributors errata answers qna".split(" "));
const START = new Set(["text", "start", "bodymatter", "other start"]);
// Kinds a mark may name on a block inside a chapter (its epigraph), so they count only on a short page.
const SHORT_TYPES = /^(?:dedication|epigraph|titlepage|halftitlepage|title page|cover)$/;

const NEWSLETTER = /\bnewsletters?\b|\bsign up\b|\bspecial offers\b|\bthank you for (?:buying|purchasing|downloading)\b/;
const RIGHTS = [/©|\bcopyright (?:©|\(c\)|\d{4})/i, /\ball rights reserved\b/i, /\bISBN\b/, /\blibrary of congress\b/i, /\bno part of this (?:book|publication|work)\b/i, /\bfirst (?:published|edition|printing)\b/i, /\bcopyright infringement\b/i, /\bfor your personal use only\b/i, /\bcopyright act\b/i, /\bpermission of the publisher\b/i, /\bcataloging.in.publication\b/i];
/** A rights notice: two of its phrases, or one on a short page. */
function rights(text: string, words: number, least = 1): boolean {
  const n = RIGHTS.filter((re) => re.test(text)).length;
  return n >= 2 || (n >= least && words <= 150);
}

/** A page's words read as a publisher's page with no mark on it. */
function reads(text: string, words: number, p: PageFacts, title: string[], back: boolean): boolean {
  const t = norm(text);
  const head = t.slice(0, 80);
  if (/^(?:also by|(?:other |more )?(?:books|titles|works) by|by the same author|(?:advance |more )?praise (?:for|from)|what (?:people|readers|others) (?:are saying|have said|say))\b/.test(head)) return true;
  // At a book's end only what is plainly the publisher's: a last page that names the author, starts "To…" or is
  // all links can be a poem's close, a letter or the index.
  // A rights notice there needs two of its phrases: a picture credit or a cited edition has one.
  if (back) return (words <= 150 && NEWSLETTER.test(t)) || (words <= 400 && rights(text, words, 2));
  if (words <= 40 && title.some((name) => name.length > 2 && ` ${t} `.includes(` ${name} `))) return true;
  if (words <= 150 && /^begin reading\b/.test(head)) return true;
  if (words <= 25 && !p.heading && /^(?:to|for)\b/.test(head)) return true;
  if (words <= 80 && !p.heading && /^(?:to|for) (?:my|our|the|all|every)\b|^(?:this book is )?dedicated to\b|^in (?:loving )?memory of\b/.test(head)) return true;
  if (words <= 150 && NEWSLETTER.test(t)) return true;
  if (rights(text, words)) return true;
  return p.links >= 5 && p.linkWords >= words * 0.7;
}

/** "fold": a publisher's page. "text": the book. "small": a short page that says nothing either way.
 *  `back`: judged as a page at the book's end, where an afterword, notes or an index are the book. */
export function pageKind(p: PageFacts, title: string[] = [], back = false): "fold" | "text" | "small" | "long" {
  const words = count(p.text);
  const types = p.types.map(norm);
  const names = [...p.labels, ...(p.heading ? [p.heading] : [])].map(norm).filter(Boolean);
  const sized = words <= 2000;
  // Its name outranks its marks (a publisher marks its praise page "preface"), and both outrank how it reads.
  if (names.some((n) => TEXT.test(n) || (back && BACK_TEXT.test(n)))) return "text";
  // Every contents entry into the file must be a publisher's page: one file can hold the title page and chapter 1.
  const named = p.labels.length ? p.labels.map(norm).every((n) => FOLD.test(n)) : !!p.heading && FOLD.test(norm(p.heading));
  if (sized && named) return "fold";
  // "backmatter" is on the publisher's last pages as often as on the notes, so at the end it says nothing.
  if (types.some((t) => (TEXT_TYPES.has(t) && !(back && t === "backmatter")) || (back && BACK_TYPES.has(t)))) return "text";
  if (sized && types.some((t) => FOLD.test(t) && (words <= 300 || !SHORT_TYPES.test(t)))) return "fold";
  if (sized && reads(p.text, words, p, title.map(norm).filter(Boolean), back)) return "fold";
  // "Start reading here" often points at the title page, so it only speaks for a page nothing else has placed.
  if (words > 60 && types.some((t) => START.has(t))) return "text";
  return words <= 200 ? "small" : "long";
}

/** How many of a book's first pages are its front matter. A short unmarked page between two of them (a blurb
 *  before the copyright page) goes with them; one after the last of them stays with the text. */
export function frontPages(pages: PageFacts[], title: string[] = []): number {
  let end = 0;
  for (let i = 0; i < pages.length; i++) {
    const kind = pageKind(pages[i]!, title);
    if (kind === "fold") end = i + 1;
    else if (kind !== "small") break;
  }
  // A book that is all front matter has nothing to fold it away from.
  return end < pages.length ? end : 0;
}

/** Where a book's back matter starts: the first of the publisher's pages it ends on, or `pages.length` when it
 *  ends on its text. Read from the last page back, the same way as the front: the book's last page must be the
 *  publisher's (short pages after the last of theirs are figure descriptions or notes, and all below the mark
 *  folds), and one short unmarked page between two of theirs goes with them. Two in a row end it: in a book of
 *  short pages (poems, aphorisms) they are the text, and a page far up that reads as the publisher's is not the
 *  start of its end. `front` pages are already folded; a page of the book's text must come before the fold, so a
 *  sample that is all publisher's pages is left whole, as the front leaves it. */
export function backPages(pages: PageFacts[], title: string[] = [], front = 0): number {
  let start = pages.length;
  let small = 0;
  let i = pages.length - 1;
  for (; i > front; i--) {
    const kind = pageKind(pages[i]!, title, true);
    if (kind === "fold") (start = i), (small = 0);
    else if (kind !== "small" || start === pages.length || ++small > 1) break;
  }
  // `i` is the page that ended it. Stopped only by running out of pages, or by short pages alone: no text was seen.
  const text = pages.slice(front, start).some((p) => ["text", "long"].includes(pageKind(p, title, true)));
  return text ? start : pages.length;
}
