# Codex diagram sweeps, 2026-11-11

Tyler called the diagram editor "definitely the weakest link" and asked for a few loops on its obvious UX gaps, with Codex (`gpt-6-astra`, high effort) doing the reporting and research and Claude the fixes. Six sweeps ran against a mock of the branch under test, driven in WebKit (the Mac app's engine) with real input; each prompt and report is here (`dN-prompt.md`, `dN-report.md`; screenshots not kept).

| Sweep | Kind | Found | Fixed in |
|---|---|---|---|
| d1 | 80-item checklist against Excalidraw | 73 of 80 worked; no Cut/Copy/Paste in the right-click menu; Enter after drawing a box closed its label | #268 |
| d2 | Seven real study tasks (concept map, tidy, flow, compare table, section, fixing mistakes, coming back) | a typed map hid a concept under a link label; elbow bends snapped back; double-click didn't label an arrow; no top or left label placement; no quick-create (Tyler: yes) | #268, #276 |
| d3 | Check the ten changes, redo the tasks | looped maps still crossed; a + covered a neighbour; ⇧ on a dragged end; menu Paste in WebKit; diagram colours from the overridden palette | #279 |
| d4 | Confirm, last pass | elbow middles and top labels lost on reopening (the writer dropped `customData`, which also broke matrix cells); menu Paste's second read | #280 |
| d5 | Confirm | any saved label edited as blank (`originalText` left out on write) | #280 |
| d6 | Confirm | clean | |

Also from Tyler during the pass: a drawn shape goes back to Select (D213, reversing #233's default), lines and rotations snap to 45° steps with a guide, diagram colours match the note's, and text alignment (D216).

What worked: the single-key checklist (d1) found little; the task sweep (d2) found the gaps that mattered, and the confirmation sweeps found the file round-trip bugs no earlier test covered. Each fix landed with a test that failed first; the round-trip test in `draw.test.ts` now guards what a file must keep.
