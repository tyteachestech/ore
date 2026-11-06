---
title: "Health Wearables, Gamification, and Healthful Activity"
authors: [Hydari, M.Z., Adjerid, I., Striegel, A.D.]
year: 2022
type: longitudinal
population: student
sample_size: 516
key_claims:
  - "Leaderboard adoption increased daily steps by 370 steps/day (+3.5% relative to 10,268 step mean) on average across all users (β=370.46, SE=170.66, p<0.05, N=516)"
  - "Sedentary users (bottom quartile, ~8,000 steps/day baseline) gained 1,365 steps/day (+15%) after leaderboard adoption (β=1,365.44, SE=496.72, p<0.05, n=129)"
  - "Highly active users (top quartile, ~13,000 steps/day baseline) lost 631 steps/day (-5%) after leaderboard adoption (β=-630.63, SE=292.10, p<0.05, n=129); effect persisted 10+ weeks"
  - "Ranking first on leaderboard increased next-week steps by 578 steps/day across all users (β=577.98, SE=94.80, p<0.05)"
  - "Each additional active leaderboard member added 165 steps/day (β=164, SE=31.50, p<0.05); benefit peaked at ~8 active members with diminishing returns beyond that (quadratic β=-21, SE=6.72, p<0.05)"
  - "Sedentary users gained 534 steps/day even on low-competition leaderboards without ranking first (β=534.17, SE=261.13, p<0.05), supporting social-influence rather than competition as their primary mechanism"
  - "Optimal leaderboard size differs by user type: ~5 active members for sedentary users vs. ~11 active members for highly active users"
doi: "10.1287/mnsc.2022.4581"
pmid: unknown
evidence_grade: emerging
scope_flag: include-with-caution
inflation_flag: none
addresses_questions: [Q6, Q7, Q9]
---

# Health Wearables, Gamification, and Healthful Activity

## Study Overview
- **Citation**: Hydari, Adjerid, & Striegel, 2022
- **Study Type**: Quasi-experimental (difference-in-differences with observational panel data)
- **Sample**: n=516 undergraduates at a U.S. university; ~50% adopted Fitbit leaderboards organically over the study period
- **DOI**: 10.1287/mnsc.2022.4581
- **PMID**: Not available

## Key Findings

- **Finding 1 — Average effect of leaderboard adoption**: Users who adopted Fitbit leaderboards walked an average of 370 more steps per day (3.5% increase relative to mean of 10,268 steps/day), p < 0.05.
  - Effect size: β = 370.46 steps/day (SE = 170.66), p < 0.05
  - Sample: n = 516 (27,758 student-week observations)

- **Finding 2 — Highly active users are harmed**: Users in the top quartile of pre-adoption activity experienced a significant *decrease* of 631 steps/day after leaderboard adoption (≈5% relative decrease from their ~13,000 steps/day baseline). This effect persisted and grew in magnitude for at least 10 weeks post-adoption.
  - Effect size: β = −630.63 steps/day (SE = 292.10), p < 0.05
  - Sample: n = 129 (highly active subsample, 7,836 observations)

- **Finding 3 — Sedentary users benefit substantially**: Users in the bottom quartile of pre-adoption activity walked 1,365 more steps/day (≈15% relative increase from their ~8,000 steps/day baseline). Benefits also persisted for 10+ weeks.
  - Effect size: β = 1,365.44 steps/day (SE = 496.72), p < 0.05
  - Sample: n = 129 (sedentary subsample, 5,629 observations)

- **Finding 4 — Middle-group benefit**: Users between the 25th–75th percentile of prior activity benefited from leaderboards but less than the sedentary group.
  - Effect size: β = 858.60 steps/day (SE = 213.46), p < 0.05
  - Sample: n = 258 (14,293 observations)

- **Finding 5 — Ranking first boosts activity**: Being ranked first on the leaderboard in week t increased daily steps in week t+1 by 578 steps across all users.
  - Effect size: β = 577.98 steps/day (SE = 94.80), p < 0.05
  - For sedentary users specifically: first-place ranking increased treatment effect by an additional 746 steps (~2,000 steps total combined with main effect), p < 0.10

- **Finding 6 — Leaderboard size has diminishing returns**: Each additional active leaderboard member increased the leaderboard effect by 165 steps/day (p < 0.05), but benefit peaked at approximately 8 active members (quadratic term ≈ −21 steps, p < 0.05), after which marginal benefit diminishes.

- **Finding 7 — Sedentary users benefit even from small leaderboards without ranking first**: When competitive dynamics were minimal (focal user sandwiched between two others, no rank threat), sedentary users still gained 534 steps/day (p < 0.05). Highly active users in the same condition gained near-zero steps (β = −39, p = 0.9), suggesting social influence (accountability, reference-point updating) is the primary mechanism for sedentary users, not competition.

- **Finding 8 — Highly active users need large, competitive leaderboards**: Highly active users see positive effects only when ranked first on leaderboards with more than 4 active members, or when on leaderboards with more than 6 active members generally. High-competition leaderboards significantly offset their otherwise negative main effect.

## Effect Sizes (Raw Values)

| Condition | β (steps/day) | SE | p | n |
|-----------|---------------|-----|---|---|
| Overall leaderboard effect (preferred model) | +370 | 170.66 | <0.05 | 516 |
| Overall leaderboard effect (IPTW robustness check) | +343 | 170.98 | <0.05 | 503 |
| Sedentary users (bottom quartile) | +1,365 | 496.72 | <0.05 | 129 |
| Highly active users (top quartile) | −631 | 292.10 | <0.05 | 129 |
| Middle group (25th–75th percentile) | +859 | 213.46 | <0.05 | 258 |
| Ranking first (all users) | +578 | 94.80 | <0.05 | — |
| Ranking first — sedentary additive | +746 | 422.44 | <0.10 | — |
| Ranking first — highly active additive | +522 | 157.44 | <0.05 | — |
| Each additional active leaderboard member | +164 | 31.50 | <0.05 | — |
| Diminishing returns per additional member (quadratic) | −21 | 6.72 | <0.05 | — |
| No-competition leaderboard — sedentary | +534 | 261.13 | <0.05 | — |
| No-competition leaderboard — highly active | −39 | 283.54 | 0.9 | — |
| Placebo test (4 weeks pre-adoption) | −3.62 | 260.57 | >0.10 | — |

**Optimal leaderboard size — sedentary**: peaks at ≈5 active users

**Optimal leaderboard size — highly active**: peaks at ≈11 active users (quadratic term for sedentary is 3× more negative than for highly active)

## Mechanisms & Moderators

- **Mechanism 1 — Social influence (accountability)**: Leaderboard members can observe each other's step counts and send messages/cheers/taunts via Fitbit app. The revelation of previously private activity levels creates peer accountability. This is the primary driver for sedentary users, who benefit even without winning.
  - Evidence: Sedentary users gained 534 steps/day on no-competition leaderboards (p < 0.05); highly active users gained near zero under same conditions.

- **Mechanism 2 — Exercise reference point updating**: Seeing others' activity levels shifts a user's internal benchmark for what counts as appropriate exercise. Sedentary users typically encounter more active peers, raising their reference point positively. Highly active users more often encounter less active peers, which can produce a downward "boomerang" effect — reducing their effort because they see themselves as already outperforming peers.
  - Evidence: Highly active users on small leaderboards (where they dominate) show the most negative effects. Effect reverses on large, competitive leaderboards.

- **Mechanism 3 — Competition**: Ranking-based motivation. Being first on the leaderboard increases next-week activity for all user types (+578 steps). However, for sedentary users, competitive winning is a bonus on top of baseline social-influence benefit; it is not a prerequisite for benefit. For highly active users, competition (specifically winning on large leaderboards) is required to see any net positive effect.

### Moderators

| Moderator | Direction | Key finding |
|-----------|-----------|-------------|
| Prior activity level | Strongest moderator | Sedentary: +1,365 steps/day; highly active: −631 steps/day (opposite directions) |
| Leaderboard size | Nonlinear | Sedentary peak ≈5 members; highly active peak ≈11 members |
| Leaderboard rank | Amplifier | First place adds +578 steps/day for all users; not required for sedentary users to benefit |

## Study Design Details

- **Intervention**: Organic/voluntary adoption of Fitbit leaderboard feature (7-day rolling step-count rankings). Not experimentally assigned — observational adoption.
- **Control/Comparison**: Within-person before/after (difference-in-differences); non-adopters serve as concurrent controls.
- **Study period**: October 2015 – September 2017 (2 years)
- **Follow-up period**: Up to 10 weeks post-adoption tracked explicitly via leads-lags model; average leaderboard participation = 237 days conditional on adoption.
- **Data type**: Daily Fitbit step counts + weekly leaderboard data + minute-by-minute heart rate (for compliance measurement) + periodic surveys (~6-month waves).
- **Identification strategy**: DID with individual fixed effects, week fixed effects, individual-specific linear and quadratic time trends. Supplemented with IPTW propensity weighting, placebo tests, leads-lags model, negative control treatment (inactive leaderboards), leave-one-out robustness.
- **Compliance**: Students paid $20 for ≥40% device compliance. Effect sizes held or increased at higher compliance thresholds (408–598 steps for high-compliance subsamples).
- **Attrition/de-adoption**: ~5% of leaderboard adopters hid themselves (de-adopted); excluding them did not change results. No relationship found between leaderboard adoption and sample attrition.
- **Blinding**: Not applicable (observational study).

## Limitations

- **No random assignment**: Individuals chose to adopt leaderboards, creating potential selection bias. Authors address this extensively but cannot guarantee full confound elimination without an RCT.
- **No direct measure of leaderboard initiation**: Proxy variable constructed (InviterLB) but not directly observed. Unclear whether users who actively invited others had different motivation trajectories.
- **Student population**: 516 undergraduates at one U.S. university. Likely healthier, more homogeneous, and younger than the general population. Results for the sedentary subgroup may be more generalizable but require confirmation in broader samples.
- **No downstream health outcomes**: Only step counts measured. Weight loss, cardiovascular outcomes, and long-term health impacts not assessed.
- **No granular app/device usage data**: Some participants may not regularly check leaderboard rankings. Authors note this would attenuate effects toward zero, making estimates conservative.
- **"Sedentary" label is relative to the sample**: Bottom quartile in this student sample (~8,000 steps/day) may not correspond to sedentary thresholds in the general population.
- **Leaderboard de-adoption underestimated**: Fitbit makes de-adoption difficult (privacy settings only); some users who feel harmed may stay on the leaderboard, compressing the observed negative effect.
- **Single platform, single device**: Fitbit Charge HR only. Leaderboard mechanisms vary across platforms; generalizability to apps without continuous tracking is uncertain.

## Population Scope Assessment

- **Population**: University undergraduates (mean age 17.94 years at study start), 50% female, general health population (not clinical)
- **Relevance to casual behavior change**: High — physical activity tracking and leaderboards are core gamification features used in consumer wellness apps (Fitbit, Strava, etc.). The sedentary-user finding is directly applicable to casual behavior change contexts.
- **Red flags**: Narrow demographic (college students, single U.S. institution). Competition-based gamification findings may not fully generalize to older adults or populations with health anxiety. Absolute step counts for "sedentary" group (~8,000/day) are higher than population averages, limiting direct comparison to genuinely inactive populations.

## Conclusions

Leaderboards on fitness wearables produce meaningful but highly heterogeneous effects on physical activity. On average, leaderboard adoption increases daily steps by 370 (3.5%), but this average masks a stark divergence: sedentary users gain ~1,365 steps/day (+15%) while highly active users lose ~631 steps/day (−5%). The surprising finding is that competition-based gamification most benefits those who need it most — the least active — through social influence mechanisms (accountability and reference-point updating) rather than competition per se. Highly active users require large, competitive leaderboards to avoid de-motivational effects. Authors conclude that gamification interventions must be designed and tailored by user activity level to maximize population benefit and avoid inadvertent harm to already-active individuals.

## Named Frameworks

### Social Comparison Theory (Festinger, 1954)
- **Components**: Upward comparison (comparing to more active peers) vs. downward comparison (comparing to less active peers)
- **Research alignment**:
  - Upward comparison → positive reference-point updating → increased activity (sedentary users)
  - Downward comparison → "boomerang" effect on reference points → decreased activity (highly active users)

### Competition Mechanisms (Garcia et al., 2013)
- **Components**: N-effect (more competitors = more diluted competitive drive), rank threat, proximity to top
- **Research alignment**:
  - Rank first → +578 steps next week (all users)
  - Competitive intensity moderates harm for highly active users

---

## Extraction Notes

This paper is unusually strong for a gamification study: 2-year longitudinal panel, objective wearable data (no self-report), rigorous quasi-experimental design with multiple robustness checks, and a large enough sample to support stratified subgroup analyses. The heterogeneity finding (sedentary users benefit, highly active users are harmed) is counterintuitive and well-supported. It directly challenges the common concern that competition-based gamification would harm less-active users while benefiting already-active ones — the reverse appears to be true.

Key implication for NotionRPG: Competition/leaderboard features should be designed differently for users at different activity baselines. For new or low-engagement users, social accountability and reference-point mechanisms (seeing what peers do) may matter more than winning. Small-group features may degrade benefit for sedentary users if groups become too large. The "optimal group size" finding (sedentary: ~5 users; highly active: ~11 users) is directly actionable for social feature design.

Weakness to note: The population is college students (~18 years old), which likely overestimates engagement with digital gamification relative to the average adult user. Effect magnitudes may not replicate in broader populations.

---

<!-- SOURCE CLASSIFICATION NOTES

STUDY TYPE: Longitudinal quasi-experiment (difference-in-differences)
Rationale: 2-year observational panel with within-person DID design, not a randomized controlled trial.
Individual fixed effects + IPTW propensity weighting provide strong but not RCT-level causal identification.
No random assignment — observational leaderboard adoption. Published in Management Science (top-tier journal).

POPULATION RELEVANCE: Include with caution
Target population is university undergraduates (mean age ~18) at a single U.S. institution.
Directly relevant to consumer digital gamification (Fitbit/wearable leaderboards) but narrow demographic.
"Sedentary" in this sample (~8,000 steps/day) is above typical population sedentary thresholds.
Findings most generalizable for: low-engagement users in digital habit/activity contexts (good NotionRPG fit).
Findings less generalizable for: older adults, clinical populations, non-fitness domains.

INFLATION FLAGS: None
No implementation intentions, choice architecture, or WOOP/MCII framing. Pure leaderboard/social comparison mechanics.
No novelty-effect confound concern: 2-year panel with 10-week post-adoption tracking.

KEY QUESTIONS ADDRESSED:
- Q6 (Leaderboard/social mechanics): Primary contribution. Quantifies optimal leaderboard size by user type,
  ranks effects, and group-size nonlinearity. Most empirically rigorous leaderboard study in the inventory.
- Q7 (Failure conditions / for whom gamification harms): Demonstrates leaderboards actively harm highly active
  users (-631 steps/day). Reverses conventional wisdom that competition hurts less-active users.
- Q9 (Negative effects / failure modes): Persistent 10-week harm for top-quartile users; boomerang effect
  from downward social comparison on small leaderboards.

CONFLICTS WITH: Hamari et al. (2014) uniform-benefit framing; general positive-leaning leaderboard assumptions.
COMPLEMENTS: Park (2021) leaderboard design principles; Höllig (2020) trait competitiveness moderators.
-->
