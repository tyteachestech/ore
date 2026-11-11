# UX parity sweep: the reader: reading a source, highlighting, and the video and audio player

You are auditing one surface of Ore (a Mac learning app; this repo) against the best apps that do the same thing. Read-only on the repo: do NOT edit, commit or stash anything in it. Write only under `<out>/`.

Surface: **the reader: reading a source, highlighting, and the video and audio player**
Reference apps: **Readwise Reader, Apple Books and Kindle for reading and highlighting; YouTube's player keys and Snipd for a source that plays**. Mark each checklist item `sure` or `unsure` about what the reference really does; an `unsure` item that fails is reported separately and never as a finding

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
The app runs as a mock in a browser. Vite: http://localhost:1520/ . Bridge port: 1521 (scratch library /tmp/ore-ux-reader; safe to change through the app). AI replies are canned and arrive after 4 s so waits can be seen. Never start, stop or kill servers; never touch /Applications/Ore.app, ~/Ore or ~/Developer/ore.

Drive it with Playwright from this repo (`require("playwright")` resolves here; run scripts with bun or node from the repo root). Before `goto`:
```js
await page.addInitScript("window.__ORE_BRIDGE = 1521");
await page.addInitScript({ path: "apps/desktop/scripts/mock/tauri.js" });
```
Use real input (`page.keyboard`, `page.mouse` with down/move/up for drags, `click({button:"right"})`), not synthetic DOM events or `fill` where typing matters. Test in Chromium AND WebKit (`require("playwright").webkit`; the real app is a WebKit webview, so WebKit wins if they differ). On macOS use Meta for ⌘. Run each item twice; report only what happens both times.

How to reach it: All sources, click a row; `apps/desktop/src/Reader.tsx`, `Marks.tsx`, `Grab.tsx`, `Margin.tsx`, `Outline.tsx`, `Find.tsx`, `Video.tsx`, `transcript.ts`, `popup-place.ts`. The seed has articles, a text source and at least one that plays (find which in `apps/desktop/scripts/mock/seed.ts`; `fake-player.ts` and `window.__ORE_PLAYER_PORT` in `tauri.js` stand in for the YouTube player; if you cannot get a player in the mock, mark those items untested, do not guess). Cover: selecting text with a drag, double and triple click, shift-click and the keyboard, and what the highlight popup does at each window edge and in a short window; making, retyping, noting, resizing and deleting a highlight, each with undo and redo; overlapping and adjacent highlights; a highlight across paragraphs, in a list, a table, code, a heading; the highlights list or margin and jumping between a highlight and its place; the outline and where scroll lands; find in page; text size; the side panel and its resize; Back and Forward and where scroll is restored; right-click on text, on a highlight, on an image, on a link; links (internal, external, footnotes); images (open, zoom); copy of selected text and of a highlight; the keys while a popup, the find bar or a field has focus; the player: space, K, J, L, arrows, speed, mute, captions or transcript following, click a transcript line to seek, a highlight made on a transcript keeping its time, where the player is when you come back.

Lesson from the last two sweeps: items about plain text editing in a field (typing, selection, paste) nearly all pass because the browser gives them for free. Keep those to at most 8 items. Spend the checklist on controls, menus, popovers, focus after each action, key handling in each state, window edges and short windows, waits and errors.

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
- Already covered or decided: the Conventions table in `.claude/skills/interaction-check/SKILL.md` (its Reading page rows are done: find, text size, keyboard highlighting, dragging a highlight's edges, Look Up, read aloud); every journey whose name starts with `highlight`, `reader`, `finish`, `explain`, `answer pieces`, `Collected` in `apps/desktop/e2e/journeys.ts` (grep the names and aim elsewhere); D48 to D50 (video), D96, D112 (where the highlight popup opens), D117 (growing a highlight), and grep docs/DECISIONS.md for "highlight", "reader", "video", "transcript" before listing a difference: many are decided. Out of scope: Readwise's feed, tags, ghostreader AI, exports, Kindle sync, page-turn animations, themes beyond what Ore has, Books' store and collections, Snipd's AI snips and social features, YouTube's comments, recommendations, quality and casting.
- Already fixed today by earlier sweeps, do not re-report: icon-only buttons without a hover hint (guarded by apps/desktop/test/hints.test.ts), a Cancel/Close/Done that Esc runs not showing Esc, a caret or pointer menu running outside the window (guarded in every e2e journey), Esc in a menu not returning focus to its trigger.

Be strict about truth: if you could not test an item, mark it `untested` with the reason, never guess. Finish by printing the totals.
