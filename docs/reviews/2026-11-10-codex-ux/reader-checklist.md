# Reader parity checklist — written before opening Ore or reading its UI source

Reference certainty describes reference behavior, not whether Ore has it. `unsure` failures will be separated from findings. Existing decisions and covered journeys will be checked after this file is written; excluded differences will not be findings. Each item is attempted twice in Chromium and twice in WebKit with real input; unavailable content or unreliable observation means `untested`.

1. **sure — Readwise Reader:** Dragging within a paragraph selects exactly the text traversed and offers highlighting.
2. **sure — Readwise Reader:** Dragging across paragraphs creates one contiguous text selection suitable for highlighting.
3. **sure — Apple Books:** Double-click selects a word and makes annotation available.
4. **sure — Apple Books:** Triple-click selects a paragraph without including reader controls.
5. **unsure — Readwise Reader:** Shift-click extends an existing text selection to the clicked location.
6. **sure — Apple Books:** Shift+Arrow extends a text selection without activating unrelated commands.
7. **sure — Readwise Reader:** Escape dismisses a selection toolbar without creating a highlight.
8. **sure — Readwise Reader:** A selection near the top of the viewport retains accessible highlight actions.
9. **sure — Readwise Reader:** A selection near the bottom of the viewport retains accessible highlight actions.
10. **sure — Readwise Reader:** A selection near either horizontal viewport edge retains accessible highlight actions.
11. **sure — Readwise Reader:** A selection in a short window retains accessible highlight actions.
12. **unsure — Readwise Reader:** Tab can reach the selection toolbar's available actions.
13. **sure — Readwise Reader:** Selecting text in a heading can create a highlight on that heading.
14. **sure — Readwise Reader:** Selecting text in a list can create a highlight on that list text.
15. **unsure — Readwise Reader:** Selecting text across table cells can create a highlight retaining readable cell text.
16. **unsure — Readwise Reader:** Selecting code can create a highlight without losing the selected code characters.
17. **sure — Readwise Reader:** Creating a highlight immediately marks the selected passage.
18. **unsure — Readwise Reader:** Command+Z undoes a just-created highlight.
19. **unsure — Readwise Reader:** Shift+Command+Z restores an undone highlight.
20. **sure — Kindle:** Changing an existing highlight's annotation style updates that highlight rather than creating a duplicate.
21. **unsure — Readwise Reader:** Undo reverses an annotation-style change.
22. **unsure — Readwise Reader:** Redo reapplies an annotation-style change.
23. **sure — Kindle:** Adding a note to a highlight keeps the note attached to that passage.
24. **unsure — Readwise Reader:** Undo reverses a saved highlight-note edit.
25. **unsure — Readwise Reader:** Redo restores a saved highlight-note edit.
26. **sure — Apple Books:** Adjusting a highlight boundary changes its extent without creating a second highlight.
27. **unsure — Readwise Reader:** Undo restores the previous highlight boundary.
28. **unsure — Readwise Reader:** Redo restores an adjusted highlight boundary.
29. **sure — Kindle:** Deleting a highlight removes the visible annotation from its passage.
30. **unsure — Readwise Reader:** Undo restores a deleted highlight.
31. **unsure — Readwise Reader:** Redo deletes the restored highlight again.
32. **unsure — Readwise Reader:** Highlighting an overlapping passage has a deterministic result without hidden or unreachable annotations.
33. **unsure — Readwise Reader:** Adjacent highlights remain individually reachable.
34. **sure — Kindle:** Selecting an entry in the highlights list jumps to the corresponding passage.
35. **sure — Readwise Reader:** Clicking a passage's highlight exposes its annotation actions.
36. **sure — Readwise Reader:** Copy on a highlight copies its passage text.
37. **sure — Apple Books:** Command+C copies selected reader text without toolbar labels.
38. **sure — Apple Books:** Command+X in read-only source text cannot delete the source passage.
39. **sure — Readwise Reader:** Right-click on selected text offers text-relevant actions.
40. **sure — Kindle:** Right-click on a highlight offers annotation-relevant actions.
41. **sure — Readwise Reader:** Right-click on a link offers link-relevant actions.
42. **unsure — Readwise Reader:** Right-click on an image offers image-relevant actions.
43. **sure — Readwise Reader:** Clicking a source image opens an enlarged view.
44. **unsure — Readwise Reader:** An enlarged image can be zoomed beyond its initial fitted size.
45. **sure — Readwise Reader:** An external article link opens its destination without replacing the reader's source.
46. **sure — Apple Books:** A footnote reference reveals its target without losing the reader's place.
47. **sure — Readwise Reader:** An internal heading link scrolls to its corresponding section.
48. **sure — Readwise Reader:** Clicking an outline entry lands with the target heading visible below fixed controls.
49. **sure — Readwise Reader:** An empty outline does not offer meaningless navigation targets.
50. **sure — Apple Books:** Find exposes the current match and total match count.
51. **sure — Apple Books:** Enter and Shift+Enter in Find move forward and backward through matches, including wraparound.
52. **sure — Readwise Reader:** Escape closes Find and permits reader keyboard actions again.
53. **sure — Apple Books:** A query with no matches shows a clear no-results state.
54. **sure — Apple Books:** A changed reading text size stays selected after closing and reopening its control.
55. **sure — Readwise Reader:** Closing a reader side panel returns its space to the article.
56. **unsure — Readwise Reader:** A reader side panel can be resized without selecting article text.
57. **sure — Readwise Reader:** Going Back from a source and Forward into it restores its reading position.
58. **sure — Readwise Reader:** Long article content remains readable and navigable at a narrow window width.
59. **sure — Readwise Reader:** Loading a source shows progress rather than an unexplained empty reading surface.
60. **sure — Readwise Reader:** A source load failure gives a visible error and recovery action.
61. **sure — Readwise Reader:** A long highlights list can reach its last entry without losing access to its actions.
62. **sure — Readwise Reader / Ore consistency:** Toolbar actions expose hover hints, including their assigned shortcuts; Ore uses Hint, never native title.
63. **sure — Readwise Reader / Ore consistency:** Sibling menu actions use a consistent icon convention; Ore uses its dot icon set and no emoji or smooth substitute glyphs.
64. **sure — YouTube:** Space toggles playback when playback controls have focus.
65. **sure — YouTube:** K toggles playback when focus is outside an editable field.
66. **sure — YouTube:** J seeks backward ten seconds, clamping at the start.
67. **sure — YouTube:** L seeks forward ten seconds, clamping at the end.
68. **sure — YouTube:** Left and Right seek backward and forward five seconds when the player has focus.
69. **sure — YouTube:** Up and Down adjust volume when the player has focus.
70. **sure — YouTube:** M toggles mute when focus is outside an editable field.
71. **sure — YouTube:** A chosen playback speed remains selected when the speed menu is reopened.
72. **sure — Snipd:** Clicking a transcript segment seeks playback to its timestamp.
73. **sure — Snipd:** Transcript following keeps the currently playing segment visible.
74. **sure — Snipd:** A highlight made from transcript text retains the passage's playback time.
75. **sure — YouTube:** Playback shortcuts typed into a focused text field do not control playback.
76. **unsure — YouTube:** An open settings menu consumes its navigation keys without also seeking the media.
77. **sure — Snipd:** Returning to a previously opened playable source resumes at its saved position.
78. **sure — YouTube:** A stopped or ended player exposes a way to play again.
79. **sure — YouTube:** A playback failure shows a useful error state rather than a permanently blank player.
80. **sure — Snipd:** An audio source supports play/pause and seeking from its transcript without requiring a video image.

Field-editing budget: only items 6, 37, 38 and 75 directly exercise generic field/selection keys; the rest focus on reader controls, annotations, navigation and playback. Clipboard, Enter, arrows and Escape in concrete reader states will be recorded in the test evidence rather than inflating the checklist with browser-native editing checks.

## Reference-confidence correction after the initial checklist

Item 12 was initially marked sure. After checking Readwise’s official keyboard documentation, I could confirm dedicated highlight/note shortcuts but not the exact Tab path through its annotation toolbar. It is therefore downgraded to unsure and cannot produce a finding. The original pre-Ore checklist is preserved in `checklist-initial.md`. No behaviors were added after opening Ore.
