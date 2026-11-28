# Importer: three days learning Greek and Persian history

Tested the release Mac web build at `http://localhost:1764/`, bridge `1765`, in the supplied WebKit, at 1280×800 and 2× screenshots. Started with the empty importer library. Day 1 (November 28) attempted 18 imports, producing 35 sources including a 24-lesson Yale course; read and annotated the Persian Wars textbook excerpt, wrote a source note and recall, and completed its three-question quiz. Day 2 (November 29) completed one Fact and one Explain review, interrupted/resumed an answer, read the PDF spreads and EPUB preface/footnotes, and checked three repaired behaviors. Day 3 (November 30) reimported the annotated PDF and EPUB from kept originals, then repeated the problematic photo recognition. **Two new S2 findings:** blank textbook maps and silently garbled Greek photo text. No S1 or confirmed known-row recurrence. Coverage limits: the PDF spread was a derived two-up layout, **not a native two-column textbook with footnotes**; the slide was a tester-made teaching slide; the captionless video was a silent film, so captionless *speech* was not covered. Wikipedia and lesson sites refused access, and the Apple episode failed transcription with a recovery instruction. No iPhone journey, whole-course viewing, full 308,000-word book reading, or mathematical/code-source fidelity claim. No tracked repository files changed.

Build checkout: `bc54898cb31499443087573de5778a6848b685cc`. Materials, rights and substitutions: [provenance](materials-provenance.md). Main chronological output: [friction log](log.md). Measurements: [all waits](waits.md), [raw actions](timings.json), [request trace](requests.jsonl). Library checks: [verification](verification.json), [inventory](final-inventory.json).

## Findings

### 1. Textbook maps become empty rectangles without a warning — S2, Mac

**Learner cost:** I needed the maps to connect Ionia, mainland Greece and the Persian invasion routes. The surrounding text and map captions looked successfully imported, but the maps themselves contained no geography. I had to switch to the Original pane. This interrupted the main reading on both Days 1 and 2; reimport on Day 3 did not repair it.

1. From a fresh Mac page, use All sources → Done → **The Persian Wars — World History textbook excerpt**. For a new scratch library, add the supplied [persian-wars.pdf](persian-wars.pdf) through the Add box first.
2. Scroll to the figures around “Map 5.6” and “Map 5.7.”
3. Open the side panel’s **Original** tab and compare the same PDF page with the extracted figure.
4. Repeat with All sources → To read → **Persian Wars — two-page textbook spreads** ([two-column-history.pdf](two-column-history.pdf)).

**Expected:** maps retain their colors, boundaries and labels in the common reader format. If extraction fails, explicitly mark the missing content and give a usable next step.

**Actual:** the three ordinary-excerpt figure assets are white rectangles with dark borders. The two-up source has the same failure. The Original pane renders the colored maps correctly. Captions survive, and there is no missing-figure warning. Reimport says the ordinary excerpt is already up to date. The kept PDFs are intact, so this is incomplete imported learning content, not loss of the originals.

**Reproduced:** two distinct PDF imports, then the ordinary PDF reimport; also observed across Day 1 reading and Day 2 reopening. This is not just an image that had not loaded: the on-screen image had a nonzero natural width, and the saved PNG itself was blank.

**Evidence:** [blank map in spread](d2-two-column-blank-map.png), [correct original beside blank extraction](d2-original-beside-blank.png), [original first page](textbook-page1-original.png), [saved blank figure](asset-1909ee6744ddabe9.png), [Day 3 reimport](d3-pdf-reimport.png).

**Suspect, not isolated:** `packages/core/src/ingest/pdf-figures.ts:90` groups touching images in a changed order; its drawing loop at `:103–129` composites transparency onto white. These maps have image/soft-mask layers. That is a useful inspection point, not a proven explanation. I did not reproduce the JPEG 2000 decoder failure from F787 or the Original-pane failure from F795; the Original pane works here.

### 2. A photographed Greek page is accepted as mixed-script gibberish — S2, Mac

**Learner cost:** a usable scanned primary-source page became text I could not read, search reliably or trust for exercises. Its title was also garbled. Ore presented the result as a successful import, with no indication that recognition quality was unusable.

1. From a fresh Mac page, open All sources → To read → the image titled **“Aprayos MÈv, is novre TaûTa, Tpookuroas Kai**. In a new scratch library, add [herodotus-photo.jpg](herodotus-photo.jpg) through the Add box.
2. Compare the imported paragraphs with the original scan of printed page 18, *Tales from Herodotus*.
3. Close/reopen the page. Then use Source actions → **Reimport**.

**Expected:** recognizable Greek text, or a refusal/clear unreadable-content notice with a next step. The image may remain available, but the broken recognition should not be silently presented as the learning text.

**Actual:** Greek letters became a mixture of Latin, Cyrillic and Greek-like characters. For example, the imported paragraph begins `паретідсто тайта ти 'Артау` and another begins `ảTokalÚTTE TE Kai daßEîv`. The English section heading is recognized, but much of the Greek prose is corrupted. The generated title is also corrupted. No warning appears; reimport reports “already up to date.” The original JPEG is kept byte-for-byte and is also shown above the corrupted text in the reader; it is the usable fallback.

**Reproduced:** initial import, a fresh-page reopen on Day 2, and a second extraction through Reimport on Day 3. Import completed in 1.122 seconds; this is a quality failure, not an unfinished wait.

**Evidence:** [first result](d1-photo.png), [fresh-page repeat](d2-photo-repeat.png), [garbled paragraphs](d3-photo-garbled-paragraphs.png), [reimport repeat](d3-photo-reimport.png), [readable original scan](herodotus-photo.jpg).

**Suspect:** `packages/core/src/ingest/swift/ocr.swift:19–27` uses automatic language detection and returns only the top text candidate, without its confidence. `packages/core/src/ingest/ocr.ts:77–84` accepts text once it has 20 non-space characters and uses it for the title. I did not establish the precise language-support limitation. This is a 1200×1716 image, not the tall/small-text image cases F188/F192, or the Korean PDF text-layer issue F284.

## Import outcomes and fidelity

Times below are Enter → Add completion/refusal. They are **not uniformly time to a newly opened readable page**: while another source was open, Ore left it in place and supplied a Show action. Separate opens measured 207 ms for the ordinary textbook, 350 ms for the newsletter and 561 ms for the EPUB. More detail and measurement limits are in [all waits](waits.md).

| Kind and source | Add time | What arrived / what stopped it | Original and completeness check |
|---|---:|---|---|
| [YouTube playlist: Yale Ancient Greek History](https://www.youtube.com/playlist?list=PL023BCE5134243987) | 75.724 s | Course with 24 lessons; “Reading the course…” while adding | Each lesson has a kept VTT transcript, chapter headings and timestamps. Checked stored start/end material and sample lessons; did not watch the whole course. Original video files are not downloaded. |
| [Single video without captions: 1896 train film](https://www.youtube.com/watch?v=PMGMzEHwhs4) | 8.335 s | “Heard no speech…” with instruction to paste a transcript; no source saved | Caption and automatic-caption fields were both absent. This silent film does not validate captionless speech transcription. |
| [Apple Podcasts: Croesus on the Pyre](https://podcasts.apple.com/us/podcast/episode-13-croesus-on-the-pyre-1-85-92/id1581343461?i=1000656989254) | 16.003 s | Transcription failed with OSStatus −39; offered transcript-paste recovery; no source saved | No half-episode saved. This failed once; not promoted to a reproducible defect. |
| [Spotify: Prelude — The Greeks](https://open.spotify.com/episode/26RPG7kSxRv2drzXaofiDl) | 14.788 s | Title, podcast author, April 27 2018 date, audio player and timed transcript | Kept MP3 and VTT. Transcript reaches the closing transition to Philip II and Macedonia. No verbatim audio accuracy audit. |
| Ordinary textbook PDF, Persian Wars excerpt | 2.256 s | Title/author, prose from first to last supplied page, three outline headings and map captions | Original PDF matches supplied bytes. **Three maps blank: finding 1.** Excerpt boundaries are deliberate, not an importer truncation. |
| Derived two-up textbook PDF | 1.449 s | Both columns’ prose and three headings; map captions retained | Kept PDF matches input. **Maps blank.** Native two-column footnotes remain untested. |
| Mixed text/scan/text PDF | 1.865 s | Scanned middle page’s prose is present between surrounding text, including “Darius died in 486” and the alliance discussion | Kept PDF matches input. Targeted F790/#582 check passed; this is a constructed diagnostic variant, not an independently published edition. |
| [Standard Ebooks: Histories](https://standardebooks.org/ebooks/herodotus/histories/g-c-macaulay) | 0.644 s | Herodotus, July 6 2024 edition date, preface, nine books, outline, front/back matter and notes | Kept EPUB matches input. 1,454 note references and 1,454 note definitions present. Footnote 1 and its return link worked in one click; outline opened Book I. Sampled content, not every note. |
| [French Wikipedia: Guerres médiques](https://fr.wikipedia.org/wiki/Guerres_m%C3%A9diques) | 0.618 s | HTTP 429; retry/browser import next step; no source saved | No saved rate-limit page. |
| [German Wikipedia: Marathon](https://de.wikipedia.org/wiki/Schlacht_bei_Marathon) | 0.623 s | Same actionable 429 refusal | No foreign-language Wikipedia fidelity claim. |
| Khan Academy Greek polis lesson | 1.043 s | Bot-check refusal with browser/paste recovery | No saved challenge page. Exact URL in request trace. |
| [OpenLearn Herodotus lesson](https://www.open.edu/openlearn/history-the-arts/herodotus-and-the-invention-history/content-section-4.2) | 1.083 s | Bot-check refusal with browser/paste recovery | No saved challenge page. |
| [Newsletter: Pasts Imperfect, August 27 2026](https://pasts-imperfect.ghost.io/pasts-imperfect-8-27-26/) | 7.157 s | Title, first author, interview through the final roundup, six images | Kept HTML. The original section labels are bold rather than headings; imported outline has no headings. No full multi-author metadata claim. |
| Tester-made teaching-slide screenshot | 0.673 s | “The Persian Wars,” three summary points and image | Kept PNG matches input. Original deck ingestion not tested. |
| Public-domain photographed Greek page | 1.122 s | **Silently corrupted recognition: finding 2** | Original JPEG matches input. |
| Textbook page raster | 32.405 s | English prose and image, but map labels dominate the title (“THRACE”) and create many small headings | Kept PNG. Slowest single-image import; “Adding…” and Cancel visible. Not separately filed as a twice-confirmed defect. |
| Plain Markdown reading notes | 0.698 s | Title, attribution and supplied start-to-end text | Kept Markdown matches input; no math/code in this sample. |
| [Distill embedded-video regression probe](https://distill.pub/2020/growing-ca/) | 1.052 s | Seven MP4 links and surrounding poster/caption content instead of raw video elements | Kept HTML. Targeted #587 check only; this was outside the history learning material. |

All Add attempts showed “Adding…” or “Reading the course…” in the observation taken about 120 ms after the press, with Cancel. This does not prove the stricter 100 ms threshold. No persistent silent wait was confirmed. Refused imports were checked against the 35-source inventory and did not leave challenge pages or episode blurbs behind.

## Day-by-day saved-state checks

- **Day 1:** no rated reviews. The textbook is marked done, with `finished_at: 2026-11-28T16:14:14.469Z`; its source note and recall survive. Five exercises were drafted. One live PDF Key point carries the alliance note. A second highlight was created and deleted on Day 1; it was already absent before reimport and is not counted as reimport loss.
- **Day 2:** two reviews saved on November 29 at 16:03:20.513Z and 16:03:57.907Z. Active durations are **29,357 + 37,247 = 66,604 ms**. Neither hits the three-minute per-exercise cap. End screen shows **1 minute, 2 memories kept, +5 days of memory**; session file agrees on 2 kept and depth_days 5. Both recorded ratings are Good (3), due December 7. Explain’s AI suggestion was Hard (2), but my chosen Good was recorded, as required.
- **Day 2 interruption:** the saved draft retained the answer and **18,841 ms**. Its eventual review recorded 29,357 ms, consistent with resumed active time. No rating was saved for the interrupted session itself.
- **Day 3:** Home reset to **0 of 10 minutes**. The two rated exercises remain due December 7. The app’s due response contains exactly the three remaining unrated textbook exercises; the first one offered is the Ionian Revolt question. I left without rating, and the saved session has zero reviews.
- **Day 3 reimport:** PDF and EPUB return `changed:false`, `removed:[]`, `unplaced:[]`. Their annotation event files are byte-identical to the Day 2 snapshots; both live Key points and the PDF note remain visible in Collected. This checks unchanged-original reimport, not migration after an extractor upgrade or changed content.

Evidence: [Day 2 draft](d2-draft-after-escape.json), [Day 2 end screen](d2-review-end-settled.png), [Day 3 home](d3-home-settled.png), [PDF highlight](d3-pdf-highlight-retained.png), [EPUB highlight](d3-epub-highlight-retained.png), [saved-state audit](verification.json). Review time counting was checked in `apps/desktop/src/review-session.ts:371–396` and `packages/core/src/study.ts:140–142`.

## Known rows seen again

**No confirmed recurrence.** Targeted checks that held:

- **F796 / #562:** interrupted answer and accumulated review time survive leaving and returning.
- **F790 / #582:** the scanned middle PDF page is read in place, including its prose.
- **F869 / #587:** web video demonstrations become safe MP4 links; [visible result](d2-safe-video-link.png).
- **F739:** page day changes reach real saved review/session timestamps and the next day’s goal resets.
- **F649:** EPUB front matter is collapsed while the reading content and outline remain available.

This is not a claim that every fix in those PRs was exercised. In particular, math fixes and the requested native two-column footnotes were not covered. Known open findings and pure visual preferences were not re-reported.

## What passed

- The empty-library add flow imported a 24-lesson course and kept each lesson’s transcript.
- Failed imports showed a reason and next step and did not create misleading sources.
- Spotify supplied playable audio, dated author metadata and a transcript reaching the closing material.
- PDF prose, outline headings, source note and recall survived reopening across days.
- Finish presented recall and a three-question quiz; checking/AI work had visible wait states.
- Both review kinds completed; the learner’s rating overrode the AI suggestion.
- Leaving review preserved the draft’s answer and active time.
- End-screen review count and minutes matched the saved events.
- EPUB note navigation returned to the referring passage; the outline opened Book I.
- Original PDF pages rendered correctly, providing a workaround for blank extracted maps.
- Kept originals were present; local PDF, EPUB, Markdown and image bytes matched the supplied files ([hash checks](original-checks.json)).
- Reimport preserved live annotations and notes in both annotated sources.

## Where the minutes went

These are measured components, **not a fabricated full-day time budget**. Browser inspection, source acquisition and automation repairs were interleaved. Reading time beyond the recorded interval was not separately measured. “Lost” means learner recovery effort, not Playwright selector retries.

| Day | Review | Reading | Adding | Waiting | Lost |
|---|---|---|---|---|---|
| 1 | 0 rated-review minutes | 0.86 min recorded textbook reading/annotation interval before Finish; later reading not separately timed | 2.77 min total Add completion/refusal time across 18 attempts | Add time overlaps the preceding column. Quiz key-points/checks/recall feedback total 1.26 min of request time; exercise drafting took another 0.90 min in background | Needed Original view for maps and could not use the Greek transcription. Recovery minutes not isolated. |
| 2 | **1.11 min saved active time** | Read PDF spreads and EPUB preface/notes; duration not separately isolated from audit work | None | Explain grading **11.877 s**, within the review interval. Source opens 0.269–0.469 s, plus EPUB reopened at 0.458 s. Annotation Key-point write took 1.595 s in the bridge | Repeated map workaround and rejected Greek text as usable learning material. Duration not isolated. |
| 3 | 0 rated-review minutes | Verified Collected and compared saved annotations; duration not isolated | No new sources | PDF reimport **1.308 s**, EPUB **1.224 s**, photo repeat in the full wait table | Reimport did not recover either broken extraction. No additional quantified recovery time. |

The 75.7-second playlist import, 32.4-second page-image import and 36.4-second quiz preparation were the largest foreground pauses. They had visible activity states, so they are friction measurements rather than separate silent-wait findings.

## Felt slow

Every recorded action timing and every bridge request taking at least one second is listed below, slowest first. Bridge rows overlap action rows; do not sum both. Feed discovery and exercise drafting may be background work. Timing labels describe their actual endpoint and should not be read as uniformly “time until all content was rendered.”

Action timings use performance.now() from press to the stated endpoint. Bridge timings measure request to response. These overlap and must not be summed together. Add endpoints are completion/refusal, not necessarily the new reader; open-source timings include a screenshot and stop when its header is available. Polling contributes up to about 400 ms to Add times. UI checks used a 120 ms observation, not proof of a response inside 100 ms. Automation selector timeouts are excluded.

| Day | Seconds | Measurement | Action |
|---|---:|---|---|
| 1 | 75.724 | action | d1-playlist |
| 1 | 75.593 | bridge | add https://www.youtube.com/playlist?list=PL023BCE5134243987 --course |
| 1 | 54.183 | bridge | enrich 01M8HEJ24WX0YW4CD61X8WDRNJ |
| 1 | 36.395 | bridge | key-points 01M8HEJ24WX0YW4CD61X8WDRNJ |
| 1 | 32.405 | action | d1-printed-page |
| 1 | 32.111 | bridge | add /Users/tylerpoelking/Developer/ore-wt/learner4/codex-out/importer/printed-page.png |
| 1 | 18.108 | bridge | recall 01M8HEJ24WX0YW4CD61X8WDRNJ --feedback |
| 1 | 16.003 | action | d1-apple |
| 1 | 14.788 | action | d1-spotify |
| 1 | 14.413 | bridge | add https://open.spotify.com/episode/26RPG7kSxRv2drzXaofiDl |
| 1 | 13.920 | bridge | add https://podcasts.apple.com/us/podcast/episode-13-croesus-on-the-pyre-1-85-92/id1581343461?i=1000656989254 |
| 2 | 11.877 | bridge | grade 01M8HF0RBK8X8AT396822XDSHH --answer=I would show separate Greek city-states facing the same Persian invasion, then joining an alliance. A map could follow Spartan land resistance at Thermopylae and the Athenian fleet at Salamis. Their cooperation made belonging to a wider Greek community meaningful even while the cities remained politically separate. |
| 1 | 8.335 | action | d1-silent-video |
| 1 | 7.889 | bridge | check 01M8HEJ24WX0YW4CD61X8WDRNJ 1 |
| 1 | 7.330 | bridge | check 01M8HEJ24WX0YW4CD61X8WDRNJ 3 |
| 1 | 7.157 | action | d1-newsletter |
| 1 | 6.695 | bridge | add https://pasts-imperfect.ghost.io/pasts-imperfect-8-27-26/ |
| 1 | 6.120 | bridge | check 01M8HEJ24WX0YW4CD61X8WDRNJ 2 |
| 1 | 5.933 | bridge | add https://www.youtube.com/watch?v=PMGMzEHwhs4 |
| 1 | 2.256 | action | d1-textbook |
| 1 | 2.013 | bridge | feed find https://podcasts.apple.com/us/podcast/episode-13-croesus-on-the-pyre-1-85-92/id1581343461?i=1000656989254 |
| 1 | 1.919 | bridge | feed find https://www.youtube.com/watch?v=PMGMzEHwhs4 |
| 1 | 1.891 | bridge | feed find https://www.youtube.com/watch?v=PMGMzEHwhs4 |
| 1 | 1.865 | action | d1-mixed-scan |
| 1 | 1.792 | bridge | course preview https://www.youtube.com/playlist?list=PL023BCE5134243987 |
| 1 | 1.791 | bridge | feed find https://www.youtube.com/watch?v=PMGMzEHwhs4 |
| 1 | 1.751 | bridge | add /Users/tylerpoelking/Developer/ore-wt/learner4/codex-out/importer/persian-wars.pdf |
| 1 | 1.749 | bridge | feed find https://podcasts.apple.com/us/podcast/episode-13-croesus-on-the-pyre-1-85-92/id1581343461?i=1000656989254 |
| 2 | 1.595 | bridge | annotate 01M8M0VXQ9JER4WYH7EE566W5K --intent |
| 1 | 1.570 | bridge | feed find https://open.spotify.com/episode/26RPG7kSxRv2drzXaofiDl |
| 1 | 1.449 | action | d1-two-column |
| 1 | 1.425 | bridge | add /Users/tylerpoelking/Developer/ore-wt/learner4/codex-out/importer/mixed-scan-history.pdf |
| 3 | 1.308 | action | Reimport annotated PDF from kept original |
| 3 | 1.224 | action | Reimport annotated EPUB from kept original |
| 1 | 1.122 | action | d1-photo |
| 1 | 1.106 | bridge | feed find https://podcasts.apple.com/us/podcast/episode-13-croesus-on-the-pyre-1-85-92/id1581343461?i=1000656989254 |
| 1 | 1.083 | action | d1-openlearn |
| 1 | 1.052 | action | d1-video-link-regression |
| 1 | 1.043 | action | d1-khan |
| 3 | 1.023 | action | Repeat Greek photo recognition from original |
| 2 | 0.840 | action | Show PDF original beside text |
| 2 | 0.832 | action | Resume interrupted review |
| 1 | 0.698 | action | d1-markdown |
| 1 | 0.673 | action | d1-slide |
| 1 | 0.644 | action | d1-epub |
| 1 | 0.623 | action | d1-german |
| 1 | 0.618 | action | d1-french |
| 1 | 0.561 | action | d1-epub-open |
| 2 | 0.469 | action | d2-video-link-check |
| 2 | 0.458 | action | d2-epub-reopened |
| 2 | 0.454 | action | d2-epub-open |
| 2 | 0.425 | action | d2-photo-repeat |
| 2 | 0.413 | action | Day 2 start review |
| 2 | 0.394 | action | d2-two-column-open |
| 1 | 0.350 | action | d1-newsletter-open |
| 3 | 0.333 | action | d3-photo-before-reimport |
| 2 | 0.269 | action | d2-mixed-open |
| 2 | 0.229 | action | Rate first exercise Good |
| 1 | 0.207 | action | Open textbook to readable |
| 2 | 0.175 | action | EPUB footnote return |
| 1 | 0.155 | action | Finish to recall screen |
