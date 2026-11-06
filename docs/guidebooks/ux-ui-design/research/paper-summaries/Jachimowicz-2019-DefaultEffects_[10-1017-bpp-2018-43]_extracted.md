---
title: "When and why defaults influence decisions: a meta-analysis of default effects"
authors: [Jachimowicz, J.M., Duncan, S., Weber, E.U., Johnson, E.J.]
year: 2019
type: meta-analysis
population: mixed
sample_size: 73675
key_claims:
  - "Opt-out defaults increase uptake of pre-selected option by d=0.68 (95% CI [0.53, 0.83]) over opt-in conditions across 58 datasets (pooled n=73,675)"
  - "Absolute average uptake shift of 27.24% in binary-outcome studies (Cramér's V=0.29, 95% CI [0.21, 0.37])"
  - "Endorsement (b=0.32, p=0.038) and endowment (b=0.31, p=0.044) significantly moderate effect size; ease does not (b=-0.05, p=0.75)"
  - "Consumer domains show significantly larger default effects (b=0.73, p=0.003); environmental domains show smaller effects (b=-0.47, p=0.08, marginal)"
  - "Heterogeneity is extremely high (I²=98.21%): 46/58 observations positive-significant, 10 non-significant, 2 negative-significant"
  - "Publication bias analysis suggests larger effects are underreported (trim-and-fill adjusted d=0.80)"
doi: "10.1017/bpp.2018.43"
pmid: unknown
evidence_grade: foundational
scope_flag: include
inflation_flag: choice-architecture
---

# When and Why Defaults Influence Decisions: A Meta-Analysis of Default Effects

## Study Overview
- **Citation**: Jachimowicz, J.M., Duncan, S., Weber, E.U., & Johnson, E.J. (2019)
- **Study Type**: Meta-analysis (random-effects, 3-level hierarchical model)
- **Sample**: k=58 datasets from 55 studies in 35 articles; pooled n=73,675 (individual study n range: 51 to 41,952)
- **Search window**: Through May 2017
- **DOI**: 10.1017/bpp.2018.43
- **PMID**: unknown

## Key Findings

- **Overall default effect**: Opt-out vs. opt-in default produces d=0.68 (95% CI [0.53, 0.83], p<0.001). Three-level model (accounting for nesting within studies and articles): d+=0.63 (95% CI [0.47, 0.80], p<0.001). Conventional classification: medium effect.

- **Binary outcomes translation**: Among 38/58 binary-outcome observations, Cramér's V+=0.29 (95% CI [0.21, 0.37], p<0.001), corresponding to an absolute average uptake difference of 27.24%.

- **Massive heterogeneity**: I²=98.21% (base model), I²=98.01% (three-level model). Variance decomposition: 30.21% at article level, 63.58% at within-article study level, 4.21% at within-study observation level, 2.00% sampling variance. Of 58 observations: 46 positive-significant, 10 non-significant, 2 negative-significant.

- **Mechanism moderators**: Endorsement (b=0.32, SE=0.15, p=0.038) and endowment (b=0.31, SE=0.15, p=0.044) significantly increase effect size. Ease does not (b=-0.05, SE=0.15, p=0.75). Mechanisms account for additional heterogeneity reduction beyond study characteristics alone (I² drops from 93.54% to 92.32% when channels added).

- **Domain moderators**: Consumer domain significantly increases effect (b=0.73, SE=0.23, p=0.003); environmental domain marginally decreases effect (b=-0.47, SE=0.27, p=0.08; becomes significant at p=0.028 in full channel model at b=-0.60). Health domain is non-significant.

- **Publication bias direction**: Trim-and-fill identifies 8 missing studies; corrected estimate d+=0.80 (95% CI [0.65, 0.96]). Egger's test non-significant (t(56)=-0.39, p=0.69), suggesting underreporting of large effects (not suppression of small/null effects). Direction is atypical for publication bias — the file drawer likely contains confirmatory replications, not null results.

- **Benchmarking**: Default effect (d=0.68) is substantially larger than healthy eating nudges (d=0.23), Opower social norm energy intervention (d=0.32), and framing effects on risky choice (d=0.31).

## Effect Sizes (Raw Values)

- **Overall default effect (2-level RE)**: d=0.68, 95% CI [0.53, 0.83], p<0.001, k=58, n=73,675
- **Overall default effect (3-level RE)**: d+=0.63, 95% CI [0.47, 0.80], p<0.001
- **Binary outcomes (Cramér's V)**: V+=0.29, 95% CI [0.21, 0.37], p<0.001; absolute mean difference = 27.24%
- **Publication-bias corrected (trim-and-fill)**: d+=0.80, 95% CI [0.65, 0.96], p<0.001 (8 imputed studies)
- **Heterogeneity**: I²=98.21% (2-level); I²=98.01% (3-level) — very high
- **Robustness (n<1000 only)**: I²=92.85% (base), I²=90.47% (with study characteristics), I²=89.12% (full model)

**Moderator coefficients (full model, Table 2):**

| Moderator | b | SE | p | Robust p |
|-----------|---|-----|---|----------|
| Endorsement | 0.32 | 0.15 | 0.038 | 0.020 |
| Ease | -0.05 | 0.15 | 0.75 | 0.740 |
| Endowment | 0.31 | 0.15 | 0.044 | 0.081 |
| Consumer domain | 0.89 | 0.23 | 0.0003 | 0.010 |
| Environmental domain | -0.60 | 0.26 | 0.028 | 0.056 |
| Health domain | 0.25 | 0.23 | 0.26 | 0.340 |
| Binary response | -0.18 | 0.15 | 0.25 | 0.300 |
| Field experiment | 0.39 | 0.21 | 0.07 | 0.210 |
| Decade of study | -0.16 | 0.22 | 0.31 | 0.480 |
| Sample size (>1000) | 0.36 | 0.24 | 0.15 | 0.170 |
| Online vs. offline | 0.02 | 0.13 | 0.93 | 0.910 |
| Location: USA | -0.12 | 0.16 | 0.57 | 0.640 |
| Benefits self | 0.22 | 0.17 | 0.21 | 0.180 |
| Financial consequence | 0.05 | 0.29 | 0.78 | 0.770 |

Full model R²=0.31 (31% of variance explained), k=58, n_studies=55.

## Mechanisms & Moderators

- **Endorsement**: Defaults are perceived as conveying a trusted recommendation from the choice architect. Higher endorsement coding → larger effect (b=0.32, p=0.038). Driven by decision-maker trust in the architect's intentions. Undermined when users suspect the architect's motives differ from their interests.

- **Endowment**: Decision-makers treat the default as the status quo, invoking loss aversion and reference-dependent encoding. Higher endowment coding → larger effect (b=0.31, p=0.044). More potent when the default has been in place and decision-makers have little prior experience with the domain.

- **Ease**: Staying with the default requires less effort than opting out. Coded but NOT a significant moderator in this meta-analysis (b=-0.05, p=0.75). Authors note ease is under-manipulated in lab studies; real-world applications (e.g., Chile requiring notarized opt-out statements) suggest it should matter but it is not well-captured in this corpus.

- **Domain effects**: Consumer preferences are weakly held → larger defaults. Environmental preferences are more strongly held → smaller defaults. Proposed mechanism: "preference strength" — when individuals care deeply, defaults are less influential.

- **Number of active channels**: Additive interpretation — defaults operating through both endorsement and endowment simultaneously likely produce larger effects than those activating only one mechanism.

- **Preference strength (untested moderator)**: Authors hypothesize this may underlie domain effects. Decision importance may also moderate effects via the ease channel specifically — high-stakes decisions motivate effort to override defaults.

- **Preference distribution (untested moderator)**: Defaults less effective when population preferences are widely distributed and misaligned with the default.

## Study Design Details

- **Comparison**: Opt-out condition vs. opt-in condition (explicit comparison required for inclusion). Forced-choice and active-choice studies excluded.
- **Effect size coding**: Cohen's d for continuous outcomes; arcsine transformation for binary outcomes.
- **Statistical model**: Random-effects, restricted maximum likelihood; 3-level nested model (observation → study → article) to address non-independence.
- **Mechanism coding**: Two trained coders (blind to hypotheses) rated each study on endorsement (0–2 scale), ease (0–2 scale), and endowment (0–1 scale). Interrater reliability: endorsement κ=0.59, ease κ=0.58, endowment κ=0.80.
- **Domain coding**: Environmental, consumer, health (non-exclusive; 10 studies coded in multiple domains). Interrater κ=0.94.
- **Domains represented**: Organ donation, retirement savings, energy use, health decisions (vaccination, colonoscopy, end-of-life directives), consumer purchases, charitable giving, research consent.

## Limitations

- **Mechanism coding is proxy-based**: Coders inferred which channels were activated from study descriptions, not from measured psychological mediators. This introduces noise and likely attenuates moderator detection (especially for ease).
- **Ease under-manipulated in laboratory studies**: Real-world ease variations (e.g., requiring notarized documents to opt out) are absent from the corpus. The null result for ease should not be interpreted as ease being unimportant.
- **Very high heterogeneity remains unexplained**: Even the full model explains only 31% of variance (R²=0.31); I² remains ~92%. Many sources of variability are unaccounted for.
- **Non-systematic variation in study design**: Choice architects did not deliberately vary endorsement/endowment/ease; the meta-analysis exploits inadvertent variation, limiting causal inference about mechanisms.
- **Egger's test has low power with high heterogeneity**: The non-significant publication bias test may reflect statistical limitations rather than absence of bias.
- **Untested moderators**: Preference strength, decision importance, preference distribution — all theoretically important but unmeasured in included studies.
- **Search cutoff May 2017**: May miss relevant subsequent literature.
- **Open Science**: Data and code available at https://osf.io/tcbh7.

## Population Scope Assessment

- **Population**: Mixed — general adult populations in field experiments (German energy consumers, US retirement plan participants) and lab/online samples. Wide range of decision domains.
- **Relevance to casual behavior change**: High. Defaults directly apply to digital product design (onboarding, settings screens, notification opt-ins). The endorsement and endowment mechanisms are operationalizable in UX contexts.
- **Red flags**: Some included studies are in specialized clinical contexts (end-of-life directives, neonatal resuscitation decisions). These are poor analogs for consumer app design. Consumer and health-behavior studies are more applicable.
- **Population applicability note**: Effect sizes from consumer-domain studies will be more relevant to NotionRPG than health/environmental domain estimates.

## Conclusions

"On average, defaults exert a considerable influence on decisions. However, our meta-analysis also reveals substantial variability in defaults' effectiveness, suggesting that both when and how defaults are deployed matter. That is, both the context in which a default is used and whether the default's design triggers its underlying channels partially explain the variability in the default effect."

The authors conclude that choice architects should deliberately consider endorsement (does the user believe the architect has their interests at heart?) and endowment (does the framing make the default feel like the status quo?) when designing defaults, rather than assuming any pre-selection will produce the average effect. The ease channel is theoretically important but empirically underexamined.

---

## Full Moderator/Subgroup Table

**Study characteristics only model (Table 1):**

| Moderator | b | SE | p (standard) | Robust p |
|-----------|---|-----|--------------|----------|
| Intercept | 0.82 | 0.45 | 0.08 | 0.18 |
| Binary response | -0.10 | 0.15 | 0.52 | 0.59 |
| Decade of study | -0.13 | 0.16 | 0.41 | 0.53 |
| Sample size (>1000) | 0.29 | 0.26 | 0.26 | 0.22 |
| Online vs. offline | -0.05 | 0.16 | 0.74 | 0.72 |
| Location: USA | -0.08 | 0.23 | 0.72 | 0.76 |
| Benefits self | 0.14 | 0.17 | 0.42 | 0.43 |
| Field experiment | -0.02 | 0.18 | 0.93 | 0.94 |
| Financial consequence | 0.34 | 0.21 | 0.11 | 0.19 |
| Environmental domain | -0.47 | 0.27 | 0.08 | 0.09 |
| Consumer domain | 0.73 | 0.23 | 0.003 | 0.03 |
| Health domain | 0.001 | 0.20 | 0.99 | 0.99 |

Model: k=58, n_studies=55, R²=0.24, I²=93.54%

**Full model with channels (Table 2):** See Effect Sizes section above.

**Heterogeneity variance decomposition (3-level model):**

| Level | % of total variance |
|-------|---------------------|
| Article level (between-cluster) | 30.21% |
| Studies within articles (within-cluster) | 63.58% |
| Observations within studies | 4.21% |
| Sampling variance | 2.00% |

**Note**: No subgroup-level effect size estimates by domain are reported in the paper — only regression coefficients for domain moderators in the full model. Individual study effect sizes are depicted in a forest plot (Figure 1) but not tabulated numerically in the text.

## Quotable Passages

> "While our analysis reveals a considerable influence of defaults (d = 0.68, 95% confidence interval = 0.53–0.83), we also discover substantial variation: the majority of default studies find positive effects, but several do not find a significant effect, and two even demonstrate negative effects." (Abstract)

> "The effect for defaults we find in the current meta-analysis is considerably larger than a recent meta-analysis evaluation of healthy eating nudges (including plate size changes or nutrition labels, d = 0.23; Cadario & Chandon, 2018), a recent meta-analysis of the effect of Opower's descriptive social norm intervention on energy savings (d = 0.32; Jachimowicz, Hauser et al., 2018), as well as a meta-analysis of framing effects on risky choice (d = 0.31; Kühberger, 1998)." (General Discussion)

> "The ways that the three channels are measured in the current research are only noisy approximations, which attenuates our ability to detect systematic differences in the variability in defaults' effectiveness... ease does not seem to be systematically manipulated in studies, but is often varied in real-world applications." (General Discussion)

## Boundary Conditions & Population Caveats

- **Applies to**: Situations where (a) users do not have strongly formed prior preferences, (b) the choice architect is perceived as trustworthy, (c) the default is framed as the status quo, (d) the domain is consumer-like (transactional, low-stakes preferences).
- **Does NOT apply to**: Situations with strongly held preferences (e.g., political choices, deeply held values), low-trust architect-user relationships, environmental-domain decisions where preferences are well-established, or active-choice paradigms (this meta-analysis specifically excludes those).
- **Weaker in**: Environmental contexts (b=-0.60 in full model); situations where users are motivated to exert effort to find the right answer (high decision importance undermines ease channel); populations with heterogeneous and misaligned preferences.
- **Unknown/untested**: Whether preference strength or decision importance directly mediate domain effects; whether ease matters more in real-world (vs. lab) implementations; long-term persistence of defaults after initial choice; effects of transparency about the default on endorsement.

---

## Extraction Notes

This is the canonical quantitative reference for default effect sizes. The headline d=0.68 is frequently cited without the attached I²=98% caveat — the variability is the story, not just the average. For NotionRPG, the most actionable finding is the mechanism breakdown: endorsement and endowment drive the effect; ease does not (at least in this corpus). This maps directly to UX design: if users don't trust the system or don't perceive the default as "the natural state," the default will underperform the meta-analytic average.

The inflation_flag is set to `choice-architecture` per project convention. The uncorrected estimate is d=0.68; the corrected estimate per project convention (subtract ~0.30) would suggest a practical effect around d=0.38-0.45 for typical applications. Consumer domains likely sit above this; environmental domains likely below.

Publication bias finding is unusual: trim-and-fill imputes 8 missing studies with *larger* effects, suggesting the file drawer contains strong positive results, not null results. This makes the d=0.68 estimate conservative relative to bias-adjusted estimates.
