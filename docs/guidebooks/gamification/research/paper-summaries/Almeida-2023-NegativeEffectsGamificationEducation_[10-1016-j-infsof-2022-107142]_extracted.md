---
title: "Negative Effects of Gamification in Education Software: Systematic Mapping and Practitioner Perceptions"
authors: [Almeida, C., Kalinowski, M., Uchôa, A., Feijó, B.]
year: 2023
type: systematic-review
population: student
sample_size: 87
key_claims:
  - "Badges, leaderboards, competitions, and points were the GDEs most frequently cited as causing negative effects across 87 primary studies"
  - "Top 5 negative effects on students: lack of effect, worsened performance, demotivation, lack of understanding, and irrelevance of the GDE"
  - "Leaderboards are specifically linked to demotivation, discouragement, and gaming-the-system behavior in users who fall behind"
  - "Badges risk triggering the overjustification effect: shifting user focus from behavior to reward-collection, potentially reducing intrinsic motivation"
  - "Mandatory gamification is consistently associated with negative outcomes across multiple primary studies"
  - "4 PhD-level developers (10-21 years experience) were largely unaware of documented negative effects for badges, leaderboards, and points before the study"
  - "75 student-facing negative effects and 77 GDEs each appeared in only one paper, indicating a long tail of idiosyncratic failure modes"
doi: "10.1016/j.infsof.2022.107142"
pmid: unknown
evidence_grade: emerging
scope_flag: include-with-caution
inflation_flag: none
addresses_questions: [Q4, Q7, Q9]
---

# Negative Effects of Gamification in Education Software: Systematic Mapping and Practitioner Perceptions

## Study Overview

- **Citation**: Almeida, C., Kalinowski, M., Uchôa, A., & Feijó, B. (2023)
- **Study Type**: Systematic Mapping Study + Qualitative Focus Group
- **Sample**: k=87 papers (mapping); n=4 practitioners (focus group)
- **DOI**: 10.1016/j.infsof.2022.107142
- **PMID**: Not available

## Key Findings

- **Finding 1 — Most problematic GDEs**: Badges, leaderboards, competitions, and points were the game design elements (GDEs) most frequently cited across papers as causing negative effects. These four elements dominate the literature on gamification harms, likely because they are also the most commonly deployed elements overall.

- **Finding 2 — Top negative effects on students/users**: The five most frequently reported negative effects were (in order): lack of effect (gamification produced no measurable change), worsened performance, demotivation/lack of motivation, lack of understanding, and irrelevance of the GDE to users. Cheating and "gaming the system" were also recurrent, typically driven by competitive reward structures.

- **Finding 3 — Leaderboards cause discouragement and unfair competition**: Leaderboards specifically are linked to demotivation, discouragement, dislike of competition, and "gaming the system." Casual users who fall far behind high-performing players tend to disengage rather than improve. Quantitative-only rankings are perceived as unfair when life circumstances (illness, time zones) prevent consistent participation.

- **Finding 4 — Badges and rewards risk undermining intrinsic motivation**: Badges can reduce intrinsic motivation (overjustification effect) and shift focus toward reward-collection behavior rather than the underlying learning or behavior change goal. Developers in the focus group were largely unaware of this risk prior to the study.

- **Finding 5 — Competitions can demotivate casual participants**: When frenetic/experienced players set a high performance bar, casual players report it as "simply demotivating" to compete. This is a structural design problem, not a player-attitude problem. Cooperative competition (teams pursuing shared goals) was perceived as more inclusive than individual rankings.

- **Finding 6 — Novelty effect**: Several papers identified positive effects that proved temporary — once user novelty wore off, the gamification lost its impact. This is coded as a negative effect because the cost of design and implementation may outweigh short-lived benefits.

- **Finding 7 — Teacher/maintainer burden**: Gamified education software creates significant additional burdens on teachers and software maintainers: general technical challenges (bugs, hardware/software difficulties) were cited in 7 papers; extra human effort (time, money, people) in 5 papers; engineering problems with LMS platforms in 2 papers.

- **Finding 8 — Developer unawareness**: Focus group practitioners (4 PhD-level developers with 10–21 years of experience) were unaware of many documented negative effects before the study. All 4 strongly agreed that this information would be useful in practice. The majority were "mostly unaware" of risks for badges, leaderboards, and points specifically.

## Effect Sizes (Raw Values)

No quantitative effect sizes are reported. This is a systematic mapping study that catalogues findings across 87 primary studies — it does not aggregate effect magnitudes.

Frequency counts from the mapping:

- Papers reporting negative effects involving **badges**: highest count among all GDEs (exact n not provided in text; appears to be ~15–20 papers based on Figure 2 description)
- Papers reporting negative effects involving **leaderboards**: second highest
- Papers reporting negative effects involving **competitions**: third
- Papers reporting negative effects involving **points**: fourth
- **77 additional GDEs** were each cited by only one paper

Negative effect frequency (student-facing):

- Lack of effect: most cited
- Worsened performance: second
- Demotivation / Lack of motivation: third
- Lack of understanding: fourth
- Irrelevance: fifth
- Cheating / Gaming the system: also frequent
- **75 other student-facing effects** were each cited only once

Teacher/maintainer effects (cited more than once):

- Technical challenges (bugs): 7 papers
- Extra human effort: 5 papers
- LMS engineering problems: 2 papers
- Other effects: 7 papers (cited once each)

Study type breakdown of the 87 papers:

| Study Type | Count |
|---|---|
| Case Study & Survey (combined) | 37 |
| Controlled Experiment & Survey (combined) | 30 |
| Controlled Experiment only | 9 |
| Case Study only | 6 |
| Survey only | 5 |

## Mechanisms & Moderators

- **Mechanism 1 — Competitive structures create perverse incentives**: Competitive GDEs (leaderboards, badges, points, competitions) motivate users to win, not to learn. When the system is gameable, users game it. When the gap to leaders is too large, users quit.

- **Mechanism 2 — Overjustification / intrinsic motivation displacement**: Badges and external rewards can shift user orientation from intrinsic interest (learning, improving) to extrinsic reward-seeking. Once rewards are removed or exhausted, engagement drops.

- **Mechanism 3 — Novelty decay**: Gamification elements may produce engagement spikes that fade as novelty wears off. The mapping study codes this as a negative effect because the underlying behavior change may not persist.

- **Moderator 1 — Player profile (competitive vs. collaborative)**: Leaderboards and rankings work positively for competitive-profile users but negatively for collaborative-profile users. Focus group confirmed this: "it depends a lot on the players' profile." No quantitative moderator analysis available across the 87 papers.

- **Moderator 2 — Design quality and validation mechanisms**: Cheating and "gaming the system" are significantly mitigated by validation mechanisms (e.g., upvote/downvote verification, automated code testing). The same GDE can be harmful or benign depending on whether the system catches and penalizes gaming behavior.

- **Moderator 3 — Mandatory vs. voluntary participation**: Several included papers noted that mandatory gamification loses its "fun value" and becomes counterproductive. Gamified activities should be opt-in.

- **Moderator 4 — Context specificity**: Focus group participants emphasized that the same GDE can be positive in one context and negative in another. Negative effects are not inherent to the element but to the fit between element, audience, and context.

## Study Design Details

- **Mapping search**: Scopus database search (search string: gamification × education × negative) + backward and forward snowballing via Publish or Perish (Scopus + Google Scholar). Date range: through end of 2020.
- **Filtering**: 3,458+ papers screened; 87 included after three-phase exclusion (language, topic, empirical quality, peer-review, short papers, grey literature, non-digital GDEs)
- **Data extraction**: Open coding following Strauss & Corbin guidelines; inter-rater discrepancies resolved by consensus among 3 authors
- **Focus group**: 4 participants (PhD-level software developers, 10–21 years experience), single 90-minute online session via Zoom, conducted January 24, 2022; qualitative discussion structured around GDE groups and TAM-based adoption questions
- **Focus group platform**: MURAL collaborative canvas with structured awareness voting (4-point scale) and qualitative comment capture

## Limitations

- **Incomplete snowballing saturation**: A full second round of backward + forward snowballing would have required analyzing 5,600+ additional papers. Authors stopped early; some papers were likely missed, though they believe the 87-paper set is representative.
- **Single focus group session**: Four participants is appropriate for online focus groups, but authors explicitly caution against generalizing beyond preliminary practitioner insights. A single session cannot produce generalizable findings.
- **Focus group population**: Participants were from one software project (VazaZika, a public-health gamified app). Their experience may not represent commercial, educational, or consumer-facing gamification contexts.
- **Publication bias toward positive results**: Papers reporting negative results attract fewer citations and are less likely to be published. The actual prevalence of negative effects is probably higher than the 87-paper mapping captures.
- **No grey literature**: Industry case studies and product post-mortems excluded. May underrepresent practitioner-discovered failure modes.
- **Coding is associative, not causal**: Authors deliberately avoided claiming that GDEs *cause* the negative effects; they report *associations* from papers. Many studies grouped multiple GDEs together, making attribution to individual elements difficult.
- **Education-focused**: All 87 papers are in educational/learning contexts. Direct generalizability to habit-tracking or productivity gamification requires additional inference.

## Population Scope Assessment

- **Population**: Students (primary through university), with some teacher/administrator data. Computer science and medicine were the most-studied fields. Seven papers explicitly covered middle-school contexts.
- **Relevance to casual behavior change**: Medium. The mechanisms (overjustification, competitive demotivation, novelty decay, leaderboard discouragement) are theoretically generalizable to any gamified app, but all primary studies were in formal educational settings. No habit-tracking or personal productivity apps included.
- **Red flags**: Not a clinical population; no addiction or compulsive disorder context. However, note that the competitive negative effects (discouragement, cheating) are most relevant to high-stakes or socially comparative gamification — less relevant to personal, private habit tracking where there is no visible ranking.

## Conclusions

The authors conclude that gamification in education is genuinely double-edged: properly applied, it improves learning outcomes, but it is also reliably capable of worsening performance, eliminating intrinsic motivation, creating cheating incentives, and discouraging casual participants. Badges, leaderboards, competitions, and points — the four most commonly deployed GDEs — are also the four most frequently associated with negative outcomes. Critically, developers building gamified software are often unaware of these documented risks. The authors argue that a practitioner-facing catalog of GDE-to-negative-effect mappings would be a valuable design tool, and that trade-off discussions around GDE selection should be informed by both expected benefits and documented harms.

## Named Frameworks

### GDE Taxonomy (Deterding et al., 2011)

Components: Avatars, Badges/Achievements, Challenges, XP, Feedback, Goals, Leaderboards, Points, Quizzes, Rankings, Rewards, Virtual Currencies

| GDE | Associated Negative Effects |
|---|---|
| Badges | Lack of effect, irrelevance, worsened performance, loss of intrinsic motivation |
| Leaderboards | Demotivation, discouragement, dislike of competition, gaming the system, worsened performance |
| Competitions | Cheating, extra effort, irrelevance, lack of effect, lack of understanding, worsened performance |
| Points | Dislike of competition, lack of effect, time pressure |
| Quizzes | Lack of effect, lack of motivation, frustration |
| Feedback | Lack of effect, worsened performance (when excessive/intrusive) |

---

## Extraction Notes

This is a systematic mapping paper, not a meta-analysis or RCT — no pooled effect sizes exist. Its value for NotionRPG guidebook work is primarily as a structured catalogue of failure modes for gamification design, organized by element type. The finding that developers are routinely unaware of documented negative effects is particularly relevant for any chapter discussing responsible gamification design.

Key usable insights for the guidebook:

1. Leaderboards reliably demotivate users who are not already competitive in orientation — consider optional or private-only implementations.
2. Badge-heavy systems risk shifting focus from behavior to reward collection — distinguish badges as milestone markers vs. ongoing performance signals.
3. Mandatory gamification is consistently associated with negative outcomes across multiple primary studies — make elements opt-in.
4. The novelty effect is a documented concern: initial engagement spikes from gamification may not reflect durable behavior change.
5. Cooperative competition (team vs. team, or team toward a shared goal) was perceived as more motivating and less demotivating than individual rankings.

No conflict of interest disclosures found in the paper.

---

<!--
## Source Classification Notes

### Study Type
Systematic mapping study (k=87 papers) combined with a single qualitative focus group (n=4). Classified as `systematic-review` rather than `meta-analysis` because it uses open coding / frequency counting rather than statistical pooling of effect sizes. This is the correct classification per the pipeline vocabulary even though the authors label their method a "systematic mapping study."

### Population Relevance Assessment
Medium relevance to NotionRPG's target population. All 87 primary studies were conducted in formal educational settings (schools, universities) with student participants. The mechanisms identified — overjustification, competitive demotivation, novelty decay, leaderboard discouragement — are theoretically domain-general and applicable to gamified productivity or habit-tracking apps. However, no primary studies in the mapping involved self-directed adult users, habit-tracking, or personal productivity tools. Transfer of findings requires additional inference. The competitive-demotivation findings are most relevant when NotionRPG includes social or comparative features; less relevant for private, self-only habit tracking.

### Inflation Flags
`none` — This paper documents *negative* effects of gamification, which is the opposite direction of inflation. If anything, the authors note that publication bias likely *understates* the true prevalence of negative effects. No methodological inflation concerns apply.

### Questions Addressed
- **Q4** (intrinsic vs. extrinsic motivation, overjustification risk): Primary evidence source. Provides systematic mapping of badge-related intrinsic motivation loss and developer unawareness of the overjustification effect.
- **Q7** (for whom does gamification work / fail): Primary evidence source. Moderator analysis (competitive vs. collaborative player profile, mandatory vs. voluntary participation) directly addresses differential effectiveness.
- **Q9** (failure conditions and counterproductive effects): Primary evidence source. The paper's central contribution is a structured taxonomy of GDE-to-negative-effect associations — the most comprehensive available in the educational gamification literature.

### Scope Flag Rationale
`include-with-caution`: Include because the failure-mode taxonomy and overjustification evidence are highly relevant to NotionRPG design decisions. Caution flag because (a) all primary studies are in educational contexts with student populations, not adult self-directed behavior change, and (b) the focus group is too small and homogeneous to generalize practitioner-awareness findings. Claims should be attributed to the educational gamification literature specifically, not gamification in general.
-->
