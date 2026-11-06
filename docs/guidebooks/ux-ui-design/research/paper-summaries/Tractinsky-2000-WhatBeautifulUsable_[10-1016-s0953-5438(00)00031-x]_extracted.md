---
title: "What is beautiful is usable"
authors: [Tractinsky, N., Katz, A.S., Ikar, D.]
year: 2000
type: experimental
population: student
sample_size: 132
key_claims:
  - "Pre-use aesthetics-usability correlation r=0.66; post-use correlation r=0.71 — both strongly significant"
  - "Aesthetics level (high/medium/low) significantly affected post-use perceived usability (stepdown F(2,116)=4.49, p<0.01); actual usability level did not (F(1,117)=1.38, ns)"
  - "Post-use satisfaction correlated more strongly with perceived aesthetics (r=0.87) than with perceived usability (r=0.71)"
  - "Aesthetics effect on satisfaction fully mediated by perceived aesthetics and usability — no unique direct effect on satisfaction once those are controlled"
  - "Amount of information on screen showed weak negative correlations with aesthetics (r=-0.26) and usability (r=-0.18), confirming users can distinguish between interface attributes"
doi: "10.1016/s0953-5438(00)00031-x"
pmid: unknown
evidence_grade: foundational
scope_flag: include
inflation_flag: none
---

# What is beautiful is usable

## Study Overview
- **Citation**: Tractinsky, N., Katz, A.S., & Ikar, D. (2000)
- **Study Type**: Experimental (2x3 between-groups factorial, MANCOVA)
- **Sample**: n=132 (8 excluded for failed manipulation check; effective n=124), third-year Industrial Engineering students, Ben Gurion University, Israel; avg age 25, ~67% male
- **DOI**: 10.1016/s0953-5438(00)00031-x
- **Context**: Replication and extension of Kurosu & Kashimura (1995) and Tractinsky (1997), adding a post-use measurement and a manipulated usability factor

## Key Findings

- **Finding 1 — Pre-use aesthetics-usability correlation**: Before interacting with the system, perceived aesthetics and perceived usability were highly correlated (r=0.66, p<0.01, n=124). This replicates prior Japanese and Israeli findings. By contrast, perceived amount of information correlated only weakly and negatively with aesthetics (r=-0.26) and usability (r=-0.18), showing users are not indiscriminately rating everything together.

- **Finding 2 — Correlation persists after use**: Post-use correlation between perceived aesthetics and perceived usability remained high (r=0.71, p<0.01). This was not pre-registered as a specific correlation test but is reported as primary.

- **Finding 3 — Aesthetics drives post-use usability perception; actual usability does not**: MANCOVA with pre-use perceived usability as covariate showed aesthetics level significantly affected post-use perceived usability (stepdown F(2,116)=4.49, p<0.01). The actual usability manipulation had no significant effect on post-use perceptions of usability (F(1,117)=1.38, ns) or aesthetics (F(1,117)=1.17, ns). No interaction between aesthetics and usability.
  - This is the paper's headline result: users' sense of "how usable was that?" after actual use was determined by how pretty the interface looked, not by whether it was actually harder or easier to use.

- **Finding 4 — Aesthetics and satisfaction**: Post-use satisfaction correlated with perceived usability (r=0.87) and perceived aesthetics (r=0.71). However, in stepdown analysis, the Aesthetics factor's apparent effect on satisfaction (univariate F(2,117)=4.88, p<0.01) disappeared once perceived aesthetics and usability were controlled (stepdown F(2,115)=0.06, ns). Aesthetics affected satisfaction indirectly, by shaping usability and aesthetics perceptions.

- **Finding 5 — Pre-use aesthetics predicts post-use satisfaction**: Pre-experimental perceived usability (which was itself shaped by aesthetics) predicted post-use satisfaction (r=0.48), meaning the first impression set by visual design propagated forward to how people felt after using the system.

- **Finding 6 — Perception change after use**: Users who interacted with medium- and low-aesthetics interfaces rated both aesthetics and usability more favorably after use than before (mere exposure / adaptation effect). Users who interacted with high-aesthetics interfaces rated it slightly lower after use — regression to the mean or expectation contrast. Aesthetics change score: F(2,118)=36.04, p<0.001.

- **Finding 7 — Objective performance unaffected by aesthetics**: Completion times were determined only by the usability manipulation (F(1,118)=414.05, p<0.001; high-usability avg 23.5s/task vs. low-usability 37.5s/task). No aesthetics effect on task times (F(2,118)=0.01, ns) or error rates.

## Effect Sizes (Raw Values)

- **Pre-use aesthetics vs. perceived usability**: r=0.66, p<0.01, n=124
- **Post-use aesthetics vs. perceived usability**: r=0.71, p<0.01, n=124
- **Post-use satisfaction vs. perceived usability**: r=0.87, p<0.01
- **Post-use satisfaction vs. perceived aesthetics**: r=0.71, p<0.01
- **Pre-use aesthetics vs. perceived information**: r=-0.26, p<0.01
- **Pre-use usability vs. perceived information**: r=-0.18, ns
- **Pre-use satisfaction as predictor of post-use satisfaction**: r=0.48
- **Aesthetics factor on post-use usability (stepdown MANCOVA)**: F(2,116)=4.49, p<0.01
- **Actual usability on post-use usability (stepdown MANCOVA)**: F(1,117)=1.38, ns
- **Aesthetics manipulation check (pre-use ratings)**: High=8.26, Medium=4.97, Low=2.07 (1-10 scale); F(2,121)=338.58, p<0.001
- **Usability manipulation check (task times)**: F(1,118)=414.05, p<0.001
- **Aesthetics change score ANOVA**: F(2,118)=36.04, p<0.001

Note: No d or Cohen's effect size reported. All effects expressed as correlations or F-statistics.

## Mechanisms & Moderators

- **Proposed mechanisms** (theoretical, not empirically tested in this study):
  1. **Stereotyping**: Users associate good visual design with other positive system qualities (similar to "beautiful is good" stereotype in social psychology)
  2. **Halo effect**: First-impression aesthetics colors subsequent perception of all other system attributes
  3. **Affective response**: Positive affect from an attractive interface improves overall evaluations (Isen, 1983 cited as supporting mechanism)

- **"Mere exposure" effect**: The increase in perceived aesthetics and usability for medium/low aesthetic groups after use may reflect mere exposure — repeated exposure softens negative evaluations. This is speculative in the paper.

- **Moderators tested**: None. The aesthetics x usability interaction was non-significant across all outcomes.

- **Moderators untested**: Duration of use (study was short-term only), user expertise level, voluntary vs. involuntary system use, task type.

## Study Design Details

- **Intervention/Stimuli**: Nine ATM interface layouts from Kurosu & Kashimura (1995), varied only in spatial arrangement of identical elements. Three rated high, three medium, three low aesthetics.
- **Usability manipulation**: Low-usability condition had 9s average delays per task, intermittently non-responsive buttons, and one forced-long-path task. High-usability had none of these.
- **Factorial design**: 3 (aesthetic level: high/medium/low) x 2 (usability: high/low), between subjects. Participants self-sorted into aesthetic conditions based on their own ratings (personalized assignment).
- **Measures**: Single-item 1-10 scales for aesthetics, usability, and amount of information (pre and post), plus satisfaction (post only). Justified by Wanous et al. single-item acceptability criteria.
- **Objective measures**: Task completion time and error count per task.
- **Attrition**: 8 of 132 excluded (6%) for insufficient aesthetics discrimination in manipulation check.

## Limitations

- **Short-term only**: Post-use evaluations collected immediately after a single experimental session. No long-term follow-up; results are not generalizable to sustained use.
- **Homogeneous population**: All engineering students. Authors acknowledge this may actually strengthen the finding (engineers presumably less susceptible to aesthetic halo), but generalizability to general populations or older professionals is unknown.
- **Single-item measures**: All subjective measures used single items. Authors justify this but it reduces reliability and construct validity.
- **Process-level data absent**: Study captures only final perceptions, not the cognitive/affective process linking aesthetics to usability judgments. Causal mechanism is theoretical, not demonstrated.
- **No effect size metrics**: Paper reports only correlations and F-statistics; no Cohen's d or variance explained reported for MANCOVA effects, making cross-study comparison harder.
- **Lab simulation**: ATM simulation, not a real product in real context. Tasks are prescribed and artificial.
- **Cultural/era context**: Israeli sample, year 2000. Visual design language and user expectations have shifted substantially since publication.

## Population Scope Assessment

- **Population**: Students (Industrial Engineering undergraduates, avg age 25)
- **Relevance to non-designer building consumer apps**: High — the core finding (visual aesthetics shapes perceived usability) is foundational for anyone designing interfaces. Engineers as participants arguably make the halo effect finding more conservative and more credible.
- **Red flags**: None. No clinical population, no pathological behavior. Lab study, not a clinical intervention.

## Conclusions

The paper concludes that "what is beautiful is usable" — a direct analog to Dion et al.'s "what is beautiful is good" from social psychology. Users' post-use perceptions of how usable a system was were shaped primarily by visual aesthetics, not by the system's actual usability. The authors argue this demands an integrative approach to UI design that treats aesthetics and usability as interrelated rather than orthogonal. Key quote from Discussion: "most surprising is the fact that post-experimental perceptions of system usability were affected by the interface's aesthetics and not by the actual usability of the system."

## Named Frameworks (if applicable)

- **"Apparent Usability" vs. "Inherent Usability"** (from Kurosu & Kashimura, 1995, carried into this paper):
  - Apparent usability: user's subjective perception of how easy something seems
  - Inherent usability: objective usability qualities designed into the interface
  - This paper's main finding: apparent usability is dominated by aesthetics, not inherent usability

---

## Extraction Notes

This is a foundational paper for the aesthetics-usability effect — one of the most-cited findings in HCI design research. It is the empirical anchor for the claim that "beautiful = feels usable." A few things worth flagging for the guidebook:

1. The effect was measured on an ATM simulation with prescribed tasks — highly artificial. However, the direction of the effect has been replicated extensively since 2000 (Hassenzahl, Norman's "Emotional Design," etc.), so the finding is robust even if this specific study is limited.

2. The study confounds "perceived usability before use" with aesthetics — this is actually the point, but it means the design takeaway is specifically about first impressions shaping ongoing perception, not about aesthetics permanently overriding actual functional quality.

3. The practical implication for the guidebook audience is direct: when a user first opens a Mac or iOS app, their initial visual impression sets a prior that shapes how forgiving they'll be of usability friction. A polished UI doesn't just look good — it makes the whole interaction feel smoother than it objectively is. The inverse is equally true: an ugly interface makes real friction feel worse.

4. The "amount of information" control variable is an underappreciated finding. Users did NOT rate information-heavy screens as more usable or more aesthetic, confirming the correlation is not a generic response bias. It is specific to the aesthetics-usability pairing.
