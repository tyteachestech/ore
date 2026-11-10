# UX parity sweep: Review (the review session and the quick quiz)

You are auditing one surface of Ore (a Mac learning app; this repo) against the best apps that do the same thing. Read-only on the repo: do NOT edit, commit or stash anything in it. Write only under `<out>/`.

Surface: **Review: the review session (the picker, each exercise, answer, rating, the end screen) and the quick quiz window**
Reference apps: **Anki (desktop) and Mochi**. Mark each checklist item `sure` or `unsure` about what the reference really does; an `unsure` item that fails is reported separately and never as a finding

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
The app runs as a mock in a browser. Vite: http://localhost:1520/ . Bridge port: 1523 (scratch library /tmp/ore-ux-review; safe to change through the app). AI replies are canned and arrive after 4 s so waits can be seen. Never start, stop or kill servers; never touch /Applications/Ore.app, ~/Ore or ~/Developer/ore.

Drive it with Playwright from this repo (`require("playwright")` resolves here; run scripts with bun or node from the repo root). Before `goto`:
```js
await page.addInitScript("window.__ORE_BRIDGE = 1523");
await page.addInitScript({ path: "apps/desktop/scripts/mock/tauri.js" });
```
Use real input (`page.keyboard`, `page.mouse` with down/move/up for drags, `click({button:"right"})`), not synthetic DOM events or `fill` where typing matters. Test in Chromium AND WebKit (`require("playwright").webkit`; the real app is a WebKit webview, so WebKit wins if they differ). On macOS use Meta for ⌘. Run each item twice; report only what happens both times.

How to reach it: Home has Start review (it asks which skills first); `apps/desktop/src/Review.tsx`, `ReviewPick.tsx`, `QuickQuiz.tsx`, `Ask.tsx`. In Ore what review brings back is an **exercise** (kinds Fact and Explain), never a card (D181). Cover: the key for show answer and for each rating, at every step (before the answer, after it, with a field focused, with a menu or the editor open); undo and redo of a rating (⌘Z, ⇧⌘Z) including on the end screen; edit an exercise mid-review and retire one; skip, bury or suspend equivalents; leaving mid-session and coming back; session end; the empty state (nothing due) and error states (set `window.__ORE_FAIL`/`__ORE_SLOW` only if the mock supports them: read `apps/desktop/scripts/mock/tauri.js`); a very long question or answer; a short window (1280×480) and a narrow one (760 wide); hover hints and keys on every button; right-click on the exercise; focus after every action. The quick quiz: find how the journeys named `quick quiz` open it in the mock.

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
- Already covered or decided: the Conventions table in `.claude/skills/interaction-check/SKILL.md`; every journey whose name starts with `review` or `quick quiz` in `apps/desktop/e2e/journeys.ts` (run `grep -n '^journey("\(review\|quick\)' apps/desktop/e2e/journeys.ts` and read the names: about 30 behaviours are already tested, aim elsewhere); `docs/design/daily-session.md`; D21 (the AI never sets the rating: he rates, the grader only suggests), D22 and D24 (queue order, never changed by priority), D23 (no streaks, counts, XP), D60, D176, D177 (session shape: how it opens, that it does not end on a miss, what the end screen says), D181 (naming). Anki features Ore does not aim at are out: decks and deck options, card browser, note types and templates, add-ons, sync, custom study, filtered decks, statistics screens, interval numbers on the rating buttons unless Ore already shows them, flags and tags.
- Already known, do not re-report: Review's Ask about this exercise (its Send hint and undo history were fixed today).

Be strict about truth: if you could not test an item, mark it `untested` with the reason, never guess. Finish by printing the totals.
