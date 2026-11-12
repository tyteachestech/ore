# Findings

Every bug or UX miss anyone finds lands here as one row: a Codex or ChatGPT sweep, a stress test, a code review, a failing test, a thing Tyler jots down. A sweep reads this file before it starts, instead of a hand-written "already covered" list, so nothing is checked or argued twice. `apps/desktop/test/findings.test.ts` checks the table.

## Rules
- **Add a row when a finding is verified** (triage-report step 2), before any fix. The next free ID is one past the last row. Never reuse or renumber an ID.
- **Status** is one of:
  - `open`
  - `fixed #PR`
  - `not a bug: <why>` (a D-number, or the reason it was ruled out)
  - `Tyler: <the question>` (his call, nothing built)
  - `known limit: <D-number or why>` (accepted as is)
- **Guard** names what keeps a `fixed` row fixed: a phrase from the test or journey that guards it (its title, or the comment that heads a check script), in backticks; the test looks for it in the suite. When no test can reach it (a macOS-only API, pixels, the real Tauri window), write `no test: <why>`. Other statuses leave it `—`.
- **Update the row in the PR that changes it**, so the table is right at every merge.
- A sweep re-reports a row only when it saw the behaviour come back. Then the row goes back to `open`, with the new PR noted in What.

## Running a sweep
A sweep prompt names the surface and the commit under test, points at this file and asks for:
- **Real tasks over single keys.** The diagram sweeps (`2026-11-11-diagram-sweeps/`) found their bugs in study tasks: save, reopen, edit again, be interrupted mid-edit, see a write fail (`window.__ORE_FAIL`, `__ORE_SLOW`). Key-by-key checklists of native text editing mostly pass.
- **Changed surfaces first.** Start from `git log` since the surface's last clean sweep, and from merged features never checked in the app as it runs (WebKit, the release build, the phone).
- **New findings only**, each with steps to reproduce, and a note on any row it saw come back.

## Table

| ID | Found | Where | What | Status | Guard |
|---|---|---|---|---|---|
| F1 | 2026-11-01 | Notes | A note's own ⌘Z history is lost when an outside edit is merged in: the editor remounts (`Notes.tsx` `key={notes.version}`) | open | — |
| F2 | 2026-11-01 | Video | A player that stalls mid-play is not detected or shown | open | — |
| F3 | 2026-11-08 | Reader | A drag that starts inside link text selects nothing; maybe Chromium only, unchecked in the macOS webview | open | — |
| F4 | 2026-11-08 | Import | A binary file named .md or .txt is saved as a source of junk instead of refused (D96) | open | — |
| F5 | 2026-11-08 | Import | Reimport after the kept original was deleted gives the wrong reason ("only a source added from a link or a file") | open | — |
| F6 | 2026-11-08 | Reader | The reader's shown-text map (`apps/desktop/src/text.ts`) and core anchoring are two maps of one text | open | — |
| F7 | 2026-11-09 | Undo | `batch` has no rollback when a write fails midway | known limit: accepted in the 2026-11-09 code reviews | — |
| F8 | 2026-11-10 | Lists | Typing a title's first letters in a list doesn't jump to that row (Finder) | Tyler: add type-to-select in lists? | — |
| F9 | 2026-11-10 | Home, Feed | No multi-selection on Home or the Feed | Tyler: recommended no | — |
| F10 | 2026-11-10 | Home | A Home source can't be dragged onto a skill | Tyler: recommended no | — |
| F11 | 2026-11-10 | Notes, lists | A slow first read shows a blank list or editor | not a bug: local reads take milliseconds; the delay was added by hand (twice) | — |
| F12 | 2026-11-11 | Review | A skill row's count is taken after the day's new-exercise cap over the whole queue, so a row picked alone can serve more new exercises than it showed | known limit: D204 | — |
| F13 | 2026-11-11 | iPhone | YouTube and audio sources show the transcript as plain text: the snapshot leaves out `.vtt` and audio, and there is no player relay page | open | — |
| F14 | 2026-11-11 | Review | After a checked Explain exercise the rating buttons can sit below the fold at 1180×800 | open | — |
| F15 | 2026-11-11 | Mac window | Unchecked in the real Tauri window: whether ⌘Q's 150 ms lets WebKit write drafts, and drafts shared between the quick quiz and the main window | open | — |
| F16 | 2026-11-12 | iPhone | Archive's Undo toast: a late tap didn't restore the row; inconclusive, the toast may have expired during screenshots | open | — |
| F17 | 2026-11-11 | Release build | The KaTeX font was refused by the release CSP | fixed #256 | `release build under the release app's CSP` |
| F18 | 2026-11-11 | Diagrams | Elbow middles, matrix cells and top labels were lost on reopening a diagram | fixed #280 | `a dragged elbow middle, a matrix cell and a box label at the top survive the file` |
