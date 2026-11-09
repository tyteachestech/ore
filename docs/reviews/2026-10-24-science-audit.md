# Science audit: is the app following the science? (2026-10-24)

> Audit of master through PR #42, against [`research/brief-learning-science.md`](../research/brief-learning-science.md), [`DECISIONS.md`](../DECISIONS.md) (D1–D64), [`SPEC.md`](../SPEC.md) and the code. The eight recommendations wait on Tyler's pick; #7 was designed in detail as [remixing cards](../design/remixing-cards.md).

**Mostly yes, loop by loop.** Every place where the evidence says "ask before you show", the app does it. The real risk is the daily load. With the defaults, the review pile outgrows a 10-minute goal within weeks. People who fall behind on spaced review usually quit, and the science only works for someone who keeps showing up.

| | |
| --- | --- |
| **Right:** the learning moves | Retrieval before feedback, FSRS, confidence before the reveal, recall first, no AI in his notes, interleaving, forgiving goal days, strength measured by durable memory |
| **Main risk:** review debt | 10 new cards a day, 0.95 retention on most cards and a typed answer for every Explain card add up to over an hour of review a day by month three |
| **Missing:** a daily cue | The best-supported habit tools are a one-line plan ("after X, I review") and one reminder. Neither exists yet |

## How much review the defaults create

A simulated year of daily review with the app's own scheduler settings (ts-fsrs, default weights, no learning steps, one relearn pass on a miss), at about 55 s a card (20 s per Fact, 90 s per Explain, half and half). Minutes a day at day 90:

| Setting | Minutes / day | Cards / day |
| --- | --- | --- |
| 10 new/day · 0.95 (default for P1 cards) | 96 | 105 |
| 10 new/day · 0.90 | 67 | 73 |
| 5 new/day · 0.90 | 36 | 39 |
| 3 new/day · 0.90 | 21 | 23 |
| 2 new/day · 0.90 | 15 | 16 |

At day 365 the default reaches 171 cards a day. The model is rough (every success rated Good, first recall 60%, default weights). The size of the gap is the point, not the exact minutes. Most cards land at 0.95 because a card takes the highest retention of its skills (D22), and three skills are P1. The brief asks for "a small, predictable daily load"; today the load is set by how much he reads, not how much time he has.

## What to build, in order

Ranked by how much each helps him keep going, times the strength of the evidence, divided by effort.

1. **Let new cards fill only the time the goal leaves.** New drafts enter review only while the forecast for due cards is under the daily goal. Lower retention targets to the brief's numbers: P1 0.92, P2 0.88, P3 0.80. *Evidence:* workload rises steeply above 0.90 (§5, §10); hard tasks in a run or at the end raise quitting ~32% (Kang 2022). *Changes* D22, D60. Adherence: highest; effort: small.
2. **Show today's slice, not the whole pile.** "About 10 minutes of your most urgent cards"; the full due count moves into a hover hint. *Evidence:* predictable load (§10); late is cheap, cramming costly (Cepeda 2008). *Changes* D58. Effort: small.
3. **A daily cue: a one-line plan and one reminder.** "After [my morning coffee], I review." One macOS notification at that time, only while the goal is unmet. *Evidence:* implementation intentions d ≈ 0.65 (Gollwitzer & Sheeran 2006); habit is about the cue (Gardner 2022). Effort: medium (needs to fire when the app is closed).
4. **Wait a day before a new card's first review.** The finish quiz already gives the immediate test. *Evidence:* delayed first retrieval beats immediate (Karpicke & Roediger 2007; Roediger & Karpicke 2006). *Changes* the freshDraft rule in `queue.ts`. Effort: tiny.
5. **Answer mature Explain cards in your head.** Once one has passed twice, answer silently, then see the model answer and rate. ~90 s → ~30 s. *Evidence:* silent retrieval helped as much as writing (Smith, Roediger & Karpicke 2013); risk of fluency illusion, watched by calibration. *Changes* D59.1.
6. **Make the collected pill reward the thinking, not the clicks.** Fly-in and pop only on Card and Question highlights and when he writes a note. *Evidence:* "highlight counts as progress" is on the brief's not-supported list; highlighting plus a generative step g = 0.82. *Changes* D64. Effort: tiny.
7. **New scenarios for mature Explain cards.** → see [remixing cards](../design/remixing-cards.md). *Evidence:* Butler 2017. Builds D24.
8. **Calibration, measured on Explain cards.** "When you say Sure, you're right 86% of the time", computed where the AI's key-point marks give an independent check. *Evidence:* Rhodes & Tauber 2011.

## Loop by loop

| Loop | What the evidence says | What the app does | Gap | Will he keep doing it |
| --- | --- | --- | --- | --- |
| Capture and highlight | Highlighting alone barely helps (g = 0.30). It pays when selective and followed by a generative step | Selecting makes a Keep; keys 1–4 set the type; note field with causal placeholders | No nudge toward selectivity; the pill celebrates every highlight (#6) | High |
| Notes in his own words | Self-explanation g ≈ 0.55. Verbatim copying loses the benefit | Source note, section lines, recall saved as first draft, no AI in notes | None | Medium |
| Card generation | Self-made cards beat premade (d ≈ 0.3–0.45). Mix facts with explain/apply prompts | AI drafts 1–2 per Card highlight plus cards from notes and prequestions; live on first answer | Card volume not tied to his time (#1) | High (automatic) |
| Prequestions and quiz | Prequestions g = 0.54 on what they target. Recall first, confidence before reveal | 2–4 broad questions; recall first at finish, then each question with confidence and a check | New cards come back the same day (#4) | Medium |
| Review and FSRS | Spaced retrieval with feedback is the engine. ~0.90 retention, never above 0.95 | ts-fsrs, ask before showing, typed Explain answers with AI rubric check | Most cards at 0.95; every Explain typed; mature cards repeat word for word (#1, #5, #7) | At risk under today's load |
| Daily goal | Small, predictable load. Forgive missed days | Minutes, weekdays-only switch, "all caught up" counts | No cue or reminder (#3) | High once cued |
| Home | Make starting trivially easy | Ring, due, Start review on ↵, skill chips | Raw due count gets daunting (#2) | Medium |
| Skill strength | Reward that tracks real skill helps | Solid memories, levels that never drop, "to win back" | Sound | High |
| Collected pill (D64) | Highlight counts as progress: not supported | Fly-in and pop on every new highlight | A Keep pops like a Card (#6) | High (that's the worry) |

## Keep these as they are

- Nothing from the AI before his attempt, anywhere (D34.3). The biggest guard against "AI as answer-giver" (−17% on unaided exams, Bastani 2025).
- No "review your highlights" screen and no AI summary in place of his notes.
- Confidence before the reveal, plus the "You were sure about this one" line on confident misses.
- Priority sets retention and breaks ties, and never touches the FSRS math (D22).
- A goal in minutes, days that never reset, and "caught up counts".
- Strength from durable memory with levels that never drop. No XP, no leaderboards, no percent correct.

## Watch, don't build

- **How often he accepts the AI's suggested rating.** If nearly always, the AI is in effect setting the rating D21 reserves for him. The log has `ai_rating` next to `rating`.
- **Own-words vs no-note retention (D34.8).** Once both groups pass 10 reviews, this answers whether Card highlights with no note are worth drafting.
- **Old drafts waiting.** Freshest-first plus a daily limit means drafts from older sources can wait indefinitely.

Effect sizes come from the evidence brief, which notes real-world effects run about 30–36% smaller than lab results. Smith, Roediger & Karpicke 2013 and Karpicke & Roediger 2007 were checked in PubMed on 2026-11-09 and hold ([`2026-11-09-pubmed-check.md`](2026-11-09-pubmed-check.md)); Smith 2013 used word lists, not prose. The load table is a simulation with default FSRS weights, not real data.
