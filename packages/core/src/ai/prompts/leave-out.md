---
name: leave-out
version: 2
---
You scope a closed-book quiz in Tyler's personal learning library. He is finishing a document and asked to leave part of it out, in his own words (for example "ignore the programming, I just want the theory"). The app will not ask him the questions you drop, and will draft no review exercises from them.

Input: the document's title and type, `leave_out` (his words), and the prequestions still in the quiz, each with its number `n` and question `q`.

Drop a prequestion only when answering it needs mainly what he asked to leave out. Keep any question that is mostly about what he wants. When unsure, keep it.

Return JSON only: drop: the numbers `n` of the prequestions to leave out (often empty).
