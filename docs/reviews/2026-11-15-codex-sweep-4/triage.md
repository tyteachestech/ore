# Codex sweep 4: triage

Five Codex testers on ground no earlier sweep took. The Mac froze with all five running at once, so they reran two at a time under the new Mac load rule (`docs/WORKFLOW.md`). Each finding was reproduced by a test before it was fixed; every row is in `docs/reviews/findings.md` with its guard.

| Report | Finding | Verdict |
|---|---|---|
| firstrun 1 | A short caught-up review showed the goal as minutes spent | fixed |
| firstrun 2 | Finish promised exercises: the phone drafts none, and a Mac run that drafted none said nothing | fixed (phone copy names the Mac; Mac says no exercises came and what to mark) |
| firstrun 3 | Recall feedback waited forever on an empty reply | not a bug: only the mock answers null |
| firstrun 4 | Start review on day 0 said "All caught up" | fixed |
| settings 1 | A goal changed mid-session didn't reach the open Review | fixed |
| settings 2 | New exercises a day set to 0 mid-session kept serving new ones | fixed |
| settings 3 | iPhone Today kept the old goal after Settings | fixed |
| settings 4 | ⌘Z of a goal change left Home on the undone value | fixed |
| settings 5 | Reading look, sounds, menu bar and shortcut changes aren't on ⌘Z | Tyler: Mac apps don't undo preferences; keep or add |
| settings 6 | A failed When you review save lost the typed words | fixed |
| settings 7 | A goal off the list showed no choice picked | fixed |
| settings 8 | A bad value in skills.yaml fell back silently | fixed (Settings names it) |
| settings 9 | An empty skill name in skills.yaml showed a blank skill | fixed (its id shows; doctor names it) |
