# Codex sweep loop, 2026-11-09 (PR #215)

Codex (`gpt-6-astra`) swept a mock of the app ten times; each real finding got a failing test and a fix at its root. Sweep 10 found nothing. 31 bugs fixed, 1 report ruled out, 2 left as decisions.

## How it ran
Two extra clones: one for fixes, one for Codex to test at the fix branch's head, each with `scripts/mock` on its own ports and a scratch library. `codex exec -m gpt-6-astra -c model_reasoning_effort=high` drove the mock with Playwright (Chromium and WebKit) and wrote a report. Each prompt named what earlier sweeps covered and fixed. Never the installed app or `~/Ore`.

## What each sweep found
| Sweep | Found | Fixed | What |
|---|---|---|---|
| (Tyler) | 1 | 1 | The skill picker stayed open after a click outside |
| 1 | 6 | 6 | Delete skill dialog leaked focus; failed Undo dropped; failed delete blocked retry; slow feed post opened over Home; Undo left reopened screens stale; failed rename lost the typed title |
| 2 | 4 | 3 | Esc during a resize left the app unselectable; Practice answers lost on closing the tutor; "Card updated" stuck after Undo. Not a bug: inline rename under a simulated click |
| 3 | 7 | 6 | Words typed during the recall save lost; bulk filing into an archived skill; phantom rows after a failed Undo; recall not undoable; Find missed question text; dead Forward button. Decision: ⌘K for a focused question |
| 4 | 5 | 4 | Late words lost when a note save merged an outside edit; File usable during an add; question from a source in no skill invisible; question list stale after a retype. Open: note undo history after an outside merge |
| 5 | 4 | 4 | Failed author edit lost the name; half-saved question duplicated on retry; question list stale after filing; feed link + ↵ refused |
| 6 | 2 | 2 | Copied feed link refused; quiz progress read "Step 3 of 2" |
| 7 | 2 | 2 | Review's Undo button couldn't be redone; a feed post re-clicked while loading never opened |
| 8 | 2 | 2 | Course filing and Archive course undid more or less than they changed |
| 9 | 1 | 1 | A course action from a skill's page reached only that skill's lessons |
| 10 | 0 | | Clean |

## Root causes, and the guard for each
| Class | Guard |
|---|---|
| A `pointerdown` stopped before the document left Radix popovers open | Nothing stops a press; rows use `data-no-drag` and `RowSensor` (`src/drag.ts`). Every e2e journey fails on a stopped press |
| Undo callbacks could swallow a failed write (13 did) | `Notify` and `Step` require a promise: a type error otherwise |
| A screen's own Undo button bypassed the history | `notify` returns a handle with `undo()` |
| Undo updated a screen copy that had since closed | `useLibraryChanges` wakes screens opened after the step was made |
| Modals without a focus trap (8) | `<Trap>` marks its panel; every journey fails on an `aria-modal` outside one |
| Five in-place title fields that closed before saving | One `TitleField` |
| Four hand-rolled resize drags | One `resizeDrag` |
| Results that landed after he moved on | Compare `viewRef.current` before and after the wait |
| Fields editable during their own save | Read-only while saving |
| Course actions as one whole-course write | Lesson by lesson through `batch`, as a selection is |

## Left for Tyler
- ⌘K changes with what is open, never with what is selected (Tyler, 2026-11-10). No question or try rows were added. The existing rows for a selected source, post, course and multi-selection are to come out in their own PR.
- A note's own ⌘Z history is lost when an outside edit is merged in. Needs the editor to take merged text without a remount.

## Accepted from the code reviews
- A step that lands wakes every screen opened after it, whatever it touched: an extra read on an uncommon action, in exchange for no stale screen.
- `batch` has no rollback when a write fails midway (as before for a selection).
- The page-wide dismiss surface needs one copy of `@radix-ui/react-dismissable-layer`; the popover journey fails if a bump splits it.
