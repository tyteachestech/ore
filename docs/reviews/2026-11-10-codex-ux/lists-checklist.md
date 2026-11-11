# Lists and sidebar parity checklist

Written before opening Ore or reading UI source. Reference expectations are recalled, not independently researched. `sure` means confident about the stated reference behavior; a failing `unsure` item is not a finding. Rows marked excluded in the report were not retested. Plain text field checks: 4 of 80.

1. **sure · Linear · All sources** — Single click opens the row target.
2. **sure · Finder · All sources** — Up/Down move focus/selection one row and stop at the first/last row.
3. **unsure · Finder · All sources** — Home/End select the first/last row.
4. **sure · Finder · All sources** — Page Up/Page Down move through a scrollable list without opening a row.
5. **sure · Linear · All sources** — Enter opens the keyboard-selected row.
6. **unsure · Finder · All sources** — Space selects a row without opening its full detail (Quick Look itself excluded).
7. **sure · Finder · All sources** — Typing a title prefix locates a matching row without an explicit search field.
8. **sure · Linear · Skill page** — Single click opens the row target.
9. **sure · Finder · Skill page** — Up/Down move focus/selection one row and stop at the first/last row.
10. **unsure · Finder · Skill page** — Home/End select the first/last row.
11. **sure · Finder · Skill page** — Page Up/Page Down move through a scrollable list without opening a row.
12. **sure · Linear · Skill page** — Enter opens the keyboard-selected row.
13. **unsure · Finder · Skill page** — Space selects a row without opening its full detail (Quick Look itself excluded).
14. **sure · Finder · Skill page** — Typing a title prefix locates a matching row without an explicit search field.
15. **sure · Linear · Home lists** — Single click opens the row target.
16. **sure · Finder · Home lists** — Up/Down move focus/selection one row and stop at the first/last row.
17. **unsure · Finder · Home lists** — Home/End select the first/last row.
18. **sure · Finder · Home lists** — Page Up/Page Down move through a scrollable list without opening a row.
19. **sure · Linear · Home lists** — Enter opens the keyboard-selected row.
20. **unsure · Finder · Home lists** — Space selects a row without opening its full detail (Quick Look itself excluded).
21. **sure · Finder · Home lists** — Typing a title prefix locates a matching row without an explicit search field.
22. **sure · Linear · Feed** — Single click opens the row target.
23. **sure · Finder · Feed** — Up/Down move focus/selection one row and stop at the first/last row.
24. **unsure · Finder · Feed** — Home/End select the first/last row.
25. **sure · Finder · Feed** — Page Up/Page Down move through a scrollable list without opening a row.
26. **sure · Linear · Feed** — Enter opens the keyboard-selected row.
27. **unsure · Finder · Feed** — Space selects a row without opening its full detail (Quick Look itself excluded).
28. **sure · Finder · Feed** — Typing a title prefix locates a matching row without an explicit search field.
29. **sure · Linear · Sidebar skills and collections** — Single click opens the row target.
30. **sure · Finder · Sidebar skills and collections** — Up/Down move focus/selection one row and stop at the first/last row.
31. **unsure · Finder · Sidebar skills and collections** — Home/End select the first/last row.
32. **sure · Finder · Sidebar skills and collections** — Page Up/Page Down move through a scrollable list without opening a row.
33. **sure · Linear · Sidebar skills and collections** — Enter opens the keyboard-selected row.
34. **unsure · Finder · Sidebar skills and collections** — Space selects a row without opening its full detail (Quick Look itself excluded).
35. **sure · Finder · Sidebar skills and collections** — Typing a title prefix locates a matching row without an explicit search field.
36. **sure · Finder · All sources** — Shift-click selects the contiguous range between the anchor and clicked row.
37. **sure · Finder · Skill page** — Command-click toggles one row without opening it.
38. **sure · Finder · Home lists** — Shift+Down/Up extends and contracts a contiguous selection.
39. **sure · Finder · Feed** — Command+A selects the visible list items without selecting the page text.
40. **sure · Linear · All sources** — Esc clears a row selection while keeping the list usable by keyboard.
41. **sure · Finder · All sources** — Right-click on a selected row preserves the selected group.
42. **sure · Linear · Skill page** — Row ellipsis and row right-click expose equivalent actions.
43. **sure · Linear · Home lists** — Right-click a row opens actions for that row.
44. **sure · Linear · Feed** — Right-click a row opens actions for that row.
45. **sure · Finder · Sidebar skills and collections** — A skill and a collection each expose their own context menu.
46. **unsure · Finder · All sources** — Blank-space right-click exposes list-level actions.
47. **sure · Linear · All sources** — Menus put destructive actions last and keep icons consistent among sibling actions.
48. **sure · Finder · All sources** — Dragging a source onto a sidebar skill visibly identifies the drop target and files the source there.
49. **sure · Raindrop · All sources** — Dragging selected sources onto a collection files the selected group together.
50. **sure · Finder · Sidebar skills and collections** — Dragging a sidebar item reorders it with a visible placement indication.
51. **sure · Finder · All sources** — Esc during a drag cancels the operation.
52. **sure · Finder · Sidebar skills and collections** — Dropping an item on itself leaves its location intact.
53. **sure · Finder · Sidebar skills and collections** — Rename selects the existing name and Enter commits it while retaining focus on the item.
54. **sure · Finder · Sidebar skills and collections** — Esc cancels a rename and restores the original item name.
55. **sure · Linear · All sources** — Deleting a row provides undo and moves keyboard focus to a surviving row.
56. **sure · Finder · All sources** — Command+Z reverses deletion and Shift+Command+Z reapplies it.
57. **sure · Raindrop · All sources** — The selected sort order survives opening a source and navigating Back.
58. **sure · Raindrop · Skill page** — The selected filter survives opening a source and navigating Back.
59. **sure · Finder · All sources** — Back restores the previous list scroll position and selected row.
60. **sure · Linear · All lists** — Every row action and header button has an explanatory hover hint, including its available shortcut.
61. **unsure · Linear · Sidebar skills and collections** — Collapsed sidebar retains a discoverable keyboard-accessible way to navigate skills and collections.
62. **sure · Finder · Sidebar skills and collections** — Narrowing and widening the sidebar retains access to its navigation controls.
63. **sure · Linear · All lists** — At 1280×480 every opened menu remains scrollable or fully usable inside the window.
64. **sure · Raindrop · All lists** — At 760px width source titles do not push row actions off-screen.
65. **sure · Raindrop · All lists** — A very long source title is contained without covering adjacent actions.
66. **sure · Raindrop · All lists** — A missing thumbnail leaves the row readable and usable.
67. **unsure · Raindrop · All lists** — Rows remain usable with zero or many assigned filing categories.
68. **sure · Linear · All lists** — An empty list offers a relevant next action rather than a broken or indefinite loading view.
69. **sure · Linear · All sources** — A search with no matches shows an explicit no-results state and permits clearing the search.
70. **sure · Linear · All lists** — Opening Add focuses its input from every supported entry point.
71. **sure · Linear · Add** — During submission, progress stays visible and duplicate submission is prevented.
72. **sure · Linear · Add** — An import error keeps the submitted value recoverable and provides a retry path.
73. **unsure · Linear · Add** — Stopping an import leaves a stable stopped state and permits a new attempt.
74. **sure · Finder · All sources** — Command+C copies the selected source in a useful representation.
75. **unsure · Finder · All sources** — Command+X followed by Command+V in a collection moves the selected source there.
76. **sure · Finder · All sources** — Dragging across blank space selects multiple rows with a selection rectangle.
77. **sure · Finder · Sidebar rename** — Double-click selects a word and triple-click selects the name text while editing.
78. **unsure · Linear · Add** — Plain text, rich text, multiline text and a URL can be pasted without losing entered content.
79. **sure · Finder · Sidebar rename** — At field boundaries arrows and Shift+arrows edit/select text without navigating sidebar rows.
80. **sure · Linear · All lists** — Tab traverses actionable controls and Shift+Enter does not unexpectedly submit or open another row.
