# Mac UX sweep — round 10

Tested the supplied Mac release build at `http://localhost:1761/`, bridge `1762`, in connected WebKit at 1280×800 with 2× screenshots; checkout `8cfe0cc0a9d6d1d96be854f116362add0eb5b4c7`. Covered the Claude Academy import fix, its lesson reader, the round-9 chat-list fix, and two broad journeys starting from fresh pages: three source kinds each, reading, highlights and notes, a tutor question, a new skill and filing, review, Settings, ⌘K, and leaving/reopening. The fresh pages reused the assigned seeded library; they were not empty-library resets. Earlier reports guided the additional checks toward folded transcripts and navigation into their passages. Skipped iPhone, the named exclusions, pending-save Undo, exhaustive repetition of earlier passed paths, visual taste, real AI, native integration and actual YouTube playback. **Three findings: two S2 and one S3. No S1 or data loss observed.** All tester-written files are under `codex-out/mac/`; library changes came through the app.

## Findings

### MAC-1 — Find loses transcript matches and still says “Not found” after the transcript is shown

**S2 · Mac · 2/2 dedicated fresh-page confirmations**, in addition to the exploratory reproduction.

1. From a fresh app page, add `https://academy.claude.com/courses/ai-fluency-framework-foundations` if it is not already present. Wait for its lessons to import.
2. Use ⌘K to open **Introduction to AI Fluency**. Leave **Video** expanded and **Transcript** visible.
3. Press ⌘F and search for `Joe Feller`: it reports **1/1**.
4. Close Find. Click **Transcript** to hide it, then repeat the same Find search.
5. Click **Transcript** to show it again without changing the search.
6. Change the query to `Joe Felle`, then back to `Joe Feller`.
7. Also hide the transcript, go Home, and use ⌘K to search `Cork University`. Click the **Introduction to AI Fluency** result that quotes those words.

**Expected:** Find in source should locate the saved passage, revealing its transcript when necessary. At minimum, showing the transcript must refresh the matches. A library search result should open the passage it quotes.

**Actual:** Step 4 says **Not found**. Step 5 still says **Not found**, even with the matching text visible. Only editing the query restores **1/1**. The library-search route also leaves the transcript hidden and opens Find on **Not found**. A learner must guess that the transcript toggle and a query edit are needed.

**Evidence:** [Run 1 hidden](confirm-1-find-folded.png), [run 1 reopened but still not found](confirm-1-find-reopened.png), [run 1 after editing the query](confirm-1-find-refreshed.png); [run 2 hidden](confirm-2-find-folded.png), [run 2 reopened](confirm-2-find-reopened.png), [run 2 refreshed](confirm-2-find-refreshed.png). Library-search landing: [run 1](confirm-1-library-search-hidden.png), [run 2](confirm-2-library-search-hidden.png). [Measured results](folded-confirmations.json), [bounded reproduction](confirm-folded.cjs).

**Code cause:** `apps/desktop/src/Find.tsx:73` excludes invisible text. Its observer at **219** watches child/text changes but not attributes. `apps/desktop/src/Reader.tsx:560` hides/shows the already-mounted transcript with the `hidden` attribute, so showing it does not recalculate Find. The library-search jump at **1265–1269** sets Find's query without revealing the transcript. D219 names this scope “source”; its exclusions name the Original tab and tutor, not the source's own transcript.

**Not the mock:** This uses saved transcript text and ordinary local display/search state. No failure, delay or AI hook is involved. The phrase is present in `doc.md`; changing only the query recovers the result. The native player's absence is unrelated to matching text.

### MAC-2 — Opening a collected transcript highlight leaves its passage hidden and clips the popup

**S2 · Mac · 2/2 dedicated fresh-page confirmations**, plus the exploratory reproduction.

1. From a fresh page, open **Introduction to AI Fluency** with its transcript visible.
2. Highlight `I'm Joe Feller.` and write a highlight note. This run used **The course begins with its instructors.** Close the popup with Escape.
3. Click **Transcript** to hide it. Open the **Collected** side-panel tab.
4. Expand **Highlights** and click **I'm Joe Feller. 0:00** once.

**Expected:** Reveal and scroll to the highlighted passage, with its note/actions visible beside it.

**Actual:** The transcript stays hidden. The popup appears at the top of the reader rather than at a visible passage, with its upper controls clipped by the reader's top boundary. The learner sees the note but cannot see the quoted sentence in context. In both confirmations the popup began at viewport `y=14`, and its Key point control at `y=27`. Searching the highlighted phrase through ⌘K also reached this hidden-passage popup during exploration.

**Evidence:** [Run 1](confirm-1-highlight-hidden.png), [run 2](confirm-2-highlight-hidden.png), [exploratory view](academy-collected-folded.png), [measurements](folded-confirmations.json), [reproduction](confirm-folded.cjs). The `stillHidden: "false"` field is the **Transcript button's `aria-pressed` value**: false means hidden.

**Code cause:** `apps/desktop/src/Reader.tsx:1879–1887`, `jumpToHighlight`, obtains the range and immediately scrolls and opens its popup without revealing the containing transcript. `popupAt` at **1818–1825** positions it using that hidden range's rectangles. The transcript remains hidden through **560**. This is a separate navigation path from MAC-1's Find matching/recounting.

**Not the mock:** The highlight and its note are saved by the real CLI and reopen correctly with the transcript visible. The defect is the production reader's response to its ordinary fold toggle; no artificial failure or timing is required.

### MAC-3 — “Open on YouTube” opens Claude Academy instead

**S3 · Mac · 2/2 dedicated fresh-page confirmations**, plus the exploratory reproduction.

1. From a fresh page, open **Introduction to AI Fluency**.
2. When the embedded player shows its error recovery action, click **Open on YouTube ↗**. The supplied harness naturally reaches this state because it has no native player port.
3. Inspect the URL sent to the opener (`window.__ORE_OPENED` in this harness).

**Expected:** Open the lesson's saved video URL, `https://www.youtube.com/watch?v=JpGtOfSgR-c`.

**Actual:** The action sends `https://academy.claude.com/courses/ai-fluency-framework-foundations/introduction-to-ai-fluency`. That is a working lesson page, but it is not the promised destination; the learner must find the video there again.

**Evidence:** [Run 1 button](confirm-1-youtube-link.png), [run 2 button](confirm-2-youtube-link.png), [captured opener arguments](youtube-link-confirmations.json), [bounded reproduction](confirm-youtube-link.cjs), and the saved `video`/`url` fields in [library evidence](library-evidence.json).

**Code cause:** `apps/desktop/src/Video.tsx:470` labels the error action **Open on YouTube**. The embedded article player receives `openOriginal(doc)` from `apps/desktop/src/Reader.tsx:3575`; `apps/desktop/src/original.ts:33` opens `item.url`, ignoring `item.video`.

**Not the mock:** The harness causes the player-error state and records the opener argument. It does not choose that argument: production code sends the lesson URL for this action on any player error. This finding concerns the wrong recovery destination, **not** the missing native player or a claim that native playback failed.

## Known rows seen come back

None confirmed. **F517** is fixed on the tested live course: all 14 lesson records were saved, and the first two lessons now contain video metadata and timed transcripts alongside their page text. The first includes “I'm Joe Feller” and the matching VTT file. **F521** is fixed: a failed chat-list read shows its reason and **Try again**; retry restores the saved chat ([failure](chat-list-failure.png), [recovery](chat-list-recovered.png)). Phone-only round-9 fixes were not tested. MAC-1 is a folded-transcript case, distinct from F443's noncontiguous search-word matching.

## What passed

- Journey 1 added **Field guide ten A** as text, **The forgetting curve** from PowerPoint, and **Retrieval practice notes** from Word; all appeared under the newly created **Practical learning ten** skill ([list](j1-skill.png)).
- Journey 2 added **Field guide ten B** as text, **How Plants Make Food** from PDF, and **A Small Book of Remembering** from EPUB; all appeared under **Transfer practice ten** ([list](j2-skill.png)).
- Both text sources retained their highlight or Key point, highlight note and source note after leaving/reopening ([first](j1-reopened.png), [second](j2-reopened.png)).
- A later edit to the first source note survived another leave/reopen ([edited again](j1-note-edited-again.png)).
- Both ordinary tutor questions showed a visible unavailable-answer error and **Try again**, with the composer still usable ([first](j1-tutor.png), [second](j2-tutor.png)).
- New skills appeared immediately, and their source lists reflected filing without a reload.
- Five ratings saved across the journeys: one in the first and four in the second, including an Explain and a New exercise ([saved ratings](review-evidence.json)); review endings returned to Home ([first ending](j1-review-end.png), [second ending](j2-review-end.png)).
- Unavailable Explain grading allowed manual key-point selection and a Good rating.
- Settings opened with ⌘, and closed with Escape in both journeys; ⌘K created skills and found/opened the new sources.
- Claude Academy's first and second lessons opened with their transcripts; Previous/Next lesson navigation worked ([first lesson](academy-introduction.png), [second lesson](academy-lesson-two.png)).
- The first Academy lesson retained its transcript highlight, highlight note and source note after a next/previous lesson round trip.
- No page errors were recorded; the final page had no outstanding bridge calls.

## Test limits and artifacts

- [driver.cjs](driver.cjs) connects to the supplied WebKit server and owns one context/page at a time; it does not launch a browser. [actions.log](actions.log) records the interactive work. Its snippets run with `return await runfile('filename.cjs');`; [helpers.cjs](helpers.cjs) supplies navigation/import helpers.
- File selection used `__ORE_PICK` with real fixture files. Text highlighting used a DOM Range and mouseup. Native Finder, clipboard/selection gestures, OS shortcuts, actual browser opening and audible playback were not verified.
- The initial course import continued while an early driver was disconnected after its wait timed out. Its 14 completed records were then checked read-only and through the reader. The bridge does not relay native lesson-progress events, so the initial “Reading the course…” label is not reported as a production progress defect. No completion-toast claim is made for that interrupted observation.
- An initial confirmation query matched the saved highlight, so it opened the highlight rather than Find. The final library-search confirmation uses the unhighlighted phrase `Cork University`; both final runs completed. Selector errors and a terminal input-length issue were harness errors, excluded from findings.
- AI/background enrichment remained disabled. Missing AI output and the prequestion wait under that setup are not findings. Review used the seed's exercises, not new AI drafts. No accelerated-clock/bonus-lap test was made.
- The three reported candidates were each reconfirmed twice from fresh pages. No fixes, findings-register edits, commits or pushes were made. No server, watcher, installed app, real library, other tester's port or folder was changed.
