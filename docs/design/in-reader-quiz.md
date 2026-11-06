# In-reader quiz: science check and decisions

> **Status:** accepted 2026-10-24 and built. Recorded as D52 to D57 in [`DECISIONS.md`](../DECISIONS.md). Sources are from [`research/brief-learning-science.md`](../research/brief-learning-science.md) unless noted.

Tyler's idea: a quiz that opens from a right-edge hover, blurs the source while you answer, then steps through the supporting passages like ⌘F.

## Does it fit the science?

Mostly yes. The idea lines up with the three strongest findings in the brief.

- **Hide the source while answering.** The gain comes from pulling the answer out of memory. Retrieval beats restudy at g = 0.51 (Adesope 2017, k = 118), and the classroom testing effect is g = 0.50 (Yang 2021, k = 222). With the text visible, answering turns into reading. D34.4 already requires the text to be hidden during recalls. The blur has to be strong enough that no word, and no highlight color, can be read through it.
- **Feedback after each answer.** Feedback carries about 30% of the testing benefit: g = 0.54 with feedback and 0.37 without (Yang 2021). For text, feedback can come right away or later (Pan & Carpenter 2023). Errors made with high confidence are the ones fixed most readily after feedback (hypercorrection: Butterfield & Metcalfe), so a confidence tap before Check pays for itself.
- **Show the evidence next to the text it comes from.** Spatial contiguity is g = 0.74 (Mayer). Stepping through the actual passages in place beats a detached model answer. It also stays clear of the "review your highlights" anti-pattern (g = −0.06, D29), because you only see the passages for this one answer, after you have attempted it.

Two things in the idea work against the science, and the design changes them:

1. **A quiz you can open any time from the right edge.** A test straight after reading looks worse at 5 minutes and pays off after 2 or more days (Roediger & Karpicke 2006). So the quiz belongs at the finish, at chapter breaks and in spaced review, not on a hover. A hover also misfires on the right edge, where the scrollbar, the outline (D45) and margin notes (D27) already sit.
2. **Free recall after the questions.** D18 asked the prequestions first, then "anything else you remember?". Once you have seen passages for question 1, a free recall afterwards is partly copied from them. Free recall therefore moves first, before any feedback. This is an inference from the same mechanism, not a tested rule.

## Decisions

- **D52. Quiz panel.** The finish step (D18) and EPUB chapter recalls open as a panel floating at the right of the reader: 392 px wide, 14 px corners, the raised surface and a shadow. The source stays in place on the left but is blurred (about 9 px plus dimming), with highlights, margin notes, the outline and the source note hidden. One quiet chip says "Source hidden while you answer". It opens from Finish (⌘↵) and the chapter marker. There is no hover trigger. Esc closes it and keeps typed answers as a draft. A segmented progress bar shows the steps. No score, no XP (D23).
- **D53. Order and checking.** Step 1 is the free recall. After that, each prequestion gets: your answer, a confidence tap (Guess, Think so, Sure, as in D21) and then **Check**, or **No idea**. Check removes the blur and shows the result for that question only. The next question blurs the source again. The "Where would you use this…" line (D18) closes the quiz.
- **D54. Result for each question.** A short, encouraging verdict line comes first: "You got the core idea", "Partly there" or "Not yet, here's where it is", in green, amber or neutral, never red. Below it are your answer and the question's 2 to 4 key points, each marked got or missed. A confident miss gets one extra line: "You were sure about this one, worth a careful look." Prequestions stay unscored and nothing is recorded to FSRS (D18, D21). The verdict and the marks are AI output, shown only after the attempt (D34.3).
- **D55. Stepping through the passages.** An "In the source" bar, "2 of 3" with up and down arrows, scrolls the reader to each supporting passage, like ⌘G in find. The current passage gets a strong tint and ring, the others a light tint. Clicking a key point jumps to its passage. Keys: Enter or ↓ next passage, ⇧Enter or ↑ previous, ⌘↵ next question. Your own highlights come first when they cover a point, then plain sentences.
- **D56. Where key points and passages come from.** At capture, enrich writes the prequestions and, for each one, 2 to 4 key points and the exact sentences that support each point. These are stored hidden, so Check is instant. The quotes are anchored with the existing anchoring code, and a quote that doesn't anchor is dropped, so an invented citation never shows. After Check, the AI marks which key points your answer covered. You can tap a point to flip got or missed, and that flip is what counts.
- **D57. Not doing:** a quiz on a hover, an "any time" quiz mid-read, a session score or percent correct, sounds or confetti, and showing the source behind a card in review before the answer.
