# Spaced Retrieval Practice Meta-Analysis (Latimier et al., 2021)

## Study Overview
- **Citation**: Latimier, A., Peyre, H., & Ramus, F. (2021)
- **Study Type**: Meta-analysis (two subsets, RVE — Robust Variance Estimation)
- **Sample**: 29 total studies (11 for Subset 1, 16 for Subset 2 with some overlap); Subset 1: k=39 effect sizes; Subset 2: k=54 effect sizes
- **DOI**: 10.1007/s10648-020-09572-8
- **PMID**: Not reported

## Key Findings

- **Finding 1 — Spaced vs. massed retrieval practice (Subset 1)**: Spacing retrieval practice sessions produces large gains over massing them. Effect is robust even after publication bias correction.
  - Raw: g=1.01 [0.68, 1.34], p<0.01
  - Bias-corrected (trim-and-fill): g=0.74 [0.55, 0.91], p<0.01
  - Heterogeneity: I²=49.09% (moderate); individual study effect sizes ranged from g=0.29 to g=2.16
  - Publication bias: Confirmed (Egger's test: t=4.41, p<0.0001); 10 studies added by trim-and-fill

- **Finding 2 — Expanding vs. uniform spacing schedule (Subset 2)**: Contrary to widely held assumptions, an expanding retrieval schedule (increasing intervals) is NOT significantly superior to a uniform (equal-interval) schedule.
  - g=0.034 (95% CI [-0.10, 0.17]), p=0.59 (non-significant)
  - Heterogeneity: I²=0% (no between-study variability)
  - Publication bias: None detected (Egger's t=-0.44, d.f.=52, p=0.66)
  - Effect sizes ranged g=-0.53 to g=1.02; 55% positive, 43% negative, 2% zero

- **Finding 3 — Number of exposures moderates expanding vs. uniform (marginal)**: When each item was practiced more than 4 times, the expanding schedule showed a trend toward superiority. With 4 or fewer exposures, no advantage.
  - >4 exposures: g=0.20 [−0.07, 0.47], p=0.12 (n.s.)
  - ≤4 exposures: g=−0.04 [−0.17, 0.094], p=0.54 (n.s.)
  - Moderator p=0.09 (marginal)

- **Finding 4 — Spaced and retrieval practice effects appear additive**: Based on comparison with prior meta-analyses, the spacing effect (g≈0.71) and retrieval practice effect (g≈0.50–0.61) appear to combine additively, suggesting that spaced retrieval practice should outperform either strategy alone.

## Effect Sizes (Raw Values)

**Subset 1: Spaced vs. massed retrieval practice**
- Unadjusted: g=1.01 (SE=0.15, d.f.=9.72), 95% CI [0.68, 1.34], p<0.01
- Trim-and-fill corrected (k=49): g=0.74 (SE=0.09, d.f.=19.4), 95% CI [0.55, 0.91], p<0.01
- I²=49.09%; range of individual effects: g=0.29 to g=2.16

**Subset 2: Expanding vs. uniform schedule**
- g=0.034 (SE=0.06, d.f.=13.7), 95% CI [-0.10, 0.17], p=0.59 (n.s.)
- I²=0%; range of individual effects: g=-0.53 to g=1.02

**Subset 2 subgroups (number of exposures moderator):**
- ≤4 exposures (n=26 comparisons): g=−0.04 [−0.17, 0.094], p=0.54
- >4 exposures (n=25 comparisons): g=0.20 [−0.07, 0.47], p=0.12

## Mechanisms & Moderators

- **Mechanisms for spacing benefit (Subset 1)**: Three theories are consistent with the large spacing effect, and the data cannot distinguish between them:
  1. Study-phase retrieval theory — spacing makes subsequent retrieval more effortful, strengthening the memory trace
  2. Encoding variability theory — spacing increases contextual variability between encoding episodes, providing more retrieval cues
  3. Deficient processing theory — massed repetitions are underprocessed because the item is still in working memory

- **Why expanding ≠ uniform (Subset 2)**: The equal-interval schedule may actually be superior at longer retention intervals because the first retrieval attempt is more challenging. The absence of an expanding advantage may reflect that the first retrieval attempt timing (not the subsequent schedule) is the primary driver of retention.

- **Moderator analyses — Subset 1**: No moderator reached significance at α=0.1. Tested: retention interval (log min), design (between/within), feedback, stimuli type, number of exposures, training test type, spacing schedule type. Most had insufficient d.f. for reliable analysis (d.f.<4).

- **Moderator analyses — Subset 2**: Only number of exposures (>4 vs. ≤4) was marginal (β=0.22, p=0.09). All others non-significant: retention interval (β=0.03, p=0.53), design (β=0.11, p=0.54), feedback (β=-0.13, p=0.23), stimuli (β=0.24, p=0.23), training test type (β=-0.09, p=0.44), final assessment type (β=-0.17, p=0.18), placement of first retrieval (β=0.25, p=0.35).

## Study Design Details

- **Intervention**: Retrieval practice (spaced vs. massed; expanding vs. uniform schedule)
- **Control/Comparison**: Subset 1: massed retrieval practice; Subset 2: uniform spacing schedule
- **Follow-up period**: Variable across included studies; retention intervals ranged from immediate to long-term
- **Study scope**: Predominantly laboratory settings (college/adult participants); few classroom studies
- **Analysis model**: RVE (Robust Variance Estimation) using robumeta R package; accounts for non-independent effects within studies
- **Sensitivity analysis**: Varying assumed within-study correlation (ρ=0, 0.2, 0.5, 0.8) had no impact on Subset 2 mean effect size or between-study variance — results are robust
- **Publication bias**: Funnel plots + Egger's regression test for both subsets; trim-and-fill correction for Subset 1

## Limitations

- No systematic search for unpublished studies beyond ERIC dissertations — may miss unpublished null results for Subset 1 (though trim-and-fill correction was applied)
- Moderator analyses were underpowered for Subset 1 (many moderators had d.f.<4); cannot distinguish true null from insufficient power
- Predominantly laboratory settings with adult/college participants — limited ecological validity; few classroom studies included
- Diversity of experimental settings (stimuli type, population, test types) limits ability to test specific moderating hypotheses
- Subset 1 had significant unexplained heterogeneity (I²=49.09%) that moderators failed to illuminate
- Subset 2 does not include restudying schedules — can only compare expanding vs. uniform within retrieval practice paradigm
- Cannot test direct comparison between massed reading and spaced retrieval practice (no included studies had this design)

## Population Scope Assessment

- **Population**: Predominantly college/adult lab participants; some school-age samples; mostly Western
- **Relevance to casual behavior change**: Medium — spaced practice principles are directly relevant to self-directed learning tools (flashcard apps, quiz scheduling). The null expanding-vs-uniform finding is especially relevant for FSRS and spaced repetition tool design.
- **Red flags**: Mostly laboratory settings; generalizability to real-world learning needs caution

## Conclusions

The meta-analysis provides two complementary findings: (1) Spaced retrieval practice produces a large benefit over massed practice (bias-corrected g=0.74), confirming that spacing sessions apart improves retention substantially. (2) The specific schedule within spaced practice (expanding vs. uniform intervals) does not matter at the population level — the consensus that expanding schedules are superior is not supported by the available evidence. The authors recommend combining retrieval practice with spacing for learning optimization, but note that recommending one specific spacing schedule over another is premature.

---

## Extraction Notes

The two-subset structure is the key contribution. Subset 1 (g=0.74 corrected) confirms the well-established spacing benefit. Subset 2 (g=0.034, n.s.) is the novel and provocative result — it directly challenges the common claim that expanding schedules are superior to uniform ones, which has implications for FSRS and spaced repetition algorithm design.

For the guidebook, the practical recommendation is: space your practice (vs. massing), but do not worry about whether your spacing schedule is expanding or uniform — both work equivalently. Apps using fixed-interval (uniform) spaced repetition (e.g., every 3 days) are as effective as apps using expanding intervals (e.g., 1 day, 2 days, 4 days, 8 days).

The marginal moderator (>4 exposures may favor expanding, p=0.09) is not significant and should not drive design decisions. The finding needs replication.

Note: This meta-analysis covers only laboratory/controlled settings. The Yang et al. (2021) paper provides the classroom equivalent for retrieval practice effects.
