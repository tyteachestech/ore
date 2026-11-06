// Live import check (`bun run intake:live`): adds real links of every content type to a scratch
// library and prints what each kept, so a site that changed its pages shows up. Needs the network,
// so it is not part of `bun test`; the saved-page tests in test/intake.test.ts are. Run it before a
// release or when an import looks wrong, and update the fixtures when a site changes for good.
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addSource } from "../src/ingest/index.ts";
import { initLibrary } from "../src/init.ts";

/** One real link per content type, and what it must at least yield. Refused links name their message. */
const LINKS: { type: string; url: string; minWords?: number; refused?: RegExp }[] = [
  { type: "Essay", url: "https://paulgraham.com/greatwork.html", minWords: 10000 },
  { type: "Blog with diagrams", url: "https://lilianweng.github.io/posts/2023-06-23-agent/", minWords: 5000 },
  { type: "Docs (Python)", url: "https://docs.python.org/3/tutorial/classes.html", minWords: 4500 },
  { type: "Docs (MDN)", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures", minWords: 2500 },
  { type: "Docs (React)", url: "https://react.dev/learn/thinking-in-react", minWords: 2000 },
  { type: "Wikipedia", url: "https://en.wikipedia.org/wiki/Spaced_repetition", minWords: 3000 },
  { type: "Blog with footnotes", url: "https://waitbutwhy.com/2015/01/artificial-intelligence-revolution-1.html", minWords: 7000 },
  { type: "Substack", url: "https://www.astralcodexten.com/p/the-psychopolitics-of-trauma", minWords: 5000 },
  { type: "Tutorial", url: "https://www.freecodecamp.org/news/git-and-github-for-beginners/", minWords: 2500 },
  { type: "Forum thread", url: "https://news.ycombinator.com/item?id=38309611", minWords: 10000 },
  { type: "GitHub repo", url: "https://github.com/open-spaced-repetition/ts-fsrs", minWords: 200 },
  { type: "GitHub file", url: "https://github.com/open-spaced-repetition/fsrs4anki/blob/main/README.md", minWords: 500 },
  { type: "Notebook (nbviewer)", url: "https://nbviewer.org/github/jakevdp/PythonDataScienceHandbook/blob/master/notebooks/05.02-Introducing-Scikit-Learn.ipynb", minWords: 2000 },
  { type: "arXiv abstract", url: "https://arxiv.org/abs/1706.03762", minWords: 4500 },
  { type: "PDF paper", url: "https://arxiv.org/pdf/1706.03762", minWords: 5000 },
  { type: "EPUB", url: "https://www.gutenberg.org/ebooks/1342.epub3.images", minWords: 100000 },
  { type: "YouTube video", url: "https://www.youtube.com/watch?v=kCc8FmEb1nY", minWords: 15000 },
  { type: "TED talk", url: "https://www.ted.com/talks/sir_ken_robinson_do_schools_kill_creativity", minWords: 2500 },
  { type: "Page with a video", url: "https://www.dwarkesh.com/p/andrej-karpathy", minWords: 20000 },
  { type: "Speaker Deck", url: "https://speakerdeck.com/jennybc/how-to-name-files", minWords: 800 },
  { type: "Bot check", url: "https://www.khanacademy.org/science/biology/gene-expression-central-dogma/transcription-of-dna-into-rna/a/overview-of-transcription", refused: /bot check|almost no text|wouldn’t let/ },
  { type: "X post", url: "https://x.com/karpathy/status/1617979122625712128", refused: /signed-in/ },
  { type: "Spotify episode", url: "https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk", refused: /Spotify keeps/ },
  { type: "Podcast feed", url: "https://feeds.megaphone.fm/hubermanlab", refused: /feed/ },
  { type: "YouTube playlist", url: "https://www.youtube.com/playlist?list=PLAqhIrjkxbuWI23v9cThsA9GvCAUhRvKZ", refused: /course/ },
];

const root = mkdtempSync(join(tmpdir(), "ore-intake-live-"));
await initLibrary(root);
const lib = { root };
let bad = 0;
for (const l of LINKS) {
  const t0 = Date.now();
  const r = await addSource(lib, l.url).then((item) => ({ item }), (e: Error) => ({ error: e.message }));
  const ms = `${((Date.now() - t0) / 1000).toFixed(1)}s`;
  if ("error" in r) {
    const ok = !!l.refused?.test(r.error);
    if (!ok) bad++;
    console.log(`${ok ? "ok  " : "FAIL"} ${l.type.padEnd(20)} refused: ${r.error.slice(0, 110)} (${ms})`);
    continue;
  }
  const b = r.item.body;
  const words = b.split(/\s+/).filter((w) => /\w/.test(w)).length;
  const n = (re: RegExp) => (b.match(re) ?? []).length;
  const ok = !l.refused && words >= (l.minWords ?? 0);
  if (!ok) bad++;
  const files = readdirSync(r.item.dir).join(" ");
  console.log(`${ok ? "ok  " : "FAIL"} ${l.type.padEnd(20)} ${r.item.meta.type} · ${words} words · ${n(/^#{1,6} /gm)} headings · ${n(/!\[/g)} images · ${n(/^```/gm) / 2} code · “${r.item.meta.title.slice(0, 40)}” · ${r.item.meta.author ?? "no author"} · ${r.item.meta.published ?? "no date"} · ${files} (${ms})`);
}
console.log(`\n${LINKS.length - bad} of ${LINKS.length} as expected. Library: ${root}`);
process.exit(bad ? 1 : 0);
