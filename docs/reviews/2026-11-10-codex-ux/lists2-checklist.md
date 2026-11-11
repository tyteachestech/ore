# Lists and sidebar UX parity checklist

Written before opening Ore or reading UI source. Reference expectations are from prior knowledge, not a live audit of those products. `sure` is confidence in the reference behavior; `unsure` failures are separate observations, never findings.

All source-list checks apply separately to All sources, skill pages, each Home list, and Feed. Sidebar checks distinguish skills and collections. Each reachable check will be repeated twice per engine (Chromium and WebKit). A missing prerequisite must be recorded, never inferred as a successful test. Known held proposals (type-to-find, drag rectangle, sidebar resizing) are excluded. Previously fixed hint/Escape/viewport issues may be verified but not re-reported.

1. **sure — Linear**: One click opens the source shown by a row. Applies: source lists.
2. **sure — Finder**: Down arrow advances focus to the next row. Applies: all lists.
3. **sure — Finder**: Up arrow moves focus to the previous row. Applies: all lists.
4. **sure — Finder**: Up at the first row keeps focus in the list. Applies: all lists.
5. **sure — Finder**: Down at the last row keeps focus in the list. Applies: all lists.
6. **unsure — Linear**: Home moves focus to the first row. Applies: all lists.
7. **unsure — Linear**: End moves focus to the last row. Applies: all lists.
8. **sure — Finder**: Page Down advances the viewport through a long list. Applies: all lists.
9. **sure — Finder**: Page Up returns the viewport toward earlier rows. Applies: all lists.
10. **sure — Linear**: Enter opens a focused source row. Applies: source lists.
11. **unsure — Linear**: Space toggles selection without opening the focused row. Applies: source lists.
12. **sure — Finder**: Shift-click selects a contiguous range. Applies: all lists.
13. **sure — Finder**: Command-click toggles one item in a noncontiguous selection. Applies: all lists.
14. **sure — Finder**: Shift-Down extends a contiguous selection. Applies: all lists.
15. **sure — Finder**: Shift-Up reduces or extends the selection at its active end. Applies: all lists.
16. **sure — Finder**: Command-A selects all items in the focused list. Applies: all lists.
17. **unsure — Linear**: Escape clears a row selection. Applies: all lists.
18. **sure — Finder**: Right-click an unselected row targets that row. Applies: all lists.
19. **sure — Finder**: Right-click a selected row preserves the multi-selection and targets it. Applies: all lists.
20. **sure — Finder**: Right-click blank list space offers actions appropriate to the containing list. Applies: all lists.
21. **sure — Linear**: The row overflow menu and its context menu offer the same row actions. Applies: source lists.
22. **sure — Linear**: Arrow keys move through an open menu. Applies: all lists.
23. **sure — Linear**: Enter activates the focused menu command. Applies: all lists.
24. **sure — Linear**: Clicking outside a menu dismisses it without running a command. Applies: all lists.
25. **sure — Linear**: Delete actions are visually separated from ordinary menu actions. Applies: all lists.
26. **sure — Linear**: Menu actions show their available keyboard shortcuts. Applies: all lists.
27. **sure — Linear**: Sibling menu items use icons consistently (Ore requires dot icons). Applies: all lists.
28. **sure — Finder**: Dragging a source onto a skill visibly identifies the valid destination. Applies: source lists.
29. **sure — Raindrop**: Dropping a source onto a collection files it there. Applies: source lists.
30. **sure — Finder**: Dragging selected sources moves the whole selection to the destination. Applies: source lists.
31. **sure — Finder**: Escape during a drag cancels the move. Applies: source lists.
32. **sure — Finder**: Dropping an item on itself causes no destructive change. Applies: all lists.
33. **unsure — Raindrop**: Dragging sidebar items reorders them. Applies: sidebar.
34. **sure — Finder**: Rename starts with the current name selected for replacement. Applies: renameable rows.
35. **sure — Finder**: Enter commits an in-place rename once. Applies: renameable rows.
36. **sure — Finder**: Escape cancels an in-place rename. Applies: renameable rows.
37. **sure — Finder**: An empty rename is rejected without losing the original item. Applies: renameable rows.
38. **sure — Finder**: Focus remains usable on the renamed item after committing. Applies: renameable rows.
39. **sure — Linear**: Deleting an item removes it and shows recoverable feedback. Applies: all lists.
40. **sure — Finder**: Command-Z restores a just-deleted item. Applies: all lists.
41. **sure — Finder**: Shift-Command-Z repeats the deletion after undo. Applies: all lists.
42. **sure — Finder**: After deletion, focus remains on a surviving neighboring item. Applies: all lists.
43. **sure — Raindrop**: Archiving a source removes it from the active view. Applies: source lists.
44. **sure — Finder**: Copy on selected items produces usable clipboard content. Applies: source lists.
45. **unsure — Raindrop**: Cut and paste can file selected items into another collection. Applies: source lists.
46. **sure — Raindrop**: Changing sort order visibly reorders the list. Applies: source lists.
47. **sure — Raindrop**: The chosen sort order survives opening a source and returning. Applies: source lists.
48. **sure — Raindrop**: Changing a filter limits the visible rows. Applies: source lists.
49. **sure — Raindrop**: A picked filter stays picked after opening a source and returning. Applies: source lists.
50. **sure — Raindrop**: A search with no matches presents a clear empty result state. Applies: searchable lists.
51. **sure — Raindrop**: An empty container offers a useful way to add its first item. Applies: all lists.
52. **sure — Linear**: A loading or refresh operation visibly indicates pending work. Applies: all lists.
53. **sure — Linear**: A failed operation shows an actionable error and keeps existing content usable. Applies: all lists.
54. **unsure — Raindrop**: Stopping an in-progress add leaves a coherent retryable state. Applies: add.
55. **sure — Raindrop**: A very long title does not hide essential row controls. Applies: source lists.
56. **sure — Raindrop**: A source without a thumbnail still has a recognizable usable row. Applies: source lists.
57. **sure — Raindrop**: Video sources remain recognizable when their thumbnails are unavailable. Applies: source lists.
58. **sure — Raindrop**: Rows remain usable with zero assigned categories. Applies: source lists.
59. **sure — Raindrop**: Rows remain usable with many assigned categories. Applies: source lists.
60. **sure — Finder**: Going Back restores the prior list scroll position. Applies: source lists.
61. **sure — Finder**: Going Back retains a useful indication of the item just opened. Applies: source lists.
62. **sure — Linear**: Row controls reveal their function on hover (Ore uses Hint). Applies: source lists.
63. **sure — Linear**: Header controls reveal their function and available shortcut on hover (Ore uses Hint). Applies: all lists.
64. **sure — Linear**: Collapsing the sidebar preserves access to navigation. Applies: sidebar.
65. **sure — Finder**: A short window keeps list actions reachable by scrolling. Applies: all lists; 1280x480.
66. **sure — Raindrop**: A narrow window keeps rows and essential actions reachable. Applies: all lists; 760 wide.
67. **sure — Raindrop**: Opening Add from a container places keyboard focus in the add input. Applies: all lists.
68. **sure — Raindrop**: Closing Add returns focus to a usable initiating control. Applies: all lists.
69. **sure — Raindrop**: Adding from a container preserves that destination. Applies: all lists.
70. **sure — Finder**: Tab reaches visible list controls without trapping focus. Applies: all lists.
71. **unsure — Linear**: Shift-Enter on a row has an intentional alternative to Enter. Applies: source lists.
72. **sure — Finder**: Double-clicking a row does not open duplicate copies. Applies: all lists.
73. **unsure — Raindrop**: Triple-clicking row text does not accidentally run multiple row actions. Applies: source lists.
74. **sure — Finder**: Dragging within an editable title selects text without moving its row. Applies: renameable rows.
75. **sure — Raindrop**: Pasting a URL in Add preserves it and enables the add action. Applies: add.
76. **unsure — Raindrop**: Pasting multiple URLs into Add offers a coherent multi-item import. Applies: add.
77. **sure — Finder**: Command-A inside rename selects only the title text, not list rows. Applies: renameable rows.
78. **sure — Finder**: Undo inside an active rename edits the text rather than undoing a prior library change. Applies: renameable rows.
79. **unsure — Linear**: A list can be reordered by dragging one row between two others. Applies: source lists.
80. **sure — Linear**: An active filter can be cleared to recover the complete list. Applies: source lists.
