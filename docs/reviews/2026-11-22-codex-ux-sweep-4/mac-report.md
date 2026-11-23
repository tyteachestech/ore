# Mac UX sweep — round 4

Tested the supplied release build at `http://localhost:1761/`, bridge `1762`, in the supplied WebKit browser, against only `codex-out/libs/mac`. Used one context and one page at a time, at 1280×800 and 800×600, with 2× screenshots. Read the working agreements, daily-session design, findings registry, sweep history, and all three earlier Mac reports. Covered Add interruptions and mixed input, file/YouTube/feed intake, source metadata and menus, multi-selection and bulk actions, No skill, Back/Forward, sidebar peek, and narrow-window overlays. Four findings below reproduced twice and were checked against application code. Skipped iPhone, visual taste, the excluded open findings, real AI, native OS integration, and the earlier rounds' detailed notes/tutor/Forge/review/Settings journeys. No repository source or documentation was changed; all tester-written artifacts are in this folder, and all scratch-library writes came through the app. Source revision: `09f63719fb5077daa4cd8121de91403b60b20646`.

A **fresh page** below means a newly opened page with the prescribed bridge and Tauri init scripts, not a reset of the scratch library.

## Findings

### MAC-1 — Undo during a source's skill save removes the preceding author edit

**S2 · Mac · reproduced 2/2 fresh-page journeys.** Related to the known source-filing timing failure F301 and the round-3 pending-Undo class.

1. From a fresh page, open a source with no author and no skill. The test used **Mac mixed import attempt 2: notes to review alongside the file.**, created by MAC-2's journey.
2. Choose **Source actions → Add author…**, enter **Filing baseline 1**, press Enter, and let it save.
3. Open the header's **Skill** picker.
4. Set `window.__ORE_SLOW = { edit: 1600 }`, select **Learning**, press Esc to close the picker, then immediately press ⌘Z.
5. Wait four seconds and inspect the byline. Repeat from a fresh page after removing the filing; use **Filing baseline 2**.

**Expected:** Undo waits for the filing and removes Learning. The saved author stays.

**Actual:** Learning stays and the author disappears. A late **Filed under Learning** toast arrives. A second ⌘Z after the writes finish removes Learning, confirming the first Undo reached the preceding author change. Both writes succeed; this is not failed-save rollback.

**Evidence:** [first result](filing-undo-1.png), [second result](filing-undo-2.png), [first state](filing-undo-1.txt), [second state](filing-undo-2.txt), [journey](filing-undo.cjs).

**Code:** `apps/desktop/src/Reader.tsx:3283` changes the skills immediately; line **3285** awaits `ore edit`; line **3289** registers Undo afterward. This call is not wrapped in `whileOut`, so `apps/desktop/src/ore.ts:73–116` does not hold Undo for it. The mock only delays the real command's response (`apps/desktop/scripts/mock/tauri.js:46–58`); the app chooses the wrong history entry.

### MAC-2 — File selection after typed text saves the file path instead of importing the file

**S2 · Mac · reproduced 2/2 fresh-page journeys.** The chosen learning material never enters the library, despite a successful Added notification.

1. From a fresh page on Home, click **+ Add**.
2. Type a short sentence, such as **Notes to review alongside the file.**
3. Click **File**, select [field-guide.md](field-guide.md), then click **↵ Add**. For automation, set `window.__ORE_PICK` to that file's absolute path before clicking File.
4. Read the source that opens and compare it with the selected file.

**Expected:** The selected file is imported as a file, or the app explains that the existing text must be handled separately before accepting the file selection.

**Actual:** The field's label becomes **Text**, and Ore saves one text source containing the typed sentence followed by `/Users/…/codex-out/mac/field-guide.md`. None of the file's paragraphs or headings appears. The success toast names the typed sentence. Selecting the same file through ⌘O without prose imports its actual content correctly.

**Evidence:** [run 1 before Add](mixed-file-1-before.png), [run 1 saved source](mixed-file-1-after.png), [run 2 before Add](mixed-file-2-before.png), [run 2 saved source](mixed-file-2-after.png), [saved Markdown](library-evidence.json), [journey](mixed-file.cjs).

**Code:** `apps/desktop/src/Add.tsx:153–159` appends selected paths to the existing text. `apps/desktop/src/paste.ts:45–50` treats the entire value as prose unless **every** nonempty line is a link or file; `paste.ts:79` then sends it through `add --stdin`. The picker mock supplies a real path only; the lossy classification is production application logic. The original file remains intact.

### MAC-3 — Reopening an Add draft forgets its chosen skill

**S2 · Mac · reproduced 2/2 fresh-page journeys.** An interrupted capture silently loses its filing choice.

1. From a fresh page on Home, open **+ Add** and enter a short text source.
2. Open **Skill**, choose **Learning**, and press Esc to close the picker. Learning is now visible beside the draft.
3. Press Esc again to close Add.
4. Reopen **+ Add**. The same text is retained and selected.
5. Click **↵ Add** and inspect the source's header and its saved skills.

**Expected:** The restored draft retains the skill explicitly selected for it.

**Actual:** The text survives but Learning is replaced by the blank **Skill** control. Adding the restored draft saves `skills: []`, so the source lands under **No skill** instead of Learning. Both saved sources confirm this on disk. This is an adjacent gap in draft retention, not a recurrence of F449's lost-text bug.

**Evidence:** [run 1 before closing](add-draft-1-filed.png), [run 1 reopened](add-draft-1-reopened.png), [run 1 saved](add-draft-1-saved.png), [run 2 before closing](add-draft-2-filed.png), [run 2 reopened](add-draft-2-reopened.png), [run 2 saved](add-draft-2-saved.png), [saved Markdown](library-evidence.json), [journey](add-draft.cjs).

**Code:** `apps/desktop/src/Add.tsx:88` stores only `value` and `pasted` in the draft. Line **109** initializes picked skills anew from the current page; line **135** saves the draft without `picked`. This happens before any native integration or CLI call.

### MAC-4 — Home's multi-selection has no visible action bar

**S3 · Mac · reproduced 2/2 fresh-page journeys.** A learner must discover the row menu or remember shortcuts to act on the selection.

1. From a fresh page on Home, ⌘-click two different titles in **Continue reading**.
2. Observe the two selected rows and look for the selection's action bar.
3. Right-click one selected row to verify that Ore has recognized the two-source selection.
4. Choose **Move 2 sources to Done**, then Undo, to complete the task.

**Expected:** D283's visible bar, as in All sources: **2 picked**, **Mark done**, **Skills**, **Archive**, and **Clear the pick**.

**Actual:** Both rows are selected, but no bar, count, or visible bulk controls appears. The right-click menu correctly offers two-source actions, and Move to Done/Undo work. Thus selection works; its visible action route is missing. All sources shows its bar for the same two sources.

**Evidence:** [Home run 1](home-pick-no-bar-1.png), [Home run 2](home-pick-no-bar-2.png), [working two-source menu](home-pick-menu-2.png), [run 2 state](home-pick-no-bar-2.txt), [reproduction helper](home-pick.cjs).

**Code:** `apps/desktop/src/Home.tsx:221–224` owns a separate `picked`/`pick` state and supplies it to row menus at **258**, but renders no `PickBar`. The shared bar at `apps/desktop/src/App.tsx:2824` reads the main source list's `many`, not Home's selection. No bridge or native behavior is involved. D283 explicitly explains why menu-only bulk actions are insufficient; the interaction checklist defines Home's rows as a source list too.

## Known rows seen again

- **F301's source-filing pending-Undo failure remains observable**, on the reader's header picker (MAC-1). This run adds a skill rather than removing it; it demonstrates the same late-history registration. F301's recorded resolution changed the journey's timing. It should not be counted as an unrelated new undo mechanism.
- Round 3's `F-new-undo-waits` guard does not cover this reader filing handler. The ordinary delayed-author Undo control passed; no regression is claimed for the specific key-point, Finish, or Settings paths fixed in that round.
- F449's actual text-retention fix held. MAC-3 concerns the omitted skill selection.
- No other known row was confirmed as a recurrence. The explicitly excluded issues were not re-reported.

## What passed

- Plain text opened with its title, paragraphs and heading intact; blank Author and Skill controls were available immediately.
- The same Markdown fixture imported correctly through ⌘O, then duplicate import reopened the existing source; twice (`file-header.cjs`).
- A live YouTube add showed Adding and Cancel; cancellation returned an editable retained URL. Retrying completed while the user navigated elsewhere and did not steal the current screen (`youtube-*.txt`).
- An unreachable link kept its editable URL and showed a connection error with a retry instruction (`bad-link.txt`). A second YouTube cancellation retained the URL; the completed first video opened with its title and author (`youtube-second-cancel.txt`, `youtube-first-open.txt`).
- A live RSS URL, `https://simonwillison.net/atom/everything/`, submitted promptly from Add became a followed feed with a success message and Undo (`feed-fast-add.txt`).
- Author save, delayed-save immediate Undo, and a refused author save followed by retry retained the intended field contents (`author-error.txt`, `author-slow-undo.txt`).
- Source-title Esc cancellation, palette Copy as Markdown, and source Archive/Undo worked twice (`file-header.cjs`).
- PDF Reimport showed an injected refusal without losing the readable source, and retry after clearing the fault returned “already up to date”; twice (`reimport.cjs`).
- All sources supported ⌘-click toggles and ⇧-click ranges, with its visible selection bar (`multi-selected.txt`).
- Bulk Mark done, filing under Learning, and Archive each affected both selected sources and one Undo reversed the operation; twice (`bulk.cjs`).
- Bulk Restore and Move to To read worked, including Undo and Redo; twice (`bulk-restore.cjs`).
- Bulk Copy as Markdown produced both titles; Copy paths produced both paths. The clipboard payload was captured in-page; native pasteboard delivery was not tested (`bulk-restore.cjs`).
- Home's selected-source context menu acted on both sources, and Undo restored them; the missing bar is MAC-4.
- No skill filtering plus search survived Back from a source, and Forward reopened that source; twice (`navigation.cjs`).
- At 800×600, sidebar peek supported navigation, and ⌘K opened and closed from Home, a source, a skill, Feed, and All sources; twice (`navigation.cjs`).
- At 800×600, ⌘, Settings and ⌘/ shortcuts opened and dismissed with Esc; their inspected screenshots fit within the window (`narrow-settings-*.png`, `narrow-shortcuts-*.png`).

## Coverage limits and artifacts

No manual sort control is shipped: lists use last-touched order (D110), with pinned sources first. Source removal was exercised as Archive/Restore; the interaction agreement defines that as the source's delete lifecycle and core retains item folders. Copy as Markdown being absent from the reader's ⋯ is explicitly allowed by D93; it worked through ⌘K. Markdown files intentionally have no Reimport under D93, so the retry check used the PDF fixture.

Ordinary article-link import, ordinary list filters/search, pinning/Importance, and the detailed daily-loop surfaces were already covered in rounds 1–3; this run emphasized adjacent interruption and bulk paths. Native Finder selection is represented by `__ORE_PICK`; clipboard payload capture does not establish native copying. No AI result or video playback quality is claimed. AI-related pending prequestions in screenshots are a supplied-environment limit, not a finding. No page errors were recorded.

[driver.cjs](driver.cjs) connects to the supplied browser and loads the two init scripts in order. The other journey `.cjs` files are snippets for its shared scope: start `node codex-out/mac/driver.cjs`, then enter `await eval('(async()=>{'+fs.readFileSync('codex-out/mac/mixed-file.cjs','utf8')+'})()');` (substitute the journey filename). Enter `quit` to close its context and disconnect. Each journey's loop is bounded; only the report's named findings are claimed as bugs. The exploratory `home.cjs` stopped on the missing bar and led to MAC-4; use `home-pick.cjs` for its complete reproduction.
