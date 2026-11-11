# Lists and sidebar UX parity audit

Five checklist items have repeatable, confident reference differences, grouped into **three Class B decisions**. No Class A fix is established. Nine other failed comparisons have uncertain reference behavior and are **not findings**.

The repository was read-only. The checklist was written before Ore was opened or its UI source was read. Only artifacts under this directory were written. No server was started/stopped, no seed was run, and the installed app and personal library were not opened. Git status was clean before and after. Opening sources through the allowed scratch app updates their reading/touched state.

Reference expectations are recalled behavior, not a live audit of Linear/Raindrop/Finder. The original checklist is preserved. Items 35 and 80 are explicitly downgraded to `unsure`: confidence in a general pattern was not enough to establish the precise sidebar/modified-Enter expectation. Neither contributes a finding.

**Method and limits.** Chromium and WebKit, two fresh-context passes per engine for every reported tested item. Real keyboard, mouse, down/move/up drags, and native browser copy/paste; no synthetic DOM events and no `fill`. Viewports 1280×800, 1280×480, and 760×800; all screenshots use deviceScaleFactor 2. The supplied To read list initially had four rows, Learning two, Home one Continue reading source, and Feed zero posts. Insufficient or excluded coverage is `untested`, never inferred as working. The report has 33 excluded items and 13 other untested/partially tested items.

The initial sidebar key probe failed to establish sidebar focus; those records were discarded. `sidebar-page-verified`/`sidebar-type-verified` replace them. The initial skill-prefix probe could land on the matching row after source order changed; `skill-prefix-verified` starts on Lecture and replaces it. Two selector mistakes in setup are retained in logs and are not product failures. The AI note was verified empty afterward (`cleanup.json`). macOS input boundaries were checked with Command+Left/Right, not Home/End.

**1. Every checklist item**

`C2/W2` means two runs in Chromium and two in WebKit. “Partial C2/W2” describes evidence for only part of an item and remains untested overall. Full behavior wording and original confidence are in [checklist.md](checklist.md).

| # | Surface and behavior (reference; confidence) | Result | Engines / observation |
|---|---|---|---|
| 1 | All sources: Single click opens the row target. (Linear; sure) | **untested** | —. Excluded: existing Any list or row with actions convention already covers single-click opening. |
| 2 | All sources: Up/Down move focus/selection one row and stop at the first/last row. (Finder; sure) | **works** | C2/W2. Both ends clamp correctly after more Up/Down presses than there are rows; focus remains on the list. See final-checks.json, edges-*. |
| 3 | All sources: Home/End select the first/last row. (Finder; unsure) | **missing** | C2/W2. UNSURE reference; Home/End do not move the selected row/focused Home tile. See U1; not a finding. |
| 4 | All sources: Page Up/Page Down move through a scrollable list without opening a row. (Finder; sure) | **untested** | —. Four To read rows fit in the 406px list even at 1280×480. No paging distance; no scale seed added. |
| 5 | All sources: Enter opens the keyboard-selected row. (Linear; sure) | **works** | C2/W2. Enter opens the selected source; checked against its title in the reader, twice per engine. |
| 6 | All sources: Space selects a row without opening its full detail (Quick Look itself excluded). (Finder; unsure) | **missing** | C2/W2. UNSURE reference; Space on the focused list with no selected row does not select one. See U2; not a finding. |
| 7 | All sources: Typing a title prefix locates a matching row without an explicit search field. (Finder; sure) | **missing** | C2/W2. SURE reference; typed prefixes do not find the visible matching row/tile. Class B, F1. |
| 8 | Skill page: Single click opens the row target. (Linear; sure) | **untested** | —. Excluded: existing Any list or row with actions convention already covers single-click opening. |
| 9 | Skill page: Up/Down move focus/selection one row and stop at the first/last row. (Finder; sure) | **works** | C2/W2. Both ends clamp correctly after more Up/Down presses than there are rows; focus remains on the list. See final-checks.json, edges-*. |
| 10 | Skill page: Home/End select the first/last row. (Finder; unsure) | **missing** | C2/W2. UNSURE reference; Home/End do not move the selected row/focused Home tile. See U1; not a finding. |
| 11 | Skill page: Page Up/Page Down move through a scrollable list without opening a row. (Finder; sure) | **works** | C2/W2. At 1280×480 Page Down scrolls the skill source column/Home; Page Up returns to its top, without opening a row. |
| 12 | Skill page: Enter opens the keyboard-selected row. (Linear; sure) | **works** | C2/W2. Enter opens the selected source; checked against its title in the reader, twice per engine. |
| 13 | Skill page: Space selects a row without opening its full detail (Quick Look itself excluded). (Finder; unsure) | **missing** | C2/W2. UNSURE reference; Space on the focused list with no selected row does not select one. See U2; not a finding. |
| 14 | Skill page: Typing a title prefix locates a matching row without an explicit search field. (Finder; sure) | **missing** | C2/W2. SURE reference; typed prefixes do not find the visible matching row/tile. Class B, F1. |
| 15 | Home lists: Single click opens the row target. (Linear; sure) | **untested** | —. Excluded: existing Any list or row with actions convention already covers single-click opening. |
| 16 | Home lists: Up/Down move focus/selection one row and stop at the first/last row. (Finder; sure) | **untested** | —. Excluded: journey “home: arrows move between skill tiles and Continue reading, from the focused name”, journeys.ts:3174. |
| 17 | Home lists: Home/End select the first/last row. (Finder; unsure) | **missing** | C2/W2. UNSURE reference; Home/End do not move the selected row/focused Home tile. See U1; not a finding. |
| 18 | Home lists: Page Up/Page Down move through a scrollable list without opening a row. (Finder; sure) | **works** | C2/W2. At 1280×480 Page Down scrolls the skill source column/Home; Page Up returns to its top, without opening a row. |
| 19 | Home lists: Enter opens the keyboard-selected row. (Linear; sure) | **works** | C2/W2. Tab to a Continue reading title, then Enter opens that source. |
| 20 | Home lists: Space selects a row without opening its full detail (Quick Look itself excluded). (Finder; unsure) | **differs** | C2/W2. UNSURE reference; Space on a focused Home title opens the reader. See U3; not a finding. |
| 21 | Home lists: Typing a title prefix locates a matching row without an explicit search field. (Finder; sure) | **missing** | C2/W2. SURE reference; typed prefixes do not find the visible matching row/tile. Class B, F1. |
| 22 | Feed: Single click opens the row target. (Linear; sure) | **untested** | —. The supplied Feed has no followed feeds or posts. No post-row keyboard or pointer result can be established. |
| 23 | Feed: Up/Down move focus/selection one row and stop at the first/last row. (Finder; sure) | **untested** | —. The supplied Feed has no followed feeds or posts. No post-row keyboard or pointer result can be established. |
| 24 | Feed: Home/End select the first/last row. (Finder; unsure) | **untested** | —. The supplied Feed has no followed feeds or posts. No post-row keyboard or pointer result can be established. |
| 25 | Feed: Page Up/Page Down move through a scrollable list without opening a row. (Finder; sure) | **untested** | —. The supplied Feed has no followed feeds or posts. No post-row keyboard or pointer result can be established. |
| 26 | Feed: Enter opens the keyboard-selected row. (Linear; sure) | **untested** | —. The supplied Feed has no followed feeds or posts. No post-row keyboard or pointer result can be established. |
| 27 | Feed: Space selects a row without opening its full detail (Quick Look itself excluded). (Finder; unsure) | **untested** | —. The supplied Feed has no followed feeds or posts. No post-row keyboard or pointer result can be established. |
| 28 | Feed: Typing a title prefix locates a matching row without an explicit search field. (Finder; sure) | **untested** | —. The supplied Feed has no followed feeds or posts. No post-row keyboard or pointer result can be established. |
| 29 | Sidebar skills and collections: Single click opens the row target. (Linear; sure) | **untested** | —. Excluded: the Sidebar convention already covers its navigation controls and roving keyboard focus. D36 makes collections grouping headers, not source destinations. |
| 30 | Sidebar skills and collections: Up/Down move focus/selection one row and stop at the first/last row. (Finder; sure) | **untested** | —. Excluded: the Sidebar convention already covers its navigation controls and roving keyboard focus. D36 makes collections grouping headers, not source destinations. |
| 31 | Sidebar skills and collections: Home/End select the first/last row. (Finder; unsure) | **untested** | —. Excluded: the Sidebar convention already covers its navigation controls and roving keyboard focus. D36 makes collections grouping headers, not source destinations. |
| 32 | Sidebar skills and collections: Page Up/Page Down move through a scrollable list without opening a row. (Finder; sure) | **works** | C2/W2. At 1280×480, with a sidebar button actually focused, Page Down scrolls sidebar 0→84px; Page Up returns to 0. Corrected runs in supplement.json. |
| 33 | Sidebar skills and collections: Enter opens the keyboard-selected row. (Linear; sure) | **untested** | —. Excluded: the Sidebar convention already covers its navigation controls and roving keyboard focus. D36 makes collections grouping headers, not source destinations. |
| 34 | Sidebar skills and collections: Space selects a row without opening its full detail (Quick Look itself excluded). (Finder; unsure) | **differs** | C2/W2. UNSURE reference; focus AI in the sidebar and Space opens its skill page. See U4; not a finding. |
| 35 | Sidebar skills and collections: Typing a title prefix locates a matching row without an explicit search field. (Finder; unsure (revised)) | **missing** | C2/W2. UNSURE after reconsidering applicability: no sidebar prefix matching for “dis”. Finder content-view behavior cannot safely establish Finder sidebar behavior. See U5. |
| 36 | All sources: Shift-click selects the contiguous range between the anchor and clicked row. (Finder; sure) | **untested** | —. Excluded: Any list selection convention (range, toggle, Shift+arrows, Command+A, Esc, whole-selection menus). |
| 37 | Skill page: Command-click toggles one row without opening it. (Finder; sure) | **untested** | —. Excluded: Any list selection convention (range, toggle, Shift+arrows, Command+A, Esc, whole-selection menus). |
| 38 | Home lists: Shift+Down/Up extends and contracts a contiguous selection. (Finder; sure) | **untested** | —. Excluded: Any list selection convention (range, toggle, Shift+arrows, Command+A, Esc, whole-selection menus). |
| 39 | Feed: Command+A selects the visible list items without selecting the page text. (Finder; sure) | **untested** | —. Excluded: Any list selection convention (range, toggle, Shift+arrows, Command+A, Esc, whole-selection menus). |
| 40 | All sources: Esc clears a row selection while keeping the list usable by keyboard. (Linear; sure) | **untested** | —. Excluded: Any list selection convention (range, toggle, Shift+arrows, Command+A, Esc, whole-selection menus). |
| 41 | All sources: Right-click on a selected row preserves the selected group. (Finder; sure) | **untested** | —. Excluded: Any list selection convention (range, toggle, Shift+arrows, Command+A, Esc, whole-selection menus). |
| 42 | Skill page: Row ellipsis and row right-click expose equivalent actions. (Linear; sure) | **untested** | —. Excluded: Right-click by surface / same menu actions conventions. Feed row case additionally has no data. |
| 43 | Home lists: Right-click a row opens actions for that row. (Linear; sure) | **untested** | —. Excluded: Right-click by surface / same menu actions conventions. Feed row case additionally has no data. |
| 44 | Feed: Right-click a row opens actions for that row. (Linear; sure) | **untested** | —. Excluded: Right-click by surface / same menu actions conventions. Feed row case additionally has no data. |
| 45 | Sidebar skills and collections: A skill and a collection each expose their own context menu. (Finder; sure) | **untested** | —. Excluded: Right-click by surface / same menu actions conventions. Feed row case additionally has no data. |
| 46 | All sources: Blank-space right-click exposes list-level actions. (Finder; unsure) | **untested** | —. Excluded: Right-click by surface / same menu actions conventions. Feed row case additionally has no data. |
| 47 | All sources: Menus put destructive actions last and keep icons consistent among sibling actions. (Linear; sure) | **works** | C2/W2. Inspected the All sources row menu: top-level action siblings consistently have no leading icons; submenu chevrons and shortcut keycaps are not action icons. Archive is last. No mixed icon-family issue in these rendered menu rows. |
| 48 | All sources: Dragging a source onto a sidebar skill visibly identifies the drop target and files the source there. (Finder; sure) | **untested** | —. Excluded: existing drag/filing conventions and sidebar drag journey at journeys.ts:2918. No re-report. |
| 49 | All sources: Dragging selected sources onto a collection files the selected group together. (Raindrop; sure) | **untested** | —. Excluded by D36: collections group skills; a source is filed under skills, not moved directly into a collection as a Raindrop bookmark is. |
| 50 | Sidebar skills and collections: Dragging a sidebar item reorders it with a visible placement indication. (Finder; sure) | **untested** | —. Excluded: existing drag/filing conventions and sidebar drag journey at journeys.ts:2918. No re-report. |
| 51 | All sources: Esc during a drag cancels the operation. (Finder; sure) | **works** | C2/W2. Real down/move drag produces one ghost and a lit AI target; Escape and mouse-up remove the ghost without filing the row. Four repetitions. |
| 52 | Sidebar skills and collections: Dropping an item on itself leaves its location intact. (Finder; sure) | **works** | C2/W2. Real sidebar drag starts (lifted AI item), then drops on AI itself. Sidebar text/order is identical before/after in all four runs. |
| 53 | Sidebar skills and collections: Rename selects the existing name and Enter commits it while retaining focus on the item. (Finder; sure) | **untested** | —. Excluded: Title edited in place and Sidebar rename conventions; commit/cancel behavior is already covered. |
| 54 | Sidebar skills and collections: Esc cancels a rename and restores the original item name. (Finder; sure) | **untested** | —. Excluded: Title edited in place and Sidebar rename conventions; commit/cancel behavior is already covered. |
| 55 | All sources: Deleting a row provides undo and moves keyboard focus to a surviving row. (Linear; sure) | **untested** | —. Excluded: list archive / archive Undo / undo journeys at journeys.ts:6119, 6144 and 5362; existing history conventions. |
| 56 | All sources: Command+Z reverses deletion and Shift+Command+Z reapplies it. (Finder; sure) | **untested** | —. Excluded: list archive / archive Undo / undo journeys at journeys.ts:6119, 6144 and 5362; existing history conventions. |
| 57 | All sources: The selected sort order survives opening a source and navigating Back. (Raindrop; sure) | **untested** | —. Excluded by D110: recency order is settled, with pinned order from D74. A missing custom sort picker is not a finding. Actual Done-mode persistence was additionally observed. |
| 58 | Skill page: The selected filter survives opening a source and navigating Back. (Raindrop; sure) | **works** | C2/W2. The skill page’s selected Done status survives opening its FSRS source and Back. Feed By feed + All also survives Home→Feed; this is extra mode evidence, not post-row coverage. |
| 59 | All sources: Back restores the previous list scroll position and selected row. (Finder; sure) | **untested** | —. Excluded: journey “list: back from a source opened low in To read…” at journeys.ts:6205 and Back/Forward conventions. |
| 60 | All lists: Every row action and header button has an explanatory hover hint, including its available shortcut. (Linear; sure) | **untested** | —. Excluded explicitly: earlier hint sweep and hints.test.ts guard. Not re-tested as a new finding. |
| 61 | Sidebar skills and collections: Collapsed sidebar retains a discoverable keyboard-accessible way to navigate skills and collections. (Linear; unsure) | **works** | C2/W2. Hide sidebar, then its displayed Command+Shift+S shortcut restores the navigation. Reference confidence remains unsure; this is a passing observation. |
| 62 | Sidebar skills and collections: Narrowing and widening the sidebar retains access to its navigation controls. (Finder; sure) | **missing** | C2/W2. SURE reference; dragging the sidebar boundary in either direction leaves it 216px wide. Class B, F2. |
| 63 | All lists: At 1280×480 every opened menu remains scrollable or fully usable inside the window. (Linear; sure) | **untested** | —. Excluded explicitly: menu viewport hygiene guard already covers menus against short windows. Paging was separately tested at 1280×480. |
| 64 | All lists: At 760px width source titles do not push row actions off-screen. (Raindrop; sure) | **untested** | Partial C2/W2. Partial passes only: at 760px, All sources, Learning/Habits and Home rows retain visible in-window ⋯ controls. Feed has no rows, so “all lists” is not fully tested. |
| 65 | All lists: A very long source title is contained without covering adjacent actions. (Raindrop; sure) | **untested** | Partial C2/W2. Partial passes only: the supplied 126-character habit title stays contained in All sources and Habits at 760px. No long Feed title was available; no all-lists claim. |
| 66 | All lists: A missing thumbnail leaves the row readable and usable. (Raindrop; sure) | **untested** | —. Excluded: Any list of sources thumbnail/kind-icon convention. Existing fallback icons were visible during other checks. |
| 67 | All lists: Rows remain usable with zero or many assigned filing categories. (Raindrop; unsure) | **untested** | —. No sufficiently varied zero/many-skill source-row fixtures across these lists. Existing rows have at most two skills; did not infer scale behavior from code. |
| 68 | All lists: An empty list offers a relevant next action rather than a broken or indefinite loading view. (Linear; sure) | **untested** | Partial C2/W2. Partial passes only: empty Feed offers Follow; empty Creativity sources explain Add/Command+N. No empty Home/library/sidebar dataset was available; did not erase the supplied library. |
| 69 | All sources: A search with no matches shows an explicit no-results state and permits clearing the search. (Linear; sure) | **works** | C2/W2. Type “zzxq no source should match” in Filter sources. Explicit no-match text appears; Escape clears the query and restores rows. |
| 70 | All lists: Opening Add focuses its input from every supported entry point. (Linear; sure) | **works** | C2/W2. Home + Add, All sources + Add, skill Sources +, Feed + Add and Command+N with sidebar focus all focus the Add input. Twice per engine. |
| 71 | Add: During submission, progress stays visible and duplicate submission is prevented. (Linear; sure) | **works** | C2/W2. A real missing-file request delayed 4 seconds at the browser boundary shows Adding…, keeps the input read-only, and three Enter presses result in one add request. |
| 72 | Add: An import error keeps the submitted value recoverable and provides a retry path. (Linear; sure) | **works** | C2/W2. The real missing-file error names the path and next step. Path stays in the input; Enter retries it, producing exactly one further request. |
| 73 | Add: Stopping an import leaves a stable stopped state and permits a new attempt. (Linear; unsure) | **untested** | —. No naturally long-running import was available. The wait test delays a request, which does not establish cancellation of a running importer. Did not infer a stopped state from code. |
| 74 | All sources: Command+C copies the selected source in a useful representation. (Finder; sure) | **untested** | —. Excluded: Any list Command+C as linked Markdown convention. |
| 75 | All sources: Command+X followed by Command+V in a collection moves the selected source there. (Finder; unsure) | **untested** | —. Excluded by D36: collections group skills; a source is filed under skills, not moved directly into a collection as a Raindrop bookmark is. |
| 76 | All sources: Dragging across blank space selects multiple rows with a selection rectangle. (Finder; sure) | **missing** | C2/W2. SURE reference; dragging from blank list space through rows makes no selection rectangle and selects no rows. Class B, F3. |
| 77 | Sidebar rename: Double-click selects a word and triple-click selects the name text while editing. (Finder; sure) | **works** | C2/W2. In collection Rename, a real double-click selects “Tech”; triple-click selects all 15 name characters. Canceled without changing the name. |
| 78 | Add: Plain text, rich text, multiline text and a URL can be pasted without losing entered content. (Linear; unsure) | **works** | C2/W2. Real Command+C/Command+V between browser pages and Add preserves plain words, rich-text words, three lines and a URL. No synthetic paste event. WebKit inserts an extra paragraph newline; no text lost. Rich import fidelity was not retested. |
| 79 | Sidebar rename: At field boundaries arrows and Shift+arrows edit/select text without navigating sidebar rows. (Finder; sure) | **works** | C2/W2. In collection Rename, Command+Left/Right then outward arrows stay at offsets 0/15; Shift+Left selects the final character, without navigating the sidebar. See boundary.json. |
| 80 | All lists: Tab traverses actionable controls and Shift+Enter does not unexpectedly submit or open another row. (Linear; unsure (revised)) | **differs** | C2/W2. UNSURE after reconsidering the reference: Tab traces recorded on each available list; Shift+Enter opens the selected source in All sources and a skill page. Linear’s exact modified-Enter behavior was not established. See U6; not a finding. |

**2. Findings — confident comparisons only**

A class is a primary classification. Class B takes precedence when adopting the reference would introduce a noticeable interaction or compete with existing shortcuts. Cross-screen applicability is noted separately; it is not counted again as Class C.

**F1 — No title-prefix navigation in source lists or Home (items 7, 14, 21). Class B.**

1. Open All sources, keep keyboard focus in the list, and press Down to select a row other than Building Effective Agents. Type `bui` without modifiers.
2. Open Learning. Use Up/Down to select Lecture 4 the testing effect. Type `the`, which matches the other visible source, The Testing Effect: Why Retrieval Beats Rereading.
3. Open Home. Tab to a Continue reading title. Type `lea`, which matches the visible Learning skill tile.

Ore keeps the existing row selection/focus in all three cases. It does not move to the title beginning with the typed prefix. This happened in both runs of both engines. Finder’s content lists/icon views select a visible filename by a typed prefix without opening a search field.

This needs Tyler because Ore also assigns plain letters to actions, including A and R (D178). Adding type-to-find requires a deliberate rule for which keys act immediately. No change to Command+K is proposed. Source lists and skill pages share the same handler; Home implements its keyboard handling separately. Feed was empty and is not claimed as a confirmed affected screen.

Likely implementation: [apps/desktop/src/App.tsx:1271](apps/desktop/src/App.tsx:1271) handles selection/arrows/Enter/rename, with no prefix buffer; [apps/desktop/src/Home.tsx:114](apps/desktop/src/Home.tsx:114) handles arrow movement only.

Evidence: All sources [2× WebKit screenshot](shots/webkit-2-All-sources-typefind.png); Learning [2× WebKit screenshot](shots/webkit-2-skill-prefix-verified.png); Home [2× WebKit screenshot](shots/webkit-2-Home-typefind.png). Repetition records: `observations.json` (All-sources-typefind, Home-typefind) and `final-checks.json` (skill-prefix-verified).

**F2 — Sidebar cannot be resized (item 62). Class B.**

1. At 1280×800, put the pointer on the sidebar/content divider, x=215, y=210.
2. Hold the mouse and move right 120px; release.
3. Repeat from the divider, moving left 80px.

Ore stays 216px wide before and after both drags, in all four runs. Long names remain truncated. Finder permits dragging its sidebar divider to change the width. This is a functional capability difference, not a preference for a particular width. It needs Tyler’s decision because it introduces a persistent layout control; the current layout is deliberately fixed.

Likely implementation: [apps/desktop/src/styles.css:59](apps/desktop/src/styles.css:59) fixes `--sidebar: 216px`; [apps/desktop/src/styles.css:109](apps/desktop/src/styles.css:109) uses it directly for the grid. [apps/desktop/src/App.tsx:2136](apps/desktop/src/App.tsx:2136) renders Sidebar without a resize separator.

Evidence: [2× WebKit screenshot](shots/webkit-2-sidebar-resize.png); `observations.json`, sidebar-resize: all four before/wide/narrow boxes are 216px.

**F3 — No rectangle selection from blank list space (item 76). Class B.**

1. Open All sources at 1280×800 and clear any text/row selection.
2. Start in blank space below the last row, near the list’s right edge.
3. Hold the mouse, drag diagonally up and left across the rows, and release.

Ore does not draw a selection rectangle and leaves zero rows selected. The row under the ending pointer only gains hover styling. Both engines repeated this twice. Finder’s content list supports dragging a selection rectangle from empty space to select intersected items.

This needs Tyler because it adds a new selection gesture and must coexist with dragging a source, selecting text, and clicking blank space. Existing Shift-click/Command-click selection is not being reported again.

Likely implementation: [apps/desktop/src/App.tsx:1987](apps/desktop/src/App.tsx:1987) renders the list’s keyboard/pointer-move handlers; [apps/desktop/src/App.tsx:2015](apps/desktop/src/App.tsx:2015) sets up dragging existing rows. There is no blank-space rectangle-selection handler.

Evidence: [2× WebKit screenshot](shots/webkit-2-marquee-during.png) and [2× WebKit screenshot](shots/webkit-2-marquee.png); `observations.json`, marquee records show no selected rows during or after the drag in all four runs.

**Uncertain comparisons — not findings and not assigned A/B/C**

These sections give the observed mismatch required by the checklist without claiming an established reference requirement. Every observation below repeated twice in both engines.

**U1 — Home/End do not select list endpoints (3, 10, 17).** Open All sources/Learning, focus the list and select its first row with Down; press End, then Home. On Home, Tab to its first source title and press End/Home. Ore leaves the selection/focus on the same item. The checklist expected endpoint selection, but Finder’s Home/End behavior can be scrolling rather than selection, so this expectation remains unsure.

Likely locations: [apps/desktop/src/App.tsx:1271](apps/desktop/src/App.tsx:1271), [apps/desktop/src/Home.tsx:114](apps/desktop/src/Home.tsx:114). Screenshots: [2× WebKit screenshot](shots/webkit-2-All-sources-home-end.png), [2× WebKit screenshot](shots/webkit-2-Learning-home-end.png), [2× WebKit screenshot](shots/webkit-2-Home-home-end.png).

**U2 — Space does not establish a list selection (6, 13).** Open All sources or Learning with focus on the list but no keyboard-selected row; press Space. No source row becomes selected. The supposed Finder selection-only action was not established independently of Quick Look, which is out of scope. No finding.

Likely location: [apps/desktop/src/App.tsx:1271](apps/desktop/src/App.tsx:1271) has no Space branch. Screenshots: [2× WebKit screenshot](shots/webkit-2-space-unselected-All-sources.png), [2× WebKit screenshot](shots/webkit-2-space-unselected-Learning.png).

**U3 — Space opens Home’s focused source (20).** Tab to a Continue reading title, then press Space. Ore opens the reader through the title’s native button behavior. The checklist expected selection without opening; that is not a safely established Finder comparison once Quick Look is excluded.

Likely location: [apps/desktop/src/Home.tsx:257](apps/desktop/src/Home.tsx:257). Evidence: [2× WebKit screenshot](shots/webkit-2-Home-space.png).

**U4 — Space opens a sidebar skill (34).** From All sources, Shift+Tab back to the sidebar’s current navigation button; Down twice reaches AI. Press Space. Ore opens AI’s skill page. A selection-only Finder sidebar expectation is uncertain; opening a focused button is normal button behavior.

Likely location: [apps/desktop/src/Sidebar.tsx:533](apps/desktop/src/Sidebar.tsx:533). Evidence: [2× WebKit screenshot](shots/webkit-2-sidebar-space.png); `boundary.json` records the focused AI button before Space.

**U5 — Sidebar has no title-prefix navigation (35, confidence revised to unsure).** From the focused All sources sidebar button, type `dis`. Focus stays on All sources instead of Distributed Systems…. Finder content-view type selection is known; the same behavior in its sidebar was not established. No finding.

Likely location: [apps/desktop/src/Sidebar.tsx:475](apps/desktop/src/Sidebar.tsx:475). Evidence: [2× WebKit screenshot](shots/webkit-2-sidebar-type-verified.png); only corrected sidebar-focused records in `supplement.json` are used.

**U6 — Shift+Enter opens the selected source (80, confidence revised to unsure).** Open All sources or Learning; Down selects a source, then Shift+Enter opens it. Tab traversal was also exercised through each available content surface’s controls; Feed has no row controls. The precise Linear behavior of Shift+Enter was not established, so this is not a parity finding. Add’s Shift+Enter did correctly insert a newline during the separate wait check.

Likely location: [apps/desktop/src/App.tsx:1308](apps/desktop/src/App.tsx:1308) handles Enter without excluding Shift. Screenshots: [2× WebKit screenshot](shots/webkit-2-shift-enter-All-sources.png), [2× WebKit screenshot](shots/webkit-2-shift-enter-Learning.png). Tab focus traces are in `keyboard-clipboard.json`.

**Evidence files and coverage boundaries**

- [observations.json](observations.json): initial interaction runs and geometry. Invalid sidebar focus probes are explicitly superseded.
- [supplement.json](supplement.json): Add entry/wait/error/retry, corrected sidebar paging/type-prefix focus, narrow-window control boxes.
- [final-checks.json](final-checks.json): row edge clamping, Enter opening, corrected skill-prefix test, mode persistence, real double/triple-click selection.
- [keyboard-clipboard.json](keyboard-clipboard.json): Tab traces, unselected Space, Shift+Enter, native copy/paste tests.
- [boundary.json](boundary.json): sidebar Space and corrected Mac input-boundary checks.
- Scripts and logs beside the report reproduce the runs. Screenshots are under [shots/](shots/).

No successful import, destructive library reset, or seed-big run was needed. AI output and streaming were not evaluated. For the wait test, Playwright postponed forwarding a real missing-file add request by four seconds; the error came from the actual bridge/core. This proves the visible waiting/deduplication/error path, not importer cancellation or AI streaming. Existing hint, menu-edge, Esc-focus, selection, thumbnail, rename-save and undo cases were deliberately excluded from new findings.

**3. Totals**

| Measure | Count |
|---|---:|
| Checklist items | 80 |
| Fully checked, twice in both engines | 34 |
| Works | 20 |
| Missing | 11 |
| Differs | 3 |
| Untested overall | 46 |
| — excluded by requested rules/decisions/earlier coverage | 33 |
| — unavailable/partial states | 13 |
| Confirmed failed items (`sure`) | 5 |
| Failed uncertain comparisons, withheld | 9 |

| Finding class | Failed checklist items | Distinct findings |
|---|---:|---:|
| A — plain miss | 0 | 0 |
| B — needs Tyler | 5 | 3 |
| C — cross-screen primary classification | 0 | 0 |

Missing totals include six uncertain comparisons; differs totals are all uncertain. The five confirmed missing items are the only findings. WebKit and Chromium agree on those findings in both repetitions.

Totals: 34 checked; 20 works; 11 missing; 3 differs; 46 untested. Findings: A 0, B 5 items / 3 decisions, C 0. Uncertain failures withheld: 9.
