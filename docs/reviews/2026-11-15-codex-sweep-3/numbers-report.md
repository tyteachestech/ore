# Numbers sweep

Tested the supplied WebKit Mac page (1704/1705) and touch iPhone page (1706), using only the supplied server. Read the preamble, working agreement, known findings, D21–D24, D60–D65, D90, D144, D157, D176, D204, D236, D246, D249, D252, D274 and D279. Independently parsed Markdown/YAML/review logs, replayed reviews with `ts-fsrs`, compared counts, queue order, skill strength, minutes, receipts and all four next-rating predictions, and exercised Good, Again, undo, retirement and source skill reassignment. **Three confirmed S2 findings** follow. No product source files or findings register were changed. Skipped pure visual polish, All sources filters, real AI grading, native macOS/iOS behavior and sync transport. Timing used controlled browser dates rather than five-minute wall-clock waits. See the harness caveat at the end before reusing the Mac scratch library.

## Findings

### N1 — Retiring an exercise removes an earned skill level

**S2 · Mac and iPhone · new finding**

1. On a fresh copy of the supplied seed, open Stoicism. Its header shows **5 cut gems, Lv 1**.
2. Start review, select only Stoicism, and start. Put off the first two exercises with Later.
3. On **“What's a common mistake with amor fati?”** (`01M7EPHKN1M4RT7H6BT425VPTX`), choose Retire exercise. On Mac reveal the answer first; on iPhone use Exercise actions.
4. Leave Review and reopen the Stoicism page. If it was already open underneath Review, navigate away and back to avoid N3.
5. Observe **4 cut gems, Lv 0**.

**Expected:** Removing the retired exercise from current strength is correct, but the earned level must stay 1. D63 explicitly derives level from the most solid memories the skill ever had, so it never drops.

**Actual:** Retirement removes the exercise from the historical peak calculation as well as the current inventory: `peak 5 → 4`, `level 1 → 0`. The ring changes back to working toward level 1. Reviews were not deleted.

**Reproduction:** 2/2 independent journeys, one Mac and one iPhone. Also observed with Creativity on Mac after earning level 1 and retiring another solid exercise.

**Evidence:** `stoicism-before.png`, `stoicism-retire-target.png`, `stoicism-level-fell-2.png`, `phone-stoicism-before.png`, `phone-retire-target.png`, `phone-retired-level.png`, `retired-today.json`. All paths are under `codex-out/numbers/`.

**Suspected cause:** `packages/core/src/today.ts:74` excludes retired exercises before building the IDs used for the historical peak (`:83–98`). Current inventory and historical achievement need different eligibility rules.

### N2 — “One good answer from cut” undercounts an overdue backlog

**S2 · Mac and iPhone · new finding**

1. From the original seed, open Start review. Creativity shows **6 exercises ready** to accessibility tools, but no nearly-cut gem. Its Home tile and skill header likewise show no nearly-cut count.
2. Select only Creativity and start.
3. Answer **“Give an example of incubation?”** (`01M7EPHKMGYCF4V2E35C94YVJX`) with Sure, then Good.
4. End the session. The result awards a cut gem and Creativity level 1, despite advertising no exercise one Good from cut.
5. Independently replay that exercise and **“What is the key idea behind launch checklists?”** (`01M7EPHKMAEE983CGW3VCXK60T`) at the current date.

**Expected:** Creativity advertises **2** exercises one Good answer from cut today. Both are due and neither is a previously cut/missed gem, so there is no ambiguity with the “to win back” category.

**Actual:** It advertises **0**. Incubation's stability is 2.3065 days before review and **25.10871981** after Good; launch checklists would reach **61.1388571** days after Good. Both exceed the 21-day cut threshold. The forecast is computed at the old due date, when less time had elapsed. This affects other skills too: baseline AI showed 6 versus 16 under today's replay; Learning 6 versus 18. The baseline audit records every affected exercise.

**Reproduction:** 2/2 complete Good-rating journeys, one Mac and one iPhone; also independent replay of the entire deck. The same source exercise produced the same 25.10871981-day state on both platforms.

**Evidence:** `creativity-no-nearly-cut.png`, `creativity-good-preview.png`, `creativity-good-end-settled.png`, `phone-creativity-no-nearly-cut.png`, `phone-creativity-good-end-settled.png`, `baseline-audit.json` (`readyDiscrepancies`), `phone-review-lines.json`.

**Suspected cause:** `packages/core/src/today.ts:99` passes `new Date(c.fsrs.due)` to the Good projection even when that date is months behind today. `ready_today` then filters that already-stale classification (`:106`). `apps/desktop/src/ReviewPick.tsx:38` consumes it. `cardHistory` projects Good at the actual review time, explaining why the exercise/end screen disagrees with the picker.

### N3 — Skill strength stays stale after retirement or its undo

**S2 · Mac; related stale undo display observed on iPhone · new finding**

1. Open a skill page with a solid exercise due. Leave that page open underneath Review.
2. Start Review for the skill, retire a solid exercise, then leave without rating anything.
3. Read the skill header. Compare it with `ore stats --skill <skill> --json`.
4. Undo retirement, redo it, and compare again.
5. Navigate to Home and reopen the skill.

**Expected:** Current cut count and ring refresh when retirement completes and when it is undone/redone.

**Actual:** In the controlled Creativity journey, the open page continued showing **5 cut gems / Lv 1**, while the CLI and library showed **4 / Lv 0** (the level decrease itself is N1). Both retirement attempts left the old count. Reopening the page finally displayed 4. On iPhone, undoing the Stoicism retirement wrote `state: live` and said “Exercise restored”, but the page and Today still showed 4 and the review picker still said 5 exercises ready instead of the restored 6.

**Reproduction:** 2/2 Mac retirement states (initial retirement, then undo/redo); 1 additional iPhone undo observation. N1 has its own fresh-page reproductions, so this refresh bug does not explain away that calculation defect.

**Evidence:** `stale-retire-1.png`, `stale-retire-2.png`, `stale-retire-actual-1.json`, `stale-retire-actual-2.json`, `stale-retire-refreshed-final.png`; phone: `phone-retire-undone.png`, `phone-after-retire-undo.json` (restored exercise file), `actions.jsonl` (subsequent picker still reported 5).

**Suspected cause:** `apps/desktop/src/Review.tsx:828–850` retires/restores without notifying the surrounding views via `onLogged`. `apps/desktop/src/SkillPage.tsx:355–367` fetches stats only when the skill ID changes. Related to the refresh class of F159, but that row covers **rating undo**, not retirement; this is not a claim that its specific fix regressed.

## Known rows observed again

No known fixed finding was independently established as a regression. F56's old Review progress bar was absent, as D246 requires. F12's documented per-skill new-cap limitation was not re-reported. A phone toast intercepted a rating tap during one undo test; it was bypassed after dismissing/waiting, and was not investigated or promoted to a finding in this numbers-focused run.

## What passed

- **Baseline counts:** 238 sources; 122 done; 137 with live exercises; 232 live exercises; 1,216 effective reviews. `ore stats` matched independent file counts globally and for all 14 skills.
- **Retention:** 280 / 429 qualifying reviews = **0.6526806526806527**. First exposures, early reviews and relearn exclusions matched the implemented rule. All skill retention values matched.
- **AI agreement:** seed contains zero AI-rated typed answers; `n=0`, `same=0`, `share=null`, higher/lower both 0. This is a zero-case check, not evidence about nonempty live AI grading.
- **Initial due queue:** **162**. CLI, Home's hint and the Mac/iPhone pickers agreed. All 162 due dates, rounded recall probabilities and the complete CLI queue order matched independent replay/order calculations. Multi-skill rows overlap, so their sum is not a unique-exercise total.
- **Review header:** no backlog count or timer is shown in full Review, in accordance with the later D246 amendment. It is not an omitted numerical check.
- **Next-day iPhone queue:** **172** entries expected (162 reviewed exercises plus 10 new). All **55 observed successive exercises** matched the independent order, including the first-card likely-recall rule. New exercises occurred exactly at **5, 10, 15, 20, 25, 30, 35, 40, 45, 50**, and no new at 55. Five reserved recent-finish exercises occupied the first five new slots (D279). All mutations in this queue journey were Later actions, not ratings.
- **FSRS replay:** all **297** exercise records in the captured baseline index matched independently replayed states, including null state for never-reviewed exercises. The changing-library caveat below explains why this count exceeds the original seed's 288. Later, all **363** records in the final snapshot also matched, after Good, Again, undo, retirement and reassignment (`final-replay.json`).
- **Next-review predictions:** all **928 predictions** (Again/Hard/Good/Easy on each of 232 reviewed exercises) from `ore card show --review --json` matched `ts-fsrs`, allowing only the real command execution time. The UI's observed incubation Good preview said 33 days; the saved Good due was 33 days later.
- **Priority/reassignment:** moved the incubation source from Creativity (P2) to AI (P1), through the app's Skills picker. Final child exercise skills were `['ai']`; all resulting states matched replay at the new retention. The isolated two-review check also confirmed that changing target retention alters scheduled interval without changing stability/difficulty.
- **Initial skill displays:** solid counts and levels agreed between Mac and iPhone, and the underlying solid/growing/new/peak/level calculations matched independent arithmetic for every skill. This is agreement with implementation; the historical-level and forecast rule defects remain N1/N2. Sidebar has no strength number to reconcile.
- **Good/Again/undo:** Good on incubation changed stability from 2.3065 to 25.10871981 and added one cut gem/level. Undo restored the prior state, **1,216 reviews** and **0 active milliseconds**; an Again then wrote the requested rating rather than an AI suggestion.
- **Two reviews in one second:** a separate log fixture with `.100` and `.900` timestamps replayed both events; undoing the second left exactly one. On the actual phone, a Good at `.144`, undo, then Good at `.244` left **one effective review and 100 ms**, with the exact independently predicted FSRS state (`phone-log-check.json`).
- **Five-minute idle cap:** raw exercise time **327,885 ms** counted as **180,000 ms**, and undo removed that entire contribution. Another long interval (**345,897 ms**) also capped at 180,000.
- **Switch-away accounting:** simulated browser/Tauri blur for **120,000 ms** counted exactly 120,000. Full Review uses wall-clock elapsed time, capped per answer; it does not subtract blur/idle time (`Review.tsx:610`, `study.ts:109–112`). This matches the current explicit code rule; it is not a verified pause-aware active-time implementation.
- **Goal and bonus lap:** effective times **180,000 + 120,000 + 180,000 + 180,000 = 660,000 ms** produced **11 minutes**, goal met, and **+1** bonus minute. Review continued beyond the goal. The settled ring visibly showed 11/+1 (`bonus-lap-11-settled.png`).
- **Session receipt:** those four reviews were one Again and three Good ratings: **3 memories kept**, **72 days** of capped memory gain (displayed as 2 months), with correct skill attribution and the Creativity level-up. Independent receipt arithmetic matched (`receipt-check.json`).

## Re-running and harness caveat

`audit.cjs` is an independent oracle: it parses files and uses `ts-fsrs` directly; it does not call Ore's `stats`, `strength`, `orderQueue` or `replay` to obtain expected answers. CLI calls supply actual answers only. Run `node codex-out/numbers/audit.cjs <snapshot-name>`. Other focused scripts and evidence are in this same folder. `next-day.cjs` computes the original phone seed at 2026-11-15 12:00 Pacific; `step-nextday*.js` contains the corresponding touch journey. `edge-replay.ts` stores its synthetic log only under this report's folder. No repo tests were edited and no fixes were made.

**Important test-side side effect:** the first direct CLI `today` command was run without `ORE_NO_ENRICH=1`. Unlike the mock bridge, the direct CLI starts its normal detached catch-up. It added new drafts to the **numbers scratch library** during this run. The original phone seed has 288 exercise files; the baseline replay snapshot had 297 and the final snapshot had 363. Existing review logs, due exercises and their predictions remained independently checkable; newly generated drafts were dated today and stayed out of today's capped queue. The 55-exercise next-day check used the untouched phone seed, not that changing Mac library. Subsequent oracle CLI calls all set `ORE_NO_ENRICH=1`.

An attempt to inspect that test-created process with `ps` was denied by the sandbox, so **the existing catch-up job was not confirmed stopped**. Its log is `codex-out/libs/numbers/.ore/logs/catch-up.log`. Do not treat the numbers Mac scratch library as pristine. The supplied app/bridge/WebKit servers were not started or stopped. App test actions also intentionally left ratings, retired exercises and a source filed under AI in the scratch data; the phone journey's writes remain in its browser IndexedDB. No real personal library or installed app was touched.
