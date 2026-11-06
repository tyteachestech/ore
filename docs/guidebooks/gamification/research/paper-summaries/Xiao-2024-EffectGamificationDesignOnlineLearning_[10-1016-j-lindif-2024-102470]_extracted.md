---
title: "The Effect of Gamification Design of Online Learning Platforms on User Learning Performance"
authors: [Chen, A., Wang, T.]
year: 2024
type: experimental
population: mixed
sample_size: 205
key_claims:
  - "Both competitive and cooperative gamification designs significantly increased perceived challenge (F=6.83/6.12, p<0.05) and perceived attention (F=6.52/7.19, p<0.05) vs. no-gamification control"
  - "Competitive gamification drove the largest learning outcome gains: Platform B (competitive only) M=10.44 vs. Platform A (control) M=8.13 on a 15-point knowledge test"
  - "Perceived challenge mediates gamification → learning outcomes; perceived attention mediates gamification → cognitive engagement — but these pathways do not cross (challenge does not predict cognitive engagement; attention does not predict learning outcomes)"
  - "No significant interaction effect between competitive and cooperative designs on any outcome — effects are additive, not synergistic"
  - "Post-hoc power analysis: achieved power = 0.65 (below 0.80 threshold), flagging underpowered design"
doi: "10.1016/j.lindif.2024.102470"
pmid: unknown
evidence_grade: preliminary
scope_flag: include-with-caution
inflation_flag: none
---

# The Effect of Gamification Design of Online Learning Platforms on User Learning Performance

## Study Overview
- **Citation**: Chen, A. & Wang, T., 2024
- **Study Type**: Experimental — 2×2 factorial online controlled experiment
- **Sample**: n=205 valid participants; Platform A (control, n=46), Platform B (competitive, n=50), Platform C (cooperative, n=54), Platform D (both, n=55)
- **Population**: Chinese adults recruited via WeChat and Douban communities; 42.4% aged 18–25, 37.6% aged 26–35; 54.6% enterprise employees, 37.6% students; 90%+ held bachelor's degree or above; 60%+ self-rated Python proficiency as low to very low
- **Intervention**: 15-minute interaction with one of four purpose-built online learning platforms (Python intro course) varying in gamification design layer
- **DOI**: 10.1016/j.lindif.2024.102470
- **PMID**: unknown

## Key Findings

- **Finding 1 — Both gamification types increase flow proxies**: Competitive design significantly raised perceived challenge (F=6.83, p=0.010) and perceived attention (F=6.52, p=0.011). Cooperative design similarly raised perceived challenge (F=6.12, p=0.014) and perceived attention (F=7.19, p=0.008). No significant interaction between the two design types on either flow variable (p=0.25–0.30).

- **Finding 2 — Competitive design has a stronger effect on learning outcomes**: Competitive design main effect on learning outcomes: F=15.48, p<0.001, η²=0.036. Cooperative design also significant: F=6.35, p=0.013, η²=0.032. Platform A (control) M=8.13/15; Platform B (competitive) M=10.44/15; Platform C (cooperative) M=9.83/15; Platform D (both) M=11.09/15.

- **Finding 3 — Cognitive engagement effect is weaker and cooperative-only is non-significant**: Competitive design on cognitive engagement: F=2.90, p=0.030, η²=0.038. Cooperative design on cognitive engagement: F=1.98, p=0.164 (not significant). Platform A M=5.53; Platform B M=5.84; Platform C M=5.82; Platform D M=5.96 (all on 7-point scale).

- **Finding 4 — Perceived challenge mediates gamification → learning outcomes (not cognitive engagement)**: SEM path coefficients: Competitive → PC: β=0.190, p=0.005; Cooperative → PC: β=0.176, p=0.010; PC → Learning Outcomes: β=0.301, p<0.001; PC → Cognitive Engagement: β=0.085, p=0.203 (not significant). PROCESS macro mediation: X1→PC→Y1 indirect effect=0.531, 95% CI [0.136, 0.982], significant. X2→PC→Y1 indirect effect=0.519, 95% CI [0.117, 0.968], significant.

- **Finding 5 — Perceived attention mediates gamification → cognitive engagement (not learning outcomes)**: SEM path: Competitive → PA: β=0.180, p=0.003; Cooperative → PA: β=0.191, p=0.003; PA → Cognitive Engagement: β=0.603, p<0.001; PA → Learning Outcomes: β=-0.010, p=0.871 (not significant). PROCESS: X1→PA→Y2 indirect=0.190, 95% CI [0.045, 0.362], significant; X2→PA→Y2 indirect=0.201, 95% CI [0.049, 0.376], significant.

- **Finding 6 — Prior Python knowledge (not gamification type) predicts learning outcomes**: Existing Python knowledge → Y1: β=0.629, p<0.001. Age was the only demographic control reaching significance for one outcome (β=-0.114, p=0.012). Gender, education level, occupation, and self-rated Python level did not significantly predict outcomes.

## Effect Sizes (Raw Values)

**ANOVA main effects (2×2 factorial):**
- Competitive → Perceived Challenge: F=6.83, p=0.010, η²=0.078
- Cooperative → Perceived Challenge: F=6.12, p=0.014, η²=0.035
- Competitive → Perceived Attention: F=6.52, p=0.011, η²=0.019
- Cooperative → Perceived Attention: F=7.19, p=0.008, η²=0.015
- Competitive → Learning Outcomes: F=15.48, p<0.001, η²=0.036
- Cooperative → Learning Outcomes: F=6.35, p=0.013, η²=0.032
- Competitive → Cognitive Engagement: F=2.90, p=0.030, η²=0.036
- Cooperative → Cognitive Engagement: F=1.98, p=0.164, η²=0.038 (ns)
- All interaction effects: p=0.25–0.50 (none significant)

**SEM path coefficients (SmartPLS 3.0 + PROCESS bootstrapping):**
- X1 (competitive) → PC: β=0.190, t=2.851, p=0.005
- X2 (cooperative) → PC: β=0.176, t=2.602, p=0.010
- X1 → PA: β=0.180, t=3.033, p=0.003
- X2 → PA: β=0.191, t=2.984, p=0.003
- PC → Y1 (learning outcomes): β=0.301, t=5.059, p<0.001
- PC → Y2 (cognitive engagement): β=0.085, t=1.273, p=0.203 (ns)
- PA → Y1: β=-0.010, t=0.162, p=0.871 (ns)
- PA → Y2: β=0.603, t=8.036, p<0.001
- Prior knowledge → Y1: β=0.629, t=12.767, p<0.001

**Raw score means (15-point knowledge test):**
- Platform A (control): M=8.13, SD=2.926
- Platform B (competitive): M=10.44, SD=3.424
- Platform C (cooperative): M=9.83, SD=3.058
- Platform D (both): M=11.09, SD=2.964

**Power:** Achieved power = 0.651 (f=0.25, α=0.05, n=205) — below 0.80 threshold.

## Mechanisms & Moderators

- **Mechanism — Perceived challenge pathway**: Competitive gamification (leaderboards, badges, PK battles) creates social comparison pressure → increases perceived challenge → drives effort and intrinsic motivation → improves knowledge test scores. Cooperative gamification (group study, progress reminders, community features) adds peer accountability → similarly increases perceived challenge → same outcome pathway.
- **Mechanism — Perceived attention pathway**: Both gamification types increase attentiveness through engagement and social pressure → sustained attention → higher cognitive effort/engagement. This pathway does NOT improve quiz scores.
- **Null finding — Challenge does not drive cognitive engagement**: Authors attribute this to curvilinear possibility: excessive perceived challenge may discourage rather than engage, breaking the H3b pathway.
- **Null finding — Attention does not drive learning outcomes**: Authors note attention in this experiment was partly directed at the experimental task itself, not exclusively the gamification content, potentially diluting the effect.
- **No interaction between competitive and cooperative**: Effects are additive and independent. Running both designs yields roughly the sum of individual effects, not a synergistic boost.
- **Individual differences not tested**: User characteristics (personality, prior motivation, competitiveness) were controlled demographically but not tested as moderators.

## Study Design Details

- **Platforms**: Four prototype platforms built for the study (not real-world platforms). Each used the same Python intro course content. Competitive layer: PK battles, completion badges, static leaderboard. Cooperative layer: group invitations, progress reminders, community support features. Static leaderboard was intentional to prevent confounding from unequal real-time feedback exposure.
- **Procedure**: Demographic survey → 15-item Python pre-test → 1–2 minute platform familiarization → 15 minutes free platform use → post-experiment questionnaire (perceived challenge, perceived attention, cognitive engagement) + identical 15-item post-test.
- **Measures**: Perceived challenge and perceived attention: 5-item scales adapted from Keller (ARCS model). Cognitive engagement: 2-item scale from Park. Cronbach's α: 0.847, 0.858, 0.744 respectively. AVE values all >0.5; Fornell-Larcker discriminant validity confirmed.
- **Manipulation check**: Recognition accuracy for gamification features exceeded 90% in all four groups (range 90.0%–100.0%), confirmed by ANOVA (p<0.001).
- **Analysis**: 2×2 factorial ANOVA in SPSS; SEM via SmartPLS 3.0 with bootstrapping; mediation via PROCESS macro (Model 4, Hayes 2022).
- **Recruitment**: Chinese online platforms (WeChat, Douban). Data collected July 2023.

## Limitations

- **Underpowered**: Achieved power = 0.651, below the 0.80 convention. Higher n needed, especially for smaller effects.
- **Artificial platform, short duration**: Prototype platforms with simplified gamification; 15-minute interaction is extremely brief. Real-world gamification unfolds over days/weeks; novelty effects are uncontrolled.
- **Chinese convenience sample**: Recruited via Chinese social media. 90%+ highly educated adults. Generalizability to other cultures, education levels, or age groups is unknown.
- **No longitudinal follow-up**: Learning outcomes measured immediately post-experiment. Retention effects are unknown.
- **Static leaderboard**: While controlled for confounds, a static leaderboard does not reflect actual competitive gamification in deployed products.
- **Attentional confound**: Attention was also captured by the experimental task itself (not purely gamification), which may explain why PA→Y1 was non-significant.
- **No personality/individual difference moderators**: Competitiveness, need for affiliation, and prior gaming experience were not measured and could substantially moderate effects.
- **No emotional or behavioral data**: Emotional engagement and behavioral tracking excluded by design; acknowledged as limiting the model's completeness.

## Population Scope Assessment

- **Population**: Mixed (enterprise employees + students, Chinese adults, highly educated)
- **Relevance to casual behavior change**: Medium — learning outcomes in a controlled 15-minute task with a novel coding subject. Limited direct application to habit-based behavior change or self-initiated long-term engagement.
- **Red flags**: None for scope exclusion. Relevant to digital platform gamification design but not to clinical or addiction populations.

## Conclusions

Both competitive and cooperative gamification designs increased perceived challenge and perceived attention in an online learning context, and both produced significantly higher knowledge test scores than the no-gamification control. However, the two flow mechanisms operate on different outcome types: perceived challenge predicts learning outcomes (knowledge gain), while perceived attention predicts cognitive engagement — and these pathways do not cross. The designs' effects are additive rather than synergistic; combining both yields the best scores (M=11.09 vs. control M=8.13 on a 15-point test), but the competitive design alone drove the strongest single-factor effect on learning outcomes (F=15.48, p<0.001).

---

## Extraction Notes

This is a small, short-exposure Chinese experiment (n=205, 15 minutes, prototype platforms). The core claim — that competitive and cooperative gamification both work, but through different flow mechanisms — is theoretically interesting but practically limited by artificial conditions and underpowered design. The clean pathway separation (challenge → outcomes; attention → engagement) is a useful design heuristic but has not been replicated. Prior Python knowledge dominated outcome prediction (β=0.629), dwarfing gamification effects, which should temper enthusiasm for the gamification findings. Useful for NotionRPG as a supporting citation for "competitive design drives learning gains" and "different gamification mechanics target different psychological outcomes," but should not be cited as high-confidence evidence.
