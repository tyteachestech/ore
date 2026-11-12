# UX task sweep 2: drawing a real study diagram in Ore's diagram editor

You are auditing Ore's diagram editor (`apps/desktop/src/draw/`, a Mac learning app; this repo). Read-only on the repo: do NOT edit, commit or stash anything in it. Write only under `codex-out/d2/`.

Sweep 1 (`codex-out/d1/report.md`, read it first) checked 80 single behaviours against Excalidraw and nearly all passed. Yet Tyler, who uses it daily, calls the diagram editor "definitely the weakest link". So this sweep is not a checklist of single keys. It is a **task sweep**: do the real jobs a learner does, the way a new user would, and record every point of friction, confusion or extra effort compared with doing the same job in Excalidraw, tldraw or FigJam.

Already being fixed, do not report: a drawn shape staying on its tool (it now goes back to Select; on this build press Q once to turn the lock off first), Cut/Copy/Paste missing from the right-click menu, Enter right after drawing a box closing its label.

## Step 1: research (write before testing)
Write `codex-out/d2/research.md`, short: what the best diagram tools do to make the first ten minutes feel effortless that a single-key checklist misses. Fetch real pages where you can (Excalidraw, tldraw, FigJam, Miro, Whimsical, Scrintal, Heptabase's whiteboard docs). Cover: quick-connect (drag or click from a shape's edge or a hover handle to make a linked shape), what shows on hover, cursor changes, binding/snap indicators, default sizes and text size, how a label fits its box (auto-grow, wrap), how arrows avoid crossing shapes, how a map is rearranged, how a fresh user discovers the keys. One line each on why it matters to someone drawing to learn (concept maps, flows, compare tables).

## Step 2: do these tasks for real, twice each
The app runs as a mock in a browser. Vite: http://localhost:1530/ . Bridge port: 1532 (scratch library /tmp/ore-ux-diagram; safe to change through the app). Never start, stop or kill servers; never touch /Applications/Ore.app, ~/Ore or ~/Developer/ore.

Drive it with Playwright from this repo. Browsers cannot launch inside your sandbox; connect: `require("playwright").webkit.connect("ws://[::1]:1661/")` (WebKit is the real app's engine; use Chromium only to compare). Before `goto`:
```js
await page.addInitScript("window.__ORE_BRIDGE = 1532");
await page.addInitScript({ path: "apps/desktop/scripts/mock/tauri.js" });
```
Real input only (`page.keyboard`, `page.mouse` down/move/up, right-click). 1440×900, deviceScaleFactor 2 for screenshots. Open a diagram as sweep 1 did (`/diagram` in a source's note).

Tasks (as a new user would try them first, by mouse, then the keyboard way Ore offers):
1. Concept map: 6 concepts from the open source, linked with labelled arrows (e.g. "Retrieval -strengthens-> Memory"), one concept in the middle. Then move the middle one and check the arrows and labels still read well.
2. Rearrange: the map gets messy; make it tidy and readable again.
3. Flow: a 5-step process top to bottom with one decision diamond and two branches.
4. Compare table: two things compared on 4 properties.
5. Annotate: a heading, a free note beside a shape, a group of three shapes with a box around them called a section.
6. Fix mistakes: rename a node, change a box to an ellipse, recolour two shapes, delete a link, undo it.
7. Come back later: close the diagram, reopen it, find where you were, zoom to read small text.

For each task record: steps taken, a rough count of clicks and keys, every point where you hesitated, guessed, or got something you didn't expect (with a 2x screenshot under `codex-out/d2/shots/`), and how Excalidraw/tldraw/FigJam handles that same point.

## Step 3: report
Write `codex-out/d2/report.md`:
1. Per task: a short paragraph and its friction points.
2. A ranked list of findings, most damaging to a new user first. Each: exact steps, what Ore did, what the reference does, screenshot, likely source file and line, and a class: **A** plain miss anyone would fix; **B** needs Tyler (new behaviour he would notice, or touches the purpose rule in CLAUDE.md or a decision in docs/DECISIONS.md); **C** same kind likely elsewhere in the editor.
3. For each finding, the smallest change that would fix it.

## Do not report
- What D103 leaves out on purpose: frames, collaboration, libraries, laser pointer, the hand-drawn look. The Terminal look (crisp lines, square handles, dithered fills, mono labels) is chosen. D157 (no emoji), D175 (sheet layout), D40 (static preview in the note).
- Taste (colours, spacing, wording) unless it makes something unreadable or undiscoverable.
- Settled rows in the Conventions table of `.claude/skills/interaction-check/SKILL.md`.
- Anything that only adds chrome without helping someone draw to learn (CLAUDE.md purpose rule).

Be strict about truth: report only what happened both times; mark anything you could not test as untested with why. Finish by printing the ranked findings in one line each.
