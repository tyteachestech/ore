---
title: "Target size study for one-handed thumb use on small touchscreen devices"
authors: [Parhi, P., Karlson, A.K., Bederson, B.B.]
year: 2006
type: experimental
population: general-adult
sample_size: 20
key_claims:
  - "Minimum 9.2mm target size for discrete (single-tap) tasks without degrading performance or preference"
  - "Minimum 9.6mm target size for serial (multi-tap / text entry) tasks"
  - "No significant difference in error rate between 9.6mm and 11.5mm discrete targets — speed still improves but accuracy plateaus"
  - "No significant difference in error rate between key sizes ≥ 7.7mm in serial tasks, but subjective preference and error context push recommendation to 9.6mm"
  - "95th-percentile hit bounding box for 9.6mm discrete targets was 9.1 x 8.9mm across all screen locations"
  - "Screen location had no statistically significant effect on error rate in either phase, but user comfort ratings were worst in corners (especially NW and SW)"
  - "Targets on the rightmost column showed right-leaning hit drift — authors recommend extending edge targets to screen boundary"
doi: "10.1145/1152215.1152260"
pmid: unknown
evidence_grade: foundational
scope_flag: include
inflation_flag: none
---

# Target Size Study for One-Handed Thumb Use on Small Touchscreen Devices

## Study Overview

- **Citation**: Parhi, Karlson & Bederson, 2006
- **Study Type**: Controlled lab experiment (two-phase within-subjects)
- **Sample**: n=20, right-handed adults (17M/3F), ages 19-42 (mean 25.7), recruited from University of Maryland CS department. Majority experienced with keypad devices; only 5 had used touchscreen handhelds at all.
- **Device**: HP iPAQ h4155 PDA (7.1 x 11.4 cm body, 8.9 cm diagonal screen, 240x320px at 0.24mm dot pitch)
- **DOI**: 10.1145/1152215.1152260
- **PMID**: N/A (ACM venue)
- **Venue**: MobileHCI '06, Helsinki

## Key Findings

- **Finding 1 — Discrete task minimum target size (9.2mm)**: Speed improved with every target size increase (all pairwise differences significant), but error rate was statistically indistinguishable between 9.6mm and 11.5mm targets. The 95th-percentile hit bounding box for 9.6mm targets across all nine screen zones measured 9.1 x 8.9mm. Combined with subjective data (mean preferred minimum ≤ 7.7mm across regions), the authors derived 9.2mm as the recommended minimum — the smallest size that achieves near-optimal accuracy without a substantial speed penalty.
  - Error rate main effect: F(1,27) = 49.18, p < .001
  - Pairwise: 3.8mm and 5.8mm significantly worse than all larger targets; 7.7mm significantly worse than 11.5mm; 9.6mm vs. 11.5mm: NOT significant

- **Finding 2 — Serial task minimum target size (9.6mm)**: For 4-digit numeric entry sequences, error rate was significantly higher only for 5.8mm keys vs. keys ≥ 9.6mm. No significant differences among 7.7mm, 9.6mm, 11.5mm, and 13.4mm. However, users' subjective minimum for the least comfortable quadrant averaged 8.9mm, and since error rate did not decline further from 9.6mm to 11.5mm, 9.6mm is the recommended minimum for serial tasks.
  - Error rate main effect: F(2,43) = 11.83, p < .001
  - Interaction between key size and location: F(12,228) = 1.87, p = .039 (anomalous, hard to interpret)

- **Finding 3 — Speed vs. accuracy tradeoff**: Speed (task time) improved significantly at every step for both discrete and serial phases, even between the two largest target sizes. Speed does not plateau where accuracy does. This means larger-than-minimum targets still yield measurable speed gains — relevant when screen space is not a constraint.
  - Discrete time main effect: F(1,25) = 70.42, p < .001 (all pairwise comparisons significant including 9.6mm vs. 11.5mm, p = .04)
  - Serial time main effect: F(1,25) = 60.02, p < .001

- **Finding 4 — Screen location and comfort**: Location had no statistically significant effect on error rate or task time in either phase. However, subjective comfort ratings showed meaningful variation. Center of screen was most comfortable for discrete tasks (mean 5.7/7), while NW and SW corners were least comfortable (both mean 3.7/7). For serial tasks, NE quadrant was most comfortable (5.7/7), SE least (5.0/7).

- **Finding 5 — Edge target drift**: Hit distributions showed a systematic right-leaning bias for targets in the rightmost screen column (for right-handed users). Authors recommend targets at screen edges should extend fully to the boundary to capture these offset taps.

- **Finding 6 — Thumb vs. stylus divergence**: Unlike stylus input studies (where uniform keypad scaling produced equal IDs and equal performance), thumb-based serial task times continued to improve with key size even when IDs were held constant. The authors hypothesize that when keys are smaller than the thumb width, users make physical accommodations (reorienting the thumb) that add time beyond what Fitts' Law predicts.

## Effect Sizes (Raw Values)

No standardized effect sizes (Cohen's d, SMD) reported — study reports F-statistics and significance from RM-ANOVA with Bonferroni post-hoc corrections. Specific mean values from figures (read from paper):

- **Discrete error rate by target size** (approximate means from Figure 4):
  - 3.8mm: ~25% error rate
  - 5.8mm: ~15% error rate
  - 7.7mm: ~8% error rate
  - 9.6mm: ~5% error rate
  - 11.5mm: ~4% error rate (not significantly different from 9.6mm)

- **Serial error rate by key size** (approximate means from Figure 8):
  - 5.8mm: significantly higher than ≥9.6mm
  - 7.7mm, 9.6mm, 11.5mm, 13.4mm: not significantly different from each other

- **95th-percentile hit bounding boxes (discrete phase)**:
  - 3.8mm target: 6.5 x 6.5mm bounding box (42.0 mm²)
  - 5.8mm target: 7.0 x 8.6mm (60.1 mm²)
  - 7.7mm target: 6.7 x 7.9mm (53.2 mm²)
  - 9.6mm target: 9.1 x 8.9mm (81.0 mm²)

Note: Larger bounding boxes at larger target sizes reflect speed-accuracy tradeoff — users tapped faster and less precisely when targets were bigger.

## Mechanisms & Moderators

- **Fitts' Law applies to discrete tasks**: As target size increased and distance stayed constant, IDs decreased and task time decreased predictably. The model fits well for single-target pointing with the thumb.

- **Fitts' Law breaks down for serial tasks**: Because the keypad scaled uniformly (all keys and distances grew together), IDs were held constant across conditions. Under Fitts' Law, performance should have been equal — but it wasn't. Larger keys produced faster serial entry. Proposed mechanism: when keys are physically smaller than the thumb, users consciously reorient the thumb to hit smaller targets, adding latency not captured by Fitts' model.

- **Screen location as a comfort moderator (not an error moderator)**: While error rates did not statistically differ across screen locations, user comfort ratings were strongly location-dependent. Corner regions — particularly top-left and bottom-left for right-hand thumb use — required more motor effort to reach and felt less comfortable.

- **Task type is a key moderator**: Discrete (single tap) tasks tolerate slightly smaller targets (9.2mm) than serial (multi-tap) tasks (9.6mm). Error rates in serial tasks were systematically higher than in discrete tasks at all target sizes.

## Study Design Details

- **Phase 1 (discrete)**: 5 target sizes (3.8, 5.8, 7.7, 9.6, 11.5mm) x 9 screen locations x 5 repetitions = 225 trials per participant. Target surrounded by labeled distractor targets at 0mm spacing. Lift-off selection strategy. Participants instructed to favor accuracy over speed.
- **Phase 2 (serial)**: 5 key sizes (5.8, 7.7, 9.6, 11.5, 13.4mm) x 4 screen quadrants x 5 repetitions = 100 trials per participant. Task: enter 4-digit codes via soft numeric keypad.
- **Standing posture**: All tasks performed standing, one-handed, right thumb only.
- **Blinding**: Not applicable (within-subjects lab experiment).
- **Attrition**: None reported; 20 completed all trials.
- **Sessions**: ~45 minutes total including questionnaires.

## Limitations

- **Small and homogeneous sample**: n=20, predominantly male (17/3), all right-handed, all from a university CS department. Mean age 25.7. Not representative of general phone users, older adults, or left-handed users.
- **Stationary only**: Tasks performed standing still. Real-world thumb use often occurs while walking or in motion — error rates likely higher, optimal target sizes likely larger.
- **Single device form factor**: HP iPAQ PDA (a circa-2006 form factor). Screen size, aspect ratio, and grip geometry differ from modern smartphones (which are taller, wider, and heavier). Results may not transfer directly.
- **Right-hand only**: No left-hand data collected. Left-handed recommendations extrapolated by symmetry.
- **No aging or motor variability**: Thumb length ranged 99-125mm and hand width 75-97mm — variation noted but not analyzed as a moderator.
- **2006 hardware**: Screen resolution, pixel density, and glass surface characteristics differ substantially from contemporary devices. Touch registration accuracy has improved significantly.
- **Distractor design**: 0mm spacing between targets and distractors is denser than many real UI layouts. Results represent a challenging condition.

## Population Scope Assessment

- **Population**: Young adults, right-handed, technically literate (CS students/staff)
- **Relevance to non-designer building Apple apps**: High — this is foundational empirical basis for Apple's 44pt (approximately 9.8mm on standard screen) minimum tap target recommendation in HIG
- **Red flags**: Sample is narrow (CS students, young, male-dominated); device is outdated PDA; stationary only

## Conclusions

"Based on our findings, we recommend that target sizes should be at least 9.2 mm for single-target tasks and 9.6 mm for multi-target tasks in order to keep the dimensions of the targets as small as possible without decreasing performance and user preference." Speed continues to improve with targets larger than these minimums, so when screen space permits, larger is still better. The 9.2mm minimum for discrete tasks is the empirical basis cited for Apple's 44-point tap target guideline (44pt at 1x = 44/163 in. ≈ 6.8mm; at the then-standard 132ppi of early iPhones, 44pt ≈ ~8.4mm; Apple rounds up and adds padding to reach the effective ~44pt minimum, which at 2x HiDPI renders at approximately 9-10mm physical).

## Named Frameworks (if applicable)

- **Fitts' Law (Fitts, 1954)**
  - Components: Movement Time = a + b(log2(A/W + 1)), where A = amplitude (distance) and W = target width
  - Application in this paper: Used to explain speed improvement with target size increases in discrete tasks; found to be insufficient to explain serial task improvements (where ID was held constant but performance still varied)

---

## Extraction Notes

This is a foundational empirical paper — arguably the most-cited direct justification for Apple's 44pt minimum tap target guideline. The study is old (2006, PDA hardware) and the sample is narrow, but the core finding (9.2mm minimum for discrete taps) has held up as a practical heuristic and been replicated conceptually in subsequent touch research.

Key nuance for the guidebook: Apple's 44pt guideline (≈ 9.8mm at 163ppi logical resolution, with physical size varying by device pixel density) aligns well with and slightly exceeds this paper's 9.2mm recommendation — that's intentional. The paper's 9.6mm recommendation for serial tasks (text/numeric entry) is worth calling out separately: keyboard keys benefit from being even slightly larger than single buttons.

The finding that screen location matters for comfort but not for measured accuracy is practically useful: statistically you can place targets anywhere, but users feel better and self-report less effort when targets are in the center and upper regions — relevant for primary action placement.

The edge-target drift finding (right-lean for right-handed users) directly maps to why iOS edge-swipe targets and system controls at screen edges benefit from extending to the physical boundary.
