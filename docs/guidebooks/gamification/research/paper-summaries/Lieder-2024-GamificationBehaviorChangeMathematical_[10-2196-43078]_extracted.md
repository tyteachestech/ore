---
title: "Gamification of Behavior Change: Mathematical Principle and Proof-of-Concept Study"
authors: [Lieder, F., Chen, P., Prentice, M., Amo, V., Tošić, M.]
year: 2024
type: rct
population: general-adult
sample_size: 118
key_claims:
  - "Optimized gamification (MDP-derived point system) increased daily behavior enactment by ~26% vs. passive baseline and ~26% vs. active control: IRR=0.78 vs. baseline, IRR=0.80 vs. active control (both P<.001), n=118 over 21 days"
  - "Verbal feedback with reminders alone did not outperform no-intervention baseline: IRR=1.03 (95% CI [0.90, 1.17], P=.70) — the point system specifically, not praise, drove the effect"
  - "Habit strength (SRHI) improved equally across all three conditions post-intervention (P>.11 between conditions); optimized gamification did not accelerate perceived habit formation"
  - "Post-intervention behavior gains did not differ significantly between conditions at 1-week or 2-week follow-up (P>.17); authors attribute this to insufficient power, not null effect"
  - "MDP-optimal point design: point rewards for success should be largest early in habit formation and decrease as habit strengthens; penalty for failure should be small early and increase as habit strengthens"
doi: "10.2196/43078"
pmid: unknown
evidence_grade: preliminary
scope_flag: include
inflation_flag: digital-delivery
addresses_questions: [Q2, Q3]
---

# Gamification of Behavior Change: Mathematical Principle and Proof-of-Concept Study

## Study Overview

- **Citation**: Lieder, F., Chen, P.-Z., Prentice, M., Amo, V., & Tošić, M., 2024
- **Study Type**: RCT (longitudinal between-subjects field experiment)
- **Sample**: n=142 recruited (n=118 analyzed for primary outcome); healthy adults recruited via Prolific; mean age 31.5 (SD 9.9), 70.5% female; native English speakers
- **DOI**: 10.2196/43078
- **PMID**: Not reported
- **Preregistration**: OSF H7JN8

## Key Findings

- **Finding 1 — Optimized gamification increased daily behavior enactment during intervention**: Participants in the optimized gamification condition enacted their water-drinking intention more often (mean 14.71, SD 6.57 times out of 21 days) than both active control (mean 11.64, SD 6.38 times; IRR=0.80, 95% CI [0.71, 0.91], P<.001) and passive baseline (mean 11.64, SD 5.43 times; IRR=0.78, 95% CI [0.69, 0.89], P=.001).
  - Effect size: Incidence Rate Ratio (IRR) vs. active control = 0.80 (i.e., control performed 20% fewer enactments); IRR vs. passive baseline = 0.78
  - Sample: n=118 (37 baseline, 39 control-with-feedback, 42 optimized gamification)

- **Finding 2 — Reminders and verbal feedback alone did not outperform no-intervention baseline**: The control condition with reminders and verbal feedback (text-only, no points) did not result in significantly more water drinking than the passive baseline (IRR=1.03, 95% CI [0.90, 1.17]; P=.70). The unique value-add was the optimized point system specifically.

- **Finding 3 — Habit strength (SRHI) improved equally in all conditions**: Self-Report Habit Index scores increased significantly from pre- to post-intervention in all three conditions (P<.001 in all cases), but did not differ between optimized gamification and either control condition (P>.11 in all cases). Optimized points did not accelerate perceived habit formation beyond what goal-setting and self-monitoring alone achieved.

- **Finding 4 — Behavior gains did not persist significantly differently across conditions post-intervention**: After the 21-day intervention ended, retrospective enactment reports at 1-week (mean 5.2, SD 1.9) and 2-week (mean 5.1, SD 2.1) follow-up were significantly higher than pre-intervention (mean 1.8, SD 2.1; P<.001 in all cases), but no significant difference emerged between optimized gamification and controls (P>.17 in all cases). Authors note insufficient statistical power for detecting retention effects.

- **Finding 5 — Optimized gamification did not increase engagement (days interacting with app)**: There was no significant difference in app engagement between the optimized gamification and baseline conditions (IRR=1.02, 95% CI [0.91, 1.14]; P=.72). Notably, the control condition with reminders-and-feedback had *lower* engagement than both optimized gamification and baseline (IRR=0.84, 95% CI [0.75, 0.94]; P=.002 vs. baseline).

- **Finding 6 — No differential dropout by condition**: Chi-square test showed no effect of condition on dropout (χ²₂=0.7; Cramer's V=0.07; P=.72).

## Effect Sizes (Raw Values)

| Comparison | IRR | 95% CI | P | N |
|---|---|---|---|---|
| Optimized gamification vs. active control (enactment) | 0.80 | [0.71, 0.91] | <.001 | 118 |
| Optimized gamification vs. passive baseline (enactment) | 0.78 | [0.69, 0.89] | .001 | 118 |
| Active control vs. passive baseline (enactment) | 1.03 | [0.90, 1.17] | .70 (n.s.) | 118 |
| Optimized gamification vs. baseline (engagement) | 1.02 | [0.91, 1.14] | .72 (n.s.) | 118 |
| Active control vs. optimized gamification (engagement) | 0.86 | [0.76, 0.96] | .008 | 118 |
| Active control vs. baseline (engagement) | 0.84 | [0.75, 0.94] | .002 | 118 |

- **Poisson model Nagelkerke R²** (daily enactment): 0.21
- **Poisson model Nagelkerke R²** (engagement): 0.33
- **Retrospective enactment pre vs. post (all groups combined)**: Pre mean 1.8 (SD 2.1) → 1-week post 5.2 (SD 1.9); t₂₉₉=15.21, P<.001
- **SRHI change**: Significant within all conditions pre→post and pre→follow-up (P<.001 in all cases); no between-condition differences (P≥.11)

Note: No Cohen's d or SMD reported. All primary outcomes analyzed via Poisson regression (count data) or multilevel modeling.

## Mechanisms & Moderators

- **Core mechanism — aligning immediate and long-term consequences**: Optimized gamification is derived from a Markov Decision Process (MDP) model of habit formation. Points are proportional to the long-term value of each action (enacting or missing the behavior), computed from current habit strength. Early in habit formation, success earns high points; as habits strengthen, point rewards decrease. Failure penalties start low and increase as habit strengthens (because more is lost from a setback when the habit is stronger).
- **Mechanism — correcting temporal discounting**: Immediate point feedback counteracts present bias by making long-term beneficial actions immediately rewarding, enabling even a "myopic" decision-maker to choose behaviors optimal for the long run.
- **Moderator — verbal feedback alone is insufficient**: The active control group received the same reminders, self-monitoring, and positive/negative verbal feedback as the experimental group, but without the points. This condition was no better than no-feedback baseline, suggesting the point system (not the verbal praise) drove the behavior change effect.
- **Moderator — prior habit strength (control variable)**: History-of-repetition subscale of SRHI was a significant predictor of both engagement (IRR=0.85, 95% CI [0.79, 0.92]) and daily enactment (IRR=0.91, 95% CI [0.84, 0.99]).
- **No moderator analyses conducted**: The study was not powered to test subgroup effects. Individual-difference moderators (e.g., discount rate, baseline habit strength) were not formally tested.

## Study Design Details

- **Intervention**: 21-day chatbot intervention (Telegram "Good Habit Bot") targeting water-drinking habit. Experimental condition: implementation intention setting + daily reminders + self-monitoring check-ins + optimized gamification point feedback. Control 1 (reminders+feedback): same except text-only feedback with no points. Control 2 (baseline): daily check-in only, no reminders or feedback.
- **Follow-up period**: 40 days total (21-day intervention + 19-day follow-up with measures at days 28, 35, and 40)
- **Attrition**: 4/41 baseline, 4/43 control, 6/48 gamification excluded for completing zero daily reports. No differential dropout between conditions (P=.72).
- **Blinding**: Participants blinded to condition differences (all given identical information about the chatbot). No experimenter blinding described.
- **Randomization**: Three separate Prolific HITs (one per condition); participants self-selected into a single HIT. Baseline equivalence confirmed (pairwise P>.14 on all pre-intervention habit measures).
- **Payment**: Prolific participants paid £1.95 onboarding + £15.80 completion bonus contingent on sustained participation — creates potential compliance demand effects.

## Limitations

- **No comparison to alternative point systems**: Optimized points were never compared against fixed-point, streak-based, or other simple heuristic point systems. It is unknown how much of the effect is specific to the mathematical optimization versus simply having any numerical reward.
- **Small sample size**: Fewer than 30 complete datasets per condition. Study was likely underpowered for detecting post-intervention retention differences and moderator effects.
- **Short intervention window**: 21 days may be insufficient for full habit formation (research suggests 66+ days on average). Long-term habit effects cannot be assessed.
- **Single behavior domain**: Only water drinking was tested. Generalization to other habits (exercise, medication adherence, diet) is unconfirmed.
- **Non-idiomatic chatbot language**: Some messages were not written in perfect English, potentially reducing engagement or credibility.
- **Negative score demotivation**: Users started at 0 points; failures pushed scores negative, which authors acknowledge could be demotivating.
- **Prolific recruitment**: Online platform sample may not generalize to populations who most need behavior change support (e.g., clinical populations, lower digital literacy).
- **Self-report measures post-intervention**: Retrospective enactment and SRHI are less objective than the daily check-ins used during intervention; memory fallibility may mask true post-intervention effects.
- **Payment incentive confound**: Participants received monetary completion bonuses contingent on participation, which may inflate behavior-reporting compliance independent of condition.
- **Unstated**: The model assumes habit strength is a single scalar tracking linearly from behavior, which is a significant simplification. Individual differences in discount rates or habit formation speed were not incorporated into point computation despite theoretical relevance.

## Population Scope Assessment

- **Population**: General adult (healthy, English-speaking, online panel)
- **Relevance to casual behavior change**: High — water drinking is a low-stakes, low-effort behavior; findings most directly apply to simple, daily habit formation in motivated adults
- **Red flags**: None. No clinical population. No addiction or compulsive behavior involved. Financial incentives for participation (external motivation layer) may inflate compliance.

## Conclusions

"Our findings suggest that optimized gamification can be used to make digital behavior change interventions more effective." The effect was significant during the intervention period for daily behavior enactment, but did not extend significantly to self-reported habit strength or post-intervention behavior. The authors attribute the null follow-up effects primarily to insufficient statistical power and suggest that goal-setting and self-monitoring may be sufficient for sustained change, with gamification providing an additive boost during the active intervention phase.

## Named Frameworks

### Optimized Gamification (MDP-based point system)

- **Components**: Habit strength modeled as scalar (0–1); points computed as proportional to long-term value of each action via dynamic programming; point awards decrease as habit strengthens; point penalties increase as habit strengthens
- **Research alignment**:
  - MDP habit model → reinforcement learning / operant conditioning literature
  - Temporal discounting correction → temporal motivation theory (Steel & König, 2006)
  - Implementation intentions + reminders → goal-setting and self-monitoring literature
  - Point-as-incentive → contingency management literature

---

## Extraction Notes

This is a hybrid theory-plus-empirical paper — about half is mathematical framework derivation, half is a proof-of-concept field experiment. The primary empirical contribution is modest: one behavior (water drinking), small sample (~40/group), single population. The theoretical contribution (MDP-derived point system) is the real novelty and is directly applicable to NotionRPG's point design.

Key insight for guidebook: points should be **larger early in habit formation and decrease as habit strengthens** — the opposite of most streak-based apps which award constant or escalating rewards. Penalties for missing should be **small early and increase with habit strength** (because a lapse costs more when the habit is stronger). This mathematical principle is simple to implement and grounded in decision theory.

Critical caveat: the study cannot disentangle whether the *mathematical optimization* of points drove the effect, or simply *having any numerical point feedback*. The control with verbal-only feedback was no better than baseline, but a control with fixed/constant points was not tested.

---

<!-- SOURCE CLASSIFICATION NOTES

Study type: RCT (randomized controlled trial)
Justification: Three-arm between-subjects field experiment with preregistration (OSF H7JN8), random assignment via Prolific HIT separation, and active + passive control conditions. Qualifies as RCT despite self-selection into HITs (baseline equivalence confirmed).

Population relevance: HIGH
Healthy English-speaking adults recruited via online panel (Prolific), mean age 31.5. This is the closest existing empirical analog to NotionRPG's target user base: self-motivated adults engaging with a digital behavior change tool voluntarily. Single behavior (water drinking) limits generalization but does not disqualify.

Inflation flags: digital-delivery
Monetary completion bonuses (£15.80) contingent on sustained participation may inflate compliance rates independent of condition. Self-report primary outcomes (especially retrospective post-intervention) add measurement noise. Prolific panel introduces selection bias toward higher-than-average digital engagement.

Key questions addressed:
- Q2 (What game mechanics reliably change behavior?): Direct evidence that a numerically optimized point system outperforms verbal-only feedback and no-feedback baseline during the active intervention window. Points specifically — not reminders or verbal praise — appear to be the active ingredient.
- Q3 (How durable are gamification effects?): Null between-condition effects at 1- and 2-week follow-up. Durability is not established; authors attribute this to statistical power, not true equivalence, but the data cannot confirm continued benefit.

Evidence grade: preliminary
Justification: Preregistered RCT with active control (raises above purely exploratory). Downgraded from "emerging" due to: n<50 per cell, single behavior domain, inability to isolate mathematical optimization from mere numeric feedback, no long-term follow-up with adequate power, and chatbot-specific delivery limiting ecological validity.

-->
