Your name is `fresh`. First read `codex-out/preamble.md` and follow it.

Your ports: Mac app page http://localhost:1741/ with `window.__ORE_BRIDGE = 1742` (library `/Users/tylerpoelking/Developer/ore-wt/sweep5/codex-out/libs/fresh`); iPhone app http://localhost:1743/ (its seed is a copy at `/Users/tylerpoelking/Developer/ore-wt/sweep5/codex-out/libs/fresh-phone`; the page's writes stay in IndexedDB). WebKit server: `ws://[::1]:1759/`. The `ore` CLI: `ORE_LIBRARY=/Users/tylerpoelking/Developer/ore-wt/sweep5/codex-out/libs/fresh bun packages/cli/src/ore.ts`.
Your library is seeded with `seed.ts`.

## Your focus: what shipped in the last four days, which no sweep has used
Read `git log --since=2026-11-11 --oneline` and the decisions it names (D277, D280–D289), then use each change as a learner would, many times in a row and mixed with the rest of the loop.
1. **Sounds (D277).** Show answer, Got it, Missed, the goal and the end screen: does each play once, on the right moment, never on undo or a minor action, never stacked when he rates fast, and is it silent when sound is off in Settings or the page is hidden? Read `apps/desktop/src/sfx.ts` and count the plays you hook.
2. **The pick bar (D283–D286).** Pick sources in All sources and on a skill page with click, ⇧-click and ⌘-click, then file, archive and Mark done from the bar; undo each; pick across a filter change and a scroll; Esc.
3. **Filters as tags in the search field (D288).** Add, remove with Backspace, mix with typed words, paste, reload, go back and forward.
4. **The Feed reading pane (D289).** J and K through posts, open one, add it, mark read, come back: does the pane keep its place, and what does an empty or failed post show?
5. **Popups grow from what he pressed (D280) and the ring's bonus lap (D274).** Open every menu from its button, from a right-click and from a key: does each grow from the right place and close cleanly when he opens another fast? Pass the daily goal mid-session.
6. **The miss nod (D278) and the cart ending.** Rate Missed ten times quickly, then finish a session with each ending.
