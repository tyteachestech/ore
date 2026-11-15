Your name is `pointer`. First read `codex-out/preamble.md` and follow it.

Your ports: Mac app page http://localhost:1744/ with `window.__ORE_BRIDGE = 1745` (library `/Users/tylerpoelking/Developer/ore-wt/sweep5/codex-out/libs/pointer`); iPhone app http://localhost:1746/ (its seed is a copy at `/Users/tylerpoelking/Developer/ore-wt/sweep5/codex-out/libs/pointer-phone`; the page's writes stay in IndexedDB). WebKit server: `ws://[::1]:1759/`. The `ore` CLI: `ORE_LIBRARY=/Users/tylerpoelking/Developer/ore-wt/sweep5/codex-out/libs/pointer bun packages/cli/src/ore.ts`.
Your library is seeded with `seed.ts`.

## Your focus: the whole loop with a mouse or trackpad only
Sweep 3's `a11y` tester went keyboard-only; nobody has gone pointer-only. Never press a key except to type words. Read `CLAUDE.md`'s UI quality bar (one click opens, right-click menus, drag) and `apps/desktop/src/drag.ts`.
1. **Every object, by pointer.** Sources, skills, courses, highlights, notes, exercises, feed posts: open, rename, move, reorder, file, archive, delete and undo it (the toast's Undo or a menu), using only clicks, right-clicks and drags. Is anything reachable only by a key?
2. **Drags.** Drag rows in the sidebar, between skills, onto a course, into a note; a file from the Finder onto the window (`page.setInputFiles` on the drop target or a dispatched drop); let go outside the window, over a scrollbar, over a popup; drag while a write is slow (`__ORE_SLOW`). Does anything stick, drop in the wrong place or leave a ghost?
3. **Selections.** Highlight by drag in a long source: across paragraphs, into a table, a code block, a heading, an image; from the end back to the start; a drag that ends outside the text. Resize a highlight by its ends. Triple-click and double-click.
4. **Precision.** Each target at 1280×800 and at the window's smallest size: hit areas under 24 px, controls that move between hover and click, hover-only controls a trackpad user can't find, a tooltip that hides what he wants to click.
5. **Scrolling.** Wheel and trackpad deltas (small, large, horizontal) in the reader, lists, Review and a diagram: scroll chaining into the page, a scroll that stops a hover menu, a position lost after a write.
Do it on the iPhone with taps, long-presses and swipes as well.
