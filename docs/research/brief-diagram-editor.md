# Brief: our own diagram editor (2026-10-30)

Tyler asked for an in-house diagram editor so Ore no longer depends on Excalidraw, one that makes the evidence-backed diagramming activities easy and is otherwise a keyboard-first, general diagramming tool. This brief turns the existing evidence (`brief-diagramming-evidence.md`, `brief-diagramming.md`) into editor requirements. No new studies were read for it.

## What the evidence asks of the editor

| Activity | Evidence | What the editor must make easy |
|---|---|---|
| Concept map from memory (node, labelled link, node) | Closed-book maps match written recall and beat text-open work (Blunt & Karpicke 2014; Karpicke & Blunt 2011) | Typing ideas and labelled links with no dragging: **Tab** from a node asks for the link's label, then the next node, placed automatically on free space; **M** types a whole map as `A -label-> B` lines or an indented outline |
| Compare-and-contrast matrix | Median d = 1.07, 8 of 8, equal time (F&M ch03) | **⇧M** lays out a header row and column; **Tab** walks the cells like a spreadsheet and adds a row at the end; rows grow to fit what he writes |
| Sketch of a causal or spatial system | Drawing d = 0.40 overall, 0.94 with comparison (F&M ch04; Van Meter 2001) | Pen, arrows that bind to shapes, text labels, flowchart growth with ⌘+arrow |
| Low mechanics | An on-screen drag-and-drop tool turned d = 0.87 into −0.16 (Schwamborn 2010a vs 2011) | Every learning activity above runs from the keyboard; snapping and binding are on by default so placement needs no precision |
| Compare with a correct version afterwards | The large drawing effects come from comparison (Leutner 2025: g = 0.35 vs −0.15) | Out of scope for the editor (D35.3 is the AI step); the editor keeps the file readable: `Copy as text` lists nodes and "A → B (label)" links, the same reading enrich and the AI comparison need |

What the evidence does not support, so the editor leaves out: AI drawing in his map, templates with blanks to fill (Wong 2020, Wang 2020), and decorative styling beyond what tells ideas apart.

## Format

The editor keeps Excalidraw's open JSON (`diagrams/<name>.excalidraw`, MIT format): every diagram drawn so far opens, an agent that knows the format can write one, and a file still opens on excalidraw.com. Unknown fields are kept on save. New files leave out Excalidraw's per-edit `version`, `versionNonce` and `updated`, so a git diff shows only what moved.

## Two extra criteria for the comparison

Besides UI, UX and feature count, the independent critic rated two criteria chosen for this app: **learning-activity fit** (time, keys and drags to do the four activities above) and **performance and footprint** (time to open, JS loaded, frame time with 500 elements). Ratings and protocol: `/mnt/project-files/diagram-editor/`.
