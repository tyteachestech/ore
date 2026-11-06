---
title: "Do badges increase user activity? A field experiment on the effects of gamification"
authors: [Hamari, J.]
year: 2017
type: quasi-experimental
population: "university community members (students ~90%, staff ~10%) in a peer-to-peer sharing marketplace"
sample_size: 2989
key_claims:
  - "Badge implementation produced significantly higher activity on 3 of 4 behavioral outcomes (accepted transactions, comments, page views) after controlling for network effects and tenure"
  - "Effect on posting trade proposals was significant in unadjusted analysis (r=0.167) but became non-significant after controlling for network effects and tenure in Poisson regression (p=0.182)"
  - "Effect sizes ranged from small to medium: r2=0.010 (trade proposals) to r2=0.029 (comments) in unadjusted ANOVA; Poisson Exp(B) ranged from 1.819 (page views) to 4.536 (accepted transactions)"
  - "Post-implementation group had nearly double the mean trade proposals (0.84 vs. 0.45) and nearly 5x the mean accepted transactions (0.41 vs. 0.09)"
  - "Study is the longest-duration A/B-style field experiment on badges in existing gamification literature (2 years total: 1 year pre + 1 year post)"
doi: "10.1016/j.chb.2015.03.036"
pmid: "unknown"
evidence_grade: foundational
scope_flag: include-with-caution
inflation_flag: none
---

# Do Badges Increase User Activity? A Field Experiment on the Effects of Gamification

## Study Overview

- **Citation**: Hamari, J., 2017 (available online April 2015)
- **Study Type**: Quasi-experimental field experiment (between-groups, pre/post implementation design)
- **Sample**: n=2989 total (pre-implementation group n=1410, post-implementation group n=1579); ~90% university students, ~10% university staff at a major Finnish university; single Sharetribe peer-to-peer marketplace installation
- **DOI**: 10.1016/j.chb.2015.03.036
- **PMID**: Not available (Computers in Human Behavior journal)

## Key Findings

- **Finding 1 — Badges significantly increased accepted transactions**: Post-implementation users completed nearly 5x more accepted transactions on average (0.41 vs. 0.09). Effect remained significant in Poisson regression controlling for network effects and tenure.
  - Unadjusted ANOVA: F(1, 1871.545)=88.066, p=0.000, r2=0.029 (small-to-medium)
  - Mann-Whitney U: p=0.000, r=0.194
  - Poisson regression with controls: Wald=41.371, p=0.000, Exp(B)=4.536 (users in gamified condition ~4.5x more likely to complete a transaction)

- **Finding 2 — Badges significantly increased comments posted**: Post-implementation users posted ~5x more comments on average (0.48 vs. 0.09).
  - Unadjusted ANOVA: F(1, 1996.841)=79.965, p=0.000, r2=0.026 (small-to-medium)
  - Mann-Whitney U: p=0.000, r=0.193
  - Poisson regression with controls: Wald=8.678, p=0.003, Exp(B)=1.907

- **Finding 3 — Badges significantly increased page views (general activity)**: Post-implementation users had more page views on average (2.08 vs. 1.85 per user).
  - Unadjusted ANOVA: F(1, 2821.909)=52.988, p=0.000, r2=0.017 (small)
  - Mann-Whitney U: p=0.000, r=0.094
  - Poisson regression with controls: Wald=1686.979, p=0.000, Exp(B)=1.819

- **Finding 4 — Badge effect on trade proposals did not survive confound controls**: Raw comparison showed post-implementation users posted nearly double the trade proposals (0.84 vs. 0.45), significant in unadjusted tests, but effect became non-significant when network effects and tenure were controlled.
  - Unadjusted ANOVA: F(1, 2986.977)=29.161, p=0.000, r2=0.010 (small)
  - Mann-Whitney U: p=0.000, r=0.167
  - Poisson regression with controls: Wald=1.785, p=0.182, Exp(B)=1.223 (non-significant)
  - Interpretation: The increase in trade proposals is largely explained by the service growing (more users = more listings to see and respond to), not badges per se

- **Finding 5 — Overall MANOVA confirms gamification effect**: Combined multivariate test across all four dependent variables was significant.
  - MANOVA: F(4, 2984)=29.937, p=0.000, Wilks' Lambda=0.961

## Effect Sizes (Raw Values)

**Unadjusted between-group comparisons (ANOVA + Mann-Whitney U):**

| Outcome | Pre Mean | Post Mean | F | df | p | r2 | r (MW-U) |
|---------|----------|-----------|---|----|---|-----|----------|
| Trade proposals | 0.4504 | 0.8417 | 29.161 | (1, 2986.977) | 0.000 | 0.010 | 0.167 |
| Accepted transactions | 0.0872 | 0.4098 | 88.066 | (1, 1871.545) | 0.000 | 0.029 | 0.194 |
| Comments | 0.0943 | 0.4794 | 79.965 | (1, 1996.841) | 0.000 | 0.026 | 0.193 |
| Page views | 1.854 | 2.082 | 52.988 | (1, 2821.909) | 0.000 | 0.017 | 0.094 |

Note: Standard deviations reported in paper — Trade proposals: pre 0.449, post 1.286; Transactions: pre 0.432, post 1.486; Page views: pre 45.07, post 83.49 (very high variance).

**Poisson regression with controls (Intervention coefficient only):**

| Outcome | Wald | p | Exp(B) | Significant? |
|---------|------|---|--------|-------------|
| Trade proposals | 1.785 | 0.182 | 1.223 | No |
| Accepted transactions | 41.371 | 0.000 | 4.536 | Yes |
| Comments | 8.678 | 0.003 | 1.907 | Yes |
| Page views | 1686.979 | 0.000 | 1.819 | Yes |

**Effect size benchmarks used** (Cohen, 1988): r2 >0.010=small, >0.090=medium, >0.250=large; r >0.100=small, >0.300=medium, >0.500=large.

## Mechanisms & Moderators

- **Mechanism 1 — Goal-setting**: Badges provide explicit, quantified goals (bronze/silver/gold levels). Bandura (1993): clear goals increase performance by anchoring expectations, enhancing self-efficacy, and generating positive affect on completion. The badge descriptions specified exactly how many actions to complete.
- **Mechanism 2 — Guidance/service onboarding**: Badges functioned as a guide to service features, reducing ambiguity about what users should do. This "guidance mechanic" may be especially strong in utilitarian services where the optimal usage path is non-obvious.
- **Mechanism 3 — Feedback**: Badge unlock notifications (email) provided feedback. Author notes this is less instantaneous than other gamification settings and may be weaker here than in real-time systems.
- **Mechanism 4 — Social comparison and social proof**: Earned badges were publicly visible on user profiles. Seeing others' badges validates activities as worthwhile and may trigger conformity-seeking behavior.
- **Mechanism 5 — Collection behavior**: Unlocking the complete set of badges provides a meta-goal beyond the individual badge goals.
- **Mechanism 6 — Novelty (alternative explanation)**: The change in behavior may partly reflect curiosity toward the new badge system, not sustained motivation. The 1-year post period mitigates but does not eliminate this concern — however, novelty was not directly measured.

**Moderators (not formally tested; discussed theoretically):**
- **Goal commitment**: Users must be committed to pursuing badge goals for effects to occur; uncommitted users may find badges trivial.
- **System type (utilitarian vs. hedonic)**: Utilitarian services (like a trading marketplace) may respond differently from hedonic services.
- **Individual differences**: User personality, player type, and demographics likely moderate effects; not measured.
- **Network size**: Controlled as a confound variable. Larger service network independently predicts higher activity (confirmed in regression).

## Study Design Details

- **Intervention**: Implementation of a multi-level badge system (bronze/silver/gold) covering all core service activities — trade proposals, transactions, commenting, page views/logins, plus type-specific proposal badges and a seasonal badge. Badges displayed on user profiles; users notified by email on unlock.
- **Badge design**: Three levels per activity type. Bronze = easy (e.g., 2 actions), Silver = moderately difficult, Gold = very active use required (e.g., 15 actions). All users automatically eligible for all badges; no prerequisites.
- **Platform**: Single Sharetribe peer-to-peer marketplace at a major Finnish university (largest of ~479 worldwide installations at the time).
- **Control/Comparison**: Between-groups design: users registered in the year prior to implementation (n=1410) vs. users registered in the year following implementation (n=1579). Each user's activity was tracked only within their respective registration year window to prevent overlap.
- **Follow-up period**: 1 full year per group (2 years total study duration). Dependent variable counts are bounded to each user's registration window only — no cross-period contamination.
- **Attrition**: Not formally reported. Design choice prevents tracking individual users over time.
- **Blinding**: None; field experiment in live service.
- **Confounds controlled**: (1) Tenure — time available to accumulate dependent variable counts; (2) Network effects — count variable of how many users existed at registration time.
- **Statistical approach**: t-test → ANOVA → Mann-Whitney U (for non-normal distributions) → GLM Poisson regression with confound controls.

## Limitations

**Stated by authors:**
- No demographic data collected; assumed ~18-30 age range and gender split typical of basic sciences at a Finnish university (~90% students, ~10% staff)
- Between-groups design prevents individual-level before/after comparison; cannot fully rule out cohort differences between pre/post registration cohorts
- Cannot infer which psychological mechanism mediated effects (no survey/psychological measurement)
- Novelty effect not directly measured or ruled out across the 1-year post period

**Unstated/obvious:**
- **Single site, single country**: Finnish university peer-to-peer marketplace is a narrow, culturally specific, highly homogeneous sample. Generalizability to consumer apps or global platforms is untested.
- **No active comparison group**: No condition with gamification elements other than badges (e.g., points-only, leaderboards-only). Cannot isolate badges from platform maturation effects beyond the controlled confounds.
- **Non-random assignment**: Users self-selected into pre/post periods by timing of their registration. Cohort effects (e.g., different types of students enroll in different years, service reputation changed) cannot be fully excluded.
- **Very sparse base rates**: Mean accepted transactions of 0.09 (pre) and 0.41 (post) indicate most users never completed a transaction. Effect sizes on rare behaviors are highly sensitive to outliers.
- **High variance**: Page views standard deviation (45 pre, 83 post) vastly exceeds the mean, indicating extremely skewed distributions. The Poisson regression partially addresses this but the practical significance of effects on low-frequency users is unclear.
- **No long-term decay analysis**: The 1-year post window is treated as homogeneous; temporal decay within the year (e.g., novelty wearing off after months 1-3) is not reported.
- **Publicly funded research**: Finnish government grants; no industry conflict, but the Sharetribe platform is operated by a for-profit entity, though the researcher appears independent.

## Population Scope Assessment

- **Population**: University students (~90%) and staff (~10%) at a major Finnish university. Narrow age range (~18-30), higher education context, sharing economy service. Not a consumer behavior change app population.
- **Relevance to consumer app design**: Medium. The badge mechanisms studied (goal-setting, social visibility, feedback) are directly applicable to consumer app design, but the specific effect magnitudes are from a utilitarian peer-to-peer trading context which differs meaningfully from productivity/habit apps. The very low base rates of target behaviors further limit direct extrapolation.
- **Red flags**: Not clinical. However, homogeneous student population at a single institution in Finland limits generalizability. Behaviors measured (trading, commenting) are more transactional/marketplace behaviors than habit or skill behaviors typical of consumer behavior change apps.

## Conclusions

The study finds that badge implementation was associated with significantly higher user activity on 3 of 4 measured outcomes (accepted transactions, comments, page views) in a year-long field experiment, with effects surviving controls for network growth and tenure. The effect on trade proposals did not survive confound adjustment. The author concludes: "The study indicates that all of the use-related dependent variables were significantly higher for the post-implementation group which was exposed to gamification" — though acknowledges that for trade proposals specifically, network effects explain the difference. Effects sizes are small-to-medium by Cohen (1988) benchmarks. The paper is notable as the longest-duration gamification field experiment in the literature at the time of publication, and it deliberately isolated a single mechanic (badges) in a live real-world service.

## Named Frameworks

### Badge Design Pattern (Hamari & Eranti, 2011)

- **Components**: (1) Signifier — name, visual, description; (2) Completion logic — actions required to unlock; (3) Reward — the earned badge displayed on profile
- **Implementation in this study**:
  - Signifier: Named badges (e.g., "Generous," "Chauffeur"), activity-depicting avatar visuals, bronze/silver/gold color coding
  - Completion logic: Pre-defined action counts (2/6/15 for type-specific badges); no prerequisites
  - Reward: Badge displayed on public profile; email notification on unlock

---

## Full Moderator/Subgroup Table

No formal moderator analyses were conducted. The study did test and control for two confounds in the Poisson regression:

| Variable | Role | Direction | Wald | p | Exp(B) | Notes |
|----------|------|-----------|------|---|--------|-------|
| Tenure (time to accumulate activity) | Control | Positive | 100.172 (trade), 4.735 (tx), 12.130 (comm), 1099.682 (pv) | p<0.001 for most | 1.150 (trade), 1.050 (tx), 1.081 (comm), 1.048 (pv) | More time = more activity; confirmed expected relationship |
| Network effects (users at registration) | Control | Positive for most | 10.277 (trade), 0.053 (tx), 24.495 (comm), 5.492 (pv) | 0.001, 0.819 (NS for tx), 0.000, 0.019 | 1.000, 1.000, 1.001, 1.000 | Larger service = more potential interactions; NS for transactions specifically |
| Gamification intervention | Main IV | Positive (3 of 4) | 1.785 (trade-NS), 41.371 (tx), 8.678 (comm), 1686.979 (pv) | 0.182 (NS), 0.000, 0.003, 0.000 | 1.223 (NS), 4.536, 1.907, 1.819 | Trade proposals not significant after controls |

No subgroup analyses by badge type, user engagement level, or demographics were reported.

## Quotable Passages

> "The study indicates that all of the use-related dependent variables were significantly higher for the post-implementation group which was exposed to gamification. Users were seen to be more likely to actively use the service, list their goods for trade, and comment on listings and to complete transactions. However, when controlling for network effects and tenure, the relationship between the intervention and the amount of trade proposals was no longer significant." (Section 5, Discussion)

> "Furthermore, to the best of our knowledge, this study is the longest duration a/b-test-style experiment to be conducted on badges with a reasonably high subject count." (Section 3.2, Field experiment)

> "The present study investigated the direct relationship between the gamification implementation and behavioral outcomes. Therefore, there is no reliable way to infer which psychological aspect mediated the effects." (Section 5, Discussion)

## Boundary Conditions & Population Caveats

- **Applies to**: Utilitarian peer-to-peer service contexts; badge systems awarding all core service activities; university-age users (18-30) with moderate intrinsic motivation to use the service; badge designs with tiered progression (bronze/silver/gold), clear goal specification, and public profile display; effects on transactional/social behaviors (not learning or habit formation)
- **Does NOT apply to**: Short-duration studies (this is 1-year pre + 1-year post; short studies may capture only novelty); badge systems without progress visibility; populations with strong external constraints on behavior (e.g., behaviors gated by supply/demand, not just motivation); clinical or addiction populations
- **Unknown/untested**: Whether effects persist beyond 1 year or decay over time within the post period; individual differences in response (player type, personality, demographics); whether effects generalize beyond a single Finnish university site; the specific psychological mechanism(s) driving the observed behavioral changes; whether similar effects would occur in hedonic (vs. utilitarian) app contexts; whether novice vs. experienced users respond differently

---

## Extraction Notes

**Methodological strength**: This is among the most rigorous single-study gamification field experiments in the literature — 2 years total duration, large sample (n=2989), live real-world service, single mechanic isolated (badges only), behavioral data (not self-report), and confound controls via Poisson regression. The fact that the author controlled for network effects and tenure — and honestly reported that trade proposals became non-significant — adds to credibility.

**Key nuance for guidebook**: The headline result ("badges increase user activity") requires qualification. Three of four outcomes survived confound adjustment; one did not. The Poisson-adjusted effect for trade proposals (Exp(B)=1.223, p=0.182) is non-significant and should not be cited as evidence badges increase proposal posting. The strongest evidence is for accepted transactions (Exp(B)=4.536) — a 4.5x multiplier — though this is on an extremely low base rate (0.09 → 0.41 mean), meaning most users still completed zero transactions.

**Context specificity warning**: This is a Finnish university peer-to-peer marketplace (Sharetribe). Behaviors are transactional — posting, buying, selling, commenting. This context differs substantially from consumer behavior change apps, productivity tools, or learning platforms. Effect magnitudes should not be transferred directly to other contexts.

**Novelty concern**: Despite the 1-year observation window per group, the paper does not report within-year temporal trends. It is possible that effects were concentrated in months 1-3 post-implementation and decayed. The between-groups design makes this impossible to detect. Combine with Rodrigues (2022) novelty effect findings when citing.

**Design takeaways for guidebook chapter on badges:**
1. Badge implementation on a utilitarian service increased most behavioral outcomes significantly over a 1-year window — providing rare long-duration evidence
2. Not all behaviors respond equally; behaviors tied to marketplace supply/demand (trade proposals) showed confounded effects
3. Badge design: tiered progression (3 levels), all core activities covered, progress visible on public profile, email notifications on unlock — this "full-featured" implementation may be important for effect size
4. No psychological mediation measured — the mechanism is inferred, not demonstrated in this study

---

<!-- SOURCE CLASSIFICATION NOTES

Study type: quasi-experimental
Rationale: Between-groups field experiment comparing pre- vs. post-implementation cohorts. Not a true RCT because users self-selected into registration period (no random assignment to gamified vs. non-gamified condition). However, the design is substantially stronger than cross-sectional observational studies: same platform, single mechanic introduced, year-long measurement windows, confound controls. Classified quasi-experimental.

Population relevance (gamification guidebook):
Medium. Finnish university students using a peer-to-peer sharing marketplace is a specific, narrow context. However, the badge design pattern used (tiered levels, all-activity coverage, public profile display, email notifications) closely resembles implementations in commercial apps (Foursquare, Duolingo, fitness apps). Mechanisms are theoretically transferable. Effect magnitudes should be cited with context caveat.

Inflation flags: none
No known inflation domain. This is a behavioral field study, not a self-report or lab experiment. No novelty inflation concerns in the standard sense, though within-year temporal decay is not reported. The pre/post design controls for some platform maturation effects via the tenure and network effect controls.

Key conflicts to watch in evidence consolidation:
- Trade proposals effect non-significant in controlled analysis: conflicts with raw/unadjusted reading that might overstate badge effectiveness
- Mechanism not measured: conflicts with SDT-based explanations (van Roy 2018) that require psychological mediation to be assessed
- Novelty concern: this study cannot rule it out; contrast with Rodrigues (2022) which directly measured novelty decay
- Population vs. consumer app gap: should not cite Finnish university marketplace effect sizes as directly applicable to mobile consumer apps

-->
