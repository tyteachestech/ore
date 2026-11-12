# Diagram sweep 4

**Not clean. Three findings meet the first-hour threshold: Top placement is lost on reopen, a saved elbow bend resets on the next endpoint-node move, and menu Paste still fails in the supplied WebKit session.** The other four d3 findings pass their original reproductions twice.

Tested HEAD: `9e0d6f60440c314dfe1edd6ea9090f42db3d2349`. WebKit **26.6**, `webkit.connect("ws://[::1]:1661/")`, Vite **1530**, scratch bridge **1532**. Viewport **1440×900**, deviceScaleFactor **2**. Screenshots are **2880×1800**. Read d1/d2/d3 reports, d3 prompt, D213/D216 and Canvas Conventions first. No implementation files, Git state, servers, installed app or real library were changed. All audit files are under `codex-out/d4/`.

## 1. Each d3 finding reproduced twice

| d3 finding | Result | Evidence |
|---|---|---|
| 1. Cyclic M/Tidy map runs Question→Recall through Fluency | **Fixed in the exact case.** Entered all 15 relationships from d3, then Tidy, in two independent constructions. Fluency stays clear; its name remains readable. | [Created 1](shots/07-big-created-1.png), [2](shots/07-big-created-2.png); [Tidy 1](shots/07-big-tidy-1.png), [2](shots/07-big-tidy-2.png). |
| 2. A + covers Neighbour and steals its click | **Fixed.** Same 160×64 boxes at (680,350) and (500,350). Right + is suppressed at 100%, 51% and 25%; clicking Neighbour selects it and creates nothing. At 400% the gap accommodates the + and Neighbour remains selectable. Each zoom tested twice. | [100% 1](shots/overlap-confirm-1-1.png), [2](shots/overlap-confirm-1-2.png); [25% 1](shots/overlap-confirm-0.25-1.png), [2](shots/overlap-confirm-0.25-2.png). `overlap-confirm-*` observations. |
| 3. Shift does not constrain an existing endpoint | **Fixed.** Original line and endpoint sequence repeated twice. Final endpoint angle is **15°**, versus d3's 21.8°. Soft horizontal snapping and Command bypass also work. | [1](shots/02-point-shift-1.png), [2](shots/02-point-shift-2.png); `02-angles-1/2`. |
| 4. Menu Paste fails while Command-V works | **Still broken in this WebKit setup.** Two initial constructions and two final confirmations: menu Paste leaves one box, shows the error; Command-V produces the second box. Text is readable from a ClipboardItem. | [Failure 1](shots/04-paste-error-final-1.png), [2](shots/04-paste-error-final-2.png); [keyboard recovery 1](shots/04-paste-fallback-final-1.png), [2](shots/04-paste-fallback-final-2.png). Finding 3. |
| 5. Diagram colours differ from the active note palette | **Fixed.** Red, green, blue and orange applied to a diagram and actual selected note text, each twice. Both render `#e58a84`, `#79d6b2`, `#82bde6`, `#e8b48f`, respectively. | [Diagram red 1](shots/03-red-1.png), [2](shots/03-red-2.png); [note red 1](shots/note-red-1.png), [2](shots/note-red-2.png). Other colours follow the same filename pattern; [computed note colours](note-palette.json). |

## 2. Ten-change acceptance table from d3

“Works” is limited to the exercised cases. It is not an exhaustive proof.

| # | Change | Result | Evidence / scope |
|---|---|---|---|
| 1 | Finished shape/arrow/line/text returns to Select; pen stays; Q keeps tools | **Works** | All seven tools, both lock states, twice: `01-tools-1/2` in observations. Six non-pen tools returned to Select; pen remained Pen. |
| 2 | Soft 45° steps, guide, Command bypass, Shift 15° | **Works in the direct checks** | Lines, arrows, existing endpoints and rotation, twice. Near-horizontal and near-diagonal drags show guides; Command bypasses; Shift constrains. Grid precedence is recorded below without a ranked finding. |
| 3 | Diagram/note colours match | **Works** | Four colours × two applications to each surface; exact values above. |
| 4 | Context-menu Cut, Copy, Paste | **Partly** | Copy and Cut work; Paste is present on objects and empty canvas but fails in this WebKit session. Finding 3. |
| 5 | Enter just after drawing waits for a label | **Works** | Both tool passes record `Enter-empty: editing=1`, followed by a successful Memory label. |
| 6 | Arrow midpoint double-click starts a label | **Works** | [1](shots/06-middle-label-1.png), [2](shots/06-middle-label-2.png): strengthens entered and retained. |
| 7 | Typed and tidied maps keep links out of unrelated concepts | **Works for both supplied maps** | Six-node and 12-node/15-link maps, M then Tidy, twice. No universal graph-layout guarantee inferred. |
| 8 | Persistent draggable elbow middle | **Partly** | Middle drag, Undo/Redo, and end-node movement work within one open editor. After close/reopen, moving an end node resets the chosen middle. Finding 2. |
| 9 | Align L/C/R; Place Middle/Top | **Partly** | Both selected boxes respond to every Align/Place choice; Undo/Redo and keyboard focus work, twice. Left/right survive reopen; Top does not. Finding 1. |
| 10 | Free-side + creates a linked editable node | **Works in the tested scope** | Box, ellipse, diamond × four directions × two runs. Also right-side creation at 25%, 50%, 100%, 200%, 400%, twice each, with label entry and Undo/Redo. |

## 3. Seven study tasks

Each task was completed once through real pointer/key input, using the same content as sweep 2. These are task walkthroughs, not timed studies with novice participants. Reproductions of findings were then constructed separately twice.

| Task | Result | Evidence |
|---|---|---|
| 1. Six concepts, five named links, move Memory | All concepts and labels created; connections follow Memory. | [After move](shots/01-map-after-mouse-1.png). |
| 2. Tidy the messy map | Six concepts remain readable; old Fluency obstruction absent. | [Tidy](shots/02-tidy-keyboard-1.png). |
| 3. Decision, two branches, retry loop | All five concepts and relationships created. Manual crossings remain editable; no new automatic-routing promise inferred from a hand-arranged flow. | [Flow](shots/03-flow-mouse-1.png). |
| 4. Two methods × four properties | Retrieval/Rereading table completed with Tab, including new rows. | [Matrix](shots/04-complete-keyboard-1.png). |
| 5. Heading, note, three concepts, enclosure | Top puts Practice section above the contents while editing. | [Top title](shots/task5-title-top-1.png). |
| 6. Rename, convert, recolour, delete and undo | Retrieve→Recall, rectangle→ellipse, two green concepts, labelled link restored. | [Corrected](shots/06-fixed-keyboard-1.png). |
| 7. Close, return, recover a readable view | Objects/text return and fit/zoom work, but the enclosure title returns to the middle. This triggered the independent persistence reproductions below. | [Reopened](shots/07-reopen-keyboard-1.png), [read view](shots/07-read-keyboard-1.png). |

## 4. New-control stress checks

- **+ placement and recovery:** crowded neighbour case at 25%, 51%, 100%, 400%, twice; no intercepted selection in the corrected runs. Creation at 25%, 50%, 100%, 200%, 400% opens the child label and returns focus to the canvas on Enter. One Undo removes the label; the next removes child and link; two Redos restore all three. This grouping is recorded, not challenged. [400% 1](shots/plus-zoom-4-1.png), [2](shots/plus-zoom-4-2.png).
- **All directions and incoming links:** box/ellipse/diamond in all four directions, twice; the six-node fan-in map hides Memory's used left side and allows an upper child. [Fan-in 1](shots/11-fanin-1.png), [2](shots/11-fanin-2.png).
- **Rotated/grouped shapes:** a 45° rotated shape hides +; directional keyboard creation still works. A two-shape group hides +; selecting one member exposes its free sides. Both cases repeated. No accidental creation or trapped focus observed. Not ranked as a request for new rotated/group behavior. [Rotated](shots/rotated-plus-1.png), [group](shots/group-plus-1.png), [member](shots/group-member-plus-1.png).
- **Elbow:** middle drag and Undo/Redo preserve the route; moving Memory down/right leaves the chosen middle x unchanged in both corrected runs. Reopening loses the remembered constraint, although the saved path initially looks unchanged. Finding 2.
- **Multi-selection:** two labelled boxes, Left/Centre/Right and Middle/Top, twice; both labels change, Escape returns canvas focus, nudge works, Undo/Redo works. [Top 1](shots/multi-Top-1.png), [2](shots/multi-Top-2.png). Saved Top placement has finding 1.
- **Angle/grid/shape snapping:** shape snapping remained enabled, verified in [command search](shots/snap-settings.png). With grid on, near-45° lines/arrows snap to 45°; Shift constrains to 15° and Command bypasses. Grid can push a near-axis drag outside the soft-angle threshold: the same 7×200 pointer delta becomes 90° without grid and 84.2894° with grid; the horizontal counterpart becomes 5.7106°. Repeated twice in `grid-conflict-1/2`. **Not ranked:** the live Excalidraw grid probe also produced a slanted line from the analogous gesture ([reference](shots/ref-grid.png)); this is grid precedence, not established missing parity, and Shift provides exact angles. Changing precedence would need an explicit behavior choice beyond this last-sweep filter.

## 5. Ranked findings

### 1. Top label placement is lost when the diagram is reopened — A

**First-hour impact:** the learner adds a titled enclosure, closes the diagram to read, then returns. The title moves into the concepts it was deliberately placed above. The note preview initially still shows the good layout, making the editor's change surprising.

**Steps, two independent constructions:**

1. At 100%, draw a box from (400,330) to (1000,530), type `Practice section`, finish the label.
2. Style → More → Place → Top. In run 1 also choose Align Left; in run 2 choose Align Right.
3. Done; wait for the note preview; reopen that same diagram; expand to full window.

**Ore:** the title moves from top to middle both times. Its relative position within the box changes, so this is not excluded view restoration. The label's SVG text y increases **77.5 scene units** in each run. Left/right alignment survives. Task 7 additionally demonstrates the resulting title collision with actual enclosed concepts.

**Reference:** live Excalidraw retained Align top after reloading its page: [before](shots/ref-top-before.png), [after](shots/ref-top-after.png). D216 explicitly gives Top the purpose of a persistent section title.

**Evidence:** [before 1](shots/reopen-align-before-1.png), [after 1](shots/reopen-align-after-1.png); [before 2](shots/reopen-align-before-2.png), [after 2](shots/reopen-align-after-2.png). `reopen-align-*` records include the SVG coordinates. [Actual enclosure after reopening](shots/07-read-keyboard-1.png).

**Likely source:** `apps/desktop/src/draw/model.ts:359` makes `verticalAlign: "top"` an omitted save default; `compact` at line 368 strips it. `fromScene` at lines 316–323 does not restore that default. `syncAll` at line 407 only uses top placement when the property explicitly equals `"top"`, otherwise recentering it.

**Smallest fix:** restore the omitted vertical-alignment default on load, consistently with the file format, or explicitly retain the property when saving. Add a save/load/UI-reopen regression for a top-titled enclosure, preserving legacy middle labels.

### 2. A saved elbow bend resets on the next move of its connected node — C

**First-hour impact:** routing a relation around content works until the learner closes and reopens the map. A tiny later node adjustment discards the route adjustment. This is the same kind of saved-state loss as finding 1 in another new control, with a separate omitted property.

**Steps, twice:**

1. Draw Recall at (350,300), 160×64. Click its right +, label the child Memory.
2. Move Memory down with ten Shift-Down presses. Select the connecting arrow and choose Style → More → Elbow.
3. Drag the middle handle about 55 px right. Undo/Redo restores this move correctly. Move Memory down/right once with Shift-Down and Shift-Right; the middle stays fixed.
4. Done, reopen the same diagram, expand, select Memory by its visible rectangle, press Right once.

**Ore:** reopening initially preserves the drawn path. The next **1-unit** node move reroutes its middle about **44.08 units left**, undoing the manually chosen route. In independent runs, middle x changed **6078 → 6033.92** and **6149 → 6104.92**. Before closing, endpoint movements had preserved those chosen x values.

**Reference:** FigJam's connector path handles and tldraw's middle-segment handle are the documented reference for this control in [d3](../d3/report.md) and [d2](../d2/report.md). No new live reload guarantee for those products is claimed. Ore's own D216 says the middle stays as the ends move; saving and reopening should preserve the choice.

**Evidence:** [chosen route 1](shots/reopen-elbow-before-2.png), [after reopen and nudge 1](shots/reopen-elbow-move-2.png); [chosen route 2](shots/reopen-elbow-before-3.png), [after reopen and nudge 2](shots/reopen-elbow-move-3.png). `reopen-elbow-move-2/3` contain both paths.

**Likely source:** `Editor.tsx:1186` stores the constraint as `customData.oreElbow.mid`; `model.ts:358` lists `customData: undefined`, and `compact` at line 368 discards every field whose default is undefined, including populated customData. `elbowMid` at lines 469–470 therefore cannot recover the constraint; rerouting at line 440 falls back to the automatic middle.

**Smallest fix:** preserve populated customData when serializing; keep intentionally discarded bookkeeping fields explicit. Add a round-trip regression that moves a bound endpoint after reloading, not merely a screenshot of the unchanged saved path.

### 3. Menu Paste still fails although the copied diagram text is readable — A, WebKit-qualified

**First-hour impact:** ordinary right-click Copy → Paste does nothing but show an error. Command-V works, so the user must abandon the mouse route.

**Steps, twice in the final confirmation:**

1. Draw and label `Clipboard concept` at (400,350), 160×64.
2. Right-click the box → Copy.
3. Right-click blank canvas at (900,550) → Paste; wait.
4. Press Command-V without changing the clipboard.

**Ore:** menu Paste shows **“Couldn't reach the clipboard. Try ⌘V.”** and leaves one box plus its label. Command-V creates the second box plus label. The same result occurred in two earlier constructions. Granting the supported `clipboard-read` permission did not fix it.

**What changed since d3:** there is now a separate try/catch fallback. It is present in the tested source, but it does not complete the user workflow. Read-only diagnostics in this same context establish that (a) `read()` can return a text/plain ClipboardItem, (b) a subsequent `readText()` in that same evaluation rejects, (c) a fresh `readText()` succeeds, and (d) reading the returned item's text via `getType('text/plain')` succeeds twice. This narrows the issue to the sequential read path; it does not establish native Tauri permission behavior.

**Reference:** live Excalidraw exposes Cut/Copy/Paste ([menu](shots/ref-menu.png)). Its same-session Paste probe did not establish a second visible shape ([result](shots/ref-paste.png)), so no claim of superior permission behavior is made. The concrete Ore miss is discarding usable text returned by its first clipboard read and then requiring another read.

**Evidence:** [error 1](shots/04-paste-error-final-1.png), [error 2](shots/04-paste-error-final-2.png); [Command-V 1](shots/04-paste-fallback-final-1.png), [2](shots/04-paste-fallback-final-2.png); [sequential-read diagnostic](clipboard-sequence.json); [text successfully read from ClipboardItems](clipboard-item-text.json).

**Likely source:** `apps/desktop/src/draw/Editor.tsx:579` reads ClipboardItems but only uses images. Line 587 calls `readText()` even when the first result already contained text/plain. Its rejection reaches the toast at line 589.

**Smallest fix:** use text/plain from the already-returned ClipboardItem when there is no image, avoiding the redundant read; reserve `readText()` for the path where no usable item was obtained. Verify the real Copy → menu Paste gesture in WebKit, not only mocked clipboard promises.

## Boundaries and evidence quality

- No source edits, commits, stashes, server lifecycle changes, installed-app access or real-library writes. Git HEAD stayed the same; `git diff` stayed empty; status remained the pre-existing untracked `codex-out/` tree.
- All app changes used real mouse/keyboard input through the supplied mock. No React state, model, localStorage or diagram JSON was injected. DOM/SVG and clipboard reads supplied observations only.
- The harness reuses read-only d2/d3 helper functions. Its initial text bounding-box clicks were invalid for some SVG labels in remote WebKit. Those attempts are not counted as successful neighbour selection or endpoint movement. `overlap-confirm-*` and `elbow-confirm-*` use visible rectangle geometry and verified selection/movement. This correction is recorded rather than filed as an Ore bug.
- An initial note-palette selection attempt hit an existing preview; the successful two-pass palette check selected the actual `Palette proof` paragraph. No editor finding is inferred from that failed harness action.
- Task helpers retain some inherited descriptive notes; the tables here state the actual routes and outcomes. In particular, task 7 is **not** a clean persistence pass, despite the helper's generic completion note.
- No physical trackpad, installed-app relaunch, exhaustive graph search or full export audit is claimed. No JavaScript page errors were observed in Ore.
- D103 left-outs, Terminal style, D157, D175, D40, taste and settled Conventions remain excluded. No new decoration or behavior proposal is ranked.
- [Runner](driver.cjs), [new stress helpers](stress.js), [input log](input-log.json), [executed commands](commands.jsonl), [observations](observations.jsonl), [task records](tasks.jsonl), [reference commands](reference-commands.jsonl).

## Ranked findings, one line each

1. **A — Top label placement is lost when the diagram is reopened.**
2. **C — A saved elbow bend resets when its connected node is moved after reopening.**
3. **A, WebKit-qualified — Menu Paste still fails while Command-V works with the same copied diagram.**
