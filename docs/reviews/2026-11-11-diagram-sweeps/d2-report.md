# Diagram task sweep 2

**The editor can complete all seven jobs. Its weakest point is preserving readable meaning while a diagram grows or changes.** Five repeatable findings survived this sweep. The most serious makes a concept's name disappear behind a relationship label in a map Ore lays out itself.

Research was written first: [research.md](research.md). Tested commit: `74e5708f41868aa696f664d7b24b43b249fec343`. WebKit 26.6, 1440×900 CSS pixels, screenshots at 2880×1800. Every task ran by mouse and by Ore's keyboard route, twice per route, with additional repair attempts. The source was the scratch library's **Lecture 4 the testing effect**, opened from the All sources row titled **The Testing Effect: Why Retrieval Beats Rereading**. Its transcript discusses retrieval, memory, rereading, fluency, delay, spaced practice and checking answers.

No implementation files, Git state, servers, installed app or real library were changed. All written artifacts are in this directory. Only the supplied mock and bridge 1532 received application edits. See [method and limits](method.md), [input log](input-log.json), [task observations](tasks.jsonl), and [executed commands](commands.jsonl).

## Tasks performed

Counts below are approximate effort for the completed route, **per repetition**, excluding canvas reset and opening the source. A click is one button press; a double-click counts as two. Drags are separate. A shortcut chord counts as one key action; typed characters are separate. Mouse routes still use typing and Escape to finish labels. Keyboard routes still use the pointer for initial placement and some selection. These are not timed human usability measurements.

| Task | Mouse: clicks / drags / key actions | Keyboard: clicks / drags / key actions | Text entered |
|---|---:|---:|---:|
| 1. Six-concept map, five labelled arrows, move middle concept | 26 / 12 / 11 | 1 / 1 / 4 | 102 characters mouse; 156 typed-map syntax |
| 2. Tidy the messy map | 2 / 0 / 0 | 0 / 0 / 1 | None; repair added one node drag |
| 3. Five-node flow, decision, two branches and retry loop | 25 / 10 / 10 | 4 / 2 / 28 | 82 characters |
| 4. Two things × four properties | 31–33 / 0 / 14–15 | 0 / 0 / 15 | 143–151 characters |
| 5. Heading, note, three shapes and labelled enclosure | 11 / 4 / 6 | 2 / 4 / 14 | 75 characters; finishing repair below |
| 6. Rename, convert, recolour two, delete link and undo | 15–16 / 1 / 4 | 3 / 1 / 13 | 10 characters |
| 7. Close, reopen, recover and zoom | 7 / 1 / 0 | 2 / 1 / 4 | None |

**1. Concept map.** Mouse: Box → drag → type six nodes; Arrow → drag each connection; Select → right-click → Edit text; move Memory down and right. Keyboard: M → type the same five relationships → Command-Enter; select Memory, nudge it, and drag it into the middle. All five bound labels followed their relationships. A short relationship became crowded after the middle node moved, requiring layout repair. Hesitations: an edge offers resizing, not a preview of a linked successor; double-clicking the selected arrow's midpoint did not open its label, so the successful mouse route used Edit text. M saved considerable work but initially hid Fluency under “strengthens” (findings 1, 3, 5). [Mouse before](shots/01-map-before-mouse-1.png), [after](shots/01-map-after-mouse-1.png), [repeat](shots/01-map-after-mouse-2.png); [typed map 1](shots/01-map-keyboard-created-1.png), [2](shots/01-map-keyboard-created-2.png). FigJam's documented edge quick-create combines successor and connector; Excalidraw's live midpoint double-click opens text.

**2. Rearrange.** Mouse: right-click the moved node → Tidy up the map. Keyboard: Shift-T. Both reordered the entire connected map. The results were more regular, but the Delay→Memory route and its label crossed Fluency. This was a readability failure, not an objection to a left-to-right layout. Moving Fluency upward manually repaired it, at the cost of undoing part of the automatic arrangement (findings 1, 2, 4). [Tidy mouse 1](shots/02-tidy-mouse-1.png), [2](shots/02-tidy-mouse-2.png); [keyboard 1](shots/02-tidy-keyboard-1.png), [2](shots/02-tidy-keyboard-2.png); [manual repair 1](shots/02-tidy-repaired-1.png), [2](shots/02-tidy-repaired-2.png). Whimsical documents layout plus connector rerouting. FigJam's grid tidy is a different operation and is not treated as semantic graph layout.

**3. Flow.** Built Read question → Retrieve answer → Correct?, with no → Check and restudy, yes → Wait a day, and a retry link. Mouse drew the five shapes and five arrows. Keyboard used Command-Down twice, Shift-R to turn the decision into a diamond, Command-Left/Right for branches, Option-Right to return to the decision, then labelled connections through Enter. All intended nodes and relationships were produced. The child nodes inherited the decision's shape and needed conversion back to boxes; that is recorded effort, not a defect. The retry route crossed another branch, making route adjustment useful. A focused repair attempt confirmed that elbow corner edits do not persist (finding 2). [Mouse 1](shots/03-flow-mouse-1.png), [2](shots/03-flow-mouse-2.png); [keyboard 1](shots/03-flow-keyboard-labelled-1.png), [2](shots/03-flow-keyboard-labelled-2.png). Excalidraw also provides directional keyboard creation; FigJam documents editable bent-connector paths.

**4. Compare table.** Compared Retrieval and Rereading on Action, Feeling, After a delay, and Practice. Mouse: Matrix, edit cells, right-click → Add a row twice. Keyboard: Shift-M, type each cell, Tab forward; Tab grew the table to five rows. The initial caret is in the first comparison heading, leaving the top-left corner blank. I initially mistook it for the property heading and overwrote my “Property” entry when filling that actual column; the corrected second mouse attempt needed two fewer clicks. This was not repeated as a defect. The completed tables were readable, with no new ranked finding. [Mouse 1](shots/04-complete-mouse-1.png), [2](shots/04-complete-mouse-2.png); [keyboard 1](shots/04-complete-keyboard-1.png), [2](shots/04-complete-keyboard-2.png). Ore's matrix already removes the repeated rectangle-placement work of a generic drawing tool.

**5. Annotate.** Added Practice cycle, three concept boxes, a free note and an ordinary enclosing box called Practice section. The enclosure label landed across the middle concept, and Send to back did not reposition it. Style → More offered font size but no text placement. I completed the task twice by grouping the three inner shapes, deleting the overlapping bound label, creating free text **outside** the enclosure and dragging it into the top padding, then enlarging the heading through Style → More → Large. The successful repair added roughly **9 clicks, 1 drag and 9 key actions**, plus retyping the 16-character title, each time. Two earlier attempts to create the free title directly inside the enclosure rebound it to the box and left it centred; each cost another 12 clicks and 9 key actions before that workaround was understood. [Collision 1](shots/05-section-back-mouse-1.png), [2](shots/05-section-back-mouse-2.png); [available options 1](shots/05-label-options-1.png), [2](shots/05-label-options-2.png); [completed 1](shots/05-actual-completed-1.png), [2](shots/05-actual-completed-2.png). Excalidraw can place the label at the top of an ordinary rectangle; this needs no frame (finding 4).

**6. Fix mistakes.** Renamed Retrieve to Recall, cycled rectangle to ellipse, Shift-selected Recall and Check, recoloured both, deleted the “then” link and restored it. Mouse used the context menu, Style and toolbar Undo. Keyboard used Enter, Shift-R, S then 3, Backspace and Command-Z. Both shapes changed colour; undo restored the labelled relationship. No new failure. The sequential shape-cycle control required knowing which shape comes next, but did not obstruct this task. [Mouse 1](shots/06-fixed-mouse-1.png), [2](shots/06-fixed-mouse-2.png); [keyboard 1](shots/06-fixed-keyboard-1.png), [2](shots/06-fixed-keyboard-2.png). These routes serve the same correction jobs as the reference tools' object menus and keyboard actions.

**7. Come back later.** Zoomed twice, panned, used Done, reopened the note preview, then fit and zoomed to read. Objects and labels returned. Fit and zoom recovered readable content in both routes. Reopening changed the viewing transform; view restoration belongs to the excluded Conventions rule, so it is not a new finding here. [Mouse reopen 1](shots/07-reopen-mouse-1.png), [2](shots/07-reopen-mouse-2.png); [keyboard read 1](shots/07-read-keyboard-1.png), [2](shots/07-read-keyboard-2.png). No claim about app relaunch or physical trackpad behavior.

## Ranked findings

### 1. Automatic map layout hides a concept under a relationship label — A

**Exact reproduction, twice:** open a blank diagram, press M, type the following, and press Command-Enter:

```text
Retrieval -strengthens-> Memory
Rereading -feels like-> Fluency
Fluency -not lasting-> Memory
Delay -reveals gap-> Memory
Practice tests -retrieves-> Memory
```

**Ore:** Retrieval, Fluency and Memory occupy the same row. The long Retrieval→Memory arrow traverses Fluency, and its “strengthens” label/background covers Fluency's name. The text still exists in the document, but the picture no longer communicates six named concepts. Shift-T changes the arrangement yet still sends Delay→Memory through Fluency. This happened in both typed-map runs and both tidy runs.

**Reference:** [Whimsical's layout](https://whimsical.com/learn/get-started/flowcharts) explicitly rearranges connected shapes and reroutes connectors; [FigJam](https://help.figma.com/hc/en-us/articles/1500004414542-Create-diagrams-and-flows-with-connectors-in-FigJam) supplies path and label repositioning for repair. These are documented comparisons, not a claim that an identical six-node map was live-tested in either product. Excalidraw's routing documentation only promises avoidance of connected endpoint shapes; it is **not** evidence of avoiding every intervening shape.

**Evidence:** [creation 1](shots/01-map-keyboard-created-1.png), [creation 2](shots/01-map-keyboard-created-2.png), [tidy 1](shots/02-tidy-keyboard-1.png), [tidy 2](shots/02-tidy-keyboard-2.png).

**Likely source:** `apps/desktop/src/draw/model.ts:1124` assigns depth/row positions; `model.ts:1134` connects without checking intervening nodes; `model.ts:1145`–1200 tidies positions and reroutes without an intersection cleanup pass. `model.ts:409` fixes relation text to the path midpoint.

**Smallest fix:** after generated layout, detect connector/label intersections with non-endpoint node bounds and move the affected node to a free row, then recompute. Cover this exact six-node graph. No general-purpose automatic diagram designer is needed to prevent this reproducible hidden-name case.

### 2. Elbow bend handles discard the attempted route adjustment — A

**Exact reproduction, twice:** at 100%, draw Retrieve at (350,310), size 160×64, and Remember at (950,490), size 160×64. Connect them. Select the arrow → Style → More → Elbow. Put Other concept at (650,405), size 160×64, in the vertical segment's way. Select the exposed segment at (730,390), then drag its visible upper bend from (730,342) to (850,342).

**Ore:** the corner remains at its original location after the drag. The bound route is regenerated, discarding the edited bend. Trying to drag the middle segment instead translates the whole arrow and detaches it from the two concepts. The learner cannot take the obvious direct-manipulation route to clearing the overlap. A straight polyline or moving the concept is a workaround; elbow editing itself is the miss.

**Reference:** [FigJam's connector instructions](https://help.figma.com/hc/en-us/articles/1500004414542-Create-diagrams-and-flows-with-connectors-in-FigJam) explicitly describe path handles for moving portions around objects. [tldraw's arrow options](https://tldraw.dev/reference/tldraw/ArrowShapeOptions) document a draggable middle-segment handle.

**Evidence:** [bound elbow](shots/p-elbow-before-3.png), [segment attempt 1](shots/p-elbow-drag-3.png), [2](shots/p-elbow-drag-4.png); [corner attempt 1](shots/p-elbow-corner-1.png), [2](shots/p-elbow-corner-2.png). Before/after SVG observations in `tasks.jsonl` confirm identical geometry for the corner edit; the diagram's accessible relationship summary loses the bound relationship after the whole-arrow translation.

**Likely source:** `apps/desktop/src/draw/Editor.tsx:1105` changes a point, but `Editor.tsx:1108` immediately calls `route`; `apps/desktop/src/draw/model.ts:432`–436 replaces all elbow points from endpoint centres. `Editor.tsx:855` suppresses intermediate segment handles for elbows.

**Smallest fix:** preserve a manually moved elbow segment/corner while keeping both endpoint bindings, updating the adjacent orthogonal segment with it. Do not render a draggable corner whose edit the router immediately erases.

### 3. Double-clicking the arrow midpoint does not start its label — A

**Exact reproduction, twice:** create two 160×64 rectangles at (400,350) and (950,350); draw an arrow from (560,382) to (950,382); switch to Select; explicitly choose Straight in Style → More; double-click its midpoint, (755,382).

**Ore:** the arrow is selected, but no label textarea opens. Double-clicking where the relation naturally belongs is consumed by point manipulation. Enter or right-click → Edit text works. This adds a discovery detour for every unlabeled relation; the initial mouse map encountered it before the focused confirmation.

**Reference:** live Excalidraw in the same WebKit engine opened a textarea on double-clicking the selected arrow centre and accepted “strengthens.” [Reference screenshot](shots/ref-excalidraw-arrow-label.png); [reference runner](reference-arrow.cjs).

**Evidence:** [confirmation 1](shots/f-midpoint-1.png), [2](shots/f-midpoint-2.png); both recorded `editing: 0`. This is unrelated to the excluded Enter-immediately-after-drawing-a-box issue.

**Likely source:** `apps/desktop/src/draw/Editor.tsx:929`–942 inserts a midpoint vertex on pointer-down. `Editor.tsx:1225`–1233 then treats the double-click as an existing point operation and returns before label editing.

**Smallest fix:** separate click/double-click from point dragging. Commit midpoint insertion only after a real drag threshold; let an ordinary double-click on the shaft start the arrow label, retaining intentional vertex deletion through its explicit point-edit route.

### 4. Fixed label positions obstruct both relationship repair and section titles — C

**Exact reproduction, twice in each context:** (a) create the labelled Retrieval→Memory arrow above, then drag “strengthens” along its path from (755,382) to (855,382); (b) draw Retrieve, Check and Wait at x=420/670/920, y=390, each 160×64; enclose them in a rectangle from (385,345) to (1120,565), type Practice section, and send it to the back. Inspect Style → More.

**Ore:** the relation word remains at the path midpoint; the gesture manipulates arrow geometry instead of label position. The enclosure title remains in its centre, overlapping Check's border/content area. The style controls have no top/left text placement. Removing the bound title and creating free text outside the enclosure, then dragging it in, works. Clicking the Text tool inside the enclosure simply binds the text to it again. The workaround leaves a separate title object to maintain. The shared centring rule appears in both tasks, so this is classified C rather than two unrelated requests.

**Reference:** FigJam documents moving relation text along the connector. Live Excalidraw provides top/middle/bottom alignment for an ordinary box label: [controls](shots/ref-excalidraw-label-controls.png), [top-aligned result](shots/ref-excalidraw-top-label.png). The live Excalidraw arrow-drag probe did **not** demonstrate movable relation text, so that comparison is made to FigJam only.

**Evidence:** [arrow label before](shots/p-label-before-drag-3.png), [after 1](shots/p-label-after-drag-3.png), [after 2](shots/p-label-after-drag-4.png); [section collision 1](shots/05-section-back-mouse-1.png), [2](shots/05-section-back-mouse-2.png); [options 1](shots/05-label-options-1.png), [2](shots/05-label-options-2.png).

**Likely source:** `apps/desktop/src/draw/model.ts:409`–410 always centres container labels or uses the arrow's midpoint; `model.ts:907` creates bound text with middle alignment. `apps/desktop/src/draw/Editor.tsx:1429`–1446 exposes size/font but no text alignment. Pointer selection resolves a label to its container at `model.ts:105` and `Editor.tsx:959` onward.

**Smallest fix:** honour the existing text alignment fields and offer top/centre placement in the selected label's style controls; for arrow labels, permit dragging a label along the path without moving the arrow. Both directly repair meaning and require no section/frame object. Any additional label-placement behavior beyond these two observed cases should be reviewed separately.

### 5. Building outward with the mouse has no edge quick-connect gesture — B

**Exact reproduction, twice:** draw and label Memory at (650,410), size 160×64, finish editing, and hover its edge at (810,442). Look for a successor/connection affordance before returning to the toolbar.

**Ore:** the selected shape offers resize/rotation handles, and the right edge has an east–west resize cursor. There is no preview or handle for a linked successor. The successful mouse map separately created six boxes, switched to Arrow for each relationship, and labelled each link. A right-click menu does offer New linked node, and Tab/Command-arrow works: this is a missing *direct edge workflow*, not missing creation functionality or a missing shortcut guide.

**Reference:** [FigJam quick create](https://help.figma.com/hc/en-us/articles/1500004291601-Build-faster-with-quick-create-in-FigJam) and [Miro connection lines](https://help.miro.com/hc/en-us/articles/360017730733-Connection-lines) show edge affordances that preview and create connected successors. These reduce repeated tool switching while the learner thinks of another concept.

**Evidence:** [hover 1](shots/01-edge-mouse-1.png), [2](shots/01-edge-mouse-2.png), plus the initial recorded `ew-resize` cursor. [Ore shortcut help](shots/08-discovery-help.png) correctly lists its keyboard routes.

**Likely source:** `apps/desktop/src/draw/Editor.tsx:1006`–1009 handles selection hover; `Editor.tsx:1811` onward draws resize/rotation/point overlays. Existing creation actions at `Editor.tsx:542` and directional child creation around `Editor.tsx:596` provide behavior a hover affordance could call.

**Smallest change, requiring Tyler's choice:** expose small directional quick-create handles only for the selected/hovered node, reusing the existing linked-node action and showing its prospective placement. Purpose: create the next concept and relationship without leaving that concept. This changes the editor's mouse interaction, so it is B; no implementation is proposed as a settled requirement.

## Boundaries and untested areas

- No findings for tool persistence, missing clipboard menu commands, Enter immediately after box creation, or the settled interaction-check Conventions. D103's excluded features, the chosen visual style, D175's sheet and D40's static note preview are untouched.
- Defaults observed in this build were 20-unit shape/free text and 16-unit relationship text; ordinary multiword labels wrapped and their shapes grew. No speculative default-size or typography criticism is filed.
- The first exploratory map included clicks at an arrow's **pre-binding** midpoint and typing while no text field owned focus. Its stray/free text is not counted as a product finding. The completed mouse route targeted the visible path and used Edit text. Early elbow probes also included a style-picker positioning race; findings use confirmed elbow runs 3/4, not those early attempts.
- Documentation comparisons cover all seven researched products. Only Excalidraw was operated live in this sweep, for box-label alignment and arrow-label entry/drag. Full equivalent tasks in FigJam/tldraw/Miro/Whimsical/Scrintal/Heptabase remain **untested**: this sweep limited live comparison to targeted Excalidraw checks and used accessible primary documentation for the others; account-gated products had no supplied authenticated sessions. Public tldraw was not blocked by authentication, but was not independently task-tested. No claim of superior timed performance or identical graph output in those products is made.
- Native macOS webview rendering, physical pinch/trackpad gestures, app relaunch, crash recovery and very large diagrams remain **untested**; the requested remote WebKit mock does not establish them.

## Ranked findings, one line each

1. **A — Automatic map layout can cover a concept name with a relationship label.**
2. **A — Elbow corner edits are discarded, blocking direct route repair.**
3. **A — Double-clicking a selected arrow's midpoint does not open its label.**
4. **C — Forced label centring obstructs both arrow-label repair and section titles.**
5. **B — Mouse diagramming lacks an edge quick-connect gesture for linked successors.**
