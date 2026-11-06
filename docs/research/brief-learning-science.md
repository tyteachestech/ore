# Evidence Brief: Personal Mac Learning App (capture, read, highlight, note, AI quiz, spaced review)

Prepared 2026-10-09. Purpose: tell the planner which activities the science supports, so the app ships only what works.

## Sources and grading

- **Primary source:** Tyler's guidebook library, `~/Desktop/library/guidebooks/`.
  - `learning-science/Learning-Science_Design_Reference.md` and the master `Learning Science.md`. These synthesize 44 sources, including 11 meta-analyses.
  - Also used: `gamification/Gamification.md`, `ux-ui-design/UX and UI Design.md`, `teaching-guidebook/Teaching.md` and `psychology-of-success/Psychology-of-Success_Design_Reference.md`.
- **Book library:** this added little beyond the guidebooks. The only extra named frameworks are Fogg's ABC / Anchor recipe (Tiny Habits), Make It Stick's "generation" and "reflection" ideas, and Ultralearning's Feynman technique. All three are restatements of evidence already covered here.
- **Web:** used only where the library is silent. Web-sourced primaries are marked **[web]**. Each one was checked against an abstract or a reputable summary, not the full text, so verify exact numbers before quoting them in public.

Evidence grades follow the library's labels:

| Grade | Meaning |
|---|---|
| **Well-established** | Multiple meta-analyses, replicated |
| **Moderately supported** | A meta-analysis or several RCTs, with caveats |
| **Emerging** | Small k or few studies |
| **Preliminary / Inference** | A single study, or a design inference from adjacent evidence |
| **Practitioner** | Expert heuristic with no controlled test |

**One calibration rule applies to every number below.** Applied (real-world) effects run about 30-36% smaller than lab effects. For example, spacing is d = 0.85 in the lab but d = 0.54 in classrooms (Mawson & Kang 2025; Bartos 2023). Plan with the applied number.

**The single most important framing (Well-established):** the big gain comes from moving from passive to active study. Which active strategy you pick matters much less. Testing vs. elaborative strategies (concept mapping, self-explanation) differ by g = 0.095, which is not significant (Yang et al. 2021, k = 25). Passive activities are the ones that fail: rereading, reviewing highlights, and spaced rereading (Reading domain: d = -0.11).

---

## 1. Highlighting

| Finding | Effect | Grade | Source |
|---|---|---|---|
| Learner highlighting, overall | g = 0.30 | Moderately supported | Ponce, Mayer & Mendez 2022 (36 studies, 85 effects) |
| Learner highlighting → memory | g = 0.36 | Moderately supported | Ponce 2022 |
| Learner highlighting → comprehension | g = 0.20, **ns** | Moderately supported | Ponce 2022 |
| No main effect on literal comprehension, inference, transfer or calibration | — | Moderately supported | Mason et al. 2024 |
| **Reviewing** previously highlighted material | g = -0.06, **ns** | Moderately supported | Ponce 2022 |
| **Inappropriate** highlighting (marking the wrong things) | **g = -0.70** | Moderately supported | Ponce 2022 |
| Instructor-provided highlighting (pre-marked key content) | g = 0.44 (memory and comprehension) | Moderately supported | Ponce 2022 |
| Highlighting **with training** in selection (main idea vs. detail) | g = 1.02, k = 4 | Emerging | Ponce 2022 |
| Highlighting **plus** note-taking or a graphic organizer | g = 0.82, k = 3 | Emerging | Ponce 2022 |
| Light highlighters beat heavy highlighters | — | Preliminary | Yue, Storm, Kornell & Bjork 2015 **[web]** |
| Signaling (color cues, headings) → retention vs. transfer | g = 0.53 vs. 0.33; flashing cues harm transfer | Moderately supported | Schneider et al. 2018, via Teaching guidebook |
| Overall utility rating | "Low" | Well-established | Dunlosky et al. 2013 |

**Does highlighting help by itself?** Barely, and only for recognizing or recalling the marked content. It does not help understanding.

**When does it help?**
- When it is selective.
- When it is accurate.
- When it is coupled with a second, generative step.

**"Active" highlighting with a prompt attached.** No study tests the exact UX of "highlight, then a prompt appears." The closest evidence is highlighting + note-taking/organizer (g = 0.82, k = 3). Mechanistically, a prompt converts passive selection into generation, which is the active ingredient everywhere else in this literature (self-explanation, Section 2). Treat it as **Emerging/Inference**: promising, not proven.

**Design implications:**
- Treat a highlight as the trigger for a generative act, never as an end state.
- After each highlight, offer one optional micro-prompt: "Why does this matter?", "In your own words..." or "Turn this into a question".
- Nudge selectivity: show highlight density per section and gently flag heavy marking.
- Never build a "review your highlights" screen. Feed highlights into card and question generation instead.
- AI-suggested "key passages" act like instructor highlighting (g = 0.44), but only if accurate, because wrong highlighting is g = -0.70.
  - Make them faint, optional and dismissible.
  - Show them after the user's own pass, so selection judgment isn't outsourced.

---

## 2. Note-taking while reading: which forms work

| Activity | Effect | Grade | Source |
|---|---|---|---|
| **Conceptual self-explanation** ("Explain how/why X works") | g = 0.87 lab (≈0.55-0.60 applied) | Moderately supported | Bisra et al. 2018 (64 studies, ~6,000 participants) |
| Fill-in-the-blank self-explanation ("X works because ___") | g = 0.90, k = 2 | Emerging | Bisra 2018 |
| Justification prompts | g = 0.42, k = 20 | Moderately supported | Bisra 2018 |
| Self-generated explanation vs. reading an expert's explanation | +g 0.35 for self-generated | Moderately supported | Bisra 2018 |
| **Metacognitive** prompts ("Rate your understanding") | g = 0.19, **ns** | Moderately supported | Bisra 2018 |
| **Multiple-choice** self-explanation | g = 0.24, **ns** | Moderately supported | Bisra 2018 |
| **Elaborative interrogation** ("Why is this true?") | d = 0.85-2.57, cued recall, mostly simple facts; works better with more prior knowledge | Moderately supported; utility "moderate" | Dunlosky 2013 |
| **Summarization** | Utility "low" when untrained; helps when learners are trained to do it well | Well-established (as low utility) | Dunlosky 2013 |
| **Paraphrase/generative notes vs. verbatim notes** | Verbatim copying predicts worse conceptual performance | Moderately supported | Mueller & Oppenheimer 2014; Bretzing & Kulhavy 1979 **[web]** |
| Pen vs. keyboard | g = 0.04, **ns** | Moderately supported | Urry et al. 2021 (preregistered replication plus mini meta-analysis) |
| **"How will I use this?"** (utility-value writing) | Raises interest, and sometimes performance, mainly for low-confidence learners; broad motivational-intervention average ≈ 0.49 | Moderately supported for motivation; Emerging for retention | Hulleman & Harackiewicz 2009; Hulleman et al. 2010/2017; Lazowski & Hulleman 2016 **[web]** |
| Self-explanation cost | Adds 30-100% study time; the effect survives when study time is equalized (g = 0.41) | Moderately supported | Bisra 2018; Dunlosky 2013 |

**What helps most:**
- Explanatory notes in your own words: "how/why", connections to prior knowledge, and concrete examples.
- Concreteness helps too. Concrete advance organizers aid recall; abstract ones don't (Clark & Paivio 1991, Preliminary).

**Wasted effort:**
- Verbatim clipping and copying.
- "Rate your understanding" reflection.
- Choose-the-best-explanation (MC) reflection.
- Untrained free-form summarizing done with the text still open.
- Medium debates (handwriting vs. typing).

**Design implications:**
- Note prompts should be generative stems: "Explain how ___ works", "Why would ___?", "This connects to ___ because", "An example from my life is ___".
- Make one-click "clip quote to notes" second-class. If quotes are allowed, require a one-line "in my words" field beside them.
- Sequence every prompt as **attempt → AI model answer → user compares**. Never show the AI explanation first, or the generation benefit is lost.
- "How will I use this?" is worth offering as an optional per-document prompt for motivation and relevance. Don't sell it as a retention booster.

---

## 3. Retrieval-practice formats

| Finding | Effect | Grade | Source |
|---|---|---|---|
| Retrieval vs. restudy | g = 0.51 (vs. nothing g = 0.93) | Well-established | Adesope et al. 2017, k = 118 |
| Classroom testing effect | g = 0.499; no publication bias | Well-established | Yang et al. 2021, k = 222, N = 48,478 |
| Multiple choice (classroom) | g = 0.567, k = 270 | Well-established | Yang 2021 |
| Short answer (classroom) | g = 0.638 | Well-established | Yang 2021 |
| Free recall (classroom) | g = 0.238, k = 22 (small k) | Limited | Yang 2021 |
| Free recall beats recognition (lab) | Larger effects for recall | Well-established in lab | Rowland 2014 |
| Feedback after retrieval | g = 0.537 with vs. 0.374 without (~30% of benefit) | Well-established | Yang 2021 |
| Testing transfers to new formats, applications and inferences | Positive, moderate; weaker for far transfer | Moderately supported | Pan & Rickard 2018, *Psych Bull* **[web; verify the exact d]** |
| Testing hurts at 5 minutes and helps at 2+ days (crossover) | — | Well-established | Roediger & Karpicke 2006 |
| AI as answer-giver harms learning | Practice scores +48%, unaided exam **-17%** vs. control; a hint-only "tutor" with guardrails was neutral | Moderately supported (one large field RCT, N ≈ 1,000) | Bastani et al. 2024/2025, PNAS **[web]** |
| LLM grading of short answers | Agreement ranges from strong (r ≈ 0.9+, rubric/checklist items) to none (κ ≈ 0, evaluative items); LLMs are often harsher | Emerging, inconsistent | Grévisse 2024 BMC Med Educ; 2025 arXiv preprints **[web]** |

**Which format transfers best?**
- In the lab: effortful recall (free recall and short answer) beats recognition.
- In applied settings: short answer and MC both work well. Free recall is under-tested, not shown to be inferior.
- Transfer to application and inference is strongest when practice questions themselves vary and require application (see Section 6).
- Rank used here: short-answer/application ≥ free recall > cued recall > MC.
  - This rests on lab mechanism plus Yang's applied numbers.
  - The gaps between formats are small next to the gap between retrieving and not retrieving.

**Does AI-graded open-ended recall beat flashcards?** No direct study. Here is the inference:
- Open-ended explain/apply prompts give you self-explanation (g ≈ 0.87 lab) **and** retrieval.
- Flashcards give you retrieval of discrete facts.
- So open-ended prompts should beat flashcards for conceptual understanding and transfer. Flashcards should be more efficient for terms, facts and definitions.
- The binding risk is grader reliability. LLM grading is good on rubric-anchored items and unreliable on evaluative ones.
- Grade: **Inference.**

**Design implications:**
- Use both formats.
  - Flashcards for atomic facts and terms.
  - Open-ended "explain/apply" prompts for concepts.
- AI grading should:
  - use a per-question rubric (key points) generated at card creation;
  - show the model answer and the matched/missed rubric points;
  - let the user override the grade (the override is also a JOL signal).
- Always give feedback after an attempt.
- MC is acceptable for pretests and for quick checks on low-priority items. It should not be the default review format.
- The AI must never answer before the user attempts.

---

## 4. Flashcard design

| Finding | Effect | Grade | Source |
|---|---|---|---|
| User-generated cards beat premade cards (delayed test, 48 h), even counting the time spent authoring | d ≈ 0.45 (definition questions), 0.29 (application questions); 6 experiments, N = 284 | Moderately supported | Pan, Zung, Imundo, Zhang & Qiu 2023, *JARMAC* **[web]** |
| ...but making cards didn't help when learners copied text verbatim | Null | Preliminary | Lin & McDaniel 2018 **[web, secondhand]** |
| Learners don't notice the generation benefit | — | Moderately supported | Pan 2023 |
| LLM-made cards: quality | ~1 hallucination per 21 cards with optimized prompts; 100% coverage of learning objectives; no detectable exam difference (self-selected users) | Preliminary | Brown Univ. medRxiv 2025 **[web]** |
| AI cards vs. self-made: retention outcomes | **No direct RCT found** | Gap | — |
| Fill-in-the-blank (cloze-like) generative prompts | g = 0.90, k = 2 | Emerging | Bisra 2018 |
| Generation effect (producing beats reading, even when wrong, if corrected) | — | Well-established | Make It Stick; Slamecka & Graf 1978 |
| ~3 spaced successful retrievals per item captures most of the gain | — | Well-established | Yang 2021; Mawson & Kang 2025 |
| Minimum information principle (one atomic idea per card); avoid sets and enumerations; add context cues | Very widely used | Practitioner | Wozniak, "20 Rules of Formulating Knowledge" (1999); Matuschak, "How to write good prompts" (2020) |
| Cloze vs. Q/A | No head-to-head learning study found. Transfer between different cloze deletions of the same fact is limited | Gap / Moderately supported (limited transfer) | Pan & Rickard 2018 **[web]** |
| Cards per source | No controlled evidence | Gap | — |

**Atomic vs. contextual cards.** Atomic cards are easier to schedule and grade (Practitioner consensus). The risk is "fact islands" that don't transfer. The remedy is a mix:
- atomic cards for terms and facts;
- a few "explain/apply" prompts per concept that require integrating ideas (Sections 3 and 6).

**AI-generated vs. self-made: the generation trade-off.** The best evidence (Pan 2023) favors user-generated cards by roughly d 0.3-0.45. Fully premade decks forfeit that. The benefit seems to depend on the user producing something rather than copying.

Inference for the app, AI as drafting partner, not author:
- AI proposes candidate cards **from the user's own highlights and notes**.
- The user must **select and edit**: at least rephrase, or supply the answer.
- The generation step stays with the user. The AI removes the blank-page cost and catches gaps.

**Cards per source.** There is no evidence for any number. Practical heuristic: cover the user's highlights and notes, not the whole document. That works out to a few per highlight-worthy idea. Cap daily new cards so review load stays sustainable (Practitioner).

**Design implications:**
- Default to an "AI drafts, you finish" flow, ideally with the answer field blank for the user to fill.
- Enforce atomicity with an AI lint ("this card asks two things — split?").
- Pair atomic cards with one or two conceptual "explain/apply" prompts per key idea.
- Keep a source back-link on every card for context.
- Don't ship one-click "generate 50 cards from this article."

---

## 5. Spacing and scheduling

| Finding | Effect | Grade | Source |
|---|---|---|---|
| Spacing vs. massing (applied) | d = 0.54 [0.31, 0.77]; lab d = 0.85 | Well-established | Mawson & Kang 2025, k = 22 |
| Spaced **rereading** | d = -0.11 (no benefit) | Well-established | Mawson & Kang 2025 |
| **Expanding vs. uniform** intervals (fixed schedules) | g = 0.034, ns, I² = 0% | Well-established null | Latimier, Peyre & Ramus 2021, k = 16 |
| Optimal gap ≈ 20-40% of the retention interval for short targets, 5-10% for year-long targets | 1-year target → review at ~18-27 days | Well-established | Cepeda et al. 2008 |
| Late is cheap, early is costly (gap asymmetry) | — | Well-established | Cepeda 2008 |
| **Personalized model-based review** (item × learner forgetting model) vs. generic spaced review | +10.0% vs. generic spacing; +16.5% vs. massed, at 1-month delay | Moderately supported (one semester-long classroom RCT, N = 179) | Lindsey, Shroyer, Pashler & Mozer 2014, *Psych Sci* **[web]** |
| Optimal-control scheduling (review when predicted recall drops) beats heuristics | Natural experiment on Duolingo data | Emerging | Tabibian et al. 2019, PNAS (MEMORIZE) **[web]** |
| FSRS vs. SM-2: recall-prediction accuracy | FSRS beats an SM-2-trainable variant on log-loss/RMSE for the large majority of users. "~20-30% fewer reviews at equal retention" is often cited but not verified from the primary source | Emerging (benchmark, not learning RCT) | open-spaced-repetition `srs-benchmark` **[web]** |
| Successive relearning (retrieve to criterion, across 3-4 spaced sessions) | Durable retention, up to years | Moderately supported | Rawson & Dunlosky; Carpenter, Pan & Butler 2022 |
| **Importance- or value-weighted scheduling** | **No peer-reviewed study found** (only a patent) | Gap | — |

**FSRS vs. SM-2: reconciling a tension in the evidence.** The library's guidebook says "skip expanding-interval engineering," based on the Latimier null. That null compares *fixed* expanding vs. *fixed* uniform schedules on single items. It does **not** test adaptive per-item, per-learner scheduling.

Adaptive scheduling has its own evidence:
- Lindsey 2014: +10% over generic spacing.
- FSRS: better recall prediction, so less wasted review time.

The value of FSRS is efficiency: it puts limited daily minutes where forgetting is imminent. Schedule shape is not the magic.

Recommendation:
- Use FSRS. Open-source ports exist, possibly including Swift; verify.
- Don't build custom interval UI.
- The scheduler matters less than guaranteeing that review **is retrieval** and **happens**.

**Retention target.**
- FSRS default is 0.90.
- FSRS's own optimizer (knowledge per minute) often recommends 0.80-0.85 for large collections. Practitioner/Emerging, community data **[web]**.
- Workload rises steeply above ~0.90.

Recommendation:
- Default 0.90 for "important" material.
- 0.80-0.85 for "nice to know".
- Never above 0.95.

**Value-based prioritization.** No direct research exists. The cleanest implementation that is evidence-compatible:
- Map an importance tier to desired retention (for example, Core 0.92 / Normal 0.88 / Peripheral 0.80).
- When the queue overflows, order due cards by importance × predicted forgetting.
- Use successive relearning for Core items.

This is **Inference**: it uses only FSRS's parameterization, not new science.

**Design implications:**
- FSRS scheduling.
- Per-deck or per-source importance tier mapped to desired retention.
- Never compress intervals to "catch up". Resume from today.
- Review screens must ask, never show.
- Cap daily new cards so due load stays sustainable.
- Warn against massing: more than 3 reviews of one item in a day gives diminishing returns.

---

## 6. Interleaving and variation (quiz remixing, re-phrased cards)

| Finding | Effect | Grade | Source |
|---|---|---|---|
| Interleaving, visual/category discrimination | g = 0.67 | Well-established | Brunmair & Richter 2019, k = 54 |
| Interleaving, math problem types | d = 0.83 (classroom RCT); meta g = 0.34 | Well-established | Rohrer et al. 2019; Brunmair & Richter 2019 |
| Interleaving, **vocabulary/definitions** | **g = -0.39** (blocking is better) | Well-established | Brunmair & Richter 2019 |
| Interleaved items need adjacency | g = 0.73 immediate vs. 0.22 with time gaps | Moderately supported | Brunmair & Richter 2019 |
| **Varied retrieval** (different application questions per concept) vs. the same question repeated → transfer to new examples | Consistent advantage across 4 experiments | Moderately supported | Butler, Black-Maier, Raley & Marsh 2017 **[web]** |
| Varied *cue contexts* (vocabulary in different sentences) | Better learning, larger when spaced; learners judge constant cues as better | Emerging | Hanczakowski group (SWPS) **[web]** |
| Pure **rewording** of the same question | Smaller benefit than varying the example or application; may reduce recall of the exact item | Emerging | Matuschak notes on a systematic review **[web]**; WashU dissertation (mixed) |

**Design implications:**
- Classify content type first, using AI at card creation:
  - **Definitions/terms:** block by source or topic, no remixing.
  - **Concepts and strategies that are confusable:** interleave adjacent contrast items in the same session, for example "Which concept explains this case: A or B?".
- For mature conceptual cards (after 2-3 successful reviews), let the AI generate **new application scenarios** for the same concept. That is varied retrieval and it helps transfer. Cosmetic rewording does much less.
- Keep the canonical card. Use variants as alternates, scheduled under the same memory state.

---

## 7. Metacognition: judgments of learning, confidence and calibration

| Finding | Effect | Grade | Source |
|---|---|---|---|
| Learners' monitoring is biased by fluency; 72% judge massing better after doing better with spacing (90%) | — | Well-established | Kornell 2009; Bjork, Dunlosky & Kornell 2013 |
| JOLs inflated by font size, prior exposure | — | Well-established | Rhodes & Castel 2008; Kornell 2011 |
| **Delayed JOLs** (judged later, with only the cue) are far more accurate than immediate ones | Relative accuracy g = 0.93 (112 effects) | Well-established | Rhodes & Tauber 2011, *Psych Bull* **[web]** |
| Making a JOL changes memory (reactivity) | Overall g = 0.054, ns; positive only for related pairs and word lists (g ≈ 0.32-0.38) | Moderately supported | Double, Birney & Walker 2018 **[web]** |
| "Rate your understanding" as a learning activity | g = 0.19, ns | Moderately supported | Bisra 2018 |
| **Hypercorrection:** high-confidence errors are corrected *more* readily after feedback | Robust, replicated; survives delayed feedback | Well-established | Butterfield & Metcalfe 2001/2006; Fazio & Marsh 2009 **[web]** |
| Self-regulated learning training (plan-monitor-reflect) | g = 0.38 overall; metacognitive programs g = 0.63 vs. cognitive g = 0.28; self-directed estimate ≈ 0.24-0.27 | Moderately supported | Theobald 2021, k = 49 |
| Feedback on *strategy use* raises SRL effects | — | Moderately supported | Theobald 2021 |
| Unrestricted AI users felt they learned as much while scoring worse | — | Moderately supported | Bastani 2025 |

**Do confidence ratings help?**
- As a learning activity: no.
- As a monitoring signal: yes.
  - They are nearly free.
  - They're mostly non-reactive.
  - They enable hypercorrection (flag confident errors for emphasis).
  - They make calibration visible.

**Cheapest collection.** One tap of confidence *before* reveal or submit (sure / think so / guess). This is a delayed, cue-only JOL by construction, the most accurate kind. The post-reveal FSRS grade (Again/Hard/Good/Easy) is a second free signal.

**Design implications:**
- Add a pre-answer confidence tap on reviews.
- Mark "confident but wrong" items visually. Show the correct answer with emphasis and add a short "why" explanation.
- Weekly calibration view: "When you said *sure*, you were right 78% of the time."
- Show delayed-retention evidence ("You still remember 86% of what you read in March") rather than session accuracy. This counters the fluency illusion.
- Add a 30-second plan-monitor-reflect touchpoint per week, not per session.
- Never use "rate your understanding" as a stand-in for a prompt.

---

## 8. Prequestions / pretesting before reading

| Finding | Effect | Grade | Source |
|---|---|---|---|
| Prequestions → targeted (prequestioned) content | g = 0.54, k = 97 | Moderately supported (preregistered meta-analysis) | St. Hilaire, Chan & Ahn 2024 **[web]** |
| Prequestions → non-prequestioned content | g = 0.04, k = 91 (≈ none) | Moderately supported | St. Hilaire 2024 **[web]** |
| **Integrative** prequestions (spanning several ideas) also help non-prequestioned content | Large in a few studies | Emerging | St. Hilaire et al. 2019; 2024 eye-tracking (N = 24) **[web]** |
| Pretesting, tested content, 24 h+ delay | d = 0.44 to >2.0 | Moderately supported | Pan & Carpenter 2023 (60+ studies) |
| Classroom gains | 8-12% on unit tests and finals | Moderately supported | Beckman 2008; Soderstrom & Bjork 2023 |
| For text, feedback can be delayed; for paired associates it must be immediate | — | Moderately supported | Pan & Carpenter 2023 |
| 78% think reading beats pretesting | — | Well-established | Pan & Carpenter 2023 |
| Pretesting reduced persistence in an optional MOOC | — | Preliminary (single study) | Janelli & Lipnevich 2021 |

**Design implications:**
- Before reading, the AI generates 2-4 **integrative** prequestions targeting the document's central ideas. Narrow trivia would bias attention away from everything else.
- Answering is one line or "no idea", unscored, and framed as "Let's see what you already know."
- Re-ask the same questions after reading, as the first retrieval, with feedback.
- Keep it optional with one-tap skip, given the MOOC persistence signal.

---

## 9. Reading UX (reading plus annotation screen)

| Factor | Finding | Grade | Source |
|---|---|---|---|
| Screen vs. paper | Screen inferiority g = -0.21 for informational text; larger under **time pressure**; none for narrative | Moderately supported | Delgado et al. 2018, k = 54, N > 170k **[web]** |
| Annotation placement | **Spatial contiguity** g = 0.74: put labels and explanations next to what they refer to. Separated layouts force split attention | Moderately supported (multimedia), Inference (for margin notes) | Mayer multimedia meta-analyses, via Teaching guidebook |
| Self-paced text | Audio narration adds nothing (d = -0.14); text + diagrams suffice | Moderately supported | Ginns 2005 |
| Line length | 95 cpl was fastest (+6%) but no comprehension difference; users prefer shorter. Use 55-70 cpl for long reading | Emerging | Shaikh & Chaparro, via UX guidebook |
| Polarity (dark mode) | Dark-on-light gives better acuity and proofreading (d up to 2.17, extreme lab contrast); real-world gap much smaller; preference matters | Moderately supported (direction), Weak (magnitude) | Piepenbrock et al. 2013/2014, via UX guidebook |
| Font | Sans-serif gives shorter fixations; dyslexia fonts show no objective benefit | Emerging | Rello & Baeza-Yates, via UX guidebook |
| Reading speed | Speed-reading and RSVP trade comprehension for speed; there is no free lunch | Well-established | Rayner et al. 2016, *PSPI* (not in library; well-known review) |
| Signaling cues | Color and static cues help; flashing or animated cues harm transfer | Moderately supported | Schneider et al. 2018 |
| Interruptions | Notifications during reading undermine focus (see the focus literature) | Moderately supported | Focus guidebook (not deeply queried) |

**Split view vs. inline.** Contiguity favors margin notes **anchored beside the passage**: a gutter or margin column aligned to the highlight. Avoid a detached notes pane or inline popovers that cover the text. A split view is fine if each note is visually linked and scroll-synced to its passage. This is **Inference** from the multimedia principles; no direct annotation-UI RCT was found.

**Design implications:**
- Self-paced reading with no timers or "reading speed" metrics.
- Text column at 55-70 cpl.
- System font, semantic colors, user-chosen light or dark, with an optional light reading surface.
- Margin-anchored notes.
- Static color highlights only.
- Suppress notifications in reading mode.
- Don't build speed-reading or RSVP.

---

## 10. Motivation and habit for daily review

| Finding | Effect | Grade | Source |
|---|---|---|---|
| Habit **instigation** (cue → start) predicts frequency; execution habit adds nothing | β = 0.31-0.56; ΔR² = 0.00 | Emerging | Gardner 2022 |
| Implementation intentions ("After X, I will Y") | d ≈ 0.65 on goal attainment | Well-established | Gollwitzer & Sheeran 2006 (standard citation; not in the queried guidebook text). Fogg's ABC recipe is the practitioner form |
| Habit automaticity takes a median of 66 days (range 18-254); one missed day costs ~0 (0.29 pt on a 42-pt scale); compliance under ~80% kills it | — | Emerging | Lally et al. 2010 |
| **Streaks:** an intact logged streak raises continuation (92% vs. 65% with no log); a **broken** streak drops it *below* baseline (45%); self-attributed breaks are worst; **repair** rescues much of it (85% vs. 69%) | — | Emerging (7 studies, partly preregistered) | Silverman & Barasch, via Gamification guidebook |
| Hard streak endings increase quitting | +32% quit likelihood (range +22% to +110%) | Moderately supported | Kang et al. 2022, PNAS (N = 14,383) |
| Streaks become self-sustaining after ~8-11 days (observational) | >80% next-day activity after 8 days | Emerging | Weathers & Poehlman |
| Expected tangible rewards undermine intrinsic motivation for interesting tasks | d = -0.40 | Well-established | Deci, Koestner & Ryan 1999 |
| Notification optimization (bandit-chosen copy) | +0.5% DAU, +2% new-user retention: small | Moderately supported (one company) | Yancey & Settles 2020, KDD **[web]** |
| Progress monitoring | d ≈ 0.40 | Moderately supported | Harkin et al. 2016, via Psychology-of-Success reference |

**Minimal effective nudges:**
1. At onboarding, a one-line implementation intention: "After I [anchor], I'll do my review."
2. One daily reminder at that time. Copy tuning is a marginal gain.
3. A small, predictable daily load: cap new cards, show "≈6 min today", and make starting trivially easy ("just 3 cards").
4. Forgive single misses.
5. Informational feedback, not points: retention over time and "things you'd have forgotten."

**Streaks** are double-edged. If you use one:
- Make it forgiving: a weekly target such as "5 of 7 days", a grace day, and repair.
- Keep it private.
- Show it beside the cumulative count ("142 review days").
- Never hard-reset to zero.

**Design implications:**
- Track session *starts* as the primary habit metric for the first ~60 days.
- No XP, levels or leaderboards for a personal intrinsic-learning tool.
- If a streak exists, it must have repair and grace built in, or don't ship it.

---

## Ranked: the 8 highest-value activities to build

Ranked by effect size × applied robustness × fit to the read-to-review loop.

1. **Spaced retrieval review with feedback** (FSRS, ask-don't-show, feedback after every attempt, importance-tiered desired retention).
   - Spacing d = 0.54 (applied) plus retrieval g ≈ 0.5, probably additive. Feedback adds ~30%.
   - Well-established. This is the engine. Everything else feeds it.
2. **Open-ended "explain how/why" prompts** (self-explanation and elaborative interrogation).
   - AI writes the prompt and a rubric. The user answers. Then the model answer and the rubric match are shown, with user override.
   - Use during reading notes and as review items.
   - Conceptual self-explanation g = 0.87 lab, ~0.55-0.6 applied. Moderately supported.
3. **Closed-book free recall after reading.**
   - "Close the doc: write what you remember." The AI then compares the recall to the source and the user's highlights and lists the gaps. Gaps become cards.
   - Retrieval plus generation, with feedback. Moderately supported; free recall is under-tested in classrooms but strong in the lab.
4. **AI-drafts, user-finishes card creation from the user's own highlights and notes.**
   - Atomicity lint, a source link, and the answer field written or edited by the user.
   - User-generated > premade, d ≈ 0.3-0.45. Moderately supported.
   - The AI collaboration form is an Inference.
5. **Integrative prequestions before reading**, re-asked after reading as the first retrieval.
   - g = 0.54 on targeted content; integrative questions may extend further.
   - Moderately supported; integrative = Emerging.
6. **Highlight → one-line generative follow-up** ("why it matters / in my words / make it a question"), with selectivity nudges.
   - Highlighting + generative step g = 0.82 (k = 3). Emerging, but cheap and it converts a weak behavior into a useful one.
7. **Varied retrieval for mature concept cards** (new application scenarios) **plus adjacent contrast items** for confusable concepts. Block definitions.
   - Interleaving discrimination g = 0.67, vocabulary g = -0.39; varied retrieval improves transfer.
   - Well-established (interleaving) / Moderately supported (variation).
8. **Pre-answer confidence tap plus calibration and delayed-retention feedback.**
   - Hypercorrection emphasis on confident errors, a weekly calibration view, and "still-remembered %" as the headline metric.
   - Near-zero cost. Fixes the fluency illusion that otherwise makes users abandon effective strategies. Moderately supported.

Supporting infrastructure, not an "activity" but required:
- Implementation-intention onboarding.
- One daily reminder.
- A daily-load cap.
- Miss-forgiving consistency tracking.

---

## Popular features the evidence does NOT support

| Feature | Why not | Grade |
|---|---|---|
| **Highlight-resurfacing / "daily highlights review"** (Readwise-style rereading) | Reviewing highlights g = -0.06 ns; spaced rereading d = -0.11. Spacing without retrieval does nothing | Moderately supported / Well-established |
| **Unguided highlighting as the main interaction**, or highlight counts as progress | Comprehension ns; wrong highlighting g = -0.70 | Moderately supported |
| **AI summaries or AI-written notes in place of the user's own** | Removes generation; the self- vs. expert-explanation gap is g = 0.35; unguarded AI use cut unaided exam scores 17% | Moderately supported |
| **One-click "generate 50 flashcards" premade decks** | Premade < user-generated (d ≈ 0.3-0.45) | Moderately supported |
| **"Rate your understanding" reflection prompts** | g = 0.19, ns | Moderately supported |
| **MC as the reflection or explanation format** | MC self-explanation g = 0.24, ns. Fine for quizzes and pretests, not for explanation | Moderately supported |
| **Session accuracy / "% correct today" as the headline metric** | Anti-correlated with durable learning; immediate tests make good methods look bad | Well-established |
| **Hand-tunable interval ladders and expansion settings** | Fixed expanding vs. uniform g = 0.034. Use a proven adaptive scheduler and hide the knobs | Well-established null |
| **"Catch up" cramming of overdue cards** | Late is cheap; massing is costly | Well-established |
| **Shuffle-everything interleaving** (including vocabulary and definitions) | Vocabulary g = -0.39 | Well-established |
| **Hard-reset streaks, XP, levels, leaderboards** | Broken streaks fall below baseline; hard endings +32% quitting; expected rewards d = -0.40 on intrinsic motivation | Moderately supported / Emerging |
| **"21 days to a habit" messaging** | Median 66 days, range 18-254 | Emerging |
| **Learning-style modes** (visual/auditory toggles), auto text-to-speech "for retention" | Zero support for matching; audio adds nothing to self-paced text | Well-established / Moderately supported |
| **Speed reading / RSVP / words-per-minute goals** | Speed-comprehension trade-off | Well-established |
| **Handwriting mode "because research says so"** | Pen vs. keyboard g = 0.04, ns | Moderately supported |
| **Verbatim "clip to notes" as the default note action** | Verbatim notes underperform generative notes | Moderately supported |
| **Dyslexia-specific fonts** | No objective benefit | Emerging |
| **Volume metrics** (hours studied, cards reviewed) as achievement | Practice volume explains <1-4% of variance in education and professions | Well-established |

---

## Known gaps (worth an n-of-1 experiment inside the app)

- AI-generated vs. self-made cards: no retention RCT.
- AI-graded open-ended recall vs. flashcards: no head-to-head study.
- Importance-weighted scheduling: no study.
- Cloze vs. Q/A: no head-to-head learning study.
- Optimal number of cards per source: no evidence.
- Annotation-UI layout: no direct RCT.

The app's own review logs can test the first, second and fourth cheaply, for example with an A/B by source.

## Source paths

- Library guidebooks:
  - `docs/guidebooks/learning-science/Learning-Science_Design_Reference.md`
  - `docs/guidebooks/learning-science/Learning Science.md` (Ch 2, 3, 4, 5, 8, 9)
  - `docs/guidebooks/gamification/Gamification.md` (Ch 2, 5)
  - `docs/guidebooks/ux-ui-design/UX and UI Design.md` (typography chapter)
  - `docs/guidebooks/teaching/Teaching.md` (multimedia principles)
  - `/Users/tylerpoelking/Desktop/library/guidebooks/psychology-of-success/Psychology-of-Success_Design_Reference.md`
- Web (primary DOIs or links):
  - St. Hilaire et al. 2024 prequestion meta-analysis: [par.nsf.gov/servlets/purl/10511812](https://par.nsf.gov/servlets/purl/10511812)
  - Pan et al. 2023 flashcards: [Learning & the Brain summary](https://www.learningandthebrain.com/blog/?p=7456)
  - Lindsey et al. 2014: [doi 10.1177/0956797613504302](https://journals.sagepub.com/doi/abs/10.1177/0956797613504302)
  - Tabibian et al. 2019: [MEMORIZE](https://learning.mpi-sws.org/memorize)
  - Delgado et al. 2018: [PDF](https://www.uv.es/lasalgon/papers/Delgado%202018%20dont%20throw%20away%20your%20printed%20books.pdf)
  - Double et al. 2018: [Durham repository](https://durham-repository.worktribe.com/output/2253677/a-meta-analysis-and-systematic-review-of-reactivity-to-judgements-of-learning)
  - Rhodes & Tauber 2011: doi 10.1037/a0021705
  - Bastani et al. 2025: [SSRN 4895486](https://papers.ssrn.com/abstract=4895486), PNAS doi 10.1073/pnas.2422633122
  - Yancey & Settles 2020: [KDD paper](https://research.duolingo.com/papers/yancey.kdd20.pdf)
  - Butler et al. 2017 variable retrieval: [Duke](https://scholars.duke.edu/publication/1292911)
  - Pan & Rickard 2018: doi 10.1037/bul0000151
  - LLM grading: [Grévisse 2024](https://doaj.org/article/187eff35852e4deda46366758909da7a), [arXiv 2505.04645](https://arxiv.org/abs/2505.04645v1)
  - LLM flashcards: [medRxiv 2025](https://www.medrxiv.org/content/10.1101/2025.05.13.25327518v1.full.pdf)
  - FSRS: [srsbench README](https://ftp.fau.de/cran/web/packages/srsbench/readme/README.html), [Anki forums on desired retention](https://forums.ankiweb.net/t/clarify-what-optimal-retention-means/42803)
  - Hypercorrection: [Fazio & Marsh](https://pmc.ncbi.nlm.nih.gov/articles/PMC4036076)
