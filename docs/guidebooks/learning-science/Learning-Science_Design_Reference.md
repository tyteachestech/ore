# Learning Science -- Design Reference Sheet

## Section 1: Domain Summary

This domain covers cognitive learning strategies (retrieval practice, spacing, interleaving, elaboration, cognitive load management), skill development and expertise, self-regulated learning, and common learning myths. It synthesizes 44 sources (34 papers + 9 books + 1 synthesis) with 13 T1 full-text, 3 T2 enhanced, and 28 T3 standard -- including 11 meta-analyses covering thousands of primary studies. The three findings a designer must internalize: (1) current performance is anti-correlated with durable learning -- conditions that feel effective (massing, rereading) produce the worst long-term retention; (2) the critical strategy distinction is active vs. passive, not testing vs. elaboration (g = 0.095, NS); (3) interleaving is material-dependent and actively harms vocabulary learning (g = -0.39). The single most common mistake this evidence corrects: treating session-level accuracy as a proxy for learning, which leads designers to build systems that optimize for fluency rather than retention.

## Section 2: Core Effect Sizes

| Finding | Effect Size | Source | Evidence Grade | Bias Correction | Chapter |
|---------|------------|--------|---------------|-----------------|---------|
| Spacing vs. massing (applied classrooms) | d = 0.54 [0.31, 0.77] | Mawson & Kang (2025), k=22, N>3,000 | Well-established | Lab estimate d = 0.85; 36% reduction | Ch 3 |
| Retrieval practice vs. restudy | g = 0.51 | Adesope et al. (2017), k=118, N=15,427 | Well-established | vs. nothing: g = 0.93 (inflated by passive control) | Ch 2 |
| Classroom testing effect | g = 0.499 | Yang et al. (2021), k=222, N=48,478 | Well-established | 5 independent pub-bias assessments: no bias | Ch 2 |
| Interleaving -- visual discrimination | g = 0.67 [0.57, 0.77] | Brunmair & Richter (2019), k=54, N~4,136 | Well-established | No pub bias detected (Egger's test) | Ch 4 |
| Interleaving -- math (classroom RCT) | d = 0.83 | Rohrer et al. (2019), preregistered RCT | Well-established | N/A (single large trial) | Ch 4 |
| Expanding vs. uniform spacing | g = 0.034 [-0.10, 0.17], NS, I²=0% | Latimier et al. (2021), k=16, 54 effects | Well-established (null) | No bias (Egger's t=-0.44, p=.66) | Ch 3 |
| Testing vs. elaborative strategies | g = 0.095 [-0.005, 0.194], NS | Yang et al. (2021), k=25 | Well-established | N/A | Ch 2 |
| Interleaving -- vocabulary/words | g = -0.39 [-0.64, -0.14] | Brunmair & Richter (2019) | Well-established | N/A (blocking is better) | Ch 4 |
| Conceptual self-explanation | g = 0.87 [0.56, 1.18] | Bisra et al. (2018), k=13 | Moderately supported | Lab-to-applied correction ~30-36% -> ~g=0.55-0.60 | Ch 5 |
| Fill-in-the-blank SE | g = 0.90 [0.61, 1.18] | Bisra et al. (2018), k=2 | Emerging | Under-replicated | Ch 5 |
| Modality effect (overall) | d = 0.72 [0.52, 0.92] | Ginns (2005), k=43 | Moderately supported | System-paced: d = 0.93; self-paced: d = -0.14 (null) | Ch 6 |
| Metacognitive SE (rating prompts) | g = 0.19 [-0.07, 0.46], NS | Bisra et al. (2018), k=3 | Moderately supported | N/A (not significant) | Ch 5 |
| Multiple-choice SE | g = 0.24 [-0.25, 0.73], NS | Bisra et al. (2018), k=2 | Moderately supported | N/A (not significant) | Ch 5 |
| SRL training overall -> grades | g = 0.38 | Theobald (2021), k=49, N=5,786 | Moderately supported | Metacognitive subgroup: g = 0.63 vs. cognitive: g = 0.28 | Ch 8 |
| Deliberate practice -> performance | r = 0.35 (12% variance) | Macnamara et al. (2014), k=88, N=11,135 | Moderately supported | Education: 4%; Professions: <1% (NS) | Ch 7 |
| Growth mindset interventions | d = 0.08 [0.02, 0.14] | Sisk et al. (2018), k=43 | Moderately supported | Lower-achievers only: SMD = 0.11 (Yeager 2019) | Ch 9 |
| Pen vs. keyboard on learning | g = 0.04 [-0.13, 0.20], NS | Urry et al. (2021), k=8 | Moderately supported | Original d = 0.34 was underpowered | Ch 9 |

## Section 3: Design Rules (DO)

| Rule | Evidence Grade | Key Source | Chapter |
|------|---------------|-----------|---------|
| Make retrieval (self-test, recall, quiz) the default review interaction before rereading is available | Well-established | Adesope (2017); Yang (2021) | Ch 1, 2 |
| Provide corrective feedback after every retrieval attempt | Well-established | Yang (2021): g=0.537 with vs. 0.374 without | Ch 2 |
| Space review sessions across days (gap = 20-40% of RI for short targets like weeks; 5-10% for long targets like months+) | Well-established | Cepeda (2008); Mawson & Kang (2025) | Ch 1, 3 |
| Default to evidence-based strategies; do not give equal-weight choice between massing and spacing | Well-established | Kornell (2009): 72% choose wrong | Ch 1, 8 |
| Reward learning behaviors (spacing adherence, retrieval attempts) over session-level performance | Well-established | Bjork & Bjork (2020) | Ch 1, 2 |
| Classify content by task type before recommending interleaving or blocking | Well-established | Brunmair & Richter (2019) | Ch 4 |
| Block vocabulary/definitions; interleave discrimination/strategy-selection tasks | Well-established | Brunmair & Richter (2019) | Ch 4 |
| Present interleaved items in immediate succession (no time gaps within sequence) | Moderately supported | Brunmair & Richter (2019): g=0.73 immediate vs. 0.22 with gaps | Ch 4 |
| Use open-ended "explain why/how" prompts, not rating scales or MC for reflection | Moderately supported | Bisra (2018): conceptual g=0.87 vs. metacognitive g=0.19 | Ch 5 |
| Present worked examples before asking novices to solve independently | Well-established | Sweller & Cooper (1985); Carpenter (2022) | Ch 6 |
| Separate "learning mode" (process rewards) from "performance mode" (outcome rewards) | Mod. supported (principle); Preliminary (mechanism) | Sweller (1988); Winters & Latham (1996) | Ch 6 |
| Track practice quality alongside quantity (session goals, feedback, difficulty) | Moderately supported | Macnamara (2014); Ericsson (1993) | Ch 7 |
| Cap suggested session duration at 60-90 minutes; design rest as positive | Moderately supported | Ericsson (1993) | Ch 7 |
| Build plan-monitor-reflect cycle into session flow | Moderately supported | Theobald (2021): overall g=0.38; metacognitive subgroup g=0.63 vs. cognitive 0.28 | Ch 8 |
| Track session starts as primary habit metric in first 60 days | Emerging | Gardner (2022): instigation beta=0.31-0.56 | Ch 8 |
| Forgive single missed days; flag multi-day gaps | Emerging | Lally (2010): 0.29pt drop per miss | Ch 8 |
| Explain why difficulty is productive at moments of struggle | Moderately supported | Yang (2017); Pan & Rivers (2023) | Ch 1, 2, 4 |
| Target ~3 spaced retrieval attempts per item as baseline | Well-established | Yang (2021); Mawson & Kang (2025) | Ch 2, 3 |
| Offer elaborative strategies (concept mapping, self-explanation) as first-class alternatives to testing | Well-established | Yang (2021): g=0.095 NS difference | Ch 2 |

## Section 4: Anti-Patterns (AVOID)

| Anti-Pattern | Why It Fails | Evidence Grade | Key Source | Chapter |
|-------------|-------------|---------------|-----------|---------|
| Interleaving vocabulary flashcards | Blocking is better by g = 0.39; interleaving disrupts associative encoding | Well-established | Brunmair & Richter (2019) | Ch 4 |
| Using session-level accuracy as the primary progress metric | High scores after fresh study = high retrieval strength = low storage strength gains; users game by under-spacing | Well-established | Bjork & Bjork (2020); Roediger & Karpicke (2006) | Ch 1, 2 |
| Evaluating retrieval practice by immediate post-test scores | Testing hurts at 5 min, helps at 2+ days (crossover interaction); immediate metrics make effective features look broken | Well-established | Roediger & Karpicke (2006) | Ch 2 |
| Using "rate your understanding" as a learning prompt | Produces g = 0.19 (NS) -- no detectable learning benefit; 4x worse than "explain why" | Moderately supported | Bisra et al. (2018) | Ch 5 |
| Allowing frictionless collapse to massed practice | If "review now" is easier than "review in 5 days," users take the easy path and lose most of the d = 0.54 spacing benefit | Well-established | Mawson & Kang (2025) | Ch 3 |
| Omitting feedback after retrieval attempts | Loses ~30% of the testing benefit (g = 0.537 vs. 0.374) | Well-established | Yang (2021) | Ch 2 |
| Investing engineering effort in expanding-interval algorithms | g = 0.034, NS, I² = 0% across 16 studies; schedule shape is not the active ingredient | Well-established (null) | Latimier et al. (2021) | Ch 3 |
| Citing overall g = 0.42 as "the interleaving effect" | Averages across materials where it strongly helps (+0.67) and strongly hurts (-0.39); misleading | Well-established | Brunmair & Richter (2019) | Ch 4 |
| Rewarding marathon sessions or hours logged without quality signals | Beyond 80-90 min, quality degrades; practice volume explains <1% of variance in professions | Moderately supported | Ericsson (1993); Macnamara (2014) | Ch 7 |
| Using "10,000 hours" or fixed-volume milestones | Practice quantity explains 4% of variance in education, <1% in professions; quality is the driver | Well-established (debunking) | Macnamara (2014) | Ch 7, 9 |
| Building learning-style matching features | Zero experimental support for the matching hypothesis; preferences are real but do not predict outcomes | Well-established | Pashler et al. (2008) | Ch 9 |
| Presenting growth mindset as a high-impact standalone technique | d = 0.08 overall; a background belief, not an intervention | Moderately supported | Sisk (2018); Yeager (2019) | Ch 9 |
| Inserting time gaps between interleaved items within a session | Effect drops from g = 0.73 to g = 0.22 (~70% reduction); interleaving needs adjacency | Moderately supported | Brunmair & Richter (2019) | Ch 4 |
| Spacing passive re-reading and expecting benefit | Reading domain showed d = -0.11; spacing amplifies active processing, not passive exposure | Well-established | Mawson & Kang (2025) | Ch 3 |
| Displaying fixed habit-formation timelines ("21 days!") | Real range is 18-254 days (median 66); ~50% of motivated users fail; wrong for most users | Emerging | Lally et al. (2010) | Ch 8 |
| Punishing streak breaks with score resets | Single missed days = 0.29pt automaticity drop (negligible); harsh penalties work against the science | Emerging | Lally et al. (2010) | Ch 8 |
| Defaulting users into auto-pilot review mode | Execution habit does not predict frequency; automate the start, not the process | Emerging | Gardner (2022) | Ch 8 |
| Using lab effect sizes for real-world planning | Applied effects are 30-36% smaller; d=0.85 spacing is ~36% inflated vs. d=0.54 classroom | Well-established | Bartos (2023); Mawson & Kang (2025) | Ch 1, 3 |

## Section 5: Decision Trees (Consolidated)

| IF... | THEN... | Evidence | Chapter |
|-------|---------|---------|---------|
| Material is brand new and unfamiliar | Start with shorter spacing (1-2 days) and scaffolded retrieval (cued recall, fill-in-blank) | Well-established | Ch 1 |
| Material was learned >1 week ago | Use longer spacing (7+ days) and free recall before checking | Well-established | Ch 1 |
| A review feels easy and automatic | Increase the spacing interval | Well-established | Ch 1 |
| A review feels impossible (cannot retrieve anything) | Shorten interval, provide more retrieval cues | Well-established | Ch 1 |
| User wants to remember for ~1 month | Schedule review after 3-8 days | Well-established | Ch 3 |
| User wants to remember for ~1 year | Schedule review after 18-27 days | Well-established | Ch 3 |
| Choosing between expanding and uniform intervals | Use whichever is simpler; both equivalent (g = 0.034, NS) | Well-established | Ch 3 |
| Task requires distinguishing similar categories (art, species, medical images) | Interleave (mix categories within sessions) | Well-established (g = 0.67) | Ch 4 |
| Task requires choosing which strategy to apply (math problem types) | Interleave (mix problem types) | Well-established (d = 0.83) | Ch 4 |
| Task requires memorizing vocabulary, definitions, terminology | Block (group related items together) | Well-established (g = -0.39) | Ch 4 |
| Learner finds retrieval frustrating, wants concept mapping instead | Allow it -- elaborative strategies are roughly equivalent (g = 0.095, NS) | Well-established | Ch 2 |
| You want to assess learning via review prompts | Use open-ended conceptual SE: "Explain how X works" (g = 0.87) | Moderately supported | Ch 5 |
| User is learning a new skill or concept | Use learning goals, worked examples, process-focused rewards | Well-est. (goals); Preliminary (CLT mechanism) | Ch 6 |
| User is practicing a well-learned skill | Use specific performance goals and outcome-focused rewards | Well-established | Ch 6 |
| Instruction is system-paced (video, walkthrough) | Use narration + visuals (overall d = 0.72; system-paced d = 0.93) | Moderately supported | Ch 6 |
| Instruction is self-paced (text, reference) | Text + diagrams sufficient; audio adds no benefit (d = -0.14) | Moderately supported | Ch 6 |
| Skill domain is "kind" (clear rules, immediate feedback) | Structure practice with specific goals, feedback, progressive difficulty | Moderately supported | Ch 7 |
| Skill domain is "wicked" (ambiguous feedback, novel situations) | Prioritize variety, reflection, breadth over deep repetition | Moderately supported | Ch 7 |
| User rarely starts sessions on schedule | Focus on instigation habit (cue consistency, two-minute starts) | Emerging | Ch 8 |

## Section 6: Key Tensions

| Tension | What the Evidence Says | Unresolved |
|---------|----------------------|------------|
| Desirable difficulty vs. dropout risk | Best strategies (spacing d=0.54, retrieval g=0.51, interleaving g=0.34-0.67) all feel worse. 72-78% prefer less effective option. Metacognitive correction works but takes time. | How long can a voluntary system tolerate lower satisfaction before delayed benefits land? |
| Performance measurement vs. learning measurement | Current performance anti-correlates with durable learning (crossover interaction). Easy-to-measure metrics are anti-correlated with what you want. | Any metric you make prominent becomes what users optimize for. |
| Simplicity vs. content-type accuracy | Interleaving helps discrimination (g=0.67) and harms vocabulary (g=-0.39). One recommendation is wrong for one task type. | System must classify content without user friction. |
| Gamification motivation vs. cognitive interference | Goal-setting well-established (d=0.42-0.82). But performance goals may interfere with schema acquisition on novel tasks. Learning goals outperform on complex tasks. | Interference mechanism is preliminary (N=24). Learning/performance mode split is a design hypothesis. |
| User autonomy vs. strategy effectiveness | 76% use rereading; only 11% use retrieval practice. But testing barely beats other active strategies (g=0.095, NS) -- legitimate choice space within active methods. | Strong defaults supported; forced lockouts not tested. |
| Practice volume vs. quality tracking | Practice volume explains <1-4% of variance in education/professions. Quality matters more but is harder to auto-detect. | No validated auto-detection method for practice quality in consumer products. |
| Standardized scheduling vs. individual variation | Fixed 7-day intervals most effective. Habit formation ranges 18-254 days; ~50% fail. | Spacing: start standardized, adapt. Habit timeline: present as range, never fixed. |
| Immediate feedback vs. spacing integrity | Feedback amplifies testing (g=0.537 vs. 0.374). But reviewing too soon wastes spacing. | Immediate feedback within sessions; enforced gaps between sessions. Different timescales. |

## Section 7: Grep Index (for AI retrieval)

| Chapter | Title | Search Keywords |
|---------|-------|----------------|
| Ch 1 | How Memory and Learning Work | `storage-retrieval strength`, `performance-learning dissociation`, `fluency illusion`, `desirable difficulties`, `applied effects are 30-36% smaller` |
| Ch 2 | Retrieval Practice -- The Testing Effect | `testing effect`, `g = 0.51`, `testing vs. elaborative strategies`, `pretesting effect`, `feedback amplifies` |
| Ch 3 | Spacing and Distributed Practice | `distributed practice`, `expanding = uniform`, `optimal gap`, `inverted-U`, `d = 0.54` |
| Ch 4 | Interleaving | `discriminative contrast`, `interleaving harms vocabulary`, `g = -0.39`, `temporal spacing undermines interleaving`, `block-then-interleave` |
| Ch 5 | Elaboration and Self-Explanation | `conceptual self-explanation`, `fill-in-the-blank`, `metacognitive SE`, `generation effect`, `elaborative interrogation` |
| Ch 6 | Cognitive Load and Effective Instruction | `working memory`, `extraneous load`, `worked example effect`, `means-ends analysis`, `learning mode vs. performance mode` |
| Ch 7 | Practice, Expertise, and Skill Development | `deliberate practice`, `10,000-hour`, `automaticity trap`, `kind vs. wicked`, `80-90 minute ceiling` |
| Ch 8 | Self-Regulated Learning and Metacognition | `instigation habit`, `execution habit`, `habit formation curve`, `66 days`, `knowing-doing gap` |
| Ch 9 | Common Myths and Failed Approaches | `learning styles`, `pen vs. keyboard`, `growth mindset`, `keyword mnemonic`, `highlighting` |

## Section 8: Source Quick-Reference

| Source | DOI | Establishes | Tier |
|--------|-----|------------|------|
| Yang et al. (2021) | 10.1037/bul0000309 | Classroom testing effect g=0.499; dose-response; feedback moderator; format comparisons | T1 |
| Mawson & Kang (2025) | 10.3390/bs15060771 | Applied spacing d=0.54; ~3 re-exposures optimal; 7-day fixed intervals; lab-to-applied gap | T1 |
| Brunmair & Richter (2019) | 10.1037/bul0000209 | Interleaving by material type: paintings g=0.67, math g=0.34, vocabulary g=-0.39; temporal spacing moderator | T1 |
| Adesope et al. (2017) | 10.3102/0034654316689306 | Retrieval practice g=0.51 vs. restudy; g=0.93 vs. nothing | T1 |
| Latimier et al. (2021) | 10.1007/s10648-020-09572-8 | Expanding vs. uniform spacing null: g=0.034, I²=0% | T1 |
| Macnamara et al. (2014) | 10.1177/0956797614535810 | Deliberate practice 12% variance; domain moderation; measurement method effects | T1 |
| Bisra et al. (2018) | 10.1007/s10648-018-9434-x | Self-explanation by type: conceptual g=0.87 vs. metacognitive g=0.19 (NS) | T1 |
| Cepeda et al. (2008) | 10.1111/j.1467-9280.2008.02209.x | Optimal gap = 20-40% of RI at short delays, 5-10% at long delays; asymmetric gap errors | T1 |
| Bartos et al. (2023) | 10.1098/rsos.230224 | >50% of psychology meta-analyses overestimate effects; median r drops from 0.17 to 0.07 after correction | T1 |
| Theobald (2021) | 10.1016/j.cedpsych.2021.101976 | SRL training overall g=0.38 (k=49, N=5,786); metacognitive subgroup g=0.63 vs. cognitive g=0.28 for grades | T2 |
