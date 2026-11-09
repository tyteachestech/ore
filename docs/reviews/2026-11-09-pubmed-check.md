# PubMed check of Ore's learning claims (2026-11-09)

Tyler asked to double-check Ore's learning insights against research databases. Each claim Ore shows on screen or rests a decision on was looked up in PubMed first; papers PubMed doesn't index were checked in SciSpace. Verdicts: **supported** (the paper says it), **weak** (true in a narrower case than we claim, or mixed), **contradicted** (the paper says something else).

## Lines Ore shows

| Line | Where | Verdict | Papers |
| --- | --- | --- | --- |
| "Every miss comes back sooner. That's how they stick." | Review end screen | Supported | The answer after a miss raised retention a week later by 494% ([Pashler 2005](https://doi.org/10.1037/0278-7393.31.1.3)); dropping items from retrieval once recalled hurt ([Karpicke & Roediger 2008](https://doi.org/10.1126/science.1152408)); relearning across sessions has large effects ([Rawson & Dunlosky 2012](https://doi.org/10.1037/a0030498)) |
| "…recalling first makes it stick." | Skill page warm-up | Supported | Classroom quizzing g = 0.50, 222 studies ([Yang 2021](https://doi.org/10.1037/bul0000309)) |
| "Your best guess, or ? for no idea" | Review | Supported | Wrong guesses before the answer still help ([Kornell, Hays & Bjork 2009](https://doi.org/10.1037/a0015729)) |
| Remix cards: "so you apply it instead of reciting it" | Settings | Supported | Testing transfers, d = 0.40, most to application questions ([Pan & Rickard 2018](https://doi.org/10.1037/bul0000151)) |
| "When you say Sure, you're right N% of the time." | End screen (D69) | Supported as a measure; weak as training | Delayed judgments are more accurate, g = 0.93 ([Rhodes & Tauber 2011](https://doi.org/10.1037/a0021705)). Showing people their calibration helps on easy cases only and sometimes not at all (Staal 2023, Kuhn 2021, Martin & Mandel 2024, SciSpace). Ore doesn't claim it trains calibration, so nothing to change |

## Decisions

| Decision | Verdict | What the papers say |
| --- | --- | --- |
| Retrieval with feedback as the core (D59, D140) | Supported | Yang 2021; Pashler 2005. Feedback also doubles retention of correct answers given with low confidence ([Butler 2008](https://doi.org/10.1037/0278-7393.34.4.918)) |
| Confident misses called out (D53, D62) | Supported | High-confidence errors are the most often corrected ([Butterfield & Metcalfe 2001](https://doi.org/10.1037//0278-7393.27.6.1491)) |
| First review a day later (D65.3) | Supported, stretched | Delaying the first test improved long-term retention ([Karpicke & Roediger 2007](https://doi.org/10.1037/0278-7393.33.4.704)); the study's delays were minutes, a day is an inference |
| Spacing by FSRS (D22) | Supported for spacing; FSRS itself not in PubMed | The best gap grows with how long you need to remember, about 10 to 20% of it ([Cepeda 2008](https://doi.org/10.1111/j.1467-9280.2008.02209.x)). FSRS's evidence is benchmarks on Anki data in ML venues, and the 0.80 to 0.92 retention targets come from simulations, not trials |
| Answer older Explain cards in your head (D68) | **Weak** | Silent recall matched typed recall ([Smith 2013](https://doi.org/10.1037/a0033569)), but on word lists, not prose; another study found a small edge for typed answers at a week ([Jönsson 2014](https://doi.org/10.1007/s00426-013-0522-8)). D68's limits (only cards passed twice, marked against key points) fit this; worth watching his in-head pass rate against typed |
| Prequestions (D18) | Supported for what they ask; **weak** for broad ones | Gains are for the questioned content. Broad "integrative" questions helped only when readers were told to look for the answers ([St Hilaire 2019](https://doi.org/10.1080/09658211.2019.1641209)), and gains showed only for answers learners actually found while watching ([St Hilaire & Carpenter 2020](https://doi.org/10.1037/xap0000296)). In 30 real classes prequestions helped on average but made some students skip the video (ManyClasses 2, 2025, SciSpace) |
| Interleave topics, confusables adjacent, definitions grouped (D24) | Confusables and definitions supported; **weak** for mixing text-based topics | Overall g = 0.42; best when categories look alike; words g = −0.39 (block them); expository texts not significant ([Brunmair & Richter 2019](https://doi.org/10.1037/bul0000209)). Mixing topics in review costs nothing, but don't expect a gain from it alone |
| Hints before answers, answer on the second wrong try (D140) | Supported, with one tension | Guardrailed AI tutoring avoided the 17% exam drop of plain ChatGPT ([Bastani 2025](https://doi.org/10.1073/pnas.2422633122)); hints keep people testing themselves with no learning cost ([Vaughn & Kornell 2019](https://doi.org/10.1186/s41235-019-0187-y)). Tension: hints until the learner produces the answer beat simply giving it, at a one-day delay ([Finn & Metcalfe 2010](https://doi.org/10.3758/MC.38.7.951)), while Quiz me gives the answer on the first miss |
| No streaks, nothing resets (D23, D60) | Supported, but one citation was wrong | **Contradicted citation:** Kang, Daniels & Schweitzer 2022 (PNAS, [doi](https://doi.org/10.1073/pnas.2204460119)) is about hard tasks in a run or at the end making volunteers quit, not about streak resets. Fixed in this PR. The no-reset rule still stands on Silverman & Barasch (broken streaks drop below baseline) |

## Fixed in this PR

- Kang 2022 was cited for "hard resets raise quitting by 32%" in DECISIONS (D63, D65 evidence notes), the brief §10, `skill-strength.md`, `review-plan.md`, `daily-session.md` and the 2026-10-24 audit. Now worded as what it found.
- Smith 2013 was described as "word lists and prose" (D68 evidence note); it used word lists. Jönsson 2014 added.
- Brief §6: "visual/category discrimination g = 0.67" was the paintings figure; added the overall g = 0.42 and the null for expository texts.
- Brief §8: integrative prequestions help only with an instruction to look for answers; added St Hilaire & Carpenter 2020.
- The audit's "cited from memory; verify before quoting" note: both papers checked.

## Ideas the evidence backs (not built; each needs Tyler's pick)

1. **Keep prequestions in reach while reading.** They fold to one line once he starts reading (D18), but the gain comes from finding their answers while reading. Purpose: so he reads for the answers. Smallest form: the folded line keeps listing the questions he answered.
2. **Daily-session ideas 2 and 3 now have support.** Most-urgent-first puts the hardest cards in a run at the start of a backlog session; Kang 2022 found hard tasks back to back or last raise quitting. That backs "start on a likely win" and "end on a win" (`daily-session.md`).
3. **One hint before the answer in Quiz me**, tested in `bun run eval:tutor` before changing D140 (Finn & Metcalfe 2010).

## Not in PubMed

FSRS, Ponce 2022 (highlighting), Bisra 2018 (self-explanation), Pan & Carpenter 2023, Latimier 2021, Gollwitzer & Sheeran 2006, Shute 2008 and Renkl & Atkinson 2003 sit in education or ML journals that PubMed doesn't index. Latimier 2021 and Pan & Carpenter 2023 were found in SciSpace and match the brief; the rest stand as the brief cites them.
