# Neglect of Publication Bias Compromises Meta-Analyses of Educational Research

## Study Overview
- **Citation**: Ropovik, I., Adamkovic, M., & Greger, D., 2021 (preprint DOI reflects 2019 OSF submission; published PLoS ONE 2021)
- **Study Type**: Meta-science survey (census of educational meta-analyses; not a systematic review or meta-analysis of primary studies)
- **Sample**: n=110 eligible meta-analyses published 2016–2020 in Review of Educational Research (n=54) and Educational Research Review (n=56)
- **DOI**: 10.1371/journal.pone.0252415 (published); preprint: 10.31222/osf.io/z7drq
- **PMID**: Not reported

## Key Findings

- **Finding 1 — Most educational meta-analyses do not apply bias correction**: Only 40% (n=44) of the 110 surveyed meta-analyses both detected and attempted to correct for publication bias. 42% (n=46) tested for bias but applied no correction. 18% (n=20) did not address publication bias at all.

- **Finding 2 — Trim-and-fill dominates bias correction, despite known inadequacy**: Of the 40% that attempted correction, virtually every single one used trim-and-fill as the sole correction method. Only 3% of all surveyed meta-analyses used statistically principled correction methods (e.g., selection models). Trim-and-fill is known to have a consistent upward bias and high false-positive rate under publication bias — nearly as bad as naïve uncorrected estimates.

- **Finding 3 — Bias-corrected estimates rarely inform conclusions**: Even among the minority that detected bias and computed corrected estimates, only 9% of those (4% of all meta-analyses, n=4 overall) based their substantive conclusions on the corrected estimates. The correction was effectively inconsequential for headline findings.

- **Finding 4 — The scale of the problem in education**: Meta-analyses in education yield an average effect size of d=0.40 across ~800 meta-analyses (Hattie's synthesis). Pre-registered large-scale RCTs of promising interventions yield an average of d=0.06. This 6× discrepancy is attributed largely to publication bias and inflated meta-analytic estimates.

- **Finding 5 — Fail-safe N widely misused**: 37% of meta-analyses that used bias-related methods employed Fail-safe N — a test that does not actually detect publication bias and is known to produce fallacious inferences. In none of the applications did Fail-safe N suggest publication bias was present.

- **Finding 6 — Most meta-analyses searched for grey literature but it doesn't solve the problem**: 77% (n=85) of meta-analyses searched for grey literature. However, the authors argue this does not resolve publication bias because the decision to write up studies is itself conditioned on results, making even "unpublished" written material a biased sample.

- **Finding 7 — Bias detection results should not gate correction**: A common practice is to correct for bias only when detection tests indicate bias. This is logically flawed — detection tests have low power with small k (median k=15 in this sample), and absence of evidence is not evidence of absence. Bias should be assumed as the default and correction should always be attempted.

## Effect Sizes (Raw Values)

This is a meta-science survey; no primary effect sizes. Key quantitative benchmarks:

- **Average educational effect size (800 meta-analyses)**: d = 0.40 (Hattie, 2009; cited as context)
- **Average RCT effect size (pre-registered, required to publish)**: d = 0.06 (Lortie-Forgues & Inglis, 2019; cited as context)
- **Registered replication report effects vs. meta-analyses**: ~3× smaller on average (Kvarven et al., 2020; cited as context)
- **Ego depletion example**: Meta-analysis of 198 effects yielded d=0.62; bias-corrected re-analysis suggested nil effect; multi-lab pre-registered study found d=0.04
- **Inter-rater reliability for coding**: Mean Cohen's κ = 0.93 (SD=0.10), range 0.74–1.00

## Mechanisms & Moderators

- **Mechanism — File drawer problem**: Studies with non-significant or negative focal findings are less likely to be submitted or accepted. This creates a biased sample of available studies, inflating average effect sizes.
- **Mechanism — p-hacking amplification**: Under moderate publication bias and small true effects, transformation of null/negative results into positive results further amplifies upward bias (Friese & Frankenbach, cited).
- **Mechanism — Trim-and-fill's false security**: Trim-and-fill estimates the "missing" studies by mirroring the funnel plot; under actual publication bias, this method shows a consistent upward bias similar to naïve estimates.
- **Moderator — Study k (number of effects)**: The lower the k, the lower the power of bias detection tests. With median k=15, most meta-analyses lacked power to detect anything but extreme bias.
- **Moderator — Heterogeneity**: High heterogeneity can cause funnel plot asymmetry for reasons unrelated to publication bias (small-study effects, methodological differences), making visual inspection unreliable.

## Study Design Details

- **Design**: Census survey of all empirical meta-analyses published 2016–2020 in two top educational review journals
- **Coding**: Two independent coders; all disagreements resolved by consensus; κ=0.93
- **Variables coded**: Use of bias detection methods, use of bias correction methods, whether bias was detected, whether corrected estimates informed conclusions, grey literature search, median k
- **Exclusions**: Meta-research on methodological aspects; umbrella reviews; non-empirical papers
- **Data availability**: Fully open at osf.io/ephba
- **Not pre-registered** (explicitly noted; this is not a systematic review testing a priori hypotheses)

## Limitations

- **Only two journals**: Results reflect meta-analyses in two flagship review journals only; authors assume lower-tier journals fare no better, but this is not demonstrated
- **Sampling frame is the "best" meta-analyses**: If even these high-profile meta-analyses neglect bias adjustment, the field's overall state is likely worse — but the paper cannot confirm this
- **Not a systematic review**: The authors do not test a priori hypotheses; the protocol was not pre-registered
- **Cannot quantify the actual inflation**: The paper documents neglect of bias correction but cannot estimate how much actual inflation has occurred across educational meta-analyses
- **Temporal snapshot**: 2016–2020 data; practices may be improving since then

## Population Scope Assessment

- **Population**: Meta-science / methodological paper; the "population" is educational meta-analyses, not human subjects
- **Relevance to casual behavior change**: Indirect — this paper does not study behavior change; it informs how much to trust effect sizes from educational meta-analyses
- **Red flags**: None clinical. Relevance to NotionRPG is methodological: it establishes a systematic discount factor to apply when evaluating educational research effect sizes

## Conclusions

"A large majority of educational meta-analyses addressed the issue of publication bias by employing some of the bias detection methods. Overall, a third of meta-analyses employing bias detection reported detecting publication bias... the adoption of advances in publication bias adjustment has been rather slow." The practical implication: "consumers of educational research and meta-analysts should therefore primarily downgrade their expectations concerning the conclusiveness of meta-analyses and not place too much confidence in the meaning and precision of the estimated overall effects." Bias correction should be attempted by default, not conditionally.

## Named Frameworks (if applicable)

- **Framework**: 8-step practical recommendations for handling publication bias in meta-analyses
  - Components: (1) Correct for bias, (2) Correct even if none detected, (3) Use state-of-the-art methods (selection models), (4) Consider small-study effects, (5) Include unpublished studies, (6) Make meta-analyses reproducible, (7) Pre-register, (8) Report bias correction in abstract
  - Research alignment: Each recommendation addresses a documented failure mode identified in the survey

---

## Extraction Notes

This is a methodological paper with no direct behavioral findings. Its value for the NotionRPG guidebook pipeline is as a calibration tool: when a meta-analysis of educational or learning-science research reports d=0.40 or d=0.85, those numbers should be treated skeptically. The d=0.40 (educational interventions) vs. d=0.06 (pre-registered RCTs) comparison is the sharpest illustration of the scale of potential inflation. This warrants applying a conservative discount when citing effect sizes from meta-analyses that do not report bias-corrected estimates — which is the majority. Mawson (2025) and other papers in the inventory should be evaluated through this lens. Of note: Mawson reported a significant Egger's test but attributed it to small-study bias rather than publication bias, which is precisely the kind of judgment this paper cautions requires careful reasoning.
