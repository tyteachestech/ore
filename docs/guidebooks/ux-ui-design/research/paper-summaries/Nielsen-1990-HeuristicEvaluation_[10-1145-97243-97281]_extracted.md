---
title: "Heuristic evaluation of user interfaces"
authors: [Nielsen, J., Molich, R.]
year: 1990
type: experimental
population: mixed
sample_size: 148
key_claims:
  - "Individual evaluators found only 20-51% of usability problems across four experiments (averages: 51%, 38%, 26%, 20%)"
  - "Aggregates of 3-5 evaluators find roughly two-thirds of usability problems -- the point of diminishing returns is ~10 evaluators"
  - "Problem-finding is not strictly cumulative: poor evaluators sometimes find hard problems; good evaluators sometimes miss easy ones"
  - "Nine heuristics reduce the ~1,000-rule guideline standard by two orders of magnitude while capturing a large proportion of observable problems"
  - "Evaluators should work independently before comparing results -- group collaboration during evaluation reduces variety of problems found"
doi: "10.1145/97243.97281"
pmid: ""
evidence_grade: foundational
scope_flag: include
inflation_flag: none
---

# Heuristic Evaluation of User Interfaces

## Study Overview
- **Citation**: Nielsen, J. & Molich, R., 1990
- **Study Type**: Experimental (four empirical tests of the heuristic evaluation method)
- **Sample**: n=148 total evaluators across four experiments (37 CS students + 77 industry professionals + 34 CS students split across two experiments)
- **Venue**: CHI '90, Proceedings of the SIGCHI Conference on Human Factors in Computing Systems
- **DOI**: 10.1145/97243.97281
- **Total citations**: 1,923 (as of download date)

## Key Findings

- **Finding 1 -- Individual evaluators are poor at heuristic evaluation**: Average proportion of usability problems found across four experiments was 51%, 38%, 26%, and 20% respectively. Even in the best case, a single evaluator found only about half the problems.
  - Effect size: Not reported as Cohen's d. Proportions reported directly.
  - Best individual evaluator across experiments found roughly 60-90% of problems; worst found 0-10%.

- **Finding 2 -- Aggregating evaluators dramatically improves coverage**: Coverage grows rapidly from 1 to ~5 evaluators, then flattens. Five evaluators typically find about two-thirds of usability problems. Diminishing returns reached at ~10 evaluators.
  - Data source: Monte Carlo simulation across 5,000-9,000 random aggregates per experiment.
  - Recommendation derived: 3-5 evaluators is the practical optimum; additional resources better spent on other evaluation methods.

- **Finding 3 -- Problem-finding is not hierarchically ordered**: Good evaluators sometimes miss easy problems; poor evaluators sometimes find hard ones. Findings approximate (but do not fully satisfy) a Guttman scale (average reproducibility R=0.85, but coefficient of scalability = 0.06, indicating the scale is not truly unidimensional).

- **Finding 4 -- Low false positive rate**: Few evaluators flagged non-problems. False positives, when they occurred, were rarely flagged by more than one evaluator -- the group can self-correct.

- **Finding 5 -- Nine usability heuristics provide a practical rule base**: The original nine heuristics (Table 1) were derived from years of teaching/consulting and "explain a very large proportion of the problems one observes in user interface designs." They condense ~1,000 guidelines into a learnable set.

- **Finding 6 -- Interface persistence affects evaluation difficulty**: Voice response interfaces were the hardest to evaluate heuristically because they have "extremely low persistence" -- system messages disappear immediately, giving evaluators no time to study details.

- **Finding 7 -- Even experts are imperfect**: The authors' own master list of known problems had to be updated after experiments, because evaluators discovered problems the authors had not originally identified.

## Effect Sizes (Raw Values)

Individual evaluator performance (proportion of known problems found):

| Experiment | Interface | Known Problems | Average Found | Best | Worst |
|------------|-----------|---------------|---------------|------|-------|
| 1 | Teledata (videotex) | 52 | 51% | ~80-89% range | ~10% |
| 2 | Mantel (phone info system) | 30 | 38% | ~70-79% range | 0% |
| 3 | Savings (voice response) | 48 | 26% | ~50-59% range | ~5% |
| 4 | Transport (voice response) | 34 | 20% | ~40-49% range | ~5% |

Aggregate evaluator performance (approximate from Figure 4 and Table 4):

- 1 evaluator: ~20-51% (experiment-dependent)
- 3-5 evaluators: ~60-75% across experiments
- 10 evaluators: ~80-85% (approximate point of diminishing returns)
- 15-30 evaluators: marginal additional gains

Cross-experiment individual consistency: R²=0.33 (p<0.01) -- only weak correlation between an evaluator's performance in one experiment and the next on similar interfaces.

## Mechanisms & Moderators

- **Mechanism -- Variety in cognitive approach**: The aggregate benefit arises because different evaluators notice different problems. Independent evaluation preserves this variety; group evaluation during the initial phase would reduce it by anchoring evaluators to a shared framing.

- **Moderator -- Interface persistence (modality)**: Voice/audio interfaces are harder to evaluate because messages are ephemeral. Visual/screen interfaces allow evaluators to study at leisure. This explains why voice response experiments (3 & 4) had the lowest individual performance.

- **Moderator -- Interface complexity**: Harder interfaces produce larger individual differences between evaluators (Q3/Q1 ratio widens). Individual evaluator variance tracks with task difficulty.

- **Moderator -- Evaluator expertise (indirect)**: Authors assert usability experts would outperform average computer professionals, but do not test this directly in this paper. Experiments 1, 3, and 4 used CS students with heuristics training; Experiment 2 used industry professionals without that training.

- **Moderator -- Heuristic training**: Evaluators in Experiments 1, 3, and 4 received a lecture on the nine heuristics beforehand. Experiment 2 evaluators (industry professionals) did not -- yet performance in Experiment 2 was moderate (38%), suggesting domain experience partially compensates.

## Study Design Details

- **Method**: Evaluators given interface (paper prototype or running system) and asked to write a report identifying usability problems as precisely as possible. Reports matched against a master list of known problems.
- **Scoring**: Liberal -- credit given for mentioning a problem even without complete description.
- **Aggregates**: Constructed post-hoc via Monte Carlo simulation (5,000-9,000 random draws per aggregate size per experiment), not via real group sessions.
- **Known problem lists**: Revised after initial review -- some evaluator-discovered problems added to master list.
- **Blinding**: Evaluators worked independently.

## Limitations

- **Small-scale interfaces only**: All four interfaces were relatively small. Authors explicitly note unknown applicability to large-scale interface designs.
- **No empirical validation of problems**: The master lists of "known usability problems" were not independently validated through user testing. Authors acknowledge this but argue that (a) problems align with established usability knowledge and (b) the aggregate of 34+ evaluators serves as a form of empirical support.
- **Aggregate data is simulated, not real**: The aggregate performance curves come from Monte Carlo sampling of individual data -- no actual group heuristic evaluation was run. The assumption of a "perfect authority" to synthesize reports is untested.
- **Low generalizability of individual evaluator performance**: R²=0.33 across experiments suggests evaluator ability is not stable -- someone good at evaluating one interface may not be good at the next.
- **Evaluator population**: Three of four experiments used CS students, not working designers or UX professionals. One experiment used industry professionals without heuristic training.
- **Year**: 1990 -- interfaces tested were text-based, voice, and specification-only designs; no graphical UIs. Modern GUI and mobile app findings may differ in specifics but broad conclusions are widely replicated.
- **No measures of problem severity**: All problems treated equally; no weighting by frequency or severity of impact on users.

## Population Scope Assessment

- **Population**: Mixed (CS students + industry professionals)
- **Relevance to non-designer building Apple apps**: High -- the nine heuristics and the 3-5 evaluator recommendation are directly applicable to design review practices for any interface
- **Red flags**: None. This is a foundational methodology paper for practical usability evaluation.

## Conclusions

"This study shows that heuristic evaluation is difficult and that one should not rely on the results of having a single person look at an interface. The results of a heuristic evaluation will be much better if you have several people conduct the evaluation, and they should probably do so independently of each other."

Authors recommend 3-5 evaluators as the optimal range, with additional resources directed to alternative evaluation methods (e.g., think-aloud testing). Key advantages of heuristic evaluation: cheap, intuitive, requires no advance planning, usable early in the development process. Key disadvantage: identifies problems without necessarily suggesting solutions; biased by evaluators' current mindset.

## Named Frameworks

- **Nine Usability Heuristics** (original formulation, later refined into the canonical 10 in Nielsen 1994)
  - Components:
    1. Simple and natural dialogue
    2. Speak the user's language
    3. Minimize user memory load
    4. Be consistent
    5. Provide feedback
    6. Provide clearly marked exits
    7. Provide shortcuts
    8. Good error messages
    9. Prevent errors
  - Research alignment:
    - All nine -> directly tested as the framework evaluators applied in Experiments 1, 3, and 4
    - Performance data shows these are "difficult to apply in practice" despite seeming obvious

---

## Extraction Notes

This is a foundational methodology paper, not a study of a specific intervention effect. The primary value for the guidebook is:

1. **The nine heuristics themselves** -- the original list that became the canonical 10. Useful for the chapter on design evaluation/self-review.

2. **The 3-5 evaluator finding** -- a pragmatic, quantified prescription that translates directly into advice for a solo developer: "get 3-5 people to review your UI independently before comparing notes."

3. **The independence principle** -- evaluators should not discuss findings until after individual reports are complete. This is counterintuitive (most people would do a walkthrough together) and is worth highlighting.

4. **No effect sizes in the conventional sense** -- this paper reports proportions and counts, not Cohen's d or similar. The "effect" is the coverage gain from aggregation, which is substantial but reported descriptively via curves and tables.

The paper is often cited alongside Nielsen (1994) "How to Conduct a Heuristic Evaluation" which provides the refined 10-heuristic list. Consider pairing these in the guidebook.

No inflation flag applicable -- this is a methodology origin paper, not an inflated domain.
