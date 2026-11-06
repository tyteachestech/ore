---
name: interaction-check
description: Run before calling any change to apps/desktop done, and when asked to audit the app's UX. Checks every object on the surfaces you touched for the interactions a Mac user expects (create, rename, move, reorder, delete with undo, right-click, drag, keyboard) and lists what is missing.
---

# Interaction check

Impeccable judges how a screen looks. This checks that it behaves the way every good Mac app has
taught Tyler to expect, so he never has to ask for "the obvious thing". The rules are the
"Interaction checklist" in `AGENTS.md`; this file is how to run them and the detail behind them.

## Run it

1. **List the objects** on every surface you touched: skill, collection (sidebar section), source,
   highlight, card, question, source note, skill note, diagram, review session.
2. **Purpose check** (AGENTS.md "Purpose rule"): for every element on the surfaces you touched
   (labels, counts, pills, lines of copy, icons, cards, buttons), write its purpose for Tyler in one
   line. An element with no purpose goes; list each removal in the PR.
3. **Fill the matrix** for each object, one cell per action: ✓ works, ✗ missing, or `n/a (D##)`
   when a decision in `docs/DECISIONS.md` or `docs/SPEC.md` rules it out. Nothing else counts as n/a.

   | Object | Create | Open | Rename | Edit | Move / re-file | Reorder | Delete / archive + Undo | Right-click | Drag | ⌘K | Keyboard |
   |---|---|---|---|---|---|---|---|---|---|---|---|

4. **Run the Conventions table** (below) for every kind of surface you touched: mark each row ✓, ✗
   or `n/a (D##)`. The object grid asks what he can do to a thing; this asks whether the surface
   behaves like the same kind of surface in the app he already uses.
5. **Do each ✓ for real** in the mocked app (`apps/desktop/scripts/mock/`, Playwright) with
   real-length and junk data: click it, right-click it, drag it, press the keys, undo it.
6. **Break it** on every surface you touched and fix what you find (detail below).
7. **Fix every ✗ that is in scope.** For the rest, add a row to the PR's "Interaction gaps" list with
   why it was left (another thread owns it, needs a decision, needs a core command).
8. Put the matrix and the Conventions rows for the objects you touched, and what you broke, in the PR description.

## Conventions by surface

Naming the app you copy is not enough: list what that app does with keys, clicks and modifiers on
this kind of surface, and match it. These are the ones already learned the hard way. **When Tyler
has to ask for something obvious, add a row here in the same PR.**

| Surface | Convention | Copied from |
|---|---|---|
| Any list | ⇧-click and ⇧↑↓ extend a selection from its anchor, ⌘-click toggles, ⌘A selects all, Esc clears; ⋯, right-click and ⌘K act on the whole selection with one Undo | Linear, Finder |
| Any list | Dragging a selection files every item in it | Finder, Things |
| Any list | ⌘C on a selected row copies it as Markdown with its link | Notion, Linear |
| Any list of sources | Each row starts with the source's thumbnail (`<Thumb>`), or its kind icon, wherever it is listed: All sources, skill page, Home, ⌘K | Raindrop, Readwise Reader |
| Any list of sources | A source's skill chips open its skill picker on click, wherever the row is listed (All sources, skill page, Home); the row itself still opens on click | Linear labels, Notion multi-select |
| Set of pills or tags | Clicking the set opens a multi-select: search, toggle with a click or Enter, create a new one from the query | Notion |
| Command palette | ⌘1–⌘9 run the visible rows; recent items first with an empty query; actions on the open or selected object | Raycast |
| Reading page | ⌘F finds in the page with a match count, ⌘G/⇧⌘G or Enter/⇧Enter step, Esc closes and keeps the place | Safari, Books |
| Reading page | ⌘+ ⌘− change text size (⌘0 is Go to Home here, so Default size is in Settings and ⌘K); width, size and a light page in Settings › Reading and ⌘K, not a popover (PR #52); the paragraph in view stays in view | Books, Readwise Reader |
| Reading page | Highlight without the mouse: ↑↓ move a focus that appears only once the keyboard moves, ⇧↑↓ widen it, H highlights it, 1–3 pick the type, Esc clears; arrows stay with menus, lists and fields | Readwise Reader |
| Reading page | An open highlight's edges can be dragged (handles in its colour, snapping to words, Esc puts it back, ⌘Z undoes); selecting past a highlight's edge grows it instead of stacking a second (D117) | Kindle, Books (iPhone), Readwise Reader |
| Reading page | Look Up on a selected word (force-click, ⌃⌘D, right-click) | Books, Kindle |
| Reading page | Read aloud, the page following the spoken sentence | Readwise Reader, Books |
| Reading page | Reopens at the place he left | Kindle, Books |
| Link in text | Hover shows a peek of the target; one click opens it | Notion, Arc |
| Text field or editor | Keeps its own ⌘Z, ⌘A, ⌘C; app shortcuts never steal them | Every Mac app |
| Text field or editor | Spell check and autocorrect on wherever he writes words (notes, highlight notes, answers, titles, names, diagram labels); `spellCheck={false}` only on search, links and shortcut keys. The app turns WebKit spell checking on at launch (`spelling_on` in `main.rs`); autocorrect follows the Mac's Keyboard setting | TextEdit, Notes |
| Text field or editor | Typed triggers: `[]` + space makes a to-do, `:` + a letter opens emoji, `/` blocks, `[[` links. A menu that opens under a resting pointer keeps its first row selected; only a real mouse move selects another | Notion, Raycast |
| Note editor | Blocks as in Notion: Esc selects the line's block, ↑ ↓ move the selection, ⇧↑ ⇧↓ and ⇧-click take in more, ⌘A twice takes every block, Enter types again, a second Esc lets go; Backspace, cut, copy, ⌘D, ⌘⇧↑ ↓, the ⋮⋮ drag and its menu act on all selected blocks, and ⌘Z brings them back selected. Tables: Tab moves cell to cell and adds a row from the last one, the grip on a row's left edge and a column's top edge opens insert, move and delete, the + under and right of it adds a row or a column | Notion |
| Whole app | ⌘Z and ⇧⌘Z step back and forward through more than one action, each named in a toast | Every Mac app |
| Whole app | Every command is in the menu bar with its shortcut, generated from the keymap; Help ▸ Search finds it | Apple's apps, Things |
| Whole app | ⌘[ ⌘] go back and forward; ⌘, opens Settings; ⌘/ lists shortcuts | Safari, Linear |
| Shortcut editor | Search by name, or switch the field to keys and press a combo to find what uses it; click a shortcut and press new keys; a combo in use asks to Replace (the other is left Not assigned); ↺ resets one, × removes one, Reset all; every one but a plain rebind has Undo; the ⌘/ sheet and Settings are the same editor | ChatGPT, VS Code |
| Window | Reopens at the size and place he left it, on a screen that still exists | Every Mac app |
| Whole app | Right-click never shows the webview's page menu (Reload, AutoFill, Camera). Only fields, the note editor, selected text and the reader's text keep the Mac's own menu (Copy, Paste, Look Up); a field inside a row gets the text menu, not the row's (`native-menu.ts`, `WithMenu`) | Finder, Linear |
| Right-click by surface | Row, card, title or header: the same actions as its ⋯. Sidebar space and Home/All sources rows: New skill, New collection. A list's space and its card (Sources, Questions): that list's create action (Add source, Add a question). Home, Review, Settings, the reader's side panel outside rows: nothing. A new surface picks one of these and adds its row here | Finder, Notion |

## Detail behind each rule

**Lifecycle.** If he can make it, he can rename it, move it, and get rid of it (Notion, Linear,
Finder). An object with a create action and no delete or rename is a bug. Library rule: core never
deletes item folders (SPEC "References stay valid"), so "delete" for a source means archive or a
`deleted` status the UI hides, never `rm`.

**Three ways in.** Every action on an object is reachable from (a) a visible control (a hover-revealed
⋯ or button on the row, Linear-style), (b) the right-click menu, which lists the same actions as ⋯
in the same order with destructive ones last and red, and (c) ⌘K when the object is open or selected.
Frequent actions get a shortcut shown through `<Hint keys=…>`. Use Radix `ContextMenu` and
`DropdownMenu` (Linear and Raycast's menu behavior: arrows, type-ahead, Esc), never a hand-rolled menu.

**Create.** The + sits where the object will live (sidebar header, list top) and in ⌘K. The new object
appears in place, selected, with its name field focused (Notion's new page, Finder's new folder).
Enter commits, Esc drops it, and half-typed text is never saved on blur.

**Rename.** Inline on the title where the object is shown (Notion page title, Finder's Rename…), plus
"Rename…" in its menus. Enter saves, Esc restores the old name, an empty name is refused. Links
store IDs, so a rename never breaks them (D39).

**Delete and undo.** No "Are you sure?" dialog. Act at once, then show a toast "Deleted X · Undo"
for about 6 seconds. The step joins the app history: ⌘Z undoes it (and the ones before it) after the
toast is gone, ⇧⌘Z redoes it, so pass `notify` both the inverse and the step itself (Gmail, Linear, Things). Ask first only
when undo is impossible. Ratings, retiring a card, removing a highlight, moving a source: all undoable.
Every change that isn't destructive joins the same history with no toast, `notify(msg, "quiet", undo, redo)`:
making a highlight, switching its type, renaming, pinning, reordering, editing a card. Check: do the
change, click away, press ⌘Z; if nothing comes back, it's a bug (Tyler, 2026-11-03: five highlights, no undo).

**Drag and drop.** Wherever he would try it: reorder anything whose order is his (skills, collections),
drop an object onto a group to file it (a skill onto a section, a source onto a skill), drop files to
add. The drop target lights up, the rest dims, Esc cancels, and every drag has a menu equivalent
("Move to…") for the keyboard. Use `@dnd-kit` or the HTML drag events; never a hand-rolled pointer loop.

**Selection and keyboard.** Nothing is highlighted until the keyboard moves (Linear). One click opens;
arrows move; Enter opens; Esc closes the topmost layer only and puts focus back where it was; Tab
reaches every control with a visible focus ring. Type-to-filter in any list over ~15 rows.

**Feedback.** Every click changes something on screen within 100 ms (Doherty threshold): update
optimistically, roll back with an error toast on failure. Every AI or network wait shows
`<Working label=…>` at once, in the spot its result will fill (Claude's and ChatGPT's status line): the
pixel spinner plus what it is doing, and with `slow=` how long it takes once it passes 5 s. A greyed
button, a still "Checking…" line or a blank gap is not feedback. Slow the mock with `ORE_MOCK_DELAY=8000`
and look at every wait you touched; `apps/desktop/test/waits.test.ts` must list each new slow call. Every
list has an empty state that carries its create action. Every error says what to do next and offers
Try again when it can.

**Every state.** Walk the core flow and ask three things at each step: does he know what just
happened, can he take it back, does he know what to do next. Design failure states as carefully as
success: a failure handled well can leave him happier than no failure at all (the service recovery
paradox). Give him something instead of nothing: keep what he typed, name the next step, offer the
way out that doesn't need the broken part (grade it yourself when AI grading fails).

**Break it.** Before calling a change done, break what you touched on purpose and look at each result:
- AI: the vendor CLI missing (`PATH` without `claude`), signed out, or replying junk (the fake
  `claude` in `packages/core/test/ai.test.ts`). Background enrich failing must show its reason in the
  reader at once (`enrich_error` from `ore show`/`ls`), not after a timeout.
- Network: offline in the middle of an add; a link that 403s or has no article text; a video with no captions.
- Files: a scanned PDF, an empty file, an unsupported type.
- Data: an empty library, the daily new-card limit reached, junk and very long titles (`/break-ui`).
- Partial success: a pasted list where one entry fails keeps only the failed ones, so a retry never adds the rest twice.

**Memory.** Scroll position, the open tab, collapsed groups and the last selection survive leaving
and coming back, and relaunch (`load`/`save` in `util.ts`).

**Consistency.** The same object behaves the same everywhere it appears (Jakob's law): a source row on
a skill page, in All sources and in search all open, right-click and drag the same way.

## Sources

- Tim Gabe, "The Psychology of Premium Apps" (2026): premium is evidence the product was thought
  through, in every state, across screens, and in its worst moments; AI-built screens skip status,
  undo and error recovery ("design theater").
- Vercel Web Interface Guidelines (vercel-labs/web-interface-guidelines): keyboard everywhere,
  manage focus, confirm destructive or offer Undo, optimistic updates, gestures have alternatives,
  no dead ends, all states designed.
- Apple Human Interface Guidelines: Undo and redo, Context menus, Drag and drop, Menus (destructive
  last), Keyboards.
- Laws of UX: Jakob's law, Doherty threshold, Fitts's law, Hick's law.
- Impeccable (`.claude/skills/impeccable`): visual critique and polish; run it alongside this, not instead.
