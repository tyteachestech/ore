---
title: "Effects of instructor-present videos on learning, cognitive load, motivation, and social presence: A meta-analysis"
authors: [Alemdağ, E.]
year: 2022
type: meta-analysis
population: mixed
sample_size: unknown
key_claims:
  - "Instructor presence had NO statistically significant effect on learning (k=20 experimental studies)"
  - "Instructor presence had NO statistically significant effect on social presence"
  - "Instructor presence INCREASED cognitive load: Hedges' g = 0.319 (based on 7 comparisons)"
  - "Instructor presence significantly increased motivation"
  - "Moderator: hand-only instructor videos and lab settings showed marginally significant advantages for knowledge acquisition"
doi: "10.1007/s10639-022-11154-w"
pmid: unknown
evidence_grade: emerging
scope_flag: include-with-caution
inflation_flag: none
source_type: "secondary (Consensus abstract + scite smart citations + LLM deep research)"
extraction_limitations: "Full text not acquired. Effect sizes for learning and motivation outcomes not available — only cognitive load g reported via scite smart citation. Confidence intervals not available. Heterogeneity stats not available. Moderator table not available."
conflict_note: "CONTESTED: 8 supporting, 5 contrasting, 45 mentioning (1.6:1 ratio). Directly conflicts with P003 Beege et al. (2023) which found instructor presence REDUCED extraneous cognitive load. Resolution: the Beege finding is from k=35 studies vs k=20 here, and likely reflects the instructor SIZE moderator — large instructor images increase load, small PIP format reduces it."
---

# Effects of instructor-present videos on learning, cognitive load, motivation, and social presence: A meta-analysis

## Study Overview

- **Citation**: Alemdağ, E. (2022). *Education and Information Technologies*.
- **Study Type**: Meta-analysis of experimental studies
- **Sample**: k=20 experimental studies; total N unknown; 7 comparisons for cognitive load analysis
- **DOI**: 10.1007/s10639-022-11154-w
- **PMID**: Unknown

> **NOTE — Secondary extraction.** Full text not acquired. Findings drawn from: (1) Consensus abstract, (2) scite smart citations from Heidig et al. 2024, and (3) two independent LLM deep research summaries. This paper is flagged CONTESTED (1.6:1 supporting/contrasting ratio) and directly conflicts with P003 Beege et al. (2023) on the cognitive load finding. See conflict note and Mechanisms section.

## Key Findings

- **Finding 1 — No learning effect**: The effect of instructor presence on knowledge acquisition (learning outcomes) was **not statistically significant** across the 20 experimental studies.
  - Effect size: not reported in available secondary sources; noted as non-significant
  - Sample: k=20 experimental comparisons

- **Finding 2 — No social presence effect**: Instructor presence did not significantly affect perceived social presence.
  - Effect size: not available

- **Finding 3 — Cognitive load increased**: Instructor-present videos produced a **significant increase in cognitive load**.
  - Effect size: Hedges' g = 0.319, based on 7 comparisons (source: Heidig et al. 2024 smart citation via scite)
  - Note: Alemdağ did not differentiate between types of cognitive load (intrinsic, extraneous, germane) — this is flagged as a limitation by Heidig et al. (2024)

- **Finding 4 — Motivation increased**: Instructor presence significantly increased learner motivation.
  - Effect size: not available from secondary sources; noted as statistically significant

- **Finding 5 — Moderator: human embodiment**: For knowledge acquisition, marginally significant differences emerged based on degree of human embodiment. Videos featuring **only the instructor's hand** (vs. full-body or face) showed advantages for knowledge acquisition.
  - Specific effect sizes not available

- **Finding 6 — Moderator: study setting**: Lab settings showed advantages over naturalistic settings for knowledge acquisition outcomes.
  - Specific effect sizes not available

## Effect Sizes (Raw Values)

- **Learning (knowledge acquisition)**: not statistically significant; specific g not available
- **Cognitive load**: g = 0.319 (7 comparisons) — this is the only confirmed effect size from secondary sources
  - 95% CI: not available
  - Note: undifferentiated cognitive load measure
- **Motivation**: statistically significant; specific g not available
- **Social presence**: not statistically significant; specific g not available

Publication bias assessment: not available from secondary sources.

## Mechanisms & Moderators

- **Proposed mechanism (cognitive load increase)**: Instructor's face may introduce extraneous processing demands — learners allocate attention to the social cue (face) in addition to the instructional content, increasing overall cognitive load without improving learning.
- **Proposed mechanism (motivation increase)**: Social presence cues from instructor visibility may enhance perceived relatedness and engagement, even when they do not benefit learning directly.
- **Moderator — human embodiment**: Hand-only instructor presence appears more effective than face or full body for knowledge acquisition, suggesting that visible instructor elements that are *instructionally relevant* (demonstrating, pointing) perform better than social presence cues alone.
- **Moderator — study setting**: Lab settings favor knowledge acquisition effects, likely due to reduced distractors and higher experimental control.

### The Beege Conflict

This paper's cognitive load finding (g = +0.319, load *increased*) directly conflicts with P003 Beege et al. (2023), which found instructor presence *reduced* extraneous cognitive load across k=35 studies.

**Most likely resolution** (supported by Beege moderator analysis): The Alemdağ sample likely includes studies where instructors are displayed at **large size or full-face format**, which does increase load. Beege found that **small picture-in-picture (PIP) format** reduced load, while large instructor images increased it. Alemdağ's sample (k=20, earlier literature) likely underrepresents PIP-format studies. The Beege meta-analysis is larger (k=35), more recent, and explicitly models the size/format moderator — making it the more reliable source for design guidance.

**Practical implication**: The conflict is resolved by instructor display format. Large face or full-body instructor images: load increases, no learning gain. Small PIP overlay: load reduces, retention benefit. This is a moderator story, not a contradiction.

> **MOOC context flag:** Most studies in this meta-analysis used academic lecture video content. Instructor presence in demonstration/tutorial-style tech content (where face competes with screen detail) may behave differently than instructor presence in lecture-style delivery.

## Study Design Details

- **Intervention**: Instructional videos with visible on-screen instructor (full face, body, or hand) vs. videos without instructor presence
- **Control/Comparison**: Same video content without instructor visualization
- **Follow-up period**: Unknown; immediate post-test likely dominant
- **Attrition**: Unknown
- **Blinding**: Unlikely in typical video experiment designs
- **Inclusion criteria**: Experimental studies only (contrast to observational designs in Kizilcec et al.)

## Limitations

- k=20 is a relatively small base for detecting moderator effects reliably
- Cognitive load was not differentiated by type (intrinsic vs. extraneous vs. germane) — the g = 0.319 increase could reflect either extraneous (bad) or germane (potentially useful) load
- High heterogeneity noted (acknowledged in LLM2)
- Studies predominantly use academic lecture content — limited applicability to procedural tech tutorial formats
- Moderator analyses (embodiment, setting) were "marginally significant" — small base limits confidence
- Does not differentiate small PIP format from large instructor display — this omission is the likely source of the Beege conflict
- Lab setting advantage limits ecological validity

## Population Scope Assessment

- **Population**: Mixed educational levels; predominantly higher-ed
- **Relevance to async YouTube tutorial context**: Medium — learning null finding is directly relevant; motivation increase is relevant; cognitive load finding requires format-specific interpretation (large face vs. PIP)
- **Red flags**: Lab-heavy sample; academic lecture content dominates; no YouTube/creator-economy studies

## Conclusions

Instructor presence in videos does not reliably improve learning or social presence, but does increase motivation and cognitive load. The cognitive load increase — not differentiated by type — is the most contested finding, likely explained by instructor display size and format (large images increase load; PIP reduces it). For tutorial creators, the takeaway is that instructor visibility is a *motivation and connection* lever, not a learning lever, and that display format mediates the load cost.

---

## Extraction Notes

This paper's scite citation profile (8 supporting, 5 contrasting, 1.6:1 ratio) is the most contested of the five papers in this batch. The Heidig et al. (2024) smart citation via scite is the only primary-source data point confirming the g = 0.319 cognitive load finding. The LLM sources confirm the non-significant learning and social presence findings and the significant motivation finding.

Priority recommendation: Before using cognitive load g = 0.319 in chapter text, flag the Beege conflict explicitly. The chapter-writer should present these as two evidence points informing the same question (instructor size/format matters), not as irreconcilable contradictions.

Do not cite in isolation from P003 Beege et al. (2023). These two papers must be read together.
