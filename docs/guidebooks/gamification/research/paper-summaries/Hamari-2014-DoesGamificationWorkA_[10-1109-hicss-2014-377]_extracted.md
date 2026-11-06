# Does Gamification Work? — A Literature Review of Empirical Studies on Gamification

## Study Overview
- **Citation**: Hamari, J., Koivisto, J., & Sarsa, H., 2014
- **Study Type**: Systematic Literature Review (narrative; formal meta-analysis was not possible due to methodological heterogeneity)
- **Sample**: k=24 peer-reviewed empirical studies; individual study n sizes range from ~6 to 3,486 participants
- **DOI**: 10.1109/HICSS.2014.377
- **PMID**: N/A (conference proceedings — 2014 Hawaii International Conference on System Sciences)

## Key Findings

- **Finding 1 — Overall effect: gamification mostly works, but partially**: The majority of reviewed studies reported positive effects from gamification. However, no studies found all tests universally positive. Among quantitative studies: 2/24 reported all tests positive; ~13/24 reported partially positive results; 0 reported all tests non-significant; ~7/24 were descriptive only (no inferential statistics, so effects cannot be established).
  - Effect size: No quantitative pooling was possible. Results summarized narratively by outcome direction.
  - Note: This is the foundational prevalence estimate — "gamification works" but with important caveats.

- **Finding 2 — Context is a primary moderator**: Two studies on utilitarian peer-to-peer trading found gamification may not be effective in strictly rational/utilitarian service settings. E-commerce and transactional systems appear resistant. Education/learning contexts showed the most consistently positive results.
  - Effect size: Not reported quantitatively; inferred from pattern across studies.

- **Finding 3 — Novelty effect is a real concern**: Several studies noted that positive effects may not be durable. Results from gamification appear to attenuate over time, possibly due to novelty wearing off rather than a stable motivational effect. Studies of IBM's Beehive intra-organizational SNS across time confirmed this pattern — gamification had positive effects on some users for a short time.
  - Effect size: Effect on IBM Beehive: initial positive effect on contributions, diminished over time. Exact values not reported.

- **Finding 4 — Removal of gamification has detrimental effects on engaged users**: Removing gamification elements from a system harmed outcomes for users who remained engaged with it. Loss aversion from losing earned badges/points was proposed as the mechanism.
  - Source study: Thom et al. (2012), gamification removal from enterprise SNS, n=3,486 (via [37] in this review)
  - Effect size: Not quantified; pattern observation.

- **Finding 5 — User type moderates response to gamification**: Multiple studies identified distinct "player types" or behavioral patterns in how users respond to game elements. Some users competed aggressively for leaderboard rank; others were satisfied merely appearing on the leaderboard. Certain affordances (notably competition-inducing ones) were experienced negatively by a subset of users even when the average effect was positive.
  - Effect size: Not quantified.

- **Finding 6 — Points, leaderboards, and badges dominate the literature**: PBLs (Points, Badges, Leaderboards) are by far the most studied affordances. 10 affordance categories were found, but most studies tested PBLs rather than richer game elements (story, challenge, levels, feedback).
  - Breakdown: Points tested in 9 studies; Leaderboards in 10; Badges in 9; Levels in 6; Story/Theme in 6; Clear goals in 4; Feedback in 6; Rewards in 4; Progress in 7; Challenge in 8.

- **Finding 7 — Education/learning is the most-studied, most-positive context**: All education/learning studies reported positive outcomes (increased motivation, engagement, enjoyment). However, negative outcomes also noted: increased competition effects, task evaluation difficulties, and design issues.
  - Number of education studies: 9 (out of 24 total)

- **Finding 8 — Psychometric rigor is lacking**: Only one study (out of 24) used validated psychometric measurements when surveying psychological outcomes. Most psychological outcome data came from self-report surveys without validated scales.

## Effect Sizes (Raw Values)

Formal meta-analysis was not conducted. No standardized effect sizes (d, SMD, OR) are reported in this review paper. The authors explicitly state: "Since the motivational affordances, behavioral/psychological outcomes as well as the methodologies varied greatly between the studies, formal meta-analysis could not be conducted."

Individual study quantitative results as reported in the appendix table:

| Study | Context | Motivational Affordances | N | Result |
|-------|---------|--------------------------|---|--------|
| [2] Anderson et al. | Q&A website | Badges | n/a | Descriptive only |
| [4] Cheong et al. | Multiple-choice quiz software | Points, feedback, leaderboard, challenge | 76 | Descriptive only |
| [8] Denny | Online learning | Badges | 1,031 | Partially positive |
| [10] Domínguez et al. | E-learning platform | Leaderboard, badges | 195 | Partially positive |
| [11] Dong et al. | Learning Adobe Photoshop | Clear goals, challenge, feedback, levels, story | 11 | Qualitative — positive/negative mix |
| [12] Downes-Le Guin et al. | Survey | Narrative, avatars, rewards | 1,007 | Partially positive |
| [13] Eickhoff et al. | Crowdsourced relevance | Points, leaderboard, challenge | 795 | Positive (all tests) |
| [14] Farzan & Brusilovsky | Course recommender | Progress | 161 | Partially positive |
| [15] Farzan et al. | IBM Beehive SNS | Points, levels, leaderboards | 421 | Partially positive (mixed methods) |
| [16] Farzan et al. | IBM Beehive SNS | Points, levels, leaderboards | 6/n/a | Partially positive (mixed methods) |
| [17] Fitz-Walter et al. | University orientation app | Achievements, clear goals | 26 | Descriptive only |
| [18] Flatla et al. | Calibration tasks | Challenge, progress bar, story, levels, rewards | 12 | Descriptive only |
| [20] Grant & Betts | Q&A website | Badges | 4/n/a | Descriptive only |
| [21] Gustafsson & Bång | Energy conservation | Story, challenge, levels, feedback, leaderboards | 6 | Descriptive only |
| [22] Hakulinen et al. | Online learning environment | Badges | 281 | Partially positive |
| [23] Halan et al. | Virtual patient training | Leaderboard, narrative, deadline | 20+10 control | Partially positive (mixed methods) |
| [25] Hamari | Peer-to-peer trading | Badges, clear goals | 3,234 | Partially positive |
| [27] Hamari & Koivisto | Exercise social network | Badges, leaderboards, levels | 107 | Partially positive |
| [32] Jung et al. | Computer-mediated idea generation | Goals, feedback | 260 | Partially positive |
| [33] Li et al. | AutoCAD tutorial | Story, clear goals, feedback, challenge, rewards | 14 | Partially positive (mixed methods) |
| [34] Montola et al. | Mobile photo sharing | Achievements, points | 20 | Qualitative — positive/negative mix |
| [36] Smith & Baker | Library service | Story, rewards | 388/52 | Partially positive |
| [37] Thom et al. | IBM enterprise SNS (removal) | Removal of points, leaderboard, levels | 3,486 | Positive (all tests — removal had detrimental effect) |
| [41] Witt et al. | Online idea competition | Points, leaderboards | 30 | Descriptive only |

## Mechanisms & Moderators

- **Mechanism 1 — Motivational affordances → gameful experience → behavioral outcomes**: Gamification works by implementing motivational affordances that invoke intrinsically motivating psychological experiences, which then produce behavioral outcomes. The chain is: affordance → psychological outcome → behavioral outcome.

- **Mechanism 2 — Loss aversion sustains engagement**: Users who have accumulated badges or points may remain engaged due to loss aversion (reluctance to lose accumulated status), not purely from intrinsic motivation. This explains why removing gamification harms engaged users.

- **Mechanism 3 — Extrinsic rewards undermine intrinsic motivation (SDT-derived)**: Self-determination theory predicts that outside pressures (extrinsic rewards) undermine intrinsic motivations. Gamification aimed at intrinsic experience may be undermined by poorly designed extrinsic reward structures.

- **Moderator 1 — Service type (utilitarian vs. hedonic)**: Utilitarian services (e.g., e-commerce, peer-to-peer trading) appear resistant to gamification. Users in rational/transactional contexts may not engage with game elements because their goal orientation is economic optimization rather than exploration or enjoyment.
  - Evidence: Hamari (2013) [25], e-commerce gamification partially positive at best; largest study in review.

- **Moderator 2 — Usage frequency**: Sporadic use may be incompatible with persistent gameful affordances. Users who do not spend enough time within a service may not develop interest in the game elements.

- **Moderator 3 — User type / player type**: Distinct behavioral archetypes respond differently to the same affordances. Competitive users, social users, and achievers differ in what motivates them. Competition-inducing affordances can be experienced negatively by users who are not competitively oriented.

- **Moderator 4 — Voluntariness**: Theory of planned behavior suggests that task voluntariness is an antecedent of attitude formation and behavior. Compelled participation may reduce gamification effectiveness.

- **Moderator 5 — Time / novelty**: Short experiment timeframes may inflate positive results due to novelty effects. The review explicitly flags this as a validity threat in most included studies.

## Study Design Details

- **Intervention**: Narrative review of 24 peer-reviewed empirical studies on gamification, identified from 8 databases via structured search and reference chaining.
- **Inclusion criteria**: (1) peer-reviewed full paper, (2) empirical study, (3) research methods explicated, (4) clearly identifiable motivational affordances studied, (5) gamification (not full game) as the subject.
- **Comparison condition**: Not applicable (this is a review, not a primary study).
- **Study types included**: Quantitative (experiments, log data analyses, quantitative questionnaires) = 18; Qualitative (interviews, observations) = 2; Mixed methods = 5.
- **Contexts covered**: Commerce (1), Education/learning (9), Health/exercise (1), Intra-organizational systems (4), Sharing (1), Sustainable consumption (1), Work/crowdsourcing (6), Innovation/ideation (1).
- **Key design weakness**: Formal meta-analysis could not be conducted due to heterogeneity in affordances, outcomes, and methods across studies. This is a qualitative synthesis.

## Limitations

- **No effect sizes extractable**: Because formal meta-analysis was impossible, no pooled estimates exist. The "gamification works" conclusion is based on vote-counting (direction of results), which is a methodologically weak approach to synthesis.
- **Small samples in primary studies**: Several reviewed studies had n around 20 or fewer, severely limiting inferential power.
- **Lack of validated psychometric measures**: Only 1 of 24 studies used validated instruments for psychological outcome measurement; most relied on ad hoc surveys.
- **No control groups in some experiments**: Several experimental studies lacked proper comparison conditions.
- **Multiple affordances tested together**: Most studies bundled PBLs, making it impossible to isolate the effect of individual game elements.
- **Novelty effect confound**: Most studies had very short timeframes; novelty may have inflated positive results systematically.
- **Unclear reporting in primary studies**: The review notes poor results reporting clarity across included papers.
- **No multi-level models**: No study measured the full chain from motivational affordances → psychological outcomes → behavioral outcomes simultaneously.
- **Scope limitation**: Only studies explicitly using "gamification" terminology were included; adjacent literature (intrinsic motivation, persuasion, behavior change tech) was excluded, which may mean relevant evidence was missed.
- **Publication bias**: Unstated, but likely present — studies showing null results are underrepresented in conference proceedings.
- **2014 cutoff**: The field has advanced substantially since publication; these 24 studies are not representative of the current evidence base.

## Population Scope Assessment

- **Population**: Mixed — varies by included study: students, office workers, online community members, exercise app users, crowdworkers
- **Relevance to casual behavior change**: Medium — the review establishes the general framework and signals context-dependence, but the primary studies are too heterogeneous and dated for precise design guidance
- **Red flags**: Several studies involve very small n (6–26), which limits any generalizations. Intra-organizational studies (IBM Beehive) involve mandatory-use contexts that do not translate to voluntary consumer apps.

## Conclusions

The review concludes that gamification generally produces positive effects, but the majority of positive results are partial rather than universal. The two most important qualifiers are (1) context: gamification is less effective in utilitarian, transactional service settings and more effective in educational and social contexts; and (2) user qualities: different player types respond differently to the same affordances, meaning one-size-fits-all gamification is unlikely to work. The authors caution that novelty effects may explain short-term positive findings and that the field needed more rigorous longitudinal studies with validated measures and proper control groups.

---

## Full Moderator/Subgroup Table

No formal moderator analyses or subgroup analyses were conducted (this is a narrative review, not a statistical meta-analysis). The following table reconstructs the contextual patterns reported qualitatively:

| Moderator | Subgroup | Direction of Effect | k (studies) | Notes |
|-----------|----------|---------------------|-------------|-------|
| Service context | Education/learning | Positive | 9 | Negative outcomes also noted (competition, design issues) |
| Service context | Intra-organizational | Mostly positive, short-term | 4 | IBM Beehive studies; effects faded |
| Service context | Commerce/utilitarian | Partially positive to null | 1-2 | Explicitly flagged as resistant context |
| Service context | Health/exercise | Partially positive | 1 | Exercise SNS; social motives matter |
| Service context | Work/crowdsourcing | Positive | 6 | Eickhoff et al. fully positive |
| User type | Competitive users | Positive (competition-oriented affordances) | Multiple | Leaderboard engagement |
| User type | Non-competitive users | Negative (competition-oriented affordances) | Multiple | Competition felt aversive |
| Usage pattern | Frequent users | Positive | Inferred | More exposure to affordances |
| Usage pattern | Sporadic users | Null | Inferred | Insufficient time with service |
| Time | Short-term (novelty period) | Positive | Multiple | Novelty effect suspected |
| Time | Long-term | Attenuated | 3 (IBM Beehive series) | Positive effects faded post-novelty |
| Affordance removed | After engagement built | Negative (harm from removal) | 1 | Thom et al.; loss aversion mechanism |

No numerical effect sizes available for any subgroup.

## Quotable Passages

> "The literature review suggests that, indeed, gamification does work, but some caveats exist. The majority of the reviewed studies did yield positive effects/results from gamification. However, as can be seen from Table 4, most of the quantitative studies concluded positive effects to exist only in part of the considered relationships between the gamification elements and studied outcomes." (Section 5, Discussion)

> "These observations suggest that some underlying confounding factors exist. Most prominently, the studies bring forth two main aspects: 1) the role of the context being gamified, and the 2) qualities of the users." (Section 5, Discussion)

> "Triangulating from self-determination theory as well as from the traditional definitions of games, both suggest that outside pressures (such as extrinsic rewards) undermine intrinsic motivations and hence would in essence undermine gamification which is an attempt to afford for the emergence of intrinsic motivations." (Section 5.2)

## Boundary Conditions & Population Caveats

- **Applies to**: General digital service contexts where users voluntarily engage; educational platforms; social/community applications; health behavior apps with social components; work platforms with discretionary participation
- **Does NOT apply to**: Strictly transactional/utilitarian services (e-commerce, financial tools) — evidence suggests resistance; contexts with compelled/mandatory participation; situations requiring long-term sustained behavior change (novelty effect caveat)
- **Unknown/untested**: Purchase behavior (no study in the review tested gamification → purchase); long-term effects beyond novelty period (very few studies measured this); isolated individual affordance effects (most studies bundled PBLs together); populations outside students and office workers; mobile/consumer app contexts (underrepresented in 2014 literature)

---

## Extraction Notes

This is the most-cited gamification review paper (Hamari et al., 2014) and is foundational for the field, but it has significant limitations as an evidence source:

1. **Vote-counting, not meta-analysis**: The "gamification works" finding is based on counting how many studies found positive results — a known-weak synthesis method. It cannot estimate effect magnitude.

2. **2014 vintage**: The field has expanded enormously since then. Treat this as the conceptual framework paper (motivational affordances → psychological outcomes → behavioral outcomes) rather than the quantitative evidence base.

3. **PBL dominance is a literature artifact**: The heavy focus on points/badges/leaderboards in included studies may reflect availability bias in what researchers studied, not which elements are most effective.

4. **High value for NotionRPG as framework paper**: The three-part structure (affordances → psychological outcomes → behavioral outcomes) and the two key moderators (context type, user type) are directly actionable for design guidance. The context-dependence finding (utilitarian vs. hedonic) is particularly relevant for Notion-based habit tracking systems, which may sit closer to the utilitarian end.

5. **Cross-reference with**: Mazeas-2022 (physical activity gamification meta-analysis), Sailer-2020 (learning gamification meta-analysis), and Rodrigues-2022 (novelty effect study) for more recent and quantitatively rigorous evidence that builds on this review's framework.
