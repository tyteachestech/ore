import { afterAll, beforeAll, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REWRITTEN } from "../eval/ask.ts";
import { addSource, addText } from "../src/ingest/index.ts";
import { tempLibrary } from "./helpers.ts";

// Golden imports (D122): one saved example of each kind of source, and the whole doc.md Ore makes
// from it, kept in test/golden/. intake.test.ts checks the parts a learner needs; this catches any
// other change to what comes in, so import quality can't slip without a diff in the PR.
// After a change you mean, rewrite them with `bun run golden:update` and read the diff.

const FIX = join(import.meta.dir, "fixtures/intake");
const GOLDEN = join(import.meta.dir, "golden");
const UPDATE = process.env.ORE_UPDATE_GOLDEN === "1";

// The desktop tests leave happy-dom's globals behind; the CLI, where intake runs, has none (intake.test.ts).
const g = globalThis as Record<string, unknown>;
const leaked = { window: g.window, getComputedStyle: g.getComputedStyle };
const realFetch = globalThis.fetch;
const realPath = process.env.PATH;
beforeAll(() => {
  delete g.window;
  delete g.getComputedStyle;
  // yt-dlp prints the saved video's info; its captions are served below.
  const bin = mkdtempSync(join(tmpdir(), "ore-ytdlp-"));
  writeFileSync(join(bin, "yt-dlp"), `#!/bin/sh\ncat '${join(FIX, "video/talk.info.json")}'\n`);
  chmodSync(join(bin, "yt-dlp"), 0o755);
  process.env.PATH = `${bin}:${realPath}`;
});
afterAll(() => {
  for (const [k, v] of Object.entries(leaked)) if (v) g[k] = v;
  globalThis.fetch = realFetch;
  process.env.PATH = realPath;
});

/** Serves saved files by URL; anything else (a page's images) is a 404. */
function serve(pages: Record<string, [file: string, type: string]>) {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const p = pages[String(input instanceof Request ? input.url : input)];
    return p ? new Response(readFileSync(join(FIX, p[0])), { headers: { "content-type": p[1] } }) : new Response("not found", { status: 404 });
  }) as typeof fetch;
}

const HTML = "text/html; charset=utf-8";
// Each golden doc is also a source in the Ask eval (eval/ask.ts): a new one on the same topic as a
// question there can crowd out that question's evidence, so pick a fixture's subject apart from theirs.
// A page whose markup is kept and words rewritten (rewrite-page.ts) is marked `rewritten`: its random
// learning words would crowd out every question's evidence, so the eval leaves it out (REWRITTEN).
const CASES: { name: string; add: string; serve?: Record<string, [string, string]>; rewritten?: true; paste?: true }[] = [
  { name: "pdf-hazards", add: join(FIX, "files/hazards.pdf") }, // footnotes, powers, hyphens, running heads
  { name: "pdf-outline", add: join(FIX, "files/outline.pdf") }, // the PDF outline as chapters
  { name: "pdf-textbook", add: join(FIX, "files/textbook.pdf") }, // margin notes, numbered headings, lists
  { name: "pdf-figures", add: join(FIX, "files/figures.pdf") },
  { name: "pdf-scripts", add: join(FIX, "files/scripts.pdf") }, // Russian, Greek, Japanese, Chinese, Arabic
  { name: "pdf-code", add: join(FIX, "files/code.pdf") }, // code blocks and typewriter words (make-code-pdf.py)
  { name: "epub", add: join(FIX, "files/book.epub") }, // make-book-epub.ts
  { name: "word", add: join(FIX, "files/notes.docx") },
  { name: "powerpoint", add: join(FIX, "files/deck.pptx") },
  { name: "rtf-textedit", add: join(FIX, "files/textedit.rtf") },
  { name: "rtf-word", add: join(FIX, "files/word.rtf") },
  { name: "excel", add: join(FIX, "files/vocab.xlsx") },
  { name: "csv", add: join(FIX, "files/verbs.csv") },
  { name: "notebook", add: join(FIX, "files/numpy.ipynb") },
  { name: "youtube-auto-captions", add: "https://www.youtube.com/watch?v=oreGolden01", serve: { "https://captions.test/talk.en.vtt": ["video/talk.en.vtt", "text/vtt"] } },
  // Wikipedia (CC BY-SA 4.0) and the Python docs (PSF License) may be shared.
  { name: "web-wikipedia", add: "https://en.wikipedia.org/wiki/Spaced_repetition", serve: { "https://en.wikipedia.org/wiki/Spaced_repetition": ["web/wikipedia.html", HTML] } },
  { name: "web-hn-thread", add: "https://news.ycombinator.com/item?id=11408447", serve: { "https://news.ycombinator.com/item?id=11408447": ["web/hn-thread.html", HTML] }, rewritten: true },
  { name: "web-speakerdeck", add: "https://speakerdeck.com/jennybc/how-to-name-files", serve: { "https://speakerdeck.com/jennybc/how-to-name-files": ["web/speakerdeck.html", HTML] }, rewritten: true },
  { name: "web-discourse", add: "https://meta.discourse.org/t/discourse-new-user-guide/96331", serve: { "https://meta.discourse.org/t/discourse-new-user-guide/96331": ["web/discourse-topic.html", HTML] }, rewritten: true },
  // A ChatGPT answer pasted as HTML (ore add --stdin --html), written for Ore in the shape its page copies.
  { name: "pasted-chatgpt", add: join(FIX, "files/chatgpt-copy.html"), paste: true, serve: { "https://images.example.org/starter-rise.png": ["files/screenshot.png", "image/png"] } },
  { name: "web-python-docs", add: "https://docs.python.org/3/tutorial/classes.html", serve: { "https://docs.python.org/3/tutorial/classes.html": ["web/docs-python.html", HTML] } },
];

test("golden: the Ask eval leaves out exactly the pages whose words were rewritten", () => {
  expect(CASES.filter((c) => c.rewritten).map((c) => c.name).sort()).toEqual([...REWRITTEN].sort());
});

for (const c of CASES)
  test(`golden: ${c.name}`, async () => {
    if (c.serve) serve(c.serve);
    const item = c.paste ? await addText(await tempLibrary(), readFileSync(c.add, "utf8"), { html: true }) : await addSource(await tempLibrary(), c.add);
    // Only the id and the time of capture change from run to run.
    const doc = readFileSync(join(item.dir, "doc.md"), "utf8")
      .replace(/^id: .+$/m, "id: <id>")
      .replace(/^captured_at: .+$/m, "captured_at: <time>");
    const path = join(GOLDEN, `${c.name}.md`);
    if (UPDATE) writeFileSync(path, doc);
    else if (!existsSync(path)) throw new Error(`No golden file for ${c.name}: run \`bun run golden:update\` and commit test/golden/${c.name}.md`);
    // On a failure: read the diff. A change you meant is saved with `bun run golden:update`.
    expect(doc).toBe(readFileSync(path, "utf8"));
  });
