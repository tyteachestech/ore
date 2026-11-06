---
title: "The effectiveness of enhanced interaction features in educational videos: a meta-analysis"
authors: [Ploetzner, R.]
year: 2022
type: meta-analysis
population: mixed
sample_size: unknown
key_claims:
  - "Enhanced interaction features (embedded questions, quizzes, self-explanation prompts) produce g = 0.354 advantage over passive video (LLM1) or g = 0.522 (LLM2) — likely reflects different inclusion criteria between sources; see extraction notes"
  - "Self-explanation prompts were among the most effective interactive features"
  - "Navigation features alone (pause, rewind) are insufficient — active processing prompts are necessary to break passive viewing patterns"
  - "If a video is NOT paused while an enhanced interaction element appears, learning can be impeded via split attention"
  - "17 studies, 22 effect sizes included in the meta-analysis"
doi: "10.1080/10494820.2022.2123002"
pmid: unknown
evidence_grade: emerging
scope_flag: include
inflation_flag: none
source_type: "secondary (LLM deep research synthesis + scite citations)"
extraction_limitations: "Full text not acquired. Effect size discrepancy between two LLM summaries (g = 0.354 vs g = 0.522) could not be resolved without the paper. No CI data available. Moderator breakdown not confirmed. Heterogeneity stats (I^2, tau^2) not available."
---

# The effectiveness of enhanced interaction features in educational videos: a meta-analysis

## Study Overview

- **Citation**: Ploetzner, R. (2022). *Interactive Learning Environments*, 32(5), 1597–1612.
- **Study Type**: Meta-analysis
- **Sample**: k=17 studies, 22 effect sizes; total N unknown
- **DOI**: 10.1080/10494820.2022.2123002
- **PMID**: Unknown

> **NOTE — Secondary extraction.** Full text was not acquired. All findings are derived from LLM deep research syntheses (two independent LLM responses) and scite citation counts. Claims should be treated as plausible but unverified at the primary-source level.

## Key Findings

- **Finding 1 — Overall effect of enhanced interaction**: Videos with enhanced interaction features (embedded questions, quizzes, self-explanation prompts) outperformed passive video or navigation-only controls. Effect size reported as g = 0.354 in one LLM source ("small-to-medium") and g = 0.522 in a second independent LLM source ("overall Hedges' g"). The discrepancy likely reflects whether the LLM pulled the primary analysis or a specific subgroup. Cannot resolve without full text.
  - Effect size: Hedges' g = 0.354 (LLM1) or 0.522 (LLM2); 95% CI not available
  - k = 17 studies; 22 effect sizes

- **Finding 2 — Self-explanation prompts**: Self-explanation prompts were identified as particularly effective among the interaction feature types tested.
  - No separate effect size reported in available sources

- **Finding 3 — Navigation features insufficient**: Navigation features (pause, rewind, playback speed) alone do not produce learning benefits equivalent to instructionally meaningful interaction. Active processing prompts — not playback controls — break passive viewing patterns.

- **Finding 4 — Split attention hazard**: If a video continues playing (is not paused) while an interactive element is displayed, split attention can impede learning. Pause logic is a critical implementation detail, not a cosmetic one.

- **Finding 5 — Small/underpowered study base**: Author acknowledges many included studies were underpowered. LLM commentary suggests the effect size "likely underestimates the benefit of well-designed interactive elements" due to implementation heterogeneity.

## Effect Sizes (Raw Values)

- **Overall enhanced interaction vs passive/navigation-only**: g = 0.354 (LLM1) or g = 0.522 (LLM2)
  - k = 17 studies, 22 effect sizes
  - 95% CI: not available from secondary sources
  - Heterogeneity (I^2, tau^2): not available
- **Self-explanation prompts**: specific effect size not available
- **Navigation features only**: compared unfavorably — no specific value

Note: The two LLM sources (llm1.md and llm2.md) reported different overall g values. The registry entry (priority 8.5, Core) and LLM1 cross-reference context ("g = 0.354") appear in the more detailed analytical LLM, while LLM2's "g = 0.522" appears in a briefer category listing. Without the full paper, use g = 0.354 as the more conservative and more frequently cited value pending confirmation.

## Mechanisms & Moderators

- **Active processing mechanism**: Enhanced interaction features work by triggering active cognitive processing — retrieving, generating, or explaining — rather than passive intake. This is retrieval practice and generative learning applied within video.
- **Moderator — feature type**: Self-explanation prompts appear more effective than simple quiz questions, though subgroup breakdown not fully available.
- **Moderator — pause implementation**: Whether the video pauses during interaction is a critical design variable. Non-paused interaction creates competing processing demands (split attention).
- **Moderator — instructional meaningfulness**: The "enhanced" vs "navigational" distinction is key — only features requiring cognitive effort produce the benefit.

## Study Design Details

- **Intervention**: Instructional videos with embedded interactive features (quizzes, self-explanation prompts, pause-and-respond activities) compared to passive video or navigation-only controls
- **Control/Comparison**: Passive video viewing or videos with navigational controls only (pause, rewind)
- **Follow-up period**: Unknown — likely immediate post-test dominant given study base
- **Attrition**: Unknown
- **Blinding**: Unlikely — quasi-experimental designs typical in video studies
- **Inclusion criteria**: Unknown — possibly limited to studies published before 2022

## Limitations

- Only 17 studies included — relatively small meta-analytic base; statistical power to detect moderators is limited
- Many included studies were underpowered individually, per author's own acknowledgment
- Interactive features varied substantially across studies (question type, placement, feedback type) making the "enhanced interaction" category heterogeneous
- Implementation details (pause logic, feedback quality, question placement timing) likely drove large variance but could not be modeled
- Effect size likely reflects floor of the true benefit — poorly implemented interactive features dilute the estimate
- No information available on publication bias assessment
- MOOC/higher-ed context flag warranted — most included studies were likely from educational technology lab contexts, not YouTube or self-directed creator content

> **MOOC context flag:** The studies underlying this meta-analysis likely use formal educational video platforms (lectures, courses) rather than YouTube tutorials. Transfer to informal creator-economy instruction is plausible — the cognitive mechanism (active processing) is domain-general — but not directly established.

## Population Scope Assessment

- **Population**: Mixed (various educational levels, likely dominated by higher-ed)
- **Relevance to async tutorial context**: High — the mechanism (active processing via embedded prompts) is directly applicable to any async video learning context
- **Red flags**: None for this domain

## Conclusions

Enhanced interaction features — specifically prompts requiring active cognitive work (questions, self-explanation) rather than mere playback controls — produce a meaningful positive effect on learning from video. The benefit is real but implementation-sensitive: pausing the video during interaction and providing meaningful feedback appear to be essential design conditions. Navigation features alone do not replicate this benefit.

## Named Frameworks (if applicable)

- **Generative Learning Theory** (Wittrock): interaction features work by triggering generative processing — learners must construct meaning, not just receive it
- **Cognitive Theory of Multimedia Learning** (Mayer): active processing conditions override passive encoding, consistent with CTML's active processing assumption
- **Retrieval Practice**: embedded quiz questions are retrieval practice applied within video — mechanism is established independently

---

## Extraction Notes

Two independent LLM deep research responses assigned different overall g values to this paper: LLM1 gives g = 0.354 explicitly, while LLM2 gives g = 0.522. Both identify k = 17 studies / 22 effect sizes. This discrepancy needs resolution against the full text before citing in chapters.

The paper is listed in the registry as Priority 8.5, Core — the highest-priority paper among the five in this batch. Given that it is the only meta-analysis specifically focused on interactive video features (as opposed to instructor presence or general multimedia), it deserves acquisition for full extraction before the video design chapter is written.

Cross-reference with: LLM1.md line 113, LLM2.md lines 113–115, and registry cross-reference at LLM1.md line 207 ("interactive video features amplify this effect [Ploetzner, 2024, g = 0.354]").
