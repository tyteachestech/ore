# UX parity sweep: lists of sources and the sidebar: All sources, a skill's page list, Home's lists, the Feed, and the sidebar of skills and collections

You are auditing one surface of Ore (a Mac learning app; this repo) against the best apps that do the same thing. Read-only on the repo: do NOT edit, commit or stash anything in it. Write only under `<out>/`.

Surface: **lists of sources and the sidebar: All sources, a skill's page list, Home's lists, the Feed, and the sidebar of skills and collections**
Reference apps: **Linear (rows, selection, keys, right-click), Raindrop (thumbnails, filing, bulk moves) and Finder (drag, multi-select, rename)**. Mark each checklist item `sure` or `unsure` about what the reference really does; an `unsure` item that fails is reported separately and never as a finding

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
The app runs as a mock in a browser. Vite: http://localhost:1520/ . Bridge port: 1522 (scratch library /tmp/ore-ux-lists; safe to change through the app). AI replies are canned and arrive after 4 s so waits can be seen. Never start, stop or kill servers; never touch /Applications/Ore.app, ~/Ore or ~/Developer/ore.

Drive it with Playwright from this repo (`require("playwright")` resolves here; run scripts with bun or node from the repo root). Before `goto`:
```js
await page.addInitScript("window.__ORE_BRIDGE = 1522");
await page.addInitScript({ path: "apps/desktop/scripts/mock/tauri.js" });
```
Use real input (`page.keyboard`, `page.mouse` with down/move/up for drags, `click({button:"right"})`), not synthetic DOM events or `fill` where typing matters. Test in Chromium AND WebKit (`require("playwright").webkit`; the real app is a WebKit webview, so WebKit wins if they differ). On macOS use Meta for ⌘. Run each item twice; report only what happens both times.

How to reach it: the sidebar (`apps/desktop/src/Sidebar.tsx`, `Skills.tsx`), All sources and Home (`Home.tsx`, `App.tsx`), a skill's page (`SkillPage.tsx`), the Feed (`Feed.tsx`), row menus (`Menu.tsx`), drag (`drag.ts`), the Add box (`Add.tsx`). Cover, on EACH list separately since they are built apart: click, arrows, Home/End, Page Up/Down, Enter, Space, type-to-find if any; selection with shift-click, ⌘-click, ⇧↑↓, ⌘A, Esc and what stays selected after an action or a navigation; the ⋯ menu and right-click on a row, on a selection, on blank space, on a sidebar skill and a collection (same actions in both, icons consistent among siblings, destructive last, keys shown); drag a row and a selection to a skill, a collection, to reorder, and what lights up, Esc mid-drag, a drop on itself; rename in place; delete or archive with the toast, ⌘Z and ⇧⌘Z; sort and filter controls and whether the choice stays; empty states of each list and of a search with no results; a very long title, a missing thumbnail, 0 and many skills on a row; scroll position and selection after Back; focus after every action (after delete, after rename, after a menu closes); hover hints on every row control and header button; the sidebar collapsed, resized narrow and wide; a short window (1280×480) and a narrow one (760 wide); the Add box opened from each place and where focus goes. For many rows, `bun apps/desktop/scripts/mock/seed-big.ts` exists but do not start servers: test scale only if the given library is enough, else mark untested.

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
- Already covered or decided: the Conventions table in `.claude/skills/interaction-check/SKILL.md` (its Any list, Sidebar, Any list of sources, Popover, Title edited in place, Back and Forward, Command palette rows are done); every journey whose name starts with `sidebar`, `list`, `Home`, `home`, `skill page`, `skill picker`, `delete skill`, `course`, `add box`, `⌘K`, `undo` in `apps/desktop/e2e/journeys.ts` (grep the names and aim elsewhere); `docs/reviews/2026-11-09-codex-sweeps.md` (31 bugs fixed on these screens two days ago: do not re-test those); D178 (⌘K follows what is open, never what is selected: row actions live on ⋯, right-click and keys, so do not ask for palette rows for a selection), D23 (no counts, streaks or badges on rows), the purpose rule (no decorative columns, counts or pills). Out of scope: Linear's views, filters builder, cycles, teams; Raindrop's tags, sharing, duplicates finder; Finder's column and gallery views, Quick Look, tags.
- Already fixed today by earlier sweeps, do not re-report: icon-only buttons without a hover hint (guarded by apps/desktop/test/hints.test.ts), a Cancel/Close/Done that Esc runs not showing Esc, a caret or pointer menu running outside the window (guarded in every e2e journey), Esc in a menu not returning focus to its trigger.

Be strict about truth: if you could not test an item, mark it `untested` with the reason, never guess. Finish by printing the totals.
