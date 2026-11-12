# Diagram sweep 3: check the fixes, then find what still gets in the way

You are auditing Ore's diagram editor (`apps/desktop/src/draw/`, a Mac learning app; this repo). Read-only on the repo: do NOT edit, commit or stash anything in it. Write only under `codex-out/d3/`.

Read first: `codex-out/d1/report.md` and `codex-out/d2/report.md` (your earlier sweeps), `docs/DECISIONS.md` D213 and D215 (what was changed since), and the "Canvas" rows of the Conventions table in `.claude/skills/interaction-check/SKILL.md`.

The build you test now has these changes. Part 1 is to check each one for real, twice, in WebKit:
1. A drawn box, diamond, ellipse, arrow, line or text goes back to Select with it selected; the pen keeps its tool; Q keeps any tool.
2. A line, arrow, dragged point or rotation within 4° of a multiple of 45° lands on it, with a dashed guide while dragging; ⌘ turns it off; ⇧ steps 15°.
3. Diagram red/green/blue/orange match the note's coloured text.
4. Right-click has Cut, Copy, Paste (Paste on empty canvas too).
5. Enter right after drawing a box waits for its label.
6. Double-click on an arrow's middle starts its label.
7. A typed map (M) and Tidy (⇧T) never run a link through a concept it doesn't join (use sweep 2's six-node map, then a bigger one of your own with cycles and fan-in).
8. An elbow arrow shows its ends and one middle handle; the middle drags and stays as its ends move.
9. Style › More: Align (L C R) for text and box labels, Place (M T) for a box's label.
10. One selected box/ellipse/diamond shows a + on each side no link uses; a click makes a linked node there with its label open.

Part 2: then repeat sweep 2's seven study tasks quickly, and report anything that still costs a new user time or reads badly. Look hard at the new + handles (placement, overlap with other handles or shapes at different zooms, many links, small shapes, what Undo does), at snapping fighting other snapping, and at keyboard focus after each new control.

## Setup
Vite: http://localhost:1530/ . Bridge port: 1532 (scratch library /tmp/ore-ux-diagram; safe to change). Never start, stop or kill servers; never touch /Applications/Ore.app, ~/Ore or ~/Developer/ore. Browsers cannot launch inside your sandbox: `require("playwright").webkit.connect("ws://[::1]:1661/")`. Before `goto`:
```js
await page.addInitScript("window.__ORE_BRIDGE = 1532");
await page.addInitScript({ path: "apps/desktop/scripts/mock/tauri.js" });
```
Real input only. 1440×900, screenshots at deviceScaleFactor 2 under `codex-out/d3/shots/`. The journeys "diagram: a drawn box…" and "diagram: a selected box's +…" in `apps/desktop/e2e/journeys.ts` show working selectors for the new controls.

## Report
`codex-out/d3/report.md`: (1) a table of the ten changes: works / broken / partly, with evidence; (2) ranked new findings, each with exact steps, what Ore did, what Excalidraw/tldraw/FigJam does, a screenshot, likely file and line, class A (plain miss) / B (needs Tyler: new behaviour, purpose rule, a decision) / C (same kind elsewhere), and the smallest fix. Same exclusions as sweep 2 (D103's left-outs, the Terminal look, D157, D175, D40, taste, settled Conventions rows, chrome without a learning purpose). Report only what happened both times. Finish by printing the ranked findings one line each.
