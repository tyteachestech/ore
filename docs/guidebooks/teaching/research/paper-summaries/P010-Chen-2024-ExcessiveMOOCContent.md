---
title: "The more the better? How excessive content and online interaction hinder the learning effectiveness of high-quality MOOCs"
authors: [Chen, Z., Liu, M., Zhou, R.]
year: 2024
type: cross-sectional
population: mixed
sample_size: 8602
key_claims:
  - "Content richness has a curvilinear (inverted-U) relationship with MOOC effectiveness — more content increases dropout and decreases pass rates beyond a threshold"
  - "Excessive content in high-quality courses INCREASES dropout rates"
  - "Frequent online interaction DECREASES pass rates in high-quality courses"
  - "Content richness MODERATES the quality-to-effectiveness relationship"
  - "Course quality, content richness, and interactivity all significantly influence dropout and pass rates"
doi: "10.1111/bjet.13539"
pmid: unknown
evidence_grade: emerging
scope_flag: include
inflation_flag: none
source_type: "secondary (LLM deep research synthesis + abstract details from registry prompt)"
extraction_limitations: "Full text was listed as hybrid OA (PDF available) but was not acquired for this extraction. Specific regression coefficients, effect sizes, and confidence intervals not available. The curvilinear threshold value (at what volume does content become excessive?) not confirmed from secondary sources."
---

# The more the better? How excessive content and online interaction hinder the learning effectiveness of high-quality MOOCs

## Study Overview

- **Citation**: Chen, Z., Liu, M., & Zhou, R. (2024). *British Journal of Educational Technology*, 56(4), 1640–1670.
- **Study Type**: Large-scale observational/correlational study (regression analysis)
- **Sample**: N = 8,602 courses on Zhihuishu (major Chinese MOOC platform)
- **DOI**: 10.1111/bjet.13539
- **PMID**: Unknown

> **NOTE — Secondary extraction.** Full text was listed as hybrid OA but was not acquired. All findings are drawn from: (1) the detailed LLM1 deep research summary and (2) the abstract/description provided in the registry task prompt. The paper has 0/0/0 scite tallies (1 citing publication only) — very new.

> **MOOC context flag:** This study is from a Chinese MOOC platform (Zhihuishu). Learner demographics, course completion incentives, and platform norms differ from Coursera/edX contexts and from YouTube tutorials. The directional findings (less is more; excessive interaction harms) are likely to generalize, but the specific thresholds will not transfer directly.

## Key Findings

- **Finding 1 — Curvilinear content-effectiveness relationship**: Content richness does not linearly improve MOOC effectiveness. More content increases dropout rates and decreases pass rates. This relationship was particularly pronounced for high-quality courses — learners enrolled in a good course still drop out if that course is overloaded.
  - Effect size/coefficient: not available from secondary sources
  - Operationalization: "content richness" = number of videos (acknowledged as a coarse measure)

- **Finding 2 — Content richness as moderator**: Content richness moderates the quality-to-effectiveness relationship. A high-quality course with excessive content is *less* effective than a moderate-quality course with appropriately scoped content. Quality does not protect against content overload.

- **Finding 3 — Online interaction backfire**: Frequent online interaction (discussion board participation, peer interaction features) significantly decreased pass rates in high-quality courses. More interaction is not better — it may compete with or replace direct engagement with the course material.
  - Effect size: not available; noted as statistically significant
  - Framework cited: attention allocation theory — interaction may drain attentional resources from core learning

- **Finding 4 — Course quality baseline matters**: Course quality, content richness, and interactivity all independently influence dropout rates and pass rates. Quality alone is insufficient — design choices about volume and interaction compound or undercut quality.

## Effect Sizes (Raw Values)

Specific regression coefficients, beta weights, and R^2 values were not available from the secondary sources used for this extraction. The LLM1 description identifies the relationships as statistically significant but does not report specific numbers.

- **Content richness → dropout**: curvilinear (inverted-U), significant; coefficient not available
- **Content richness → pass rate**: curvilinear, significant; coefficient not available
- **Frequent interaction → pass rate**: negative, significant; coefficient not available
- **Course quality → effectiveness**: positive, moderated by content richness

> If acquiring the full text: check the regression tables for the moderation interaction term (quality × content richness) and the specific inflection point in the content richness curve.

## Mechanisms & Moderators

- **Theoretical framework — Attention allocation theory**: Learners have finite attentional capacity. Excessive content (more videos) demands more navigation, decision-making, and processing time without proportionate learning benefit. Frequent discussion/interaction similarly competes for attentional resources that would otherwise go toward content engagement.
- **Why high-quality courses are especially vulnerable**: Learners enrolling in high-quality courses may have higher expectations and lower tolerance for inefficiency. When quality courses are overloaded, the gap between expectation and experience (cognitive cost) may increase dropout.
- **Interaction backfire mechanism**: Online interaction in MOOCs is often low-quality (social coordination, logistical posts) and may distract from learning engagement rather than supporting it. This is consistent with research showing that interaction effects depend heavily on interaction *type* and *quality*, not quantity.
- **Moderator — quality × content richness interaction**: The negative effect of excessive content is significantly larger for high-quality courses. Low-quality courses may have different attrition dynamics (learners drop out for other reasons regardless of content volume).

## Study Design Details

- **Study design**: Observational regression analysis of platform data — NOT experimental; cannot establish causal direction definitively
- **Data source**: Zhihuishu MOOC platform (China); 8,602 courses
- **Primary outcomes**: Dropout rate, pass rate
- **Primary predictors**: Course quality rating, content richness (operationalized as number of videos), online interaction frequency
- **Analysis**: Regression with moderation testing (quality × content richness interaction)
- **Period**: Not specified in secondary sources

## Limitations

- **Chinese platform only**: Zhihuishu learner demographics, completion incentives (certificates, academic credit), and cultural norms around online learning differ substantially from Western platforms and from YouTube tutorials
- **Observational design**: Confounders not fully controlled. Course creators who make longer courses may also make lower-quality individual videos. The content richness → dropout relationship may partly reflect quality-per-unit rather than total volume per se.
- **"Content richness" operationalization**: Number of videos is a crude proxy. A course with 50 x 5-minute focused videos may behave differently than one with 50 x 20-minute rambling lectures — both score identically on "content richness" by this measure.
- **No learning outcome measurement**: Pass rate and dropout are behavioral proxies for learning effectiveness, not direct measures of learning or skill retention
- **Only 1 citing publication at time of extraction**: No adversarial scrutiny yet; findings have not been independently replicated

## Population Scope Assessment

- **Population**: MOOC learners (Chinese platform, mixed age and background)
- **Relevance to Tyler's context**: Medium — the "less is more" finding is directionally relevant to YouTube tutorial design (video length, information density). The interaction backfire finding is less directly applicable (YouTube comments are optional, not integrated into learning flow).
- **Red flags**: Platform specificity (Zhihuishu not generalizable directly); behavioral outcome proxies only

## Conclusions

More content in a high-quality MOOC does not help and actively harms completion and pass rates. Frequent online interaction similarly decreases effectiveness. The key design implication: ruthlessly consolidate content, resist the "completeness instinct" that leads creators to add more videos to be thorough, and recognize that adding interaction features does not substitute for focused, appropriately scoped content. Quality and scope are both necessary — quality does not compensate for overload.

---

## Extraction Notes

This is the only paper in the guidebook's source set directly addressing the question "how much content is too much?" That alone makes it valuable even though it is observational and platform-specific. The LLM1 summary identified it as "Emerging — large-scale analytics, moderate-high confidence" — that characterization seems appropriate.

The full text is listed as hybrid OA (PDF available). Acquiring it would allow extraction of the actual regression coefficients and the inflection point in the content richness curve — both would be useful for the curriculum sequencing chapter. Recommend acquisition before that chapter is written.

The "attention allocation theory" framework cited in this paper aligns with cognitive load theory and could be cross-referenced with Clark & Mayer's segmenting principle (Tier 1 book, B011).
