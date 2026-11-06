# The Distributed Practice Effect on Classroom Learning: A Meta-Analytic Review of Applied Research

## Study Overview
- **Citation**: Mawson, R.D., & Kang, S.H.K., 2025
- **Study Type**: Systematic Review + Meta-analysis (PRISMA-guided; k=22 studies, 31 effect sizes, N>3000)
- **Sample**: k=22 classroom-based studies; N>3,000 students across primary, secondary, and university levels
- **DOI**: 10.3390/bs15060771
- **PMID**: Not reported

## Key Findings

- **Finding 1 — Moderate overall effect of distributed over massed practice**: Distributed practice produced significantly better classroom learning than massed practice (d = 0.54, 95% CI [0.31, 0.77], z = 4.631, p < 0.001). This is a more conservative estimate than prior meta-analyses (e.g., Donoghue & Hattie, 2021: d = 0.85), likely because those included laboratory studies.

- **Finding 2 — High heterogeneity**: I² = 92.13% (Q(30) = 230.33, p < 0.001), indicating that over 92% of variance between studies is due to systematic differences rather than sampling error. The effect is real but highly variable across contexts.

- **Finding 3 — Retention interval trend**: Studies with longer retention intervals showed larger effect sizes. However, the included studies were limited to ≤42 days retention intervals, leaving long-term effects unstudied.

- **Finding 4 — Interstudy interval trend**: A 7-day interstudy interval produced the most consistently significant and moderate-to-large effects. Expanding (increasingly long) intervals tended to show smaller or inconsistent effects.

- **Finding 5 — Education level trend**: Secondary school studies showed more consistently positive and significant effects than primary school studies. Primary school studies had the highest proportion of non-significant and negative effect sizes (favoring massed over distributed practice).

- **Finding 6 — Fewer re-exposures trend ("less is more")**: Studies with 3 or fewer exposures after initial learning were associated with stronger effects. Studies with more than 3 re-exposures showed smaller, less consistent effects — possibly due to fatigue.

- **Finding 7 — Learning domain not a significant moderator**: Meta-regression with "Learning Domain" as moderator was non-significant (Q(8) = 7.56, p = 0.478); effect sizes overlapped across domains. Residual heterogeneity remained high (I² = 92.84%).

## Effect Sizes (Raw Values)

**Main analysis (Analysis 1 — most complete; k=22, 31 effect sizes):**
- Overall d = 0.54, 95% CI [0.31, 0.77], I² = 92.13%

**Sensitivity analyses:**
- Analysis 2 (non-independent effects averaged): d = 0.63, 95% CI [0.36, 0.89], I² = 94.93%, k=22, 25 ES
- Analysis 3 (unequal retention intervals excluded): d = 0.51, 95% CI [0.31, 0.72], I² = 83.88%, k=16, 23 ES
- Analysis 4 (both exclusions): d = 0.57, 95% CI [0.36, 0.78], I² = 84.68%, k=16, 19 ES

**Learning domain effect sizes (qualitative, from meta-regression):**
- Accounting: d = 0.67 [0.18, 1.16]
- Critical Thinking: d = 0.41 [0.00, 0.82]
- History: d = 0.22 [0.00, 0.44]
- Language: d = 0.91 [0.44, 1.30]
- Math: d = 0.46 [0.09, 0.84]
- Reading: d = −0.11 [−0.42, 0.21]
- Science: d = 0.75 [−0.21, 1.71]
- Spelling: d = 0.63 [0.03, 1.24]
- Teacher Education: d = 1.80 [1.15, 2.44]

**Publication bias**: Egger's test significant (z = 2.719, p = 0.007), indicating funnel plot asymmetry. Authors attribute this to "small study bias" rather than publication bias (many non-significant studies were visible in contour-enhanced funnel plot).

## Mechanisms & Moderators

- **Mechanism — Study-phase retrieval**: Spacing forces retrieval of prior exposure, strengthening memory consolidation
- **Mechanism — Encoding variability**: Spaced repetitions lead to encoding in varied contexts, creating more retrieval pathways
- **Mechanism — Deficient processing of massed repetitions**: Back-to-back repetitions receive less attention
- **Moderator — Retention interval**: Longer intervals associated with larger spacing advantage (consistent with lab research); not formally testable due to data limitations
- **Moderator — Interstudy interval**: 7-day intervals most effective; expanding intervals not consistently superior
- **Moderator — Education level**: Secondary > primary for effect magnitude and consistency
- **Moderator — Number of re-exposures**: Fewer sessions (≤3) → larger effects; more sessions → smaller effects (diminishing returns / fatigue)
- **Moderator — Learning domain**: Non-significant statistically; Language and Teacher Education domains showed numerically largest effects; Reading domain showed near-zero effect

## Study Design Details

- **Intervention**: Distributed practice (at least 1-day interstudy intervals) vs. massed practice (equal study time, back-to-back)
- **Eligibility**: Classroom-based studies with curriculum-relevant materials; minimum 1-day interstudy interval; retention or transfer outcomes; primary through university students
- **Search**: ERIC, PsycINFO, A+ Education, ProQuest Central (inception to June 2023)
- **Screening**: >3,000 initial articles → 25 met full inclusion criteria → 22 eligible for quantitative synthesis
- **Data extraction**: Single researcher (RM); 10% double-checked by supervising researcher (SK)
- **Analysis**: Random-effects meta-analysis (R, metafor package); restricted maximum likelihood

## Limitations

- **Cannot conduct formal moderator analysis**: k=22 is too small for meta-regression with >2 variables; all moderator patterns are qualitative/descriptive only
- **Significant unexplained heterogeneity**: I²=92% remains unexplained even after moderator analysis; unknown confounds likely exist
- **Conflation with interleaved practice**: Several math studies had distributed practice conditions that also interleaved topics; spacing and interleaving effects cannot be separated
- **Distributed practice not clearly defined in included studies**: Wide variability in what "practice" meant (re-reading vs. problem-solving vs. retrieval); this drove heterogeneity
- **Retention intervals limited to ≤42 days**: Long-term durability of classroom spacing effects unknown
- **One data extractor**: Only one researcher extracted data, increasing risk of extraction error
- **No special population data**: Cannot speak to effects for autistic learners or other populations typically included in mainstream classrooms
- **Publication bias signal present** (Egger's test significant), though authors argue it reflects small-study bias

## Population Scope Assessment

- **Population**: Students in classroom settings — primary, secondary, and university levels
- **Relevance to casual behavior change**: High — spacing/distributed practice is the core mechanism behind any spaced repetition system (SRS); directly applicable to habit tracking systems with learning/review components
- **Red flags**: None — general student populations in naturalistic classroom settings

## Conclusions

"Distributed practice had a moderate effect (d = 0.54) on classroom-based learning of curriculum-relevant materials." The effect is real but smaller than lab-based estimates. Key practical guidance: 7-day interstudy intervals and fewer re-exposures produce the strongest effects in applied settings. Primary school settings show weaker benefits than secondary school settings. Learning domain does not meaningfully moderate the effect.

---

## Extraction Notes

This is a high-value paper for NotionRPG — it provides the best available classroom-based estimate of the spacing effect (d=0.54), substantially more conservative than the commonly cited d=0.85 from Donoghue & Hattie (which included lab studies). The I²=92% is a caution flag: the average is real, but individual results vary enormously. The "less is more" finding on re-exposures and the 7-day interval finding are directly actionable for spaced repetition system design. The Reading domain near-zero effect is notable — passive re-reading may not benefit from spacing in the way active retrieval does.
