# Lifecycle sweep

Tested the supplied Mac release build in WebKit at 1280×800/2× and the iPhone build at 390×844/2× with touch. Covered source archive/restore with highlights, a Key point, a note, reviewed exercises and an added diagram; existing note links into an archived source; skill rename, source filing, skill archive/restore, skill deletion with Keep and Archive choices, name reuse, exercise edit/retire/Undo, Key point removal, cross-screen Undo, the last source of a skill, the last due exercise of a source, and deleting every skill. Only app interactions changed the assigned scratch libraries; CLI and file reads checked saved state. Three findings were confirmed at least twice. No application code was changed. Limits: no course in the seed; no controllable changed-page source for reimport; AI is disabled, so tutor citation generation was not tested. Permanent source deletion is excluded by SPEC.md (folders/IDs are kept; archive is the supported end state). No skill merge or independent exercise-skill picker was exposed in the inspected menus; those requested operations remain untested. Native iOS shake/three-finger Undo was not testable in browser WebKit; phone toast Undo and hardware-keyboard Undo were tested.

## Findings

### L1 — Undoing source filing adds skills to exercises that never had them

**S2 · Mac and iPhone · 2/2 independent runs (one per platform, each starting with the original seed assignments).**

1. Open a fresh seeded page. Open **The Testing Effect: Why Retrieval Beats Rereading**. It belongs to Learning and Teaching, but only its Explain exercise belongs to Teaching. Its two Fact exercises belong only to Learning.
2. On Mac, use the source's skill chips; on iPhone, use Source actions → Skills.
3. Untick Teaching. Close the picker. Undo the change (Mac ⌘Z; phone Undo toast).
4. Inspect Teaching's due exercises or the saved exercise skills.

**Expected:** Undo restores each exercise's original skill list. Teaching again contains only the original Explain exercise from this source.

**Actual:** All three exercises now have `learning, teaching`. The 50%-more and hypercorrection Fact exercises silently acquire Teaching. Teaching's due queue expands from one to three exercises from this source. This is an Undo integrity failure, not the intentional rule that a newly added source skill propagates to its exercises.

**Evidence:** `mac-skill-assignment-undo.png` shows the successful Undo toast. `baseline.json` records the original individual exercise metadata. `teaching-after-undo.json` records the Mac's three due exercises. `phone-cards-after-skill-undo.json` contains the phone's persisted IndexedDB records with the same unwanted assignments. Relevant IDs end in `CVQ157`, `CVQ158`, `CVQ159`.

**Suspected cause:** `packages/core/src/skills.ts:428–442` implements inverse source filing as ordinary addition: line 441 adds every newly selected source skill to every exercise. Mac `apps/desktop/src/App.tsx:1789–1805` and phone `apps/desktop/src/phone/PhoneApp.tsx:732–740` keep only the source's before/after skill lists for Undo, losing the per-exercise differences.

### L2 — A newly created skill silently inherits a deleted skill's note

**S2 · Mac · 2/2 runs, including a reload before the second delete/create.**

1. Start with seeded **Habits**, whose note contains Week 1 through Week 14 and What worked.
2. Use its sidebar menu → Delete skill… → **Keep them** → Delete skill.
3. Wait for Habits to disappear. Choose New skill and enter **Habits**.
4. Open the new skill's page.

**Expected:** Creating a new skill creates a new identity, or explicitly offers to restore the previous skill. Keeping the old note on disk for recovery is fine; silently attaching it to a different new skill is not.

**Actual:** The new skill gets its old note, but no source, icon, colour or collection. It presents fourteen weeks of old writing beside “Nothing to read.” No recovery or reuse message explains the mixed state. Undoing the new creation, then Undoing the deletion, does restore the actual original skill and its source; that is a different result from recreating its name.

**Evidence:** `mac-reused-skill-name.png`, `mac-reused-skill-name-repeat.png`; the old note is in `baseline.json` under `skills/habits/notes.md`.

**Suspected cause:** `packages/core/src/skills.ts:170–175` checks ID collisions only against currently listed skills. `addSkill` reuses that slug at line 339, while `removeSkill` deliberately leaves its note directory on disk (lines 450–452). The new skill therefore reads the old canonical note path.

### L3 — Archiving a source leaves its questions on the open skill page

**S2 · Mac and iPhone · 2/2 Mac runs and 2/2 phone runs.**

1. Start a fresh seeded page and open the **AI** skill. Its only source is Building Effective Agents, and its Questions section contains **Start with the simplest solution possible**.
2. Mac: archive the source using its row menu. iPhone: open the source from AI, then Source actions → Archive, returning to AI.
3. Wait for saving to settle (tested after 1–1.8 seconds).
4. Leave AI and reopen it to compare.

**Expected:** Source archive hides both its source row and its questions, per `docs/SPEC.md:169`. With the last source gone, the skill page shows the useful source and question empty states immediately.

**Actual:** The source row disappears and “Nothing to read” appears, but the archived source's question remains actionable. Leaving and reopening AI removes it and displays “No questions yet.” The stale row can mislead the learner into continuing work they just archived. Source restore/Undo is not required to clear it; navigation alone corrects the display.

**Evidence:** `mac-last-source-empty-settled.png`, `mac-stale-archived-question-repeat.png`, `phone-last-source-empty.png`, `phone-stale-archived-question-repeat.png`.

**Suspected cause:** `apps/desktop/src/SkillPage.tsx:575–584` fetches Questions only when its own version, skill, notify function or library-change signal changes. Mac `App.tsx:1480–1503` updates source lists on archive but does not invalidate this question list. The phone's archive refresh updates its item data (`phone/PhoneApp.tsx:701–715`) while the shared skill Questions component stays mounted.

## Known rows checked

- **F16:** Did not reproduce the suspected failed iPhone archive Undo. Both an immediate tap and a tap after 2.5 seconds restored the row.
- **F146/F156:** Ordinary completed skill/source renames undid in the correct cross-screen order. This run did not repeat their injected slow-save race.
- **F161:** Native gesture integration not tested; do not infer a regression from browser-only testing.
- **F173:** L3 concerns a local app action on an already-open page, not an outside edit returning from the background. No claim that its fixed scenario regressed.
- No verified recurrence of an existing finding row.

## What passed

- Source archive kept its three reviewed exercises in the source-specific due queue, as specified; it did not retire them.
- Source archive → explicit Restore and source archive → Undo preserved all pre-existing non-index library files byte-for-byte in the initial comparison (`baseline.json` versus `after-source-restore.json`). This includes notes, annotation logs, exercise files and review logs.
- A diagram added through the source note reopened with its drawn box after archive/Undo (`mac-source-diagram-before-archive.png`, `mac-diagram-restored.png`).
- A link created in Building Effective Agents' note still opened the archived Testing Effect source (`mac-link-to-archived-source.png`).
- Removing the Key point left its linked Fact exercise available; Undo restored the Key point. `exercise-after-highlight-removal.json` captures the exercise while its highlight was removed.
- Mac exercise editing, retirement and restore via Undo retained its eight-review history. Undoing the edit from Home restored its original question; restore announces that it returns in a later review.
- Archiving AI excluded its solely filed due exercise from the general queue; Bring back restored the skill. Source and exercise files were kept (`queue-ai-archived.json`).
- Deleting AI with Archive sources kept its exercises reviewing with no skill, archived its source, and Undo restored source and skill assignments (`queue-ai-deleted.json`, `mac-delete-skill-choice.png`).
- Source rename then skill rename were undone newest-first after navigating between reader and skill page, with toasts naming the action. Offscreen changes were named; no earlier unrelated change was observed being undone instead.
- iPhone source rename saved, then hardware ⌘Z from the previous screen restored its title.
- iPhone skill rename, skill archive and toast Undo worked; the drawer regained the archived skill.
- iPhone source archive and explicit Restore from the Archive reader worked.
- iPhone exercise retirement and toast Undo returned the same question on the next source-specific review (`phone-exercise-restored.png`).
- Archiving the last source produced a useful source empty state on both platforms. The separate Questions defect is L3.
- Retiring the final due exercise of Building Effective Agents left the review flow; reopening Review this source said “Nothing from this source is due right now.”
- Deleting all ten skills kept sources and review records. After reload, Home offered Start review and opened an unfiled exercise; the CLI still listed five eligible exercises (`queue-no-skills.json`).
- Creating one new last skill, filing the Testing Effect source under it, then deleting it with Keep them left Start review available after saving settled. A brief missing Start review after the first ten-skill sequence did not reproduce in this second run and is not filed as a finding.

## Coverage limits and scratch state

- No permanent source deletion was attempted: SPEC.md says IDs/folders are never removed. There is no Delete action in the normal or archived source menus.
- No merge-two-skills action or direct move-one-exercise-to-another-skill action was found. Source filing propagation and skill deletion were tested instead; these are not claimed as tests of those missing operations.
- A changed-page reimport and course lifecycle need dedicated examples. The seed's rich Testing Effect source is pasted text and has no Reimport action. No source file was altered behind the app to manufacture that test.
- No tutor citation result was generated: the supplied bridge deliberately disables AI.
- Last-due testing was scoped to one source's review session, not retiring every exercise in the entire library.
- Native phone gestures, app relaunch persistence and sync were not exercised. The browser phone's IndexedDB was read only for verification; writes went through the UI.
- The Mac scratch library ends with no skills after the last-skill tests. Its sources, notes and exercise/review files remain; the Testing Effect source was restored. Test-added notes/diagram and the confirmed filing-Undo metadata changes remain as evidence. No real library was accessed.
- `driver.cjs` is the interactive WebKit harness, `audit.cjs` saves read-only file hashes/content under this folder, and `empty-skills.cjs` records the ten-skill deletion journey. Screenshots and JSON files named above are relative to `codex-out/lifecycle/`.
