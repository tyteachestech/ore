# Science pass: still on track? (2026-11-02)

> Second learning-science audit, of master through PR #200, against [`research/brief-learning-science.md`](../research/brief-learning-science.md), [`DECISIONS.md`](../DECISIONS.md) (D1–D106), the code, a ts-fsrs simulation of the current queue rules and a read-only look at the real library (`~/Ore`). The first audit was [2026-10-24](2026-10-24-science-audit.md). The recommendations wait on Tyler's pick, except the copy fix in this PR.

**Mostly yes.** The features added since the first audit follow the evidence, and all eight of its fixes are still in the code. Two things matter more than any feature, though:

1. **Nobody has learned with Ore yet.** The real library has 42 sources, 1 finished, 13 cards and **one review ever** (2026-10-25, a miss). Every effect in this doc is predicted, not measured.
2. **The review debt became draft debt.** The first audit's fix (new cards only fill the time the goal leaves, D65) keeps review at 10 minutes, as meant. But only about **1.5 new cards a day** get in at that goal, while each finished source drafts 4 to 10. The rest wait, freshest first, so a source read three weeks ago may never come up.

## The draft pile

The same rough model as the first audit (ts-fsrs defaults, first recall 60%, Fact 20 s, Explain 90 s and 60 s once passed twice, one relearn pass on a miss), now with Ore's real rules: due cards never capped, new drafts only in goal time left, at most 10 a day, a day's wait, freshest first. "Supply" is drafts written per day: about 3 is one source finished every two days.

| Goal | Supply / day | New cards in / day (days 150–180) | Drafts waiting, day 90 | Day 180 | Oldest waiting, day 180 |
| --- | --- | --- | --- | --- | --- |
| 10 min | 3 | 1.4 | 96 | 240 | 165 days |
| 10 min | 6 | 1.5 | 366 | 770 | 177 days |
| 20 min | 3 | 2.4 | 3 | 38 | 63 days |
| 20 min | 6 | 2.5 | 215 | 537 | 167 days |

Retention 0.92 shown; 0.88 changes the numbers little. The point is the shape: at 10 minutes, review stays at 10 minutes and most of what he reads never becomes a memory. That is a fair trade only if the cards that do get in are the best ones, and today they are just the newest.

The Home line also said "240 new cards start tomorrow, up to 10 a day", which isn't true under D65. **Fixed in this PR:** past one day's worth it now reads "240 new cards wait. A few start each day, as your goal leaves room."

## What to do, in order

Ranked by how much each helps him learn, times the strength of the evidence, divided by effort.

1. **Use it for two weeks before building more learning features.** 10 minutes a day, real sources, Mac and phone. Then rerun this pass on his logs: AI-rating agreement, in-head vs typed pass rates, calibration, how many drafts wait. *Why:* every open question below (is the AI setting his ratings, do in-head answers hold up, are prequestion cards worth their 90 s) can only be answered by his own data, and real-world effects run about a third smaller than lab ones (brief). Effort: his time, no code.
2. **Let his own work go first in the waiting pile.** Order waiting drafts by where they came from: his answers (Answered + card), his typed lines (Card here) and source notes, then Card highlights with a note, then plain Card highlights and Look Up words, then prequestion cards; freshest first within each. *Evidence:* generating beats reading (generation effect, d ≈ 0.40, Bertsch 2007); self-made cards beat premade (brief §4, d ≈ 0.3–0.45); prequestion cards were already retrieved once in the finish quiz, his highlights were not. *Changes* D60's "freshest source first". Effort: tiny (the sort in `dueQueue`).
3. **Show the trade where he sets the goal.** In Settings › Review under the goal: "At 10 min, about 2 new cards a day get in · 240 waiting", from his own medians. Then raising the goal or reading less is his informed choice, not a silent pile. *Evidence:* a small, predictable load he chose keeps review going (brief §10); informational feedback supports autonomy (Deci & Ryan). Effort: small.
4. **Count "caught up" by the end of today** (bug-sweep call 12). Cards due later today join this morning's session, as in Anki. *Evidence:* one predictable daily session is what the habit cue (D67) builds on (Gardner 2022); a few hours early costs FSRS nothing measurable at day-plus intervals. Effort: small (`due <= end of today` in `dueQueue`).
5. **Stamp AI ratings, and watch them** (call 32). The review log's `ai_rating` has no vendor, model or prompt version, which the project rules require of all AI output. Add the stamp, and add two developer-only numbers to `ore stats --json`: how often his rating equals the AI's suggestion (if nearly always, the AI is in effect setting the rating D21 reserves for him; ↵ accepts it) and pass rates of in-head vs typed answers (the fluency illusion D68 accepted as a risk). Never shown in the app. Effort: small.
6. **Let him retire a card from Collected** (call 42). Today a card can only be retired in the middle of a review. Pruning cards he doesn't care about is the cheapest load control there is (2, 3 above). Effort: small.
7. **`/ore` reviews use remixed versions** (call 56), so the same card behaves the same everywhere (D66). Effort: small.
8. **Hide questions from archived sources** (call 13). Questions stay "a menu, not a backlog" (D75.6). Effort: tiny.

Calls from the bug sweep with no learning effect are left to the sweep.

## The new features

| Feature | Verdict | Why |
| --- | --- | --- |
| Prequestions v8 (enrich prompt, PR #199) | Helps | A pretest works through his own guess (g = 0.54 on what it targets); "According to X" made it unguessable. |
| Side quests: Explain, Learn this (D97) | Helps | An in-place gloss keeps comprehension going; the unknown term leaves as a question with sources, which a later source answers. The AI gloss comes without a guess first; fine for reading, and Make card still asks him later. |
| Card here, Collected (D99) | Helps | He types what to remember, a generative step; the AI only drafts from his line, with quotes checked. Adds supply (rec 2). |
| Stopping early (D100) | Helps | No cards or quiz questions about what he didn't read. |
| Finish button, Keep reading (D106) | Helps | Quizzing partway is interpolated testing, which helps learning of the next part (Szpunar 2013). Card highlights still draft overnight via catch-up while the source stays in To read. |
| Quick quiz (D76) | Helps | Short spaced sessions with every review rule kept. Watch for rushed answers once there is data (rec 1). |
| Gems (D90) | Helps | Track durable memory (stability ≥ 21 d), not volume; levels never drop. Don't make a glowing gem a one-click review (open call): it would pick near-solid, easy cards over the most urgent ones. |
| Questions → answers (D75) | Helps | Self-generated questions and answers in his words; no counts. |
| Skill goal, Try it (D102) | Helps | Free recall against a goal he chose, with tries side by side. |
| Look Up → Make card (D83) | Neutral | Fine with its sentence as context; vocabulary cards are cheap Facts. |
| Listen (D85) | Neutral | Listening and reading comprehension are about equal for most prose (from memory: Clinton-Lisell 2022; verify before quoting); highlighting still works while it plays. |
| Courses (D79) | Neutral | Each lesson gets its own prequestions and finish. A 14-lesson course is a lot of supply (rec 2, 3). |

## The first audit's fixes, checked in code

All eight hold: retention P1 0.92 / P2 0.88 / P3 0.80 (`skills.ts`), new cards only in goal room and not the day they were drafted (`study.ts`), today's slice on Home, the plan and one reminder, the pill pops only for thinking, remixing, in-head answers, calibration on typed Sure answers (`stats.ts`). Its three "watch" items (AI-rating agreement, own-words vs no-note retention, old drafts waiting) still have no data; the third is now rec 2 and 3.

## Keep these as they are

Nothing from the AI before his attempt; confidence before the reveal; priority never touches FSRS math; a goal in minutes with days that never reset; no streaks, XP or counts of questions; strength from durable memory.

*Simulation: `/mnt/project-files/science-pass/sim.ts` (project files), a model with default FSRS weights, not real data. Effect sizes from the evidence brief; Szpunar 2013, Bertsch 2007 and Clinton-Lisell 2022 cited from memory.*
