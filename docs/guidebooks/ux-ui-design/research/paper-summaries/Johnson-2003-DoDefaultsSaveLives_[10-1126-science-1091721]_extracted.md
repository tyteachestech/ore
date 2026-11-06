---
title: "Do Defaults Save Lives?"
authors: [Johnson, E.J., Goldstein, D.]
year: 2003
type: experimental
population: general-adult
sample_size: 161
key_claims:
  - "Opt-out defaults produced ~2x higher consent rates than opt-in in online experiment (82% vs 42%)"
  - "Across 10 European countries, opt-out nations had 99.5–99.98% consent; opt-in nations had 4.25–27.5% — ~60 percentage point gap with zero distributional overlap"
  - "Opt-out default increased actual cadaveric donation rate by 16.3% (p<0.02), from 14.1 to 16.4 per million (this paper); Gimbel et al. found 56.5% increase (10.8 to 16.9 per million)"
  - "Netherlands mass mailing (12M+ letters) failed to change effective consent rate — educational campaigns alone are insufficient against a weak opt-in default"
  - "Three mechanisms: defaults as implicit policy recommendations, effort asymmetry (changing default requires effort), and loss aversion (status quo as reference point)"
doi: "10.1126/science.1091721"
pmid: "14631035"
evidence_grade: foundational
scope_flag: include
inflation_flag: none
---

# Do Defaults Save Lives?

## Study Overview
- **Citation**: Johnson, E.J. & Goldstein, D. (2003). *Science*, 302(5649), 1338–1339.
- **Study Type**: Mixed — online experiment (Study 1) + cross-national observational analysis (Studies 2–3)
- **Sample**: Study 1: n=161 online respondents; Studies 2–3: 10+ European countries, population-level data 1991–2001
- **DOI**: 10.1126/science.1091721
- **PMID**: 14631035

## Key Findings

- **Finding 1 — Online experiment, default effect on consent rate**:
  Opt-in (current U.S. practice): 42% consent. Neutral (forced choice, no default): 79% consent. Opt-out: 82% consent. Opt-out and neutral did not differ significantly from each other; opt-in was the sole significantly lower condition. Effect size not reported in standard d/SMD form — reported as descriptive percentages. Change was achievable at "a mouse click," ruling out effort as the sole mechanism.

- **Finding 2 — Cross-national consent rates (10 European countries)**:
  Explicit-consent (opt-in) countries: Denmark 4.25%, Netherlands 27.5%, UK 17.17%, Germany 12%. Presumed-consent (opt-out) countries: France 99.91%, Hungary 99.97%, Poland 99.5%, Portugal 99.64%, Sweden 85.9%, Austria 99.98%. The two distributions have zero overlap; ~60 percentage points separate the groups.

- **Finding 3 — Actual cadaveric donation rates (regression, 1991–2001)**:
  Opt-out default associated with a 16.3% increase in actual donations (p < 0.02), lifting the donor rate from 14.1 to 16.4 per million. Controls included transplant infrastructure, educational level, religion, and year. Gimbel et al. (1999 data, broader Eastern European sample) found a larger 56.5% increase (10.8 to 16.9 per million); difference attributed to lower baseline rates in Eastern European countries.

- **Finding 4 — Educational campaigns are insufficient**:
  Netherlands 1998: national donor registry creation accompanied by a mass mailing to 12+ million people (in a country of 15.8M) failed to change the effective consent rate. Default structure dominated campaign exposure.

## Effect Sizes (Raw Values)

- **Opt-in vs. opt-out consent rate (experiment)**: 42% vs. 82% — approximately 2x difference; no formal effect size (d/OR) reported.
- **Opt-in vs. neutral consent rate (experiment)**: 42% vs. 79%; neutral and opt-out did not significantly differ.
- **Country-level consent rates**:
  - Opt-in range: 4.25% – 27.5%
  - Opt-out range: 85.9% – 99.98%
  - Gap: ~60 percentage points; zero distributional overlap
- **Actual donation rate increase (Johnson & Goldstein, time-series regression)**: +16.3%, p < 0.02; 14.1 → 16.4 per million
- **Actual donation rate increase (Gimbel et al. replication, 1999)**: +56.5%; 10.8 → 16.9 per million

Note: No formal effect sizes (Cohen's d, OR, SMD) reported. Findings are percentages and regression coefficients. Confidence intervals not provided in the text.

## Mechanisms & Moderators

Three proposed mechanisms for why defaults exert influence even when stated preferences exist:

- **Implicit recommendation**: Decision-makers interpret the default as a policy recommendation — a suggested "correct" answer from the institution. Relevant for app settings: the default signals what the designer endorses.
- **Effort asymmetry**: Accepting a default requires no action. Changing it requires physical, cognitive, and (in this domain) emotional effort. In-person registration magnifies this; even digital contexts with one-click changes still show the effect (Study 1 result), suggesting effort is not the sole driver.
- **Loss aversion / status quo bias**: The current state becomes the reference point. Deviating feels like a loss. Changing from opt-in to opt-out reframes what constitutes "losing." (Tversky & Kahneman, 1991 cited.)

**Moderator — Cost of switching**: Country data showed larger effects than the online experiment. Authors attribute this to higher friction in the real world (forms, phone calls, mail) vs. one-click change in the experiment. This implies defaults matter more when the UI makes changing them harder.

**Moderator — Preference clarity**: Classic economics predicts defaults won't matter when preferences are strong. The data contradict this — 85% of Americans say they approve of donation yet only 28% had signed a donor card. Weak/unformed preferences amplify default effects.

## Study Design Details

- **Study 1 (experiment)**: 161 online respondents; 3-condition between-subjects design (opt-in / opt-out / neutral forced-choice). Randomized assignment implied. Consent change required a single mouse click, controlling for effort.
- **Study 2 (observational)**: Cross-national comparison of 10 European countries; effective consent rates from central registries and Gäbel (2002) report. No randomization — correlational.
- **Study 3 (regression)**: Time-series analysis, 1991–2001, multiple European countries. Dependent variable: actual cadaveric donations per million. Covariates: transplant infrastructure, educational level, religion, year. Replicates and extends Gimbel et al. (2003).
- **Attrition**: Not applicable (experiment had no follow-up; observational data was archival).
- **Blinding**: Not reported for Study 1.

## Limitations

- **Causal inference (observational studies)**: Studies 2 and 3 are cross-national observational data. Countries that adopt opt-out policies may differ systematically from opt-in countries in ways not fully captured by covariates.
- **No effect size standardization**: The paper reports percentages and regression coefficients but no Cohen's d or OR with confidence intervals, making formal comparison to other behavioral interventions difficult.
- **Single-domain finding**: All data are from organ donation — a high-stakes, emotionally charged context. Effect magnitude may not transfer directly to lower-stakes defaults (e.g., app notification settings).
- **Online experiment sample**: n=161; no demographic description. Likely not representative. Study 1 is underpowered for subgroup analysis.
- **Loss aversion vs. effort confound**: Even with one-click change in Study 1, all three mechanisms remain active. The relative contribution of each is untested in this paper.
- **Publication context**: 2-page Science Policy Forum piece, not a full research article. Methods are sparse; supporting materials referenced but not included in the source file.

## Population Scope Assessment

- **Population**: General adult (online experiment); European country populations (observational)
- **Relevance to app/onboarding design**: High. The mechanisms (implicit recommendation, effort asymmetry, loss aversion) apply directly to checkbox defaults, onboarding toggles, permission prompts, and settings pre-selection in any digital product.
- **Red flags**: The donation context is emotionally loaded and high-stakes; effect sizes in app defaults may be smaller. The ~2x ratio is likely an upper-bound estimate for app UX contexts.

## Conclusions

Defaults exert large, consistent effects on decisions even when stated preferences suggest people should override them. The opt-in vs. opt-out distinction alone accounts for nearly the entire cross-national variation in organ donor consent rates — a ~60 percentage point gap with no distributional overlap. Even a one-click change in an online setting did not eliminate the default effect, pointing to mechanisms beyond friction. Educational campaigns (e.g., mass mailings) fail to substitute for a well-chosen default. The authors conclude: "defaults make a large difference in lives saved" and urge policy-makers to treat default-setting as a consequential design decision, not a neutral technical choice.

## Named Frameworks (if applicable)

- **Default effect / Status quo bias**
  - Components: Implicit recommendation signal, effort asymmetry, loss aversion
  - Research alignment:
    - Implicit recommendation -> legitimacy/authority heuristic
    - Effort asymmetry -> friction as a behavioral lever
    - Loss aversion -> Kahneman & Tversky prospect theory

---

## Extraction Notes

This is a short, landmark Science Policy Forum piece (2 pages), not a full research article. The empirical weight rests on:
1. A small online experiment (n=161, no reported demographics or formal effect sizes)
2. Cross-national observational data that is correlation-only

The experiment is thin by modern standards but the country-level data is striking and widely replicated. The ~60 percentage point gap across 10 countries with zero overlap is the load-bearing finding.

**UX/guidebook applicability**: Directly relevant to settings design, onboarding, permission prompts, and feature opt-in flows. The core design implication is clean: the default is never neutral — it is a recommendation. Opt users in to features/settings that serve the majority; reserve opt-in for things that require genuine active choice. Be cautious not to inflate effect sizes — the ~2x ratio comes from a high-stakes, emotionally ambiguous domain. App toggle defaults will produce real but likely smaller effects.

**Inflation flag rationale**: "choice-architecture" flag was considered but not set. The paper is the foundational empirical source for default effects, not a meta-analysis of inflated estimates. Apply `choice-architecture` inflation correction when citing downstream meta-analyses of this literature, not this source directly.
