# Mac UX sweep 16

Tested the supplied release build in WebKit at 1280×800, with 2× screenshots and the real CLI bridge on the assigned scratch library. Source checkout: `dc17201915bd869e37fc3ff0765154ebb3e9430f`. Rechecked both #514 fixes twice in skill notes and twice in source notes; exercised slash menus, links, Find, ⌘K, tutor input, title fields, exercise editing, paste and simulated composition. Ran two compressed first-hour task sequences, each from a fresh page: three source kinds, reading/highlighting/notes, tutor, a new skill and filing, due review, Settings, Finish, navigation and return. Fresh pages reused the assigned seed and saved work; these were not empty-library onboarding or two literal hours of study. Additional paths included equation editing, Markdown paste, composition and the daily-plan field. **One new S2 finding.** Skipped iPhone, native OS integration, real AI quality, pure visual taste, the named exclusions, injected slow/failed writes, pending-save Undo and detailed repeats of earlier passed paths. All tester-created artifacts are in this folder; library writes used the app.

## Findings

### MAC-1 — Finishing one source closes the next source you open

**S2 · Mac · ordinary navigation, no injected delay or failure.**

1. From a fresh page, open an unfinished source. The standalone reproduction adds a short text source through ⌘N; any unfinished source works in the tested cases.
2. Click **Finish**, write a short recall, and press **⌘Enter**. On **Done with this source?**, click **Done**.
3. While **Source finished** is showing, click **AI** in the sidebar, then click **Building Effective Agents** in that skill's source list. Click at a normal brisk pace, within the roughly one-second closing message.
4. Observe the new source opening, then wait another second.

**Expected:** Once the learner has opened another source, it stays open. Finishing the previous source can update its status and show its toast without closing the current reader.

**Actual:** **Building Effective Agents** opens, then closes by itself. The learner lands back on the AI skill page and must open it again. The toast names the earlier finished source. The first observation used Home and ⌘K and landed back on Home; the sidebar-only reproduction removes that extra machinery.

**Reproduction:** **2/2 fresh-page confirmations with deliberate 250 ms pauses between navigation clicks**, plus **2/2 faster fresh-page confirmations**, and the original two journey observations. In both paced confirmations the new source was open **605 ms after Source finished appeared**, then absent after the closing message completed. Both ended with zero pending bridge calls. No clock manipulation or slow/fail hook was used.

**Evidence:**

- Paced run 1: [before finishing](finish-human-1-before.png), [next source opened](finish-human-1-opened.png), [next source closed](finish-human-1-closed.png).
- Paced run 2: [before finishing](finish-human-2-before.png), [next source opened](finish-human-2-opened.png), [next source closed](finish-human-2-closed.png).
- [Paced reproduction script](confirm-finish-human.cjs) and [timings, resulting screen and pending-call counts](finish-human-results.json).
- [Faster reproduction script](confirm-finish-navigation.cjs) and [results](finish-navigation-results.json).

**Code:** `apps/desktop/src/Finish.tsx:317–322` waits 1,100 ms for the closing message, then invokes the old `onDone` callback even after navigation unmounts that Finish view. `apps/desktop/src/App.tsx:2615–2621` handles it with an unconditional `setOpenId(null)` at **2618**, which closes whichever source is open now. There is no current-source check or cancellation of the delayed navigation. D106 intentionally specifies the one-second message; the defect is its callback overriding a newer navigation, not the message itself.

**Not the mock:** Both the timer and navigation are production React code. The callback is not waiting for an AI answer: enrichment is started separately at `Finish.tsx:314–316`, before the timer. The bridge simply performs the source status and recall writes. This differs from F482, which concerns Undo during Finish; no Undo is involved here. No existing finding was found for this navigation override.

## Known rows rechecked

- **F535 / #514 passed:** right-click menu type-ahead E/X left selected note text unchanged, **2/2 skill-note and 2/2 source-note checks**. [Skill results](fix-results.json), [source results](saved-and-source-results.json), [menu screenshot](fix-menu-2.png).
- **F536 / #514 passed:** Turn into stayed open and applied its format, **2/2 skill-note and 2/2 source-note checks**. [Skill menu](fix-turn-open-2.png), [applied heading](fix-turn-applied-2.png), [source menu run 1](source-turn-1-open.png), [source menu run 2](source-turn-2-open.png). The source paragraph became Heading 2, then Text on the second run.
- No known fixed row was confirmed to have returned. Named open/excluded rows were not re-reported.

## What passed

- Journey 1 added **Learning session sixteen A** (Text, later renamed **Learning workshop sixteen A**), **Teaching by examples sixteen A** (HTML/Article), and **A Small Book of Remembering** (EPUB/Book).
- Journey 2 added **Learning session sixteen B** (Text), **How Plants Make Food** (PDF), and **Spanish vocabulary** (XLSX/Spreadsheet).
- Both new skills appeared immediately; all three sources in each journey appeared under the correct skill without a reload: [journey 1](j1-filed.png), [journey 2](j2-filed.png).
- Both reading sources saved a highlight and highlight note; the first highlight became a Key point.
- Both source notes and Finish recalls reopened intact **2/2 fresh-page checks each**: [results](saved-and-source-results.json), [first note](saved-2-a.png), [second note](saved-2-b.png).
- Both saved highlights opened from Collected with their notes, with popups inside the viewport, **2/2 fresh-page checks each**: [measurements](highlight-results.json), [Key point](highlight-2-a.png), [ordinary highlight](highlight-2-b.png).
- `/heading 2` accepted typing and converted the block; ⌘K over selected note text accepted a URL and inserted the intended link: [slash](typing-slash.png), [link field](typing-link.png).
- Pasted Markdown became headings and list blocks; simulated composition inserted `学習の練習`, subsequent typing worked, and the text reached the saved skill note: [screenshot](typing-paste-composition.png), [editor HTML](typing-note.html), [disk evidence](library-evidence.json).
- An inline equation accepted TeX, rendered it, returned typing to the surrounding sentence and survived reopening: [equation note](j1-note-equation.png), [saved note](saved-2-a.png).
- Find accepted `practice` and reported **1/2** on the skill note; Escape closed it: [Find](typing-find.png).
- Global ⌘K accepted queries, opened sources and started New skill; its input remained usable after leaving a note and Find.
- Source-title typing saved on Enter, reopened with the saved name, and a second edit was discarded with Escape.
- Exercise question and answer typing saved; reopening the editor showed both changes: [reopened editor](typing-exercise-reopened.png).
- Both tutor questions displayed an unavailable-answer explanation and Try again, leaving an editable composer: [journey 1](j1-tutor.png), [journey 2](j2-tutor.png).
- Four due ratings saved, three Fact and one Explain, totaling **111,591 ms** in the real review log: [library evidence](library-evidence.json).
- Unavailable Explain grading preserved the written answer, explained the problem, and allowed manual key-point marking and a Good rating: [Explain](j2-review-explain.png).
- Both review sessions ended while exercises remained and returned through Done: [first ending](j1-review-end.png), [second ending](j2-review-end.png).
- Settings opened and closed in both journeys; typing a daily plan saved and appeared on Home as **After my morning tea, I review.** [First Settings](j1-settings.png), [second Settings](j2-settings.png).
- Both Finish recalls saved and completion succeeded despite unavailable AI feedback; the navigation exception is MAC-1.
- Clicking into a newly opened skill note and typing at 60 ms per character retained the whole text in **2/2 fresh-page checks**: `earlyTyping` in [results](saved-and-source-results.json).
- Final checks found no page errors and zero pending bridge calls: [final state](final-state.json), [errors](errors.json).

## Hesitations and limits

The three strongest follow-ups were the source disappearing after Finish, an initial note-typing setup that left no text, and retrieving writing/highlights after finishing and returning. Each received two fresh-page checks. Only the Finish navigation issue was confirmed. The typing setup did not reproduce at a normal typing pace; it is not reported as data loss. The first setup had no assertion that its text was entered and therefore was not counted as a successful regression check; the successful checks explicitly compared entered and retained text.

The ordinary highlight initially looked absent in Collected because **Highlights** was folded; expanding it exposed the saved passage and its note. A renamed source retained its original first heading in its body, so the old name still appeared in its outline; the title field itself retained the new name. Neither was treated as a confirmed defect. The first attempts to interact with Review used the wrong selectors (confidence choices have radio roles; the Start review button includes its Return hint); these were automation corrections, not dead controls. A terminal line-length limit and an incorrect panel selector were also harness errors. The action history retains those attempts.

Paste used a synthetic ClipboardEvent with real editor handling. Composition used compositionstart/compositionend around Playwright text insertion, not a native macOS input-method candidate window. Highlighting used real mouse drags; note/menu checks used keyboard events and text selection. Files were added through the Add box by local path, so native Finder dialogs were not tested. No real AI ran, and its missing output was not itself treated as a defect. Review time was measured by the app from each exercise's `shownAt` until its rating (`Review.tsx:187,661,753`, capped at three minutes per exercise); no clock manipulation was used.

After the final pending-call check, the driver ran its cleanup path (`context.close()` then `browser.close()`). The terminal process remained alive without output, so its own session was stopped with Ctrl-C (exit 1); cleanup completion was not independently confirmed. No cleanup command targeted the supplied WebKit server. No server, watcher or extra browser was started or stopped. No repository source, findings register, installed app, real library or other tester's folder/port was changed. No commit or push was made. The pre-existing untracked `docs/reviews/2026-11-23-codex-ux-sweep-16/` folder was left untouched.
