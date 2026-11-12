# Diagram sweep 3

**Five changes work in the tested scope, four work partly, and the colour match is broken. Five repeatable findings remain.** The six-node map from sweep 2 is fixed; a larger cyclic map still hides a concept. The new + handles save tool switching but can sit on another concept and intercept its click.

Tested repository HEAD: `fff6f29a890d6892604c308e6c4fdf08131198e8`. WebKit **26.6**, remote connection `ws://[::1]:1661/`, Vite `http://localhost:1530/`, bridge **1532**, scratch library only. Viewport **1440×900**, deviceScaleFactor **2**, screenshots **2880×1800**. Reproductions below use CSS-pixel coordinates in the full-window editor at 100%, unless a different zoom is named. Every reported Ore result occurred in two independent constructions/runs. “Works” is bounded by the exercised cases, not an exhaustive proof.

Read first: sweeps [1](../d1/report.md) and [2](../d2/report.md), D213/D214, and the Canvas Conventions. Only `codex-out/d3/` received filesystem writes. No source edits, commits, stashes, server changes, installed-app changes or real-library access. The supplied mock and scratch note received normal UI edits. See [method](method.md), [input log](input-log.json), [commands](commands.jsonl), [observations](observations.jsonl) and [task records](tasks.jsonl).

## 1. Check the ten changes

| # | Change | Result | Two-pass evidence and limits |
|---|---|---|---|
| 1 | Finished box, diamond, ellipse, arrow, line and text return to Select; pen stays; Q keeps tools | **works** | All seven tools exercised unlocked and locked, twice with the Q keyboard route (`01-tools-3/4` in observations; earlier runs used the lock button). Six non-pen tools returned to Select with the created object selected; pen stayed active. Locked tools stayed active. Label completion returned focus to `.draw`. [Selected box](shots/01-selected-box-final.png). |
| 2 | Soft 45° snapping, guide, ⌘ bypass, ⇧ 15° | **partly** | New lines/arrows near 0° and 45° snapped with a dashed guide; an 11° line stayed free; ⌘ bypassed it. Dragged endpoints snapped near 0° and respected ⌘. Rotation near 45° snapped with a guide; ⇧ constrained rotation and new lines/arrows. **⇧ did not constrain an existing endpoint**: finding 3. [Near-level 1](shots/02-l-near0-1.png), [2](shots/02-l-near0-2.png); [rotation 1](shots/02-rotate-near45-1.png), [2](shots/02-rotate-near45-2.png); [endpoint 1](shots/02-point-shift-1.png), [2](shots/02-point-shift-2.png). |
| 3 | Diagram red/green/blue/orange match note text | **broken** | All four diagram colours differ from actual coloured note text in both runs. The renderer hardcodes the older base palette; `retro.css` overrides the live note palette. Finding 5 has exact values. [Diagram red 1](shots/03-red-1.png), [2](shots/03-red-2.png); [note red 1](shots/03-note-red-1.png), [2](shots/03-note-red-2.png); [all note values](note-palette.json). |
| 4 | Right-click Cut, Copy, Paste; Paste on blank canvas | **partly** | Commands appear in the required contexts; Copy writes the diagram JSON and Cut removes it. Menu Paste fails in this supplied WebKit session, while ⌘V pastes the same clipboard. Finding 4 distinguishes the API restriction from Ore's missing fallback. [Object menu 1](shots/04-menu-1.png), [2](shots/04-menu-2.png); [blank menu 1](shots/04-empty-menu-1.png), [2](shots/04-empty-menu-2.png); [failure 1](shots/04-paste-error-1.png), [2](shots/04-paste-error-2.png). |
| 5 | Enter immediately after drawing waits for a label | **works** | Drew an empty box, pressed Enter, verified the textarea remained, typed Memory and finished it. Both `01-tools-3/4` records contain `Enter-empty: editing=1`, then selected Memory with canvas focus. Also passed the two initial button-route runs. |
| 6 | Arrow midpoint double-click starts its label | **works** | Drew an arrow from (400,350) to (800,350), double-clicked (600,350), typed strengthens, Enter. Textarea opened and the label persisted twice. [1](shots/06-middle-label-1.png), [2](shots/06-middle-label-2.png). |
| 7 | Typed maps and Tidy keep links out of unrelated concepts | **partly** | Sweep 2's exact six-node map is clear after M and ⇧T. The 12-node, 15-link map with cycles and fan-in fails after both operations: Question→Recall traverses Fluency, and prompts hides its name. Finding 1. [Six created 1](shots/07-six-created-1.png), [2](shots/07-six-created-2.png); [six tidy 1](shots/07-six-tidy-1.png), [2](shots/07-six-tidy-2.png); [large tidy 1](shots/07-big-tidy-1.png), [2](shots/07-big-tidy-2.png). |
| 8 | Elbow has two ends and one draggable, persistent middle handle | **works** | Selected elbow showed two end handles and one middle handle, no draggable corners. Moved middle segment about 40 px left, then moved Sleep 20 px down/right. Middle x stayed fixed while end segments followed. Two valid end-movement runs are `08-elbow-3/4`. [Moved 1](shots/08-elbow-moved-3.png), [2](shots/08-elbow-moved-4.png); [ends moved 1](shots/08-elbow-end-moved-3.png), [2](shots/08-elbow-end-moved-4.png). |
| 9 | Style › More Align L/C/R and box Place M/T | **works** | Applied every alignment to free multiline text and a box label; applied both placements to the box. Text coordinates and anchors changed, top placement cleared the section contents, Esc returned canvas focus and Right nudged the box. [Top 1](shots/09-box-Top-1.png), [2](shots/09-box-Top-2.png); [free-text right 1](shots/09-text-Right-1.png), [2](shots/09-text-Right-2.png). |
| 10 | Free-side + creates a linked, editable node | **partly** | All four directions on box, ellipse and diamond worked twice: new node, bound arrow, focused label; used incoming side suppressed. Undo/Redo preserved both objects and the label. **A + overlaps and intercepts a nearby node**: finding 2. [Box right 1](shots/10-plus-Box-right-1.png), [2](shots/10-plus-Box-right-2.png); [diamond up 1](shots/10-plus-Diamond-up-1.png), [2](shots/10-plus-Diamond-up-2.png). |

## 2. Seven study tasks, repeated quickly

Each task ran twice, using one practical route per task rather than repeating sweep 2's entire mouse-versus-keyboard comparison. These are completed jobs, not timed novice-user studies.

| Task | Observed result and remaining effort | Evidence, runs 1 / 2 |
|---|---|---|
| 1. Six concepts, five named links, move Memory | Built with Box/Arrow, labelled all links, moved Memory. Connections followed. The map remains editable; a crowded relation can still require moving geometry. The typed-map version separately passed above. | [1](shots/01-map-after-mouse-1.png) / [2](shots/01-map-after-mouse-2.png) |
| 2. Tidy the messy map | ⇧T made the six-node map readable without the old Fluency obstruction. Larger cyclic maps still fail (finding 1). | [1](shots/02-tidy-keyboard-1.png) / [2](shots/02-tidy-keyboard-2.png) |
| 3. Decision with two branches and retry | Built Read question → Retrieve answer → Correct?, no → Check and restudy, yes → Wait a day, plus retry. All names/links survived. Crossings still need manual arrangement; editable elbows now provide a working repair. | [1](shots/03-flow-mouse-1.png) / [2](shots/03-flow-mouse-2.png) |
| 4. Two methods × four properties | ⇧M, type headings and cells, Tab through Action / Feeling / After a delay / Practice. Tab grew the matrix. No new repeatable obstruction. | [1](shots/04-complete-keyboard-1.png) / [2](shots/04-complete-keyboard-2.png) |
| 5. Heading, note, three concepts, enclosure | Created Practice section as an ordinary box, sent it behind the three concepts, chose Style › More › Top. Title cleared the middle concept. The old separate-title workaround was unnecessary. | [1](shots/task5-title-top-1.png) / [2](shots/task5-title-top-2.png) |
| 6. Correct mistakes | Renamed Retrieve to Recall, changed its shape, recoloured Recall and Check together, deleted then undid the labelled link. All changes completed. Colour consistency has finding 5. | [1](shots/06-fixed-keyboard-1.png) / [2](shots/06-fixed-keyboard-2.png) |
| 7. Close, return, recover a readable view | Zoomed/panned, Done, reopened preview, fit and zoomed. Objects and labels returned. No new loss finding. View-restoration policy remains excluded. | [1](shots/07-read-keyboard-1.png) / [2](shots/07-read-keyboard-2.png) |

**Additional stress checks.** At 100% and 51%, neighbouring shapes expose the same + overlap. On an isolated 24×16 shape at 100% and 41%, + handles stayed separate from the resize/rotate controls; ordinary small nodes at 195% were also checked. Four incoming links on Memory hid its used left-side +; adding links on all four sides left no +. A new child label takes focus, Enter returns it to the canvas. One Undo after naming a child removes the label; a second removes the child and link; two Redos restore them. This is recorded behavior, not a request to change undo grouping. [Small at 41%, 1](shots/11-plus-small-zoom-1.png), [2](shots/11-plus-small-zoom-2.png); [fan-in 1](shots/11-fanin-1.png), [2](shots/11-fanin-2.png); [all sides 1](shots/11-all-sides-used-1.png), [2](shots/11-all-sides-used-2.png).

Grid/shape snapping plus near-horizontal angle snapping was stable in the exercised cases; ⌘ bypassed grid and angle together. A bound elbow prioritized its binding and orthogonal route. No additional snapping-conflict finding is inferred from those checks. [Grid 1](shots/12-grid-angle-1.png), [2](shots/12-grid-angle-2.png); [shape alignment 1](shots/12-shape-angle-1.png), [2](shots/12-shape-angle-2.png). Tests do not cover every angle, zoom or graph.

## 3. Ranked findings

### 1. Cyclic typed maps still route through another concept and hide its name — A

**Steps, twice:** blank diagram → M → type the map below → ⌘Enter. Inspect the right column. Then ⇧T and inspect it again.

```text
Question -prompts-> Recall
Recall -checks-> Feedback
Feedback -corrects-> Restudy
Restudy -retries-> Recall
Feedback -schedules-> Delay
Delay -retests-> Question
Recall -strengthens-> Memory
Sleep -consolidates-> Memory
Practice -strengthens-> Memory
Memory -supports-> Transfer
Examples -support-> Transfer
Transfer -raises-> Question
Confidence -predicts-> Feedback
Fluency -inflates-> Confidence
Restudy -creates-> Fluency
```

**Ore:** Question, Fluency and Recall share the rightmost column. The vertical Question→Recall link goes through Fluency. Its prompts label/background covers Fluency's name. M and Tidy both reproduce the failure. At fit zoom the two text bounds almost coincide (Fluency approximately x=1283, y=419; prompts x=1284, y=421). This is a new cyclic case of sweep 2's layout defect, not a claim that its six-node regression still fails.

**Reference:** [FigJam](https://help.figma.com/hc/en-us/articles/1500004414542-Create-diagrams-and-flows-with-connectors-in-FigJam) provides path handles to route around objects and movable relation labels. That documents a repair path, not an automatic-layout guarantee for this graph. D214 itself supplies Ore's stronger no-through-node requirement; no claim that Excalidraw avoids every obstacle.

**Screenshots:** [created 1](shots/07-big-created-1.png), [created 2](shots/07-big-created-2.png), [tidied 1](shots/07-big-tidy-1.png), [tidied 2](shots/07-big-tidy-2.png).

**Likely source:** `apps/desktop/src/draw/model.ts:1199` propagates depth around cycles; `model.ts:1250` checks only columns strictly between the link's endpoints. A same-column link therefore gets no obstacle check. `model.ts:1254` also assumes horizontal separation for its displacement calculation.

**Smallest fix:** include same-column non-endpoint nodes in the collision pass and move an obstructing node sideways into free space for a vertical route, then recompute links and labels. Add this graph to the layout regression cases. Moving it merely farther down the same column can leave it on the same route.

### 2. A node's + sits inside a neighbour and steals that neighbour's click — A

**Steps, twice:** at 100%, draw Neighbour at (680,350), size 160×64; draw Memory at (500,350), same size, leaving it selected. Memory's right + is centred at (686,382). Click there. Repeat the two-box setup and zoom out three times to 51%.

**Ore:** the right + is drawn over Neighbour's left border/interior. Clicking the visible overlapping target creates a third node with an open label instead of selecting Neighbour. At 51%, its constant screen offset reaches farther into the neighbour. The new child's free-space placement works; the error is the affordance and hit region covering an existing concept. Undo can recover the accidental addition.

**Reference:** [FigJam quick create](https://help.figma.com/hc/en-us/articles/1500004291601-Build-faster-with-quick-create-in-FigJam) locates the trigger at the selected shape's edge, reveals a preview, and supports clicking or dragging the new node. Its exact collision policy was not live-tested; the observed Ore hit-target conflict is the finding, not an invented FigJam guarantee.

**Screenshots:** [100% 1](shots/11-plus-overlap-100-1.png), [100% 2](shots/11-plus-overlap-100-2.png), [51% 1](shots/11-plus-overlap-zoom-1.png), [51% 2](shots/11-plus-overlap-zoom-2.png), [unintended child 1](shots/11-plus-overlap-result-1.png), [2](shots/11-plus-overlap-result-2.png).

**Likely source:** `apps/desktop/src/draw/Editor.tsx:78`–103 positions handles using a fixed screen offset and occupied *links*, without testing other shape bounds. `Editor.tsx:993`–994 gives the + hit region priority over ordinary shape selection.

**Smallest fix:** fit the + and its hit region into the available clear gap at that side, checking neighbouring bounds at the current zoom; use that same position for rendering and hit testing. Prevent a + hit region from intercepting a different node. No new learning feature is needed.

### 3. Shift stops constraining angles when an existing endpoint is dragged — A

**Steps, twice:** draw a line from (400,350) to (600,420). With it selected, drag its endpoint near (600,357): it snaps level. Drag the endpoint with ⌘ to (600,357): it remains free. Then hold ⇧ and drag that endpoint to (600,430).

**Ore:** the last line has Δx=200, Δy=80, approximately **21.8°**, not a multiple of 15°. Repeating the new-line drawing gesture with ⇧ does constrain its angle. Thus changing an existing relation uses different modifier behavior from creating it.

**Reference:** a live [Excalidraw endpoint probe](shots/ref-excalidraw-shift-point.png), using the same start/end input after entering point editing, constrained the endpoint while Shift was held (30° in that probe). The expected Ore increment is independently specified by D213; its nearest-step algorithm need not match Excalidraw's exact destination.

**Screenshots:** [Ore 1](shots/02-point-shift-1.png), [Ore 2](shots/02-point-shift-2.png); geometric paths in `02-angles-1/2` in [observations](observations.jsonl).

**Likely source:** `apps/desktop/src/draw/Editor.tsx:1191`–1195 applies point/grid and soft-angle snapping without handling `e.shiftKey`. New-line handling at `Editor.tsx:1164` explicitly calls `angleSnap`.

**Smallest fix:** use the same Shift angle constraint against the neighbouring point in the point-drag branch, with the same binding and modifier precedence as creation. Test both creation and endpoint editing with the same chord.

### 4. Menu Paste gives up on readable text when WebKit denies the richer clipboard read — A, browser-qualified

**Steps, twice:** draw and label Clipboard concept; right-click it → Copy; right-click blank canvas → Paste. Then press ⌘V without replacing the clipboard.

**Ore:** menu Paste shows “Couldn't reach the clipboard. Try ⌘V.” and adds nothing. ⌘V adds the copied box and label. A read-only diagnostic in this same context successfully returns Ore's JSON via `navigator.clipboard.readText()` but `navigator.clipboard.read()` rejects with NotAllowedError. Copy and Cut themselves work.

**Reference:** Excalidraw's live object menu includes Cut/Copy/Paste and its empty-canvas menu includes Paste: [captured menu](ref-clipboard-menu.html), [empty menu screenshot](shots/ref-excalidraw-menu.png). Its paste probe did not establish a successful duplicate, so no superior WebKit permission behavior is claimed. The concrete Ore miss is skipping an available text fallback after the richer read fails.

**Screenshots:** [error 1](shots/04-paste-error-1.png), [error 2](shots/04-paste-error-2.png), [⌘V recovery 1](shots/04-paste-fallback-1.png), [2](shots/04-paste-fallback-2.png).

**Likely source:** `apps/desktop/src/draw/Editor.tsx:571`–579: image-capable `read()` and `readText()` share one try/catch; failure of the first prevents the second.

**Smallest fix:** catch image-read failure separately, then attempt text/diagram JSON paste; show the keyboard fallback only if both reads fail. The restriction is confirmed in the supplied remote WebKit, including after granting its supported `clipboard-read` permission. **This is not a claim about the installed Tauri app**, which was not touched.

### 5. Diagram colours match the base stylesheet, not the note's active palette — A

**Steps, twice for every colour:** draw Recall; Style → red, green, blue, orange in turn. In the scratch note select text → Colour → corresponding Text colour. Inspect the rendered stroke/label and note text, and read their actual computed colours.

| Colour | Diagram stroke and label | Actual note text |
|---|---|---|
| Red | `#ff7b72` | `#e58a84` |
| Green | `#5fcf8a` | `#79d6b2` |
| Blue | `#6aa8f7` | `#82bde6` |
| Orange | `#ffa657` | `#e8b48f` |

**Ore:** every pair differs in both runs. The palette constants match the earlier `styles.css` defaults, but the active Terminal stylesheet overrides the note colours. This is a failed colour-consistency fix under D213, not a taste objection to either palette.

**Reference:** Excalidraw offers the same Stroke presets for text and geometry; [text palette](shots/ref-excalidraw-text-palette.png) and [shape palette](shots/ref-excalidraw-paste.png). Ore's required comparison is specifically to its own note palette, not to Excalidraw's RGB values.

**Screenshots:** [diagram red 1](shots/03-red-1.png), [2](shots/03-red-2.png), [note red 1](shots/03-note-red-1.png), [2](shots/03-note-red-2.png); corresponding `03-green/blue/orange-*` and `03-note-green/blue/orange-*` files cover the other presets. Exact note values are in [note-palette.json](note-palette.json), diagram values in `03-colours-1/2` in [observations](observations.jsonl).

**Likely source:** `apps/desktop/src/draw/render.tsx:9`–12 hardcodes the base palette; `apps/desktop/src/retro.css:48`–53 overrides `--c-*`; `apps/desktop/src/styles.css:1227` onward uses those variables for note colours.

**Smallest fix:** make diagram display/export colour mapping use the actual shared palette, including the stylesheet override, while preserving Excalidraw values in the saved file. Verify coloured note text and diagram SVG under the active app theme, not just the base CSS constants.

## Boundaries

No findings ask to reverse the Terminal look, D103's omissions, D157, D175, D40, or settled Conventions. The failed new acceptance checks above are implementation gaps, not proposals to reopen those decisions. No decorative chrome is requested. No new B or C finding survived this sweep.

The old arrow-label repositioning request is not newly ranked: FigJam's label movement remains a useful reference, but this run concentrated on the requested midpoint-entry and elbow fixes. All live reference outcomes are distinguished from documented behavior. No physical trackpad, native WebKit app, relaunch, export integrity or universal graph-layout claim is made.

## Ranked findings, one line each

1. **A — Cyclic M/Tidy layouts still run Question→Recall through Fluency and hide its name.**
2. **A — A + overlaps a nearby node and intercepts clicks meant for that node.**
3. **A — Shift does not constrain an existing endpoint to 15° steps.**
4. **A, WebKit-qualified — Menu Paste skips readable text after the richer clipboard API fails.**
5. **A — All four diagram colours differ from the active note palette.**
