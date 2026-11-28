# Importer: four days learning probability

Tested release `d07f87b6ea260e82673138c6e324ffa01a6d7249` in the supplied WebKit browser, November 26–29, 2026, starting with an empty library. Added ten sources plus a podcast feed: EPUB, MP3, PDF slides, PowerPoint, a scanned PDF excerpt, a notebook, an Altair page, an OpenStax page, Wikipedia, and a podcast episode page. Read and annotated the opening probability concepts, completed recall and two quiz questions, reviewed five exercises across two days, read and highlighted the scan and slides, imported the notebook on the phone, searched remembered material, and reimported a kept PDF. **Three S2 findings; no observed data loss or crash.** This was a sampled learning journey, not a page-by-page certification of the book or all 175 slides. Phone image display is unverified because of the supplied browser file adapter; native iPhone behavior, full-book reading, every formula, forced write failures, and the ten-new-exercise limit were not tested. No repository files were changed; all tester files are in this folder.

## Findings

### 1. The podcast episode saves as a short article without saying the recording is missing

**S2 · Mac · confirmed on two opens of the same import.** This cost the entire intended lecture: the page looks successfully saved, but the learner gets a short description and related-episode blurbs instead of the 39:07 recording. Recovering required finding and downloading the MP3 separately, then waiting another **45.531 seconds** for its import. That download/search time was not measured.

1. From a fresh Mac page, choose **+ Add**, paste `https://podcasts.ox.ac.uk/probability-puzzle`, and add it.
2. Open **The Probability Puzzle** and compare it with the publisher's episode page, which offers the recording.
3. Read to the end. Leave through All sources, reopen it, and check again.

**Expected:** the episode’s audio and timed transcript, or an explicit explanation that only its page text was saved and a next step for importing the recording. **Actual:** an ordinary article with no audio player, no transcript, and no missing-content notice. It becomes available in **2.848 seconds**, which looks like a successful import. `source.html` is kept, but no audio is kept for this item. The independently imported MP3 produces the transcript and working player, so the content is obtainable on this Mac.

Evidence: [publisher](original-podcast.png), [first import](d1-podcast.png), [second open](d1-podcast-repeat.png), [working direct audio](d4-audio-playing.png). Source ID `01M8C9HCB4AAAQS9PT70SBCGAK`; direct-audio source `01M8C9M5E64G2YKKAYXXSQK0KH`.

**Decision boundary, not a claimed regression:** D215 deliberately keeps video podcasts as articles and narrowly defines episode detection. This Oxford page offers audio and video at a root-level address. `packages/core/src/ingest/audio.ts:203` defines the episode-path rule; `:230` rejects a page without the recognized path or earlier structured metadata. `docs/DECISIONS.md:595` describes this boundary. D122’s whole-source promise and this observed result conflict from the learner’s perspective. Tyler should decide whether to broaden detection or explicitly tell the learner what was omitted. Do not silently change D215 on the strength of this report.

### 2. OpenStax formulas are duplicated, changing the mathematical reading

**S2 · Mac · reproduced on two separate opens; multiple formulas affected.** This interrupted reading the basic counting rule and made its examples unsafe to learn directly from Ore.

1. From a fresh Mac page, add `https://openstax.org/books/introductory-statistics-2e/pages/3-1-terminology`.
2. Scroll to the fair dime and nickel example following “To calculate the probability…”.
3. Compare its equation and the following die example with the original page. Leave and reopen the source; repeat.

**Expected:** one fraction, `P(A) = 2/4 = 0.5`, and one `2/6` in each relevant die example. **Actual:** two adjacent copies of each fraction. The coin example reads as `P(A) = (2/4)(2/4) = 0.5` when adjacent factors are read as multiplication. The saved Markdown itself contains `$$\frac{2}{4} \frac{2}{4}$$`, so this is not merely a screenshot or font problem. Complement and conditional expressions also have duplicated parts. Tables and prose survived.

Evidence: [original formula](original-math.png), [Ore formula](d1-math-formula.png), [repeat](d1-math-repeat.png). Source ID `01M8C9CZ0XRBF9GP226Z1XZ2EB`; saved source HTML and Markdown are audited in [day1-final.json](day1-final.json).

**Suspected boundary:** `packages/core/src/ingest/web.ts:417`–`:430`, especially the Defuddle conversion at `:429`. The retained HTML’s `<math><semantics>` contains both the presentation expression and an `<annotation-xml encoding="MathML-Content">` with its equivalent. Both reach the Markdown. This is different from F743’s raw Pandoc TeX. The exact dependency-level conversion was not modified or unit-tested in this findings-only run.

### 3. A scanned PDF’s Original view silently draws white pages

**S2 · Mac · reproduced on day 2 and in a fresh context on day 4; both pages fail.** The extracted words can be read and highlighted, but the view intended to check those words against the scan is unusable.

1. From a fresh Mac page, add [laplace-scan-pages19-20.pdf](laplace-scan-pages19-20.pdf), the two-page excerpt retained in this folder.
2. Open the resulting source, titled “urn A will then be the same as at first. But then we”.
3. Select **Original** and wait for the page to finish drawing. Advance to page 2.
4. Leave, reopen in a fresh page/context, and repeat.

**Expected:** the scanned book page, or a visible failure explaining how to open the original externally. **Actual:** a white page with normal page controls, no error, and no next step. The first day-4 page reached its completed `data-page="1"` canvas in **838 ms**. Both 694 × 1123 canvases had **zero nonwhite pixels**. The same file renders correctly in the independent original image, and Ore even has a small preview image above the source text. The original PDF’s bytes are preserved exactly.

Evidence: [independent original](original-scan19.png), [day 2](d2-scan-original-ready.png), [day 4 page 1](d4-scan-original-blank.png), [page 2](d4-scan-original-page2.png), [canvas measurement](scan-canvas.json), [decoder warnings](day4-console.log).

**Cause supported by console evidence:** `Unable to load wasmUrl data: openjpeg.wasm`, followed by `JpxError: OpenJPEG failed to initialize`. These scanned images use JPEG 2000 (`JPXDecode`). `packages/core/src/ingest/pdf-data.ts:9`–`:10` supplies CMaps only and rejects other binary resources. `apps/desktop/src/OriginalPage.tsx:50` uses that factory. Its render failure callback at `:91` also ignores errors, although here pdf.js skips the undecoded images and completes a white canvas. F379 fixed blank CJK pages by supplying CMaps; this is a different decoder path, not evidence that its CMap fix regressed.

## Known rows checked

No confirmed recurrence of an existing finding. F744’s embedded Altair charts were drawn; five charts with external data instead left an explicit missing-chart message. F735’s long Finish wait said **Finding the key points…**. F742’s recall feedback completed after the quiz without the stale-answer failure. F739’s simulated dates reached actual review logs and schedules. F734 was not conclusively exercised while drafting was still in progress; the source-review request landed near drafting completion. The phone notebook had no prequestions, so its no-AI Finish does not establish F738 coverage. Known open visual and performance rows were not re-reported.

## Sources and completeness checks

Times below are **Add to reader/outcome observed**, except MP3’s measured bridge completion. They do not include obtaining the file, initial URL feed-discovery requests, or every lazy image becoming visible. The bridge separately measures processing times in [requests.jsonl](requests.jsonl). No whole-import guarantee is inferred from a fast reader opening.

| Kind and original | Available | What was checked against the original | Original kept / caveats |
|---|---:|---|---|
| [Laplace EPUB, Gutenberg 58881](https://gutenberg.pglaf.org/cache/epub/58881/pg58881-images.epub) | 0.322 s | Title and author; 2019-02-13 EPUB publication metadata; both parts and chapters I–XVIII; front matter and ending | `source.epub`, byte-identical. About 328 KB Markdown. No body figures found; cover not treated as a missing teaching figure. Gutenberg main host returned 503 during file retrieval; mirror worked. |
| [Oxford episode page](https://podcasts.ox.ac.uk/probability-puzzle) | 2.848 s | Compared page description, recording, speaker and date with saved article | HTML only; finding 1. Speaker/date not captured as the article’s byline. |
| [Oxford MP3](https://media.podcasts.ox.ac.uk/conted/2014-MT-emergent-multiverse/2014-11-22_wallace_probability_puzzle.mp3) | 45.531 s | 39:07 player; transcript from 00:00 through closing “Let me stop there” (last segment begins 38:33); Play/Pause and seek | `source.mp3`, byte-identical, plus timed VTT. Title from file; author “Steve” reflects file metadata, not the lecture speaker. Transcript accuracy not exhaustively scored. |
| [Oxford feed](https://podcasts.ox.ac.uk/feeds/b5c61a2f-a175-4574-bc2f-8331b3d5c61c/audio.xml) | 2.329 s | Feed recognized and followed as The Emergent Multiverse, four posts | Subscription in `feeds.yaml`; Undo offered. Not incorrectly saved as an article. |
| [OpenIntro chapter 3 PDF](https://raw.githubusercontent.com/OpenIntroStat/openintro-statistics-slides/master/Chp%203/chp3.pdf) | 2.336 s | 175 original pages; title/author, major section headings, coin example, formulas/tables sampled, six initial picture references; Original view renders | `source.pdf`, byte-identical. Background page-reading status shown. Repeated reveal slides exist in the original. Highlight and note saved. Every equation and vector figure not certified. |
| [OpenIntro probability PowerPoint](https://docs.google.com/presentation/d/1YI6GzZwI4Wv1eWUXj1qeJkmfe7bBESqxXq1_VigUCbM/export/pptx) | 0.322 s | All 58 slide markers and 17 images; title and beginning/end content | `source.pptx`, byte-identical. No author/date in imported frontmatter; deck attribution remains in text. |
| [Laplace scanned book PDF](https://archive.org/download/philosophicaless00lapl/philosophicaless00lapl.pdf), PDF pages 19–20 | 1.321 s | Two original scan images plus OCR layer retained in excerpt; readable urn explanation; highlight/note; scan comparison | `source.pdf`, byte-identical to excerpt. Finding 3. No metadata/title page in excerpt: Ore chooses a middle sentence as title. Background improvement removed initial sentence-fragment headings. |
| [Think Stats 3 notebook, chapter 3](https://raw.githubusercontent.com/AllenDowney/ThinkStats/v3/soln/chap03.ipynb) | 0.329 s | Original 121 cells, five PNG outputs; code, prose, output values/tables, heading sequence and final exercises | `source.ipynb`, byte-identical; five image assets. Output controls open stored results. Author/date absent in frontmatter; copyright attribution remains at end. No TeX formulas in this particular notebook. |
| [Altair Binning and Aggregation](https://altair-viz.github.io/altair-tutorial/notebooks/03-Binning-and-aggregation.html) | 0.880 s | Eight generated SVG charts plus split/apply picture; code, tables and section headings | `source.html`; five unsupported external-data charts clearly say they could not be kept. Charts verified after image decoding, not from early empty screenshots. |
| [OpenStax terminology](https://openstax.org/books/introductory-statistics-2e/pages/3-1-terminology) | 1.365 s | Title, Barbara Illowsky/Susan Dean byline; headings; both tables including final tea/coffee exercise; beginning/end text | `source.html`; date absent. Finding 2. Two highlights, one Key point, two annotation notes, source note and recall retained. |
| [Wikipedia Probability](https://en.wikipedia.org/wiki/Probability) | 2.370 s | Title, Wikipedia attribution, headings, images, math and text through references | `source.html`; displayed date 2001-02-24. This request succeeded, so the previous 429 refusal/next-step path was not exercised. |

Source licensing/provenance: Laplace is public domain; Oxford marks the episode Creative Commons BY-NC-SA; OpenIntro distributes its teaching materials under CC BY-SA (the deck separately identifies some borrowed imagery); Think Stats identifies MIT code and CC BY-NC-SA 4.0 text in the notebook; OpenStax supplies openly licensed textbook content; Wikipedia and the Altair tutorial carry their respective published licenses. No dependency or model was installed. The excerpt was made by copying original PDF pages, retaining their scan image encoding and OCR rather than rasterizing/retyping them. Full files and [original structural counts](original-structure.json) are retained here.

## Four-day record and checks against saved files

- **Day 1, November 26:** Imported the set; learned the opening OpenStax concepts, highlighted sample space and long-run frequency, marked sample space as a Key point, wrote notes and recall, and answered the two relevant finish questions. Marked done at `16:07:47.822Z`. Five exercises existed after drafting completed around `16:10:01Z`. No rated review was recorded that day. The short exploratory source-review session had zero ratings; it did not add review minutes.
- **Day 2, November 27:** First review introduced conditional probability as a Fact and a newsletter denominator Explain exercise. Both were answerable from the source. Two manually chosen **Good** ratings were saved, despite the grader suggesting Easy for the Explain answer. Review time **43,048 ms**; end screen **1 of 10 minutes**, **2 memories**, **+5 days of memory**. Both next due dates are **November 30**. Read the scan and PDF slides and saved one annotated highlight in each.
- **Day 3, November 28, phone:** Imported the same notebook, opened its output, wrote/reopened a note, saved recall and marked done. The app said **AI runs on your Mac for now: it drafts the exercises.** Stored notebook body is exactly the same Markdown as on the Mac. Five PNGs and the original notebook exist in IndexedDB. Newly imported image URLs use the supplied `/library-file/lib/...` adapter, which cannot serve these new IndexedDB-only files; image display is therefore a harness limitation, not a filed Ore finding. No review records or exercise drafts were created on the phone. Mac day 3 was left without ratings.
- **Day 4, November 29:** Reviewed the other three new exercises: union/overlap, equally likely outcomes, and long-run frequency. All traced back to this source or its highlights, and the answers were sound. **Good** was saved for all three. Review time **92,714 ms**; end ring **2 of 10 minutes**, **3 memories**, **+7 days of memory**. Their next due dates are **December 2**; day-2 exercises were not prematurely returned. Search for **sample space** found source text, note, Key point and exercise in **289 ms**. Reimporting the scan from its kept original returned `changed:false` in **261 ms**; its annotation log, ID, quote, note and offsets were byte-for-byte unchanged. This validates an unchanged-original reimport, not relocation after a changed extraction.

The review clock sums saved exercise time, capped per exercise in `packages/core/src/study.ts:133`; it does not count all reading time. The saved times include time spent inspecting the test UI, so they are not estimates of a human’s reading speed. No time-freezing clock installation was used. Dates only moved forward. [verification.json](verification.json) records hashes, due dates, review counts, notebook equality and the unchanged annotation check. Full before/after snapshots are retained in this folder.

## Where the minutes went

These columns are **not additive**: AI runs can overlap reading, and grading is included in review time. Separate reading/adding wall clocks were not collected consistently enough to reconstruct an honest total.

| Day | Review, saved by Ore | Reading | Adding | Waiting, measured | Lost / recovery |
|---|---:|---|---|---|---|
| 1 | 0:00 | Opening OpenStax concepts, recall, two quiz answers; source comparisons. Pure reading duration not recorded. | Ten sources plus one feed; per-source times above | 0:45.531 audio import; 0:57.182 key points; 0:11.698 quiz grading; 0:20.103 recall feedback; 2:05.221 background drafting | Podcast recovery required a separate file download and import; formula comparisons on two opens. Search/download/comparison minutes not recorded. |
| 2 | 0:43.048 | Scan and slides, with two saved annotation notes; duration not recorded | None | 0:13.239 Explain grading, within review time | Blank Original view required an external scan comparison; duration not recorded. |
| 3 | 0:00 | Notebook, output, note and recall on phone; duration not recorded | One notebook; import completion timer not captured | 0:00.233 opening saved notebook to readable text | Image display prevented by test adapter; excluded from product loss total. |
| 4 | 1:32.714 | Search/reopen, scan verification, reimport, audio playback check; duration not recorded | None | 0:33.111 total Explain requests, within review time; 0:00.261 reimport | Blank Original view recurred; two pages checked. Duration not recorded. |

The largest wait was background drafting; the largest unavoidable interruption before the quiz was finding its key points. Neither was an unlabelled blank wait. No reliable total of unlabelled >1-second waits or unacknowledged >100-ms presses was captured; the timers below measure specific transitions and requests, not every frame of input feedback.

## Felt slow

Every recorded task-level timing and every bridge operation longer than one second is listed, slowest first, in [timings.md](timings.md). Short bridge calls for background list refreshes remain in [requests.jsonl](requests.jsonl). Different clocks/endpoints must not be added as if separate waits. Highlights:

| Day | Operation | Measured wait | What the learner saw |
|---|---|---:|---|
| 1 | Draft exercises | 125.221 s request | Finish completed; drafting continued in the background. Still-drafting source-review message not conclusively tested. |
| 1 | Find quiz key points | 57.182 s request | “Finding the key points…”; quiz delayed. Earlier 54.777 s note used an incomplete observation interval and is not the full wait. |
| 1 | Import direct MP3 | 45.531 s request | Generic Adding progress; dismissing the add box did not cancel the import. |
| 1 | Recall feedback | 20.103 s request | Feedback arrived without the earlier stale-quiz failure. |
| 4 | Explain, long-run frequency | 13.624 s request; 13.920 s press-to-feedback | “Checking your answer…”; rating controls available already. |
| 2 | Explain, conditional denominator | 13.239 s request | “Checking your answer…”; rating controls available already. |
| 4 | Explain, overlapping lists | 9.843 s request | Same labelled wait. |
| 4 | Explain, equally likely outcomes | 9.644 s request; 9.903 s press-to-feedback | Same labelled wait. |
| 1 | Two finish-quiz grades | 6.591 s / 5.107 s requests | Fast 47/236 ms measurements were control transitions, not completed grading. |

## What passed

- Six local original files remain byte-identical to the files added, including the scanned PDF after reimport.
- EPUB parts/chapters and notebook code/output structure survived the sampled completeness checks.
- PDF and PowerPoint imports preserve their sampled teaching content; all 58 PowerPoint slide markers are present.
- Embedded Altair charts render, and unsupported external-data charts are disclosed rather than silently absent.
- Direct audio has a kept MP3, timed transcript, 39:07 duration, working Play/Pause and seek.
- The podcast feed becomes a subscription with Undo; Wikipedia imported successfully in this run.
- Highlighting, Key point marking, annotation notes, source notes, recall, and the two-question finish quiz saved.
- Day-2/day-4 exercises were relevant and answerable; manual ratings, not AI suggestions, determined saved ratings.
- Simulated day changes, future due dates, session totals and rounded review-minute rings agree with the files.
- Phone notebook text equals Mac text; note reopening and no-AI Finish saved correctly and named the Mac handoff.
- Search found learned material across text, notes, Key points and exercises.
- Reimport from an unchanged kept PDF preserved the highlight and note exactly.

## Evidence and limits

The main friction record is [log.md](log.md); the unedited running notes are [journey-notes.md](journey-notes.md). [requests.jsonl](requests.jsonl) holds measured bridge requests and CLI responses; binary-file response bodies were removed from that log because the originals are retained separately. [day3-indexeddb-final.json](day3-indexeddb-final.json) captures phone writes. `day1-final.json`, `day2-final.json`, `day4-before.json` and `day4-final.json` capture library Markdown/YAML/log records. Screenshots are at 2×; phone viewport was 390 × 844 with touch. Only one owned context and at most two pages were used; owned pages/context and the finite driver were closed at the end. No tests, fixes, commits, or findings-register edits were made.
