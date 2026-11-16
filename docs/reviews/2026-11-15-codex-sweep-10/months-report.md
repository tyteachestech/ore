# Months tester report

**1. Coverage**

Tested checkout `32f3dc4763411212971ab2297d1e2c4b6c648999` in the supplied WebKit browser: the Mac release build for **70 days, November 17, 2026–January 25, 2027**, with **59 sessions and 408 ratings** (338 Good, 64 Again, 6 Easy), four isolated skipped days, a seven-day absence, and one 60-exercise, three-hour session. Each ordinary session spent about 12 minutes reviewing. Tested the phone at 390×844 with touch for **14 days, February 26–March 11**, including two skipped days and **120 ratings**, plus two repetitions each of the March 8 and November 1 New York DST transitions and midnight endings on both platforms. Checked saved review records, FSRS results, queue order, new-exercise limits, daily minutes, due counts, levels, receipts and command timings. Skipped AI quality, imports, native Tauri/iCloud behavior, the iOS Simulator, pure visual polish, and the explicitly excluded open rows. No application or documentation files were changed.

**Clock and fixture details:** The supplied Mac bridge does not forward `page.clock` to its CLI. `runner.cjs` therefore intercepts only this page's requests to port 1762 and executes the same CLI with `clock.cjs` preloaded, using the browser's date and `TZ=America/New_York`; every mutation originates in an app action, and `ORE_NO_ENRICH=1` remains set. Independent CLI checks are reads. The phone runs its actual in-page core. To test historical DST without future-dated seed reviews, its incoming `/library.json` timestamps were shifted uniformly by −263 days for spring and −15 days for fall; the supplied seed folders were not edited. The shifted snapshots are saved here. Used one context and one page at a time, closed after each journey. Reduced motion made settled ring values easy to inspect; cart animation choreography was not assessed.

**2. Findings**

**MONTHS-1 — Ending after midnight shows yesterday's minutes in today's ring. S2. Mac and iPhone.**

1. Open a fresh page with a due backlog and the default ten-minute goal, in `America/New_York`, at 23:35.
2. Start review. Rate three exercises Good after two minutes each. End the session and choose Done. Today's saved total is six minutes.
3. Start another review. Rate one exercise Good after two minutes.
4. Leave the next exercise open until 00:01. Do not rate anything after midnight.
5. Click/tap Leave review and inspect the end ring. Read `today --json` at the same time (phone equivalent: its core's read-only `run(['today'], null)`).

**Expected:** The ring follows D274 and shows the new day's minutes: **0 min**, an empty ring. Yesterday's eight minutes remain attributed to yesterday; the session's memory results can still describe that session.

**Actual:** The ring shows **6 min**, with six-tenths of the goal lit, while the fresh Today result correctly says `active_ms: 0`, `met: false`. Six is the total from before the second session, not even that session's eventual eight-minute daily total. This gives a learner a false account of today's progress. Reviews remain saved correctly.

**Reproduced:** **2/2 Mac, 2/2 iPhone**, on separate local calendar days. The current-day total was zero in all four cases.

**Screenshots:**

- [Mac, first reproduction](midnight-mac-0.png)
- [Mac, second reproduction](midnight-mac-1.png)
- [iPhone, first reproduction](midnight-phone-0.png)
- [iPhone, second reproduction](midnight-phone-1.png)

**Evidence and replay:** [Mac records](midnight-mac.json), [phone records](midnight-phone.json), [Mac script](midnight.cjs), [phone script](phone-edge.cjs). Phone reproduction command: `START=2026-11-02T04:35:00Z SHIFT_DAYS=-15 LABEL=midnight-phone MODE=midnight node codex-out/months/phone-edge.cjs`. Scripts write only within this tester's output folder; app actions change the assigned test library.

**Suspected cause:** `apps/desktop/src/Review.tsx:654` resets the previous-day baseline only after a rating. Ending without another rating skips that reset. `Review.tsx:452` reads today's correct total but passes the old `before.current` into the end screen at line 454. `apps/desktop/src/Lap.tsx:16` then takes `Math.max(from, side(today))`, preventing the ring from falling below yesterday's baseline. Both platforms share this code.

**3. Known rows seen again**

No confirmed recurrence of an existing fixed row. MONTHS-1 is related to **F184**, but its trigger and result differ: F184 concerned an incorrect Goal met notice after a post-midnight rating; this finding concerns the end ring when there is **no** post-midnight rating. Excluded open rows were not re-reported.

**4. What passed**

- **Saved reviews and schedules:** All 408 main-run Mac ratings are in the library logs; every saved state matches `ts-fsrs` with that exercise's configured retention. No missing session end receipts. [Validation](mac-validation.json).
- **Phone persistence and schedule parity:** All 120 ratings remain after successive reloads; each resulting schedule exactly matches the Mac scheduler given the same prior state, time, rating and retention. This is a per-rating comparison, not two devices reviewing identical queues in lockstep. [Validation](phone-validation.json).
- **Queue order:** All 70 opening queues match priority-weighted forgetting risk, topic interleaving and concept/definition grouping, using unrounded recall probabilities reconstructed from the logs. The 408 app ratings follow their starting queue with the specified three-exercise gap before a missed exercise returns. [Queue validation](queue-validation.json), [validator](queue-check.ts).
- **Due totals:** Home's backing Today count equals `ore due` before and after all 70 Mac days; the phone's corresponding counts match over all 14 days. A final visible Mac hover says 185 due and the CLI returns 185. [Hover evidence](home-count.png), [data](home-count.json).
- **Daily new-exercise ceiling:** Never exceeded ten. The three-hour session admitted exactly ten; ordinary later sessions stopped offering new exercises after the finite seeded draft pool was exhausted.
- **Three-hour session and bonus laps:** All 60 ratings saved; `active_ms` is exactly 10,800,000. The end ring shows **180 min, +170**. [Screenshot](mac-day-35.png).
- **Day boundaries in the long runs:** Each day's saved active time equals the sum of its reviews, capped at three minutes per exercise; skipped days show zero rather than carrying yesterday's minutes.
- **Week away:** Due count increased from 164 to 192; review still opened normally, mixed in new material and returned to a normal twelve-minute session. No clearing-the-backlog requirement appeared.
- **Levels:** None dropped over either run. On the Mac, Teaching and Creator Business rose from level 1 to 2, and Creativity from 0 to 1.
- **Spring DST:** Twice, 01:59 EST → 03:01 EDT added about 120 seconds, not 62 minutes. [Evidence](dst-spring.json).
- **Fall DST:** Twice, 01:59 EDT → 01:01 EST added about 120 seconds, with no negative elapsed time or refused rating. [Evidence](dst-fall.json).
- **Observed drift:** Today CLI calls had a 72 ms median in the first ten days and 77 ms in the last ten; no page errors occurred. Logs and receipts grew with saved actions. This checks this library and run length, not a heap profile or an unlimited-history performance guarantee.

Full daily evidence: [Mac](mac-days.json), [phone](phone-days.json). Main scripts: [Mac](runner.cjs), [phone](phone.cjs), [Mac validation](validate.ts), [phone validation](validate-phone.ts). Initial selector/probe failures were harness errors and are not findings.
