# Tutor chat parity checklist

Written before opening Ore or reading its UI implementation. Reference behaviors below are an experience-based baseline, not a claim of a fresh audit of those services. Existing Ore decisions/conventions take priority. Every item is to be attempted twice in Chromium and twice in WebKit using real input. A blocked test is untested, not a pass. Existing conventions are regression checks, not proposals; excluded features are not tested.

1. ChatGPT: opening chat from the main/home surface exposes an editable composer.
2. Notion AI: opening contextual chat from a source retains the source context.
3. Notion AI: opening contextual chat from a subject/skill page retains that context.
4. ChatGPT: the chat shortcut opens the chat with the composer focused.
5. Claude: Enter on an empty composer sends nothing.
6. Claude: Enter on a whitespace-only composer sends nothing.
7. ChatGPT: Enter submits a nonempty message exactly once.
8. ChatGPT: Shift+Enter inserts a newline without sending.
9. Claude: typing replaces the selected composer text.
10. Claude: Backspace at the start of the composer leaves preceding conversation intact.
11. Claude: Delete at the end of the composer leaves the conversation intact.
12. ChatGPT: Left/Right at composer boundaries do not navigate away from chat.
13. ChatGPT: Up/Down in multiline input move the caret without changing chat context.
14. Claude: Command+A in the composer selects only the draft.
15. Claude: Command+Z undoes typing inside the draft.
16. Claude: Shift+Command+Z redoes the undone draft edit.
17. ChatGPT: Command+C copies selected composer text.
18. ChatGPT: Command+X removes and copies selected draft text.
19. ChatGPT: Command+V pastes plain text at the caret.
20. Claude: pasting multiline text preserves line breaks without submitting.
21. Claude: pasting a URL preserves the full URL without submitting.
22. ChatGPT: pasting rich text preserves readable text without executing markup.
23. Claude: double-click in the draft selects a word.
24. Claude: triple-click in the draft selects the line/paragraph.
25. ChatGPT: dragging inside the draft selects the traversed text.
26. ChatGPT: dragging inside a reply selects its text.
27. Claude: dragging across adjacent conversation messages selects the intervening text.
28. ChatGPT: right-click selected reply text permits the native Copy action.
29. ChatGPT: copying a reply through its Copy control copies its answer text.
30. ChatGPT: a new send shows an in-progress indication during the wait.
31. ChatGPT: the composer remains editable while a response is pending.
32. ChatGPT: Stop during a pending reply ends that reply and ignores a late result.
33. Claude: the stop keyboard shortcut ends the pending reply.
34. Claude: retrying a stopped empty reply yields one answer without duplicating the user message.
35. ChatGPT: after a response finishes, focus allows the next message to be typed.
36. ChatGPT: second and third messages appear in chronological order with their answers.
37. Claude: a long draft remains editable and its send control remains reachable.
38. ChatGPT: a long thread scrolls while keeping the composer reachable.
39. ChatGPT: scrolling up to read older messages is not overridden by a pending response finishing.
40. Notion AI: a narrow chat keeps its composer and controls within the visible panel.
41. Notion AI: docking/undocking chat preserves the conversation and draft.
42. Notion AI: closing and reopening chat preserves the current conversation and draft.
43. Notion AI: typing @ opens a relevant context picker.
44. Notion AI: typing after @ filters the available contexts.
45. Notion AI: arrow keys move the highlighted mention option, including first/last boundaries.
46. Notion AI: Enter with a mention option selected inserts that option instead of sending.
47. Notion AI: Escape dismisses the mention picker without closing chat or losing the draft.
48. Notion AI: clicking a mention option inserts that context and restores composer focus.
49. Notion AI: a mention query with no matches shows an understandable empty state.
50. ChatGPT: a selected chat mode remains selected for the next message.
51. ChatGPT: Tab and Shift+Tab can reach and operate chat controls with visible focus.
52. Notion AI: clicking a source citation opens the cited source.
53. Notion AI: the response Sources list opens its listed source on a single click.
54. Claude: a response error preserves the user's message and provides a way to recover.
55. ChatGPT: a stopped partial streamed response retains the text already received.
56. ChatGPT: hovering a control with a keyboard shortcut reveals that shortcut (Ore requires Hint, not title).
57. Notion AI: toolbar controls expose informative hover hints (Ore requires Hint, not title).
58. Notion AI: sibling context menu options use consistent icon treatment (Ore requires its dot icons).
59. Notion AI: chat control icons use the host app's consistent icon family (Ore dot set; no emoji or smooth glyphs).
60. Claude: Escape from a chat menu dismisses only that menu and returns focus to its trigger.
