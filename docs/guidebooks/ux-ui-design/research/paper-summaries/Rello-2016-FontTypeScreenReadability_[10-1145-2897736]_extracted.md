---
title: "The Effect of Font Type on Screen Readability by People with Dyslexia"
authors: [Rello, L., Baeza-Yates, R.]
year: 2016
type: experimental
population: mixed
sample_size: 97
key_claims:
  - "Font type has a significant impact on on-screen readability for both people with and without dyslexia (p < 0.001)"
  - "Sans-serif fonts (Arial, Helvetica, Verdana) produced significantly shorter fixation durations than serif fonts for people with dyslexia"
  - "Italic fonts increased reading time by ~16% for non-dyslexic readers vs. roman counterparts (20.11s vs. 17.40s)"
  - "Monospaced Courier produced the shortest fixation durations of all 12 fonts tested for both groups"
  - "What is readable for people with dyslexia is also readable for people without dyslexia — findings generalize across both populations"
  - "OpenDyslexic font did not produce better objective readability than standard fonts and was significantly disliked by both groups"
  - "Arial Italic was the worst-performing font across most measures for both groups and should be avoided"
  - "Best all-around fonts: Helvetica, Courier, Arial, Verdana, CMU — combining readability and preference"
doi: "10.1145/2897736"
pmid: unknown
evidence_grade: foundational
scope_flag: include
inflation_flag: none
---

# The Effect of Font Type on Screen Readability by People with Dyslexia

## Study Overview
- **Citation**: Rello, L. & Baeza-Yates, R. (2016). ACM Transactions on Accessible Computing, 8(4), Article 15.
- **Study Type**: Controlled experiment with eye-tracking
- **Sample**: n=97 total; Group D: n=48 with clinically confirmed dyslexia (22F/26M, age 11-50, mean=20.96); Group N: n=49 without dyslexia (28F/21M, age 11-54, mean=29.20)
- **Design**: Mixed between-within subjects. Each participant read 12 texts in 12 different fonts, counterbalanced.
- **Fonts tested**: Arial, Arial Italic, Computer Modern Unicode (CMU), Courier, Garamond, Helvetica, Myriad, OpenDyslexic, OpenDyslexic Italic, Times, Times Italic, Verdana
- **Measures**: Reading Time (eye-tracking), Fixation Duration (eye-tracking), Number of Fixations (eye-tracking), Preference Rating (5-point Likert), Comprehension Score (control variable)
- **Equipment**: Tobii 1750 eye-tracker, 17-inch TFT, 1024x768, 14pt font size, black text on white, left-justified, max 70 characters/column
- **DOI**: 10.1145/2897736

## Key Findings

- **Font type affects readability for everyone**: Font type had a significant effect on Reading Time (χ²(11) = 13.99, p < 0.001), Fixation Duration (χ²(11) = 180.16, p < 0.001), and Number of Fixations (χ²(11) = 30.196, p = 0.001) across both groups.

- **People with dyslexia are slower across the board**: Group D mean reading time (24.94s, SD=12.15) was significantly longer than Group N (17.69s, SD=5.73, p < 0.001). Group D had longer fixation durations (mean 0.25s vs. 0.20s, p < 0.001) and more fixations (mean 97.07 vs. 34.47, p < 0.001).

- **Arial Italic is the worst font for both groups**: For Group D, Arial Italic produced significantly longer reading times than Arial (p=0.011), CMU (p=0.011), and Helvetica (p=0.034); significantly longer fixation durations than 8 other fonts (p < 0.001 to p=0.049). For Group N, Arial Italic produced significantly longer reading times than 6 other fonts, and longer fixation durations than 5 other fonts.

- **Italic fonts harm readability**: Roman (non-italic) fonts significantly outperformed italic fonts. For Group N, italic reading time mean (20.11s) was 16% longer than roman (17.40s, p = 0.001). For Group D, italic fixation durations were significantly longer (0.27s vs. 0.25s, p = 0.040). Both groups significantly preferred roman fonts over italic (Group D: 3.21 vs. 2.73, p = 0.002; Group N: 3.24 vs. 2.86, p = 0.018).

- **Sans-serif fonts produce shorter fixation durations for dyslexic readers**: For Group D, [−Serif] fonts produced shorter fixation durations (mean 0.24s) than [+Serif] fonts (0.26s, p = 0.015). Same direction for Group N (0.19s vs. 0.20s, p = 0.007). No significant effect on reading time. People with dyslexia significantly preferred sans-serif over serif (p < 0.001).

- **Monospaced Courier produced the shortest fixation durations**: Courier (monospaced) outperformed all proportional serif comparators on fixation duration — both Group D (0.22s vs. 0.26s, p < 0.001) and Group N (0.19s vs. 0.20s, p = 0.002). No significant effect on reading time.

- **OpenDyslexic showed no objective benefit and was disliked**: OpenDyslexic produced no significant improvement in reading time or fixation duration relative to standard sans-serif fonts. Both groups significantly preferred standard fonts over OpenDyslexic (Group D: 3.60 vs. 2.57, p < 0.001; Group N: 3.86 vs. 2.24, p < 0.001).

- **What's good for dyslexic readers is good for everyone**: The Spearman correlation between groups for Preference Rating was ρ = 0.912 (p < 0.001), and for Reading Time ρ = 0.657 (p = 0.024). Font rankings were consistent across both populations.

## Effect Sizes (Raw Values)

No Cohen's d or SMD reported. All statistical results are nonparametric (Friedman + Wilcoxon with Bonferroni correction). Key quantitative comparisons:

**Reading Time (seconds, mean ± SD):**

| Font | Group D | Group N |
|------|---------|---------|
| Arial (fastest D) | 11.83 ± 4.32 | 28.35 ± 12.39 |
| Helvetica | 13.03 ± 4.29 | 31.05 ± 15.04 |
| Courier | 13.75 ± 5.50 | 29.61 ± 10.87 |
| CMU | 12.41 ± 4.17 | 29.58 ± 12.05 |
| Verdana | 15.69 ± 7.88 | 31.16 ± 13.03 |
| Arial Italic (worst) | 17.24 ± 7.53 | 34.99 ± 16.60 |

Note: Group D read ~41% slower overall than Group N (24.94s vs. 17.69s).

**Fixation Duration (seconds, mean):**

| Font | Group D | Group N |
|------|---------|---------|
| Courier (shortest both) | 0.22 ± 0.05 | 0.19 ± 0.03 |
| Verdana | 0.23 ± 0.07 | 0.19 ± 0.03 |
| Arial | 0.24 ± 0.07 | 0.19 ± 0.03 |
| Arial Italic (longest) | 0.28 ± 0.08 | 0.21 ± 0.04 |

**Font Style Comparisons (mean reading time):**

- [−Italic] vs [+Italic], Group N: 17.40s vs. 20.11s (+16%, p=0.001)
- [−Serif] vs [+Serif] fixation duration, Group D: 0.24s vs. 0.26s (p=0.015)
- [+Monospace] vs [−Monospace] fixation duration, Group D: 0.22s vs. 0.26s (p < 0.001)

**Preference Ratings (1-5 scale):**

- Group D top: Verdana (3.79), Helvetica (3.62), Arial (3.60)
- Group D bottom: OpenDyslexic Italic (2.43), OpenDyslexic (2.57), Garamond (2.57)
- Group N top: Verdana (3.97), Arial (3.97), CMU (3.84)
- Group N bottom: OpenDyslexic Italic (2.03), OpenDyslexic (2.24)

**Preference-Readability correlation:**

- Group D: Reading Time vs. Preference Rating, ρ = −0.998 (p < 0.001) — near-perfect inverse relationship
- Group N: ρ = −0.767 (p = 0.004) — strong inverse relationship

## Mechanisms & Moderators

- **Fixation duration as cognitive load proxy**: Shorter fixation durations indicate less processing effort. Monospaced and sans-serif fonts reduced fixation duration, suggesting character discrimination is easier — consistent with "equal spacing = easier letter identification" theory.

- **Italic = cursive difficulty**: Italic fonts map to cursive letterforms, which are harder for all readers but especially for people with dyslexia due to phonological processing difficulties. Effect was stronger on fixation duration for Group D and on reading time for Group N.

- **Preference ≠ performance (partially)**: For non-dyslexic readers, Verdana had the highest preference ratings but also had longer reading times than Arial, CMU, and Helvetica. Participants prefer what looks pleasant, not necessarily what they process fastest.

- **OpenDyslexic: expectation vs. reality**: Despite being purpose-designed for dyslexia (weighted bottoms, no mirror-image letter pairs), the font provided no objective benefit. Authors speculate it may help with read-aloud errors but not screen reading speed.

- **Age difference moderator**: Group D was ~8 years younger on average (20.96 vs. 29.20). Authors argue limited impact since reading acquisition is complete by age 9, and youngest participant was 11.

- **Font generalizability**: Findings apply specifically to on-screen reading at 14pt, black-on-white, ~70 chars/column. Interactions with font size not tested.

## Study Design Details

- **Intervention**: Each participant read 12 comparable texts (60 words each, same complexity, same genre) in 12 different fonts. Font-text combinations counterbalanced.
- **Control**: Comprehension question after each text; texts with wrong answers excluded (10/1164 data points removed, 0.9% attrition).
- **Blinding**: Not described; single interviewer (first author) present for all sessions.
- **Setting**: Lab sessions ~20 minutes at Universitat Pompeu Fabra, Barcelona. Controlled lighting, fixed seating distance (60cm), individual eye-tracker calibration.
- **Statistical approach**: Non-parametric (Friedman + Wilcoxon with Bonferroni correction) due to non-normal, non-homogeneous data. Conservative approach.

## Limitations

- **Age confound**: Group D was ~8 years younger on average. Although authors argue minimal impact, the groups are not age-matched, which limits clean between-group comparisons.
- **Spanish-speaking population only**: All participants in Barcelona. Findings may not generalize to other languages with different orthographies.
- **Non-factorial design**: No monospaced sans-serif font tested; font characteristics are entangled (Courier is monospaced AND serif). Cannot isolate single typographic variables cleanly.
- **Short texts**: 60-word passages. Effects may differ for longer reading sessions with real-world content.
- **Font size fixed at 14pt**: Different fonts render at different visual sizes at the same point size; some observed effects may be partly due to effective character size, not typeface per se.
- **Comprehension measurement weak**: Only literal recall questions with no prior validation; comprehension not measured as an outcome.
- **No follow-up**: Single-session lab study, no ecological validity data on real-world use.
- **OpenDyslexic only one dyslexia-specific font**: Results on purpose-built fonts cannot be generalized to Dyslexie, Sylexiad, or other specialized options.

## Population Scope Assessment

- **Population**: Mixed — clinically diagnosed dyslexic (n=48) and non-dyslexic controls (n=49). Age range 11-54; primarily Spanish students.
- **Relevance to app design for non-designers**: High. The core finding — that font type selection measurably affects all users, and that sans-serif, roman, non-monospaced fonts like Helvetica and Arial are broadly optimal — directly supports UI text decisions in Apple app development.
- **Red flags**: Clinical population (dyslexia diagnosis required for Group D). However, the key guidebook-relevant finding is that **recommendations generalize to non-dyslexic users** — explicitly stated by authors.
- **Scope for this guidebook**: Strong relevance. Apple's SF Pro is a humanist sans-serif roman face, consistent with this study's top-performing font category.

## Conclusions

"Font types have an impact on readability for people with and without dyslexia." The best on-screen fonts combining objective performance and subjective preference were Helvetica, Courier, Arial, Verdana, and CMU. Sans-serif, roman (non-italic), and monospaced styles improved readability, while italic fonts — particularly Arial Italic — consistently harmed it. OpenDyslexic, despite its intended purpose, showed no performance advantage and was widely disliked. The findings generalize across dyslexic and non-dyslexic populations, making them applicable to general UI typography decisions.

## Named Frameworks (if applicable)

None explicitly named beyond standard typographic classification (serif/sans-serif, roman/italic, monospaced/proportional).

---

## Extraction Notes

This is a strong, directly applicable study for the UX/UI guidebook. Key takeaways for practical design guidance:

1. **Avoid italic body text** — measurable harm for both groups, especially Arial Italic.
2. **Helvetica and Arial are the most empirically validated on-screen fonts** — consistent with Apple's choice of Helvetica Neue → San Francisco (SF Pro) as the system font.
3. **Sans-serif advantage is real but modest** — significant on fixation duration, not reading time. The practical recommendation stands, but should be stated with appropriate caveats.
4. **OpenDyslexic myth-busting**: A useful counter-intuitive finding — purpose-built "accessibility" fonts are not always better.
5. **Monospaced fonts are objectively better for fixation duration** but less preferred — relevant caveat for code display vs. prose.

The near-perfect correlation (ρ = −0.998) between reading time and preference ratings in dyslexic readers is a striking methodological note: the fonts people with dyslexia like most are precisely the ones they read fastest, suggesting strong intrinsic validity in their self-reported preferences.

One caution: all testing was in Spanish, 14pt only, short passages. The magnitude of effects should not be over-specified for app design contexts with different font sizes, longer text, or English orthography.
