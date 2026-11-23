# iPhone UX findings — round 4, 2026-11-22

Tested the supplied iPhone app at `http://localhost:1766/` through the shared WebKit server, with touch, dark mode, 390×844 and 375×667, and 2× screenshots. Base checkout: `09f63719fb5077daa4cd8121de91403b60b20646`, including the supplied, uncommitted collection/skill-menu changes; `code-hashes.txt` identifies the files inspected. Covered the new collection actions, skill ordering, source organization and Mac parity, imports and their wait/refusal states, Search, reader actions, archive/restore, and one pending-save Undo check. Read the working agreements, iOS checklist, daily-session document, findings registry, relevant decisions and earlier sweep reports. Did not repeat their full Review/Finish, Forge, note-editor, appearance or Settings journeys. Skipped the excluded open rows, visual taste, real AI, native keyboard/selection/undo gestures, simulator, iCloud and OS handoffs. Each reported issue was checked twice, at the two sizes. Only `codex-out/phone/` was written; no repository implementation or registry edits, commits, installs or server changes were made.

## Findings

### 1. A failed collection rename drops the name being typed

**S2 · iPhone · New collection editor**

1. From a fresh page, open the drawer and long-press **Craft**.
2. Choose **Rename…**, then type `Commute projects`.
3. Before submitting, set `window.__ORE_FAIL = { skills: "Could not save: disk full. Free space and try again." }`.
4. Press Return. After the failure, clear the failure hook.
5. Long-press Craft and choose Rename… again.

**Expected:** The failed save leaves the entered name available for retry, as the source's title editor does. An error should not discard the pending edit.

**Actual:** The field disappears as soon as Return blurs it. The error appears, but reopening the field shows `Craft`; `Commute projects` is gone. The previously saved collection and its skills remain intact. This loses the pending edit, not saved library data.

**Reproduced:** 2/2 fresh seed runs, 390×844 and 375×667.

**Screenshots:** `codex-out/phone/collection-rename-failed-390.png`, `collection-rename-reopened-390.png`, `collection-rename-failed-375.png`, `collection-rename-reopened-375.png`. Data: `rename-failure-390.json`, `rename-failure-375.json`.

**Code:** `apps/desktop/src/phone/PhoneApp.tsx:1135` clears the editing state before calling `renameCollection`. `apps/desktop/src/phone/skill-menu.tsx:66` starts the write without returning a success result to the editor; its error handler at line 24 only notifies and refreshes. Compare the retained failed draft in `apps/desktop/src/TitleField.tsx:25`. The supplied failure hook refuses the ordinary command; it does not alter editor behavior.

### 2. Sources cannot use the Mac's kind, author and combined skill filters

**S2 · iPhone · Parity gap**

1. From a fresh page, open the drawer → **Sources**.
2. Try to narrow the list by a source kind or combine an author with a skill.
3. Open Search; inspect its available controls and search for `Anthropic`.
4. Inspect a source's long-press menu and the drawer for another filtering route.

**Expected:** A phone way to apply the Mac's source filters, including combinations, with the active constraints visible.

**Actual:** Sources only shows fixed To read and Done sections. Search matches free text and finds Anthropic's article, but offers no field filters or combined constraints. A skill page supplies a single-skill list, not the Mac's multi-value/intersecting filters. Finding material by kind or a combination requires manual browsing or the Mac.

**Reproduced:** Absence confirmed in 2/2 fresh page inspections, at both sizes, and in the phone's rendering/command code. Round 2's summary already noted the missing controls; this is its parity implication, not a regression claim. No corresponding findings-registry row was found.

**Screenshots:** `codex-out/phone/sources-390.png`, `sources-375.png`, `search-author-390.png`, `search-author-375.png`. Data: `sources-search-390.json`, `sources-search-375.json`.

**Code:** `apps/desktop/src/phone/PhoneApp.tsx:373` renders the fixed sections, and line 1268 supplies Search with navigation/review actions but no filters. The Mac provides `FilterTags` and `FilterButton` at `apps/desktop/src/App.tsx:2422` and `:2447`; fields are Kind, Skill and Author in `apps/desktop/src/filters.ts:10`. D286/D288 describe these filters; no phone opt-out was found. D345's deliberately deferred **No skill** drawer shortcut is excluded from this finding.

### 3. There is no phone selection mode for changing several sources together

**S2 · iPhone · Parity gap**

1. From a fresh page, open **Sources** with the intent of archiving or filing two sources together.
2. Inspect the list's controls and long-press a source.
3. Inspect its menu and another source's menu for Select or a way to grow a selection.

**Expected:** A touch selection mode for the Mac's batch Archive, Move to Done/To read, Skills and Restore operations, with one Undo for the group.

**Actual:** A tap opens one source, a hold offers that source's actions, and a swipe changes one source. There is no Select mode or selected-source action bar. The learner must repeat an operation and its menu/submenu for every source. Copy paths and other Finder-only batch operations are not requested by this finding.

**Reproduced:** Controls/menus inspected in 2/2 fresh Sources journeys, both sizes; code confirms every phone list operation receives one `Item` and there is no selected set.

**Screenshots:** `codex-out/phone/sources-390.png`, `sources-375.png`, `pinned-menu-390.png`, `pinned-menu-375.png`. The latter are ordinary source menus after pinning; pinning does not supply selection mode.

**Code:** `apps/desktop/src/phone/PhoneApp.tsx:248` implements the single-source tap/hold/swipes; line 364 builds those rows, and line 926 builds one source's menu. The Mac's `manyActions` at `apps/desktop/src/App.tsx:1811` exposes the batch operations. No deliberate phone exclusion for batch organization was found; this is missing touch access, not a request for Mac modifier-key selection on a phone.

### 4. Pinned sources cannot be reordered on the phone

**S3 · iPhone · Parity gap**

1. From a fresh page, go to **Sources**.
2. Long-press **Building Effective Agents** → **Pin to top**.
3. Long-press **The Testing Effect: Why Retrieval Beats Rereading** → **Pin to top**.
4. Long-press the second pinned source and try to place it above the first.

**Expected:** Move up/down or a touch reorder action, matching the Mac's pinned-source order controls.

**Actual:** Both sources lead the list in pin order, but the menu only offers Unpin. There is no Move up/down or vertical reorder gesture. Achieving a chosen order requires unpinning and repinning other sources, or using the Mac. Ordinary recency ordering works; this is not a claim that the Mac has a general sort dropdown that the phone lacks.

**Reproduced:** 2/2 fresh journeys, one at each size, with both sources actually pinned through their menus.

**Screenshots:** `codex-out/phone/pinned-menu-390.png`, `pinned-menu-375.png`. Data: `parity-menus-390.json`, `parity-menus-375.json`.

**Code:** Phone ordering is fixed by `apps/desktop/src/phone/PhoneApp.tsx:325`; its menu at line 929 has only Pin/Unpin. The Mac's `pinMoves` at `apps/desktop/src/App.tsx:1983`, inserted at line 1998, provides Move up/down. Phone row gestures at `PhoneApp.tsx:258` are horizontal archive/status actions, not reorder.

### 5. Collection management requires hitting a 12-point-high heading

**S3 · iPhone · New collection action target**

1. From a fresh page, open the drawer.
2. Long-press eight points above the visible **Ty Teaches Tech** heading, at the horizontal centre of its words.
3. Long-press the heading itself.

**Expected:** The actionable collection heading has at least a 44-point-high touch target, per the iOS checklist, including some space around its small label.

**Actual:** The near press does nothing; the centred press opens the collection menu. The heading's entire target is **12 pt high**, with no pseudo-element hit extension. The surrounding space belongs to the section, not the menu trigger. This makes rename/reorder/delete unusually hard to discover and hit accurately.

**Reproduced:** 2/2 measured and behavioural checks, at both sizes. Heading boxes were 279×12 and 267×12 pt. Near press: zero menus; centre press: one menu. Press coordinates were resolved with `elementFromPoint`, so the near press was delivered to what a finger would actually hit.

**Screenshots:** `codex-out/phone/heading-near-miss-390.png`, `heading-center-390.png`, `heading-near-miss-375.png`, `heading-center-375.png`. Measurements: `heading-target-390.json`, `heading-target-375.json`.

**Code:** `apps/desktop/src/phone/PhoneApp.tsx:1138` makes the bare `<h2>` the `WithMenu` trigger. `apps/desktop/src/styles.css:2990` styles that heading at 12px with margins, without padding or minimum target height. `apps/desktop/src/Menu.tsx:96` attaches the hold listener to that trigger.

### 6. Skill menus repeat Open, Review and Edit

**S3 · iPhone · New skill-menu regression in the supplied changes**

1. From a fresh page, open the drawer.
2. Long-press **Learning**.
3. Read the entire menu, scrolling on the smaller phone if needed.

**Expected:** One entry for each action, with Move up/down alongside the existing actions.

**Actual:** Open, Review this skill and Edit skill… appear once above Move up/down and again below them. The duplicate choices lengthen the menu by three 44-point rows, increasing scanning and scrolling to reach Move to, Importance and Archive. The copies have identical labels and handlers.

**Reproduced:** 2/2 independent seed runs at the two sizes, plus initial exploration.

**Screenshots:** `codex-out/phone/skill-menu-390.png`, `skill-menu-375.png`. Data: `skill-order-375.json` includes the complete menu.

**Code:** `apps/desktop/src/phone/skill-menu.tsx:90` adds the first three actions; lines 95–97 add them again after the ordering actions, with the same IDs. This is present in the supplied source and served UI, with no test hook involved.

## Known rows checked

- **F-new-phone-collections:** Its missing collection/skill ordering controls are now present in the supplied changes. Rename, collection up/down, delete/Undo and skill up/down worked. The new failures above are narrower issues in those controls, not a re-report that the actions are missing.
- **F-new-undo-waits:** The delayed phone Pin check passed. A 1,600 ms reply delay followed by hardware ⌘Z produced `pin`, then `pin --undo`; the preceding **Bus practice** skill remained. See `pending-pin-result.json` and `pending-pin-undone.png`. Native gesture delivery was not tested.
- No repaired registry row was observed returning in its original reproduction. The explicitly excluded open rows were not re-reported.

## Mac/phone action comparison

| Mac surface/actions | Phone route or limit |
| --- | --- |
| Skill Open, Edit name/icon/colour/collection, Move to, Importance, Archive/Bring back | Drawer long-press; ordering is now present too |
| Delete skill | Deliberately Mac-only, D225.3 |
| Collection creation and rename/order/delete | Search → New collection… or the skill editor for creation; new heading hold menu for management |
| Source Open/Rename/Review/Pin/status/Skills/Archive/Restore | Source hold menu, row swipes and reader sheet; all have a route |
| Pinned reorder; source filters; batch operations | Missing: findings 2–4 |
| Row metadata Show, Finder reveal and filesystem paths | Explicit phone omissions, D225.2; not findings |
| Source Importance and No skill sidebar shortcut | Explicitly deferred on phone, D345; not findings |
| Reader Rename/Edit author/Finish/Review/Add key point/Collected/Skills/Archive | Reader's Source actions sheet |
| Copy link/Copy as Markdown | Reader sheet. Both reported success here; no clipboard round-trip was performed |
| Open original | URL action exists; native handoff fails with the harness's `no Tauri here`. Not an app finding. PDF/slide originals have their own reader route |
| Find, reading appearance, source note, original PDF/slide page | Dedicated phone controls/screens; earlier sweep passed these ordinary reader paths. No PDF/deck in this seed to repeat original-page behavior |
| Listen/Reimport/Add page text | Explicit `!PHONE` restrictions in Reader.tsx: Mac facilities/original-reading path. Recorded as existing restrictions, not newly proven defects in this run |
| Collected highlight type/copy/remove | Phone long-press now receives the shared actions. Prior round's missing action list is removed; the larger highlight journey was not rerun |
| Skill page goal/Importance/notes/questions/Forge/Dig | Shared screen or pushed phone screen; earlier sweeps cover the full workflows |
| Course Rename and file all lessons under Skills | Absent from the phone course menu; D228.2 explicitly describes its narrower menu. No course in this seed, so no twice-reproduced runtime finding here |
| Feed, AI tutor/research/grading, ambience, drawing diagrams | Existing deferred/platform scope: D145.6, D78.3, D254 and D235; not new parity findings |

## What passed

- Collection rename, Move up/down, delete with skills retained, immediate Undo, and drawer order after leaving/reopening: both sizes.
- Skill Move up/down changed only its position within the collection: both sizes.
- Delayed Pin Undo waited for the write and undid that pin, preserving the prior skill creation.
- A link imported through the real importer; Today showed Coming in → Reading, then the new source: both sizes.
- A Markdown file chosen through the file input imported and appeared in Today: both sizes. Opened content included the final paragraph.
- A refused link showed HTTP 503, Check the link, and Your Mac will try it on Today: both sizes. Remove and immediate Undo restored the pending item.
- Imported article and file opened with their headings and ending text intact; no saved stub was counted as a successful import.
- Author search found Building Effective Agents at both sizes; tapping the result opened it in the small-phone journey.
- Two pinned sources led To read in pin order at both sizes.
- Reader Rename and Edit author persisted through archive, restore, and reopening at both sizes.
- Reader Add a key point, Skills → Learning, source-only Review and leaving it, and Collected all worked at both sizes.
- On the small phone, row Move to Done followed by reader Move to To read restored the source to the right list.
- The small-phone Finish action opened Recall and Close quiz returned to the reader; the full quiz was left to the earlier sweep.
- Reader Copy link and Copy as Markdown showed success; Open original displayed the harness's native-handoff error instead of hanging.
- Reader Archive removed the source from Sources; Archive → open → Restore returned it, retaining its title, author and key point, at both sizes.

## Harness and replay notes

The phone's `core.ts` supports `__ORE_FAIL` but not `__ORE_SLOW`. `slow-install.js` supplies the latter by intercepting only this page's served module and delaying a command's reply **after its real work completes**. It fabricates no results or history and writes no app code. The failed-rename checks use the supplied failure hook directly, without that instrumentation.

Import tests intercept `https://example.org/phone-qa-article` and `.../phone-qa-refused` with the locally written `add-fixture.html` and an HTTP 503. The article response waits three seconds so the waiting UI can be observed. This exercises the real importer and UI without confusing browser CORS with the native app's fetch. It is not a live-site or native file-picker certification. An exploratory localhost URL was correctly refused before this fixture setup; that is not a finding.

Ordinary actions use Playwright taps. Long presses send a stationary touch for 650 ms to a retained element handle; retaining the handle avoids asking an accessibility locator for a background row after a modal menu opens. Repeats close the prior context before creating the next: one context and one page at a time. A new page alone retained IndexedDB in this harness, so independent repeats use fresh contexts. No shared service was started or stopped.

`actions.log` includes exploratory locator mistakes and harness adjustments; those are not findings. The evidence JSON and screenshots are the relevant outcomes. `replay-input.txt` is a bounded sequence for the main reproduced findings and import checks:

```sh
node codex-out/phone/driver.cjs < codex-out/phone/replay-input.txt
```

The final QUIT closes only this driver's context and connection. Earlier full Finish/recall and Review-ending checks were intentionally not repeated; the native keyboard, system gestures and OS state remain for a simulator/device run.
