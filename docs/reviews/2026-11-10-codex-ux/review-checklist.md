# Review UX reference checklist

Written before opening Ore or reading its UI source. Reference confidence is prior knowledge, not a claim of live reference verification. Compact window items compare ordinary Anki review behavior applied to Ore’s quick quiz; Anki does not have Ore’s exact quick quiz. At most eight items focus on browser text editing (11–13, 34–35, 37, 39–40). Exclusions will be recorded after reading the existing tests and decisions.

1. **sure — Anki:** The study picker can be operated with Tab and Enter without a pointer.
2. **unsure — Mochi:** Esc dismisses the study picker and returns focus to its launch control.
3. **unsure — Mochi:** A selected study scope survives cancelling and reopening the picker.
4. **sure — Anki:** A picker with many choices keeps the start action reachable in a short window.
5. **sure — Anki:** Space reveals the answer when no editable field or menu has focus.
6. **sure — Anki:** Enter reveals the answer when no editable field or menu has focus.
7. **sure — Anki:** Rating keys do not rate an exercise while its answer is hidden.
8. **sure — Anki:** Each available rating key selects its corresponding rating after reveal.
9. **sure — Anki:** Space after reveal invokes the default positive rating.
10. **sure — Anki:** Enter after reveal invokes the default positive rating.
11. **sure — Anki:** Typing a rating digit in an answer field does not submit a rating.
12. **sure — Anki:** Space inside an answer field inserts a space without revealing the answer.
13. **unsure — Mochi:** Shift+Enter in a multiline answer inserts a newline without submitting.
14. **sure — Anki:** An open menu takes keyboard priority over review shortcuts.
15. **sure — Anki:** Esc closes an open review menu without leaving the session.
16. **sure — Anki:** Review shortcuts do not fire inside the exercise editor.
17. **sure — Anki:** After closing the editor, the same exercise remains available for review.
18. **sure — Anki:** Editing an exercise offers an explicit save and cancel path.
19. **sure — Anki:** An edit made during review appears in the current exercise after saving.
20. **sure — Anki:** A retirement or suspend action removes the current exercise from active review.
21. **sure — Anki:** A bury or skip equivalent postpones the current exercise without grading it.
22. **sure — Anki:** Undo of a rating returns to the exercise that was just rated.
23. **unsure — Anki:** Redo after undo reapplies the rating and advances once.
24. **sure — Anki:** Undo remains available after the last exercise is rated.
25. **unsure — Anki:** Redo after an end-screen undo restores the completed state.
26. **sure — Anki:** Undo while editing text affects that text rather than an earlier rating.
27. **sure — Anki:** After advancing with the pointer, keyboard reveal works on the next exercise.
28. **sure — Anki:** A rapid repeated activation cannot rate an unseen next exercise.
29. **unsure — Mochi:** Leaving and returning to review retains the current unsubmitted answer.
30. **sure — Anki:** An empty due queue offers a clear route back out.
31. **sure — Anki:** Long question and answer content can be scrolled to the end.
32. **sure — Anki:** Answer and rating actions remain reachable at 1280 by 480.
33. **sure — Mochi:** Review controls remain reachable at 760 pixels wide.
34. **sure — Anki:** Double-click selects a word in rendered exercise text.
35. **sure — Anki:** Triple-click selects a paragraph in rendered exercise text.
36. **sure — Anki:** Pointer drag can select text across paragraphs of an answer.
37. **sure — Anki:** Selected rendered exercise text can be copied.
38. **sure — Anki:** Right-click offers a copy route for selected exercise text.
39. **sure — Anki:** Plain, multiline, rich text and URL paste into an answer field remain editable text.
40. **sure — Anki:** Answer-field select-all, cut, undo and redo preserve the intended text.
41. **sure — Anki:** Keyboard focus on review actions is visible and Tab reaches every available action.
42. **sure — Anki:** Controls with keyboard shortcuts expose their bindings on hover; Ore uses Hint, not title.
43. **unsure — Mochi:** Every icon-only toolbar control explains its action on hover; Ore uses Hint.
44. **unsure — Mochi:** Menus use icons consistently among sibling actions; Ore uses its dot icon set.
45. **sure — Anki:** A failed save or rating leaves a visible error and a usable retry path.
46. **sure — Anki:** While a rating is pending, repeated activation cannot submit duplicate ratings.
47. **unsure — Mochi:** During delayed feedback, a pending state is visible and controls cannot submit twice.
48. **unsure — Mochi:** A stopped or failed feedback request leaves the answer and manual rating usable.
49. **sure — Anki:** In the compact review window, reveal and rating keys work through a full exercise.
50. **sure — Anki:** Compact-window review shortcuts are suppressed while its menu is open.
51. **sure — Anki:** Compact-window actions remain reachable in a 480-pixel-tall window.
52. **sure — Anki:** Compact-window undo brings back the just-rated exercise.
53. **unsure — Anki:** Compact-window redo reapplies an undone rating.
54. **sure — Anki:** Compact-window errors leave a way to retry or leave.
55. **sure — Anki:** The compact review window can be dismissed with Esc without grading an exercise.
56. **unsure — Mochi:** Closing and reopening compact review returns focus to a usable review control.
