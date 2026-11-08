# Tutor pedagogy eval

The Ask eval (`ask-library.md`) checks that the tutor answers his questions right, from the right place. This one checks that it teaches the way D128 says: hints, not answers, when he is practising; the answer on "show me" or after two tries; Quiz me asks, then corrects with the right answer and moves on, with no score; Practice sets an open exercise; his own questions get a cited answer; small talk stays small; none of that searches the web.

```bash
bun run eval:tutor                      # Claude and Codex; spends AI usage, never in CI
bun run eval:tutor --vendor claude --model claude-haiku-5-5
bun run eval:tutor --vendor claude --runs 3   # each case three times: one pooled rate, and the cases that passed only some runs
bun run eval:tutor --vendor claude --against 85e22fb   # blind A/B: today's tutor.md against the one at that commit (or a file)
```

## How it works

- **Set** (`packages/core/eval/tutor-cases.json`): 13 single turns over the golden docs, some with the turns before (`earlier`) and a source open (`reading`). Each lists what its reply must do: be a hint or not, hold or withhold patterns (the answer he is meant to find), set an exercise or not, split a worked answer into steps (D142), ask him something, cite a passage, give no score, not search, stay short.
- **Checks** are code (`failures` in `eval/tutor.ts`, tested in `test/eval-tutor.test.ts`): the `hint` and `exercise` flags the tutor returns, regexes on the reply, the citation count and whether it searched.
- **Judge checks** (`judge` in a case) are what a regex can't see: "it doesn't tell him where a missed card goes, in any words". A judge model (`prompts/judge.md`, the same vendor and model as the run) reads the reply against each sentence and returns pass or fail with the reply's own words that decided it, saved as `evidence` beside the case. The idea is the grader in Anthropic's skill-creator evals: assertions about meaning, each with its evidence.
- **Runs** (`--runs N`) repeat every case. The rate is pooled over all runs, and a case that passed only some of them is listed: that is noise in the tutor, and one run would have shown it as a pass or a miss.
- **Blind comparison** (`--against <git ref or file>`) answers every case with today's `tutor.md` and with an older one, then a comparator model (`prompts/compare.md`) sees the two replies as A and B in random order, with the case's judge checks, and says which teaches better and why. It counts new wins, old wins and ties, and prints each case the old prompt won, so a prompt change shows what it lost, not only what it passes. Both prompts must fit today's reply schema. Results in `tutor-compare-<date>.json`. The idea is skill-creator's blind comparator.
- **Report**: cases passed with a 95% interval, misses with the failed checks and the start of the reply, cost and time. Results in `packages/core/eval/results/tutor-<date>.json`.

## What the first runs found (2026-11-08, Sonnet 5.5)

- 75% (9/12) on tutor@5. One real miss: after two wrong tries it gave a third hint instead of the answer, though the prompt said "or has tried twice". Two misses were the eval's: a worked example's own numbers matched the withheld answer, and "Explain …" after a question counted as not asking.
- tutor@6 counts his attempts in `earlier` and gives the answer with why on the second wrong try, and makes Quiz me's feedback on a wrong answer the right answer, not another hint. Then 92% and 100% after fixing the eval's two patterns, and 12/12 twice more after the checks were tightened (word boundaries, a fraction isn't a score, a quoted question isn't asking) and rule 3 stopped claiming Quiz me's questions.

## The judge (2026-11-08, tutor@7, Sonnet 5.5)

- Five replies written to cheat the checks, each judged once: a hint that names the answer without its words ("right back at the very beginning of the boxes"), the Anki release spelled out ("twenty-three point ten"), his own case worked through ("4 days times 2.5 gives you ten days"), praise for a wrong answer, and feedback that skips what he got right. The judge caught all five, quoting the sentence that gave each away. The regexes alone pass the first three.
- Then 3 runs of all 13 cases with the judge on: 39/39 (91–100%), no case passed only some runs, $0.87, 80 s.

## The first blind comparison (2026-11-08, tutor@7 against tutor@6, Sonnet 5.5)

- New 3, old 5, same 5, $1.11. Two of the old wins were real: on "show me" for a fact (where a missed card goes) and after two wrong tries (which release added FSRS), tutor@7 built the answer as four steps where one plain sentence was the answer. Steps (D142) are for working, and a fact has none. The checks all passed, since none asked for no steps there: the comparison found what they didn't.
- The three quiz wins went to whichever reply asked the better next question, which both prompts leave to the model: noise from one run until `--runs` shows them again.

## Limits

- 13 cases, written for this eval. Five carry judge checks; the rest are still a regex and a flag, so a hint there that gives the answer away in other words passes.
- The judge and the comparator are the same model as the tutor they check, so it shares its blind spots. Run it with another vendor (`--vendor codex`) for a second opinion.
- One turn at a time from a fixed `earlier`: it doesn't follow a whole session.
- No case yet for practice with no source open, @-mentions, or a diagram answer.

## Learn more

1. Bastani et al., [Generative AI without guardrails can harm learning](https://www.pnas.org/doi/10.1073/pnas.2422633122) (PNAS, 2025). High-school students with a plain GPT-4 tutor did better in practice and worse on the exam once it was taken away; a version that gave hints, not answers, removed the harm. The reason hints come first.
2. Kestin et al., [AI tutoring outperforms in-class active learning](https://www.nature.com/articles/s41598-025-97652-6) (Scientific Reports, 2025). A tutor built on teaching practice (one step at a time, his own reasoning first) doubled learning gains over an active-learning class in physics.
3. Pashler et al., [When does feedback facilitate learning of words?](https://doi.org/10.1037/0278-7393.31.1.3) (JEP: LMC, 2005). After a wrong answer, being shown the right one raised later recall about fivefold; feedback after a right answer did little. Why Quiz me corrects a miss with the answer.
4. Butler and Roediger, [Feedback enhances the positive effects and reduces the negative effects of multiple-choice testing](https://doi.org/10.3758/MC.36.3.604) (Memory & Cognition, 2008). Without feedback, a test can lock in the wrong answer it let him give.
