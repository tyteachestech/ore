---
title: "The Effects of Line Length on Reading Performance of Online News Articles"
authors: [Shaikh, A.D., Chaparro, B.S.]
year: 2005
type: experimental
population: student
sample_size: 20
key_claims:
  - "95 cpl produced the fastest reading speed (178.82 wpm) vs. 167-169 wpm for 35, 55, 75 cpl — a 6% speed advantage"
  - "No significant effect of line length on overall comprehension across 35, 55, 75, or 95 cpl"
  - "Overall satisfaction not affected by line length, but preference polarized: 60% chose an extreme (35 or 95 cpl) as favorite; 100% chose an extreme as least favorite"
  - "Structure questions (recalling order of details) were significantly harder than title, main idea, and factual questions regardless of line length"
  - "35 cpl was perceived as faster by some users but actually produced the slowest reading speed"
doi: "10.1177/154193120504900514"
pmid: ""
evidence_grade: emerging
scope_flag: include-with-caution
inflation_flag: none
---

# The Effects of Line Length on Reading Performance of Online News Articles

## Study Overview
- **Citation**: Shaikh, A.D. & Chaparro, B.S., 2005
- **Study Type**: Experimental (within-subjects)
- **Sample**: n=20, college students, Midwestern US university; $25 compensation; daily internet users with normal vision
- **Venue**: Proceedings of the Human Factors and Ergonomics Society 49th Annual Meeting
- **DOI**: 10.1177/154193120504900514

## Key Findings

- **Reading speed**: 95 cpl produced significantly faster reading (178.82 wpm) than all other conditions: 35 cpl (167.21 wpm), 55 cpl (167.38 wpm), 75 cpl (169.44 wpm)
  - Effect size: eta² = .15, F(3, 57) = 3.45, p = .02
  - The speed advantage of 95 cpl over the slowest condition (35 cpl) is approximately 6.9%

- **Reading efficiency** (speed x comprehension): Marginally significant effect, F(3, 57) = 2.68, p = .06, eta² = .12. Significant difference only between 35 cpl and 95 cpl; 95 cpl more efficient.

- **Overall comprehension**: No significant main effect of line length on total comprehension score. Line length did not meaningfully affect how much readers understood.

- **Comprehension by question type**: Significant main effect of question type, adjusted F(3.98, 75.69) = 10.193, p = .001, eta² = .35. Structure questions (recalling order of details) were significantly harder than title, main idea, and factual questions at ALL line lengths.

- **Satisfaction**: No main effect of line length on overall satisfaction (11-item 7-point Likert scale covering layout, perceived eyestrain, fatigue).

- **Preference paradox**: 60% chose either 35 cpl (30%) or 95 cpl (30%) as their favorite. 100% chose either 35 cpl (45%) or 95 cpl (55%) as their least favorite. The two extremes split opinion completely -- no consensus for or against either moderate length.

- **Misperception**: Participants who preferred 35 cpl believed it felt faster, but it produced the slowest measured reading speed.

## Effect Sizes (Raw Values)

- **Reading speed (line length effect)**: eta² = .15, F(3, 57) = 3.45, p = .02
  - 35 cpl: M = 167.21 wpm, SD = 33.66
  - 55 cpl: M = 167.38 wpm, SD = 33.96
  - 75 cpl: M = 169.44 wpm, SD = 33.48
  - 95 cpl: M = 178.82 wpm, SD = 41.83
- **Reading efficiency (line length effect)**: eta² = .12, F(3, 57) = 2.68, p = .06 (marginal)
- **Comprehension by question type**: eta² = .35, adjusted F(3.98, 75.69) = 10.193, p = .001 (large effect)
- **Overall comprehension (line length effect)**: Not significant, no effect size reported

## Mechanisms & Moderators

- **Eye movement hypothesis**: Participants who preferred short lines cited less eye movement. The authors suggest familiarity with columnar news formats (both online and print) may explain this preference.
- **Mental model integration**: Structure question difficulty attributed to news reading behavior -- readers integrate new information into existing mental models rather than tracking sequential order, making structural recall harder regardless of line length.
- **Perceived vs. actual speed**: Users' subjective sense of reading speed was inversely correlated with actual speed at the extremes -- a notable metacognitive gap relevant to user-controlled settings.
- **No moderators explicitly tested** (individual differences such as reading ability and online experience flagged as future work).

## Study Design Details

- **Intervention**: Participants read 8 news articles (~375 words each, grade 12 reading level) presented at 35, 55, 75, or 95 cpl in counterbalanced within-subjects order
- **Materials**: Articles from MSN/Yahoo News converted to HTML; Arial 10pt, 12pt line spacing, left-aligned, black on white, center-positioned; paging (no scroll)
- **Display**: Dell Pentium IV laptop, ClearType enabled, 1280x1024 at 60 Hz, 120 dpi; participants seated ~52 cm from screen
- **Comprehension measure**: 19 questions per article across 6 types (title, main idea, structure, main factual, incidental, recognition)
- **Satisfaction measure**: Reading Satisfaction Evaluation, 11 items, 7-point Likert; plus Post-Experiment layout preference questionnaire
- **Reading time**: Measured by stopwatch and converted to wpm

## Limitations

- **Very small sample**: n=20 is underpowered for within-subjects comparisons; results should be treated as directional only
- **Narrow population**: College students only; findings may not generalize to older adults, casual readers, or professional contexts
- **Single content type**: News articles only (~375 words each at grade 12 level); does not generalize to long-form content, UI copy, documentation, or app interfaces
- **2005 technology**: CRT-era display (though ClearType enabled); modern retina/HiDPI screens may alter findings, particularly at longer line lengths
- **Comprehension ceiling**: News comprehension tasks may not capture all relevant reading outcomes; structure questions may be artificially depressed for genre-specific reasons
- **No scrolling**: Paged navigation removes real-world scrolling behavior, which interacts with line length
- **Satisfaction vs. preference confusion**: Stated preference (extreme lengths) did not match satisfaction scores (no differences) -- the distinction is not fully explained

## Population Scope Assessment

- **Population**: College students (Midwestern US, 2005)
- **Relevance to app/UI design for non-designers**: Medium. Core finding (line length affects speed but not comprehension) is broadly applicable. Specific cpl thresholds are relevant for reading-heavy UI surfaces (article views, onboarding text, help docs). Less applicable to short UI labels, navigation, or form fields.
- **Red flags**: Small n, student sample, news-only content, dated display technology

## Conclusions

95 cpl produced faster reading than shorter line lengths, but was simultaneously the most-disliked format by a majority of participants. No line length significantly affected overall comprehension. The authors note: "Formatting news articles in 55 or 75 cpl does not result in a reading speed or personal preference advantage." The tension between measured performance (95 cpl fastest) and stated preference (split between extremes) makes clean design recommendations difficult from this study alone.

## Named Frameworks (if applicable)

None.

---

## Extraction Notes

This is a small, dated conference paper (n=20, 2005 hardware). Its value to the guidebook is primarily as one data point in a mixed literature on line length -- not a standalone authority. The key tension it surfaces is actionable: **objective reading speed and subjective preference can conflict**, which is a useful design teaching moment.

The "50-75 cpl optimal" framing cited in the registry is not directly supported by this paper's results -- 95 cpl was faster here, and 55/75 cpl showed no advantage over either extreme. That framing appears to synthesize multiple studies (especially Dyson & Haselgrove 2001, which found 55 cpl superior). Writers should use this paper alongside that prior work, not in isolation.

The metacognitive finding -- that users at 35 cpl felt they were reading faster but actually read slowest -- is a high-value anecdote for a design guidebook discussing the gap between user perception and behavior.
