import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The intake grid (D96): every content type Ore imports, against every way an import goes wrong.
// Each cell names the test that covers it (a unique part of its title), or says "n/a" (the type can't
// have it) or "gap: why" (a known hole, so it is seen, not forgotten). A new type gets a row, a new
// hazard gets a column, and an empty cell or a test name that matches nothing fails here.
// When an import bug turns up, its test fills the cell it fell through. What to fill next: grep "gap:" here.

const HAZARDS = [
  "title", // the content's own title, never the site's name, a file name or a tool's default
  "author",
  "date",
  "text", // the whole thing, phrases from start to end
  "headings",
  "images",
  "code",
  "tables",
  "math",
  "language", // text in another script: Arabic, Russian, Japanese
  "junk", // what isn't the content (a wall, a bot check, an empty or broken file) is refused with the next step
] as const;
type Hazard = (typeof HAZARDS)[number];
type Cell = string; // a test title (or a unique part of one), "n/a", or "gap: <why>"
type Row = Record<Hazard, Cell>;

const na = "n/a";
const WEB_JUNK = "a bot check is never saved as the page";
const LANG = "other languages and scripts";
const TABLES = "embedded videos become a link where they stood; tables";

const GRID: Record<string, Row> = {
  // Web pages
  Essay: { title: "essay", author: "gap: Paul Graham's pages name no author the extractor reads", date: na, text: "essay", headings: na, images: na, code: na, tables: na, math: na, language: LANG, junk: WEB_JUNK },
  "Blog with images and code": { title: "blog with diagrams and code", author: "blog with diagrams and code", date: "blog with diagrams and code", text: "blog with two kinds of footnotes", headings: "blog with diagrams and code", images: "a page's images are saved beside it", code: "blog with diagrams and code", tables: TABLES, math: "inline math becomes", language: LANG, junk: WEB_JUNK },
  "Docs site": { title: "docs with code (MDN)", author: na, date: "docs with code (MDN)", text: "docs with code (Python)", headings: "docs with code (Python)", images: na, code: "docs with code (Python)", tables: "a <table> shown as code stays code", math: na, language: LANG, junk: WEB_JUNK },
  Wikipedia: { title: "Wikipedia", author: "Wikipedia", date: "Wikipedia", text: "Wikipedia", headings: "Wikipedia", images: "Wikipedia", code: na, tables: "a table nested in a cell", math: "gap: no saved page with Wikipedia's MathML formulas", language: LANG, junk: WEB_JUNK },
  Newsletter: { title: "newsletter (Substack)", author: "newsletter (Substack)", date: "newsletter (Substack)", text: "newsletter (Substack)", headings: "newsletter (Substack)", images: "newsletter (Substack)", code: na, tables: na, math: na, language: LANG, junk: WEB_JUNK },
  Tutorial: { title: "tutorial", author: "tutorial", date: "tutorial", text: "tutorial", headings: "tutorial", images: "tutorial", code: "tutorial", tables: na, math: na, language: LANG, junk: WEB_JUNK },
  "Forum thread": { title: "gap: checked live only (intake:live, Hacker News)", author: na, date: na, text: "gap: checked live only (intake:live, Hacker News)", headings: na, images: na, code: na, tables: na, math: na, language: LANG, junk: WEB_JUNK },
  "Page built in the browser (Notion)": { title: "a page built in the browser (Notion) comes in as its visible text", author: na, date: na, text: "a page built in the browser (Notion) comes in as its visible text", headings: "gap: the tab's visible text keeps no headings", images: "gap: the tab's visible text keeps no images", code: na, tables: na, math: na, language: LANG, junk: "a page built in the browser (Notion) says to paste it" },
  "Signed-in page (Medium, NYT, X, Reddit)": { title: "a signed-in article comes in from the tab's HTML", author: "gap: not checked on a tab capture", date: "gap: not checked on a tab capture", text: "a signed-in article comes in from the tab's HTML", headings: na, images: na, code: na, tables: na, math: na, language: LANG, junk: "links Ore can't read yet say why at once" },
  "arXiv paper": { title: "arXiv abstract link", author: "gap: the paper's authors aren't checked", date: na, text: "arXiv abstract link", headings: "arXiv abstract link", images: "arXiv abstract link", code: na, tables: na, math: "arXiv abstract link", language: na, junk: WEB_JUNK },
  "GitHub repo or file": { title: "GitHub file link reads the raw file", author: "GitHub repo reads its README", date: na, text: "GitHub repo reads its README", headings: "GitHub file link reads the raw file", images: "GitHub repo reads its README", code: "GitHub file link reads the raw file", tables: na, math: na, language: LANG, junk: "a link that isn't the web, or is cut off" },
  "Google Docs and Slides": { title: "nbviewer and Google links", author: "Word: headings, lists, tables, title and author", date: na, text: "nbviewer and Google links", headings: "Word: headings, lists, tables, title and author", images: "Word: images are saved with the source", code: na, tables: "Word: headings, lists, tables, title and author", math: na, language: na, junk: "gap: a private doc's sign-in page isn't checked" },
  "Course page and lessons": { title: "lessons come in page order", author: "course page: junk metadata is dropped", date: "course page: junk metadata is dropped", text: "holds the lesson page's text and the video's transcript", headings: na, images: "the course page's own picture becomes the course's cover", code: na, tables: na, math: na, language: na, junk: "lessons come in page order, once each, without the start button" },
  "Page with a video": { title: "keeps the page's text, then the transcript", author: na, date: na, text: "keeps the page's text, then the transcript", headings: na, images: na, code: na, tables: na, math: na, language: na, junk: "a page that only wraps its video is the video" },
  "Saved web page (.html file)": { title: "a title is one line", author: na, date: na, text: "a title is one line", headings: na, images: "gap: a saved page's local images aren't saved", code: na, tables: na, math: na, language: LANG, junk: "a text file with no extension is read; a binary one" },
  "Slides online (Speaker Deck)": { title: "gap: checked live only (intake:live)", author: na, date: na, text: "gap: checked live only (intake:live)", headings: na, images: "gap: slide images aren't kept", code: na, tables: na, math: na, language: na, junk: WEB_JUNK },
  "RSS or Atom feed (Follow)": { title: "Atom: title, site, posts newest first", author: "RSS 2.0: CDATA titles, dc:creator", date: "RSS 2.0: CDATA titles, dc:creator", text: "opening reads it without listing it", headings: na, images: "Atom: title, site, posts newest first", code: na, tables: na, math: na, language: na, junk: "finds the feed a page names" },

  // Video
  "YouTube video": { title: "YouTube: title, channel and date", author: "YouTube: title, channel and date", date: "YouTube: title, channel and date", text: "VTT rolling captions", headings: "YouTube: title, channel and date", images: "pageImage: og:image first", code: na, tables: na, math: na, language: "gap: only English captions are checked", junk: "links Ore can't read yet say why at once" },
  "Other video sites (TED, Vimeo)": { title: "gap: the title isn't checked", author: "TED (any yt-dlp site)", date: "gap: the date isn't checked", text: "TED (any yt-dlp site)", headings: na, images: na, code: na, tables: na, math: na, language: na, junk: "a near-empty page (a video site's shell) is refused" },
  "YouTube playlist": { title: "Claude Academy courses and lessons and YouTube playlists are courses", author: na, date: na, text: "each lesson becomes a source in course order", headings: na, images: na, code: na, tables: na, math: na, language: na, junk: "links Ore can't read yet say why at once" },

  // Audio
  "Podcast episode (Apple Podcasts)": { title: "an Apple Podcasts episode", author: "an Apple Podcasts episode", date: "an Apple Podcasts episode", text: "an Apple Podcasts episode", headings: na, images: na, code: na, tables: na, math: na, language: "gap: transcription in other languages isn't checked", junk: "a podcast feed asks for one episode" },
  "Episode page (other players)": { title: "another player's episode page", author: "another player's episode page", date: "gap: the date isn't checked", text: "an audio file becomes a timed transcript", headings: na, images: na, code: na, tables: na, math: na, language: "gap: transcription in other languages isn't checked", junk: "links Ore can't read yet say why at once" },
  "Audio link or file": { title: "an audio link is titled by its own file name", author: na, date: na, text: "an audio file becomes a timed transcript", headings: na, images: na, code: na, tables: na, math: na, language: "gap: transcription in other languages isn't checked", junk: "an older macOS and silence each say what to do" },

  // Files
  PDF: { title: "PDF: title from page 1", author: "gap: a PDF's author isn't checked", date: na, text: "PDF: a textbook page without its margin notes", headings: "PDF: title from page 1", images: "gap: figures aren't kept", code: na, tables: "gap: tables come in as lines of text", math: "gap: formulas come in as plain text", language: "gap: no PDF in another script", junk: "a damaged or locked PDF says what to do" },
  "Scanned PDF": { title: "gap: the title isn't checked", author: na, date: na, text: "a scanned PDF is read page by page", headings: "a scanned PDF is read page by page", images: na, code: na, tables: na, math: na, language: "gap: text recognition in other languages isn't checked", junk: "an image with no text is refused" },
  EPUB: { title: "epub file → chapters in spine order", author: "epub file → chapters in spine order", date: na, text: "epub file → chapters in spine order", headings: "epub file → chapters in spine order", images: "EPUB: illustrations are saved", code: na, tables: na, math: na, language: na, junk: "gap: a damaged EPUB isn't checked" },
  Word: { title: "Word: a never-titled file", author: "Word: headings, lists, tables, title and author", date: na, text: "Word: headings, lists, tables, title and author", headings: "Word: headings, lists, tables, title and author", images: "Word: images are saved with the source", code: na, tables: "Word: headings, lists, tables, title and author", math: na, language: na, junk: "an unreadable file type says which ones work" },
  PowerPoint: { title: "PowerPoint: each slide's title", author: "PowerPoint: each slide's title", date: na, text: "PowerPoint: each slide's title", headings: "PowerPoint: each slide's title", images: "gap: slide images aren't kept", code: na, tables: na, math: na, language: na, junk: "an unreadable file type says which ones work" },
  "Notebook (.ipynb)": { title: "notebook: a # comment in code is not the title", author: na, date: na, text: "notebook: a # comment in code is not the title", headings: "notebook: Markdown cells", images: "gap: plotted output images aren't kept", code: "notebook: Markdown cells", tables: na, math: na, language: na, junk: "an unreadable file type says which ones work" },
  "Subtitles (.srt, .vtt)": { title: "subtitles: a timed transcript", author: na, date: na, text: "subtitles: a timed transcript", headings: na, images: na, code: na, tables: na, math: na, language: na, junk: "an unreadable file type says which ones work" },
  "Markdown or text file": { title: "a # comment in fenced code is not the title", author: "a Markdown note's own frontmatter (Obsidian)", date: "a Markdown note's own frontmatter (Obsidian)", text: "a Markdown note's own frontmatter (Obsidian)", headings: "a Markdown note's own frontmatter (Obsidian)", images: na, code: "a Markdown note's own frontmatter (Obsidian)", tables: na, math: na, language: "text in any encoding an editor saves", junk: "Finder's own files are refused" },
  "Image or screenshot": { title: "a screenshot: its text to read", author: na, date: na, text: "a screenshot: its text to read", headings: "a screenshot: its text to read", images: "a screenshot: its text to read", code: na, tables: na, math: na, language: "gap: text recognition in other languages isn't checked", junk: "an image with no text is refused" },
  "Pasted text": { title: "pasted text → Markdown source titled by its heading", author: "a Markdown note's own frontmatter (Obsidian)", date: "a Markdown note's own frontmatter (Obsidian)", text: "pasted text → Markdown source titled by its heading", headings: na, images: na, code: "a # comment in fenced code is not the title", tables: na, math: na, language: na, junk: "pasted text → Markdown source titled by its heading" },
  "Browser tab": { title: "a signed-in article comes in from the tab's HTML", author: na, date: na, text: "a signed-in article comes in from the tab's HTML", headings: na, images: na, code: na, tables: na, math: na, language: na, junk: "a tab still showing a sign-in says to sign in there" },
};

/** Every test title in core's tests, plus the named cases of table-driven ones (`name: "…"`). */
function titles(): string[] {
  const dir = import.meta.dir;
  const out: string[] = [];
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".test.ts") && f !== "intake-grid.test.ts")) {
    const src = readFileSync(join(dir, f), "utf8");
    for (const m of src.matchAll(/\btest\(\s*(["'`])((?:\\.|(?!\1).)*)\1/g)) out.push(m[2]!.replace(/\\(.)/g, "$1"));
    for (const m of src.matchAll(/\bname: "((?:\\.|[^"])*)"/g)) out.push(m[1]!.replace(/\\(.)/g, "$1"));
  }
  return out;
}

describe("intake grid", () => {
  const all = titles();

  test("every content type has a cell for every hazard", () => {
    const empty = Object.entries(GRID).flatMap(([type, row]) => HAZARDS.filter((h) => !row[h]?.trim()).map((h) => `${type} × ${h}`));
    expect(empty).toEqual([]);
  });

  test("every cell names one test that exists, or says n/a or gap: why", () => {
    const bad: string[] = [];
    for (const [type, row] of Object.entries(GRID))
      for (const h of HAZARDS) {
        const c = row[h];
        if (c === na || /^gap: \S/.test(c)) continue;
        const hits = all.filter((t) => t === c).length || all.filter((t) => t.includes(c)).length;
        if (hits !== 1) bad.push(`${type} × ${h}: "${c}" matches ${hits} tests`);
      }
    expect(bad).toEqual([]);
  });
});
