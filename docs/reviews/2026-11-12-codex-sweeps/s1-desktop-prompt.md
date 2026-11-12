# Sweep 1 (desktop): today's merged features, used as real study tasks

You are testing Ore, a Mac learning app (this repo): read sources, highlight, take notes, review exercises. Read-only on the repo: do NOT edit, commit or stash anything. Write only under `codex-out/s1-desktop/` (report.md and shots/).

## Read first
- `docs/reviews/findings.md`: every finding already known. Do not report a row again unless you saw its behaviour come back; then say which row.
- `CLAUDE.md`, the Conventions table in `.claude/skills/interaction-check/SKILL.md` (what Ore already promises), and decisions D231 to D234 in `docs/DECISIONS.md`.

## Under test (merged today, never swept)
- #312 / D231: every menu item has an icon, groups split by thin lines (right-click and ⋯ menus everywhere).
- #311 / D232: type a title's first letters to select its row; list actions on ⌘ keys (Rename ⌥⌘R, Pin ⌥⌘P, Archive ⇧⌘A, Open original ⇧⌘O).
- #314 / D233: in a highlight's note, ⇧↵ continues a "- ", "* " or "1. " list; ⇧↵ on an empty item ends it.
- #316 / D234: Home's Continue reading and the Feed: ⌘-click and ⇧-click pick rows, the menu acts on the pick, a Home row drags onto a sidebar skill, Feed Mark read is ⇧⌘U.
- #319: one focus ring on every small button; icons centred in their buttons.

Being fixed elsewhere, do not report: ⌘Z after an action on a Home multi-selection.

## Setup
The app runs as a mock in a browser, through the real `ore` CLI on a scratch library you may change freely. Vite: http://localhost:1540/ . Bridge port 1542. Never start, stop or kill servers; never touch /Applications/Ore.app, ~/Ore or ~/Developer/ore. Check the page answers first; if not, stop and say so in one line.

Drive it with Playwright from this repo. Browsers cannot launch in your sandbox; connect: `require("playwright").webkit.connect("ws://[::1]:1661/")` (WebKit is the real app's engine; `chromium.connect` on the same URL only to compare). Before `goto`:
```js
await page.addInitScript("window.__ORE_BRIDGE = 1542");
await page.addInitScript({ path: "apps/desktop/scripts/mock/tauri.js" });
```
Real input only (`page.keyboard`, `page.mouse` down/move/up, right-click). 1440×900; deviceScaleFactor 2 for screenshots. To see a failed or slow write, set before the action `window.__ORE_FAIL = { <ore command>: "why" }` or `window.__ORE_SLOW = { <ore command>: 1500 }` (see `apps/desktop/scripts/mock/tauri.js`).

## Tasks: do each for real, twice, as a person would (mouse first, then the keyboard way Ore offers)
1. **Tidy the morning's reading.** On Home, pick three Continue reading rows (⌘-click, then a ⇧-click range), file them into a skill from the right-click menu, then drag one more row onto a sidebar skill. Do the same kind of pick in the Feed and mark three posts read with ⇧⌘U. Check after each step: the right rows changed, the selection reads clearly, nothing else moved, Esc or a click on empty space drops the pick, a plain click opens one row (D234 keeps one click to open).
2. **Notes on highlights.** In a source, highlight three passages. On one, write a note with a bulleted list of three items (⇧↵ between), end the list, write a line, then a numbered list. Click away, reopen the highlight, edit the second item, press Esc; reopen and check what was kept (D211: click away saves, Esc throws the edit away). Paste multi-line text into the note. Try ⇧↵ at the start and in the middle of an item.
3. **Work from menus.** Right-click a source row on Home, a skill page, All sources, a Feed post, a sidebar skill, a highlight and a reader ⋯ menu. In each: icons on every item and on the text's midline, group lines, arrows and Enter work, every shortcut a menu shows does that action from the list, type-select a row by its title then act with ⌥⌘R, ⌥⌘P, ⇧⌘A.
4. **Keyboard only, five minutes.** Without the mouse: from Home, open a source, highlight, add a note, go to a skill page, start and finish two exercises of Review. Tab and shift-Tab through every small button you pass: the focus ring is always visible, one style, never lost to `body`, and Esc always gets you out.
5. **Interrupted.** Repeat one step of tasks 1 and 2 with the write failing (`__ORE_FAIL`) and slow (`__ORE_SLOW`): is the failure shown with a way forward, is nothing lost or shown as saved when it wasn't, does clicking again during the wait double anything?

## What counts
Anything a person would notice: a click or key that does nothing or the wrong thing, lost text or lost selection, a menu item with no icon or a wrong shortcut, a ring or icon off its button, a state that lies (saved when it failed), a wait with no sign, different behaviour for the same object on two screens. Not taste (colour, spacing, wording), not anything a decision rules out (grep DECISIONS.md), not features with no purpose for one person learning.

## Report: `codex-out/s1-desktop/report.md`
1. Ranked findings, most damaging first, one line each.
2. Each: exact steps (a Playwright snippet if short), expected (and what Linear, Finder, Notion or ChatGPT do), what Ore did, whether it happened both times, a 2x screenshot, the likely file and line, and a class: **A** plain miss; **B** needs Tyler (new behaviour he'd notice, or touches the purpose rule or a decision); **C** same kind likely elsewhere.
3. What you could not test and why.
Report only what happened both times. Finish by printing the ranked findings one line each, or "clean".
