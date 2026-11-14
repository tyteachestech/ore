# Intake sweep — 2026-11-14

Tested the Mac release page at `http://localhost:1674/`, with bridge `1675`, in connected WebKit at 1280×800 and 2× resolution. Checkout: `5a44d32222012d39078a9807322e14480c6a2daa`. Covered every requested file category, the listed link categories, duplicate link/file addition, reimport, and cancellation. Synthetic files are in `fixtures/`; creation code, exact inputs, bridge responses, saved-document evidence and screenshots are beside this report. **Seven new S2 findings** are below; each was checked at least twice. No S1 failure or persistent import hang was confirmed. Limitations: the 600-page PDF and slide PDF are simple text fixtures, not complex textbooks/decks; offline was checked with a real DNS failure and a simulated CLI network error, without disconnecting the shared Mac; the Apple/Spotify samples were refused with next steps, so successful podcast transcription was not covered by those links. No iPhone testing, authenticated paywall capture, AI quality testing, or optional Docling installation. No application code or findings registry edits.

## New findings

### I1 — Word code loses its indentation and code formatting

**S2 · Mac · 2/2 independent fixture imports**, plus reopened checks.

1. Open a fresh Mac app page with the supplied bridge setup.
2. Click **+ Add → File**, select `fixtures/office.docx`, and press Enter.
3. In the opened source, scroll below the blue chart and table.
4. Repeat with `fixtures/office-second.docx`.

**Expected:** The document's `SourceCode` paragraph remains a fenced code block, including the four spaces before `return 42`.

**Actual:** `doc.md` contains unfenced prose, `def learn():` followed by a Markdown hard break and unindented `return 42`. The reader displays ordinary body text. The original `word/document.xml` explicitly stores `w:pStyle="SourceCode"` and four preserved spaces. This changes Python syntax and loses code-copy semantics. Both distinct imports reproduce it.

**Evidence:** `shots/word-code.png`, `shots/verify-word-second.png`; `office_docx.json`, `second-office_second_docx.json`; originals and `saved-docs/office-learning*.md`. `fixtures/office.md` is the original Pandoc input.

**Suspect:** `packages/core/src/ingest/office.ts:46` calls Mammoth without a code style map; line 48 converts its result to Markdown. No rule preserves the source's code paragraph here.

### I2 — Word comments silently disappear

**S2 · Mac · 2/2 independent fixture imports.**

1. From a fresh page, add `fixtures/office.docx` through **+ Add → File**.
2. Read the last paragraph, “Commented learning passage.”
3. Look for the associated comment, “COMMENT EVIDENCE: check the study sample.”
4. Repeat with `fixtures/office-second.docx`.

**Expected:** Preserve the teacher/reviewer's comment and its association with the passage, or explain that it cannot be imported. The comment carries material a learner needs to read.

**Actual:** The passage is present but the comment and its marker are missing from both the reader and `doc.md`, with no warning. Both DOCX archives contain `word/comments.xml`, its relationship/content-type entry, and the document's comment-range/reference elements. The footnote survives, so this is specifically comment loss. Tracked insertions survive and tracked deletions are omitted, which is consistent with importing the final revision; that is not reported as a separate bug.

**Evidence:** `shots/verify-word-second.png`; both Office JSON records; `fixtures/office.docx`, `fixtures/office-second.docx`; `saved-docs/office-learning*.md`.

**Suspect:** `packages/core/src/ingest/office.ts:46` uses Mammoth's default conversion without enabling comment references/content.

### I3 — A GitHub source-code file is interpreted as Markdown prose

**S2 · Mac · 2/2 independent fetch paths**, plus an explicit Reimport.

1. Open **+ Add** on a fresh page.
2. Paste `https://github.com/python/cpython/blob/main/Lib/this.py` and press Enter.
3. Scroll to the loops at the end of the file.
4. Repeat using `https://raw.githubusercontent.com/python/cpython/main/Lib/this.py`, or choose **Source actions → Reimport** on the first source.

**Expected:** A fenced Python block preserving lines and indentation, since the input is executable source code rather than a README.

**Actual:** The file is saved as a Markdown source without a code fence. The reader merges `d = {}`, the outer loop, inner loop, and assignment into one prose paragraph. The saved original retains the whitespace, but treating it as Markdown destroys how the learner sees and copies it. Reimport returns `changed: false` and leaves the problem.

**Evidence:** `shots/verify-github-code.png`, `shots/verify-github-code-reimport.png`; `verify-github-code.json`; `saved-docs/this-*.md`. Both exact URLs have corresponding initial JSON records. The Python file is public upstream material; use its license when promoting it into the permanent fixture suite.

**Suspect:** `packages/core/src/ingest/links.ts:23` rewrites every GitHub blob to its raw file; `packages/core/src/ingest/index.ts:357` chooses the reader from the response type, and plain source text follows the Markdown path without a code-language wrapper.

### I4 — A public Google Doc gets its opaque ID as its title

**S2 · Mac · 2/2 fresh imports**, plus reopen and Reimport.

1. Open **+ Add** on a fresh page.
2. Paste `https://docs.google.com/document/d/1OFUY1ASm-HoAL-ney7z5e4-PAuJkvA8EVtaAYSU86b8/edit?usp=sharing` and press Enter.
3. Compare the source heading with the original Google page.
4. For a second actual fetch rather than the already-here shortcut, add the same public document with `?intake_repeat=2` instead of `?usp=sharing`.

**Expected:** **Constitution Study Guide**, the original page's `<title>` and `og:title`.

**Actual:** Both newly created sources are titled `1OFUY1ASm-HoAL-ney7z5e4-PAuJkvA8EVtaAYSU86b8`. The study-guide content imports, but the identifier becomes the source heading and library row. Reimport leaves it unchanged. The visible first body line is also meaningful (“STUDY GUIDE—-GovernmentTest”), unlike the ID.

**Evidence:** `google-original.html` contains the original title; `shots/verify-google-title.png`, `shots/verify-google-title-reimport.png`; `verify-google-title.json`; `verify-https___docs_google_com_document_d_1OFUY1ASm_HoAL_ney7z5e4_PAuJkvA8EVtaAYSU86b8_edit_intake_repeat_2.json`; `saved-docs/1ofuy1asm*.md`.

**Suspect:** `packages/core/src/ingest/links.ts:30` rewrites the Doc to a DOCX export without carrying the page title; `packages/core/src/ingest/index.ts:346` uses the export response's last URL component as the filename, then lines 359–360 pass it as the fallback title. `office.ts:50` can only use DOCX properties/headings, which this export does not supply as its document title.

### I5 — Audio files discard embedded title, author, and chapter labels

**S2 · Mac · reproduced in both M4A and MP3**, with repeat file imports.

1. Open a fresh page and add `fixtures/chaptered.m4a` through **+ Add → File**.
2. Check the title, author, and source structure.
3. Repeat with `fixtures/chaptered.mp3`.
4. Compare with the embedded metadata recorded in `audio-original.json`.

**Expected:** Title **Chaptered Audio Learning**, author/artist **Ore Fixture Author**, and preservation of the original's “Recall chapter” and “Spacing chapter” labels with their time boundaries. This finding does not request a new chapter-recall UI.

**Actual:** Both are titled **Chaptered** from the filename, the author is blank, and neither chapter label appears in `doc.md`. Audio and a timed transcript are retained and the player opens. Transcription errors in the deliberately synthetic speech are not counted as a separate finding.

**Evidence:** `shots/chaptered_m4a.png`, `shots/chaptered_mp3.png`, `shots/verify-audio-mp3.png`; `chaptered_m4a.json`, `chaptered_mp3.json`, `second-chaptered_mp3.json`; `audio-original.json`; `saved-docs/chaptered-*.md`.

**Suspect:** `packages/core/src/ingest/index.ts:133`–139 transcribes bytes and derives the title exclusively from the filename; it does not read embedded metadata or chapter tags.

### I6 — Tall screenshots produce incorrect text that a crop reads correctly

**S2 · Mac · 2/2 imports of the full image**, with a successful crop control.

1. Open a fresh page and add `fixtures/tall.png` through **+ Add → File**. It is a 900×10,000 PNG containing 20 large, high-contrast section markers and an end line.
2. Scroll to its extracted text, below the image.
3. Compare Section 4, Section 6, Section 11, Section 16, and the final sentence with the pixels.
4. Repeat the full-image import, then separately add `fixtures/tall-section4-control.png`, an unscaled crop of exactly the same pixels.

**Expected:** Legible words and section numbers remain accurate. Section 4 says `Section 4: learning marker 04`.

**Actual:** The full image repeatedly yields `Section 4: earing malker of`; sections 6/11/16 are misread as 8/1/18; the end becomes `END TALL final learning somience.` The 900×500 crop reads Section 4 correctly without changing its text size. The original image is retained, but the text used for reading, highlighting and exercises is wrong.

**Evidence:** `shots/verify-tall-errors.png`, `shots/second-tall_section4_control_png.png`; `tall_png.json`, `second-tall_png.json`, `second-tall_section4_control_png.json`; the two original PNGs; `saved-docs/section-*.md`.

**Suspect:** `packages/core/src/ingest/swift/ocr.swift:48` sends an entire image to Vision in one request; there is no tiling of very tall screenshots. The crop control supports a size-dependent OCR failure; it does not establish Vision's internal resize behavior.

### I7 — Local recordings have no Reimport action

**S2 · Mac · 2/2 recording types (M4A and MP3), checked on separate fresh pages.**

1. Open a fresh page and add `fixtures/chaptered.m4a`.
2. Open **Source actions (⋯)**.
3. Try to reimport the retained recording to obtain a new transcript.
4. Repeat for `fixtures/chaptered.mp3`.

**Expected:** **Reimport** is available for the kept audio, as D167 says: “Reimport hears the kept audio again, so a better transcriber reaches it.”

**Actual:** The menu offers Open original and Reveal in Finder, but no Reimport. The same menu exposes it for the EPUB and web sources. This blocks the app route to the promised transcript refresh.

**Evidence:** `shots/audio-menu.png`, `shots/verify-audio-mp3-menu.png`; `inspect-audio.json`, `verify-audio-mp3.json`; positive control `shots/epub-reimport.png`.

**Suspect:** `apps/desktop/src/Reader.tsx:3052` only adds Reimport for a non-snippet URL, PDF, or EPUB. A local recording is `type: article` with no URL, so it is excluded. Local Word also lacks the action, but D93 explicitly limits the older file menu to PDF/EPUB; this finding is limited to audio because D167 expressly promises it.

## Known rows and exclusions

- No previously fixed findings row was confirmed to have returned.
- Did not re-report known PDF inline-math, vector-figure, or optional table-reader limitations. The direct arXiv PDF was not called a full-fidelity pass for those fields.
- Did not report the old global import-promise list as new failures. Current RTF, CSV, notebook-image, and EPUB-image paths were exercised.
- Initial `.webarchive` and folder probes used the file-picker stub, which can return paths the actual picker filters out. Those probes saved path text; they are **excluded as harness artifacts**, not findings. The subsequent native drag-event path correctly refused both and gave next steps. Their initial JSON records remain for transparency.
- YouTube playback in this mock says its native player cannot start because the supplied mock has no player relay port. Not reported as an app regression.
- The “Writing prequestions…” label was visible with AI disabled by the test harness. AI waiting behavior was outside this intake report's confirmed findings.
- Wikipedia was not truncated: later text loads as the reader scrolls. The final references were reached; 555 rendered math elements were counted. Offscreen lazy images were not treated as broken merely because they had not loaded.
- Audio transcription wording from synthetic speech and the notebook's custom author metadata are not promoted to findings.

## Passed checks and coverage limits

- **EPUB without a TOC:** title, author, date, spine order, both headings, image, table, code indentation, and end marker survived (`epub_no_toc_epub.json`).
- **EPUB footnotes:** linked footnote content survived along with the same chapter/structure checks; Reimport reported up to date without damage (`epub_footnotes_epub.json`, `inspect-epub.json`).
- **Scanned PDF:** no text layer in the original; OCR recovered title and start/end markers. First helper initialization took about 31 seconds and completed (`scanned_pdf.json`).
- **Password PDF:** refused with Preview → enter password → Export as PDF → add copy; input retained (`locked_pdf.json`). Passwords for the synthetic original: `learner-secret` / `owner-secret`.
- **Slide PDF:** all three slide headings and start/end text retained, with metadata title and author (`slides_pdf.json`). Text-only fixture; no claim about diagram layout.
- **600-page PDF:** all 600 START and 600 END markers, including page 600, survived in `doc.md`; reader opened (`long600_pdf.json`). Lightweight pagination test, not a scanned textbook stress test.
- **DOCX retained fields:** metadata title/author, headings, picture, table, footnote text, inserted correction, and end marker retained. Code and comments fail as above.
- **PPTX notes:** both speaker-note passages, slide order, titles and last-slide text retained (`notes_pptx.json`).
- **Notebook:** Markdown headings, code cell, PNG output saved as an asset, and final cell retained (`outputs_ipynb.json`).
- **RTF:** metadata title/author, body, footnote, and end retained (`learning_rtf.json`).
- **CSV:** quoted commas, escaped quotes, all rows and multiline-cell words survived as a table; internal line break was normalized to a space (`learning_csv.json`).
- **Webarchive drop:** refused with supported formats and the instruction to copy/paste its text (`drop-learning.webarchive.txt`).
- **HEIC:** ImageMagick produced the actual HEIC after `sips` failed; text recognition recovered the heading and both markers (`screenshot_heic.json`).
- **Latin-1 and UTF-16:** accents decoded correctly; same text in both encodings reused one source (`latin1_txt.json`, `utf16_txt.json`).
- **Zero-byte text:** refused with no-text reason and next step; dialog input retained (`zero_txt.json`).
- **Emoji + NFD accent + slash-like character filename:** `🧠 café ∕ notes.md` imported with its heading and complete body (`___cafe____notes_md.json`; exact name in manifest).
- **Folder drop:** refused with “Open it and add the files inside instead” (`drop-folder-drop.txt`).
- **Two-file drop:** both original Markdown files became distinct sources; “Added 2 sources” and Undo appeared (`drop-drop-one.md.txt`).
- **Paywalled news URL:** the NYT sample returned a bot check; Ore refused it and suggested passing the check and using Browser tab/pasted text. No challenge page was saved. This does not test a signed-in subscription capture.
- **Substack:** The Psychopolitics Of Trauma imported with Scott Alexander, publication date, numbered section headings, saved images, and concluding paragraph.
- **Wikipedia:** Normal distribution retained formulas, tables, section hierarchy and final references; Spacing effect also imported via a fresh HTTP URL with tracking parameters.
- **arXiv abstract:** became the full Attention Is All You Need paper, with Ashish Vaswani et al., headings, math, tables and images through the attention-visualization appendix; not just an abstract.
- **GitHub README:** repository and README-file links imported the expected documents and end sections; fenced README code remained code. Non-Markdown Python files fail as above.
- **Direct PDF URL:** Attention Is All You Need imported through its last figure caption; known PDF structure limitations excluded. W3C's very short dummy PDF was refused with a no-text/export-or-paste step; it is too short for the importer threshold and was not counted as a new bug.
- **Redirect/tracking:** fresh `http://en.wikipedia.org/wiki/Spacing_effect?utm_source=intake&utm_medium=test` imported; tracked HTTP Normal distribution reused the already-added HTTPS source. See `redirect-http___en_wikipedia_org_wiki_Spacing_effect_utm_source_intake_utm_medium_test.json`.
- **YouTube Shorts:** Steps of the Scientific Method retained title, Science Buddies author, date, transcript and description.
- **Timestamped YouTube:** `kCc8FmEb1nY&t=60s` imported the full transcript and chapter headings; playback/start-offset behavior was not validated because the mock player is unavailable.
- **YouTube playlist:** Neural Networks: Zero to Hero added all 10 ordered lessons, with `failed: []`, in about 38 seconds. Individual transcripts were not exhaustively compared word by word.
- **Apple/Spotify episode links:** both refused this run with alternate-site/link instructions; neither saved a player/sign-in page as learning content. Exact URLs and messages are in the per-input JSON records.
- **Google share link:** conventional public link imported body through the last instruction; its title fails as above. The older `/a/pulaskischools.org/` link was refused with Browser tab/paste guidance rather than saving its four-word shell.
- **Image URL:** Python's logo image was refused as containing insufficient text, with a screenshot/paste next step. A private bridge-file URL probe returned 404 and is not product evidence.
- **Pasted links:** surrounding spaces trimmed and duplicate detected. A link embedded inside prose stayed literal pasted text, consistent with Add accepting any text; not reported as a failure.
- **Link then identical file:** saving the imported ts-fsrs README as `fixtures/ts-fsrs-copy.md` and picking it reused the original source ID (`third-ts_fsrs_copy_md.json`).
- **Reimport:** EPUB, GitHub, and Google sources reached core and returned “already up to date”; audio's missing action is above.
- **Cancel mid-add:** two actual YouTube imports were cancelled through the visible Cancel button; the pending command ended, input stayed editable, and no source with that video URL was written (`after-1.json`, `after-2.json`). No artificial delay needed.
- **Connection failure:** `https://intake-offline.invalid/lesson` produced “Couldn’t reach … Check your connection and try again,” retained the input, and saved no source. Two injected CLI failures also recovered the dialog. A genuinely disconnected Mac was not tested.

## Reproduction assets

- `make-fixtures.py`: creates the synthetic document/image fixtures. It uses installed Python/Pillow/PyMuPDF and Pandoc.
- Audio was generated with `espeak-ng`, then FFmpeg attached `fixtures/chapters.ffmeta`; `audio-original.json` records MP3 tags and chapters.
- HEIC was generated with `magick fixtures/screenshot.png fixtures/screenshot.heic`.
- `fixture-manifest.json`: exact filenames, sizes, and SHA-256 hashes.
- `run.cjs`: fresh-page Add → File/link → Enter runner; `RUN_TAG` keeps repeat evidence separate.
- `drop.cjs`: native Tauri drag events for folder, webarchive, and two files.
- `inspect-source.cjs`, `verify.cjs`: reader, source-menu, scroll, and reimport checks.
- `after.cjs`: real cancellation and simulated CLI network-error checks.
- `results-index.json`: compact index of initial/repeat input runs. Individual JSON files retain observed app text, exact CLI requests/responses, and screenshot paths.
- `saved-docs/`: copies of the saved documents relevant to the findings, read from this tester's scratch library.
