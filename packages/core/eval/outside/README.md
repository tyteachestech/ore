# Outside data for the evals

The golden sets (`grade-cases.json`, `ask-cases.json`) are written for Ore and every model scores them 20/20, so they can't rank graders or show a prompt change working. These slices come from public datasets other people labeled, with answers real students wrote, so the labels aren't Ore's own and the hard cases are the ones the field finds hard. Every file here is drawn by `sample.ts` with a fixed seed from the download named below, so a case can be traced to its origin and a bigger slice drawn the same way.

| File | From | Rows | License | Cite |
|---|---|---|---|---|
| `grade-saf.json` | [SAF: Short Answer Feedback, communication networks (English)](https://huggingface.co/datasets/Short-Answer-Feedback/saf_communication_networks_english), split `test_unseen_answers` (375 rows, 26 questions) | 60: 20 Correct, 20 Partially correct, 20 Incorrect | CC BY 4.0 | Filighera, Parihar, Steuer, Meuser and Ochs, [Your Answer is Incorrect… Would you like to know why?](https://aclanthology.org/2022.acl-long.587) (ACL 2022) |
| `grade-scientsbank.json` | [SciEntsBank](https://huggingface.co/datasets/nkazi/SciEntsBank) (SemEval-2013 Task 7), split `test_ua` (540 rows, 135 questions) | 83: 20 correct, 20 contradictory, 20 partially_correct_incomplete, 20 irrelevant, all 3 non_domain | CC BY 4.0 (as published on Hugging Face) | Dzikovska et al., [SemEval-2013 Task 7: The Joint Student Response Analysis and 8th Recognizing Textual Entailment Challenge](https://aclanthology.org/S13-2045/) (2013); the answers from Nielsen, Ward and Martin (2008) |
| `ask-squad.json`, `squad-docs/` | [SQuAD 2.0](https://rajpurkar.github.io/SQuAD-explorer/) dev set (35 Wikipedia articles) | 6 articles; 30 questions a paragraph answers in at most three words; 12 unanswerable | CC BY-SA 4.0 (the articles' text is Wikipedia's, same license; each doc's frontmatter names its page) | Rajpurkar, Jia and Liang, [Know What You Don't Know: Unanswerable Questions for SQuAD](https://aclanthology.org/P18-2124/) (ACL 2018) |

All three licenses allow redistribution with attribution, so the slices live in this AGPL-3.0-or-later repo under their own terms (D120). Considered and left out: SciQ (CC BY-NC 3.0, non-commercial), ASAP-SAS (Kaggle competition terms), the Mohler/Texas CS set (no stated license), Beetle (the SRA corpus's other half: dialogue-shaped questions that need their transcript).

## How the labels map onto Ore's

Ore's grader proposes 1–4 and the eval draws its line between Hard (2) and Good (3): `right` means Good or Easy. The datasets' verdicts map onto that line the way Ore's own rule does (a required point missing is Hard, so `wrong`):

- SAF `Correct` → right; `Partially correct` and `Incorrect` → wrong. `why` is the teachers' own feedback, with their score.
- SciEntsBank `correct` → right; `contradictory`, `partially_correct_incomplete`, `irrelevant`, `non_domain` → wrong.
- `level` keeps the dataset's own label (`correct`, `partial`, `incorrect`; `correct`, `contradictory`, `incomplete`, `irrelevant`, `non_domain`), so the report's "by level" shows where a grader fails: the literature (Cong et al. 2026) and SAF's authors both find partly-correct answers are where graders disagree.
- SQuAD: an answer is right when the reply holds any annotator's span (joined as alternatives); the citation is right when a quote from the article holds it. Unanswerable questions go in `absent`: right means the reply says the article doesn't hold it. SQuAD's known noise stays: a few questions only make sense beside their paragraph ("When was the colony destroyed?") and annotators sometimes marked different spans.

These are not Ore's cards: the reference answers are long and have no rubric, the students were graded on a course's standard, and SciEntsBank's are children's sentences. So a miss here is a reading, not a bug, until a case is checked by hand. The split is skewed (29% right), which is why the report carries Cohen's kappa beside accuracy.

## Redrawing

```bash
# download: the two parquet files and SQuAD dev as saf.parquet, seb.parquet, squad.json in one folder
bun packages/core/eval/outside/sample.ts <that folder>
```

Change a seed or a count in `sample.ts` for a different slice; the `about` line in each file says what was drawn.

## Running

```bash
bun run eval:grade --vendor claude --cases packages/core/eval/grade-cases.json --cases packages/core/eval/outside/grade-saf.json --cases packages/core/eval/outside/grade-scientsbank.json --runs 2
bun run eval:ask --vendor claude --library big --cases packages/core/eval/outside/ask-squad.json
```
