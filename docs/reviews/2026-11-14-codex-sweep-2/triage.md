# Codex sweep 2: triage (2026-11-14)

Four Codex testers (`outside`, `time`, `intake`, `ai`; prompts and reports in this folder) ran on master `5a44d32` against the release build under the release CSP, one bridge and seeded scratch library each, the phone build, and one Playwright WebKit server. They reported 21 candidates. Claude re-ran every repro (Mac page, phone page where `page.clock` drives core, or the `ore` CLI on a scratch library) and read the suspected code. **18 are real and new**, listed as 17 items because OUTSIDE-3 and OUTSIDE-4 share one cause. 3 are dropped (below). None is already a row in `findings.md`. Severity is Claude's after re-running; where it differs from the tester's, the tester's is in brackets.

The reports' screenshot links point at `codex-out/`, which isn't committed. The shots a fix needs are in `shots/`, named `<tester>-<file>`.

## S2

### 1. Home keeps yesterday's Today after midnight; can hide Start review for days (TIME-2)
**Mac and iPhone · time.** Worse than reported.
1. Phone page, Los Angeles, 2027-02-10 23:55. Review one exercise for 2 min, Leave, Done. Home: "2 of 10 min".
2. Advance 9 h; let the 30 s timer fire; send `visibilitychange`; on the Mac, blur for over 10 s, then focus. Home still says "2 of 10 min". A reload shows 0.
3. At 21:00, review until all caught up, then Done: "All caught up, so today counts", no Start review. Jump 32 days. Home is unchanged (a Wednesday is still highlighted on a Sunday, still no Start review) until a reload.

Suspect: `apps/desktop/src/Home.tsx:124-135` fetches `today` only when `reload` or `changes` change. The Mac's focus handler `App.tsx:383-396` never bumps `homeTick` (line 219). The phone's `PhoneApp.tsx:588-597` refreshes only on Mac file changes. A Mac left open overnight is the normal case. Shot: `shots/time-verify-t2-phone-30d-stale.png`.

### 2. The open reader, note, skill page and Review don't pick up outside changes (OUTSIDE-3, OUTSIDE-4)
**Mac · outside.** The CLI, the `/ore` skill and the phone all write beside the open app.
1. Open a source. From the shell, edit its `doc.md`, append to `notes.md`, and rename a skill in `skills.yaml`. Leave the window for over 10 s and come back: none of the three shows. A deleted source folder stays fully shown, and so does a skill removed with `ore skills rm`. The next note save does merge both texts, so nothing is lost there.
2. Review: Start review, then rewrite the shown exercise's `cards/<id>.md` question and return. The old question stays, and its rating is logged against the rewritten exercise.
3. With an exercise on screen, run `ore review <id> --rating 4` and return: the app still offers it, and rating it logs a second review 12 s after the first.
4. Delete the next exercise's file while answering the first. Rating the first goes on to the deleted one, from its prefetched copy.

Suspect: `App.tsx:385-391` `back()` refreshes source lists only. `Reader.tsx:1095-1122` and `Notes.tsx:235-269` don't re-read on focus. `Review.tsx:246-269` loads the queue once and reconciles only on `quiz-closed` (`:297-308`). Shots: `shots/outside-stale-edits-1.png`, `shots/outside-v-card-edit-revealed-1.png`.

### 3. Saving an exercise edit overwrites an outside change to the other field (OUTSIDE-1) [S1]
**Mac · outside.**
1. Start review, reveal the first Fact, Edit exercise, change only the Question.
2. In the shell, `ore card set 01M7DG3FTXY5E6BWA9M5F4BJQS --answer "OUTSIDE"`.
3. Save. `ore card show` has the old answer again; the outside answer is gone.

Suspect: `apps/desktop/src/Review.tsx:866-869` always sends both `--question` and `--answer` from the draft (passed at `:903`). `packages/core/src/cards.ts:199-206` writes them with no base check. S2: one field is lost, but only when the same exercise is edited elsewhere while its editor is open. Shot: `shots/outside-exercise-save-clobbers-1.png`.

### 4. ⌘Z on a finished rename wipes a newer outside rename (OUTSIDE-2) [S1]
**Mac · outside.**
1. Rename a source's title in the app and press Enter; let the save land.
2. `ore edit <id> --title "OUTSIDE"`.
3. ⌘Z: the original title is written over "OUTSIDE".

Suspect: `apps/desktop/src/Reader.tsx:2896-2902`, where the Undo closure `retitle(id, t, before, false)` doesn't check the current title. Archive Undo and rating Undo already respect a newer outside write, so this is the odd one out. This is not F156, which is Undo before the save lands. Shot: `shots/outside-undo-overwrites-cli-1.png`.

### 5. Two folders ending in one id can't be opened; the error asks for the impossible (OUTSIDE-5)
**Mac · outside.**
1. Copy a source folder to `items/2026/duplicate-<same id>`, as a Finder or iCloud copy would.
2. Fresh page: one row is listed. Click it: `"<id>" matches 2 items; use more of the id`, though the id is already complete. Its note can't save either. `ore doctor` says "Ore shows that one", which isn't true.

Suspect: `packages/core/src/items.ts:229-236` `findItem` treats two exact matches as an ambiguous prefix, while `oncePerId` (`:248-255`) lists one. Resolve exact hits the way `oncePerId` does. Shot: `shots/outside-duplicate-id-open-1.png`.

### 6. Code in a Word file loses its indent and code block (I1)
**Mac · intake.** `ore add codex-out/intake/fixtures/office.docx` (made for Ore with Pandoc; shareable). `doc.md` has `def learn():`, a hard break, then `return 42` unindented and unfenced. The DOCX has `w:pStyle="SourceCode"` and four preserved spaces. Suspect: `packages/core/src/ingest/office.ts:46` runs Mammoth with no code style map, and turndown at `:48` drops the spaces. Also handle code that is only a monospace font. The grid's Word `code` cell (`intake-grid.test.ts:72`) says n/a; it should become a test. Shot: `shots/intake-word-code.png`.

### 7. A GitHub source-code file is read as Markdown prose (I3)
**Mac · intake.** `ore add https://github.com/python/cpython/blob/main/Lib/this.py` saves `type: markdown`, titled "this", with no fence. The loops join into one paragraph and `*evtug*` renders as italic. Reimport says unchanged. Suspect: `packages/core/src/ingest/links.ts:23-26` turns a blob link into its raw file, and `ingest/index.ts:283,299,357` sends `text/plain` to the Markdown reader. Fence a non-Markdown file by its extension, and title it `this.py`. The grid's GitHub `code` cell (`:45`) points at a README-only test. For the fixture, write a small `.py` for Ore (this.py is PSF-licensed). Shot: `shots/intake-verify-github-code.png`.

### 8. A public Google Doc is titled with its document id (I4)
**Mac · intake.** `ore add "https://docs.google.com/document/d/1OFUY1ASm-HoAL-ney7z5e4-PAuJkvA8EVtaAYSU86b8/edit?usp=sharing"` is titled `1OFUY1ASm-…`; the body is fine. The export has no `docProps/core.xml` and no heading, so the name falls back to the URL's id segment (`ingest/index.ts:346,360`, `office.ts:50`). Fix: the export response's `content-disposition` carries `filename*=UTF-8''Constitution%20Study%20Guide.docx`, so use that. Slides and Sheets exports likely share it. The grid's Google `title` cell (`:46`) points at a rewrite-only test. The Doc is third-party: make the fixture an Ore-written DOCX with no core.xml, served with that header. Shot: `shots/intake-verify-google-title.png`.

### 9. Audio files lose their embedded title, artist and chapters (I5) [chapters S3]
**Mac · intake.** `ore add codex-out/intake/fixtures/chaptered.m4a` (and `.mp3`; Ore-made with espeak-ng and ffmpeg) is titled "Chaptered", with no author and no chapter labels. ffprobe shows `title=Chaptered Audio Learning`, `artist=Ore Fixture Author`, and chapters "Recall chapter" and "Spacing chapter". Suspect: `packages/core/src/ingest/index.ts:133-139` names the source from its file name only. The grid's audio row (`:66`) marks author and headings n/a. Before saving the fixture, fix its second chapter's end (12 s on a 10.2 s file). Shot: `shots/intake-chaptered_m4a.png`.

### 10. A recording added from a file has no Reimport (I7)
**Mac · intake.** Add `chaptered.m4a`, then open ⋯: no Reimport. `ore reimport <id>` works, so only the menu is missing it. Suspect: `apps/desktop/src/Reader.tsx:3052` offers Reimport only for a link, a PDF or an EPUB. D167 says "Reimport hears the kept audio again"; D93 limits file Reimport to PDF and EPUB and was never updated. **Tyler decides** whether the menu follows D167 (audio, and maybe Word), or D167 is narrowed. Shot: `shots/intake-audio-menu.png`.

## S3

### 11. Review's next-review line names the wrong day (TIME-4) [S2]
**Mac and iPhone · time.** `inWords` (`apps/desktop/src/Timeline.tsx:22`) rounds 24-hour spans instead of comparing local calendar days. At 22:55, a review due at 09:55 the next day says "later today". 08:00 two days later says "tomorrow". At 08:00, 21:00 the same day says "tomorrow". Repro: phone page, Los Angeles, 2027-04-21 09:55. Put off two Facts to reach "Explain why rereading…", advance 13 h, tap No idea: "next later today". Also, `history.next` is computed when the exercise loads (`Review.tsx:358-385`) and never refreshed. Shot: `shots/time-verify-t4-phone.png`.

### 12. A wall clock stepped backward blocks the open answer from saving (TIME-1) [S2]
**Mac and iPhone · time.** Phone page at 2027-03-12T20:00Z. Rate the first exercise Good after 60 s, then set the clock to 2027-03-11T20:01Z, reveal the next and tap Good: "elapsed_ms: Too small: expected number to be >=0", and nothing saves. A step back of 2 s just after an exercise appears does it too. Retry and Later stay broken until the clock passes the show time, because `showAgain` carries the negative value. Suspect: `apps/desktop/src/Review.tsx:378` and `:604/612` (also `:351, :731, :790`) time with `Date.now()`; use `performance.now()`. Core's rejection at `packages/core/src/reviews.ts:32` is right. Rare, so S3. Shot: `shots/time-verify-t1-phone.png`.

### 13. A session across midnight says "Goal met" using yesterday's minutes (TIME-3) [S2]
**Mac and iPhone · time.** Phone page, Los Angeles, 2027-01-20 23:55. Rate four exercises after 2, 2, 3 and 3 min, so the last lands at about 00:05. After 8 s: "Goal met. The rest is extra." Home and the end ring correctly say 6 of 10 min. Suspect: `apps/desktop/src/Review.tsx:623-624` adds the Today snapshot from session start to cumulative `activeMs`, and never rebases either at midnight. The quick quiz's ring (`:1072-1074`) does the same. Shot: `shots/time-verify-t3-phone-goal.png`.

### 14. Leaving and reopening a source during an enrichment retry shows a false failure and allows a second run (AI-3) [S2]
**Mac · ai.**
1. A source past the 20-minute cutoff shows "Couldn't write prequestions". Click Try again (the repro held `enrich` with `__ORE_SLOW` for 120 s; a real run takes tens of seconds).
2. Click Home, then reopen the source through ⌘K. It shows "Couldn't write prequestions" and Try again while the first run is still going.
3. Click Try again: two `enrich <id>` commands are in flight.

Suspect: `apps/desktop/src/Reader.tsx:724-725` (`gaveUp`, `retrying` are local state), `:1108` (failure inferred from age alone), `:1165-1175`. Core dedupes highlight and prequestion drafts under the lock, but not drafts from his notes (`packages/core/src/ai/enrich.ts`, `d.from_notes`), so two runs could double those. Shot: `shots/ai-enrich-reopen-1.png`.

### 15. A stopped streamed tutor reply is saved with no AI stamp (AI-4) [S2]
**Mac · ai.** Send a tutor message. While it streams (CLI `{"progress":{stream,reply}}` → `ore-progress`), click Stop. `chats/<id>.json` keeps `reply` and `stopped: true` but has no `ai` field. That breaks "AI output always records vendor, model, prompt version." Suspect: `apps/desktop/src/Tutor.tsx:218`; the stamp comes only on completion (`:184`). The fix needs the CLI to send the stamp in its first stream event, or the app to record it when the request starts. Evidence: `shots/ai-stopped-chat-1.json`, `shots/ai-tutor-stopped-partial-1.png`.

### 16. Word comments vanish without notice (I2) [S2]
**Mac · intake.** Same `office.docx`: the commented passage is in `doc.md`, but "COMMENT EVIDENCE: check the study sample." is not, with no marker or warning. The DOCX has `word/comments.xml` and its range and reference elements. Suspect: `packages/core/src/ingest/office.ts:46` (Mammoth's defaults leave comments out). S3: these are a reviewer's notes, not the body, but it is still silent loss.

### 17. A very tall screenshot is read wrongly (I6) [S2]
**Mac · intake.** `ore add codex-out/intake/fixtures/tall.png` (900×10,000, Ore-made). "Section 4" reads "earing malker of", sections 6, 11 and 16 read 8, 1 and 18, and the last line is garbled. Crops up to 900×5000 read correctly. Suspect: `packages/core/src/ingest/swift/ocr.swift:47` makes one `recognize` call for the whole image; tile tall images. S3 because the shape is extreme, though a Retina full-page capture (2400×24000) is about this ratio. Shot: `shots/intake-verify-tall-errors.png`.

## Dropped

- **AI-1** (a null `ask` reply crashes Review) and **AI-2** (tutor and ⌘K Ask stuck after a null reply; Stop dead): mock artifacts. The real CLI always prints an object whose `reply` is at least one character (`packages/core/src/ai/chat.ts:9-12`, `tutor.ts:48-49`, `runAgent` throws on bad output) or exits with an error. Tauri returns null only for empty stdout (`main.rs:197-198`). Only the mock bridge answers null. Optional: have `bridge.ts` reject AI commands ("AI is off") instead of returning null, so sweeps stop finding this.
- **OUTSIDE-6** (two device ratings with the same `ts` collapse into one): needs two devices to rate one exercise in the same millisecond; the test copied one `ts` by hand. `packages/core/src/reviews.ts:87-95` dedupes by `card|ts`, which is a design note rather than a learner-facing bug.

## Passed (from the reports, so the next run skips them)

iCloud conflict copies, `.icloud` names, Finder junk, truncated, zero-byte and malformed files; archive and rating Undo against outside writes; note merges with outside appends; moving or renaming an open source folder. Time away at 1, 3, 30 and 365 days (no guilt or streak); both 2026 DST changes; travel between time zones; reminder times. D21 (a late grade never changes the rating); 30 injected AI failures, each with its reason and Retry; a provider or model switch mid-reply. EPUB without a table of contents or with footnotes, scanned, password, 600-page and slide PDFs, PPTX notes, notebooks, RTF, CSV, HEIC, Latin-1 and UTF-16 text, odd filenames, folder and two-file drops, Substack, Wikipedia, arXiv, YouTube Shorts and playlists, redirects, cancel mid-add, offline.
