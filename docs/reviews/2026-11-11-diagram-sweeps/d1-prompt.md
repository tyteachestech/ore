# UX parity sweep: the diagram editor

You are auditing one surface of Ore (a Mac learning app; this repo) against the best apps that do the same thing. Read-only on the repo: do NOT edit, commit or stash anything in it. Write only under `codex-out/d1/`.

Surface: **the diagram editor** (`apps/desktop/src/draw/`, opened from a diagram block in a note)
Reference apps: **Excalidraw** first, then **tldraw** and **FigJam** where they agree.

Why it exists: Tyler draws concept maps, flows and compare tables while he learns from a source. The obvious things a person expects from Excalidraw must just work. Tyler's words: the gaps should be "obvious UX gaps", the kind anyone would hit in the first five minutes.

## Step 1: write the checklist BEFORE opening Ore
From what you know of the reference apps (fetch Excalidraw's keyboard shortcuts / docs pages if you can), write `codex-out/d1/checklist.md`: 50 to 80 numbered items, one testable behaviour each, naming the reference app. Aim at what goes wrong in the first five minutes of drawing, not at native text editing. Cover:
- Creating each shape: click-drag, a plain click (what size, where), Shift for square/circle, Alt from centre, drawing right-to-left/upward, a tiny drag, typing a label right after, double-click on empty canvas to add text, double-click a shape to edit its label.
- After drawing: which tool is active, what is selected, where focus is. (Ore is changing this so a drawn shape goes back to Select, as Excalidraw does with the lock off; do not report the tool staying picked.)
- Arrows: drawing between shapes, binding and following when shapes move, dropping on empty space, labels on arrows, elbow arrows, changing arrowheads, rebinding an end.
- Selection: click, Shift+click, marquee in both directions, select inside a group, Esc, ⌘A, clicking a label vs the shape's edge, hit area of thin lines and empty-filled shapes.
- Transforming: move, resize from each handle, rotate, nudge with arrows and Shift+arrows, snapping, duplicate (⌘D and Alt-drag), delete, undo/redo of each of these as one step.
- Text: editing, Enter vs Shift+Enter, Esc to finish, wrapping in a box, empty label left behind, very long labels.
- Canvas: pan (Space-drag, trackpad scroll, Hand tool), zoom (⌘+/⌘−, pinch/⌘-scroll, to fit), what happens at the sheet's edges, a drawing far off-screen.
- Style: the style picker, its keys, what new shapes inherit, copy/paste style.
- Clipboard: copy/paste inside the editor, paste text or an image from outside, paste position.
- Controls: every toolbar button shows its shortcut on hover through Ore's `<Hint>` (never a bare `title=`); the active tool is visible; focus returns to the canvas after a toolbar click; the right-click menu has what the reference has for a shape, a selection and empty canvas.
- Leaving: Esc, Done, a click on the scrim, ⇧⌘↵ full window and back; nothing drawn is lost; reopening shows it where it was.
Do not open Ore or read its UI source until the checklist file is written.

## Step 2: test every item for real, twice
The app runs as a mock in a browser. Vite: http://localhost:1530/ . Bridge port: 1532 (scratch library /tmp/ore-ux-diagram; safe to change through the app). Never start, stop or kill servers; never touch /Applications/Ore.app, ~/Ore or ~/Developer/ore.

Drive it with Playwright from this repo (`require("playwright")` resolves here; run scripts with bun or node from the repo root). Browsers cannot launch inside your sandbox, so connect to the running server: `const browser = await require("playwright").webkit.connect("ws://[::1]:1661/")` (and `.chromium.connect` for Chromium). Before `goto`:
```js
await page.addInitScript("window.__ORE_BRIDGE = 1532");
await page.addInitScript({ path: "apps/desktop/scripts/mock/tauri.js" });
```
Use real input (`page.keyboard`, `page.mouse` with down/move/up for drags, `click({button:"right"})`), not synthetic DOM events. Test in WebKit first (the real app is a WebKit webview; WebKit wins if engines differ), Chromium second. Use Meta for ⌘. Use a 1440×900 window. Run each item twice; report only what happens both times.

How to reach it: open a source's note or a skill's note, type `/diagram` and Enter. The `diagram:` journeys in `apps/desktop/e2e/journeys.ts` (around line 4366 onward) show exactly how they open one and which selectors exist (`.diagram`, `.draw-canvas`, `.draw-tools`, `.draw-tool[aria-pressed]`, `.draw-text`). The keys are in `apps/desktop/src/keys.ts` (the "Diagram" group, ids `d-*`); `?` in the editor shows them.

## Step 3: report
Write `codex-out/d1/report.md`:
1. A table of every checklist item: number, behaviour, result (`works` / `missing` / `differs` / `untested`), engine(s).
2. For every `missing` or `differs`: exact steps, what Ore did, what the reference app does, a 2x screenshot (`deviceScaleFactor: 2`) under `codex-out/d1/shots/`, the source file and line you think is responsible, and a class:
   - **A** plain miss: an obvious fix nobody would argue with.
   - **B** needs Tyler: new behaviour he would notice, or a clash with the purpose rule (CLAUDE.md) or a decision in docs/DECISIONS.md.
   - **C** the same kind of miss is likely elsewhere in the editor: say where.
3. Rank the A findings by how soon a new user would hit them.
4. Totals: items checked, works, missing, differs, untested, by class.

## Do not report
- What D103 leaves out on purpose: frames, collaboration, libraries, the laser pointer, the hand-drawn (rough) look. The Terminal look (crisp lines, square handles, dithered fills, mono labels) is the chosen style. Also D157 (no emoji), D175 (the sheet layout), D40 (static preview in the note).
- The tool staying picked after drawing (being changed now).
- Taste (colours, spacing, wording).
- Anything already settled in the Conventions table of `.claude/skills/interaction-check/SKILL.md`; read it first.

Be strict about truth: if you could not test an item, mark it `untested` with the reason, never guess. Finish by printing the totals.
