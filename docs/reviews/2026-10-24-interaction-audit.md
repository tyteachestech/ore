# Interaction audit, 2026-10-24

The desktop app checked against the new interaction checklist (AGENTS.md, `.claude/skills/interaction-check`).
✓ works, ✗ missing, **new** = fixed in this pass, *other thread* = being built in "Improve command palette search".

| Object | Create | Rename | Move / re-file | Reorder | Delete + Undo | Right-click / ⋯ | Drag | ⌘K |
|---|---|---|---|---|---|---|---|---|
| Skill | ✓ sidebar + (⌘K *other thread*) | **new** (title, dialog, ⌘K) | ✓ dialog (drag *other thread*) | ✗ | **new** dialog: keep sources (default) or archive them | **new** Open, Rename, Icon/color/collection, Delete | *other thread* | ✓ Edit, **new** Rename |
| Collection (section) | ✓ via the dialog's picker (*other thread* adds New collection) | ✗ | n/a | ✗ order is first appearance in skills.yaml | ✗ only by emptying it | ✗ | *other thread* | ✗ |
| Source | ✓ ⌘N, paste, drop | ✗ a bad captured title can't be fixed | ✗ can't add or remove a skill after capture (only accept AI's suggestion) | n/a (by date) | **new** Archive with Undo (files and cards kept) | **new** Open, Open original, Reveal, Move to Done / To read | ✗ onto a sidebar skill | ✓ open, original, reveal |
| Highlight | ✓ | n/a | ✓ intent | n/a | **new** Undo, plus a visible Remove button (was Backspace only) | ✓ popup | n/a | n/a |
| Card | ✓ drafted from Card highlights | ✓ E in Review | n/a | n/a | **new** Undo on Retire | ✗ no card list outside Review | n/a | ✗ |
| Question | ✓ + on skill page | ✗ | n/a | n/a | ✗ (only Answered) | ✗ | n/a | ✗ |
| Review rating | n/a | n/a | n/a | n/a | ✗ no undo of a mis-tapped rating (known open) | n/a | n/a | n/a |

Also fixed: every info toast ("Added …", "Card retired") rendered as a 20px blob, because the toast's `info` class picked up the ⓘ button style.

## Decided by Tyler (built)
1. Deleting a source archives it, with Undo.
2. Deleting a skill asks what to do with its sources, keeping them by default.

## Clear, queued next (no decision needed)
- Re-file a source: "Add to skill…" in the row menu and dragging a row onto a sidebar skill (needs an `ore` command to set an item's skills).
- Rename a source's title.
- A view of archived sources to restore one after the Undo window (CLI: `ore ls --archived`, `ore archive <id> --undo`).
- Collection rename and reorder (after the other thread lands).
- Undo a rating in Review.
