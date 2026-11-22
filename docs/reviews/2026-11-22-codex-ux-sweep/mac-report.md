# Mac UX test report — 2026-11-22

Tested the release build at `http://localhost:1761/`, bridge `1762`, in the supplied WebKit browser at 1280 × 800 and 2× screenshots, against only the `mac` scratch library. Read the working agreements, daily-session design, findings registry, sweep history and commits since November 17. Covered review, reading through recall, source organization, skill/collection creation and deletion, Forge tries, PDF contents, Claude-chat import, all five Settings pages, and command-palette actions from Home and a source. Four new issues below reproduced twice. AI was disabled as supplied; native Finder, clipboard, speech and system shortcuts cannot be fully validated through this bridge. The conflicting-sources work is explicitly deferred in D337, not a missing shipped control. Skipped the specified known issues and yesterday's basic sweep; did not test iPhone. No repository source or documentation was changed. All tester-written artifacts are in this folder; library changes went through the app.

Baseline source commit: `9783f33a7a498587bfa9dbf2f6171805990bdfd6`. A fresh page below means a newly opened page with the prescribed bridge and Tauri init scripts; it does not reset the scratch library.

## Findings

### MAC-1 — Undo of a pending plan edit removes the entire Forge try

**S1 · Mac · reproduced 2/2 controlled attempts.** Undo removes saved user work instead of reversing the last edit. The annotation remains in the append-only library with `status: deleted`; this is not a claim that its bytes are unrecoverable.

1. From a fresh page, open a skill and its **Forge**. Create a skill first if needed; these runs used **Mac study lab**.
2. Click **Add something to try**, enter a distinct plan in **I’ll…**, and press Enter. Wait until the saved try appears.
3. Open that try. Simulate a slow command response with `window.__ORE_SLOW = { try: 2200 }`.
4. Change **When** to **After breakfast**, press Enter, then press ⌘Z about 400 ms later, before the save response arrives.
5. Wait for both operations to settle, then examine the Forge and the saved records.

**Expected:** Undo reverses the When edit, leaving the newly created try in the Forge. It can wait for the in-flight write if necessary.

**Actual:** The app announces **Undone: Added to the Forge** and removes the entire try. A late **Plan saved** notification also arrives. Both controlled runs persisted creation → updated When → deleted status, so this is not just a stale list.

**Evidence:** [attempt 1 during save](forge-undo-wrong-action-2-early.png), [attempt 1 settled](forge-undo-wrong-action-2-settled.png), [attempt 2 during save](forge-undo-wrong-action-3-early.png), [attempt 2 settled](forge-undo-wrong-action-3-settled.png), [saved records](forge-library-evidence.json), [reproduction helper](forge-undo.cjs).

**Code:** `apps/desktop/src/Forge.tsx:141–150` registers the undo action only after `run()` and `reload()` finish. Until then the previous creation is still the newest undo action. `Forge.tsx:433–438` starts the plan write on blur/Enter. The supplied hook delays the real CLI response after the request completes (`apps/desktop/scripts/mock/tauri.js:46–58`); it does not invent the deletion. This is the same failure pattern addressed for other surfaces in F350/F393, on a different, newly tested Forge path.

### MAC-2 — Clicking Again during a save records one practice attempt twice

**S2 · Mac · reproduced 2/2 on separate tries.** This changes the learner's recorded practice history and progress.

1. From a fresh page, open a skill's Forge and an active try. If it is waiting, choose **Try this now**.
2. Click **I did it** and type one reflection in **How did it go?**.
3. Set `window.__ORE_SLOW = { tried: 1500 }` to make the save response visibly slow.
4. Click **Again** twice about 150 ms apart, while the same form is still visible. Wait for completion.
5. Reopen the try and inspect its Uses.

**Expected:** One attempt is saved once. While saving, the form should acknowledge the click and prevent another submission.

**Actual:** The form remains actionable with no pending indication. Both clicks save, producing two identical reflections and advancing the practice count twice. One run went from zero to **Used 2 of 3** for a single attempt; the other added two uses to a try that already had one.

**Evidence:** [attempt 1](forge-duplicate-use-1.png), [attempt 2](forge-duplicate-use-2.png), [saved records with distinct timestamps for duplicate reflections](forge-library-evidence.json).

**Code:** `apps/desktop/src/Forge.tsx:196` calls `onSave` without a pending guard; the **Again** button at `Forge.tsx:223` stays enabled. `Forge.tsx:113–118` sends each call to the real `tried` command. The hook delays responses only; the duplicate records are real writes in the scratch library.

### MAC-3 — Clicking New collection leaves typing outside the name field

**S2 · Mac · reproduced 2/2: once from Home, once from a source.** A normal click-then-type naming task appears to ignore the user's typing.

1. From a fresh page, go to Home. For the second run, open **Building Effective Agents** first.
2. Open ⌘K and click **New collection…** with the pointer.
3. Wait for the naming step and type **Research A** (or **Research B**) without clicking the field again.
4. Observe the name field and the currently focused element.

**Expected:** The name field receives focus, the typed name appears, and Enter advances to naming the first skill.

**Actual:** Focus stays on the `Suggestions` listbox (`DIV`), the combobox value stays empty, and there is no creation result. Explicitly clicking/filling the field allows the collection and its first skill to be created successfully.

**Evidence:** [Home screenshot](new-collection-focus-A.png), [source screenshot](new-collection-focus-B.png), [Home focus/value record](new-collection-A.json), [source focus/value record](new-collection-B.json), [reproduction helper](collection.cjs).

**Code:** `apps/desktop/src/Palette.tsx:140–144` changes the naming page and clears the query without moving focus. `Palette.tsx:300` keeps the palette mounted for this action, and `Palette.tsx:401` invokes it from the clicked result. This occurs before a CLI call and does not depend on AI or a native integration.

### MAC-4 — The Forge's new-try form has no visible save action

**S2 · Mac · reproduced 2/2 from fresh pages with different plans.** A pointer user can fill the form but must guess the keyboard submission rule to complete it.

1. From a fresh page, open a skill, then **Forge**.
2. Click **Add something to try**.
3. Fill both **I’ll…** and **When…**.
4. Look for a visible action to add/save the plan or an instruction explaining how to finish.
5. Press Enter in a field to verify that the entered plan can in fact be saved.

**Expected:** A visible, clickable save/add action, with Enter as its keyboard equivalent.

**Actual:** The form consists of two multiline fields. It has no submit button or Enter instruction. Enter does save successfully, which confirms that the missing path is the visible control, not a refused or invalid plan.

**Evidence:** [attempt 1](forge-add-no-submit.png), [attempt 2](forge-add-no-submit-2.png).

**Code:** `apps/desktop/src/Forge.tsx:396–417` renders only the two fields. Submission exists solely in the Enter handler at `Forge.tsx:403–406`. This violates the interaction checklist's visible-control and keyboard-path requirement. F306 fixed a similar pointer dead end in the Add sheet; this is a separate Forge form.

## Known rows seen again

None confirmed on their original paths. MAC-1 shares the asynchronous undo pattern of F350/F393; MAC-4 resembles the pointer-access issue in F306, but neither is a re-report of those original surfaces. The specified open rows were excluded. One `ResizeObserver loop completed with undelivered notifications` browser event occurred without an identified learner-facing failure; it is not reported as a crash.

## What passed

- Home's Continue reading source titles opened their sources in one click; the separate skill control opened filing rather than the source.
- ⌘K **New skill…** focused the sidebar naming field and created an ungrouped skill.
- Skill rename updated its page and sidebar; archive/restore and delete/Undo returned the tested skill.
- Deleting a skill containing sources offered the source-handling choice; Undo restored it after a delayed response.
- Source filing/removal updated the reader skill byline and No skill view; Undo restored the filing.
- Source Importance changed through the palette and Undo removed that change; source archive/Undo restored the source.
- A five-exercise daily review included Fact and Explain, reveal, self-rating, completion and return to Home with focus restored.
- With grading unavailable, Explain showed an error and allowed manual answer-point selection and rating instead of trapping the session.
- A second fresh-page, source-specific Fact review finished with the forced cart ending, a skill result row, today's minutes, and working Done. The first daily run consumed the seed's due Explain exercises, so a second identical full Explain session was not claimed.
- Review timing code was checked: each exercise contributes elapsed time capped at three minutes (`Review.tsx:53,747–753`). No accelerated-time bonus-lap visual test was completed.
- Two reading journeys completed highlight → Key point → highlight note → source note → tutor → Finish with recall. Recall was kept when AI feedback was unavailable, and Done remained usable.
- Tutor source chips appeared in the field; unavailable responses exposed an error and Try again while leaving the message field usable.
- The PDF contents fixture imported with nine nested contents entries, intact later prose and an eight-page Original viewer; it reopened correctly.
- The Claude-chat HTML fixture imported with its title, author/date, conversation headings and content structure; outline navigation and tutor handoff worked, and the source reopened.
- Each of Reading, Review, AI, General and Keyboard shortcuts was inspected from Home and from a source; tested reading controls, goal/plan fields, model selection and shortcut-recording cancellation responded.
- The palette sweep invoked 28 Home entries and 66 source entries from fresh pages. The two conditional source entries, **Close source note** and **Collected**, were then explicitly exercised and closed/opened the correct pane. Inventories and per-action snapshots are saved beside this report.
- Native-dependent palette rows were invoked only as harness checks; browser-tab import used an injected refusal to avoid reading the real browser tab. Native OS effects and real AI results remain unverified.

## Evidence and test limits

- `palette-home-inventory.json`, `palette-source-inventory.json`, `palette-home.json`, `palette-source.json`, per-action text snapshots and `palette-conditional-completion.txt` record palette coverage. A row being invoked is not proof of a native OS effect.
- `settings-*.txt`, `reading-repeat-*.txt`, `review-end-1.png`, `review-end-2.png`, `pdf-contents.png` and `chat-reader.png` record additional journey states.
- `forge-library-evidence.json` is a read-only copy of relevant records from the assigned library. All writes producing them came from UI actions.
- Explicit response delays were used only to make ordinary slow-save behavior repeatable; no real AI was started. Only one context and one page were used at a time.
- Some exploratory screenshots in this folder are not findings; only the images linked under the four findings are offered as their evidence.
