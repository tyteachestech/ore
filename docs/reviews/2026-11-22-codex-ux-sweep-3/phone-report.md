# iPhone UX findings — round 3, 2026-11-22

Tested checkout `acba0b7e6b8cca24cbda6b264f9358304e49088c` at the supplied `http://localhost:1766/`, through the supplied WebKit connection. Used one context and one page at a time, touch enabled, dark mode, 390×844 and 375×667, with 2× screenshots. Covered drawer skill creation/rename/collection assignment/move/archive/Undo, drawer editor targets, source-menu writes and pending Undo, Review edit/refused-save recovery/Later/retirement/rating/Undo, skill-only review, interrupted Explain drafts, all four highlight types, highlight notes/Collected and reading-position restoration. Read the working agreements, iOS checklist, daily-session document, findings registry, decisions relevant to candidates and both earlier reports. Skipped their already-passed ordinary goal/icon/Importance, Finish/recall, source-note, Settings, search and appearance paths; did not re-report the listed open issues. Native keyboard, selection handles, actual shake/three-finger gestures, haptics, iCloud and real AI were not available in this browser run. Reading-position checks used the seed's roughly two-screen article; there was no genuinely long source in this six-source seed. No source files, installed app, real library, other tester resources or findings registry were changed. All output is in `codex-out/phone/`.

## Test instrumentation

The supplied phone's `core.ts` implements `__ORE_FAIL`, but **does not implement `__ORE_SLOW`**. `slow-hook.js` uses Playwright response interception, only on this page, to delay the return from the existing phone command runner after its real command completes. This matches the Mac mock's slow-reply semantics. No command, result, history operation or stored data is fabricated. Pending-write checks use 1,400 ms delays; the first exploratory drawer check used 1,800 ms. All mutations still originate in app controls and run through core.

For finding 2 only, `native-pending.js` also removes the browser-only early return from the served `native-undo.ts` response so its unchanged native callbacks register. It invokes `window.__oreUndo()`, the exact callback invoked by `apps/phone/ios/Undo.swift:21`, with focus on the Review surface, outside a text field. This verifies the native callback's app behavior, **not an actual device gesture**. It does not enable native filesystem access or change global Tauri detection.

Ordinary actions use Playwright taps. Long presses dispatch one stationary touch for 650 ms. Text selection uses a DOM Range to exercise the phone's selection bar; native selection handles are not certified. Keyboard Undo is stated explicitly where used.

## Findings

### 1. Undo during several phone saves takes back an unrelated earlier change

**S2 · iPhone · Same class as F22/F459/F470; additional phone handlers.**

1. From a fresh page, open the drawer → New skill. Enter `Bus practice` and press Return; return to Today.
2. For the drawer-editor case, open the drawer, long-press Learning → Edit skill… . Delay `skills` replies and tap the blue colour.
3. Before the reply lands, press hardware **⌘Z**.
4. Wait for the delayed writes and refreshes to settle. Dismiss the editor and inspect the drawer.

**Expected:** Undo takes back the colour change, waiting for its save if necessary. Bus practice remains.

**Actual:** Bus practice is deleted. Learning stays blue. The screen reports `Undone: Created skill Bus practice`, then the colour change joins history too late. This is the separate drawer editor, not the skill-page badge picker repaired in F470.

The same fresh-page setup reproduces with these source-menu actions: after creating Bus practice, go to Sources and long-press Building Effective Agents, perform the indicated action, then press ⌘Z before its reply lands.

| Action | Delayed command | Result after Undo |
| --- | --- | --- |
| Pin to top | `pin` | Source stays pinned; Bus practice disappears |
| Move to Done | `status` | Source stays in Done; Bus practice disappears |
| Skills → tick Learning; dismiss the menu | `edit` | Filing into Learning lands; Bus practice disappears |

**Reproduced:** Each of the four triggers **2/2**, once at each size; drawer colour also reproduced in the initial exploratory run. `pending-results.json` records the actual held command arguments and the disappeared skill. The pending Review edit and retirement controls using keyboard Undo were tested as controls and correctly kept Bus practice.

**Screenshots:** `codex-out/phone/pending-editor-early-390.png`, `pending-editor-landed-390.png`, `pending-editor-landed-375.png`; `pending-pin-landed-390.png`, `pending-pin-landed-375.png`; `pending-status-landed-390.png`, `pending-status-landed-375.png`; `pending-filing-landed-390.png`, `pending-filing-landed-375.png`.

**Code:** `apps/desktop/src/Skills.tsx:362` awaits the drawer editor's save before registering history at line 365. `apps/desktop/src/phone/PhoneApp.tsx:887` / `:889` do the same for pinning, `:828` / `:829` for moving to Done, and `:840` / `:843` for filing. The injected delay changes only reply timing; these app handlers choose and mutate the wrong history entry.

### 2. Native Undo bypasses Review's protection while a rating or retirement saves

**S2 · iPhone · New native-callback trigger; device gesture verification outstanding.**

1. From a fresh page, create Bus practice in the drawer, return to Today, and start a review with the default skills.
2. On the first Fact exercise, tap Sure.
3. Delay `review` replies and tap Good. Alternatively, delay `card` replies and choose Exercise actions → Retire exercise.
4. While that reply is pending, request app Undo through the native callback (`window.__oreUndo()` in the browser reproduction).
5. Wait for the reply and refreshes.

**Expected:** The native Undo route waits for the pending review action and undoes that action, as the keyboard route does.

**Actual:** Bus practice is deleted. The rating remains logged and Review advances to Exercise 2; in the retirement case the exercise stays retired and the next exercise opens. The toast says `Undone: Created skill Bus practice`. The held command log contains no review undo or card restore. The requested operation was not undone.

**Reproduced:** Rating **2/2**, retirement **2/2**, once at each size. Focus was on the non-editable Review dialog, so the native shell's text-field exclusion does not apply. Compare the successful delayed keyboard retirement in `pending-results.json`. Native callback results are in `native-pending-results.json`.

**Screenshots:** `codex-out/phone/native-rating-early-390.png`, `native-rating-landed-390.png`, `native-rating-landed-375.png`; `native-retire-early-390.png`, `native-retire-landed-390.png`, `native-retire-landed-375.png`.

**Code:** `apps/desktop/src/Review.tsx:1016` queues Undo **keyboard events** while busy. Ratings register their history after the awaited write (`:722`, `:732`); retire does likewise (`:880`, `:884`). `apps/desktop/src/phone/native-undo.ts:18` connects native Undo directly to the general history callback. `apps/phone/ios/Undo.swift:21` calls that function without passing through Review's keyboard-event protection. No native busy guard appears in that path.

### 3. Collections can be created on the phone but have no rename, reorder or remove controls

**S2 · iPhone · Missing lifecycle actions, not skill deletion.**

1. From a fresh page, create a skill in the drawer, then return to the drawer.
2. Long-press that skill → Edit skill… → Collection → None.
3. Type `Commute` and tap Create Commute. Dismiss the editor and reopen the drawer.
4. Scroll the new collection heading into view. Tap or long-press Commute; inspect the skill's menu and editor for collection management.

**Expected:** A collection the phone lets the learner create can be renamed, reordered and removed while keeping its skills, with Undo. The interaction checklist requires a full lifecycle unless a decision excludes it.

**Actual:** The heading has no action. The skill menu offers Move to another collection, and its editor can assign an existing or new collection, but neither manages the collection itself. There is no collection rename, reorder or remove command. A typo can only be worked around by moving its skills individually to another collection, or corrected on the Mac. Skill reordering within a collection is absent too.

**Reproduced:** **2/2**, once at each size, with the collection heading scrolled into view. This is distinct from the deliberate omission of **Delete skill** on the phone; that omission was not reported.

**Screenshots:** `codex-out/phone/collection-no-actions-390.png`, `collection-no-actions-375.png`. Results: `organize-results.json`.

**Code:** `apps/desktop/src/phone/PhoneApp.tsx:1122` renders a collection as a plain `<h2>`; only the skill buttons beneath it receive menus. `apps/desktop/src/phone/skill-menu.tsx:63` onward offers skill opening/editing/moving/Importance/archive, without ordering or collection-management actions. `apps/desktop/src/Skills.tsx:448` implements collection assignment/creation, not collection rename/delete. No exception for these missing collection operations was found in the relevant decisions.

### 4. The drawer's skill editor has 20-point colour targets and other undersized controls

**S3 · iPhone · Separate surface from F89's repaired skill page.**

1. From a fresh page, open the drawer; long-press Learning → Edit skill… .
2. Tap red, then tap at blue's horizontal centre, six points below its visible circle.
3. Tap the centre of blue. Compare the results.

**Expected:** Every target accepts a 44×44-point tap area, including its surrounding space.

**Actual:** The near tap does nothing; only the centre tap selects blue. Each colour's complete hit area is **20×20 pt**, with no `::before`/`::after` extension. The name button is **69.625×20.844 pt**; the Collection selector is **132.344×28 pt**. These require much more precise taps than the rest of the phone UI. The icon button itself is correctly 44×44.

**Reproduced:** **2/2 dedicated size checks**, plus exploration. `editor-metrics-390.json` and `editor-metrics-375.json` record element dimensions and both pseudo-elements. Both checks logged `blue checked after near tap false`, then `blue center true`.

**Screenshots:** `codex-out/phone/editor-small-targets-390.png`, `editor-small-targets-375.png`.

**Code:** `apps/desktop/src/styles.css:484` sets the swatches to 20×20; `:490` fixes the collection control at 28 high. `:467` leaves the name at its text height. The larger hit-area rules at `:3124` target `.phone-skill`, not `.skill-edit`, so the drawer editor misses them.

### 5. Long-pressing a collected highlight offers no actions

**S3 · iPhone · New; a workaround exists through the passage.**

1. From a fresh page, open Building Effective Agents.
2. Select a paragraph, choose Key point, type a note, and finish the note.
3. Open Collected and long-press the key-point row.
4. Try to change its type, copy it with its source, or remove it from that list.

**Expected:** The long press offers the highlight's actions, as source and skill rows do. These actions already exist for the same Collected row on the Mac.

**Actual:** Nothing opens. There is no ⋯ alternative. The learner must tap the row to jump away to the passage, use its popup, and return to Collected to continue organizing. A normal tap does open that passage and popup, so this is an extra-navigation cost rather than an inaccessible highlight.

**Reproduced:** **2/2**, once at each size. The same hold helper successfully opens source and skill menus. `remaining-results.json` records zero menus after both highlight holds.

**Screenshots:** `codex-out/phone/collected-no-menu-390.png`, `collected-no-menu-375.png`.

**Code:** `apps/desktop/src/Collected.tsx:250` passes an empty action list when `PHONE` is true; `:256` also removes the ⋯ button. The actions themselves exist in `apps/desktop/src/Reader.tsx:2298`. This is explicit app branching, not a failed WebKit context-menu simulation.

## Known rows seen again

- **F22:** The pin/filing pending-Undo class is present in the phone's independent source-menu handlers. This does not establish a regression in the repaired Mac handler.
- **F470:** The colour pending-Undo class remains in the drawer's `SkillEditor`; the repaired skill-page `BadgePicker` is a different component. No claim that the exact repaired skill-page path regressed.
- **F89:** The undersized targets are in the drawer editor, not the skill page covered by that row.
- No listed open issue was re-reported. F161's native gesture wiring exists; finding 2 concerns what its callback does during a save, not missing gesture support.

## What passed

- A new skill opened its page; a drawer-editor rename persisted and appeared in the drawer.
- A collection created through the skill editor appeared in the drawer with its skill.
- Moving a skill to another collection and Undo restored its original collection.
- Archive skill followed by immediate toast Undo restored the skill and its collection.
- Source-menu Review this source opened that source's exercise.
- Delayed **keyboard** Undo during exercise editing waited and restored the original question, preserving the prior skill creation, at both sizes.
- Delayed **keyboard** Undo during retirement restored the exercise and preserved the prior skill creation, at both sizes.
- Two taps on Save during a delayed exercise edit produced one `card set`; two taps on Good during a delayed rating produced one review write, at both sizes (`double-save-results.json`).
- A refused exercise save showed the injected error, kept the corrected question in the editor, and saved it after the failure was cleared.
- Later followed by Undo returned to the same Fact exercise.
- A multiline Explain answer survived Later/Undo and leaving/restarting review at both sizes.
- A skill-only review reached its end screen; Done returned to Today at both sizes.
- Plain Highlight, Key point, Question and Try it reached the correct Collected groups at both sizes; note text remained visible there.
- Tapping a collected key point opened its passage and popup; changing it to Question updated Collected at both sizes.
- Removing a highlight through its popup and Undo restored it during the exploratory reading journey.
- Leaving an article at scrollTop 700 and reopening restored scrollTop 699 at both sizes, with unchanged content height. This is a short seeded article, not a long-document stress test.
- The drawer editor dismissed on an outside tap; its icon control met the 44-point target rule.

## Coverage limits and replay

The run did not exhaustively repeat every item in every menu: the earlier reports already cover ordinary source rename/archive/restore/filing and skill settings; external Open original depends on native Tauri in this phone harness; highlight menus are absent as reported. Skill deletion remains Mac-only by an explicit code contract. Collection management and skill ordering could not be completed because the controls are absent. Finish and goal-based end-screen timing were deliberately left to round one's recorded passes. Actual system keyboard coverage and native undo gesture delivery need the simulator/device.

Reproduce the bounded browser checks from the repo root while the supplied services are running:

```sh
node codex-out/phone/driver.cjs < codex-out/phone/replay-input.txt
```

The driver closes its own context and connection on QUIT. The scripts never launch a browser or server. `actions.log` includes exploratory locator mistakes; those timeouts are not reported as app bugs. The JSON result files and screenshots are the evidence for the findings above.
