---
title: "A Meta-analysis of the Worked Examples Effect on Mathematics Performance"
authors: [Barbieri, C.A., Miller-Cotto, D., Clerjuste, S.N., Chawla, K.]
year: 2023
type: meta-analysis
population: student
sample_size: 181 effect sizes across 55 studies (43 articles)
key_claims:
  - "Worked examples produce a medium effect on mathematics performance: g=0.48 (95% CI [0.36, 0.60]), p=0.01"
  - "After publication bias trim-and-fill correction: g=0.44 (95% CI [0.32, 0.56]), p=0.0001 — effect remains robust"
  - "Correct examples alone significantly boost the effect (β=0.26, p=0.03); incorrect examples alone or combined with correct examples do not"
  - "Adding self-explanation prompts to worked examples significantly reduces the effect (β=-0.24, p=0.04)"
  - "Timing of use (practice vs. initial skill acquisition) does not significantly moderate the effect (β=-0.15, p=0.38)"
  - "High heterogeneity across studies: I²=93.72%, indicating substantial unexplained variance"
doi: "10.1007/s10648-023-09745-1"
pmid: unknown
evidence_grade: foundational
scope_flag: include-with-caution
inflation_flag: none
---

# A Meta-analysis of the Worked Examples Effect on Mathematics Performance

## Study Overview
- **Citation**: Barbieri, C.A., Miller-Cotto, D., Clerjuste, S.N., & Chawla, K. (2023)
- **Study Type**: Meta-analysis (RVE — Robust Variance Estimation)
- **Sample**: k=43 articles, 55 studies, n=181 effect sizes; populations span elementary through postsecondary (predominantly middle and high school)
- **DOI**: 10.1007/s10648-023-09745-1
- **PMID**: Unknown

> **K-12 context flag:** The vast majority of included studies come from K-12 and postsecondary mathematics classrooms. The mechanism (cognitive load reduction via step-by-step modeling) transfers readily to Tyler's tutorial context, but the population is not adult async video learners. Weight the directional findings and the mechanism; treat the precise effect size as an upper bound for a tutorial context.

## Key Findings

- **Finding 1 — Overall worked examples effect**: Studying worked examples improves mathematics performance by approximately half a standard deviation compared to problem-solving-only controls.
  - Effect size: g=0.48 (95% CI [0.36, 0.60]), p=0.01
  - Heterogeneity: I²=93.72%, τ²=0.5854 — substantial; the average masks wide variation

- **Finding 2 — Publication bias robustness**: Egger's test indicated significant publication bias (B=-0.45, z=5.87, 95% CI [-0.78, -0.12], p<0.0001). After trim-and-fill correction, the effect remains positive and significant.
  - Trim-and-fill adjusted: g=0.44 (SE=0.06, 95% CI [0.32, 0.56]), p=0.0001
  - Fail-safe N: 13,915 studies would be needed to nullify the finding

- **Finding 3 — Correct examples outperform incorrect examples**: Conditions using correct worked examples alone yielded larger effect sizes than conditions using incorrect examples alone or incorrect combined with correct examples.
  - Moderator coefficient: β=0.26, p=0.03 (significant, positive direction)
  - Correct examples: n=139 effect sizes (77% of total)
  - Incorrect examples alone or combined: n=42 effect sizes (23% of total)

- **Finding 4 — Self-explanation prompts reduce the effect**: Adding self-explanation prompts to worked examples is associated with a significantly lower effect size compared to worked examples without prompts.
  - Moderator coefficient: β=-0.24, p=0.04 (significant, negative direction)
  - Without prompts: n=124 effect sizes (69%)
  - With prompts: n=57 effect sizes (31%)

- **Finding 5 — Timing of use does not moderate the effect**: Whether worked examples were used for initial skill acquisition vs. practice after instruction did not significantly differ.
  - Moderator coefficient: β=-0.15, p=0.38 (non-significant)
  - Initial acquisition: n=99 effect sizes; Practice: n=82 effect sizes

- **Finding 6 — Prior knowledge moderation (descriptive, not statistical)**: Of 12 manuscripts testing aptitude-by-treatment interactions, 10 found at least one significant interaction. Direction was inconsistent:
  - 3 studies found high prior knowledge benefited more from worked examples
  - 5 studies (Booth, Barbieri & colleagues) found low prior knowledge benefited more — specifically from incorrect examples alone or combined with correct examples
  - 4 studies found no significant prior knowledge interaction

## Effect Sizes (Raw Values)

- **Overall worked examples effect**: g=0.48 (95% CI [0.36, 0.60]), p=0.01; k=43 articles, 55 studies, 181 effect sizes
- **Publication-bias corrected (trim-and-fill)**: g=0.44 (95% CI [0.32, 0.56]), p=0.0001
- **Moderator: Correct examples** (vs. incorrect or combined): β=0.26 (SE=0.10), p=0.027
- **Moderator: Self-explanation prompts** (present vs. absent): β=-0.24 (SE=0.11), p=0.042
- **Moderator: Used for practice** (vs. skill acquisition): β=-0.15 (SE=0.16), p=0.378
- Heterogeneity: I²=93.72%, τ²=0.5854
- Raw effect size range across all effect sizes: -0.88 to 4.66 (38 negative, 4 zero, 139 positive)

## Mechanisms & Moderators

- **Primary mechanism — Cognitive Load Theory (CLT)**: Traditional problem-solving imposes high extraneous cognitive load on novices (means-ends analysis). Worked examples allow learners to devote cognitive effort to studying relevant features and developing problem-type schemata, bypassing the load of generating solution steps. This is the theoretical foundation for the effect.

- **Expertise-reversal effect**: As learners gain expertise, the advantage of worked examples diminishes and may reverse — problem-solving becomes more effective than examples for advanced learners. This is theoretically established but the moderator analysis of timing (acquisition vs. practice) did not detect it statistically, possibly because the distinction is too coarse.

- **Moderator: Example correctness**: Correct examples outperform incorrect (alone or combined). Mechanism is unclear from CLT alone — authors suggest correct examples may more efficiently build accurate problem-solving schemata for performance tasks (which 93% of included studies used). Incorrect examples may be better for misconception reduction, which is underrepresented in the outcome measures.

- **Moderator: Self-explanation prompts** (counterintuitive finding): Adding prompts reduces the overall effect. Proposed explanations:
  - Prompt quality varies widely — poor self-explanations are associated with worse learning
  - Redundancy effect: prompts and examples may present the same information in two forms, increasing rather than reducing load
  - Interaction with prior knowledge: students with high misconception rates may benefit from prompts; average students may not

- **Moderator: Prior knowledge** (descriptive): Low prior knowledge learners appear to benefit more from incorrect examples or combined example types. High prior knowledge learners show mixed or reversed patterns. No statistical summary possible due to pretest heterogeneity across studies.

## Study Design Details

- **Intervention**: Worked examples (correct, incorrect, faded, or combinations) in mathematics, either alone or paired with practice problems, implemented via teacher, researcher, or computerized tutor
- **Control/Comparison**: Non-worked-examples control — either business-as-usual instruction or problem-solving practice only
- **Setting**: 91% conducted in schools (65% classroom context, 26% pull-out); 7% laboratory. ~50% USA, ~50% international (Germany, China, Australia, etc.)
- **Content domain**: Primarily algebra and geometry (60% of manuscripts); also arithmetic, statistics, proportional reasoning
- **Grade range**: Elementary through postsecondary; most studies at middle school and above; only 5 studies at elementary level
- **Random assignment**: 53/55 studies used random assignment; 2 quasi-experimental
- **Outcome type**: 93% used percent accuracy on performance measures; errors/misconceptions in 7%
- **Coding reliability**: Inter-rater agreement 91.40–100% depending on variable; all discrepancies resolved by discussion

## Limitations

- **Population is K-12/math, not adult tutorial learners**: All findings are from formal education contexts. Transfer to Tyler's async adult video tutorial format is theoretically sound but empirically untested in this meta.
- **Moderator analyses are descriptive, not causal**: Moderator variables (correctness, prompts, timing) were not always experimentally manipulated within individual studies — comparisons collapse across studies, not within. Causal claims about moderators are not warranted.
- **Prior knowledge could not be statistically moderated**: Only 45% of effect sizes had pretest measures; measures varied too widely for statistical synthesis. The descriptive summary of 12 manuscripts is the best available, but is inconclusive.
- **Dosage unquantifiable**: Studies ranged from a single 25-minute session to a full academic year. Dosage was not codeable from most articles. A dosage-response analysis was not possible. Higher dosage likely yields larger effects.
- **93% accuracy outcomes**: Almost no studies measured misconception reduction, conceptual knowledge, or transfer as primary outcomes. Findings on correct vs. incorrect examples may reverse if these outcomes were targeted.
- **English-only restriction**: Studies not written in English were excluded. ~50% of included studies were from the USA; English-language bias likely.
- **Collapsing incorrect + combined into one category**: The authors had to merge "incorrect examples alone" with "incorrect + correct combined" due to insufficient k for separate estimates. These may have different effects.
- **High heterogeneity (I²=93.72%)**: The three moderators tested explain only a portion of variance. Many other study characteristics drive the wide range of effects — the average g=0.48 should be understood as a central tendency across highly variable conditions.
- **Conflict of interest**: None declared.

## Population Scope Assessment

- **Population**: Student (elementary through postsecondary); predominantly middle school and high school mathematics learners
- **Relevance to Tyler's tutorial context**: Medium-High for the mechanism and directional findings; the core CLT explanation is domain-general and transfers to any instructional content. The specific magnitude (g=0.48) applies to math students in classrooms, not adult async video learners.
- **Red flags**: None for exclusion. No clinical population, no hard addiction, no compulsive behavior. Flag as K-12/classroom context per domain-config.

## Conclusions

"The current meta-analysis confirms that studying worked examples alone or paired with similar practice problems are moderately effective at improving learners' mathematics performance across the school years, compared to solving practice problems alone." (Conclusions, p.28)

The effect is robust to publication bias correction (g=0.44 after trim-and-fill). Correct examples are more effective than incorrect examples for accuracy outcomes. Self-explanation prompts, counterintuitively, reduce the overall worked examples effect — potentially due to prompt quality variability and redundancy effects. Timing of use (acquisition vs. practice) does not significantly moderate the effect. Prior knowledge interactions exist but are inconsistent in direction across studies.

## Named Frameworks (if applicable)

- **Framework**: Cognitive Load Theory (CLT)
  - Components: Intrinsic load (element interactivity of material), Extraneous load (instructional design inefficiency), Germane load (schema formation)
  - Research alignment:
    - Worked examples reduce extraneous load by eliminating means-ends analysis -> enables schema acquisition
    - Self-explanation prompts may increase extraneous load if redundant with example content
    - Expertise-reversal effect -> as intrinsic load decreases with expertise, worked examples become less necessary

- **Framework**: Two-Phase Model of Skill Acquisition (Anderson et al., 1997; VanLehn, 1996)
  - Components: Acquisition phase (initial schema building), Practice phase (refinement and automatization)
  - Research alignment:
    - Worked examples theoretically most effective in acquisition phase -> not confirmed statistically in this meta (β=-0.15, p=0.38), but direction is consistent with theory

---

## Extraction Notes

**Usefulness for the guidebook:** High. This is the definitive quantitative synthesis on worked examples — the first meta-analysis in the mathematics domain. The overall g=0.48 (corrected g=0.44) is the number to cite when arguing that showing your work step-by-step in a tutorial is one of the highest-leverage instructional moves available.

**The self-explanation prompt finding is counterintuitive and important**: The common YouTube practice of asking viewers to "pause and try this yourself" before showing the solution may actually reduce learning if the prompt quality is low or the content is redundant with the subsequent demonstration. This deserves a callout in the explanation-science chapter.

**The correct-vs-incorrect finding has a direct tutorial implication**: Show correct worked solutions as your default. "Here's how to do X wrong" segments may be less effective for procedural learning even if they feel engaging — unless the goal is misconception correction, which is underrepresented in the outcome data.

**Compare with P025 (Wittwer & Renkl)** for the specific question of what makes explanations in examples effective — that paper addresses the quality dimension this meta cannot.

**Note the scope**: 93% of studies used accuracy on math problem-solving as the outcome. Claims about this meta's findings should be scoped to that outcome type. Transfer and conceptual understanding outcomes may tell a different story.
