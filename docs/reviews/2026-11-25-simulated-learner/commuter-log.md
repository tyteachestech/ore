# Commuter friction log

- Day 1: Step 3 Review: Start review took two taps (Today then What to review); the second tap took 244 ms. First No idea revealed answer in 59 ms.
- Day 1: Step 3: Checking the typed Explain answer took 55 ms and fell back to manual marking; phone says checking runs on Mac. Four key-point taps replace the Mac check. Its ratings and fallback message start below the screen (known F14). The two API exercises have no passage; their files are from notes, with no evidence links.
- Day 1: Step 3: first missed exercise returned as Exercise 5 after three intervening exercises; corrected rating saved. Step 5: goal did not force an exit; Leave review opened the end screen.
- Day 2: Step 3 interruption: leaving for a source after three ratings and returning took four review-navigation taps and resumed the same exercise. Two simulated 1-hour backgrounds kept the exercise and typed draft. Checking stored elapsed_ms for whether absence inflated the ring.
- Day 3: Step 6: first source tap 142 ms on day 1; PDF warns that formulas/tables require Mac. Double tap after scroll settles saved both highlights; note verified in annotations.
- Day 3: Step 6 Finish: four quiz questions saved, but all say Not checked here; Q2 No idea also shows no model answer or relevant passage (2+ confirmations). Search for parallelization found the source and the new highlight and opened Find on the word. Adding the link showed Reading then a connection failure and Mac retry; pasted text added and opened in 483 ms.
- Day 4: Step 3 at 375x667: Settings has no text-size option; set reader Aa to its maximum (3 taps), then emulated iOS Larger Text with the repo test scale 28/17. Five Explain exercises remained scrollable and ratings worked; long prompts and answers require multiple screens (F14). No horizontal overflow in the settled review (375/375).
- Day 5: Step 2 after missed day: Today returned to zero with Start review, no overdue count or guilt language. Step 3/5: seven ratings reached the 10-minute goal; continued exercise remained available and Leave review opened the end screen.
- Day 5: Verification: repeated the background test with visibilitychange bubbling to window listeners twice. The rating still included the absence. Undid both probe ratings. The main five-day totals are the 30 ratings in final-db.json.

## Validation additions

- Day 2 · Review: saved data confirms 3,616,355 and 3,610,482 ms on the two background exercises, each credited at 180,000 ms. The ring overstates foreground exercise time by 333,163 ms.
- Day 3 · Read/Finish: had to inspect Finish.tsx to distinguish an unavailable phone check from missing stored key points; the source has questions only. The screen should offer a way back to the relevant material after an attempted answer.
- Day 4 · Open/Review: had to inspect the existing phone e2e test to emulate native Larger Text; Settings itself provides no text-size row. This is test-environment setup, not proof of a native UI failure.
- All days · Review: see exercise-audit.md for every rated id, elapsed time, next due, and captured viewport/passage condition. No raw Markdown found in the exercises inspected.

## Measured pauses over 100 ms

These include automation settling time; absence of immediate touch feedback is not inferred from them. Two separately labelled touchstart measurements directly measure press-to-question. Full timing list is in report.md.

- Day 1 · Open · initial usable: 1371 ms (call-to-completion, includes settling), 2026-11-25T14:25:41.800Z.
- Day 1 · Review/close · [role="dialog"] button:has-text("Start review"): 244 ms (call-to-completion, includes settling), 2026-11-25T14:26:19.176Z.
- Day 1 · Review/close · No idea: 232 ms (call-to-completion, includes settling), 2026-11-25T14:27:51.348Z.
- Day 1 · Review/close · .review :text-is("Sure"): 232 ms (call-to-completion, includes settling), 2026-11-25T14:28:15.994Z.
- Day 1 · Review/close · .review :text-is("Sure"): 226 ms (call-to-completion, includes settling), 2026-11-25T14:29:22.219Z.
- Day 1 · Review/close · .review :text-is("Sure"): 259 ms (call-to-completion, includes settling), 2026-11-25T14:29:27.370Z.
- Day 1 · Review/close · Check: 101 ms (call-to-completion, includes settling), 2026-11-25T14:29:27.472Z.
- Day 1 · Review/close · Attention Is All You Need: 142 ms (call-to-completion, includes settling), 2026-11-25T14:29:37.728Z.
- Day 2 · Review/close · Start review: 386 ms (call-to-completion, includes settling), 2026-11-25T14:30:45.166Z.
- Day 2 · Review/close · [role="dialog"] button:has-text("Start review"): 552 ms (call-to-completion, includes settling), 2026-11-25T14:30:45.718Z.
- Day 2 · Review/close · .review :text-is("Sure"): 372 ms (call-to-completion, includes settling), 2026-11-25T14:30:46.138Z.
- Day 2 · Review/close · .review :text-is("Sure"): 241 ms (call-to-completion, includes settling), 2026-11-25T14:30:46.653Z.
- Day 2 · Review/close · .review :text-is("Sure"): 229 ms (call-to-completion, includes settling), 2026-11-25T14:30:47.169Z.
- Day 2 · Review/close · Done: 404 ms (call-to-completion, includes settling), 2026-11-25T14:31:04.455Z.
- Day 2 · Review/close · Attention Is All You Need: 121 ms (call-to-completion, includes settling), 2026-11-25T14:31:04.576Z.
- Day 2 · Read/capture/navigation · Back: 365 ms (call-to-completion, includes settling), 2026-11-25T14:31:04.950Z.
- Day 2 · Review/close · Start review: 374 ms (call-to-completion, includes settling), 2026-11-25T14:31:05.325Z.
- Day 2 · Review/close · [role="dialog"] button:has-text("Start review"): 531 ms (call-to-completion, includes settling), 2026-11-25T14:31:05.857Z.
- Day 2 · Review/close · .review :text-is("Sure"): 368 ms (call-to-completion, includes settling), 2026-11-25T14:31:06.244Z.
- Day 2 · Review/close · .review :text-is("Sure"): 234 ms (call-to-completion, includes settling), 2026-11-25T14:31:06.586Z.
- Day 2 · Review/close · .review :text-is("Sure"): 237 ms (call-to-completion, includes settling), 2026-11-25T14:31:07.086Z.
- Day 3 · Review/close · Attention Is All You Need: 113 ms (call-to-completion, includes settling), 2026-11-25T14:31:46.502Z.
- Day 3 · Read/capture/navigation · Next question: 229 ms (call-to-completion, includes settling), 2026-11-25T14:33:28.935Z.
- Day 3 · Read/capture/navigation · search usable: 192 ms (call-to-completion, includes settling), 2026-11-25T14:34:10.376Z.
- Day 3 · Read/capture/navigation · search hit open: 299 ms (call-to-completion, includes settling), 2026-11-25T14:34:17.283Z.
- Day 3 · Read/capture/navigation · Add a source: 374 ms (call-to-completion, includes settling), 2026-11-25T14:34:17.794Z.
- Day 3 · Read/capture/navigation · Add: 483 ms (call-to-completion, includes settling), 2026-11-25T14:34:31.982Z.
- Day 3 · Review/close · pasted text result: 551 ms (call-to-completion, includes settling), 2026-11-25T14:34:32.050Z.
- Day 4 · Review/close · Open menu: 384 ms (call-to-completion, includes settling), 2026-11-25T14:34:42.502Z.
- Day 4 · Review/close · Settings: 373 ms (call-to-completion, includes settling), 2026-11-25T14:34:42.875Z.
- Day 4 · Review/close · Attention on the commute: 428 ms (call-to-completion, includes settling), 2026-11-25T14:34:57.318Z.
- Day 4 · Review/close · Text and page: 373 ms (call-to-completion, includes settling), 2026-11-25T14:34:57.692Z.
- Day 4 · Read/capture/navigation · Back: 218 ms (call-to-completion, includes settling), 2026-11-25T14:35:12.274Z.
- Day 4 · Review/close · Start review: 380 ms (call-to-completion, includes settling), 2026-11-25T14:35:12.654Z.
- Day 4 · Review/close · [role="dialog"] button:has-text("Start review"): 598 ms (call-to-completion, includes settling), 2026-11-25T14:35:13.253Z.
- Day 4 · Review/close · .review :text-is("Sure"): 251 ms (call-to-completion, includes settling), 2026-11-25T14:35:13.575Z.
- Day 4 · Review/close · .review :text-is("Sure"): 248 ms (call-to-completion, includes settling), 2026-11-25T14:35:14.094Z.
- Day 4 · Review/close · .review :text-is("Sure"): 250 ms (call-to-completion, includes settling), 2026-11-25T14:35:14.642Z.
- Day 4 · Review/close · .review :text-is("Sure"): 257 ms (call-to-completion, includes settling), 2026-11-25T14:35:37.467Z.
- Day 5 · Review/close · [role="dialog"] button:has-text("Start review"): 524 ms (call-to-completion, includes settling), 2026-11-25T14:35:46.964Z.
- Day 5 · Review/close · .review :text-is("Sure"): 379 ms (call-to-completion, includes settling), 2026-11-25T14:35:47.371Z.
- Day 5 · Review/close · .review :text-is("Sure"): 230 ms (call-to-completion, includes settling), 2026-11-25T14:35:47.883Z.
- Day 5 · Review/close · .review :text-is("Sure"): 228 ms (call-to-completion, includes settling), 2026-11-25T14:35:48.399Z.
- Day 5 · Review/close · .review :text-is("Sure"): 227 ms (call-to-completion, includes settling), 2026-11-25T14:36:07.349Z.
- Day 5 · Review/close · .review :text-is("Sure"): 233 ms (call-to-completion, includes settling), 2026-11-25T14:36:07.852Z.
- Day 5 · Review/close · .review :text-is("Sure"): 255 ms (call-to-completion, includes settling), 2026-11-25T14:36:08.379Z.
- Day 5 · Review/close · [role="dialog"] button:has-text("Start review"): 541 ms (call-to-completion, includes settling), 2026-11-25T14:37:52.794Z.
- Day 5 · Review/close · actual touchstart to question ready: 224 ms (touchstart to question), 2026-11-25T14:37:52.836Z.
- Day 5 · Review/close · Leave review: 278 ms (call-to-completion, includes settling), 2026-11-25T14:37:53.194Z.
- Day 5 · Review/close · [role="dialog"] button:has-text("Start review"): 535 ms (call-to-completion, includes settling), 2026-11-25T14:38:00.410Z.
- Day 5 · Review/close · actual touchstart to question ready repeat: 181 ms (touchstart to question), 2026-11-25T14:38:00.429Z.
- Day 5 · Review/close · Leave review: 391 ms (call-to-completion, includes settling), 2026-11-25T14:38:00.819Z.
- Day 5 · Review/close · [role="dialog"] button:has-text("Start review"): 601 ms (call-to-completion, includes settling), 2026-11-25T14:39:18.256Z.
- Day 5 · Review/close · .review :text-is("Sure"): 363 ms (call-to-completion, includes settling), 2026-11-25T14:39:18.650Z.
