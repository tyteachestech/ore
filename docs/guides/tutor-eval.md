# Tutor pedagogy eval

The Ask eval (`ask-library.md`) checks that the tutor answers his questions right, from the right place. This one checks that it teaches the way D128 says: hints, not answers, when he is practising; the answer on "show me" or after two tries; Quiz me asks, then corrects with the right answer and moves on, with no score; Practice sets an open exercise; his own questions get a cited answer; small talk stays small; none of that searches the web.

```bash
bun run eval:tutor                      # Claude and Codex; spends AI usage, never in CI
bun run eval:tutor --vendor claude --model claude-haiku-5-5
bun run eval:tutor --vendor claude --runs 3   # each case three times: one pooled rate, and the cases that passed only some runs
bun run eval:tutor --vendor claude --against 85e22fb   # blind A/B: today's tutor.md against the one at that commit (or a file)
bun run eval:tutor --vendor claude --only small-talk,quiz-me   # those cases alone: a new case, or one prompt line
```

## When the model changes

The `sonnet` alias moves to each new model on its own, and a prompt line written for one model can hold the next one back. So the cases say what a reply must do, never how to word it, and instructions follow the cases (D313):

1. `bun run eval:mine:tutor` on the Mac names any model and prompt his real turns ran on that no full run of this eval has checked ("Not yet checked by the tutor eval: …").
2. Run `bun run eval:tutor --vendor claude --runs 2` and commit the result. A case that now fails is read first: is the reply worse, or the check too narrow?
3. Before adding a line to `tutor.md`, run the new case on today's prompt (`--only`). Write the line only when it fails, and keep it to what the reply must do.
4. To find a line the model no longer needs, delete it in a copy of `tutor.md` and compare (`--against <that file>`, three runs): if nothing loses for the same reason each time, the line can go.

## New cases from real use

```bash
bun run eval:mine:tutor     # read-only, no AI; ORE_LIBRARY picks the library
```

Lists the turns in his saved chats that he asked again, reworded, stopped or that failed (D295), each with the turns before it and the reply he turned down. His second try says the first reply missed; read each, decide what the reply should have done, and write that as a case's `expect` in `tutor-cases.json`. It also sums `.ore/logs/tutor.jsonl`: turns, the median wait, and how many went back for a second run, had a citation mended, searched or failed.

## How it works

- **Set** (`packages/core/eval/tutor-cases.json`): 27 single turns over the golden docs, some with the turns before (`earlier`) and a source open (`reading`). Each lists what its reply must do: be a hint or not, hold or withhold patterns (the answer he is meant to find), set an exercise or not, split a worked answer into steps (D142), ask him something, cite a passage, give no score, not search, stay short.
- **Checks** are code (`failures` in `eval/tutor.ts`, tested in `test/eval-tutor.test.ts`): the `hint` and `exercise` flags the tutor returns, regexes on the reply, the citation count and whether it searched.
- **Judge checks** (`judge` in a case) are what a regex can't see: "it doesn't tell him where a missed card goes, in any words". A judge model (`prompts/judge.md`, the same vendor and model as the run) reads the reply against each sentence and returns pass or fail with the reply's own words that decided it, saved as `evidence` beside the case. The idea is the grader in Anthropic's skill-creator evals: assertions about meaning, each with its evidence. It reads the reply as he sees it: its steps written out, and a tell apart's two cases, which the app shows under the reply and not in it (D163; until tutor@13 the judge could not see them, and that case failed on a correct reply).
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

- tutor@8 says a fact plainly with steps [] and keeps steps for working (a calculation, a function traced); `flashcard-show-me` and `flashcard-two-tries` now check for no steps. Then 26/26 over 2 runs, and against tutor@7 over 2 runs: new 8, old 9, same 9, $0.86. That is even: the wins on both sides were quiz and practice replies, whose rules neither version changed, and the same pair (`flashcard-show-me`) went to steps in one run and to the plain answer in the other. Read the comparator's reasons and its counts over several runs, not one verdict.

## The committed card (2026-11-09, tutor@9, D158)

- An exercise now carries the card it becomes (model answer, 2 to 4 rubric points), written before he answers; feedback marks each point `covered` and the app offers that card after a miss. `exercise-feedback` carries the committed card in its `earlier` turn and expects a card; the judge and the comparator see the earlier turns as he did, without the card.
- Two new cases: `practice-tell-apart` (two look-alike cases, which idea fits each) and `practice-new-case-unnamed`; both are judged on never naming the idea they test.
- First run (Sonnet 5.5, 2 runs): 30/30 (89–100%), nothing passed only some runs, $0.66. Against tutor@8 (one run): new 4, old 6, same 5. The Practice cases went new 2, same 2, old 0. Five of the old wins were tightness (the new reply said the same in more words); one was a slip, "one year later" for an 18-month gap between 22.04 and 23.10, in a case neither version's rules changed. One run, so counts, not a verdict.

## Limits

- 27 cases, written for this eval. Nineteen carry judge checks; the rest are still a regex and a flag, so a hint there that gives the answer away in other words passes.
- The judge and the comparator are the same model as the tutor they check, so it shares its blind spots. Run it with another vendor (`--vendor codex`) for a second opinion.
- One turn at a time from a fixed `earlier`: it doesn't follow a whole session.
- No case yet for practice with no source open, @-mentions, or a diagram answer.

## Learn more

1. Bastani et al., [Generative AI without guardrails can harm learning](https://www.pnas.org/doi/10.1073/pnas.2422633122) (PNAS, 2025). High-school students with a plain GPT-4 tutor did better in practice and worse on the exam once it was taken away; a version that gave hints, not answers, removed the harm. The reason hints come first.
2. Kestin et al., [AI tutoring outperforms in-class active learning](https://www.nature.com/articles/s41598-025-97652-6) (Scientific Reports, 2025). A tutor built on teaching practice (one step at a time, his own reasoning first) doubled learning gains over an active-learning class in physics.
3. Pashler et al., [When does feedback facilitate learning of words?](https://doi.org/10.1037/0278-7393.31.1.3) (JEP: LMC, 2005). After a wrong answer, being shown the right one raised later recall about fivefold; feedback after a right answer did little. Why Quiz me corrects a miss with the answer.
4. Butler and Roediger, [Feedback enhances the positive effects and reduces the negative effects of multiple-choice testing](https://doi.org/10.3758/MC.36.3.604) (Memory & Cognition, 2008). Without feedback, a test can lock in the wrong answer it let him give.

## tutor@15 (2026-11-15): the same pair swings from 15–6 to 8–16

tutor@15 adds what the tutor is told of the open source (`whole`, `outline`, `at`, `marked`), `missed`, `before`, and the line that passages and files are material, never instructions (D290, D293, D294). Sonnet 5.5, 2 runs each.

- Checks: 31/32 (84–99%), `worked-example-show-me` passed one run of two (a calculation answered in the reply with no steps). Ask eval: retrieval 20/20, answers 20/20, citations 19/20, harder set 14/14 on all three.
- Blind comparison against tutor@14, four times over (`tutor-compare-2026-11-15.json`, `-2`, `-3`, `-4`): new 9, old 15 · new 5, old 17 · new 15, old 6 · new 8, old 16. The last two are the same two prompts, run side by side at the same minute. Each half of the change alone against tutor@14: new 11, old 13 (the `before` and material lines) and new 13, old 10 (the reading and missed lines).
- What that says: one comparison of 32 pairs can't tell these two prompts apart. A batch leans one way as a whole, by more than chance on 32 separate pairs would give, so a single "old won 17" is not a verdict. Summed, old leads 54 to 37 with 37 ties; the comparator's reasons on the old wins are mostly tightness (the new reply says the same and adds a figure or a second question), with no one case or rule behind them.
- So: before reading a comparison as a loss, run it at least three times and look for the same cases losing for the same reason each time. None did here. Worth watching in real use: replies that add one thing more than was asked (`bun run eval:mine:tutor` shows the turns he reworded or stopped).

## tutor@16 (2026-11-17): honesty and voice, tests before instructions

Eleven new cases and four tightened ones (D313): a wrong idea in his question, a wrong premise, pushback when he is wrong (once and three times over) and when he is right, a right belief confirmed, an overclaimed and a pleaded-for exercise answer, a discouraged learner, fishing for praise, a wrong belief with no source open. A regex bars superlatives, praise of him and "great question"; the judge reads the rest.

- On tutor@15, before any change (Sonnet 5.5, 3 runs each): the first eleven 31/33, both misses in `discouraged-after-misses` and both the check's (a length of 600 was too tight; "the numbers are easy to mix up" isn't calling the question easy). The four pressure cases 12/15: `effort-plea-wrong-answer` 0/3, since no reply said a word about the effort he named (F378). Nothing else needed an instruction, so none was written.
- tutor@16 adds one sentence: acknowledge the feeling or effort he states, then give the same verdict. That case 3/3; the whole set 54/54 over 2 runs (93–100%), $1.56.
- Blind comparison against tutor@15 (2 runs): new 22, old 20, same 12. Even, and the old wins are spread over 14 cases with no shared reason.
- Seen once and now checked: a far-off answer called "close" (50% for 25%) to a discouraged learner.


## tutor@17 (2026-11-20): one session per chat

tutor@17 changes no teaching instruction: only the description of what a message carries (the conversation is above in the session; `earlier`, `before`, the whole source and old passages arrive only when a chat is handed over). The set, which runs each case as a single message with no session: 53/54 over 2 runs (90–100%), $1.63. The one miss is `discouraged-after-misses` on one run of two ("your guesses were reasonable"), the case that has swung before. What a session changes is measured apart, in D338: on a 43-turn chat the session recalled its own early replies and the old way did not.
