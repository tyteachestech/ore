---
title: "Steering User Behavior with Badges"
authors: [Anderson, A., Huttenlocher, D., Kleinberg, J., Leskovec, J.]
year: 2013
type: cross-sectional
population: "online community contributors (Stack Overflow users; predominantly technical adults, software-developer skewed)"
sample_size: unknown
key_claims:
  - "Badge-targeted actions (question-voting for Electorate; all voting for Civic Duty) spiked ~2-4x in the final days before badge receipt, then reverted to near-baseline within days after receipt"
  - "Badges steer behavior via two simultaneous channels: (1) increased overall site participation drawn from off-site time, and (2) shifted within-site action mix toward the targeted action"
  - "Badge acceleration intensity increases nonlinearly as the badge boundary approaches (goal-gradient effect), consistent with a utility-discounting model"
  - "Optimal single-badge threshold is surprisingly high: for a user with 5% baseline preference, the model-optimal threshold is ~75 actions (15x unassisted baseline)"
  - "Two badges targeting the same dimension should be evenly spaced and of equal value; equal value splits maximize yield vs. any unequal split"
  - "Badges have stronger steering effects for users with shorter expected platform lifetimes; longer-tenure users are moved less (counterintuitive)"
  - "Behavioral steering yield increases approximately linearly with user baseline preference (p1), with diminishing returns as badge value (Vb) rises"
doi: "10.1145/2488388.2488398"
pmid: "N/A"
evidence_grade: foundational
scope_flag: include
inflation_flag: none
addresses_questions: [Q2, Q9]
---

# Steering User Behavior with Badges

## Study Overview

- **Citation**: Anderson, A., Huttenlocher, D., Kleinberg, J., & Leskovec, J., 2013
- **Study Type**: Empirical/Computational (formal model + large-scale observational validation)
- **Sample**: Several million users on Stack Overflow (July 31, 2008 – December 31, 2010); analysis focused on users who achieved the Electorate or Civic Duty badge and were active at least 60 days before and after badge receipt
- **DOI**: 10.1145/2488388.2488398
- **PMID**: N/A (ACM WWW 2013 conference paper)

## Key Findings

- **Finding 1 — Badges demonstrably steer behavior toward targeted actions**: Users on Stack Overflow significantly increased their rate of badge-targeted actions (question-voting for Electorate; all voting for Civic Duty) in the days immediately before earning a badge, then reverted to near-baseline rates almost immediately after. This is the first concrete large-scale evidence that badges change user behavior in these two distinct ways.
  - Effect size: No formal effect size (d, SMD) reported; effect is demonstrated visually via activity-by-day plots around badge receipt. Authors describe the increase as "substantial."
  - Sample: Multi-million-user dataset; specific n for badge analyses not reported

- **Finding 2 — Acceleration effect confirmed**: Users increase their deviation from preferred action distributions progressively as they approach a badge boundary. The "turning" intensifies as the boundary nears — the darkest color shifts (in the vector field visualization, Figure 4 bottom) occur right before the badge boundary. After badge receipt, users shift back to their baseline mix, often doing the previously targeted action *less* than expected (red coloring post-boundary).
  - Effect size: Qualitative/visual; no formal statistic reported
  - Mechanism: Consistent with model prediction that incentive gradient increases as the badge boundary approaches

- **Finding 3 — Badges steer via two distinct channels simultaneously**: Badges increase (1) overall site participation (drawing probability mass from the "life-action," i.e., off-site activities) AND (2) the within-site mix of actions (shifting mass between site action types). These two mechanisms are observed empirically and are unified within the formal model.
  - Exception: In the Electorate badge, A-votes *decrease* in the days before the badge is achieved, showing that users trade off one site action for another (A-votes → Q-votes), not just time-on-site.

- **Finding 4 — Different badges produce different amounts of steering**: The two badges studied (Electorate and Civic Duty) produce visibly different steering magnitudes and patterns, consistent with the model's prediction that badge design parameters (target action type, threshold level, badge value) modulate behavioral effects.
  - Effect size: Not quantified; qualitative comparison of Figures 3a vs. 3b

- **Finding 5 — Optimal single-badge placement is at a surprisingly high threshold**: Model simulations show that badge effectiveness (yield on a targeted dimension) follows an inverted-U function of badge threshold level — there is an internal optimum far above what users would achieve without any badge. Example: for a user with only 5% base preference for an action, the optimal badge threshold is ~75 actions (15x their unassisted baseline). Badge thresholds set too low are "used up" quickly without prolonged influence; thresholds set too high fail to incentivize because surviving long enough to reach them becomes unlikely.
  - Relationship: Yield increases approximately linearly with user's baseline preference (p1); increases with diminishing returns as badge value (Vb) rises; surprisingly *decreases* as user expected lifetime increases (shorter-tenure users are steered more)

- **Finding 6 — Multiple badges targeting the same dimension should be evenly spaced and of equal value**: Model analysis of two-badge placement shows:
  - Yield is maximized when two badges are placed at distinct, approximately evenly-spaced thresholds (not combined into a single large badge)
  - Yield is maximized when total badge value is split equally between the two badges (x = z, where total value is 2z); unequal splits reduce yield
  - The second badge should be placed slightly closer to the origin than it would be optimally placed in isolation, because it also influences behavior for users still pursuing the first badge

- **Finding 7 — Feasible behavior space is non-convex and counterintuitive**: With two badges that can target different dimensions, the set of achievable user behavior outcomes is non-convex. Certain intermediate behavior distributions cannot be induced regardless of badge placement. Example: two badges on A2 can produce (5%, 70%) yield; one badge each on A1/A2 can produce (15%, 50%); but (10%, 60%) is not achievable with any combination.

## Effect Sizes (Raw Values)

This paper does not report traditional effect sizes (Cohen's d, SMD, OR). Results are established through:

- **Behavioral shift (Electorate badge)**: Visually substantial pre-badge spike in Q-votes and concurrent dip in A-votes; exact magnitudes readable from Figure 3 (~2–4x increase in Q-vote rate in final days before badge)
- **Behavioral shift (Civic Duty badge)**: Pre-badge spike in Q-votes and A-votes combined; other actions (Qs, As) remain relatively stable
- **Reversion after badge**: Near-immediate return to baseline rates post-badge receipt, for both badges
- **Turning intensity (Electorate)**: Vector field analysis (Figure 4) shows near-zero deviation from preferred path far from the badge; darkest deviation (most question-voting above baseline) immediately before the 600 Q-vote boundary
- **Optimal badge threshold (model)**: For p1 = 0.05, optimal placement ≈ 75 (θ = 0.99); for p1 = 0.45, optimal placement ≈ 90
- **Yield sensitivity**: Yield increases ~linearly with p1; increases with diminishing returns with Vb; decreases as expected lifetime (1/(1-θ)) increases
- **Two-badge optimum**: Badges placed evenly apart at distinct thresholds outperform both same-location and widely-separated placements (Figure 7); equal value split (x = z) maximizes yield vs. any unequal split (Figure 8)

Note: No heterogeneity statistics (I², τ²), no confidence intervals reported. This is a computational/empirical CS paper, not a meta-analysis or RCT.

## Mechanisms & Moderators

- **Mechanism 1 — Utility trade-off**: Users are modeled as rational actors balancing (a) staying close to their preferred action distribution and (b) obtaining badge value sooner. As badge proximity increases, the discounted value of the badge rises relative to the cost of deviating from preferences, producing accelerating steering.

- **Mechanism 2 — Discounting by survival probability**: Badge value is discounted by the probability of remaining on the site long enough to earn it. This is why thresholds that are too high fail — and why shorter-tenure users are paradoxically steered more (they face greater discounting pressure to act quickly).

- **Mechanism 3 — Two distinct behavioral channels**: Steering operates simultaneously through increasing overall site activity (competing with the "life-action") and shifting within-site action mix. These channels can act in parallel but are theoretically separable.

- **Mechanism 4 — Post-badge reversion**: Once a badge boundary is crossed, there is no further incentive from that badge, so users return to their preferred action distribution. The model predicts — and data confirms — this near-immediate reversal.

- **Moderator 1 — User baseline preference (p1)**: Users with higher baseline preference for the targeted action show higher yield AND benefit from badges placed at higher thresholds. Designers can steer users more on actions they *dislike* (low p1) than on actions they already prefer, though absolute yield is lower.

- **Moderator 2 — Badge value (Vb)**: Higher badge value → higher yield, but with diminishing returns. Doubling badge value does not double behavioral change.

- **Moderator 3 — Expected user lifetime (θ)**: Counterintuitively, badges have stronger steering effects when users have shorter expected lifetimes. Long-tenure users are not moved as much because the discounting pressure to act quickly is lower.

- **Moderator 4 — Badge threshold placement**: The relationship between threshold and yield is an inverted-U (internal optimum). Too low: badge is achieved before it can exert sustained influence. Too high: expected probability of surviving to the badge is too low to incentivize present behavior change.

- **Moderator 5 — Number and spacing of badges**: Spreading multiple badges evenly across a dimension outperforms concentrating them. Equal value splits outperform unequal splits.

- **Unstated moderator — Badge visibility/salience**: The paper assumes users can see their progress toward badges (Stack Overflow displays this). This visibility is crucial to the model; the empirical findings may not generalize to opaque badge systems.

- **Unstated moderator — Intrinsic motivation / crowding-out**: The model treats badge value as a primitive and does not address whether external rewards may crowd out intrinsic motivation over time. Post-badge reversion could reflect either restored natural preferences OR reduced intrinsic interest.

## Study Design Details

- **Intervention/Exposure**: Observation of naturally occurring badge systems on Stack Overflow; no experimental manipulation
- **Badges studied**: "Electorate" (600+ Q-votes, with Q-vote:A-vote ratio ≥ 1:4) and "Civic Duty" (300+ total votes)
- **Control/Comparison**: Within-user comparison: behavior 60+ days before vs. immediately before vs. immediately after badge receipt; also, vector field comparisons of action probabilities at varying distances from badge boundary
- **Follow-up period**: 60 days post-badge (minimum active requirement); full dataset spans July 2008 – December 2010
- **Attrition**: Not formally assessed; restricted to users active at least 60 days before and after badge win, which introduces survival bias
- **Blinding**: Not applicable (observational)
- **Model validation**: Formal theoretical model (Markov Decision Process structure) tested against aggregate empirical patterns; four qualitative predictions evaluated

## Limitations

- **No experimental manipulation**: Causal claims about badges "steering" behavior are observational. Cannot fully rule out selection effects (e.g., users already trending toward targeted actions may be more likely to earn badges).
- **Survival bias**: By restricting to users active 60 days before and after badge receipt, the sample excludes users who churned during badge pursuit — potentially the most discouraged or most affected users.
- **Two badges only**: Empirical validation is limited to two specific threshold badges on Stack Overflow. Generalization to other badge types (one-shot, quality-based, social badges) is not tested.
- **No effect size quantification**: Results are visual/qualitative. No formal statistical tests, confidence intervals, or effect size metrics are reported for the behavioral outcomes.
- **Badge value treated as exogenous primitive**: The model does not explain *why* badges have value or how designers can influence it. This is a significant gap for applied use.
- **Platform-specific**: Stack Overflow is a high-engagement, technically sophisticated community. Results may not generalize to casual users, younger populations, or lower-stakes platforms.
- **No quality measurement (for primary findings)**: Authors note in the conclusion that pre-badge votes on Stack Overflow are "significantly more positive" before Electorate badge receipt than after — meaning steering may degrade action quality — but this is mentioned briefly as a future direction, not analyzed.
- **Crowding-out not addressed**: Model and analysis cannot distinguish between "user returns to natural preferences post-badge" vs. "badge reward undermines intrinsic motivation."
- **No heterogeneity across users**: Aggregate analysis; individual differences in response to badges are not examined.

## Population Scope Assessment

- **Population**: Online community contributors (Stack Overflow users, predominantly technical adults; skewed toward software developers)
- **Relevance to casual behavior change**: Medium — the mechanisms (progress visibility, threshold incentives, acceleration effects) are theoretically applicable to casual habit/behavior change systems, but the population is self-selected, high-engagement, and intrinsically motivated in ways that casual users may not be
- **Red flags**: Not a clinical or addiction population. However, this is not a psychology experiment — it is a CS/behavioral economics paper on platform design. Effect sizes cannot be compared to psychological intervention literature.

## Conclusions

The authors conclude that badges function as genuine behavioral incentives on Stack Overflow, steering users both toward targeted actions and toward increased overall site participation, with intensity accelerating near badge boundaries and reverting immediately post-achievement. They find that optimal badge placement involves surprisingly high thresholds, equal-value splits across multiple badges, and roughly even spacing — design principles that emerge from the formal model rather than being assumed. As they state: "to our knowledge, this is the first concrete evidence of users changing their behavior in either of these two distinct ways in response to badges."

## Named Frameworks

### Badge Placement Model (Anderson et al., 2013)

- **Components**: Action-type space (n dimensions + life-action), user preferred distribution (p), cost function g(x,p) for deviation from p, badge value (Vb), survival discounting (θ), badge boundary (threshold k on dimension i)
- **Research alignment**:
  - Preferred distribution → baseline intrinsic motivation / natural behavioral tendencies
  - Badge value → extrinsic reward value
  - Discounting by survival probability → temporal discounting / urgency under uncertainty
  - Acceleration toward boundary → goal-gradient effect (empirically matches classic psychology)
  - Post-badge reversion → extinction of extrinsically-driven behavior change

---

## Full Moderator/Subgroup Table

The paper does not report formal moderator analyses with statistical tests. The following table captures the model simulation results that vary parameters systematically:

| Moderator | Condition | Yield Direction | Optimal Badge Threshold | Notes |
|-----------|-----------|-----------------|------------------------|-------|
| User baseline preference (p1) | p1 = 0.05 | Lowest yield | ~75 | Gain highest relative to baseline |
| User baseline preference (p1) | p1 = 0.15 | Low yield | ~80 | Intermediate |
| User baseline preference (p1) | p1 = 0.25 | Medium yield | ~85 | Intermediate |
| User baseline preference (p1) | p1 = 0.35 | High yield | ~87 | Intermediate |
| User baseline preference (p1) | p1 = 0.45 | Highest yield | ~90 | Gain lowest relative to baseline |
| Badge value (Vb) | Low | Lower yield | — | Increases with diminishing returns |
| Badge value (Vb) | High | Higher yield | — | Marginal gain decreases |
| Expected lifetime (1/(1-θ)) | Short | Higher yield | Lower threshold optimal | Counterintuitive; discounting pressure is stronger |
| Expected lifetime (1/(1-θ)) | Long | Lower yield | Higher threshold optimal | Less urgency to steer quickly |
| Number of badges (same dimension) | 1 badge | Baseline yield | Internal optimum | — |
| Number of badges (same dimension) | 2 badges, same location | Reduced yield | — | Worse than 2 separate locations |
| Number of badges (same dimension) | 2 badges, evenly spaced | Maximized yield | Each ≈ half of combined optimum | Best configuration |
| Badge value split (2 badges) | Equal (x = z) | Maximized yield | — | Best configuration |
| Badge value split (2 badges) | Unequal (x ≠ z) | Reduced yield | — | Worse; more unequal = worse |
| Badge targeting (2 badges) | Both on A1 | High A1 yield, low A2 yield | — | Non-convex feasible region |
| Badge targeting (2 badges) | One each on A1, A2 | Balanced yield | — | Best for multi-dimensional goals |
| Badge targeting (2 badges) | Both on A2 | Low A1 yield, high A2 yield | — | Symmetric to both-on-A1 case |

No formal subgroup statistics (k, n, 95% CI) reported for any moderator.

## Quotable Passages

> "To summarize, the above experiments demonstrate that badges can steer user behavior in a manner consistent with our model. First, we observe user site activity increases as users approach the badge and thus site activity increases at the expense of the life-action. And second, we observe that users also shift their effort on the site towards actions that lead them to badges. To our knowledge, this is the first concrete evidence of users changing their behavior in either of these two distinct ways in response to badges." (Section 3, Activity around the badge boundary)

> "Notice that activity on the targeted actions (Q-votes for Electorate, Q-votes and A-votes for Civic Duty) increases substantially before users achieve the badge, and then almost immediately returns to near-baseline levels." (Section 3, Activity around the badge boundary)

> "These results suggest interesting relationships between the model parameter settings and the amount of steering induced by the badge... the yield increases approximately linearly in p1 (but the gain decreases linearly), increases with diminishing returns in Vb, and surprisingly decreases in the expected lifetime of the user. The decreasing relationships are particularly interesting; they imply that the designer can steer users more on the actions they dislike (i.e., low p1) than those they like, and that badges have stronger effects when users' lifetimes are shorter." (Section 4, Optimal location and yield with one badge)

## Boundary Conditions & Population Caveats

- **Applies to**: Threshold badges (cumulative count-based); online community platforms where users can see their real-time progress toward a badge; engaged, self-selected contributor populations; badges targeting behavioral repetition (voting, answering) rather than one-shot quality contributions
- **Does NOT apply to**: One-shot badges (e.g., "Great Question" for a single high-quality contribution); opaque badge systems where progress is not visible; platforms with purely extrinsic or monetary reward systems; clinical populations with compulsive or addiction-related behavioral patterns
- **Unknown/untested**: Whether badge effects persist over very long user lifetimes; whether effects differ by user experience level (novice vs. power user); whether post-badge reversion represents restored intrinsic motivation or motivation crowding-out; whether design principles transfer from online communities to casual/mobile habit apps; how badge effects interact with social comparison (leaderboards, peer visibility)

---

## Extraction Notes

This is a computer science / computational social science paper, not a psychology RCT. Its primary contribution is (1) a formal behavioral model and (2) large-scale qualitative validation of that model on Stack Overflow. It does not report effect sizes in the psychological sense.

**High value for gamification guidebook creation.** The paper provides the most rigorous formal framework in the early badge literature for understanding *why* badges work and *how* to design them. The four core predictions (steering, differential magnitude, acceleration, dual channels) are well-supported empirically. The badge placement design principles (high thresholds, equal spacing, equal value splits) are directly actionable for NotionRPG badge system design.

**Key design takeaways for NotionRPG:**

1. Badge thresholds should be set surprisingly high — far beyond what users would naturally achieve — to sustain long-term incentive pressure
2. Multiple badges on the same behavior should be evenly spaced and of equal value; avoid clustering badges or making one badge much more valuable than others
3. Progress visibility is a prerequisite — the model and empirical findings assume users know their proximity to badge boundaries
4. Expect post-badge behavioral reversion; plan for sequential badge series to maintain steering after each milestone
5. Badges are better at steering behaviors users dislike (low baseline preference) than behaviors they already prefer, though the absolute ceiling is lower

**Limitation to flag for conflict resolution:** The paper's theoretical badge value parameter is never operationalized. It is unclear whether "badge value" in this model maps onto points, status signals, cosmetic rewards, or intrinsic achievement satisfaction — all of which may behave differently in practice.

---

<!-- SOURCE CLASSIFICATION NOTES

Study type: cross-sectional (observational, large-scale)
Rationale: Observational study drawing from a multi-year dataset snapshot on Stack Overflow. No experimental manipulation. The formal model is theoretical; empirical validation is based on archival behavioral data, not a controlled trial. Classified as cross-sectional rather than longitudinal because the analysis window (60 days pre/post badge) is a bounded observational slice with no intervention or prospective tracking of participants.

Population relevance (NotionRPG):
Medium-high. Stack Overflow users are self-selected, high-engagement technical adults — not representative of general casual users or the broader self-improvement population NotionRPG targets. However, the core mechanisms (goal-gradient acceleration, progress visibility, post-reward reversion, multi-badge spacing) are theoretically general and align with behavioral economics literature applicable to any reward-threshold system. Transfer validity should be flagged when citing specific threshold magnitudes.

Inflation flags: none
This paper does not suffer from the typical gamification inflation patterns. It is a computational social science paper drawing on millions of behavioral observations rather than short-duration lab experiments. No self-report measures, no demand characteristics, no novelty inflation concern within the analysis window.

Questions addressed:
- Q2: Core evidence that badges change behavior; mechanism of steering toward targeted actions; how threshold proximity drives acceleration (goal-gradient)
- Q9: Post-badge reversion as a failure mode; attention-shift side effects (A-votes drop while pursuing Electorate badge); survival bias as a gap in the evidence

Key conflicts to watch in evidence consolidation:
- Model treats "badge value" as an unexplained primitive — conflicts with SDT literature (Sailer 2017, Li 2024) which requires that the psychological type of reward (intrinsic vs. extrinsic) matters
- Post-badge reversion here is framed as "restored natural preferences" — potentially conflicts with crowding-out / overjustification interpretation from Deci et al. (1999) and Mekler et al. (2017)
- Optimal threshold being "surprisingly high" may not transfer to casual/mobile users whose expected lifetime on a productivity app differs sharply from Stack Overflow contributors

-->
