# Languages sweep

Tested the Mac release page on 1733/1734 and the iPhone page on 1735 in the supplied WebKit server. Wrote ten original fixtures (Japanese, Chinese, Korean, Arabic, Hebrew, Hindi, Thai, Vietnamese, Greek, emoji/math), each as HTML, Markdown, PDF and EPUB. Imported all 40 through each app's file picker; each accepted 39 and refused Thai HTML. Checked the saved Mac documents against the fixture manifest, read every script on both layouts, tested library search and source Find, mouse highlighting, Japanese/Thai word selection, source cuts and reopening, ten hand-written exercises and recorded ratings, multilingual skill names, and simulated composition-key handling on both pages. **Limits:** HTML was a saved web page, not a public URL/network-fetch test. The phone is a touch-sized WebKit page, not an iPhone simulator or physical device. Native Japanese IME candidates, the iOS software keyboard and native long-press selection handles are **unverified**. Phone selection handling was exercised with a DOM selection followed by real taps. PDF fixtures use native CoreText; their Japanese PDF has plain prose, not ruby. No AI ran. No application code or shared findings file changed.

All paths below are relative to `codex-out/languages/` unless a repo path is stated. Fixtures are original CC0 test text; `fixtures/manifest.json` holds the expected strings. `import-matrix.md` summarizes all 40 format cases. Screenshots are at 2× resolution.

## Findings, most severe first

### L1 — Korean PDF is accepted with all Korean body text missing

**S1 · Mac and iPhone · 3/3 extraction paths:** Mac file import, independent repeat through `pdfToDoc`, and phone file import. Reimport in the Mac UI reports that the source is up to date.

1. From a fresh Mac page, press ⌘O and select `fixtures/ko.pdf`. On the phone, use + → Choose a file or photo.
2. Open **한국어의 작은 정원**, identifying the PDF on Mac.
3. Read its body or search for `고양이`.

**Expected:** the full Korean lesson, including its headings and final sentence. **Actual:** the correct title and author surround a body containing only punctuation and list numbers: `. . .`, `. . .`, `1. . . . 2. . . .`. Import reports success. The phone's thumbnail also contains only faint punctuation. The source is unusable for reading, highlighting or exercise generation.

The original is visually readable, and Poppler extracts the complete Korean text from the same file (`fixtures/ko-pdftotext.txt`). This is not a scan or a missing-text fixture. `ko-pdfjs.json` shows that pdf.js already returns only punctuation; `ko-pdf-repeat.json` confirms Ore accepts it.

**Evidence:** `screenshots/fixture-ko.png`, `screenshots/korean-pdf.png`, `screenshots/phone-korean-pdf.png`; `import-audit.json`.

**Suspect:** `packages/core/src/ingest/pdf.ts:431` (`getDocument` configuration, including missing CMap configuration; hypothesis), and `:632` (the readable-text check counts punctuation toward its 20-character threshold).

### L2 — Hebrew PDF words are saved in the wrong order

**S1 · Mac; same importer also used by phone · 2/2:** Mac import and independent `pdfToDoc` repeat. Phone imported this PDF in the first batch, but its PDF reading-order output was not separately captured.

1. Import `fixtures/he.pdf` and open **גן קטן לקריאה**.
2. Compare the heading and first sentence with the original PDF or `fixtures/he.md`.
3. Search inside the source for the original opening phrase `בבוקר שקט חתול`.

**Expected:** logical Hebrew word order, with English and numbers remaining attached to the correct phrases. **Actual:** the source body begins `לקריאה קטן גן`, then `בגן בוקר`. The first sentence begins `.יום בכל חדש ספר וקוראת עברית לומדת אני...` instead of `בבוקר שקט חתול הולך בגן...`. This changes the stored words' order; changing CSS direction alone cannot repair it.

**Evidence:** `screenshots/fixture-he.png`, `screenshots/hebrew-pdf.png`, `he-pdfjs.json`, `he-pdf-repeat.json`, the Hebrew PDF entry in `import-audit.json`.

**Suspect:** `packages/core/src/ingest/pdf.ts:140` (`pageLines` concatenates returned text items), and `:579` onward (pdf.js items carry `dir: "rtl"`, but the line-building representation does not use that direction to reconstruct reading order).

### L3 — Arabic and Hebrew lose their language and right-to-left direction

**S2 · Mac and iPhone · reproduced in both languages and multiple formats.**

1. Import `fixtures/ar.html` and `fixtures/he.epub`. Both explicitly declare language and RTL direction. The Markdown fixtures declare `lang` and `dir` too.
2. Open the source; read the paragraph containing `Ore 2026` and `12`.
3. Read its numbered list and reopen it.

**Expected:** RTL paragraphs and lists, correct placement of mixed English/numbers and punctuation, and preserved content language. **Actual:** the reader's paragraphs and lists inherit `direction: ltr`; the article has no language. List numbers remain on the left. In Arabic, the text around `Ore 2026` appears in the wrong visual sequence, with punctuation displaced. Both phone and Mac show this. Mac `doc.md` files retain neither language nor direction across all 39 successful imports.

**Evidence:** `screenshots/arabic-reader.png`, `screenshots/phone-arabic.png`, `screenshots/read-he.png`, `screenshots/phone-read-he.png`; `reading.json`, `phone-reading.json`, `import-audit.json`.

**Suspect:** metadata returned by `packages/core/src/ingest/web.ts:9` and `:378`, `ingest/epub.ts:120`, and `ingest/index.ts:60`; `apps/desktop/src/Reader.tsx:543` renders `<article className="doc">` without language/direction. The `dir` value passed elsewhere in Reader is a filesystem directory, not an HTML direction.

### L4 — Thai web pages without word spaces are rejected as nearly empty

**S2 · Mac and iPhone · 4/4:** first Mac batch, second individual Mac import, first phone batch, and a repeat in the fresh phone context.

1. Import `fixtures/th.html` using the file picker.
2. Read the refusal.
3. Import `fixtures/th.md` or `fixtures/th.epub` containing the same lesson.

**Expected:** import the substantial Thai lesson. **Actual:** HTML is refused as **“Found almost no text on th (10 words)”**, with advice about a browser-built page or sign-in. The page is static and contains the complete text. Markdown and EPUB import it. Phone says the Mac will try it, but the Mac also refuses it.

**Evidence:** `screenshots/import-batch.png`, `screenshots/thai-refused-repeat.png`, `screenshots/phone-thai-refusal.png`; missing `th/html` entry in `import-audit.json`.

**Suspect:** `packages/core/src/ingest/check.ts:9–18` counts Han/kana characters individually but otherwise splits only on whitespace, then applies `MIN_WORDS = 50`.

### L5 — Library search misses words inside Japanese, Chinese and Thai prose

**S2 · Mac and iPhone · repeated on both platforms.**

1. Import the Japanese, Chinese and Thai Markdown fixtures into a fresh library/page.
2. Search the library for `勉強`, `学习`, and `ภาษาไทย` (on phone, `เรียนภาษาไทย` is another verified miss).
3. Open the corresponding source and use Find for the same word.

**Expected:** sources containing the words appear in library search. **Actual:** Mac says nothing matches; phone's command search says **No matches**. Source Find locates the literal words. The earlier title queries `日本語`, `中文`, and `한국어` worked, so title-only checks conceal this gap. A separately saved highlight beginning with the searched word can make that source discoverable, which is why reproduction should start before making highlights.

**Evidence:** `library-search.json`, `search-repeat.json`, `phone-search.json`; `screenshots/search-repeat-1.png`, `screenshots/search-repeat-3.png`, `screenshots/search-repeat-5.png`, `screenshots/phone-search-1.png` through `phone-search-3.png`; successful source Find counts in `reading.json`.

**Suspect:** `packages/core/src/db.ts:25` uses default FTS5 tokenization; `:133–140` searches token prefixes, with no word segmentation for unspaced scripts.

### L6 — Visually identical combining-accent text searches differently

**S2 · Mac and iPhone · 2 Mac passes plus phone confirmation.**

1. Import `fixtures/el.md`.
2. Search the library for composed `άλφα` (U+03AC), then decomposed `άλφα` (U+03B1 + U+0301). Copy both from the fixture to preserve the exact encoding.
3. Open the source and repeat in Find. Each paragraph deliberately contains both spellings, which look the same.

**Expected:** canonically equivalent Unicode strings find the same text. **Actual:** composed library search finds the lesson; decomposed search reports no matches, despite the source containing that exact spelling. In source Find, each spelling matches only its own three occurrences, rather than all six visually identical occurrences. Vietnamese `cà phê`/`cà phê` similarly splits the source-Find results into three each. Accentless Vietnamese library search (`meo`) works, but source Find (`meo`) does not find `mèo`. Accentless matching is recorded as a behavior difference; the canonical-equivalence failure is the finding.

**Evidence:** `library-search.json`, `search-repeat.json`, `find-variants.json`, `phone-search.json`; `screenshots/search-repeat-9.png`, `screenshots/search-repeat-10.png`, `screenshots/find-el-0.png`, `screenshots/find-el-1.png`, `screenshots/phone-search-4.png`, `screenshots/phone-search-5.png`.

**Suspect:** `packages/core/src/db.ts:136` excludes combining marks (`\p{M}`) from query terms; `apps/desktop/src/Find.tsx:13–31` folds case/whitespace but does not normalize Unicode or map normalized offsets back to source offsets.

### L7 — Japanese ruby is flattened, and a Markdown ruby paragraph disappears

**S2 · Mac and iPhone · repeated across imports/renderers.**

1. Open `fixtures/ja.html` as a reference: the readings above 東京 and 学校 are ruby annotations.
2. Import/open `ja.html` and `ja.epub` in Ore.
3. Import/open `ja.md`, which includes the same valid raw HTML ruby paragraph.

**Expected:** the written words and their readings remain associated and visible. **Actual:** HTML and EPUB flatten ruby to ordinary inline text such as `東京 （ とうきょう ）`. Markdown keeps the raw HTML in canonical `doc.md`, but the reader hides the **entire paragraph**, including `読み方`, 東京 and 学校. Thus a source that looks fully imported loses a language lesson's pronunciation material in the reading view. The source Find query for that hidden Markdown paragraph also cannot reach it.

**Evidence:** `screenshots/original-japanese-ruby.png`, `screenshots/japanese-markdown-ruby-missing.png`, `screenshots/phone-japanese-markdown-ruby-missing.png`; Japanese HTML/Markdown/EPUB entries in `import-audit.json`.

**Suspect:** generic HTML-to-Markdown conversion in `packages/core/src/ingest/markdown.ts:5` and `ingest/web.ts:375`; `apps/desktop/src/Reader.tsx:510` uses `skipHtml`. This needs safe, explicit ruby handling, not enabling arbitrary HTML in the app.

### L8 — Web import removes emoji joiners and changes the symbols

**S2 · Mac and iPhone · 2/2 independent app imports.**

1. Import `fixtures/emoji.html` and `fixtures/emoji.md`.
2. Compare their first paragraphs.
3. Reopen the HTML version and inspect/copy the symbols.

**Expected:** `👩🏽‍🔬` stays a woman scientist and `👨‍👩‍👧‍👦` stays a family. **Actual:** HTML import strips U+200D joiners, storing `👩🏽🔬` and `👨👩👧👦`. Both apps display separate people and objects. Markdown and EPUB retain the joined sequences. This is a stored-content change, not a font fallback problem.

**Evidence:** `import-audit.json` (compare emoji HTML with Markdown/EPUB), `screenshots/phone-read-emoji.png`, `screenshots/highlight-emoji.png` (intact Markdown sequence).

**Suspect:** `packages/core/src/ingest/web.ts:375–378`, where Defuddle's returned Markdown is accepted. The exact upstream cleanup rule was not isolated; EPUB uses a different converter and retains joiners.

## Known rows / excluded observations

- No previously fixed finding was confirmed to have returned.
- F148/F150's known PDF inline-math limits were not re-reported. The fixture's plain Unicode `a² + b² = c²`, inequalities, sums and square root survived in text. This was not a full formula-layout benchmark.
- Plain double-click deliberately selects a sentence (D224); Option-double-click selected Japanese `さくら` and Thai `ภาษา`. This is expected, not a segmentation finding.
- Escape cancels a newly made highlight. Early probe highlights were canceled this way. The persistence pass was repeated with a click elsewhere to keep the highlight; only the later saved annotations support persistence claims.
- The native CoreText Arabic and Hindi PDF exports have problematic text mappings even in Poppler. Their garbled extracted text is recorded in the audit but **not counted as an independently proven Ore extraction bug**. Japanese/Chinese/Thai PDF comparisons also need normalization: several differences are compatibility characters or decomposed forms, not omitted phrases. Vietnamese and Greek PDF phrase checks pass after normalization. PDF headings used the same font size as body text, so failure to infer them is not counted as a heading regression.

## What passed

- All ten Markdown and all ten EPUB files imported on both app pages; nine of ten HTML files imported. All ten PDFs were accepted, subject to the content failures above.
- All 39 accepted Mac sources contain their expected title and author. Every expected heading/start/middle/end phrase survives in all Markdown/EPUB files and in the eight non-emoji accepted HTML language files. Japanese ruby has the rendering limitation above.
- Every script displayed through fallback fonts in the non-PDF reading samples, without observed missing-glyph boxes. Phone sample articles had no horizontal overflow at 390×844. Screenshots: `read-*.png`, `phone-read-*.png`; contact sheets `phone-sheet-0.jpg`/`phone-sheet-1.jpg`.
- Literal source Find worked for the tested word in all ten scripts/topics. Hiragana `さくら` and katakana `サクラ` each found their own text; katakana `ガッコウ` did not match the hiragana reading `がっこう`.
- Mouse drag produced an exact saved highlight in all ten script/topic samples. Korean expanded to the whole word `한국어를`, as the word-snapping rule intends. Joined emoji remained one intact saved sequence.
- Multiline selections and mixed Arabic/Hebrew/English text could be highlighted. All ten final active Mac annotations have offsets that match their exact stored text (`active-anchors.json`). RTL drag endpoints can select a shorter logical range than the intended whole paragraph; no stronger claim about native bidi-selection ergonomics is made.
- Source-cut/reopen checks ran for Japanese, Arabic and Thai. Their final active annotations still match the canonical text; Japanese and Thai final-sentence highlights survive before-text edits and reopening. This is a bounded anchoring check, not a complete reimport/edit matrix for every script. `edit-anchors.json`, `screenshots/after-cut-*.png`, `screenshots/reopened-*.png`.
- Ten distinct Fact exercises were created through the table-cell action from `fixtures/manual-exercises.md`, their questions/answers edited by hand in Review, and each rated Good once. Disk verification found all ten exact questions/answers and one review log entry per exercise (`reviews.json`, `review-audit.json`, `review-log-counts.json`; `screenshots/review-*.png`).
- All ten multilingual skill names were created and survived reload. They remain in the app's existing manual sidebar order; no locale-aware alphabetical sort was available or asserted (`skills.json`, `screenshots/language-skills.png`).
- On phone, a Japanese question and answer were saved through Edit exercise and rated. A typed answer containing all ten fixture answers remained intact on Check; the UI explained that checking runs on the Mac and offered manual marks.
- On both app pages, synthetic composing Enter and Safari-style keyCode 229 events left the answer field active; ordinary Enter added a newline, not a submission (`ime-check.json`, `mac-ime-check.json`). This validates event handling only, not a real IME session.
- Phone's selection-to-highlight flow saved exact Thai `ภาษาไทย` and retained it after leaving/reopening the source, verified read-only in IndexedDB (`phone-saved-evidence.json`, `screenshots/phone-thai-highlight-reopen.png`). The selection itself was injected; native long-press handles remain untested.

## Reproducibility and artifacts

`make-fixtures.cjs` writes HTML/Markdown/EPUB fixtures. `make-pdf.swift` writes the native-text PDFs. `audit-imports.py` and `pdf-probe.ts` are read-only import checks. `browser.cjs` connects to the supplied WebKit endpoint; journey snippets are beside it. The phone's first full 40-file import lived in its original browser context; that context was closed after a stalled test probe. Screenshots/text evidence from it are retained. The second phone context imported all ten Markdown fixtures again for review, selection and search checks. The unused snapshot-injection helper was removed; the phone fixtures were actually added through its file-picker UI.

No tests against `~/Ore`, app install, commit, push, or shared repo edits were performed. This is the requested findings-only handoff.
