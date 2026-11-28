# Commuter friction log

Calendar: Day 1 = 2026-11-27; Day 7 = 2026-12-03. Same WebKit page and IndexedDB throughout. Thinking/reading intervals use setSystemTime, never clock.install. UI timings use performance.now; automation overhead is included.

- Day 1 · Review · Put phone away mid-answer for 20 simulated minutes; same question and exact draft returned. Hidden time audit follows saved rating.
- Day 2 · Review · Later took two thumb taps (Exercise actions, Later); Later tap call 23 ms; no rating expected.
- Day 3 · Review / Close · A 70-second draft survived Leave, ten minutes away and a page reload; completed on the same question. End-ring audit uses saved ratings, including carried draft time.
- Day 4 · Cue · Missed intentionally: no review or reading; clock advanced one day, no review opened.
- Day 6 · Review · Missed AGI-routes at the end of burst 1, then answered five other exercises across two more bursts. The missed exercise never returned that day. Had to read study.ts to learn resumed sessions put retries after all new exercises. First observation; verify again on Day 7.
- Day 7 · Review · Later remains reachable at maximum supported text size: two taps, no sideways scroll.
- Day 7 · Review / Close · Missed rational-agent fact at the end of burst 1. Across bursts 2 and 3, rated six other exercises (and used Later once); retry still did not return before stopping above the daily goal. Second observation of retry placement.

## Reading and audit notes

- Day 1 · Review · Manual phone feedback: typed answer, confidence, Check, two point marks, then Hard. The model answer explained the missing retrieval-induced forgetting point; no automatic grade was implied.
- Day 2 · Review · Second hidden interval was 30 simulated minutes. Exact draft survived and saved elapsed time was 78,606 ms, excluding the absence.
- Day 5 · Read · Five injected reading minutes across the opening and Turing-test sections. Double taps selected three paragraphs: one new highlight, two existing passages reselected/expanded; one existing highlight became a Key point with a note. Reopening retained all changes. This is not two newly created highlight IDs.
- Day 6 · Open · One unconfirmed count discrepancy after a one-hour clock jump while Home stayed visible: picker accessibility text said No skill: 2 ready; four were eligible at the next session start. The actual review included the newly due exercises. Not repeated, and unlike the hidden-phone tests this jump emitted no visibility event; not promoted to a finding.
- Day 7 · Review · Large answers needed vertical scrolling to marks and ratings (known F14). Next-question top returned to scrollTop 0; no horizontal overflow.
- Day 7 · Close · Saved 751,046 ms rounds to 13 minutes; end ring and Home both said 13 of 10. The session continued after the goal and ended only on Leave.

## Measured waits above 100 ms

These are measured completion intervals, not proof of absent first feedback. The full ledger also includes shorter waits.

- Day 1 · Open · Initial library opening: 1364.2 ms to the measured action/state.
- Day 5 · Read · Open AIMA source (tap call): 189.4 ms to the measured action/state.
- Day 1 · Review · Hard: 159.0 ms to the measured action/state.
- Day 1 · Review · Hard to next question: 174.5 ms to the measured action/state.
- Day 2 · Open · Picker to question: 452.2 ms to the measured action/state.
- Day 2 · Open · Picker to question: 441.7 ms to the measured action/state.
- Day 2 · Open · Picker to question: 430.5 ms to the measured action/state.
- Day 3 · Open · Picker to question: 422.8 ms to the measured action/state.
- Day 3 · Open · Picker to question: 430.7 ms to the measured action/state.
- Day 3 · Review · Check: 318.0 ms to the measured action/state.
- Day 3 · Review · Check to self-marking: 341.3 ms to the measured action/state.
- Day 5 · Open · Picker to question: 438.9 ms to the measured action/state.
- Day 6 · Open · Picker to question: 451.6 ms to the measured action/state.
- Day 6 · Open · Picker to question: 421.7 ms to the measured action/state.
- Day 6 · Open · Picker to question: 425.7 ms to the measured action/state.
- Day 7 · Open · Picker to question: 431.1 ms to the measured action/state.
- Day 7 · Open · Picker to question: 447.6 ms to the measured action/state.
- Day 7 · Open · Picker to question: 444.6 ms to the measured action/state.
- Day 7 · Review · Later: 389.2 ms to the measured action/state.
