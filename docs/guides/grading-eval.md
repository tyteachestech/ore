# Grading eval

Ore's grader reads a typed answer during review and proposes a rating (Again, Hard, Good, Easy); Tyler records the real one (D21). The grading eval measures how often that proposal lands on the right side, on a fixed golden set, for each AI vendor.

```bash
bun run eval:grade                    # Claude and Codex, about a minute; spends AI usage, never in CI
bun run eval:grade --vendor claude --model claude-haiku-5-5   # one vendor, one model
bun run eval:mine                     # real reviews where Tyler and the grader disagreed (no AI)
```

## How it works

- **Golden set** (`packages/core/eval/grade-cases.json`): 20 cards, each with a question, model answer, rubric, a typed answer, a label (`right` or `wrong`) and `why`, the label's reason. 10 right, 10 wrong. Easy cases are sanity checks; partial cases test the rubric (a missing required point fails, a missing "Optionally" point doesn't); tricky cases test what fools graders: paraphrase, length, an unsure tone, misspelling, keywords without understanding, a right answer followed by a false mechanism, another language, a valid answer the model answer doesn't list, and text aimed at the grader.
- **Runner** (`packages/core/eval/grade.ts`): calls the same `gradeShown` the app uses, in a scratch library so Tyler's settings play no part, four cases at a time. Good or Easy counts as right.
- **Report**: per vendor, accuracy with its 95% Wilson interval, false passes (a wrong answer graded right), false fails, accuracy by level, cost, time and errors, plus a no-AI baseline (the answer contains the model answer). Each miss prints the label's reason beside the grader's feedback.
- **Results**: `packages/core/eval/results/grade-<date>.json`, with the model, prompt version and a fingerprint of the case set, so two runs compare only when all three match.

## Design decisions

- **Binary labels over the 1–4 scale.** Two people rarely agree on Good versus Easy, but they agree on whether he knew it. The line sits between Hard and Good because Ore's grader gives Hard for a required point missing. FSRS itself counts Hard as recalled, so a Hard from `eval:mine` needs reading before it becomes a `wrong` label.
- **False passes matter more than false fails.** A false pass schedules a card he doesn't know weeks out; a false fail only brings it back early. The report splits them so a prompt change can't hide a rise in one behind a fall in the other.
- **An interval, not a point.** With 20 cases one miss is 5 points. 20/20 only shows accuracy is at least 84%, so two graders that both score 19 or 20 can't be told apart. The interval stops overreading.
- **A baseline.** String matching scores 55% here, about what "always wrong" gets, which shows the set needs a real grader. A grader near the baseline adds nothing.
- **Reasons on every label.** A label without a reason can't be argued with. When a grader misses, the reason and its feedback side by side show whether the grader or the label is wrong.
- **Hard cases come from real use.** `eval:mine` lists reviews where Tyler's recorded rating and the grader's proposal fell on different sides, already in case format. Those are the misses that matter, so the set grows from them rather than from invented cases.
- **Not in CI.** Each run costs money and its answers vary run to run, so a red CI would mean nothing. CI tests the runner itself with a fake `claude` (`packages/core/test/eval-grade.test.ts`).

## What it found

- 2026-11-07, first set: Claude and Codex both 20/20, too easy to tell them apart. It also caught a cost bug: each `claude -p` call carried about 368k input tokens of Tyler's MCP server tools. Starting the CLI without them cut a run from $11.21 to $0.18 and 43 s to 17 s, same accuracy.
- 2026-11-08, harder set: still saturated. Claude Sonnet 5.5 20/20 ($0.185, 18 s), Codex gpt-6-astra 20/20 (526k tokens, 43 s), and Claude Haiku 5.5 20/20 ($0.012, 20 s), against a 55% baseline. So the cases are beyond string matching but not beyond any current model, and Haiku grades this set as well as Sonnet at a fifteenth of the cost. `eval:mine` found no disagreements in Tyler's library yet. The set needs real misses, or many more cases, before it can rank models.

## Limits

- 20 cases can't separate two good graders; validating a judge well takes closer to 100 labeled cases per kind of failure (Husain). Grow the set with `eval:mine`.
- One run per case: it doesn't yet measure how often a verdict flips between runs.
- One labeler (Tyler's standard, written by Claude); no second labeler to measure agreement.
- Codex runs on a subscription, so its cost shows as tokens, not dollars.

## Learn more

The few sources worth reading. Newest first; the 2023–24 ones are still where the field's terms come from.

**2025–2026**

1. Shreya Shankar and Hamel Husain, [AI Evals: Everything You Need to Know](https://hamel.dev/blog/posts/evals-faq/) (Sept 2026), and their book [Evals for AI Engineers](https://www.oreilly.com/library/view/evals-for-ai/9798341660717/) (O'Reilly, Oct 2026). The current practitioner's method: error analysis by hand first, one judge per failure mode, check the judge's true positive and true negative rates on held-out labels, Cohen's kappa over percent agreement, and 100 to 200 labeled examples per failure mode.
2. Cong et al., [Estimating LLM Grading Ability and Response Difficulty in Automatic Short Answer Grading via Item Response Theory](https://arxiv.org/abs/2605.00238) (preprint, May 2026). The closest study to this eval: grading short answers against a reference. Models with the same overall score differ in how fast they fail as answers get harder, and errors cluster on partly-correct answers. That is why this eval reports by level.
3. Norman, Rivera and Hughes, [Reliability without Validity](https://arxiv.org/abs/2606.19544) (preprint, June 2026). A large study of LLM judges: chance-corrected agreement (kappa) runs 33 to 41 points below raw agreement, judge rankings shift by up to 14 places between benchmarks, and a judge can be consistent yet biased. Test the judge on your own task, not a leaderboard.
4. Choi et al., [Diagnosing the Reliability of LLM-as-a-Judge via Item Response Theory](https://arxiv.org/abs/2602.00521) (ICML 2026). Reliability has two parts: consistency when the prompt varies, and agreement with people. This eval measures the second; repeated runs would measure the first.
5. Nkoyo et al., [Advances in Auto-Grading with Large Language Models](https://aclanthology.org/2025.bea-1.35.pdf) (BEA workshop at ACL 2025). A survey of 30 auto-grading studies. A useful bar: on 1,710 school short answers GPT-4 reached kappa 0.70 against teachers, where teachers agreed with each other at 0.75; question-specific rubrics cut grade inflation.

**Foundations (2023–2024)**

6. Hamel Husain, [Using LLM-as-a-Judge for Evaluation: A Complete Guide](https://hamel.dev/blog/posts/llm-judge/) (2024). Pass/fail labels with a written critique, a set you tune on and one you don't.
7. Zheng et al., [Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena](https://arxiv.org/abs/2306.05685) (NeurIPS 2023). The paper that named LLM judges' biases (position, verbosity, self-preference); the length and confident-but-false cases here test the verbosity one.
8. Shankar et al., [Who Validates the Validators?](https://arxiv.org/abs/2404.12272) (UIST 2024). "Criteria drift": people only settle what counts as right by grading real outputs, which is why the labels carry reasons and the set grows from real reviews.
9. Evan Miller, [Adding Error Bars to Evals](https://arxiv.org/abs/2411.00640) (2024). Treat an eval as an experiment: report uncertainty and plan how many questions you need.
