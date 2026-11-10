# UX parity sweep: the tutor chat

You are auditing one surface of Ore (a Mac learning app; this repo) against the best apps that do the same thing. Read-only on the repo: do NOT edit, commit or stash anything in it. Write only under `<out>/`.

Surface: **the tutor chat**
Reference apps: **ChatGPT, Claude (claude.ai), Notion AI**

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
The app runs as a mock in a browser. Vite: http://localhost:1520/ . Bridge port: 1521 (scratch library /tmp/ore-ux-chat; safe to change through the app). AI replies are canned and arrive after 6 s so waits can be seen. Never start, stop or kill servers; never touch /Applications/Ore.app, ~/Ore or ~/Developer/ore.

Drive it with Playwright from this repo (`require("playwright")` resolves here; run scripts with bun or node from the repo root). Before `goto`:
```js
await page.addInitScript("window.__ORE_BRIDGE = 1521");
await page.addInitScript({ path: "apps/desktop/scripts/mock/tauri.js" });
```
Use real input (`page.keyboard`, `page.mouse` with down/move/up for drags, `click({button:"right"})`), not synthetic DOM events or `fill` where typing matters. Test in Chromium AND WebKit (`require("playwright").webkit`; the real app is a WebKit webview, so WebKit wins if they differ). On macOS use Meta for ⌘. Run each item twice; report only what happens both times.

How to reach it: open any source from the library, then press ⌘J or click the button named "Open the tutor" (bottom right). It is the `complementary` region named "Tutor" (`apps/desktop/src/Tutor.tsx`); the field is the textbox "Message the tutor". It can float or dock to the side. Also test it opened from Home and from a skill page, the @ mention list, the mode chips (Quiz me, Practice and so on if present), citations and the Sources list, a second and third message, a long thread, a very long message, and sending then pressing Stop during the 6 s wait.

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
- Already covered or decided: the Conventions table in `.claude/skills/interaction-check/SKILL.md`; D186 (speech bubbles, the mole, the blinking block) and D187 (Stop and Copy exist; icons in the @ list) in docs/DECISIONS.md. Read those first so you test that they work rather than re-proposing them.
- Already known, do not re-report: edit a sent message; regenerate a reply; attach a file or image; starter/suggestion rows in the empty chat. These are Tyler's open calls.

Be strict about truth: if you could not test an item, mark it `untested` with the reason, never guess. Finish by printing the totals.
