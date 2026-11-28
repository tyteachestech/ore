# Phone friction log

Only observed learner friction is logged. Automation timeouts are excluded from product waits.

- Day 1 · 7 Read / add: The MDN Internet article could not be reached in browser WebKit; Coming in says Check your connection and try again. Your Mac will try it. No article to read while away. Network/browser limitation, not yet a product finding.
- Day 2 · 7 Read / add: YouTube link saved as a named source, but transcript waits for Mac. Browser player says it could not start and offers YouTube. Cannot study transcript phone-only this week; native player is outside this harness.
- Day 3 · 7 Read / search: At largest text (28/17), searching Phone week produced three identically truncated Chapter 1 rows. The source/key point/source note suffixes and matching words were off the visible single lines; I had to choose the third row without being able to read its type. Screenshot day3-search-large.png.
- Day 3 · 7 Read / search: Repeated after review: the same three indistinguishable Chapter 1 results recur at largest text. Two separate search openings.
- Day 6 · 7 Read / Finish: After writing recall for How the web works, all 3 quiz questions wait on the Mac. Recall is saved and article remains To read. Clear limitation, F738 behavior held; phone-only finish cannot complete the quiz.

## Measured completion waits

These bounds include automation actionability and animation waits. First visible feedback was not separately instrumented, so they do not establish a silent wait or a 100 ms feedback violation. Counts and full measurements are in timings.jsonl; no test timeout is a product wait.

- Day 1 · 2 Open: Initial launch; measured completion 1113.5 ms (press/action 285.3 ms). Visible-feedback onset unmeasured.
- Day 1 · 3 Review: Picker to review; measured completion 126.3 ms (press/action 114.3 ms). Visible-feedback onset unmeasured.
- Day 1 · 3 Review: Done; measured completion 444.1 ms (press/action 444.1 ms). Visible-feedback onset unmeasured.
- Day 1 · 7 Read / navigate: (Chapter 1) Artificial Intelligence: A Modern Approach (4th edition); measured completion 169.6 ms (press/action 169.6 ms). Visible-feedback onset unmeasured.
- Day 1 · 7 Read / navigate: Add a source; measured completion 403.1 ms (press/action 403.1 ms). Visible-feedback onset unmeasured.
- Day 1 · 7 Read / navigate: Add; measured completion 124.8 ms (press/action 124.8 ms). Visible-feedback onset unmeasured.
- Day 2 · 2 Open: Next day reload; measured completion 1275.4 ms (press/action 234.9 ms). Visible-feedback onset unmeasured.
- Day 2 · 7 Read / navigate: Add neural network video; measured completion 415.9 ms (press/action 412.1 ms). Visible-feedback onset unmeasured.
- Day 2 · 7 Read / navigate: But what is a neural network? | Deep learning chapter 1; measured completion 114.2 ms (press/action 114.2 ms). Visible-feedback onset unmeasured.
- Day 2 · 3 Review: Start review; measured completion 365.1 ms (press/action 365.1 ms). Visible-feedback onset unmeasured.
- Day 2 · 7 Read / navigate: (Chapter 1) Artificial Intelligence: A Modern Approach (4th edition); measured completion 164.5 ms (press/action 164.5 ms). Visible-feedback onset unmeasured.
- Day 2 · 7 Read / navigate: Note; measured completion 340.8 ms (press/action 340.8 ms). Visible-feedback onset unmeasured.
- Day 2 · 7 Read / navigate: Open menu; measured completion 376.3 ms (press/action 376.3 ms). Visible-feedback onset unmeasured.
- Day 3 · 2 Open: Next day reload; measured completion 1177.3 ms (press/action 168.6 ms). Visible-feedback onset unmeasured.
- Day 3 · 7 Read / navigate: Open source note search result; measured completion 152.2 ms (press/action 152.2 ms). Visible-feedback onset unmeasured.
- Day 3 · 3 Review: Start review; measured completion 376.2 ms (press/action 376.2 ms). Visible-feedback onset unmeasured.
- Day 4 · 2 Open: Next day reload; measured completion 1152.1 ms (press/action 157.6 ms). Visible-feedback onset unmeasured.
- Day 4 · 3 Review: Start review; measured completion 372.7 ms (press/action 372.7 ms). Visible-feedback onset unmeasured.
- Day 5 · 2 Open: Next day light reload; measured completion 1185.6 ms (press/action 160.8 ms). Visible-feedback onset unmeasured.
- Day 5 · 7 Read / navigate: (Chapter 1) Artificial Intelligence: A Modern Approach (4th edition); measured completion 164.8 ms (press/action 164.8 ms). Visible-feedback onset unmeasured.
- Day 5 · 7 Read / navigate: Note; measured completion 262.8 ms (press/action 262.8 ms). Visible-feedback onset unmeasured.
- Day 5 · 3 Review: Start review; measured completion 393.0 ms (press/action 393.0 ms). Visible-feedback onset unmeasured.
- Day 5 · 3 Review: Rate Good; measured completion 106.9 ms (press/action 83.2 ms). Visible-feedback onset unmeasured.
- Day 5 · 7 Read / navigate: (Chapter 1) Artificial Intelligence: A Modern Approach (4th edition); measured completion 106.5 ms (press/action 106.5 ms). Visible-feedback onset unmeasured.
- Day 6 · 2 Open: Next day reload; measured completion 1255.0 ms (press/action 205.9 ms). Visible-feedback onset unmeasured.
- Day 6 · 7 Read / navigate: Open web article; measured completion 152.8 ms (press/action 148.9 ms). Visible-feedback onset unmeasured.
- Day 6 · 7 Read / navigate: Open menu; measured completion 376.9 ms (press/action 376.9 ms). Visible-feedback onset unmeasured.
- Day 7 · 2 Open: Next day reload; measured completion 1133.8 ms (press/action 132.7 ms). Visible-feedback onset unmeasured.
- Day 7 · 7 Read / navigate: Open menu; measured completion 389.2 ms (press/action 389.2 ms). Visible-feedback onset unmeasured.
- Day 7 · 2 Open: Relaunch in new page same context; measured completion 292.7 ms (press/action 248.5 ms). Visible-feedback onset unmeasured.
- Day 7 · 7 Read / navigate: Search; measured completion 397.1 ms (press/action 397.1 ms). Visible-feedback onset unmeasured.

## Clarifications from the saved-data audit

- Day 1: AIMA paragraph selection updated an existing highlight; Key point and its note saved. The initial source-note typing attempt had no verified editor focus and saved no prose; it is excluded as an automation error, not lost learner data. The source note was actually written and verified on Day 2, edited Day 5, and retained after Day 7 relaunch.
- Day 5: reader explicitly set to Light with Aa; the rest of the app is held dark by design. Browser light preference alone did not change the reader, so this is not a native automatic-appearance check.
- Day 6: intentionally reading-only, zero ratings; one genuinely new highlight and a saved free recall.
- Day 7: third large-text search reproduction after closing/reopening the page. Source note and Key point type labels still clipped. Source note, skill note, daily cue, video stub and queued article all persisted.
- Day 7: a 31 pt visual switch looked suspect, but touch 4 pt outside its visible edge toggled it twice. This is not a target-size finding; geometry alone would have been misleading.
