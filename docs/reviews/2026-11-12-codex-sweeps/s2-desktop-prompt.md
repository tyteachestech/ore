# Sweep 2 (desktop): confirm sweep 1, then a daily session, reading with search, and a skill page

Same rules, setup and report shape as `s1-desktop-prompt.md` (read it, and `codex-out/s1-desktop/report.md`), writing only under `codex-out/s2-desktop/`. The mock now serves the branch under test (the commit is in `git log -1`). Read `docs/reviews/findings.md` first: rows F23–F32 are sweep 1's, fixed; report one only if you saw it come back.

## 1. Confirm sweep 1's fixes, twice each in WebKit
- F23: a highlight note whose save fails (`__ORE_FAIL = { annotate: "…" }`) keeps its words on reopening, also after going Home and back, and saves on the next close.
- F24–F27: on Home's Continue reading and in the Feed, ⇧↑↓ grow the pick (also after a ⌘-click), a click on empty space drops it (a drag that ends there doesn't), typing a title's first letters selects it, ⇧⌘U marks a Feed pick read, and on Home ⌥⌘R / ⌥⌘P / ⇧⌘A / ⇧⌘O act on the focused row or its pick, shown in its menu.

## 2. New tasks, twice each (never swept as tasks)
1. **The 10-minute session** (`docs/design/daily-session.md`): start review from Home, answer a Fact and an Explain exercise, push one Later (⌘L), Ask about one (/), leave halfway (Esc), come back from Home, finish, see the end. Then ⌘Z on Home. Is anything typed lost, counted twice, or unclear about what's left?
2. **Read and find** (D219, D224, D229): in a source, ⌘F for a word in the source and in its note, switch to the Source note tab and ⌘F again, filter Collected, double-click a sentence and triple-click a paragraph to highlight, make one a Key point and one a Question, then find them again from Collected.
3. **Tend a skill** (D226, D203): on a skill page, switch its folder tabs (To read, Done, Archived; Questions, Answered) by mouse and keyboard, search To read and Questions with a typo, add a question, rename the skill and its goal, fold a section, and come back to the page.

Interrupt each task once with a failing or slow write (`__ORE_FAIL`, `__ORE_SLOW`). Report as before; finish by printing the ranked findings one line each, or "clean".
