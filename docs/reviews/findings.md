# Findings

Every bug or UX miss anyone finds lands here as one row: a Codex or ChatGPT sweep, a stress test, a code review, a failing test, a thing Tyler jots down. A sweep reads this file before it starts, instead of a hand-written "already covered" list, so nothing is checked or argued twice. `apps/desktop/test/findings.test.ts` checks the table.

## Rules
- **Add a row when a finding is verified** (triage-report step 3), before any fix. The next free ID is one past the last row. Never reuse or renumber an ID.
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
| F8 | 2026-11-10 | Lists | Typing a title's first letters in a list doesn't jump to that row (Finder); Tyler: yes, D232 | fixed #311 | `list type-select: typing a title's first letters selects its row` |
| F9 | 2026-11-10 | Home, Feed | No multi-selection on Home or the Feed; Tyler: yes, 2026-11-12 (D234) | fixed #316 | `Feed: ⌘-click and ⇧-click pick posts` |
| F10 | 2026-11-10 | Home | A Home source can't be dragged onto a skill; Tyler: yes, 2026-11-12 (D234) | fixed #316 | `a row dragged onto a sidebar skill is filed there` |
| F11 | 2026-11-10 | Notes, lists | A slow first read shows a blank list or editor | not a bug: local reads take milliseconds; the delay was added by hand (twice) | — |
| F12 | 2026-11-11 | Review | A skill row's count is taken after the day's new-exercise cap over the whole queue, so a row picked alone can serve more new exercises than it showed | known limit: D204 | — |
| F13 | 2026-11-11 | iPhone | YouTube and audio sources show the transcript as plain text: the snapshot leaves out `.vtt` and audio, and there is no player relay page | open | — |
| F14 | 2026-11-11 | Review | After a checked Explain exercise the rating buttons can sit below the fold at 1180×800 | open | — |
| F15 | 2026-11-11 | Mac window | Unchecked in the real Tauri window: whether ⌘Q's 150 ms lets WebKit write drafts, and drafts shared between the quick quiz and the main window | open | — |
| F16 | 2026-11-12 | iPhone | Archive's Undo toast: a late tap didn't restore the row; inconclusive, the toast may have expired during screenshots | open | — |
| F17 | 2026-11-11 | Release build | The KaTeX font was refused by the release CSP | fixed #256 | `release build under the release app's CSP` |
| F18 | 2026-11-11 | Diagrams | Elbow middles, matrix cells and top labels were lost on reopening a diagram | fixed #280 | `a dragged elbow middle, a matrix cell and a box label at the top survive the file` |
| F19 | 2026-11-12 | Skill icons | The Learning brain read as two pills, not a brain, at 20px and on the 40px tile | fixed #317 | no test: whether a drawing reads as its subject is judged by eye, shot at 4× in the PR |
| F20 | 2026-11-12 | Buttons | The small button (D196) drew three different focus rings: inside its edge on Start, 1px outside on the note toggle, a shadow ring on Settings | fixed #319 | `every small button takes its focus ring from one shared rule` |
| F21 | 2026-11-12 | Source rows, Reader | A 20px icon sat in a smaller button and hung off its centre: a row's add-skill + (18px circle) and a highlight's margin mark (16px, plus the button's default padding) | fixed #319 | `or bigger than the button it sits in, so it sits off the button's centre` |
| F22 | 2026-11-12 | Lists, Home | ⌘Z right after dragging a row onto a skill (or pinning it) did nothing: the step went on the history only once the write had landed | fixed #321 | `⌘Z takes the drop back` |
| F23 | 2026-11-12 | Reader | A highlight note whose save failed closed and lost the words just typed | fixed #322 | `a note whose save fails is kept, and saves when the highlight next closes` |
| F24 | 2026-11-12 | Feed | ⇧⌘U marked only the post under the cursor, not the pick (D234) | fixed #322 | `⇧⌘U marks both picked posts read` |
| F25 | 2026-11-12 | Home, Feed | F8 on Home and the Feed: no type-select there, and Home's rows took none of the lists' ⌘ keys (Rename, Pin, Archive, Open original), so its menus hid them | fixed #322 | `⌥⌘R renames the focused row` |
| F26 | 2026-11-12 | Home, Feed | A click on empty space left the pick in place | fixed #322 | `a click on empty space drops the pick` |
| F27 | 2026-11-12 | Home, Feed | ⇧↑↓ moved the cursor without growing the pick | fixed #322 | `⇧↓ grows the pick` |
| F28 | 2026-11-12 | Reader | Esc keeps an edit to a highlight's note (read as against D211) | not a bug: D211 is for fields edited in place (titles, names); a highlight's note is writing, kept however the popup closes, as journey "highlight note: what he types is kept when he clicks away or presses Esc" says | — |
| F29 | 2026-11-12 | iPhone | New skill's name field and its "is taken" refusal sat under the keyboard: the shell kept only the reader's fields above it | fixed #324 | `New skill's field and its refusal stay above the keyboard` |
| F30 | 2026-11-12 | iPhone | A double tap on an open picture closed it instead of zooming (D230): iOS sent no second click once the zoom had the touch | fixed #324 | `a double tap on an open picture zooms it` |
| F31 | 2026-11-12 | iPhone, Reader | Scrolling away from a playing recording's line with a finger was pulled back to it, with no Back to current: only the wheel and keys stopped following (D49) | fixed #324 | `a finger's scroll away from the spoken line stops following it` |
| F32 | 2026-11-12 | iPhone | A link the phone couldn't read told him to use the Mac's Browser tab, `ore add --tab` or paste its text, none of which the phone has | fixed #324 | `a refused link's reason leaves out the Mac's next steps` |
| F33 | 2026-11-12 | Import, iPhone | On iOS 26 every import that downloads a page or file failed with "undefined is not a function": the body was read with `for await`, which that web view lacks | fixed #320 | `a response body is read whole where the stream can't be iterated with for await` |
| F34 | 2026-11-12 | Notes, iPhone | On the phone a note's `[[` and the keyboard bar's link button never found a source or skill, and a tapped link went nowhere: the phone passed its notes no link targets | fixed #320 | `phone: a note's [[ link finds the library's sources` |
| F35 | 2026-11-12 | iPhone, Reader | The original-site link at the byline's end sat 4pt below the author and date (its 44pt tap box kept the offsets from when it sat above the title), and when the byline filled the line it dropped to the next one indented 14pt | fixed #327 | `the original-site link sits` |
| F36 | 2026-11-12 | Skill page | The header grew about 17px when its gems loaded a moment after the page, so the note and the lists under it jumped down (a pointer resting on a tab was left off it; a 2px larger gem made CI's tab journey fail every time) | fixed #325 | `the sources' folder tabs show To read, Done and the row details menu` |
| F37 | 2026-11-12 | Import, iPhone | On iOS 26 every PDF import failed with "undefined is not a function": pdf.js reads a stream with `for await`, which that web view lacks | fixed #329 | `a stream with no async iterator gets one, and reads every chunk in order` |
| F38 | 2026-11-12 | Import | A Shift_JIS page whose server names no charset (Aozora Bunko) imports as gibberish, title too: the page's own `<meta>` charset isn't honoured, on the Mac as well | open | — |
| F39 | 2026-11-12 | iPhone notes | The note's keyboard bar sat on top of iOS's own Previous / Next / Done bar, two bars over the keyboard | fixed #323 | no test: WKContentView's accessory bar is native iOS, outside the web view; the phone thread checks it in the Simulator |
| F40 | 2026-11-12 | iPhone notes | The keyboard bar's ten 44pt buttons ran past a 402pt screen: Hide the keyboard started off the edge, and nothing showed the bar scrolls | fixed #323 | `the note's keyboard bar fits the screen` |
| F41 | 2026-11-12 | iPhone notes | With the keyboard up, the + menu's top row was cut off under the source's header | fixed #323 | `the + menu starts below the header` |
| F42 | 2026-11-12 | iPhone Review | Review's ⋯ was three faint specks beside a bold × | fixed #323 | `Review's ⋯ is as strong as ×` |
| F43 | 2026-11-12 | iPhone Review | In Edit exercise, the question went up under the head when the keyboard came up | fixed #323 | `the question stays below the head` |
