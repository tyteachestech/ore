# UX parity sweep: the note editor

You are auditing one surface of Ore (a Mac learning app; this repo) against the best apps that do the same thing. Read-only on the repo: do NOT edit, commit or stash anything in it. Write only under `<out>/`.

Surface: **the note editor**
Reference apps: **Notion**

## Step 1: write the checklist BEFORE opening Ore
From what you know of the reference apps, write `<out>/checklist.md`: 40 to 80 numbered items of what the reference app does on this kind of surface. One testable behaviour per item, naming the reference app. Cover:
- Keys, including at the edges of things (start/end of field or block, empty field, first/last item, with a selection, with a menu open, Esc, Enter vs Shift+Enter, Tab, arrows, ⌘A, ⌘Z/⇧⌘Z, ⌘C/⌘X/⌘V).
- Pointer: click, double and triple click, drag-select (inside one thing and across things), right-click, hover.
- Selection, copy, paste (plain, rich, multi-line, a URL), undo and redo.
- States: empty, loading, streaming/in progress, error, stopped, long content, many items, narrow width.
- Controls: each shows its shortcut on hover; a picked mode or tool stays picked; focus goes where you expect after an action.
- Consistency inside Ore: every menu item has an icon when its siblings do; every toolbar button shows a hover hint (Ore's `<Hint>`, `apps/desktop/src/Hint.tsx`), never a bare `title=`; icons come from the dot icon set (`apps/desktop/src/icons.tsx`), no emoji, no smooth glyphs.
Do not open Ore or read its UI source until the checklist file is written.

## Step 2: test every item for real, twice
The app runs as a mock in a browser. Vite: http://localhost:1520/ . Bridge port: 1522 (scratch library /tmp/ore-ux-notes; safe to change through the app). AI replies are canned and arrive after 6 s so waits can be seen. Never start, stop or kill servers; never touch /Applications/Ore.app, ~/Ore or ~/Developer/ore.

Drive it with Playwright from this repo (`require("playwright")` resolves here; run scripts with bun or node from the repo root). Before `goto`:
```js
await page.addInitScript("window.__ORE_BRIDGE = 1522");
await page.addInitScript({ path: "apps/desktop/scripts/mock/tauri.js" });
```
Use real input (`page.keyboard`, `page.mouse` with down/move/up for drags, `click({button:"right"})`), not synthetic DOM events or `fill` where typing matters. Test in Chromium AND WebKit (`require("playwright").webkit`; the real app is a WebKit webview, so WebKit wins if they differ). On macOS use Meta for ⌘. Run each item twice; report only what happens both times.

How to reach it: notes are the Markdown editor (`apps/desktop/src/editor/`, Milkdown) on a skill's page and in a source's notes; `apps/desktop/src/Notes.tsx` and the `notes`/`note` journeys in `apps/desktop/e2e/journeys.ts` show the ways in. Test a fresh empty note and a long one with every block type Ore has (headings, lists, to-dos, toggle, callout, quote, code, table, image, diagram, math, links to other notes), the slash menu, the ⋮⋮ block handle and its menu, the selection toolbar, block selection (Esc, drag, Shift+arrows, Shift+click), drag to reorder, and Markdown shortcuts typed at the start of a line.

`apps/desktop/e2e/journeys.ts` shows how the existing journeys reach each screen and what selectors exist.

## Step 3: report
Write `<out>/report.md`:
1. A table of every checklist item: number, behaviour, result (`works` / `missing` / `differs`), engine(s).
2. For every `missing` or `differs`: exact steps, what Ore did, what the reference app does, a 2x screenshot (`deviceScaleFactor: 2`) saved under `<out>/shots/`, the source file and line you think is responsible, and a class:
   - **A** plain miss: an obvious fix nobody would argue with.
   - **B** needs Tyler: new behaviour he would notice, or a clash with Markdown storage (notes are plain .md files), the purpose rule (CLAUDE.md), or a decision in docs/DECISIONS.md.
   - **C** the same kind of miss is likely on other screens: name the screens and say why.
3. Totals: items checked, works, missing, differs, by class.

## Do not report
- Anything docs/DECISIONS.md rules out. In particular: D157 (no emoji anywhere, so no emoji picker or emoji menu), D178 (⌘K changes with what is open, not what is selected), D23 (no streaks, XP, badges).
- Team, sharing, comments, permissions, databases, sync, templates, AI features the reference has and Ore does not aim at.
- Taste (colours, spacing, wording you would have chosen differently).
- Already covered or decided: the Conventions table in `.claude/skills/interaction-check/SKILL.md`; `docs/reviews/2026-11-06-notion-parity.md` (an earlier Notion audit: its open and declined items are settled) and `apps/desktop/test/notion-parity.test.ts` (what is already tested); D188 (drag selects blocks; a diagram or image is its own block) and the other note decisions in docs/DECISIONS.md (grep "note", D38, D39). Read those first: aim your checklist at what they do NOT already cover, and do not re-report their declined items.
- Already known, do not re-report: a note's own ⌘Z history is lost when an outside edit to the file is merged in; ⌘K does nothing for a selected block (kept, as in Notion).

Be strict about truth: if you could not test an item, mark it `untested` with the reason, never guess. Finish by printing the totals.
