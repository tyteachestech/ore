# Mac UX sweep — round 7

Tested the supplied release build at `http://localhost:1761/`, bridge `1762`, using the supplied WebKit server, 1280×800 and 2× screenshots. Source revision: `36342bd9fe29bf74647754f75e2ac94fc62b2b9b`. Ran two learner journeys starting on fresh pages: three source kinds per journey, reading and highlighting, highlight and source notes, a tutor question, a new skill with the three sources filed into it, review, Settings, ⌘K navigation, and returning to saved work. Different material exposed chapter-recall paths: a roughly 13,000-word Spanish EPUB, an illustrated PDF, Spanish notes, a real YouTube transcript with chapters, a second Spanish EPUB, and a Korean PDF. Confirmed the three findings below twice and checked their production code. Read the working agreements, daily-session design, findings register, sweep history, and rounds 5 and 6 reports. Skipped their detailed already-passed paths, excluded rows, pending-save Undo, iPhone, visual taste, real AI, and native OS integration. No injected delays or failures were needed. Tester-written files are confined to `codex-out/mac/`; scratch-library changes went through the app. No application or repository documentation was edited.

A fresh page does not reset the scratch library. The second journey retained the first journey's saved work. One browser context and one page were used at a time. All tester pages and the context were closed at the end; supplied services were left running.

## Findings

### MAC-1 — Video chapter recalls cannot be saved

**S2 · Mac · reproduced 2/2 fresh-page confirmations.** A learner can write the offered chapter exercise, but cannot complete it or get feedback.

1. From a fresh page, use Add to import `https://www.youtube.com/watch?v=kCc8FmEb1nY` — **Let's build GPT: from scratch, in code, spelled out.** This run imported the real title, author, transcript, timestamps and chapter headings.
2. Open the source and scroll to the first **Recall this chapter** sign, after the introductory chapter.
3. Click it and type a recall into the first prompt in Source note.
4. Press ⌘Enter to submit. Wait for the save to finish.
5. Leave for Home and reopen the video. Repeat the same chapter recall from another fresh page.

**Expected:** Save the chapter recall, remove its recall sign, and proceed to feedback or a recoverable feedback error. D115 explicitly includes a video's own chapters.

**Actual:** A red toast says `Recall not saved: item … has no <!-- chapter 1 --> marker`. All 16 chapter-recall signs remain. The writing survives in Source note, but no chapter recall is recorded and no feedback request is reached. Repeating the offered action produces the same internal-format error, with no useful next step.

**Evidence:** [first failure](video-recall-1-error.png), [second failure](video-recall-2-error.png), [first reopened note](video-recall-1-reopened.png), [second reopened note](video-recall-2-reopened.png), [results](video-recall-results.json), [script](confirm-video-recall.cjs), [saved library evidence](library-evidence.json).

**Code:** `apps/desktop/src/Margin.tsx:22–25` creates YouTube chapter entries from `###` headings when the body has no chapter comments. `apps/desktop/src/Reader.tsx:1562` submits those entries to `recall --chapter`. `packages/core/src/notes.ts:212` rejects a chapter unless its literal `<!-- chapter N -->` comment exists; the imported video has headings but no such comments. `packages/cli/src/cmd-ai.ts:188` calls that production function. This is not the unavailable player or the null AI response: the bridge runs plain `recall --text` through the real CLI (`apps/desktop/scripts/mock/bridge.ts:30–45`), and this validation fails before AI feedback.

### MAC-2 — Chapter recall has no visible submit control; Finish opens a different recall

**S2 · Mac · reproduced 2/2 fresh-page confirmations.** The natural pointer path leaves the learner guessing how to submit what they just wrote.

1. From a fresh page, open the imported **El cuaderno del aprendizaje 2** EPUB. The fixture is [long-spanish-2.epub](long-spanish-2.epub).
2. Scroll to the first **Recall this chapter** sign and click it.
3. Write an answer under the chapter heading in Source note.
4. Look for a way to submit that answer. The note has three prompts, but no Submit, Check, Done or chapter-completion control, and no nearby ⌘Enter instruction.
5. Click the visible **Finish** button at the top of the source.

**Expected:** A visible action submits the current chapter recall. If Finish continues to mean the whole source, chapter recall needs its own discoverable submission action.

**Actual:** Finish opens a separate quiz asking **“What do you remember from ‘El cuaderno del aprendizaje 2’?”**, with an empty answer field and **Just mark done / Skip**. It does not submit the chapter answer. The written chapter draft is preserved, so this is confusion and a blocked pointer path, not lost writing. Keyboard submission works for the EPUB only when the learner knows ⌘Enter.

**Evidence:** [first chapter draft](confirm-chapter-1-draft.png), [first Finish result](confirm-chapter-1-finish.png), [second chapter draft](confirm-chapter-2-draft.png), [second Finish result](confirm-chapter-2-finish.png), [observed controls and results](chapter-results.json), [script](confirm-chapters.cjs). The script's later Undo probe did not submit a recall after leaving this separate quiz; it is **not** evidence for MAC-3.

**Code:** `apps/desktop/src/Reader.tsx:2507–2509` is the only call to `endBlock(true)`: a keyboard handler. The visible Finish button at `Reader.tsx:3608–3612` always calls `setFinishing(true)`, and its hint advertises the whole-source shortcut. Chapter scaffolding (`Reader.tsx:1501–1508`, `1530–1533`) adds no completion control. This conflicts with the interaction agreement's visible-control path for every action; D115 defines ⌘Enter submission but does not exempt chapter recall from a pointer path. No mock behavior is involved.

### MAC-3 — A completed chapter recall has no Undo

**S2 · Mac · reproduced 2/2 fresh-page confirmations, on chapters 1 and 2.** Once submitted, the chapter remains marked recalled, and its recall action cannot be restored with Undo.

1. From a fresh page, open an EPUB chapter that has not been recalled. The confirmations used the two chapters of **El cuaderno del aprendizaje 2**.
2. Click **Recall this chapter**, write an answer, and press ⌘Enter directly, without opening the whole-source Finish quiz.
3. Wait for the save to complete and the recall sign to disappear. In this harness, the subsequent feedback request ends with a visible error; the recall itself is already saved.
4. Click Home, then press ⌘Z.
5. Reopen the book. Repeat on a second unrecalled chapter from a fresh page.

**Expected:** Undo reverses completion of that chapter recall and restores its recall action, retaining the writing as an editable draft.

**Actual:** ⌘Z changes nothing. The first run's recall-sign count stays at **1**, down from **2** before submission; the second stays at **0**, down from **1**. Both `chapter_recalls` entries remain in the saved source and both answers remain in the note. There is no Undo toast or other visible way to take back the completion.

**Evidence:** [first saved recall](recall-undo-1-saved.png), [first after Undo and reopening](recall-undo-1-reopened.png), [second saved recall](recall-undo-2-saved.png), [second after Undo and reopening](recall-undo-2-reopened.png), [counts and notes](recall-undo-results.json), [script](confirm-recall-undo.cjs), [persisted chapter records](library-evidence.json).

**Code:** `apps/desktop/src/Reader.tsx:1558–1570` flushes the note, writes the recall, updates `chapter_recalls`, and asks for feedback, without registering an undo/redo action. `Reader.tsx:1429` derives the hidden recall signs from those records. `packages/core/src/notes.ts:213–218` persists them. These confirmations waited for completed saves and navigated away before Undo; they do **not** exercise the excluded pending-save `whileOut` class. The null feedback reply occurs after the real recall write and does not create the missing history entry.

## Known rows seen come back

None confirmed. The video chapter-save failure is separate from F329/F330's handling of empty AI answers and from the native-player limitation. The ordinary completed-recall Undo omission is separate from F481/F487's pending-write ordering.

## What passed

- Journey 1 imported a long Spanish EPUB, **Figures in a paper** PDF, and **Un paseo para recordar** Markdown notes.
- Journey 2 imported the real YouTube video transcript, a second Spanish EPUB, and **기억을 오래 남기는 방법** PDF.
- The second EPUB's first attempt had the same body as the first; Ore correctly recognized the duplicate. The final second fixture has different prose and imported separately.
- The Spanish book and video transcript accepted a highlight, a highlight note and a source note; their writing survived navigation and reopening.
- Each journey asked the tutor once; the unavailable answer produced an error and Try again, leaving the message field usable.
- Two new skills, **Lectura atenta** and **Modelos y memoria**, each showed their three filed sources immediately. See [first skill](j1-skill-sources.png) and [second skill](j2-skill.png).
- The illustrated PDF retained its figures, and Original rendered pages 1 and 2; the Korean PDF's Original rendered its Korean text.
- The real video import retained its title, author, timestamps, description and chapter headings; transcript reading remained available when the harness could not start its native player.
- The EPUB's keyboard chapter submission saved its answer before reporting unavailable AI feedback; the persisted answer survived reopening.
- Five review ratings saved in total: one in each initial journey and three in the final remaining-queue pass, including Explain and New exercises. The review log is in [library-evidence.json](library-evidence.json).
- Failed Explain grading allowed manual key-point marking and a rating; all seeded available reviews could be completed.
- Review endings returned to Home; Home showed the saved minute and explained that the remaining two new exercises start tomorrow.
- Settings opened and closed normally; the second journey also inspected Keyboard shortcuts.
- ⌘K found and opened the new sources and created the two skills. Source-list rows opened with one click.
- No page errors were recorded. The final page had zero outstanding bridge calls before closure.

## Artifacts and limits

- [actions.log](actions.log) records the interactive run. Screenshots and text captures live beside this report. [driver.cjs](driver.cjs) connects to the supplied server and uses one context/page; [helpers-only.cjs](helpers-only.cjs) defines its selection, import and navigation helpers. The confirmation snippets run through `runfile(...)` in that driver after loading the helpers. EPUB confirmations require chapters that have not already been recalled; this completed scratch library retains the tested records.
- Browser startup initially waited on an `aside` element the app does not have. Correcting the harness selector resolved it; it was not an app launch failure. Other selector mistakes and a terminal input-length issue were corrected and excluded.
- The supplied `player_port` response is null, so native YouTube playback was not tested. The app showed a player-start explanation and an Open on YouTube action. A separate attempted local video fixture failed in the local media tools before import and was not used.
- Background enrichment and real AI were disabled as requested. “Writing prequestions…” under that condition is not reported as a production fault. No accelerated clock or bonus-lap claim is made.
- File-picker tests used the supplied hook with real file paths; they did not test Finder's native picker.
- Git status remained unchanged: only the pre-existing untracked `docs/reviews/2026-11-23-codex-ux-sweep-7/` folder was listed. No commits, fixes, findings-register edits, server changes, other tester folders, real library, or installed app were touched.
