import { join } from "node:path";

// The golden sources (golden.test.ts), shared with Ore Cloud's server test (packages/cloud), which must read
// each one into the same doc.md as the Mac (#549).
export const FIX = join(import.meta.dir, "fixtures/intake");

const HTML = "text/html; charset=utf-8";
// Each golden doc is also a source in the Ask eval (eval/ask.ts): a new one on the same topic as a
// question there can crowd out that question's evidence, so pick a fixture's subject apart from theirs.
// A page whose markup is kept and words rewritten (rewrite-page.ts) is marked `rewritten`: its random
// learning words would crowd out every question's evidence, so the eval leaves it out (REWRITTEN).
export const CASES: { name: string; add: string; serve?: Record<string, [string, string]>; rewritten?: true; paste?: true }[] = [
  { name: "pdf-hazards", add: join(FIX, "files/hazards.pdf") }, // footnotes, powers, hyphens, running heads
  { name: "pdf-outline", add: join(FIX, "files/outline.pdf") }, // the PDF outline as chapters
  { name: "pdf-textbook", add: join(FIX, "files/textbook.pdf") }, // margin notes, numbered headings, lists
  { name: "pdf-glossary", add: join(FIX, "files/glossary.pdf") }, // a margin glossary's definitions (make-glossary-pdf.py)
  { name: "pdf-figures", add: join(FIX, "files/figures.pdf") },
  { name: "pdf-map-soft-mask", add: join(FIX, "files/persian-wars-map.pdf") },
  { name: "pdf-scripts", add: join(FIX, "files/scripts.pdf") }, // Russian, Greek, Japanese, Chinese, Arabic
  { name: "pdf-code", add: join(FIX, "files/code.pdf") }, // code blocks and typewriter words (make-code-pdf.py)
  { name: "epub", add: join(FIX, "files/book.epub") }, // make-book-epub.ts
  { name: "office-word-merged", add: join(FIX, "office/word-merged.docx") },
  { name: "office-rtf-cp1251", add: join(FIX, "office/rtf-cp1251.rtf") },
  { name: "office-slides-table", add: join(FIX, "office/slides-table.pptx") },
  { name: "office-sheets-formula", add: join(FIX, "office/sheets-formula.xlsx") },
  { name: "office-sheets-time", add: join(FIX, "office/sheets-time.xlsx") },
  { name: "office-notebook-attachment", add: join(FIX, "office/notebook-attachment.ipynb") },
  { name: "office-notebook-error", add: join(FIX, "office/notebook-error.ipynb") },
  { name: "office-notebook-html", add: join(FIX, "office/notebook-html.ipynb") },
  { name: "office-notebook-order", add: join(FIX, "office/notebook-order.ipynb") },
  { name: "office-text-relative", add: join(FIX, "office/text-relative.md") },
  { name: "office-word-outline", add: join(FIX, "office/word-outline.docx") },
  { name: "office-word-outline-after-plain", add: join(FIX, "office/word-outline-after-plain.docx") },
  { name: "office-notebook-cell-attachments", add: join(FIX, "office/notebook-cell-attachments.ipynb") },
  { name: "office-text-reference", add: join(FIX, "office/text-reference.md") },
  { name: "epub-front-matter", add: join(FIX, "files/front-matter.epub") }, // make-study-epubs.ts: a publisher's pages before the text, marked
  { name: "word", add: join(FIX, "files/notes.docx") },
  { name: "powerpoint", add: join(FIX, "files/deck.pptx") },
  { name: "rtf-textedit", add: join(FIX, "files/textedit.rtf") },
  { name: "rtf-word", add: join(FIX, "files/word.rtf") },
  { name: "excel", add: join(FIX, "files/vocab.xlsx") },
  { name: "csv", add: join(FIX, "files/verbs.csv") },
  { name: "notebook", add: join(FIX, "files/numpy.ipynb") },
  { name: "youtube-auto-captions", add: "https://www.youtube.com/watch?v=oreGolden01", serve: { "https://captions.test/talk.en.vtt": ["video/talk.en.vtt", "text/vtt"] } },
  { name: "podcast-player-date", add: "https://overcast.fm/+Sundial", serve: { "https://overcast.fm/+Sundial": ["audio/player-date.html", HTML], "https://audio.test/sundial.wav": ["audio/sundial.wav", "audio/wav"] } },
  { name: "podcast-publisher-language", add: "https://workshop.test/episodes/sundial", serve: { "https://workshop.test/episodes/sundial": ["audio/episode-language.html", HTML], "https://audio.test/sundial.wav": ["audio/sundial.wav", "audio/wav"] } },
  { name: "podcast-player-language", add: "https://pca.st/episode/sundial", serve: { "https://pca.st/episode/sundial": ["audio/episode-language.html", HTML], "https://audio.test/sundial.wav": ["audio/sundial.wav", "audio/wav"] } },
  // Wikipedia (CC BY-SA 4.0) and the Python docs (PSF License) may be shared.
  { name: "web-wikipedia", add: "https://en.wikipedia.org/wiki/Spaced_repetition", serve: { "https://en.wikipedia.org/wiki/Spaced_repetition": ["web/wikipedia.html", HTML] } },
  { name: "web-hn-thread", add: "https://news.ycombinator.com/item?id=11408447", serve: { "https://news.ycombinator.com/item?id=11408447": ["web/hn-thread.html", HTML] }, rewritten: true },
  { name: "web-speakerdeck", add: "https://speakerdeck.com/jennybc/how-to-name-files", serve: { "https://speakerdeck.com/jennybc/how-to-name-files": ["web/speakerdeck.html", HTML] }, rewritten: true },
  { name: "web-discourse", add: "https://meta.discourse.org/t/discourse-new-user-guide/96331", serve: { "https://meta.discourse.org/t/discourse-new-user-guide/96331": ["web/discourse-topic.html", HTML] }, rewritten: true },
  { name: "web-academy-lesson", add: "https://academy.claude.com/courses/ai-fluency-framework-foundations/introduction-to-ai-fluency", serve: { "https://academy.claude.com/courses/ai-fluency-framework-foundations/introduction-to-ai-fluency": ["web/academy-lesson.html", HTML], "https://academy.claude.com/assets/v1/content/courses/ai-fluency-framework-foundations/lessons/01-introduction-to-ai-fluency/index-lyovv4rv.js": ["web/academy-lesson.js", "text/javascript"], "https://captions.test/talk.en.vtt": ["video/talk.en.vtt", "text/vtt"] }, rewritten: true },
  // A ChatGPT answer pasted as HTML (ore add --stdin --html), written for Ore in the shape its page copies.
  { name: "pasted-chatgpt", add: join(FIX, "files/chatgpt-copy.html"), paste: true, serve: { "https://images.example.org/starter-rise.png": ["files/screenshot.png", "image/png"] } },
  { name: "web-python-docs", add: "https://docs.python.org/3/tutorial/classes.html", serve: { "https://docs.python.org/3/tutorial/classes.html": ["web/docs-python.html", HTML] } },
];
