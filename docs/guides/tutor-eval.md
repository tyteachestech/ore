# Tutor pedagogy eval

The Ask eval (`ask-library.md`) checks that the tutor answers his questions right, from the right place. This one checks that it teaches the way D128 says: hints, not answers, when he is practising; the answer on "show me" or after two tries; Quiz me asks, then corrects with the right answer and moves on, with no score; Practice sets an open exercise; his own questions get a cited answer; small talk stays small; none of that searches the web.

```bash
bun run eval:tutor                      # Claude and Codex; spends AI usage, never in CI
bun run eval:tutor --vendor claude --model claude-haiku-5-5
```

## How it works

- **Set** (`packages/core/eval/tutor-cases.json`): 12 single turns over the golden docs, some with the turns before (`earlier`) and a source open (`reading`). Each lists what its reply must do: be a hint or not, hold or withhold patterns (the answer he is meant to find), set an exercise or not, ask him something, cite a passage, give no score, not search, stay short.
- **Checks** are code (`failures` in `eval/tutor.ts`, tested in `test/eval-tutor.test.ts`): the `hint` and `exercise` flags the tutor returns, regexes on the reply, the citation count and whether it searched.
- **Report**: cases passed with a 95% interval, misses with the failed checks and the start of the reply, cost and time. Results in `packages/core/eval/results/tutor-<date>.json`.

## What the first runs found (2026-11-08, Sonnet 5.5)

- 75% (9/12) on tutor@5. One real miss: after two wrong tries it gave a third hint instead of the answer, though the prompt said "or has tried twice". Two misses were the eval's: a worked example's own numbers matched the withheld answer, and "Explain …" after a question counted as not asking.
- tutor@6 counts his attempts in `earlier` and gives the answer with why on the second wrong try, and makes Quiz me's feedback on a wrong answer the right answer, not another hint. Then 92% and 100% after fixing the eval's two patterns.

## Limits

- 12 cases, written for this eval; a pass is a regex and a flag, not a judgment of the teaching. A hint that gives the answer away in other words passes.
- One turn at a time from a fixed `earlier`: it doesn't follow a whole session.
- No case yet for practice with no source open, @-mentions, or a diagram answer.

## Learn more

1. Bastani et al., [Generative AI without guardrails can harm learning](https://www.pnas.org/doi/10.1073/pnas.2422633122) (PNAS, 2025). High-school students with a plain GPT-4 tutor did better in practice and worse on the exam once it was taken away; a version that gave hints, not answers, removed the harm. The reason hints come first.
2. Kestin et al., [AI tutoring outperforms in-class active learning](https://www.nature.com/articles/s41598-025-97652-6) (Scientific Reports, 2025). A tutor built on teaching practice (one step at a time, his own reasoning first) doubled learning gains over an active-learning class in physics.
3. Pashler et al., [When does feedback facilitate learning of words?](https://doi.org/10.1037/0278-7393.31.1.3) (JEP: LMC, 2005). After a wrong answer, being shown the right one raised later recall about fivefold; feedback after a right answer did little. Why Quiz me corrects a miss with the answer.
4. Butler and Roediger, [Feedback enhances the positive effects and reduces the negative effects of multiple-choice testing](https://doi.org/10.3758/MC.36.3.604) (Memory & Cognition, 2008). Without feedback, a test can lock in the wrong answer it let him give.
