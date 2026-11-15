# Five learner sessions — persona

## Summary

Five modeled learners completed **248 logged input actions** across the supplied Mac and iPhone apps: adding learning material, reading, marking Key points, writing notes, recalling, reviewing seeded exercises, and returning to saved work. **One new S2 bug** reproduced twice with text articles and twice with a video source: opening another source from the command palette can direct reader shortcuts into that source's note. No known finding is re-reported. These are simulated sessions, not interviews; the quotes below express the modeled learner's experience. AI was disabled, so subject-specific generated practice could not be evaluated. Native iPhone interaction, actual video playback, real textbook complexity, sync, and long-term retention remain outside this run. The parent’s three-day absence, backlog and ten active minutes were simulated explicitly.

## Findings

### P-01 — Opening another source leaves its note taking reader shortcuts

**S2 · Mac · Persona: self-taught programmer (Jordan).**

A keyboard learner leaves a source note, opens a different source with ⌘K, and uses a reader shortcut. The shortcut becomes text in the new source's note. This interrupts reading and introduces an unintended note edit; it did not overwrite or destroy existing content in these checks.

**Reproduce from a fresh page:**

1. Open the supplied Mac app at `http://localhost:1654/`, with bridge `1655` and the mock Tauri script initialized as the preamble specifies.
2. Use ⌘K to open **Cache keys and explicit state**, added during this run. Keep its Source note panel visible.
3. Focus the Source note editor, then press Escape once. (In the original keyboard-only session, N/Tab and typing reached this state.)
4. Use ⌘K, search **Retrieval replication beta**, and press Return to open that different source.
5. Press H, intending the reader's highlight command. Inspect the Source note.

**Expected:** Opening a different source puts keyboard input in its reader. H runs the reader command or has no effect until a passage is selected; it does not start editing an unrelated note without an edit action.

**Actual:** After navigation, `document.activeElement` is a `DIV` with `aria-label="Source note"`. The initially empty note changes from `"\n"` to `"h"`. The article opens correctly, which makes the destination of the next key particularly easy to miss.

**Reproduction:** **2/2 fresh-page article checks**, plus **2/2 fresh-page video checks**. The initial programmer session produced `k]lk` in the talk's saved `notes.md` when trying playback/seek shortcuts. The text-only checks establish that this is independent of the unavailable native video player. Extra verification characters were undone after evidence capture.

**Evidence:**

- [Article reproduction 1, 2× screenshot](screenshots/article-focus-1.png) and [focus/text evidence](article-focus-1.json).
- [Article reproduction 2, 2× screenshot](screenshots/article-focus-2.png) and [focus/text evidence](article-focus-2.json).
- [Original keyboard session](screenshots/programmer-video-transcript.png), [video check 1](screenshots/focus-check-1.png), [video check 2](screenshots/focus-check-2.png), [video focus evidence](focus-proof.json).
- [Reproduction script](reproduce-focus.cjs), executed inside [the attached-browser driver](driver.cjs).
- Read-only persistence check: `/tmp/claude-501/adhoc/lib-persona/items/2026/what-the-heck-is-the-event-loop-anyway-philip-roberts-jsconf-01M7CEHS9REQBF71D0HSA2VNFF/notes.md` contained `k]lk` after the original session.

**Suspected code, not a proven root cause:** `apps/desktop/src/Palette.tsx:273` closes the palette before running navigation; `apps/desktop/src/util.ts:203` captures and restores the previously focused element, with delayed restoration at line 218. Compare this with `apps/desktop/src/Reader.tsx:1199`, which focuses the reader when a source becomes ready. A retained/reused note editor and restoration order are worth checking. No code was changed.

## Learner sessions

An action is one logged input operation: a click/tap, key press, text entry, selection, or file choice. Counts exclude observations, screenshots, waits, failed automation calls, parent seed-validation attempts, and separate bug reproductions. A successful input does **not** mean its intended effect succeeded: ignored presses and the misdirected shortcut remain part of the experience. [The numbered action ledger](actions.md) preserves the sequence and raw log references.

| Learner | Surface and input | Count | Goal in their words |
|---|---|---:|---|
| Leah, nursing student between shifts | iPhone, touch and typed answers | 44 | “Explain absorption, distribution and half-life before my exam tomorrow.” |
| Jordan, self-taught programmer | Mac, keyboard only in the main session | 61 | “Implement a cache that never mixes locales. Test two users and two languages.” |
| Elena, retiree learning Spanish | Mac, mouse and large text, with explicit assistance | 42 | “Say hello and ask someone to speak more slowly.” |
| Nikhil, researcher | Mac, mouse and keyboard | 61 | “Find each paper, its limits and my notes when I write the review.” |
| Luis, busy parent | iPhone, interrupted review and return | 40 | “I have ten minutes. Help me do something useful, keep it when I’m interrupted, and let me stop.” |

### Leah — an exam tomorrow, a chapter and slides tonight

Created a Pharmacology exam skill and entered her goal. Added an original PDF chapter and a three-slide PDF together. Read absorption, jumped to metabolism and elimination, marked the distinction between absorption and distribution, and attached her own explanation. Added a source note with the half-life sequence. Left the reader, reopened the chapter, and recovered the annotation through Collected. Entered a free-recall answer, closed the quiz, reopened it and continued with the preserved draft. Opened the slides, jumped to Recall practice and found “half-life.” Finished with an available seeded exercise and left review.

**Outcome:** Both PDFs were readable through their ending material; her notes and interrupted recall survived. This was a short original pharmacology fixture, not a licensed textbook chapter or a test of complex tables and scanned pages. The supplied phone had no generated pharmacology exercises. Seeded review checked the interaction, not her exam preparedness. This is a harness limitation, not a missing-feature finding.

- **Most confusing:** arriving at review with unrelated seeded subjects — “I finished my chapter, but these aren't the exam topics I came to practice.”
- **Most satisfying:** returning to the annotated passage — “My explanation was still beside the marked sentence when I came back.”
- Evidence: [chapter](screenshots/nurse-chapter.png), [source note](screenshots/nurse-source-note.png), [recall result](screenshots/nurse-recall-result.png), [slide search](screenshots/nurse-find.png), [available review subjects](screenshots/nurse-review-no-pharmacology.png).

### Jordan — understand a talk and implement its lesson

Created Practical JavaScript through ⌘K. Pasted a long original blog-style article with 13 fenced JavaScript blocks. Used keyboard navigation and H to mark a passage, chose Key point, and wrote why locale belongs in a cache key. Searched to the final example marker. Imported the real Philip Roberts event-loop talk from YouTube and opened its timestamped transcript. Wrote an implementation note, switched sources through ⌘K, and encountered P-01 while trying video shortcuts. Searched the transcript for “call stack.” Returned to the code article and its saved note, then completed a seeded review rating using only the keyboard.

**Outcome:** Capture, finding the end of a long code article, annotation and saved notes worked. The main session used no mouse. The real talk imported its title and transcript, but this harness cannot validate native playback. Initial rating keys were too fast for the intentional rating delay; a later, properly paced Again rating was recorded in the scratch review log. No defect is claimed for those fast presses.

- **Most confusing:** P-01 — “I opened the talk and hit play; why did that letter go into its note?”
- **Most satisfying:** navigating a long source — “I can mark the key idea and find the last code example without reaching for the mouse.”
- Evidence: [final code marker](screenshots/programmer-find-code.png), [transcript and unintended note](screenshots/programmer-video-transcript.png), [recorded review ending](screenshots/programmer-recorded-review.png).

### Elena — enough Spanish for a first conversation

Created Spanish conversation, stated her goal, and added a short original lesson. Hid the side panel and sidebar and enlarged the text. Read slowly, marked “Mas despacio, por favor,” and added a reminder about when to say it. Wrote a short dialogue, hid the source to rehearse it, then showed it again. Entered free recall, interrupted and reopened the quiz, and completed it. Tried a seeded review exercise, chose Again, and returned through the skill's Done tab to her saved passage and reminder.

**Outcome:** The larger reader and preserved dialogue supported a manageable lesson. This was **not a fully unassisted mouse-only onboarding pass**: Return submitted the skill/import, and three text-size shortcut presses supplied the larger text. Settings does contain a text-size control; this run does not establish that it is absent or unusable. The attempted outline click missed because of the automation's target/overlay state, so it is not a finding.

- **Most confusing:** locating the way to enlarge text — “I wanted bigger words, but I needed help finding how to make them bigger.”
- **Most satisfying:** returning to her own short dialogue — “My little conversation is still here, and I can read it comfortably.”
- Evidence: [large text](screenshots/retiree-large-text.png), [source hidden for rehearsal](screenshots/retiree-hidden-source.png), [return to Collected](screenshots/retiree-return-collected.png).

### Nikhil — papers that remain findable after filing

Created Research methods, Study design, Retrieval evidence and Review writing, bringing the shared Mac library to 16 skills. Imported two fictional methods papers plus the repository's sample retrieval-practice PDF as one batch. Read the alpha paper, marked its assignment limitation, and wrote why it should not be described as randomized. Filed it under multiple skills. Searched a token present only in the body; the palette found it and opened the matching passage. Archived the paper and used Undo. Filed it under Review writing and removed Research methods, then reopened it from its destination with the annotation and synthesis intact. Completed free recall, added five more weekly-paper fixtures in another batch, reviewed a seeded exercise, and returned to the finished alpha paper.

**Outcome:** Eight new paper-like sources arrived across two batches. Search, archive/Undo, multi-skill filing and removing one filing did not lose the tested source, annotation or note. This samples a weekly workload, not thousands of papers. The invented methods papers are explicitly fixtures, not research evidence.

- **Most confusing:** the same paper belongs under several skills — “If I remove it from this subject, will I still find the paper and my notes in the other one?” The subsequent destination check answered yes.
- **Most satisfying:** searching inside a source — “I remembered one phrase, and it took me straight back to the paper and the limitation I wrote down.”
- Evidence: [body-only search](screenshots/researcher-body-search.png), [refiled source and note](screenshots/researcher-refiled-note.png), [review ending](screenshots/researcher-review-end.png).

### Luis — ten useful minutes after three days away

Opened a separate phone seed with 128 review exercises after a simulated three-day absence. Started review, answered one exercise, then left for a child interruption. Reloaded the same phone page and saw the day's time retained. Resumed, completed another three ratings including Again, and reached the ten-minute goal while work remained. Left at the offered stopping point; Home confirmed the goal was met. Added a short evening-routine reading, marked one practical step, wrote what to do after bedtime, left and recovered the annotation. Interrupted and resumed free recall, finished the source, then reopened it from Sources to verify the source note and recall remained.

**Outcome:** The stopping signal did not require clearing the backlog. The read-only core result after review was exactly **600,000 active milliseconds**, **goal met**, with **125 due** still present. His interrupted first segment counted on return. The extra source-reading actions followed the ten-minute review goal; this is not a claim that all 40 inputs or all reading fit inside ten real minutes.

- **Most confusing:** review setup before the first exercise — “I pressed Start review; now I'm choosing subjects before I've started.” This was also observed in the earlier report and is not a new finding.
- **Most satisfying:** time survived the interruption — “The time I did before the interruption still counted, and ten minutes was enough.”
- Evidence: [cold start](screenshots/parent-cold-start.png), [retained progress](screenshots/parent-progress-retained.png), [goal met during review](screenshots/parent-goal-met.png), [goal ending](screenshots/parent-goal-ending.png), [returned note](screenshots/parent-return-note.png), [exact core result](parent-proof.json).

## Known rows seen again

**No confirmed regression of a fixed row.** Checked the earlier persona report and `docs/reviews/findings.md`. P-01 concerns focus after changing reader sources; it is distinct from the registered review-start focus race (F64), note-history Undo behavior, and keyboard highlight-endpoint editing (F111). The earlier report's Wikipedia feed offer, skill-deletion confirmation/copy, and stale Undo label are not re-reported. A common observation about the review subject picker is retained only as Luis's session context.

## What passed

- iPhone batch import displayed both original PDF fixtures through their ending material.
- iPhone chapter annotations and source notes survived leaving and reopening the source.
- Free-recall drafts survived closing and reopening the quiz in the nursing, Spanish and parent sessions.
- Mac keyboard capture, passage marking and final-marker search worked on the long code fixture.
- The real YouTube talk imported a titled, timestamped transcript searchable by phrase.
- Enlarged reader text and hiding the source supported the Spanish rehearsal.
- Body-only search returned the correct research paper and opened its matching passage.
- Archive/Undo restored the research paper; filing changes preserved the tested annotations and notes.
- Two research import batches produced all eight intended sources.
- Properly paced keyboard review wrote a recorded rating to the Mac scratch library.
- Phone review progress survived a reload after interruption.
- Phone goal completion appeared at ten active minutes despite a remaining due backlog.
- Completed sources could be reopened with saved notes and recall visible.

## Test conditions and limits

- Connected to the supplied WebKit service; did not launch, restart or stop supplied services. Mac: 1280×800 at 2×, port 1654, bridge 1655, assigned scratch library only. Phone: 390×844 at 2× with touch/mobile options, port 1658, each learner's page retained during their journey.
- The three Mac learners used the same assigned library sequentially. Their new skills/materials were distinct, but seeded exercises and shared preferences were not isolated accounts. The two phone learners had separate browser copies.
- AI enrichment, tutoring and grading were disabled by the harness. New-source free recall was usable, but seeded exercises substituted for generated subject-specific review. This does not validate exercise quality, pharmacology coverage or grading accuracy.
- The pharmacology PDFs and Spanish/parent lessons were short original fixtures. The code article was a local blog-style fixture, not an imported remote blog. The research batch mixed original Markdown fixtures and an existing sample PDF. These tests do not establish robust intake of a full textbook, scanned slides, complicated formulas or real weekly paper feeds.
- Phone text selections used a scripted DOM range followed by the app's pointer event. That verifies annotation actions and persistence, not native selection handles. Native keyboards, safe areas, share sheets, app lifecycle and device sync were not tested. Slow reading was modeled by task choices, not a measured human reading speed.
- The parent setup substituted a browser-only seed response containing 120 additional synthetic exercise copies, valid IDs and older reviews, then advanced the phone clock three days. Four review intervals were each advanced by 150 seconds. No library disk file was edited for this setup. Clones test backlog and goal behavior, not content variety or queue-ranking quality. [Setup](parent-setup.cjs) and [seed](parent-seed.json) are retained.
- Raw actions include failed automation calls and setup attempts. They are explicitly excluded from the 248 count. Research batch file selections were performed through the file input; associated dialog/input actions are logged, but unlogged setup operations are not added to the totals. The parent's first four Start review probes belong to seed validation, not the learner session.
- Reader-side AI waiting copy was visible in some captures; this run does not establish an unbounded wait or a new failure-state defect. Video playback was unavailable through the supplied native bridge, so attempted playback keys are not a playback pass.
- Evidence is screenshots, accessibility snapshots, logged input, and read-only persistence checks. It is not human usability research or a learning-outcome study. No missing capability is promoted to a bug; no new capability idea was established strongly enough to report separately.
- Source checkout inspected: `1ffe1feb28498fb80607b16f48c8a38fa6739afd`. This identifies inspected code, not an independently verified build artifact hash. No source, finding-register or configuration changes; no implementation tests or commits were made. All new artifacts are under `codex-out/persona/`.
