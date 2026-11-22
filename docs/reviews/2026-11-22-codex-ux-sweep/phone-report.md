# iPhone findings — 2026-11-22

Tested commit `9783f33` using the supplied phone app at `http://localhost:1766/` and shared WebKit server. Covered the recent phone changes and two passes through review, reading/highlight/note/Finish, organizing, search and Settings at 390×844 and 375×667, with touch enabled and 2× screenshots. Used one context and one page at a time; fresh independent contexts reset browser storage for reproductions. All library changes went through the UI. Read the working agreements, daily-session document, prior findings, sweep history, iOS checklist and recent commit subjects. Skipped pure taste, listed open issues, native iOS keyboard/selection handles, OS Bold Text observation, haptics, iCloud/device synchronization and real AI. This WebKit browser has no on-screen keyboard: the Explain-field check used Ore's `--keyboard: 300px` layout input and is not native-keyboard verification. No repository source, installed app, real library or other tester's folder/port was changed.

## Findings

### 1. Removing a source from a skill leaves its questions and exercise counts behind

**S2 · iPhone · New trigger; related to F249/F250, not an archive/retire regression.**

1. From a fresh page, open the drawer and select **AI**.
2. Long-press **Building Effective Agents** in To read.
3. Tap **Skills**, then untick **AI**, its only skill.
4. Wait for the “Removed … from AI” confirmation.
5. Observe the skill page, then go Back and reopen AI from the drawer.

**Expected:** The source, its question and the exercise counts all reflect the removal immediately.

**Actual:** To read becomes empty, but Questions still contains “Start with the simplest solution possible” and its Building Effective Agents source. The header retains its old exercise counts. Reopening AI removes that question and the obsolete count strip. A learner sees two different accounts of what is still in this skill until they leave it.

**Reproduced:** 2/2 isolated seed runs, one at each size; also observed during the initial organizing journey when moving the source through Learning.

**Evidence:**

- `codex-out/phone/stale-before-390.png`
- `codex-out/phone/stale-after-390.png`
- `codex-out/phone/stale-reopen-390.png`
- `codex-out/phone/stale-after-375.png`
- `codex-out/phone/stale-reopen-375.png`

**Code:** `apps/desktop/src/phone/PhoneApp.tsx:840` writes `edit --skills` and refreshes the shell lists at line 849. `apps/desktop/src/ore.ts:50` only broadcasts an `edit` change for `--title`, excluding `--skills`. The skill's stats (`SkillPage.tsx:386–399`) and questions (`SkillPage.tsx:619–631`) depend on that broadcast. This is ordinary app state, with no failure hook involved.

### 2. Dismissing Add a link loses the pasted URL

**S2 · iPhone · F449 behavior observed on the phone's separate Add sheet.**

1. From a fresh page, tap **+ / Add a link**.
2. Paste or type `https://example.com/learning-on-the-bus` without submitting it.
3. Tap the dimmed page outside the sheet.
4. Open Add a link again.

**Expected:** Keep the draft so an accidental dismissal or interruption does not require finding and pasting the link again. This matches the Add-draft behavior settled in D342/F449.

**Actual:** The field is empty. There is no draft recovery or Undo. This loses unsaved input, not an already imported source.

**Reproduced:** 2/2, once at 375×667 after a reading journey and once from a fresh 390×844 page. No network request or import is needed.

**Evidence:**

- `codex-out/phone/add-draft-before-375.png`
- `codex-out/phone/add-draft-lost-375.png`
- `codex-out/phone/add-draft-before-390.png`
- `codex-out/phone/add-draft-lost-390.png`

**Code:** `apps/desktop/src/phone/AddLink.tsx:19` keeps the URL only in component state initialized to an empty string. Outside-tap dismissal at line 54 closes it; `apps/desktop/src/phone/PhoneApp.tsx:1266` unmounts it. The Mac's retained Add draft does not cover this component.

### 3. The small-phone end screen opens below its goal message

**S3 · iPhone · 375×667.**

1. From a fresh page at 375×667, set Settings → Minutes a day to **5**.
2. Return to Today and start review with all skills selected.
3. Complete the first two Fact exercises, spending about 2½ minutes on each; select Sure, then Good.
4. When the next Explain exercise appears, tap **Leave review**.
5. Wait for the end animation to settle without scrolling.

**Expected:** The end screen initially shows its earned feedback, including the goal message, with scrolling available for content that does not fit.

**Actual:** The page automatically scrolls 140 pt down. “Goal met. You rock.” is entirely outside the viewport, from y = −51.2 to −16. The mole is clipped too. Scrolling back to the top reveals the message; it was rendered but skipped. Done and Keep going remain usable. At 390×844 the same journey kept the message visible (y = 106.1 to 141.3; scrollTop 1).

**Reproduced:** 2/2 independent 375×667 review journeys. Used `page.clock.fastForward(150000)` per Fact exercise to advance the app's review clock, below its three-minute per-exercise cap. The confirmation run waited ten real seconds after the end screen appeared. No scroll was injected before measuring.

**Evidence:**

- `codex-out/phone/repeat-end-375.png`
- `codex-out/phone/repeat-end-top-375.png` — same first run, explicitly scrolled back to top
- `codex-out/phone/end-auto-scroll-375.png` — second run, animation settled
- `codex-out/phone/end-auto-scroll-375.json` — scroll and message bounds
- `codex-out/phone/end-auto-scroll-390.png` and `.json` — larger-phone comparison

**Code:** `apps/desktop/src/Review.tsx:1934` autofocuses Done without preventing scrolling. The phone layout in `apps/desktop/src/styles.css:3239–3257` exceeds the short viewport: measured content 755 pt inside a 615 pt scroller. Focusing its bottom control moves the feedback above the top.

## Known rows and deliberate exclusions

- **F449:** Its draft-loss behavior is present in iPhone Add a link, as detailed above. The registered row and fix describe the Mac Add box; this run does **not** claim a Mac regression.
- **F249/F250:** The new skill-filing finding has the same stale-page symptom, but those rows cover archive/retire. Their original operations were not found to have regressed.
- **D345 / #491:** No skill in the iPhone drawer and source Importance in phone menus are explicitly listed as **not built** in `docs/DECISIONS.md:784`. Their absence is not reported as a bug. Removing every skill keeps the source accessible through Sources and Search.
- Did not re-report the prompt's excluded open rows or treat the phone's explicit “AI runs on your Mac” fallback as an AI-result failure.

## What passed

- Fact reveal/rating and typed Explain answers completed; manual key-point marking and rating worked without AI.
- Dismissing Explain's action sheet retained its multiline answer.
- A five-minute review returned to Today showing 5 of 5 min and the goal-met state.
- Single taps on plain reader text alternated `.reader.bars-hidden` and `.reader`; controls remained usable.
- Highlight-note changes appeared in Collected; Collected had its title at both sizes.
- Source notes survived navigation and reopening; a refused note save showed an error and retained its words after reopening.
- Finish kept a recall draft across Close/reopen, completed its questions without AI, and moved the source to Done at both sizes.
- The drawer placed ungrouped skills before named collections, consistent with #484.
- Source filing added Learning, removed AI and then removed the last skill; Sources/Search still opened the source.
- Long-press actions opened the source's menu, Rename saved without opening the reader, and archive followed by immediate Undo restored the row at both sizes.
- A refused archive restored the source row and displayed the failure.
- Search Clear emptied the field in place and kept focus; a new search opened the matching source at both sizes.
- Source actions' sheet dismissed with a downward touch-event swipe on the small phone; outside taps dismissed sheets.
- Settings goal/plan changes saved through Back; the new goal reached Today. Duplicate skill names were refused in place, and correcting the name created the skill and opened its page.
- Invalid Add input stayed editable and said to paste a link starting with `https://`.
- CSS Bold Text check: title weight 700→800→700 and body weight 400→600→400. Native Settings-app observation remains untested.

`reproduce-findings.cjs` contains a bounded two-size reproduction for findings 1–2. `end-check.cjs` contains finding 3's review journey. `helpers.cjs` documents the touch-event long-press/swipe emulation; ordinary actions used Playwright taps. `repeat.cjs`, `organize.cjs`, screenshots and JSON records preserve the broader journey checks. Scripts connect to the supplied server and do not launch browsers or servers.
