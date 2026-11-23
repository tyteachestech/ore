Your name is `phone`.

Your ports: iPhone app http://localhost:{{phone}}/ (its seed is a copy at `{{phoneLibrary}}`; the page's writes stay in IndexedDB). WebKit server: `{{webkit}}`. Write everything to `{{out}}/` and the report to `{{out}}/report.md`. iPhone only: do not open the Mac app page.

Earlier sweeps covered many angles (see `docs/reviews/sweeps.md`), including a native-feel scout against Apple's apps (F400–F415). Three UX sweeps ran today (records `docs/reviews/2026-11-22-codex-ux-sweep/`, `-2/`, `-3/`; findings F459–F473 and the newest rows in `docs/reviews/findings.md`). Their reports list what passed: don't redo those paths. Round 3 fixed ⌘Z during a save once for the whole app (`whileOut` in `apps/desktop/src/ore.ts`, `Toast.tsx`): check it held, on any save you meet, with `window.__ORE_SLOW`, but don't spend the run on it. New since then: on the iPhone, a collection heading in the drawer has a long-press menu (Rename…, Move up, Move down, Delete collection) and a skill's menu has Move up and Move down. Tyler's standing rule: the iPhone strives for parity with the Mac, so a Mac feature missing on the phone is a finding. Read `.claude/skills/ios-check/SKILL.md` for the iPhone rules Ore holds itself to.

## Your focus: obvious UX mishaps and Mac features missing on the phone, round 4
Tyler's words: "basic things that I figured would have been handled already", and the phone strives for parity with the Mac. Hunt the obvious: a tap that does nothing or lands on the wrong thing, a tap target under 44pt, a sheet that can't be dismissed or loses typed text, Back that loses the place, a list not showing a change just made, a missing or wrong Undo, a field under the keyboard, a wait with no sign, an error with no next step, cut-off text, desktop words on a phone, an empty state that leaves you stuck; and any action the Mac has that the phone lacks without a reason (read `docs/DECISIONS.md` for ones left out on purpose, such as Delete skill).

Walk real tasks end to end in one page per journey (writes live in the page), then repeat once:
1. **The new collection actions**: rename, move up and down, delete with Undo; a skill's Move up and Move down; then the drawer's order after leaving and coming back.
2. **Parity walk**: go through the Mac's menus in the code (`apps/desktop/src/App.tsx` skillMenu and source menus, `Sidebar.tsx`, `Reader.tsx` ⋯, `Collected.tsx`, `SkillPage.tsx`) and check each action has a phone way; list what is missing.
3. **Adding**: a link, a file, a link that fails, and what Today shows meanwhile.
4. **Search and Sources**: search, sort, filter, archive and restore, a source's ⋯ sheet, every item once.
Check each at 390×844, and anything tight once at a fresh 375×667 page. For each candidate, read the code to confirm it is the app and not the harness, and give the file and line.
