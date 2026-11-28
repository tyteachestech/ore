# Keyboard learner — friction log

Three consecutive local days: November 28–30, 2026, starting at 08:00. Mac release page in shared WebKit; keyboard input only. Findings are grouped in [report.md](report.md). Focus/role snapshots accompany screenshots. All measured waits, including routine fast actions, are sorted in [felt-slow.md](felt-slow.md).

## Day 1 — learn how the web works

- Open — Home became usable in 328 ms after a warm load (cold bootstrap: 1,602 ms), but focus was BODY, with no current control. Enter still opened Start review. **K4**.
- Review — explaining retrieval-prompt consistency reached rating controls in 34 ms while AI was still checking. This measured acknowledgment, not completed grading; the first grading wait was not validly measured. The visible checking message avoided a silent wait.
- Review — Later and Undo restored the API question and answer. After rating and undoing that rating, my next “3” went into the restored answer field. This was my incorrect attempted re-rating, not a saved rating or an app defect; the file audit records only one effective rating for Day 1.
- Read — Command-K to “How the web works” took 232 ms until the reader held focus. Arrow/Shift-arrow, H, 2 and Tab made a Key point and note without a pointer. The visual passage box was useful; its missing accessible state was isolated twice on Day 3 (**K1**).
- Read — Escape in the source-note editor first selected a block; a second Escape left editing. This follows the documented editor behavior, but I consulted shortcut/code behavior to distinguish “leave the note” from “leave the source”; the screen should make editing versus block-selection state clear. No separate finding.
- Read/Finish — the first Finish covered only the section reached. I waited for a quiz answer field that could not appear because that scope had no questions. The partial-scope label and Keep reading were present. Three Option-Tab presses reached Keep reading. The harness's 120-second timeout is excluded from learner waits.
- Read/Finish — key-point generation took 32.631 s; recall feedback took 15.501 s. Working text remained visible. I continued reading, then finished with three quiz answers.
- Read/Finish — checking those answers took 6.321 s, 6.936 s and 5.665 s on the bridge. The checking screen appeared in 189/184 ms for the first two; those short times are not finished feedback. Drafting exercises continued for 56.083 s in the background.
- Read/Tutor — asking how DNS differs from HTTP took 16.217 s on the bridge (16.382 s page-observed upper bound). Working state was shown. A named citation opened its source by keyboard in 214 ms.
- Read/Tutor — reverse tabbing to Add exercise and pressing Enter saved it, then left focus on BODY when the button became disabled. No keyboard location remained in the tutor. **K3**, first occurrence; [screenshot](d1-kept-exercise.png).
- Add — submitting an RSS URL through ordinary Add showed a refusal with a Follow option. Ten forward Option-Tab presses alternated through the skill picker and Add field rather than reaching Follow; eight plain Tab presses stayed in the picker. I backed out and used Feed's Follow. Reverse traversal was not exhausted, so this remains observed friction rather than a confirmed inaccessible control.
- Add/Feed — following from the empty Feed succeeded, but removed the opener and left focus on BODY. ArrowDown and Enter did not operate the new posts. Home then Feed restored list navigation. Undo and following again reproduced the same loss: **K2**, 2/2; [first](d1-followed.png), [repeat](d1-follow-focus-repeat.png).
- Add/Feed — opening a selected podcast still showed Opening after ten seconds; the request ultimately took 28.475 s. I navigated away rather than waiting to read the whole podcast. This was visible waiting, not a blank screen.
- Close — the receipt counted one memory kept and +11 days, consistent with the single remaining rating; active review time was 33,631 ms. No second rating survived Undo.

## Day 2 — recall DNS/HTTP and add one small source

- Open — after moving forward to the next day, Home took 231 ms and again left focus on BODY. The day's time reset to zero. **K4**, second daily occurrence.
- Review — I deliberately missed API, left Review, then restarted. It returned after three intervening exercises, so the retry fix held. Artificial thinking intervals tested credit accounting; two answers were capped at three minutes each.
- Review — Explain grading took 6.867 s to visible feedback (6.504 s backend). Ask about this took 6.882 s to its reply (6.400 s backend). Both showed working states. Escape closed the follow-up panel one step, allowing rating afterward.
- Close — receipts counted zero kept for the initial Again and four kept for the restarted session. Home and the end screen showed 9 minutes for 553,484 ms (9:13.484), with the ten-minute goal still unmet.
- Read — the previous Key point and source note reopened intact. An injected notes-command failure showed an alert and kept the new text. After clearing the failure, leaving the source saved the added sentence. This interruption cost a retry but lost no text; [failure state](d2-note-failure.png).
- Read/Tutor — requesting two tell-apart cases took 23.045 s on the page (22.628 s backend). Four reverse Option-Tabs from the composer reached Case A; Tab reached Case B. Filling both enabled Send, and Enter in B submitted them.
- Read/Tutor — feedback took 21.036 s on the page (20.864 s backend). It once included an unrelated sentence about an excerpt asking to save a file. I did not act on it; it was not reproduced and is not a finding.
- Read/Tutor — a second, distinct proposed exercise saved from its keyboard-focused button again left BODY focused, still there after 500 ms. **K3**, 2/2 across days; [screenshot](d2-kept-focus-lost.png).
- Add — checking the earlier Add detour showed Escape closes just the skill picker, as expected. I then captured “Keyboard day 2: HTTP 404 means missing content.” by keys, assigned its skill, made a Key point and finished it. Background exercise drafting took 31.119 s and did not block reading.
- Read/Feed — Enter opened the coding-data article; a highlight and note retained it as a source. Settings opened and closed by shortcut; the tested Tab traversal stayed in Settings.

## Day 3 — retrieve yesterday's source and learn spacing

- Open — Home took 238 ms after the next-day reload and again had BODY focus: **K4**, 3/3 daily loads. Newly drafted HTTP exercises were available; previously reviewed exercises were not yet due.
- Review — the first HTTP Explain took 15.480 s to grading (15.005 s backend), with checking text. The second question survived Later/Undo. I typed an answer, interrupted Review and went reading.
- Read — in “Spaced repetition,” ArrowDown then Shift-ArrowDown visibly widened the passage box, but the accessibility tree stayed unchanged. Native selection was empty, the focused reader had no name or active descendant, and no live message identified the chosen passage. I had to inspect Reader/Focus code to establish what H would mark. The app should expose the passage and selection extent. **K1**, first reproduction; [before extension](d3-reader-key-focus1.png), [after](d3-reader-key-focus2.png).
- Read/Finish — after the source note and reading, Finish displayed Finding the key points for a 55.565-second request. Quiz checking took 5.026 s. The source finished and drafting ran another 36.782 s in the background.
- Read — repeated the accessible-selection check in “How the web works”: same role tree before/after, empty native selection, no active descendant, no current-passage announcement. **K1**, 2/2 sources; [screenshot](d3-reader-key-repeat.png), [state](d3-reader-aria-repeat.json).
- Read/Close — one Escape cleared passage focus and the next left the palette-opened reader; Home still had BODY focus after 500 ms. **K4** also affects this return path; [screenshot](d3-home-after-reader.png).
- Review — the interrupted HTTP answer resumed verbatim. Grading took 12.975 s on the page (12.783 s backend), then I rated it Good. Two effective Day 3 ratings contributed 92,728 ms; the final end screen showed one minute for the day.
- Close — saved tutor chat reopened by keyboard with its cases and kept-exercise marker. Feed mark-read/Undo and Control-Enter's context menu worked; Escape returned to the list. Returning Home left BODY focused again. The owned page/context were closed after the final file snapshot.

## Measurement limits

No timed key-handler dispatch exceeded 100 ms; that does not prove every visual acknowledgment painted within 100 ms. No confirmed blank wait over one second was isolated. Several AI waits were long but visibly explained. Reading and recovery wall time was not continuously metered, and tool orchestration would inflate it, so those minutes remain unmeasured. Forced clock advances exercised the review counter without freezing real AI timers. Screenshot/inspection time, incorrect automation readiness assumptions and harness timeouts are not counted as learner time.
