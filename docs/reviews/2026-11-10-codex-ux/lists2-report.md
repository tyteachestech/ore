# Lists and sidebar UX parity audit

**Eight confirmed findings, all class C.** Every finding below reproduced twice in Chromium and twice in WebKit. The report distinguishes findings from uncertain reference expectations, settled exclusions, and the one incomplete cancellation check.

Repository: `/Users/tylerpoelking/Developer/ore-wt/codex-target`, HEAD `29b12bc9aeb3acd603a2611e21b5336566a871a1`. Repo remained read-only. Mock: `http://localhost:1520/`, bridge `1522`, scratch library `/tmp/ore-ux-lists2`. No servers or installed/live app/library were started, stopped or changed.

## Method and limits

- [Checklist](checklist.md) was written before opening Ore or reading UI source. Its 80 numbered expectations and original sure/unsure labels are preserved. Reference expectations are from prior knowledge, not a live audit of Linear, Raindrop or Finder.
- Seven surfaces were driven separately: All sources; AI’s source list (including Show all); Home Continue reading; Home skills; Feed (Recent/By feed, All/Unread); sidebar skills; sidebar collections. Each applicable control type was exercised in both engines, twice. The detailed [evidence index](evidence-index.md) exposes the per-surface trials and screenshot links; `evidence.jsonl` includes focus, selection, menus, scroll and bridge-request observations.
- Inputs were real Playwright keyboard/mouse actions, including down/move/up drags and native clipboard paste. WebKit used Option-Tab where macOS requires it to reach all buttons. No synthetic DOM input events or fill-based typing tests were used. Screenshots use deviceScaleFactor 2 (normal 2560×1600, short 2560×960, narrow 1520×1600).
- Empty-library/list, 14-skill row, and YouTube Feed-post checks used explicitly labeled browser-only read-response fixtures. They exercise rendered UI without rewriting the library. Slow/failing reads use the mock’s documented hooks. Ordinary mutations and isolated fixture creation/deletion went through the app and its core bridge. Clipboard cut/paste tests could create scratch sources; the scratch library is not claimed pristine.
- Early harness failures (a click hit a skill chip, macOS Tab skipped controls, hidden overflow buttons, or an audit skill was temporarily being renamed) are retained in error logs. They are not app findings or passes. Catch-up runs supply the missing engine/repetition coverage. Source-line references below identify likely responsibility; static source reading alone never establishes a finding.
- Type-to-find, drag-rectangle selection, and sidebar resizing are not proposed. Known hint-only, menu-Escape, and off-window-menu fixes are not re-reported. The 31 specific bugs in the excluded prior sweep were not used as new test targets. Existing conventions/journeys did not substitute for testing these lists.

## Complete checklist results

`works` applies to the relevant object/control, with scope limits below. `excluded` means the original expectation conflicts with a settled decision; it is neither a pass nor a finding. `untested` means the required reproducible interaction was not achieved. C/W means Chromium and WebKit, two trials in each.

| # | Reference / certainty | Behavior | Result | Engines | Scope / evidence |
|---:|---|---|---|---|---|
| 1 | Linear · sure | One click opens the source shown by a row. | **works** | C/W ×2 | Opens source/skill once; collection headers expand rather than navigate. |
| 2 | Finder · sure | Down arrow advances focus to the next row. | **works** | C/W ×2 | Source lists move a cursor; Home moves keyboard focus through its spatial grid; sidebar moves through its navigation tree. |
| 3 | Finder · sure | Up arrow moves focus to the previous row. | **works** | C/W ×2 | Reverse movement works in the same contexts. |
| 4 | Finder · sure | Up at the first row keeps focus in the list. | **works** | C/W ×2 | Repeated Up at the actual first item stays within the navigation surface. |
| 5 | Finder · sure | Down at the last row keeps focus in the list. | **works** | C/W ×2 | Repeated Down was driven to the actual last item; no wrap or unintended open. |
| 6 | Linear · unsure | Home moves focus to the first row. | **differs** | C/W ×2 | U1: source lists scroll without moving the active row; sidebar Home does move to its first item. |
| 7 | Linear · unsure | End moves focus to the last row. | **differs** | C/W ×2 | U1: End scrolls source lists but does not select their last row; sidebar End works. |
| 8 | Finder · sure | Page Down advances the viewport through a long list. | **works** | C/W ×2 | Viewport advances on long source lists/Home; short lists already fit. Also checked short-window scrolling. |
| 9 | Finder · sure | Page Up returns the viewport toward earlier rows. | **works** | C/W ×2 | Returns toward earlier content without opening a source. |
| 10 | Linear · sure | Enter opens a focused source row. | **works** | C/W ×2 | Opens the focused source; collection headings toggle by design. |
| 11 | Linear · unsure | Space toggles selection without opening the focused row. | **differs** | C/W ×2 | U2: Space scrolls active-descendant lists; on Home buttons it opens the item. |
| 12 | Finder · sure | Shift-click selects a contiguous range. | **missing** | C/W ×2 | F1: works in All sources and skill sources; Home/Feed open a row instead of building a range. |
| 13 | Finder · sure | Command-click toggles one item in a noncontiguous selection. | **missing** | C/W ×2 | F1: works in All sources and skill sources; Home/Feed open instead of toggling. |
| 14 | Finder · sure | Shift-Down extends a contiguous selection. | **missing** | C/W ×2 | F1: Home/Feed move focus/cursor without creating a multi-selection. |
| 15 | Finder · sure | Shift-Up reduces or extends the selection at its active end. | **missing** | C/W ×2 | F1: no range to shrink on Home/Feed. |
| 16 | Finder · sure | Command-A selects all items in the focused list. | **missing** | C/W ×2 | F1: All sources/skill sources select all; Home/Feed do not create a row selection. |
| 17 | Linear · unsure | Escape clears a row selection. | **differs** | C/W ×2 | U3: source-list bulk selection clears; the keyboard cursor can remain. Feed retains its single cursor. |
| 18 | Finder · sure | Right-click an unselected row targets that row. | **works** | C/W ×2 | Right-click targets the clicked object; normal source/skill/collection/feed actions are present. |
| 19 | Finder · sure | Right-click a selected row preserves the multi-selection and targets it. | **missing** | C/W ×2 | F1: All sources/skill pages preserve the selection and show plural actions. Home/Feed cannot establish the prerequisite selection. |
| 20 | Finder · sure | Right-click blank list space offers actions appropriate to the containing list. | **works** | C/W ×2 | All/skill/Feed/sidebar blank-space creation menus work. Home blank space intentionally has no menu per the Conventions table. |
| 21 | Linear · sure | The row overflow menu and its context menu offer the same row actions. | **works** | C/W ×2 | Compared row overflow and right-click action labels, order, and keys on each surface. |
| 22 | Linear · sure | Arrow keys move through an open menu. | **works** | C/W ×2 | ArrowDown moves within each menu without moving the underlying list. |
| 23 | Linear · sure | Enter activates the focused menu command. | **works** | C/W ×2 | Down then Enter activates the menu command; source opens / collection New skill begins naming. |
| 24 | Linear · sure | Clicking outside a menu dismisses it without running a command. | **works** | C/W ×2 | Outside titlebar/gutter click closes the menu without running an item. |
| 25 | Linear · sure | Delete actions are visually separated from ordinary menu actions. | **works** | C/W ×2 | Destructive commands are last and distinguished; separators are used where the action model supplies them. |
| 26 | Linear · sure | Menu actions show their available keyboard shortcuts. | **works** | C/W ×2 | Available keys are shown in source/Feed menus. Home exposes no source-row shortcut hints because those bindings are absent there; copied-row shortcut gap is F3. |
| 27 | Linear · sure | Sibling menu items use icons consistently (Ore requires dot icons). | **works** | C/W ×2 | Ordinary action menus consistently omit icons; checkbox/skill submenus consistently use ticks/skill icons. No emoji observed; icon imports traced to Ore sets. |
| 28 | Finder · sure | Dragging a source onto a skill visibly identifies the valid destination. | **missing** | C/W ×2 | F2: All sources/skill sources lift and highlight a destination. Home Continue reading never starts a source drag. |
| 29 | Raindrop · sure | Dropping a source onto a collection files it there. | **excluded** | C/W ×2 | D36: collections contain skills, not sources. Actual source-to-collection drops were attempted and did not file a source; no finding. |
| 30 | Finder · sure | Dragging selected sources moves the whole selection to the destination. | **missing** | C/W ×2 | F1/F2: All/skill source selections drag together. Home/Feed have no selectable group; a genuine bulk-drop trial cannot proceed there. |
| 31 | Finder · sure | Escape during a drag cancels the move. | **works** | C/W ×2 | Escape cancels a real All/skill source drag with no edit request. Home/Feed have no source drag to cancel; absence covered by F2 or D107. |
| 32 | Finder · sure | Dropping an item on itself causes no destructive change. | **works** | C/W ×2 | Self-drop leaves items intact. Also exercised sidebar skill/collection self-drops. |
| 33 | Raindrop · unsure | Dragging sidebar items reorders them. | **works** | C/W ×2 | Sidebar skills/collections visibly reorder; persisted arrangement requests observed. Reference confidence remains unsure. |
| 34 | Finder · sure | Rename starts with the current name selected for replacement. | **works** | C/W ×2 | Source titles/collection names select current text. Skill Edit opens a selected name field; Feed heading rename tested, not remote post titles (D107). |
| 35 | Finder · sure | Enter commits an in-place rename once. | **works** | C/W ×2 | Enter commits names once; focus afterward is a separate check (F4). |
| 36 | Finder · sure | Escape cancels an in-place rename. | **works** | C/W ×2 | Escape leaves original names intact. |
| 37 | Finder · sure | An empty rename is rejected without losing the original item. | **works** | C/W ×2 | Empty names preserve the original; some fields close and skill-name fields stay open. |
| 38 | Finder · sure | Focus remains usable on the renamed item after committing. | **differs** | C/W ×2 | F4: Home source/skill right-click rename and sidebar collection rename drop focus to BODY. Source lists, Feed headings and sidebar skill editor provide counterexamples. |
| 39 | Linear · sure | Deleting an item removes it and shows recoverable feedback. | **works** | C/W ×2 | Archive/mark-read and isolated sidebar skill/collection deletion show feedback. Source removal is archive by design. |
| 40 | Finder · sure | Command-Z restores a just-deleted item. | **works** | C/W ×2 | Command-Z restores the source/skill/collection or Feed read state. |
| 41 | Finder · sure | Shift-Command-Z repeats the deletion after undo. | **works** | C/W ×2 | Shift-Command-Z repeats the reversible removal/read-state change. |
| 42 | Finder · sure | After deletion, focus remains on a surviving neighboring item. | **differs** | C/W ×2 | F5: Home source/skill removal and sidebar skill/collection removal leave BODY focused; no surviving neighbor receives it. |
| 43 | Raindrop · sure | Archiving a source removes it from the active view. | **works** | C/W ×2 | Source archive removes it from active All/skill/Home lists. Feed uses read/unread, and sidebar collections are not archivable objects. |
| 44 | Finder · sure | Copy on selected items produces usable clipboard content. | **missing** | C/W ×2 | F3: All/skill source copy works. Home/Feed leave a seeded clipboard sentinel unchanged after Command-C. |
| 45 | Raindrop · unsure | Cut and paste can file selected items into another collection. | **differs** | C/W ×2 | U4: cut/paste does not re-file the existing source; paste can open Add and create a new text/Markdown source. |
| 46 | Raindrop · sure | Changing sort order visibly reorders the list. | **excluded** | C/W ×2 | D77.4/D130 defer general sort controls. Menus were opened and inspected; no sorting feature proposed. |
| 47 | Raindrop · sure | The chosen sort order survives opening a source and returning. | **excluded** | — (no sort control) | Excluded because there is no permitted general sort choice whose persistence can be exercised. Sidebar order, pinned order and Feed view persistence tested separately. |
| 48 | Raindrop · sure | Changing a filter limits the visible rows. | **works** | C/W ×2 | To read/Done and Feed Unread/All change visible rows. Home/sidebar have no equivalent list filter control. |
| 49 | Raindrop · sure | A picked filter stays picked after opening a source and returning. | **works** | C/W ×2 | Chosen source/Feed view survives a trip Home and back. No claim of Home/sidebar sort/filter controls. |
| 50 | Raindrop · sure | A search with no matches presents a clear empty result state. | **works** | C/W ×2 | Unmatchable source queries show a no-results explanation; Home/Feed are not list-search surfaces. Command-F attempted there without proposing search. |
| 51 | Raindrop · sure | An empty container offers a useful way to add its first item. | **works** | C/W ×2 | Empty response fixtures displayed next-step guidance; sidebar + creates in place. The actual fixture collection/skill lifecycle was also driven. |
| 52 | Linear · sure | A loading or refresh operation visibly indicates pending work. | **missing** | C/W ×2 | F7: first list/today/feed read leaves its destination blank for the entire injected four-second wait; loaded state returns afterward. |
| 53 | Linear · sure | A failed operation shows an actionable error and keeps existing content usable. | **works** | C/W ×2 | Injected read failure exposes its message and Try again on All/skill/Home/Feed. Sidebar skill-read failure reaches the global error toast. Failed-undo/rename regressions from the excluded prior sweep were not re-tested. |
| 54 | Raindrop · unsure | Stopping an in-progress add leaves a coherent retryable state. | **untested** | C/W attempted; incomplete | Cancellation was not reproducible twice per engine: the local add sometimes failed/completed before Cancel could be reached. No finding. |
| 55 | Raindrop · sure | A very long title does not hide essential row controls. | **works** | C/W ×2 | Longest titles remain clipped/wrapped within their rows, with overflow menus reachable; source and Feed titles checked. |
| 56 | Raindrop · sure | A source without a thumbnail still has a recognizable usable row. | **works** | C/W ×2 | Missing pictures show kind icons and retain usable title/menu controls. |
| 57 | Raindrop · sure | Video sources remain recognizable when their thumbnails are unavailable. | **works** | C/W ×2 | Both seeded YouTube sources checked in All/skill/Home; an explicitly labeled YouTube-post response fixture covers Feed fallback. |
| 58 | Raindrop · sure | Rows remain usable with zero assigned categories. | **works** | C/W ×2 | Unfiled sources and rows with no other skill on a skill page remain usable; Feed posts do not carry per-post category chips. |
| 59 | Raindrop · sure | Rows remain usable with many assigned categories. | **works** | C/W ×2 | 14-skill response fixture checked in All/skill/Home; Feed destination skills checked on its feed heading, where they belong. |
| 60 | Finder · sure | Going Back restores the prior list scroll position. | **differs** | C/W ×2 | F6: Home resets scroll on Back (43→0 for last Continue reading row; 552→0 for last skill at 1280×480). All/skill lists retain their own state; opening can legitimately reorder sources (D110). |
| 61 | Finder · sure | Going Back retains a useful indication of the item just opened. | **differs** | C/W ×2 | F6: after keyboard opening a Home source/skill, Back leaves BODY focused and no row selected. No demand for highlighting mouse-only rows. |
| 62 | Linear · sure | Row controls reveal their function on hover (Ore uses Hint). | **works** | C/W ×2 | Hovered row-control types on each surface. Known hint-only fixes are suppressed, not new findings. |
| 63 | Linear · sure | Header controls reveal their function and available shortcut on hover (Ore uses Hint). | **works** | C/W ×2 | Hovered visible header controls. Known tooltip/shortcut-hint fixes are not re-reported. |
| 64 | Linear · sure | Collapsing the sidebar preserves access to navigation. | **works** | C/W ×2 | Hide/show sidebar retains navigation access through the toggle; narrow/wide window layouts checked. Resizable sidebar proposal intentionally excluded. |
| 65 | Finder · sure | A short window keeps list actions reachable by scrolling. | **works** | C/W ×2 | At 1280×480, lower source/skill/sidebar rows and actions can be reached by scrolling. |
| 66 | Raindrop · sure | A narrow window keeps rows and essential actions reachable. | **works** | C/W ×2 | At 760 wide, source controls remain reachable; skill page changes layout and still scrolls. No viewport-menu overflow re-report. |
| 67 | Raindrop · sure | Opening Add from a container places keyboard focus in the add input. | **works** | C/W ×2 | Add opens with its text input focused from each view; source-section + and Command-N checked on skill page. |
| 68 | Raindrop · sure | Closing Add returns focus to a usable initiating control. | **differs** | C/W ×2 | F8: keyboard-focus the visible Add control, Enter, then Escape. Home/Feed/skill pages lose focus to BODY; All sources falls back to its usable list. |
| 69 | Raindrop · sure | Adding from a container preserves that destination. | **works** | C/W ×2 | Skill-page Add preselects AI; global Home/All/Feed Add starts without a skill. Collection + creates a skill, not a source (D36). |
| 70 | Finder · sure | Tab reaches visible list controls without trapping focus. | **works** | C/W ×2 | Tab moves among available controls; Option-Tab used for macOS WebKit all-control traversal. Note editor owns Tab and was not treated as a list failure. |
| 71 | Linear · unsure | Shift-Enter on a row has an intentional alternative to Enter. | **differs** | C/W ×2 | U5: Shift-Enter acts like Enter on All/skill/Feed; no documented alternate list action. |
| 72 | Finder · sure | Double-clicking a row does not open duplicate copies. | **works** | C/W ×2 | Double-click opens a single source/skill; collection may toggle twice, which is the expected consequence of two toggle clicks. |
| 73 | Raindrop · unsure | Triple-clicking row text does not accidentally run multiple row actions. | **works** | C/W ×2 | Triple-click did not produce duplicate source windows/actions; reference-specific alternate behavior remains unspecified. |
| 74 | Finder · sure | Dragging within an editable title selects text without moving its row. | **works** | C/W ×2 | Pointer drag selects rename text without starting row movement. |
| 75 | Raindrop · sure | Pasting a URL in Add preserves it and enables the add action. | **works** | C/W ×2 | Real copy→clear→Command-V preserves a URL in Add. |
| 76 | Raindrop · unsure | Pasting multiple URLs into Add offers a coherent multi-item import. | **works** | C/W ×2 | Two URLs pasted with a real clipboard produce a two-link Add state; reference confidence remains unsure, Ore behavior works. |
| 77 | Finder · sure | Command-A inside rename selects only the title text, not list rows. | **works** | C/W ×2 | Command-A selects name text, not the list. |
| 78 | Finder · sure | Undo inside an active rename edits the text rather than undoing a prior library change. | **works** | C/W ×2 | Native field undo restores the previous text while the rename stays active. |
| 79 | Linear · unsure | A list can be reordered by dragging one row between two others. | **works** | C/W ×2 | Pinned rows reorder; unpinned source order and Home recency are managed by Ore (D74/D110), not a free manual order. |
| 80 | Linear · sure | An active filter can be cleared to recover the complete list. | **works** | C/W ×2 | Returning to To read / All restores the full permitted view. |

## Confirmed findings

### F1 — Bulk selection is missing on Home and Feed

**Class C · checklist 12, 13, 14, 15, 16, 19, 30 · sure references · Chromium 2/2, WebKit 2/2.**

**Steps:** Open Home → Continue reading. Command-click a title; return and try Shift-click. Focus a row with Tab (Option-Tab in WebKit), then try Shift-Down, Shift-Up and Command-A. Repeat on Home’s skills and Feed. Attempt a selected-row context menu after the modifier clicks.

**Ore:** Modifier-click opens the source/skill/post. Shift-arrows only move focus or the single cursor. Command-A never creates a multi-selection. Consequently no bulk context menu or draggable selected group can be reached. All sources and the skill page correctly select first/third rows, ranges, and all items, and expose plural menu actions.

**Reference:** Finder/Linear item lists support additive and contiguous selection, then keep that group for context commands. This is already Ore’s “Any list” convention, not a new proposal.

**Likely source:** `apps/desktop/src/Home.tsx:114 (arrow handler), Home.tsx:246 and :257 (unconditional source open), Home.tsx:310 (skill tiles); Feed.tsx:218 and :247 (single cursor and unconditional open).`

**Why class C:** The same missing selection layer appears in three independently built lists: Home sources, Home skills and Feed. Sidebar navigation was exercised too, but Finder’s sidebar is not a file multi-selection surface; no sidebar bulk-selection finding is claimed.

**2× evidence:** [home_read, 2×](shots/webkit-2-home_read-13-230.png). Four trials: [chromium 1](shots/chromium-1-home_read-13-37.png), [chromium 2](shots/chromium-2-home_read-13-154.png), [webkit 1](shots/webkit-1-home_read-13-44.png), [webkit 2](shots/webkit-2-home_read-13-230.png).

Feed modifier-click: [chromium 1](shots/chromium-1-feed-13-99.png), [chromium 2](shots/chromium-2-feed-13-216.png), [webkit 1](shots/webkit-1-feed-13-106.png), [webkit 2](shots/webkit-2-feed-13-292.png). Home skills: [chromium 1](shots/chromium-1-home_skills-13-68.png), [chromium 2](shots/chromium-2-home_skills-13-185.png), [webkit 1](shots/webkit-1-home_skills-13-75.png), [webkit 2](shots/webkit-2-home_skills-13-261.png). Working All sources range: [all, 2×](shots/webkit-2-all-12-89.png).

### F2 — Home sources cannot be dragged into a skill

**Class C · checklist 28, 30 · sure references · Chromium 2/2, WebKit 2/2.**

**Steps:** On Home, press on a Continue reading title, move beyond the drag threshold, drag over a visible sidebar skill, and release. Repeat using another source and with a modifier-selection attempt. Compare with the same real down/move/up gesture from All sources and the AI source list.

**Ore:** Home never lifts the source, the skill never becomes a drop target, and no filing request occurs. The source lists lift a preview, highlight the destination, and file through edit --skills; their multi-selection drag also works.

**Reference:** Finder/Raindrop saved-item lists drag an item into its destination. Ore already promises this through its list convention.

**Likely source:** `apps/desktop/src/Home.tsx:245 (plain home-read div); App.tsx:2008 (source-list DndContext) and :2020 (selection-aware drag start).`

**Why class C:** Home is an independent renderer of the same saved source. Bulk drag depends on F1. Feed saving-by-drop is excluded because D107 specifies preview/keep behavior; collections-as-source-destinations are excluded by D36.

**2× evidence:** [home_read, 2×](shots/webkit-2-home_read-28-1794356725808.png). Four trials: [chromium 1](shots/chromium-1-home_read-28-1794356232974.png), [chromium 2](shots/chromium-2-home_read-28-1794356415585.png), [webkit 1](shots/webkit-1-home_read-28-1794356572928.png), [webkit 2](shots/webkit-2-home_read-28-1794356725808.png).

### F3 — Command-C does not copy focused Home or Feed rows

**Class C · checklist 44 · sure references · Chromium 2/2, WebKit 2/2.**

**Steps:** In Add, type “UX clipboard sentinel”, select it and copy it, then close Add. Keyboard-focus a Home source (or select a Feed post with Down). Press Command-C. Reopen Add and paste with Command-V.

**Ore:** The pasted value is still exactly “UX clipboard sentinel” in both repetitions in both engines. All sources and skill-source rows do copy Markdown links. Home’s context menu offers Copy as Markdown, but its focused-row shortcut does not run it.

**Reference:** Finder copies the focused/selected item. Ore’s existing “Any list” convention specifically calls for Command-C to copy the item as Markdown with its link.

**Likely source:** `apps/desktop/src/App.tsx:1182 explicitly skips the copy-key handler on Home; Feed.tsx:218 handles navigation, open and read state but no copy command.`

**Why class C:** This omission occurs in both separate list implementations. Copying a Feed post’s link does not require saving its preview or changing D107.

**2× evidence:** [home_read, 2×](shots/webkit-2-home_read-44-1794356802550.png). Four trials: [chromium 1](shots/chromium-1-home_read-44-1794356783025.png), [chromium 2](shots/chromium-2-home_read-44-1794356789361.png), [webkit 1](shots/webkit-1-home_read-44-1794356796107.png), [webkit 2](shots/webkit-2-home_read-44-1794356802550.png).

### F4 — Right-click rename loses focus on Home and collection headers

**Class C · checklist 38 · sure references · Chromium 2/2, WebKit 2/2.**

**Steps:** Right-click a Continue reading source → Rename…; replace the selected title and press Enter. Repeat using Edit skill… on a Home skill. Separately right-click a sidebar collection → Rename…; append text and press Enter. Undo each successful rename.

**Ore:** Names save, but document.activeElement is BODY. No renamed row/collection receives keyboard focus. A clean single-rename reproduction confirms it without the earlier field-editing sequence. Sidebar skill editing, source-list renaming and Feed-heading renaming are working comparisons.

**Reference:** Finder returns keyboard control to the renamed object. Ore’s Title edited in place convention also requires a usable focus destination.

**Likely source:** `apps/desktop/src/Home.tsx:254 attempts source focus return and is the first investigation point; Home.tsx:310 supplies the separate skill row; Sidebar.tsx:169 clears its naming field without restoring the collection button.`

**Why class C:** Three renderers lose focus when the edit control disappears. These are observed behavior and candidate source locations, not a proven shared root cause. The already-fixed menu-Escape return issue is not being re-reported.

**2× evidence:** [home_read, 2×](shots/webkit-2-home_read-38-1794356916765.png). Four trials: [chromium 1](shots/chromium-1-home_read-38-1794356894057.png), [chromium 2](shots/chromium-2-home_read-38-1794356901470.png), [webkit 1](shots/webkit-1-home_read-38-1794356909120.png), [webkit 2](shots/webkit-2-home_read-38-1794356916765.png).

Collection rename: [chromium 1](shots/chromium-1-sidebar_collections-38-1794356296424.png), [chromium 2](shots/chromium-2-sidebar_collections-38-1794356466175.png), [webkit 1](shots/webkit-1-sidebar_collections-38-1794356629902.png), [webkit 2](shots/webkit-2-sidebar_collections-38-1794356797868.png). Home skill rename: [chromium 1](shots/chromium-1-home_skills-38-1794356897146.png), [chromium 2](shots/chromium-2-home_skills-38-1794356904420.png), [webkit 1](shots/webkit-1-home_skills-38-1794356912327.png), [webkit 2](shots/webkit-2-home_skills-38-1794356919991.png).

### F5 — Removing a row leaves keyboard focus on BODY

**Class C · checklist 42 · sure references · Chromium 2/2, WebKit 2/2.**

**Steps:** Archive a Continue reading source from its context menu; repeat for a Home skill and a sidebar skill. For collection deletion, create an isolated audit collection with one empty skill, delete the collection, Undo, Redo, Undo; then delete the empty skill and exercise Undo/Redo.

**Ore:** The row disappears and Undo/Redo feedback works, but focus is BODY rather than a surviving neighbor. This also occurs on isolated collection/skill deletion, so it is not an artifact of the large seeded objects. All/skill source lists retain their list focus.

**Reference:** Finder leaves keyboard focus/selection at a surviving nearby item after deletion, allowing the next arrow/action to continue.

**Likely source:** `apps/desktop/src/App.tsx:1348 (source archive path), :1394 (deleteCollection) and :1438 (archiveSkill); Home.tsx:245 and Sidebar.tsx:277 render rows that are removed.`

**Why class C:** Observed across Home’s two lists and the sidebar’s two object types. The shared removal callbacks update data and history without choosing the next focus target.

**2× evidence:** [sidebar_collections, 2×](shots/webkit-2-sidebar_collections-42-1794356715157.png). Four trials: [chromium 1](shots/chromium-1-sidebar_collections-42-1794356693964.png), [chromium 2](shots/chromium-2-sidebar_collections-42-1794356700455.png), [webkit 1](shots/webkit-1-sidebar_collections-42-1794356707848.png), [webkit 2](shots/webkit-2-sidebar_collections-42-1794356715157.png).

### F6 — Back loses Home scroll position and keyboard row focus

**Class C · checklist 60, 61 · sure references · Chromium 2/2, WebKit 2/2.**

**Steps:** Use a 1280×480 window. Scroll Home to the last skill, open it, then press Command-[. Repeat for the last Continue reading row. Separately Tab to a Home row, press Down twice, Enter, then Command-[.

**Ore:** In all four short-window trials the skill-list Home scroll changed from 552 to 0; Continue reading changed from 43 to 0. In all keyboard-open trials, Back left BODY focused and no row selected. All/skill source lists have separate restoration code; their reading-order changes were not counted as a bug.

**Reference:** Finder/Linear restore the place and keyboard context when returning to a list. Ore’s conventions already require scroll and selection to survive navigation.

**Likely source:** `apps/desktop/src/App.tsx:1230 explicitly leaves Home out of list-scroll storage; Home.tsx:157 renders the scrolling Home surface without restoring its scroll/focused tile.`

**Why class C:** Both Home lists share the Home container, while their arrow focus is local DOM state. The missing state survives neither source navigation nor skill navigation.

**2× evidence:** [home_skills, 2×](shots/webkit-2-home_skills-60-1794356806332.png). Four trials: [chromium 1](shots/chromium-1-home_skills-60-1794356787140.png), [chromium 2](shots/chromium-2-home_skills-60-1794356793366.png), [webkit 1](shots/webkit-1-home_skills-60-1794356799952.png), [webkit 2](shots/webkit-2-home_skills-60-1794356806332.png).

Keyboard Back proof: [chromium 1](shots/chromium-1-home_skills-61-1794357003370.png), [chromium 2](shots/chromium-2-home_skills-61-1794357007729.png), [webkit 1](shots/webkit-1-home_skills-61-1794357013095.png), [webkit 2](shots/webkit-2-home_skills-61-1794357018614.png). Continue reading: [chromium 1](shots/chromium-1-home_read-60-1794356785673.png), [chromium 2](shots/chromium-2-home_read-60-1794356791868.png), [webkit 1](shots/webkit-1-home_read-60-1794356798493.png), [webkit 2](shots/webkit-2-home_read-60-1794356804946.png).

### F7 — First-load waits show blank lists instead of progress

**Class C · checklist 52 · sure references · Chromium 2/2, WebKit 2/2.**

**Steps:** Set the documented mock delay before navigation: window.__ORE_SLOW={ls:4000,today:4000,feed:4000}. Load the app, navigate to All sources, AI, Home or Feed while the read is pending, capture after 200 ms, then wait for the read to finish. Skills are not delayed, so navigation is real and available.

**Ore:** All sources shows only Add, To read and the filter; skill pages show an empty To read section; Home shows only Add; Feed shows Add and Recent. No working indicator appears during the four-second read. Content appears after the delay. Separate failed-read trials show error text and Try again.

**Reference:** Linear makes pending list work visible. Ore explicitly requires an immediate Working indicator where results will land.

**Likely source:** `apps/desktop/src/Feed.tsx:299 explicitly renders null while data is absent; App.tsx:2000–2009 gates list content on loaded items with no pending branch; Home.tsx:169, :228 and :290 gate content on today/items.`

**Why class C:** The same blank-on-first-read pattern is observed on All sources, skill sources, both Home lists and Feed. Refresh progress after data exists is a different state and is not claimed to fail.

**2× evidence:** [feed, 2×](shots/webkit-2-feed-52-1794356706621.png). Four trials: [chromium 1](shots/chromium-1-feed-52-1794356616793.png), [chromium 2](shots/chromium-2-feed-52-1794356644543.png), [webkit 1](shots/webkit-1-feed-52-1794356675206.png), [webkit 2](shots/webkit-2-feed-52-1794356706621.png).

Other blank pending destinations: [all, 2×](shots/webkit-2-all-52-1794356681446.png), [skill, 2×](shots/webkit-2-skill-52-1794356687762.png), [home_read, 2×](shots/webkit-2-home_read-52-1794356694050.png).

### F8 — Closing Add loses the keyboard focus that opened it

**Class C · checklist 68 · sure references · Chromium 2/2, WebKit 2/2.**

**Steps:** Keyboard-focus the visible Add button (Option-Shift-Tab in macOS WebKit; Shift-Tab in Chromium), press Enter to open Add, then Escape. Repeat from Home, Feed and the AI page’s Add a source control.

**Ore:** The Add input is focused while open, but closing it leaves document.activeElement at BODY on Home, Feed and the skill page. Both Home lists were tested. All sources returns to its list rather than the button, which at least keeps list keys usable. The initiating control was demonstrably focused before opening, so this is not an unfocused mouse-origin shortcut case.

**Reference:** Raindrop/Finder-style add dialogs return keyboard control to the initiating surface. Ore’s own focus convention requires a usable return destination.

**Likely source:** `apps/desktop/src/Add.tsx:107 invokes useFocusWhileMounted; util.ts:48 captures document.activeElement in an effect; App.tsx:2372 merely clears adding on close. The capture timing relative to the dialog’s autofocus is a candidate cause, not a validated fix.`

**Why class C:** The shared Add dialog repeats this on Home, skill pages and Feed. This is a dialog lifecycle failure, distinct from the already-fixed context-menu Escape-return behavior.

**2× evidence:** [feed, 2×](shots/webkit-2-feed-68-1794357172639.png). Four trials: [chromium 1](shots/chromium-1-feed-68-1794357122468.png), [chromium 2](shots/chromium-2-feed-68-1794357134934.png), [webkit 1](shots/webkit-1-feed-68-1794357151441.png), [webkit 2](shots/webkit-2-feed-68-1794357172639.png).

## Uncertain reference differences — not findings

No A/B/C class is assigned here. These expectations were marked unsure before inspecting Ore. Their observed differences do not justify an implementation request.

| Observation | Checklist | Exact input and repeated Ore result | Uncertain reference expectation | Source candidate | 2× screenshot |
|---|---|---|---|---|---|
| U1 | 6, 7 | Focus a source list; Home or End scrolls the viewport but leaves the active row. Sidebar Home/End move focus. | Whether Linear maps bare Home/End to first/last active row on macOS. | App.tsx:1272; Feed.tsx:218; Sidebar.tsx:465 | [all, 2×](shots/webkit-2-all-7-79.png) |
| U2 | 11 | Focus first row; Space scrolls All/skill/Feed; it activates a Home button. | Whether Linear uses Space as a selection toggle on this exact surface. | App.tsx:1272; Home.tsx:257; Feed.tsx:218 | [all, 2×](shots/webkit-2-all-11-100.png) |
| U3 | 17 | Select rows, press Escape: All/skill bulk selection clears but cursor can remain. Feed keeps its cursor. | Exact Linear Escape selection semantics. | App.tsx:1275; Feed.tsx:218 | [feed, 2×](shots/webkit-2-feed-17-290.png) |
| U4 | 45 | Focus a source; Command-X; open Spanish; Command-V. Ore does not move that existing item; paste can create a new text source through Add. | Whether Raindrop supports cut/paste filing with this command sequence. | App.tsx:611; App.tsx:1182 | [all, 2×](shots/webkit-2-all-45-1794356423178.png) |
| U5 | 71 | Focus a row; Shift-Enter opens it like Enter on All/skill/Feed. | An alternate Linear Shift-Enter destination is not established. | App.tsx:1308; Feed.tsx:230 | [feed, 2×](shots/webkit-2-feed-71-305.png) |

## Settled exclusions and incomplete check

- **29 — source → collection:** actual drops were driven in both engines twice. No filing occurred. D36 makes collections groups of skills, not source containers; `App.tsx:2034` accepts a skill destination. No finding or new destination behavior is proposed.
- **46–47 — general source sorting and its persistence:** view menus were opened on each relevant list. D77.4 and D130 defer those controls. Therefore there is no permitted sort choice for the persistence trial. Pinned-row order, sidebar ordering, and Feed view/filter persistence were exercised instead, without relabeling them as a general sort control.
- **54 — stop an in-progress Add:** attempted in each engine twice. A local request often failed or finished before Cancel could be operated; one cancellation observation is insufficient. This item remains untested. No stopped-state claim or finding is made.
- A remote Feed post is not a stored source title that Ore owns: rename applies to its feed heading, archive/delete applies to read state or unfollow (D107). Video fallback was additionally tested with a browser-only Feed post fixture. Per-post skill chips and source drops into collections are not proposed.
- Finder’s multi-selection reference applies to its file lists, not its sidebar navigation shortcuts. Sidebar modifier-clicks were still attempted and recorded; their navigation behavior is not reported as a missing multi-select feature.

## Totals

- Checklist: **80 items; 76 checked; 55 works; 10 missing; 11 differs; 1 untested; 3 decision-excluded.**
- Confirmed: **8 findings affecting 15 checklist items** (10 missing, 5 differs). All reproduced twice in each engine.
- Classes, counted by finding: **A 0 · B 0 · C 8**. Class C affected checklist items: **15** (overlapping F1/F2 counted once).
- Separate unsure results: **6 differing checklist items**, grouped into U1–U5; **0 findings** from them.
- Incomplete check: **1** (Add cancellation). Excluded: **3** (source-to-collection filing and two general-sort expectations).
