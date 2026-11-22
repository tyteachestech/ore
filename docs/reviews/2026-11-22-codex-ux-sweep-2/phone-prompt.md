Your name is `phone`.

Your ports: iPhone app http://localhost:{{phone}}/ (its seed is a copy at `{{phoneLibrary}}`; the page's writes stay in IndexedDB). WebKit server: `{{webkit}}`. Write everything to `{{out}}/` and the report to `{{out}}/report.md`. iPhone only: do not open the Mac app page.

Earlier sweeps covered many angles (see `docs/reviews/sweeps.md`), including a native-feel scout against Apple's apps (F400–F415). A first UX sweep ran today (F459–F467, PR #492, record `docs/reviews/2026-11-22-codex-ux-sweep/`) and found: Forge Undo during a save, a Forge use saved twice, the Forge's new-try form with no button, ⌘K New collection by pointer, an iPhone skill page stale after unfiling, iPhone Add a link losing its text, the small phone's end screen opening scrolled. Its reports list what passed: don't redo those paths. Yesterday's basic sweep found F445–F451. Read `.claude/skills/ios-check/SKILL.md` for the iPhone rules Ore holds itself to.

## Your focus: obvious UX mishaps an iPhone user hits in minutes, on the ground round 1 left
Tyler's words: "basic things that I figured would have been handled already". Someone who uses Mail, Notes, Files, Books and Reminders daily, on the bus. Hunt the obvious: a tap that does nothing or lands on the wrong thing, a tap target under 44pt, a sheet that can't be dismissed or loses typed text, Back that loses the place, a list that doesn't show a change just made, a long-press item that does nothing, a missing Undo, a field under the keyboard, a wait with no sign, an error with no next step, text cut off with no way to read it, desktop words (click, hover, ⌘) on a phone, an empty state that leaves you stuck.

Walk real tasks end to end in one page per journey (writes live in the page), then repeat once:
1. **Notes on the phone**: a source's note: type, the keyboard bar, a to-do, a link, leave and come back; a highlight's note.
2. **The reader**: Aa (size, spacing, font, page), Find, the outline, pictures, a video or audio source, Collected, Finish with recall.
3. **Skill pages**: each tab, Questions (ask one, answer one, Not answered here), the Forge (add a try, I did it, It's mine), the skill's own settings.
4. **Search, Sources and Settings**: every Settings row, search from Today and the drawer, Sources' sort and filter, archive and restore.
Check each at 390×844, and anything tight once at 375×667 (open the page at that size; don't shrink a loaded page). For each candidate, read the code to confirm it is the app and not the harness, and give the file and line.
