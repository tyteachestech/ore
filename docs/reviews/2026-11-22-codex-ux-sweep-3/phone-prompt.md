Your name is `phone`.

Your ports: iPhone app http://localhost:{{phone}}/ (its seed is a copy at `{{phoneLibrary}}`; the page's writes stay in IndexedDB). WebKit server: `{{webkit}}`. Write everything to `{{out}}/` and the report to `{{out}}/report.md`. iPhone only: do not open the Mac app page.

Earlier sweeps covered many angles (see `docs/reviews/sweeps.md`), including a native-feel scout against Apple's apps (F400–F415). Two UX sweeps ran today (F459–F467 in PR #492, F469–F473 in PR #493; records `docs/reviews/2026-11-22-codex-ux-sweep/` and `-2/`). Their reports list what passed: don't redo those paths. Both found the same class most: a change put on the Undo history only after its write lands (⌘Z during the write undid the step before), and a second press during a write. Check that class on every save you meet with `window.__ORE_SLOW`. Read `.claude/skills/ios-check/SKILL.md` for the iPhone rules Ore holds itself to.

## Your focus: obvious UX mishaps an iPhone user hits in minutes, round 3
Tyler's words: "basic things that I figured would have been handled already". Hunt the obvious: a tap that does nothing or lands on the wrong thing, a tap target under 44pt, a sheet that can't be dismissed or loses typed text, Back that loses the place, a list not showing a change just made, a long-press item that does nothing, a missing or wrong Undo (the shake or the toast), a field under the keyboard, a wait with no sign, an error with no next step, cut-off text, desktop words on a phone, an empty state that leaves you stuck.

Walk real tasks end to end in one page per journey (writes live in the page), then repeat once:
1. **Organizing in the drawer**: make a skill and a collection, rename, move, reorder, delete each with Undo; a skill's icon, colour, goal and Importance.
2. **Review on the phone**: Fact and Explain with the keyboard, Later, retire, edit an exercise, leave mid-way, the end screen; the quick sessions from a skill's page.
3. **Reading**: highlights of each colour, Key points, notes on highlights, Collected, Finish, a long source's place kept after leaving and coming back.
4. **Every long-press menu**: on Today's rows, Sources, a skill's rows, highlights; each item once.
Check each at 390×844, and anything tight once at a fresh 375×667 page. For each candidate, read the code to confirm it is the app and not the harness, and give the file and line.
