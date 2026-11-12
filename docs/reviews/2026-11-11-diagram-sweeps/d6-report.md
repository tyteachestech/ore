# Diagram sweep 6

**clean**

Sweep 5's saved-text fix passes twice in WebKit. Sweep 4's three fixes still hold. One quick pass through all seven first-hour study tasks produced no finding to rank.

Tested HEAD: `c48658a5a31aef477a824a68546c8c67bd19cf0d` (unchanged at completion). The endpoint answered before testing: WebKit **26.6**, `webkit.connect("ws://[::1]:1661/")`. Vite **1530**, scratch bridge **1532**, viewport **1440×900**, deviceScaleFactor **2**; original screenshots **2880×1800**. The context received `clipboard-read` permission before opening the page. Read sweep 5's prompt/report, the inherited sweep instructions/reports, D213/D216 and Canvas Conventions. All diagram changes used real pointer/key input; DOM/SVG reads supplied observations, with no diagram-state injection.

## Sweep 5 confirmation — twice

Each run independently constructed the content, chose Done, waited for the note preview, reopened that same diagram and expanded it.

| Check | Result | Evidence |
|---|---|---|
| Saved box label opens with its words | **Pass ×2.** Created `Recall`, reopened, selected the box and pressed Enter. The field contained `Recall`; finishing without replacement kept it. | [Edit 1](shots/label-box-edit-1.png), [edit 2](shots/label-box-edit-2.png). |
| Saved arrow label opens with its words | **Pass ×2.** Created an arrow labelled `strengthens`, reopened, double-clicked its visible label. The field contained `strengthens`; finishing kept it. | [Edit 1](shots/label-arrow-edit-1.png), [edit 2](shots/label-arrow-edit-2.png). |
| Saved free text opens with its words | **Pass ×2.** Created `Test yourself tomorrow`, reopened and double-clicked it. The field contained the entire sentence; finishing kept it. | [Edit 1](shots/label-free-edit-1.png), [edit 2](shots/label-free-edit-2.png). |
| Tab through a reopened compare matrix preserves every cell | **Pass ×2.** Built two method headings and four property rows with ⇧M and Tab. After reopening, double-clicked Retrieval and pressed Tab 13 times, checking all 14 populated cells' editor values, then Esc. Every value matched its original words. All rendered text before saving, after reopening and after traversal matched exactly. The unused top-left corner remained blank. | [Reopened 1](shots/matrix-reopened-1.png), [after Tab 1](shots/matrix-tab-after-1.png); [reopened 2](shots/matrix-reopened-2.png), [after Tab 2](shots/matrix-tab-after-2.png). |

The three ordinary texts also matched before and after the complete edit sequence in both runs: [after 1](shots/labels-after-1.png), [after 2](shots/labels-after-2.png). Exact editor values and equality checks are in [observations](observations.jsonl); [verification](verification.json) records all checks as true. [Saved-text contact sheet](shots/saved-text-contact.png) was visually inspected.

Matrix contents: `Retrieval / Rereading`; `Action / Recall answer / Read again`; `Feeling / Effortful / Fluent`; `After a delay / Memory stronger / Little lasts`; `Practice / Space tests / Check by recall`.

## Sweep 4 quick regression check

Each older fix was checked once, as requested for this quick re-check, using sweep 5's reproduction helpers.

| Check | Result | Evidence |
|---|---|---|
| Top label | **Pass.** 600×200 box at (400,330), `Practice section`, Style → More → Top and Left. Done → reopen → expand. Label SVG coordinates and anchor were identical before/after. | [Before](shots/top-before-1.png), [after](shots/top-after-1.png). |
| Dragged elbow middle | **Pass.** Recall → right + → Memory; ten Shift-Down presses; select connector → Elbow; drag middle 55 px right; Undo/Redo; move Memory down/right; close/reopen; move Memory right once. Middle x stayed **1197 scene units** through both endpoint moves and reopen. Final endpoint x changed from **1211 to 1212**, proving the reopened node moved while the middle stayed fixed. | [Before close](shots/elbow-before-1.png), [reopened](shots/elbow-reopened-1.png), [after endpoint move](shots/elbow-after-move-1.png). |
| Context-menu Paste | **Pass with clipboard-read granted.** Draw `Clipboard concept` at (400,350), right-click → Copy, right-click blank canvas at (900,550) → Paste. One box and label became two. No Command-V used. | [Pasted copy](shots/fix-menu-paste-1.png). |

## Quick first-hour pass

One walkthrough of each study task; these are not timed novice-participant measurements.

| Task | Result | Evidence |
|---|---|---|
| Six-concept map, five labelled links; move Memory | Completed; connections and labels followed the moved node. | [Map](shots/01-map-after-mouse-study.png). |
| Tidy the messy map | Completed with ⇧T; names and relationships remained readable. | [Tidy](shots/02-tidy-keyboard-study.png). |
| Five-node flow, decision, two branches and retry | Completed with all five relationship labels. | [Flow](shots/03-flow-mouse-study.png). |
| Compare two methods on four properties | Completed with ⇧M and Tab, including row growth. | [Matrix](shots/04-complete-keyboard-study.png). |
| Heading, free note, three concepts and titled enclosure | Completed; Top placed the enclosure title above its concepts. | [Section](shots/task5-title-top-study.png). |
| Rename, change shape, recolour two nodes, delete link and undo | Recall replaced Retrieve; ellipse and green styles applied; Undo restored the labelled link. | [Corrections](shots/06-fixed-keyboard-study.png). |
| Close/reopen, fit and zoom to read | Content and top title returned. Fit and zoom worked. | [Reopened](shots/07-reopen-keyboard-study.png), [zoomed reading view](shots/07-read-keyboard-study.png). |

Visually inspected [tasks 1–4](shots/study-contact-0.png) and [tasks 5–7 plus Paste](shots/study-contact-1.png). No new first-hour obstruction survived this pass. No new reference-product comparison was needed or claimed.

## Boundaries and execution notes

- Only `codex-out/d6/` received filesystem writes. No implementation edits, commits, stashes, server lifecycle changes, installed-app access or real-library access. Scratch content changed through the supplied app only.
- Tracked diff remained empty; Git status remained the pre-existing untracked `codex-out/` tree. No JavaScript page errors were observed.
- The inherited setup clicked the centre of a populated note and did not reach a new diagram. After its timeout, the source was opened directly, its final text paragraph was clicked, and `/diagram` created a separate `diagram-2` for this sweep. The earlier diagram remained present. The initial optional screenshot also timed out at 4 seconds; subsequent screenshots and all recorded checks completed. These setup failures are not treated as product findings.
- Read-only reuse of prior helpers writes through this driver's `out = 'codex-out/d6'`. Inherited helper completion notes are not verdicts; the observations and tables above describe this run.
- D103 exclusions, chosen Terminal style, D157, D175, D40, taste and settled Conventions remain excluded. Native relaunch, physical trackpad behavior, exports and exhaustive graph/control stress were not tested in this quick pass.
- [Driver](driver.cjs), [saved-text checks](confirm.js), [commands](commands.jsonl), [input log](input-log.json), [observations](observations.jsonl), [task records](tasks.jsonl), [verification](verification.json).

## Ranked findings

clean
