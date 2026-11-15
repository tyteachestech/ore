# Hostile content sweep

Tested checkout `bc0d27551df10e57dc748853a3b758487c0bfd02` using the assigned WebKit server, Mac page `1701`/bridge `1702`, and phone page `1703` at 390 × 844. Covered hostile Markdown, HTML (file and served URL), DOCX text, EPUB, an SVG image containing a script, source metadata, skill names, saved notes, pasted HTML notes, highlight notes, exercise questions/answers, and a saved tutor reply; source/note links; unusual names and their saved paths; large sources, notes, answers, and images; and malformed imports. Findings only: no application code, shared findings table, or Git history was changed. Fixtures and reports are under `codex-out/hostile/`; library changes used Ore's CLI or UI. Phone review and long-note fixtures were copied from CLI-produced files into the browser's **test snapshot response**, without editing the phone seed on disk. Actual Mail/Safari launch, native iOS hardware, and direct corruption of canonical library frontmatter were not tested. BOM, CRLF, duplicate keys, and tabs were tested through import. The served phone page contains Vite's React-refresh script, so it is not evidence of the native release CSP.

## Findings

### H1 — Narrowing Find in a 10,000-line note freezes the page

**S1 · Mac · reproduced 2/2 in isolated 60-second runs**, plus an independent JavaScript-responsiveness check.

1. Use `fixtures/note10000.md` as a source note through `ore notes <id> --set <text>`. The fixture contains 10,000 nonempty text lines separated by blank lines, 348,888 bytes. The prepared source is **Hostile long note**; its ID is in `isolated.json`.
2. From a fresh Mac page, open All sources → Hostile long note. Keep Source note visible.
3. Press ⌘F and **type** `2999`, character by character.
4. Try continuing to type or interacting with the page.

**Expected:** Find narrows results and the app remains usable. **Actual:** input dispatch stops completing; the page remains blocked until the test closes it at 60 seconds. A separate evaluate request received no JavaScript response within five seconds while typing was pending. This is a page freeze, not just a slow CLI call. Opening the same note works. A broad query `2` alone reaches `1/4000`; pasting the precise query `Line 2999:` at once reaches `1/1` in 538 ms including a 500 ms observation wait. The bad transition is narrowing a query with thousands of highlights, not merely opening the note.

- Reproduction scripts: `size-check.cjs 'Hostile long note' 1`, `size-check.cjs 'Hostile long note' 2`, `note-freeze-proof.cjs`.
- Evidence: `size-Hostile-long-note-1.json`, `size-Hostile-long-note-2.json`, `note-freeze-proof.json`, `note-find-narrow.json`.
- Screenshots: `screenshots/before-find-Hostile-long-note-2.png`, `screenshots/note-freeze-before.png`, `screenshots/note-find-narrow.png`. The first two are immediately before the blocked input; an unresponsive page cannot supply an after screenshot.
- Suspect: `apps/desktop/src/Find.tsx:128` (painting/replacing all matches), `apps/desktop/src/paint.ts:9` and `:29` (repainting every removed range). These are investigation leads, not a proved root cause.

### H2 — A 20 MB source loads in batches that block the page for over four seconds

**S2 · Mac and iPhone · reproduced 2/2 full-load observations on each.**

1. Add `fixtures/huge20mb.md` with `ore add <file> --no-enrich`. It is 21,506,026 bytes, titled **Hostile 20 MB**.
2. From a fresh page, open it in All sources.
3. Press ⌘F and enter `END20MB` while the source is still appearing.
4. Keep the source open until its last marker is mounted; try interacting while the later batches load.

**Expected:** Either a clear refusal with a next step, or bounded batches that keep scrolling and input responsive. **Actual:** the initial view appears quickly, but later work blocks the page's 50 ms heartbeat for **2,600 and 4,413 ms** in one run; **2,611 and 4,339 ms** in the repeat. On iPhone the complete-load runs recorded **5,180 ms** and **4,831 ms** maximum heartbeat gaps. The final text and marker do arrive. Find temporarily says “Not found” while that text is absent; the longer observation updated to `1/1`, so I am **not** reporting permanent search loss.

- Evidence: `huge-end-refill.json`, `huge-repeat.json`, `phone-complete-huge20mb.md-1.json`, `phone-complete-huge20mb.md-2.json`; scripts `huge-refill.cjs`, `huge-repeat.cjs`, `phone-complete.cjs`. On phone use Add → Choose a file or photo, open the imported source, and wait for the end marker before using its Find button.
- Screenshots: `screenshots/huge-find-end-refill.png`, `screenshots/huge-find-stale-2.png` (the second filename reflects the hypothesis; its recorded final result is `1/1`). Screenshots cannot show a multi-second pause; the heartbeat logs are the timing evidence.
- Suspect: `apps/desktop/src/Reader.tsx:526–539`: the render batch doubles each pass (`shown * 2`), so later commits become much larger. Full-document layout/indexing may also contribute.

### H3 — Mail, relative, and anchor links in notes do nothing

**S2 · Mac · reproduced 2/2 for each link type.** Mail and relative links also reproduced in one phone HTML-paste journey.

1. Open **Hostile Links** from a fresh Mac page. Its source note contains the links from `fixtures/links.md`.
2. Click **Mail link** in the Source note, then **Relative link**, then **Anchor link**.
3. Compare with HTTP/HTTPS links in the same note, and Mail/relative/anchor links in the source itself.

**Expected:** Mail hands off to the mail app; an anchor moves within the note; an unavailable relative target explains the next step. **Actual:** these note links are visibly links but produce no handoff, movement to the destination, or explanation. The page stays in Ore. HTTP and HTTPS links call the external opener; source links have their own working handler. A clean run with no prior source-link errors produced zero opener calls and an empty toast area after Mail/Relative clicks.

- Evidence: `links-browser.json`, `note-links-clean.json`, `phone-paste.json`.
- Screenshots: `screenshots/note-links-inert.png`, `screenshots/phone-pasted-note.png`.
- Suspect: `apps/desktop/src/editor/NoteEditor.tsx:1028–1038`: only `ore:item/…`, `ore:skill/…`, and HTTP(S) are handled; all other schemes/relative fragments return `false`.
- Valid internal links were tested separately: a deleted source note correctly says it is no longer in the library and offers editing/removing the link. This is not the old phone `[[` issue F34.

### H4 — The iPhone's relative-link error tells the user to press ⌘O

**S2 · iPhone · reproduced 2/2 fresh-page journeys.**

1. On a fresh phone page tap Add a link → Choose a file or photo; select `fixtures/markup.md`.
2. Open **Hostile Markdown** and tap **Relative link**.

**Expected:** A next step available on the phone, such as adding the referenced file with its file picker, or explicit direction to the Mac. **Actual:** “This links to ‘beside.md’, a file beside the original that isn’t in Ore. Add it with ⌘O to read it here.” A touch user gets no usable action or location for that instruction.

- Evidence: `phone-journey-1.json`, `phone-journey-2.json`; script `phone-journey.cjs`.
- Screenshots: `screenshots/phone-relative-link.png`; `screenshots/phone-reader-2.png` shows the related empty-target message below.
- Suspect: `apps/desktop/src/Reader.tsx:2684`: the relative-link fallback always prints the Mac file shortcut. Nearby missing-anchor handling at `:2681` already branches for `PHONE`.
- Related to the class of F32/F78, but this is the reader's link-click path, not those rows' import-refusal path.

### H5 — A local-file link loses its destination and is reported as an empty filename

**S3 · Mac and iPhone · reproduced 2/2 on each.**

1. Open **Hostile Links** on Mac, or import/open `fixtures/markup.md` on phone.
2. Click/tap **Local file link**, whose Markdown destination is `file:///tmp/hostile-test.txt`.
3. Also try the fixture's JavaScript, data, and VBScript links.

**Expected:** Unsafe schemes remain inert; the explanation identifies the target or says that scheme is unsupported. **Actual:** the reader turns every such destination into `href=""`, then says “This links to ‘’, a file beside the original that isn’t in Ore.” It incorrectly describes JavaScript/data/VBScript as a missing file too. On phone it additionally gives the ⌘O instruction from H4. Nothing executed or navigated away.

- Evidence: `links-browser.json`, `phone-journey-1.json`, `phone-journey-2.json`.
- Screenshots: `screenshots/links-1.png`, `screenshots/phone-reader-2.png`.
- Suspect: default URL filtering at `apps/desktop/src/Reader.tsx:510`, then `followLink`/the unconditional fallback at `:2683–2695`, which reads the filtered DOM `href` rather than retaining enough information to explain the refusal.

## Known rows observed

- **F4 remains open:** `fixtures/nul.md` is accepted on Mac and iPhone. The Mac's canonical `doc.md` still contains the NUL byte between `Before` and `after`. Recorded as existing coverage, not a new finding. Evidence: `imports.json`, `disk-check.json`, `phone-broken.json`.
- No previously fixed finding was conclusively observed to recur. F14's below-fold rating controls were excluded as instructed.

## What passed and important observations

- **No hostile script execution observed.** `window.__HOSTILE_RAN` stayed unset through reader, title, author, skill label, source note, exercise question/answer, and saved tutor reply checks. No hostile script/handler/frame/object/base/refresh/overlay element survived into the Mac DOM. No payload-triggered CSP refusals occurred in the Mac runs.
- **HTML, EPUB and DOCX:** the beginning/end content remained available after import. Raw Markdown HTML is skipped in the reader; note and tutor HTML is represented as text or parsed into allowed editor structure. DOCX carried the hostile strings as document text, not executable Office macros.
- **SVG:** standalone `.svg` import is refused with supported formats and a text-paste next step. An SVG containing `<script>` imported as an article image was kept as an asset and displayed at 200 × 100 through `<img>` without running its script (`svg-browser.json`). The original SVG still contains the script; this tests image embedding, not opening that original in another app.
- **Outside image requests do occur.** A hostile HTML `<base href>` changes how its relative image URLs resolve during import; unsaved HTTPS image fallbacks subsequently attempted requests to `example.invalid`. The CSP permits HTTPS images. This was an image request, not script execution or page navigation (`web-browser.json`, `svg-browser.json`).
- **HTTP/HTTPS source and note links, and source Mail links, invoke the native opener on Mac and do not replace the app page.** The test bridge does not actually launch Safari/Mail. On phone those calls reach the intentionally unavailable Tauri stub and show its error; that stub error is not a product finding.
- **Source anchors** move within the reader. **Deleted internal note links** give a clear no-longer-in-library message twice (`deleted-note.json`).
- **Names:** `/`, `\\`, `..`, `:`, leading dot, newline, whitespace-only, 500 ASCII characters, mixed Arabic/Hebrew/English, zero-width characters, combining accents, and an emoji ZWJ family were exercised through skill creation and title edits. Whitespace-only names are refused; embedded newlines normalize to spaces. Case-only and NFC/NFD-equivalent skill names are refused as duplicates. Fourteen successful unusual skill names were given notes; all files existed under their own `skills/<safe-id>/notes.md`, without path escape or collisions (`setup-results.json`, `names-disk.json`). This is not an exhaustive Unicode grapheme-truncation audit.
- **3,000 headings:** Mac opened in 700 ms in the isolated run; phone in 681 ms. Find and scroll stayed usable in the measured journey.
- **200,000-character paragraph:** Mac opened in 920 ms, phone in 1,035 ms; Find and scroll worked. These opening measurements include a 500 ms observation wait.
- **2,000-row table:** all 2,001 DOM rows including the header were present on Mac; open 733 ms, phone 852 ms. Find and scrolling worked.
- **20 MB source:** the last marker and full text arrived; a complete phone load and final-marker search were also exercised (`phone-complete-huge20mb.md-1.json`). Initial-view timings alone do not prove full-load responsiveness; H2 records the repeated Mac and phone stalls.
- **10,000-line phone note:** opened and accepted an inserted character (348,888 → 348,889 displayed characters). The latest run recorded a 2,480 ms heartbeat gap during the combined open/edit journey (`phone-long-note.json`); that run overlapped the large-source check, and the exact slow step was not isolated or reproduced, so it is an observation rather than a sixth finding. This used a snapshot fixture of the CLI-created note; it did not repeat H1's exact query-narrowing sequence on phone.
- **50,001-character exercise answer:** displayed through its `TAIL50K` marker on Mac and phone without script execution or measured multi-second stalls (`review-long-answer.json`, `phone-review-seeded.json`). Phone used the CLI-produced exercise as a snapshot fixture. Hostile markup in both question and answer was checked separately (`review-revealed.json`, `phone-review-markup.json`).
- **400 × 20,000 image:** decoded at full natural dimensions both as a note attachment and as an imported article asset; no measured long pause or script execution (`tall-image.json`, `svg-browser.json`). Native phone image-file/OCR processing was not tested.
- **Broken files:** empty Markdown, truncated PDF, and a ZIP lacking EPUB structure were refused on Mac with next steps; phone queued them for the Mac rather than creating half-read sources. BOM + Windows line endings retained the title, author, and body. A tab-indented malformed frontmatter block is retained as text. Duplicate YAML keys are treated differently by the runtimes: Mac imported “Second title”; phone imported filename “duplicate.” Both retained the original file; canonical-library corruption/recovery was not tested.

## Evidence and test boundaries

All scripts are CommonJS and connect to the supplied WebKit server; none launch a browser or stop supplied services. `browser.cjs` holds the assigned ports and telemetry. `make-fixtures.py` generates the self-written samples; `imports.json` records all 17 initial CLI imports (13 accepted, 4 refused). `setup-content.cjs` uses CLI writes for notes, metadata, highlights, exercises, chats, and names. Scripts that deliberately hang have a watchdog or explicitly close their own page. Evidence screenshots are at device scale 2. Header/body inspection and source reads accompanied the browser checks; screenshots were visually inspected for the key findings.

Limits: this was a focused hostile-content sweep, not a security proof. It did not inspect every possible archive payload, Office macro, malformed PDF, encoding, Unicode boundary, or all native opener behavior. AI was not called; its saved output shape was supplied through Ore's CLI. Direct manual edits to canonical library files were avoided under the preamble's library-write rule. No tests were added or fixes made; reproduction scripts and this report are the handoff.
