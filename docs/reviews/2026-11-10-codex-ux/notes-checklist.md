# Note editor parity checklist

Written before opening Ore or reading its UI implementation. Reference: Notion. Read first: D38–44, D157, D178, D188; the interaction-check Conventions; 2026-11-06-notion-parity.md and notion-parity.test.ts. Existing decisions and baseline actions are exercised only as setup; findings target their edges and combinations. No emoji picker, AI authoring, collaboration, databases, columns, or known external-edit undo loss. No drag-box edge autoscroll finding (explicitly deferred in D188).

Each item requires two real-input runs in Chromium and two in WebKit, at deviceScaleFactor 2. Untestable items remain untested, with a reason. Reference expectations below are from knowledge of Notion; uncertain expectations must be verified before becoming findings.

1. Notion: typing into a fresh empty note immediately displays the typed text.
2. Notion: Backspace at the very start of an empty note is harmless and keeps typing possible.
3. Notion: Enter in the middle of a paragraph splits at the caret without losing either half.
4. Notion: Shift+Enter in a paragraph creates a line break in the same block.
5. Notion: Delete at the end of a paragraph joins the next paragraph without losing text.
6. Notion: left arrow at the beginning of the first block keeps the caret in the note.
7. Notion: right arrow at the end of the final block keeps the caret in the note.
8. Notion: double-click selects a word without changing the text.
9. Notion: triple-click selects the paragraph's text without changing it.
10. Notion: pointer drag within a paragraph selects only the intended text.
11. Notion: Shift+arrows can select text across a paragraph boundary, without becoming block selection.
12. Notion: replacing a text selection by typing replaces only that selection.
13. Notion: undo then redo of selection replacement restores the two exact text versions.
14. Notion: cutting selected words and pasting them elsewhere moves only those words.
15. Notion: copying formatted words and pasting preserves their formatting.
16. Notion: paste without formatting inserts the clipboard words without their rich formatting.
17. Notion: pasting multiple lines into the middle of existing text preserves the text on both sides.
18. Notion: pasting a URL over a selected phrase preserves the phrase as the link label after reload.
19. Notion: undoing a multiline paste restores the exact original paragraph.
20. Notion: a slash search with no matches leaves the typed query editable.
21. Notion: Enter on a slash search with no matches does not silently discard the query.
22. Notion: arrow navigation at the first and last slash-menu results always leaves a visible active result.
23. Notion: Esc from a filtered slash menu keeps typed text and returns to editing it.
24. Notion: Backspace from a filtered slash query updates the visible results.
25. Notion: selecting a slash command with the pointer leaves the caret in its new block.
26. Notion: a slash menu near the bottom of the viewport stays reachable within the viewport.
27. Notion: an inline formatting tool can be toggled on and off while typing at a collapsed caret.
28. Notion: the selection formatting toolbar reflects the selection's existing bold state.
29. Notion: changing formatting through the selection toolbar preserves the selected words.
30. Notion: right-click on selected words preserves that selection for native Copy/Cut.
31. Notion: a nested block-menu submenu opens by keyboard and Left closes only that submenu.
32. Notion: choosing Turn into keeps the block's words and returns editing focus to that block.
33. Notion: moving the first block upward or the last downward is harmless.
34. Notion: duplicating a selected block then undoing and redoing leaves the expected copy count.
35. Notion: selecting blocks backward with Shift+Up and then shrinking with Shift+Down follows the anchor.
36. Notion: Shift+click across several blocks includes the intermediate blocks.
37. Notion: gutter drag can select a mixed set of text and non-text blocks.
38. Notion: dragging a selected pair by the block handle moves the pair together and preserves order.
39. Notion: dragging a block then pressing Esc cancels the move.
40. Notion: an open toggle's child text survives collapse, reopening, and reload.
41. Notion: a callout can contain multiple editable paragraphs without losing them on reload.
42. Notion: code blocks preserve indentation and literal Markdown punctuation after reload.
43. Notion: Shift+Tab at a table's first cell does not delete text or leave an invalid caret.
44. Notion: a wide table scrolls within a narrow note without forcing the whole page sideways.
45. Notion: an image load failure leaves the rest of the note editable.
46. Notion: editing a displayed equation and cancelling retains the original expression.
47. Notion: inserting an internal note link and then typing continues after the link.
48. Notion: a diagram can open and close back to its place in a long note without losing surrounding text.
49. Notion: a long mixed-block note survives save and reload with its block types and text intact.
50. Notion: text remains editable at a narrow desktop width without inaccessible offscreen formatting controls.
51. Notion: opening a note during a delayed load shows progress until the editable note is ready.
52. Notion: a failed save retains the unsaved text and exposes an actionable error.
53. Notion: an interrupted operation leaves a usable note and preserves text already written (streaming AI is outside Ore's note-editor scope, D38).
54. Notion: note-editor toolbar controls disclose their function and available shortcut on hover; Ore uses Hint, never bare title.
55. Notion: peer actions in a block menu use consistent icon treatment; Ore uses its dot icons, with no emoji or smooth replacement glyphs.
56. Notion: editing the same supported block type in a source note and a skill note has the same keyboard behavior.
