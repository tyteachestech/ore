Your name is `phone`.

Your ports: iPhone app http://localhost:{{phone}}/ (its seed is a copy at `{{phoneLibrary}}`; the page's writes stay in IndexedDB). WebKit server: `{{webkit}}`. Write everything to `{{out}}/` and the report to `{{out}}/report.md`. iPhone only: do not open the Mac app page.

Earlier sweeps covered many angles (see `docs/reviews/sweeps.md`), including a native-feel scout against Apple's apps (F400–F415) and a basic UX sweep yesterday (F445–F451). Don't redo those. Read `.claude/skills/ios-check/SKILL.md` for the iPhone rules Ore holds itself to.

## Your focus: obvious UX mishaps a first-time iPhone user would hit within minutes
Tyler's words for this: "basic things that I figured would have been handled already". Think of someone who uses Mail, Notes, Files, Books and Reminders every day, using Ore on the bus for twenty minutes. Hunt the obvious: a tap that does nothing or lands on the wrong row, a tap target under 44pt for a control used often, a sheet that can't be dismissed or loses what was typed, Back that goes somewhere unexpected or loses the scroll place, a list that doesn't show a change just made, a long-press menu item that does nothing, a missing Undo after a destructive action, a field hidden by the keyboard, a wait with no sign, an error with no next step, text cut off with no way to read it, a toolbar over content, desktop words ("click", "right-click", "hover", ⌘ shortcuts) on a phone, an empty state that leaves you stuck.

Walk real tasks end to end in one page per journey (writes live in the page), then repeat each once:
1. **What shipped in the last five days** (read `git log --since=2026-11-17 --format=%s`): the No skill row and Importance (#491), the drawer's skill order (#484), Collected's title (#489), Bold Text (#473, #479), the single tap that shows the reader's bars (#461), sheets, slides and the long-press menu (#464), the end screen laid out for a phone (#466), keyboard fields (#467), Search clearing in place (#471).
2. **The bus ride**: Today, Review a few Fact and Explain exercises with the on-screen keyboard, finish, the end screen, back. Open a source from the drawer, read, highlight, note, Finish.
3. **Organizing on the phone**: the drawer, a skill's page, moving a source to a skill and to No skill, archive and its Undo, search, Settings.
Check each at 390×844, and the ones that look tight once at 375×667. For each candidate, read the code to confirm it is the app and not the harness, and give the file and line.
