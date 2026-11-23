# Mac UX sweep — round 5

Tested the supplied release build at `http://localhost:1761/`, bridge `1762`, in the supplied WebKit browser at 1280×800 with 2× screenshots. Source revision: `43127940ebb4c533b494cfad382918c4f3e59fa4`. Completed two journeys, each beginning on a fresh page: add three source kinds, read and highlight, write a source note and highlight note, ask the tutor, create a skill and file the sources, finish with recall, review available exercises, open Settings, navigate with ⌘K, and return to saved work. Then confirmed the three findings below twice, from fresh pages, and checked their application code. Read the working agreements, daily-session design, findings registry, sweep history, and all four earlier Mac reports; skipped their detailed already-passed paths, the excluded findings, pending-save Undo, iPhone, visual taste, real AI, and native OS integration. Only `codex-out/mac/` contains tester-written artifacts; all scratch-library changes went through the app. No repository source or documentation was changed. One context and one page were used at a time, and both were closed at the end.

A **fresh page** means a new page with the prescribed bridge and Tauri init scripts. It does not reset the shared scratch library to its original seed. Neither journey claims real AI generation: tutor and grading failures came from the supplied null responses, and the daily reviews used seeded exercises.

## Findings

### MAC-1 — Creating a skill silently removes another skill picked while creation is saving

**S2 · Mac · reproduced 2/2 fresh-page attempts.** This saves the wrong source filing; it is not merely a stale checkmark.

1. From a fresh page, open a source through ⌘K. The test used **Mac field notes one**, already filed under **Mac workshop one**, with **Learning** not selected.
2. Open its header's skill picker. Type a new name, such as **Workshop filing 1**.
3. Set `window.__ORE_SLOW = { skills: 2400 }`, then click **Create Workshop filing 1**.
4. While that creation is pending, replace the picker's query with **Learning** and click the existing **Learning** option.
5. Observe Learning checked and in the source's byline. Wait for the new skill's creation to finish.
6. Close the picker, go Home, and reopen the source. Repeat with a different new skill name.

**Expected:** Both choices remain: the new skill and Learning, alongside the source's original skills. If the picker cannot accept another choice safely while creating, it should show that it is working and prevent that choice until completion.

**Actual:** Learning appears and is saved first, then silently disappears when the new skill arrives. The success toast names only the new skill. Reopening still omits Learning. The final source frontmatter contains `mac-workshop-one`, `workshop-filing-1`, and `workshop-filing-2`, but no `learning`.

**Evidence:** [run 1, Learning selected during creation](filing-during-create-1.png), [run 1, Learning removed afterward](filing-after-create-1.png), [run 1 reopened](filing-reopened-1.png), [run 2 during creation](filing-during-create-2.png), [run 2 afterward](filing-after-create-2.png), [run 2 reopened](filing-reopened-2.png), [saved library evidence](library-evidence.json), [reproduction script](skill-create-filing.cjs).

**Code:** `apps/desktop/src/Skills.tsx:101–110`: `create()` awaits `onCreate`, then invokes the `toggle` function captured before the wait. That function constructs the next selection from the old `sel`, excluding choices made meanwhile. `apps/desktop/src/Reader.tsx:3295–3303` then updates the byline and sends that entire replacement list to `ore edit --skills`. The hook delays command replies; it does not select or remove skills. The destructive replacement is production app logic. No Undo key is involved, so this is outside the pending-save Undo class excluded from this run.

### MAC-2 — New skill still says “Esc to cancel” while saving, then opens after cancellation

**S2 · Mac · reproduced 2/2 fresh-page attempts.** The user gets no visible save state, the advertised cancellation fails, and the eventual result changes the screen after the user has moved on.

1. From a fresh page on Home, open ⌘K → **New skill…**.
2. Type **Pending workshop 1**.
3. Set `window.__ORE_SLOW = { skills: 2500 }`, then press Enter.
4. While the response is pending, observe the unchanged **↵ to add · Esc to cancel** instruction. There is no saving label or spinner; the field has become read-only.
5. Press Esc. The name field disappears. Click Home and continue there.
6. Wait for the pending creation to complete. Repeat with another name.

**Expected:** Show that the skill is saving. If Esc is offered as cancellation, honor it; if creation has already committed, make that clear and let the user leave without later taking over the screen.

**Actual:** Esc dismisses the form but does not cancel creation. When the reply arrives, the supposedly cancelled skill appears and its page opens automatically, replacing Home. Both **Pending workshop 1** and **Pending workshop 2** remain in the saved library.

**Evidence:** [run 1 pending](new-skill-wait-1.png), [run 1 after Esc on Home](new-skill-cancel-1.png), [run 1 late navigation](new-skill-after-cancel-1.png), [run 2 pending](new-skill-wait-2.png), [run 2 after Esc](new-skill-cancel-2.png), [run 2 late navigation](new-skill-after-cancel-2.png), [saved skills](library-evidence.json), [reproduction script](new-skill-wait.cjs).

**Code:** `apps/desktop/src/Sidebar.tsx:646–648` starts the creation and unconditionally calls `onDone` when it resolves. The only pending treatment is `readOnly={busy}` at line **670**; line **699** keeps the pre-submit instructions. Esc calls `onDone(null)` at line **687**, with no cancellation or invalidation of the pending completion. The late `onCreated` callback in `apps/desktop/src/App.tsx:2507–2510` always opens the new skill. This reproduces with a delayed response from a real scratch-library write, without AI or native behavior.

### MAC-3 — A refused collection rename loses the typed name

**S3 · Mac · reproduced 2/2 fresh-page attempts.** A temporary write failure makes the user reopen Rename and retype their work.

1. From a fresh page, open **Craft**'s ⋯ menu → **Rename…**.
2. Enter **Workshop shelf draft 1**.
3. Make only the next `skills arrange` write fail, leaving all read commands working. The supplied script intercepts that bridge request with HTTP 500 and the JSON error `Test: collection write refused`.
4. Press Enter and wait for the error. Clear the injected failure.
5. Open Craft's ⋯ → **Rename…** again. Repeat with a second draft name.

**Expected:** Keep or reopen the editor with the attempted name and an error, so Enter can retry without retyping.

**Actual:** The field closes, the collection returns to **Craft**, and a toast reports the failure. Reopening Rename contains **Craft**, not the attempted name. There is no retry action preserving that draft. The saved collection is correctly unchanged; the lost work is the unsaved rename.

**Evidence:** [run 1 refusal](collection-refused-1.png), [run 1 reopened field](collection-reopen-1.png), [run 2 refusal](collection-refused-2.png), [run 2 reopened field](collection-reopen-2.png), [reproduction script](collection-failure.cjs).

**Code:** `apps/desktop/src/Sidebar.tsx:186–191` clears the rename state before calling `arrange`; it keeps no draft for a failed write. `apps/desktop/src/App.tsx:1623–1632` catches the write failure, shows a toast, and rereads the saved layout, without returning failure to the rename editor. The targeted fault is necessary: a preliminary `__ORE_FAIL.skills` probe also blocked reads, so that probe's lingering optimistic heading is **not** reported. Only the two write-only failures above count as reproductions.

## Known rows seen come back

None confirmed on their original paths. MAC-3 is the Mac collection editor's counterpart to **F491**, whose recorded fix is for the iPhone drawer; it is not a recurrence of that phone path. MAC-1 concerns a stale selection captured by skill creation, not F474/F500's late reads after Undo. The excluded pending-save Undo class was not tested.

## What passed

- Journey 1 added three distinct kinds: plain text (**Mac field notes one**), EPUB (**A Small Book of Remembering**), and Word (**Retrieval practice notes**).
- Journey 2 added three distinct kinds: plain text (**Mac field notes two**), PDF (**Remembering on purpose**), and notebook (**Introducing NumPy**).
- The EPUB opened with chapter headings, image, table, code and footnotes; a footnote click reached its note inside the reader.
- The notebook opened with prose, code, its output section, and the later Broadcasting heading.
- Each text source accepted a highlight, a highlight note and a source note; the first highlight also changed to Key point.
- Each tutor question ended in a visible unavailable-response error with retry, leaving a usable message field; no AI answer quality is claimed.
- Two skills were created through ⌘K and each received its three sources through the No skill list's picker; their source lists reflected the changes.
- A skill goal saved on Enter; source rows opened with one click, and ⌘K found and opened the newly added text sources.
- Each Finish journey saved free recall to the source note and allowed Done despite unavailable AI feedback.
- The first daily review saved three ratings, including an Explain answer with manual key-point marking after grading failed; leaving reached an end screen and Done returned to Home.
- The second daily review saved two remaining available exercises, including a New exercise, then reached the end screen and Done returned to Home.
- Home reflected the saved review time and updated skill gems after returning; the fresh second page also showed the saved progress.
- Settings opened through ⌘, and closed with Esc in both journeys; the first inspected Reading and Review, the second reopened Settings. Earlier rounds' exhaustive settings changes were not repeated.
- Leaving and reopening both text sources preserved their notes, highlights, filing and saved recall. Their Markdown is copied read-only into [library-evidence.json](library-evidence.json).
- Long sidebar skill names exposed their complete text on hover; ordinary navigation and the inspected dialogs remained readable at 1280×800.

## Artifacts and limits

- [actions.log](actions.log) records the interactive commands for both journeys and the confirmation scripts. `journey1-*.txt/.png` and `journey2-*.txt/.png` capture intermediate and reopened states.
- [driver.cjs](driver.cjs) connects to the supplied browser and opens one context. Run with `node codex-out/mac/driver.cjs` from the repo root in an interactive terminal. To execute a bounded reproduction snippet, enter `global.fs = await import('node:fs');`, then `return await (new Function('return (async()=>{' + fs.readFileSync('codex-out/mac/skill-create-filing.cjs', 'utf8') + '})()'))();` (substitute the other script path as needed). Use unused skill names if rerunning against this already-mutated scratch library. Close with `await context.close(); await browser.close(); process.exit(0);`.
- The file-picker hook supplied real fixture paths to the app; it did not test Finder's native selection UI. Imports and saved learning content used the real bridge and CLI.
- Background prequestion generation was disabled by the supplied environment. Its pending labels were observed but are not reported as production failures.
- Review time is measured from the displayed exercise until its rating and capped at three minutes per exercise (`apps/desktop/src/Review.tsx:53`, `661`, `747`, `753`). No bonus-lap or accelerated-clock claim is made.
- No supplied server was started or stopped, no other tester's port or folder was used, and no real library or installed app was touched. The unchanged Git status still contains only the pre-existing untracked round-5 prompt folder; tester output is ignored by Git.
