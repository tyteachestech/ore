---
title: "The 'curse of knowledge' when predicting others' knowledge"
authors: [Tullis, J. G., Feder, B.]
year: 2022
type: experimental
population: student
sample_size: 745
key_claims:
  - "Learning trivia answers across 3 rounds worsened calibration (d=0.28, Round 1 vs. Round 3) and resolution (d=0.34, Round 1 vs. Round 3) of estimates about novice knowledge"
  - "The curse of knowledge is NOT caused by overreliance on one's own experiences — estimators actually reduced utilization of own-experience cues as those cues became less valid"
  - "Impaired accuracy arises because estimators lack diagnostic cues about others' knowledge, not because they over-weight their own knowledge"
  - "Reducing the salience of own knowledge (not requiring answer-before-estimate) reduced calibration bias but did NOT improve resolution"
  - "Both calibration and resolution worsened across learning rounds even without feedback (Experiment 2, no-feedback condition: resolution d=0.19 Round 1 vs. Round 3)"
doi: "10.3758/s13421-022-01382-3"
pmid: ""
evidence_grade: emerging
scope_flag: include-with-caution
inflation_flag: none
---

# The "Curse of Knowledge" When Predicting Others' Knowledge

## Study Overview

- **Citation**: Tullis, J. G., & Feder, B. (2022). Memory & Cognition.
- **Study Type**: Experimental (4 experiments)
- **Sample**: n=745 total across 4 experiments; undergraduate students in introductory educational psychology courses at University of Arizona
  - Experiment 1: n=131
  - Experiment 2: n=131 (1 excluded)
  - Experiment 3: n=130 (1 excluded)
  - Experiment 4: n=352 (2 excluded online, total usable ~352)
- **DOI**: 10.3758/s13421-022-01382-3
- **Paradigm**: Participants studied 40 trivia questions across multiple rounds, estimated what percentage of novice participants would know each answer, without themselves having studied it

> **Note on population**: All participants are undergraduate students earning course credit. The curse of knowledge generalizes broadly across adult populations in prior literature, but all effect sizes here come from this student sample specifically.

## Key Findings

- **Finding 1 — Learning impairs calibration**: As participants gained knowledge across 3 study rounds, their calibration of novice knowledge worsened significantly. Mean estimates of others' knowledge increased from Round 1 to Round 3 (calibration scores increased from 0.09 to 0.12), indicating growing overestimates of novice knowledge.
  - Effect size: Cohen's d = 0.28, t(130) = 3.21, p = .002 (Experiment 1, Round 1 vs. Round 3)
  - ANOVA: F(2, 260) = 8.31, p < .001, η²p = .060, BF₁₀ = 54.04

- **Finding 2 — Learning impairs resolution**: Participants' ability to distinguish between easy and difficult questions (i.e., rank-order items by novice difficulty) degraded across rounds.
  - Effect size: Cohen's d = 0.34, t(130) = 3.88, p < .001, BF₁₀ = 104.37 (Experiment 1, Round 1 vs. Round 3)
  - Resolution ANOVA: F(2, 260) = 9.84, p < .001, η²p = .070, BF₁₀ = 205.68

- **Finding 3 — Validity of own cues drops with learning**: One's ability to answer correctly and response time both become less predictive of normative difficulty as knowledge increases. Validity of own-experience cues dropped while utilization also dropped — but utilization dropped more than validity (interaction significant: F(2, 260) = 14.43, p < .001, η²p = .10).
  - Estimators were NOT over-relying on their own experiences — they appropriately reduced reliance as validity dropped.
  - G (optimal cue weighting) decreased across rounds: d = 0.51, t(130) = 5.77, p < .001 (Experiment 1, Round 1 vs. Round 3), BF₁₀ = 204,012

- **Finding 4 — Feedback drives calibration decline; mere exposure drives resolution decline**: In Experiment 2, calibration only worsened for the feedback condition (learning the correct answer) but not for no-feedback. Resolution worsened in BOTH conditions across rounds.
  - Feedback condition, calibration: d = 0.33, t(130) = 3.74, p < .001
  - No-feedback condition, calibration: d = 0.10, t(130) = 1.12, p = .27 (non-significant)
  - Both feedback and no-feedback conditions showed resolution decline (d = 0.19 for each, both p < .05)

- **Finding 5 — Reducing answer salience reduces calibration bias but not resolution**: Experiment 3 removed the requirement to answer each question before estimating others' knowledge. Without this, neither calibration nor resolution changed significantly across rounds (in contrast to Experiments 1 and 2).
  - Answer-present vs. answer-absent calibration difference: F(1, 129) = 54.55, p < .001, η²p = .30
  - Resolution: answer-present condition was significantly higher (better) than answer-absent (F(1, 129) = 23.99, p < .001, η²p = .157)

- **Finding 6 — Reducing own-knowledge reliance does NOT improve resolution**: In Experiment 4, direct between-subjects comparison of answer-before vs. answer-after conditions. Answer-before group showed larger calibration decline but the resolution between conditions did NOT differ.
  - Resolution comparison: t(349) = 0.47, p = .64, d = 0.05 (null result — no benefit to resolution from reducing own-knowledge reliance)
  - Answer-before calibration decline (0 to 3 repetitions): d = 1.13, t(172) = 14.96, p < .001
  - Answer-after calibration decline: d = 0.94, t(178) = 12.59, p < .001

- **Finding 7 — Core mechanism is lack of diagnostic cues about others**: The key impairment is not over-weighting own experience but the absence of valid external cues about novice knowledge. As own-experience cues lose validity, estimators reduce their use — but nothing valid replaces them, introducing noise.

## Effect Sizes (Raw Values)

**Experiment 1** (n=131, 3-round repeated study with feedback):
- Calibration Round 1 vs. Round 3: d = 0.28, t(130) = 3.21, p = .002
- Resolution Round 1 vs. Round 3: d = 0.34, t(130) = 3.88, p < .001
- Optimal cue weighting (G) Round 1 vs. Round 3: d = 0.51, t(130) = 5.77, p < .001

**Experiment 2** (n=131, feedback vs. no-feedback within-subjects):
- Calibration, feedback condition R1 vs. R3: d = 0.33
- Calibration, no-feedback condition R1 vs. R3: d = 0.10 (non-significant)
- Resolution, feedback condition R1 vs. R3: d = 0.19, t(130) = 2.16, p = .03
- Resolution, no-feedback condition R1 vs. R3: d = 0.19, t(130) = 2.11, p = .04

**Experiment 3** (n=130, answer-present vs. answer-absent):
- Answer-present vs. answer-absent calibration: F(1, 129) = 54.55, p < .001, η²p = .30
- Answer-present vs. answer-absent resolution: F(1, 129) = 23.99, p < .001, η²p = .157
- Answer condition on G: d = 0.18, t(129) = 2.01, p = .046

**Experiment 4** (n~352, answer-before vs. answer-after between-subjects):
- Calibration effect of repetitions: F(3, 1050) = 245.50, p < .001, η²p = .41
- Answer-before calibration 0 vs. 3 repetitions: d = 1.13
- Answer-after calibration 0 vs. 3 repetitions: d = 0.94
- Resolution between conditions (null): d = 0.05, p = .64
- Utilization: answer-before > answer-after, d = 0.44, t(349) = 4.30, p < .001

## Mechanisms & Moderators

- **Primary mechanism — Lack of diagnostic cues, not over-reliance**: When estimators know the answer, their personal experience (ability to answer, response speed) becomes less valid as a predictor of novice difficulty. They correspondingly reduce utilization of these cues. The gap left by reduced reliance is not filled by other valid cues, introducing noise.

- **Calibration vs. resolution have different drivers**:
  - Calibration (average accuracy) is driven by whether one knows the answer at all — knowing the answer raises estimates upward
  - Resolution (rank-order accuracy) is driven by idiosyncratic personal experiences that introduce noise into item-level judgments

- **Salience of own knowledge moderates calibration**: Requiring participants to answer before estimating increases the salience of their own knowledge, increasing calibration error. When this requirement is removed, calibration bias is reduced — but resolution is unaffected.

- **Mere exposure impairs resolution even without correct-answer knowledge**: In Experiment 2 no-feedback condition, resolution declined across rounds despite participants not learning the correct answers — suggesting that repeated engagement with questions themselves introduces noise.

- **Answer presence improves resolution**: When the correct answer is displayed alongside the question during estimation, resolution is better (more valid cues available — answer familiarity, question-to-answer associative strength).

## Study Design Details

- **Paradigm**: 40 trivia questions (normed difficulty 2%-89% correct, M = 44%) from Nelson & Narens (1980) and Tauber et al. (2013) databases
- **Procedure**: Each question answered, feedback given, then estimate made of % of novice participants who would know the answer (0-100 scale), across 3 rounds
- **Resolution measure**: Pearson r between estimates and normative difficulty per participant
- **Calibration measure**: Proportion estimated minus proportion normatively correct (positive = overestimate)
- **Cue-utilization framework**: Lens model (Bröder & Undorf, 2019) used to separate validity (how predictive cues are of true difficulty) from utilization (how strongly cues influence estimates)
- **Power analysis**: Target n=130 to detect d=0.38 (smallest effect in prior literature) at α=.05, power=.80
- **No conflicts of interest declared**
- **Data available on OSF**: https://osf.io/2ngbq/?view_only=ada6614377a24bc797df3046dcee2872

## Limitations

- **Student population only**: All four experiments used undergraduates in introductory psychology courses. Generalization to domain experts (teachers, YouTube creators) is theoretically motivated but not directly tested.
- **Trivia paradigm**: Estimates about an anonymous group of other participants answering trivia — this differs meaningfully from a teacher or creator estimating a known audience's knowledge of a specific domain. Real-world curse of knowledge likely interacts with prior audience knowledge and domain complexity not captured here.
- **Short-term within-session learning**: All rounds occur within a single lab session. Long-term expertise accumulation (years of practice) may produce qualitatively different bias patterns than the hours-long learning tracked here.
- **No direct test of real-world accuracy improvement**: The paper identifies the mechanism but does not test interventions that successfully improve resolution in naturalistic settings.
- **Calibration and resolution conflated in lay understanding**: The paper disambiguates them empirically, but practical guidance on which to target is not provided.
- **No measure of prior domain expertise**: Participants are treated as novices-becoming-experts on trivia. Actual subject-matter experts were not studied.

## Population Scope Assessment

- **Population**: Undergraduate students (psychology courses), University of Arizona
- **Relevance to casual behavior change**: N/A — this is a metacognition/expertise bias paper
- **Relevance to Tyler's context**: High for explanation-science domain. The curse of knowledge directly applies to any expert (YouTube creator) estimating what a novice audience knows. The mechanistic finding — that the problem is lack of cues about the audience, not over-weighting own expertise — is directly actionable.
- **Red flags**: None — not clinical, not addiction-related, not K-12 classroom (lab setting)

> **Note on context**: The laboratory trivia paradigm is not a direct analogue to video tutorial creation. However, the mechanism (valid audience-knowledge cues are absent; experts fill that gap with their own experience, which is increasingly unrepresentative) maps directly onto the creator context. Tyler's audience is not a sample of undergrads — but the core finding that reducing one's own-knowledge reliance is necessary but not sufficient, and that one needs valid external cues about the audience, is the actionable insight.

## Conclusions

The curse of knowledge impairs both the average accuracy (calibration) and the item-level discriminability (resolution) of experts' estimates about novice knowledge, and these two types of accuracy have partially distinct causes. The authors conclude: "Inaccuracies in judgments about others and the 'curse of knowledge' may result from a lack of cues about others, rather than tying estimates too strongly to one's own experiences or misinterpreting fluency with answers." Efforts to simply reduce reliance on own knowledge (e.g., not answering before estimating) improve calibration somewhat but do not improve resolution, because reducing own-experience reliance introduces noise when no valid alternative cues about the audience are available.

## Named Frameworks (if applicable)

- **Cue-Utilization Framework / Lens Model of Metacognition** (Bröder & Undorf, 2019; Koriat, 1997)
  - Components: cue validity (how diagnostic a cue is of true difficulty), cue utilization (how strongly a cue influences the judgment), optimal weighting (G — how well utilization matches validity)
  - Research alignment:
    - Cue validity -> decreases with learning (own experience becomes less representative of novice difficulty)
    - Cue utilization -> also decreases, but not enough to compensate for the validity drop
    - G (optimal weighting) -> decreases across rounds, indicating greater noise in judgment process

---

## Extraction Notes

**High-value paper for the explanation-science chapter.** Three things are especially useful for Tyler:

1. **The mechanism reframe is counterintuitive and memorable**: The common assumption is that experts fail because they over-rely on their own perspective. This paper shows the opposite — experts actually appropriately reduce reliance on their own experience as it becomes less predictive. The problem is that they have nothing valid to replace it with. For Tyler, the implication is: reducing "expert brain" is necessary but not sufficient. The more important intervention is actively gathering valid cues about the audience — comments, DMs, analytics, pre-video audience calibration.

2. **Calibration vs. resolution distinction matters**: Calibration (am I broadly over- or underestimating difficulty?) is easier to fix (just know your audience average difficulty level). Resolution (can I tell which specific concepts will trip people up?) is harder — it requires item-level feedback that creators rarely collect systematically.

3. **The Experiment 3 finding is practically relevant**: When the correct answer is present during estimation, resolution improves — because more valid cues (answer familiarity, question-answer associative strength) become available. For tutorial creators, this translates to: when reviewing your own tutorial draft, the solution is present in your head, so your ability to judge what will confuse viewers is still impaired. You need to test with actual novices to get valid resolution cues.

**Scope flag rationale**: `include-with-caution` because the student/trivia lab paradigm is not a direct analogue to creator expertise. The mechanism is well-grounded and transferable, but specific effect sizes should not be cited as if they were measured in a teaching or content-creation context.
