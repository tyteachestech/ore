---
title: "A cornerstone of adaptivity – A meta-analysis of the expertise reversal effect"
authors: [Tetzlaff, L., Simonsmeier, B., Peters, T., Brod, G.]
year: 2025
type: meta-analysis
population: mixed
sample_size: 5924
key_claims:
  - "Novices learn better from high-assistance instruction: d=0.505 (95% CI [0.260, 0.750]), k=88, j=60"
  - "Experts learn better from low-assistance instruction: d=-0.428 (95% CI [-0.647, -0.209]), k=88, j=60"
  - "Combined expertise reversal interaction effect: d=0.971 (95% CI [0.631, 1.312]), k=88, j=60"
  - "Effect is asymmetric: helping novices (d=0.505) produces larger gains than withholding help from experts (d=0.428)"
  - "Effect weakest in primary education and humanities/language learning; strongest in higher education and vocational/cross-status comparisons"
  - "No evidence of publication bias: Egger's regression non-significant for both effects (p=.57, p=.77)"
doi: "10.1016/j.learninstruc.2025.102142"
pmid: unknown
evidence_grade: foundational
scope_flag: include-with-caution
inflation_flag: none
---

# A cornerstone of adaptivity – A meta-analysis of the expertise reversal effect

## Study Overview
- **Citation**: Tetzlaff, L., Simonsmeier, B., Peters, T., & Brod, G. (2025)
- **Study Type**: Meta-analysis (PRISMA guidelines)
- **Sample**: k=60 studies, 176 effect sizes (88 per prior knowledge group), n=5924 total participants; studies published 1992–2024, median year 2013; sample sizes ranged 17–357, median 73
- **Journals**: 35 different journals
- **DOI**: 10.1016/j.learninstruc.2025.102142
- **Analysis tool**: metafor package v4.60 in R 4.3.3; clubSandwich estimator for cluster-robust SEs

> **K-12 context flag:** Many included studies use school-age and university populations. The moderator analyses show the effect is weaker in primary education. Adult async video creators are not this paper's population, but the underlying mechanism (redundant assistance harms experts via cognitive load or autonomy loss) transfers directly to instructional design decisions for any audience mix.

## Key Findings

- **Finding 1 — Novices benefit from high assistance**: Low prior knowledge learners show significantly better outcomes under high-assistance vs. low-assistance instruction. d=0.505, 95% CI [0.260, 0.750], k=88, j=60. Heterogeneity is high (I²=90.87%, Q(df=87)=475.233, p<.001).

- **Finding 2 — Experts are harmed by high assistance**: High prior knowledge learners show significantly worse outcomes under high-assistance vs. low-assistance instruction. d=-0.428, 95% CI [-0.647, -0.209], k=88, j=60. Heterogeneity is high (I²=87.55%, Q(df=88)=284.457, p<.001).

- **Finding 3 — Interaction effect is strong**: The within-study difference (ERE as a single ATI estimate) is d=0.971, 95% CI [0.631, 1.312], k=88, j=60. This is considerably lower than the 1.72 average reported in the 2007 narrative review (Kalyuga), explained by proper meta-analytic weighting for sample size and standard error.

- **Finding 4 — The effect is asymmetric**: The benefit to novices (d=0.505) is larger in magnitude than the harm to experts (d=0.428). Authors note this is an ordinal interaction — low assistance can be better for both groups in some studies, but the advantage is always larger for novices. Practical implication: when in doubt, provide assistance rather than withhold it.

- **Finding 5 — Educational status moderates both effects**: Effect for novices significantly moderated by educational status (R²=25.92%); effect for experts also moderated (R²=8.47%). Effect is strongest when comparing groups across different educational levels ("several" category: novices d=1.05, experts d=-0.558). Effect for novices especially weak in primary education and especially pronounced in higher education.

- **Finding 6 — Content domain moderates novice effect only**: Content area significantly moderates novice-side effect (R²=20.59%). Strongest effect in law/business/crafts ("other": novices d=1.24); weakest in humanities and language learning (novices d=-1.08 relative to reference category, p=.018). Domain does NOT significantly moderate the expert-side effect.

- **Finding 7 — Prior knowledge assessment type moderates expert effect**: Type of prior knowledge assessment significantly moderates the expert effect (R²=50.00%). Effect strongest when groups defined by grade level (d=-0.95). Effect weakest when defined by measurement (d=0.74 relative to grade-level reference, p<.001) or intervention (d=0.75, p=.006). This suggests that studies using median splits on short knowledge tests produce smaller effects because the group separation is less extreme.

- **Finding 8 — No publication bias detected**: Egger's regression tests non-significant for both comparisons (low-PK: z=0.568, p=.57; high-PK: z=0.299, p=.77). Funnel plots show symmetry.

## Effect Sizes (Raw Values)

**Primary effects:**
- Low prior knowledge learners (high vs. low assistance): d=0.505, 95% CI [0.260, 0.750], k=88, j=60
- High prior knowledge learners (high vs. low assistance): d=-0.428, 95% CI [-0.647, -0.209], k=88, j=60
- Interaction (difference of differences): d=0.971, 95% CI [0.631, 1.312], k=88, j=60

**Heterogeneity:**
- Low-PK effect: I²=90.87%, Q(df=87)=475.233, p<.001
- High-PK effect: I²=87.55%, Q(df=88)=284.457, p<.001

**Moderator: Educational Status (Low-PK learners — all relative to primary education reference)**
- Primary education: d=-0.29 [-0.84; 0.27] (reference)
- Secondary education: d=0.70 [0.07; 1.31], p=.029
- Vocational training: d=0.63 [-0.54; 1.80], p=.288
- Higher education: d=0.99 [0.34; 1.63], p=.003
- Other: d=0.70 [-0.35; 1.74], p=.190
- Several (cross-status): d=1.05 [0.38; 1.71], p=.002

**Moderator: Educational Status (High-PK learners)**
- Primary education: d=-0.26 [-0.71; 0.20] (reference)
- Secondary education: d=-0.10 [-0.63; 0.46], p=.720
- Vocational training: d=-0.23 [-1.41; 0.95], p=.702
- Higher education: d=-0.09 [-0.63; 0.46], p=.749
- Other: d=0.21 [-0.71; 1.12], p=.658
- Several (cross-status): d=-0.558 [-1.13; .01], p=.054

**Moderator: Content Domain (Low-PK learners — relative to "Other" reference)**
- Other (crafts, law, business): d=1.24 [0.42; 2.05] (reference)
- STEM: d=-0.76 [-1.61; 0.08], p=.078
- Humanities & Language: d=-1.08 [-1.98; -0.19], p=.018
- Sports: d=-0.33 [-1.29; 0.63], p=.501

**Moderator: Content Domain (High-PK learners)**
- Other: d=-0.16 [-0.85; 0.52] (reference)
- STEM: d=-0.18 [-0.88; 0.53], p=.625
- Humanities & Language: d=-0.20 [-0.95; 0.54], p=.592
- Sports: d=-0.92 [-1.74; -0.11], p=.026

**Moderator: Prior Knowledge Assessment Type (Low-PK learners — relative to grade level)**
- Grade level: d=0.19 [-0.35; 0.73] (reference)
- Profession/field of study: d=0.74 [-0.01; 1.48], p=.052
- Measurement: d=0.22 [-0.37; 0.81], p=.459
- Intervention: d=0.48 [-0.30; 1.26], p=.228
- Self-evaluation: d=0.64 [-0.49; 1.26], p=.266

**Moderator: Prior Knowledge Assessment Type (High-PK learners — relative to grade level)**
- Grade level: d=-0.95 [-1.32; -0.58] (reference)
- Profession/field of study: d=-0.08 [-0.62; .46], p=.77
- Measurement: d=0.74 [0.34; 1.14], p<.001
- Intervention: d=0.75 [0.22; 1.28], p=.006
- Self-evaluation: d=0.16 [-0.68; 1.01], p=.702

## Mechanisms & Moderators

**Cognitive Load Theory (primary mechanism)**: Instructional assistance reduces extraneous load for novices (who lack schemas to process the material independently), but creates redundant load for experts (whose existing knowledge makes the assistance unnecessary and interferes with processing). High element interactivity tasks — where many concepts must be held in working memory simultaneously — amplify both effects.

**Zone of Proximal Development framing**: Assistance brings a task into "the zone" for novices but pushes it below the zone for experts. The two frameworks are not mutually exclusive.

**Assistance Dilemma (Koedinger et al.)**: The relationship between assistance and learning is curvilinear — both too much and too little impair learning. The optimal amount is learner-dependent.

**Desirable Difficulties extension**: Withholding assistance from experts functions as a "desirable difficulty" — hindering immediate performance but improving long-term learning. These effects also depend on learner characteristics (prior knowledge, motivation, cognitive ability).

**Motivational mechanism (Self-Determination Theory)**: Redundant assistance reduces perceived autonomy and competence in experts, lowering motivation and engagement. Cognitive and motivational explanations are not mutually exclusive — both may operate simultaneously.

**Asymmetry moderator**: The novice effect (d=0.505) is larger than the expert harm (d=0.428) because (a) most assistance parameters have positive effects on average regardless of expertise, and (b) low-knowledge learners are generally more susceptible to variations in instructional design. Practical implication: when uncertain about a learner's expertise level, provide assistance.

**Educational status moderator**: ERE is stronger in higher education and cross-status comparisons. Two explanations: (1) higher-ed tasks have greater element interactivity; (2) expertise accumulates over time, so later-stage learners have larger inter-individual knowledge gaps. Effect is weak in primary education — too few studies to draw firm conclusions.

**Domain moderator (novice side only)**: STEM and humanities/language learning show weaker novice effects than crafts/law/business. Domain does not significantly moderate the expert side. Mechanism unclear from this meta-analysis.

**Prior knowledge operationalization moderator**: Studies that compare groups defined by grade level show larger expert effects (d=-0.95) than studies using within-sample median splits on test scores (d=0.74 relative — i.e., substantially weaker). Interpretation: grade-level comparisons create larger actual knowledge gaps. Median splits on short tests create artificial, small gaps.

## Study Design Details

- **Design**: 2×2 within-study designs — prior knowledge (high/low) × instructional assistance (high/low). Prior knowledge operationalized via experimental induction, measurement, or demographic assumption (grade, profession).
- **Inclusion criteria**: Randomized assignment to assistance condition; domain-specific prior knowledge measure; quantitative learning outcome post-instruction; sufficient data for effect size calculation.
- **Excluded**: Studies using only domain-unspecific cognitive abilities (e.g., intelligence alone) as expertise measure.
- **Search**: PsycINFO + ERIC, December 2022 + November 2024 update; backward/forward citation search. 1674 identified, 1589 unique, 60 included.
- **Inter-rater reliability**: Cohen's Kappa=0.85 (inclusion); 94.63% agreement on coding.
- **Publication bias**: Egger's regression non-significant for both effects; funnel plots symmetric; no trim-and-fill adjustment required.

## Limitations

- **Cannot adjudicate mechanisms**: Meta-analytic design cannot distinguish between cognitive load, motivational, and zone-of-proximal-development explanations. Mechanistic questions require further experimental work.
- **High heterogeneity**: I²=87–91% for both primary effects. Substantial unexplained variance indicates important moderators not captured in this analysis (e.g., working memory capacity, motivation, task complexity, type of learning outcome).
- **Categorical treatment of continuous variables**: Both domain knowledge and assistance are continuous — dichotomizing reduces statistical power and makes effect sizes dependent on the distance between groups, which varies across studies. This is the most likely source of heterogeneity.
- **Small moderator cells**: Several moderator levels had very few studies/degrees of freedom, making subgroup inferences unreliable (e.g., primary education: j=2, k=4).
- **No moderator analysis on interaction effect**: The combined d=0.971 was not subjected to moderator analysis. Cannot tell which contexts show the strongest or weakest full interaction.
- **No real-world generalizability data**: All included studies are experimental. Non-experimental evidence on whether ERE holds in naturalistic learning contexts (classrooms, YouTube) is absent.
- **Publication window skew**: Median study year 2013 — potential lag before very recent AI-assisted/adaptive learning contexts are represented.

## Population Scope Assessment

- **Population**: Mixed — primary school, secondary school, higher education, vocational training, cross-status. Median female 55.77%.
- **Relevance to Tyler's async video context**: Medium-High. The ERE is a fundamental principle about scaffolding and prior knowledge that applies directly to tutorial design decisions: how much to explain, when to assume knowledge, how to handle audience expertise variance.
- **Red flags**: None for exclusion. Most studies are K-12 or university laboratory tasks — not YouTube viewing. The mechanism transfers but the effect sizes should not be applied numerically to video tutorial design without caution.
- **Context note**: "Instructional assistance" in this literature includes things like worked examples, annotations, teacher support, segmentation, and redundant explanatory text — all analogous to the level of explicitness in a video tutorial.

## Conclusions

"Our results suggest that the expertise reversal effect can be considered a well-confirmed ATI that can be used to guide instruction, albeit with some caveats. Providing additional assistance to learners with low domain knowledge appears to have stronger effects on learning outcomes than withholding assistance from experts."

The asymmetry finding is practically important: the benefit of scaffolding novices is larger than the cost of over-scaffolding experts. When audience expertise is unknown or mixed, lean toward providing assistance. Scaffolding should be dynamically faded as learner knowledge grows — a static level of support that was optimal at lesson start will become counterproductive as the learner builds schemas.

For younger students and humanities/language content, evidence of effectiveness is weaker and conclusions should be drawn more cautiously.

## Named Frameworks (if applicable)

- **Expertise Reversal Effect (ERE)**
  - Components: Prior knowledge (aptitude) × instructional assistance (treatment) → differential learning outcomes
  - Research alignment: High-assistance benefits novices (d=0.505); harms experts (d=-0.428); interaction d=0.971

- **Cognitive Load Theory**
  - Components: Intrinsic load, extraneous load, germane load; working memory limits
  - Research alignment: Assistance reduces extraneous load for novices; becomes redundant extraneous load for experts -> element interactivity moderates effect size

- **Assistance Dilemma (Koedinger et al.)**
  - Components: Curvilinear relationship between assistance and learning; optimal assistance is learner-dependent
  - Research alignment: Both too much and too little assistance harm learning; threshold depends on expertise

---

## Extraction Notes

This is a high-quality, methodologically rigorous 2025 meta-analysis — the most comprehensive quantitative synthesis of the ERE to date (60 studies, 5924 participants, PRISMA, cluster-robust SEs, no publication bias detected). The effect sizes are lower than the earlier Kalyuga (2007) narrative review (d=0.45–2.99) as expected with proper meta-analytic weighting.

**Relevance to Tyler's guidebook:** Very high for the curriculum-sequencing and scaffolding chapters. The core practical message — scaffold novices heavily, fade scaffolding as expertise grows, lean toward providing assistance when in doubt — translates directly to tutorial design. A YouTube tutorial that explains everything optimally for a beginner will feel tedious and patronizing to an intermediate viewer; one designed for intermediates will lose beginners. This is the foundational evidence for audience calibration as an active design decision, not a passive assumption.

**The asymmetry finding is especially actionable**: d=0.505 (novice benefit) > d=0.428 (expert harm). The upside of scaffolding novices exceeds the downside of over-scaffolding experts. For Tyler's mixed audience, this tips the decision toward more explanation, with optional fast-forward signals ("if you already know X, skip to 3:42").

**Caution on moderator heterogeneity**: I²=87–91% means the average effect sizes should be treated as orientation values, not precise predictions. The specific value will vary dramatically based on the knowledge gap between the tutorial's assumed audience and the actual viewer, and on the domain/complexity of the content.

**Note on population flag**: This research is predominantly from formal educational settings (classrooms, lab studies). The transfer to async video is theoretically sound but empirically unvalidated in this dataset. Weight the mechanism over the precise effect size numbers when applying to Tyler's context.
