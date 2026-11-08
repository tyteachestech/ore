# Question-quality eval

The other evals check the AI that answers him (`grading-eval.md`, `ask-library.md`, `tutor-eval.md`). This one checks the AI that asks: the prequestions he guesses before reading and answers again in the in-reader quiz, and the review cards he will answer for months. A weak question costs review time on every pass, and one with no clean answer teaches him to doubt the app.

```bash
bun run eval:questions                          # Claude writes, Opus judges; spends AI usage, never in CI
bun run eval:questions --case sourdough         # one case
bun run eval:questions --vendor claude --model haiku --judge opus
```

About $1.40 and under two minutes a run on Sonnet (writer ~$0.65, judge ~$0.80).

## How it works

- **Set** (`packages/core/eval/question-cases.json`): five sources used the way he uses them. Two are real pages from the golden docs (Wikipedia's *Spaced repetition*, Python's *Classes* tutorial); three were written for this eval (`eval/question-sources/`): an opinion essay, a mechanism explainer outside his skills (sourdough), and a talk transcript. Each is added (enrich writes the prequestions), read with highlights (plain ones, a key point, a Card here line, a try with its reflection, a stray word, an aside), and finished (enrich plans the cards and turns each prequestion into a review prompt). Each case runs in its own library, so no case sees another's cards.
- **Code checks** (`codeFailures` in `eval/questions.ts`, tested in `test/eval-questions.test.ts`): a prequestion names no author and asks nothing about "the article"; a card never points at "the article", never asks to "name the three…", and keeps a short answer. A plan that makes a card of its own from a stray word or an aside is a plan miss.
- **Judge** (`eval/question-judge.md`): one call per source, on a different model from the writer (Opus by default), with the source to read. Prequestions: attemptable before reading, central, deep (why, how, what if), answered by the source. Cards: faithful (hedges kept), a clear target, no giveaway, one idea, rubric fits the question, worth months of review, standalone, distinct from the other cards, attributed when it's opinion.
- **Report**: share of questions passing every check, with a 95% interval, split into prequestions and cards; failures by check; each miss with the judge's reason. Results in `packages/core/eval/results/questions-<date>.json`, with the prompt version and a fingerprint of the set and judge.

## What the first runs found (2026-11-08, Sonnet 5.5 writing, Opus judging, enrich@11)

- Prequestions passed every check (17/17, twice): the v8 rules (ask about the idea, never the author) hold.
- Review cards passed 49% and 53%. The misses, most first: rubric points the question never asks for (a "fix" point on a "when would you…" question), the same idea asked twice (a prequestion's review prompt repeating a highlight's card), two questions joined with "and", and answers that drop the source's hedge ("tends to favour" became "favours").

## What enrich@12 changed (D146)

The plan writes each prequestion's review prompt first and folds a highlight on the same idea into it; every question asks one thing; rubric points must be asked for; hedges stay. Two runs each, same set and judge:

| | enrich@11 | enrich@12 |
|---|---|---|
| review cards passing | 51% (35/69, 39–63%) | 62% (29/47, 48–74%) |
| weak cards per run (fail any check) | 17 | 9 |
| the same idea asked twice | 12 | 1 |
| rubric point not asked for | 11 | 8 |
| two questions in one | 8 | 6 |
| prequestions passing | 34/34 | 33/33 |

The firm gain is the repeats: from 5 to 7 a run to 0 or 1, and a third fewer cards for the same five sources, so less review time for the same ideas. The pass rate rose too, but the intervals overlap: single runs on enrich@12 ranged 48% to 71% while the prompt was tuned. Two-part questions are the biggest miss left; the prompt now says so three times and a quarter of them still slip through, so the next step is probably a code check that sends them back, not more words.

## Limits

- 51 questions from five sources: one question moves the score two points, so a change smaller than the interval is noise. Run twice before trusting a move.
- The judge is a model, and models judge questions worse than experts do (Scaria et al. 2024). Its `why` lines are there to be read: a fail you disagree with is a judge prompt fix, not a writer fix.
- No case yet for notes (`from_notes`), answered questions, a partway finish, or key points drafted before the finish (the daily catch-up), and variants (`variant.md`) aren't covered.
- Ore asks open questions, not multiple choice, so there are no distractors to judge; the nearest are a variant's "choose" and "diagnose" types, which this eval doesn't run.

## Learn more

1. Matuschak, [How to write good prompts](https://andymatuschak.org/prompts/) (2020). The checklist behind the card checks: focused, precise, consistent, tractable, effortful.
2. Grévisse et al., [Docimological quality analysis of LLM-generated multiple choice questions](https://consensus.app/papers/details/c3548d3bdb6f52fd941ff29c3a0b42a6/) (SN Computer Science, 2024). LLM questions are often "broad items with ambiguous keys": the clear-target and one-idea checks.
3. Khurana et al., [AI-generated content in pre-clerkship medical training](https://consensus.app/papers/details/45846b210d6a58b68f2a4424453f586e/) (BMC Medical Education, 2025). Tuned prompts still made one wrong flashcard in 21: why faithfulness is judged against the source.
4. So et al., [Automatic generation of high-quality MCQs with LLMs](https://consensus.app/papers/details/a2cad2520231577c996ba03a2d263601/) (IEEE Access, 2025). A second model checking the first caught more than twice the flawed questions that self-checking did: why the judge isn't the writer.
5. Scaria et al., [Automated educational question generation at different Bloom's levels](https://consensus.app/papers/details/5173d33b39745781802179c439d3c819/) (2024). LLM judges are not on par with human ones: the judge's verdicts are a guide, not ground truth.
6. Pan and Carpenter, [Prequestioning and pretesting effects](https://doi.org/10.1007/s10648-023-09814-5) (Educational Psychology Review, 2023). A pretest helps when it can be attempted and is about what the reading answers: the prequestion checks.
