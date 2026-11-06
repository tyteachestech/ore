---
title: "The Power of Feedback"
authors: [Hattie, J., Timperley, H.]
year: 2007
type: meta-analysis
population: student
sample_size: 6972
key_claims:
  - "Meta-analysis of 196 studies (6,972 effect sizes): feedback had average d=0.79, among the most powerful influences on learning"
  - "Feedback effect sizes ranged widely from strongly negative to strongly positive — feedback can harm performance as well as help it"
  - "Task-level and process-level feedback are more effective than person-level praise (e.g., 'good job') which rarely improves performance"
  - "Feedback answers three questions: Where am I going? How am I going? Where to next?"
  - "Self-regulation feedback (enabling learner control over their own process) transfers most to new contexts"
  - "Praise and reward tied to personal traits is among the least effective feedback forms"
doi: "10.3102/003465430298487"
pmid: "unknown"
evidence_grade: foundational
scope_flag: include-with-caution
inflation_flag: none
---

# The Power of Feedback

## Study Overview
- **Citation**: Hattie, J. & Timperley, H. (2007). *Review of Educational Research*, 77(1), 81-112.
- **Study Type**: Narrative review + meta-analysis synthesis
- **Sample**: 196 studies, 6,972 effect sizes; educational/learning populations (primarily classroom)
- **DOI**: 10.3102/003465430298487
- **PMID**: Not available

## Key Findings

- **Overall effect**: Feedback is among the most powerful influences on learning performance. Average effect size d=0.79 across 196 studies. However, variance is enormous — feedback can also reduce performance. The average masks a bimodal reality.

- **Four feedback levels**: The authors distinguish feedback operating at four levels:
  1. **Task level** — correctness of specific task execution ("you held the needle wrong"). Common, effective for correcting errors on simple tasks.
  2. **Process level** — underlying strategies and processes needed to complete a task. Enables transfer to other tasks.
  3. **Self-regulation level** — feedback on the learner's own monitoring and self-direction. Gives the learner agency over their process. Highest transfer.
  4. **Self/person level** — praise or criticism directed at the person rather than the work ("good job!", "you're talented"). Most common, least effective for improving performance.

- **Task-focused > person-focused**: Feedback tied to specific tasks and processes outperforms generic personal praise. Rewarding or punishing general personal characteristics is ineffective for improving performance.

- **The three feedback questions**: Effective feedback answers all three:
  - *Feed up*: Where am I going? (Goal clarity)
  - *Feed back*: How am I going? (Current status vs. goal)
  - *Feed forward*: Where to next? (Next steps)

- **Prerequisite: goal must be established first**: Feedback should only be delivered after the learner understands the desired goal. Without goal context, instruction is more appropriate than feedback.

- **Timing and context matter**: Experience of the recipient, confidence in task success (self-efficacy), and timing of delivery all moderate feedback effectiveness. No single rule applies universally.

## Effect Sizes (Raw Values)

- **Overall feedback effect**: d=0.79 (196 studies, 6,972 effect sizes)
- Range: strongly negative to strongly positive (high heterogeneity — specific I^2 not reported in available text)
- No per-level effect sizes available in the retrieved source file (Dutch summary only; full paper reports level-specific breakdowns)

Note: Effect reported as significant with high average, but no per-condition CIs were available in the source file reviewed. Full paper reports level-specific breakdowns that are frequently cited as: task-level > process-level > self-regulation-level >> person/praise-level.

## Mechanisms & Moderators

- **Mechanism**: Feedback reduces the gap between current performance and a goal. Effectiveness depends on whether the recipient uses the information to close that gap.
- **Moderator — feedback level**: Task and process feedback reduce error; praise does not systematically improve performance.
- **Moderator — goal clarity**: Feedback is ineffective if the goal has not been established. Goal-setting is a prerequisite, not a parallel track.
- **Moderator — recipient self-efficacy**: The learner's belief in their ability to complete the task influences how they interpret and use feedback.
- **Moderator — timing**: When feedback is delivered relative to performance matters. Specifics vary by task type.
- **Mix of levels**: A combination of task-focused, process-focused, and self-regulation feedback has the highest probability of changing behavior.

## Study Design Details

- **Type**: Theoretical model + meta-analytic review of existing literature (not a new primary study)
- **Domain**: Educational learning (classroom, medical training); not UI/software contexts
- **Scope note**: Authors explicitly note findings are primarily based on classroom learning and may be less applicable to workplace learning contexts. Extrapolation to UI/software feedback is interpretive.

## Limitations

- Source file is a Dutch-language secondary summary (referaat), not the full paper — some quantitative details are paraphrased or absent
- Classroom learning context; generalizability to software UI feedback is by analogy, not direct evidence
- High heterogeneity in effect sizes means the average d=0.79 is not a reliable single number — context dependency is the main finding
- No effect sizes broken out by feedback level in the available summary
- No publication bias assessment reported in available text
- Population is students (K-12, medical education), not general adults or software users

## Population Scope Assessment

- **Population**: Student / learner (classroom + medical training)
- **Relevance to UI feedback design**: Medium — the theoretical model (four levels, three questions) maps well onto UI feedback design by analogy; effect sizes should not be applied directly
- **Red flags**: Not a UX/software study. All empirical claims are from educational settings. Use the framework, not the numbers, for UI design guidance.

## Conclusions

Hattie and Timperley argue that feedback is one of the most powerful influences on performance, but only when it operates at the right level and in the right context. Praise is ineffective; task-specific and process-specific feedback is effective. Effective feedback answers three questions — where am I going, how am I going, and where to next — and requires that a goal be established before feedback is delivered. The enormous variance in effect sizes is itself the key finding: feedback is not uniformly helpful.

## Named Frameworks (if applicable)

- **The Feedback Model (Hattie & Timperley)**
  - Components: Four feedback levels (task, process, self-regulation, self/person) x Three feedback questions (feed up, feed back, feed forward)
  - Research alignment:
    - Task level -> error correction, immediate performance
    - Process level -> strategy improvement, near transfer
    - Self-regulation level -> metacognition, broad transfer
    - Person level -> engagement/affect, NOT performance improvement
    - Feed up -> goal clarity (prerequisite)
    - Feed back -> current status signal
    - Feed forward -> next-step guidance

---

## Extraction Notes

**Source file caveat**: The retrieved file is a 2-page Dutch secondary summary published in *Tijdschrift voor Medisch Onderwijs* (2008), not the full 32-page Review of Educational Research paper. The framework and qualitative findings are accurately represented in this summary. The d=0.79 figure and 196 studies / 6,972 effect sizes are widely cited and consistent across secondary literature. Per-level effect sizes from the full paper are well-known in educational research but were not available in the retrieved text and are therefore not included here to avoid fabrication.

**UX relevance**: Despite being an educational research paper, this is the most cited theoretical model for feedback design and is routinely applied in UX/product design literature. The four-level model and three-question framework are directly usable for classifying UI feedback patterns:
- Error messages = task-level feedback
- Inline guidance / progressive disclosure = process-level feedback
- Progress indicators, completion percentages = feed back (current status)
- Next-step prompts, empty state CTAs = feed forward
- Generic success toasts ("Done!") = person-level feedback (lowest value)

**Recommendation for guidebook**: Use the framework, not the effect sizes. Flag clearly that this is educational research applied by analogy to UI contexts. The three-question model is an excellent organizing structure for a chapter on system feedback/status.
