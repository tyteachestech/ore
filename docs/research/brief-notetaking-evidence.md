# Evidence brief: active note-taking while and after reading

Prepared 2026-10-22 for Ore's "active note-taking" design step. This uses only Tyler's local library, with no web sources.

**What it builds on.** It assumes `docs/research/brief-learning-science.md` (2026-10-09) and `docs/DECISIONS.md` (D15, D18–D21, D27, D29). Each finding is tagged:
- **[confirms]**: agrees with the existing brief.
- **[extends]**: adds something the brief lacks.
- **[contradicts / qualifies]**: the existing brief should change.

**Grades.**
- **Strong**: several meta-analyses or preregistered replications agree.
- **Moderate**: one meta-analysis, or several consistent experiments, with caveats.
- **Weak**: a single small study, a secondhand citation, a study inside a book, or an inference.

**Paths.** Paths are abbreviated:
- `P/` = `~/Desktop/library/papers/2-library/`
- `B/` = `~/Desktop/library/books/2-library/<book>/chapters-<book>/`
- `G/` = the learning-science guidebook, in the repo at `docs/guidebooks/learning-science/`

**Provenance.** Most paper numbers come from the paper's `source.md` or `extraction.md`. PDF-only papers (Bertsch, McCurdy, Breitwieser, Donoghue, Deng, Lei) were read from `pdftotext` output. Book claims were gathered by a sub-agent, and I spot-checked four of them against the chapter text. Where the source gives no number, this brief says so rather than estimating one.

**Two source warnings.**
1. `P/divesta-1972-*/source.md` is a "detailed reconstruction compiled from multiple secondary sources" (its own words), not the 1972 paper. Treat it as secondary.
2. Neelen & Kirschner misreport Mueller & Oppenheimer 2014 (`B/evidence-informed-learning-design-…/10-nuanced-design-tools.md`). They describe the participants as "adolescents" (the studies used Princeton and UCLA undergraduates), and they say it "doesn't matter if learners read their notes" (Study 3 found that longhand plus review was best). Don't cite that book for this topic.

**Context fit.** Almost all note-taking research uses **lectures** (audio, video, live). Ore is **self-paced reading**. Jansen et al. 2017 argue that text lets note-taking happen *after* comprehension instead of *during* it, which lowers the load. So lecture failures of generative note-taking (for example Bui et al. 2013) transfer weakly to reading. Reading-based studies (Bretzing & Kulhavy 1979; Kauffman et al. 2011; Karpicke & Blunt 2011; Ponce 2022; Mason 2024) carry more weight here.

---

## 1. Encoding vs external storage; reviewing notes

| # | Claim | Grade | Source | Caveat |
|---|---|---|---|---|
| 1.1 | Notes do two jobs. **Encoding**: taking them deepens processing. **External storage**: having them lets you review later. Both were found in the original study. | Moderate (framework); Weak (the 1972 data as held here) | `P/divesta-1972-*/source.md`; `P/jansen-2017-jansen-2017-notetakingreview-*/source.md` §1, §3 | The DiVesta file is a secondary reconstruction. It used 5-minute passages at about 100 wpm, slow enough to leave spare capacity. |
| 1.2 | **The encoding effect is fragile and depends on cognitive load.** Jansen et al. split note-taking into five processes: comprehend, identify key points, link to prior knowledge, paraphrase, write. Each adds load. For learners with low working memory or low ability, taking notes can be *worse* than not taking them. In Berliner 1971 (n = 211 ×2), low-memory learners did better with *reflective questions after each section* than with notes taken during the lecture. | Moderate (review of fragmented, often small-n studies) | `P/jansen-2017-…/source.md` §2.3, §3 | The authors note that no study actually measured cognitive load, so the explanation is a hypothesis. **[extends]** |
| 1.3 | **Notes beat no notes in some studies and not others.** Wong & Lim: longhand notes beat both no notes and smartphone photos on free recall, even though everyone got an immediate review (Exp 1 d = 0.52 vs control, 0.58 vs photo; Exp 2 d = 0.71, 0.61; N = 200). Photo-taking ≈ no notes (d = 0.08–0.12). Morehead et al. Exp 2: a no-notes group (n = 32) did as well as all three note-taking groups on the immediate test. Their reading is that note-taking works mainly through storage (citing Kiewra 1989; Kobayashi 2005, 2006). | Moderate (mixed) | `P/wong-2023-*/extraction.md`; `P/morehead-2019-*/source.md` lines 1536–1556 | Both used video lectures. Wong's effect ran through *less mind-wandering* (Exp 2 mediation), not depth of processing. Morehead's no-notes cell is small. **[extends]** |
| 1.4 | **Capturing without generating is roughly worth nothing.** Photographing slides was no better than a printout (Wong). | Moderate (2 experiments, one lab) | `P/wong-2023-*/extraction.md` | The closest analog to one-tap capture or a Keep-only highlight. Analogy only, since photo ≠ highlight. **[extends]** |
| 1.5 | **What's in the notes is what gets remembered.** Propositions in notes were recalled 47% vs 12% when absent (Aiken et al. 1975, n = 180), and 44% vs 6% (Einstein et al. 1985, n = 48). Note quality and quantity correlate with recall across many studies. Morehead: whether test-relevant content made it into the notes predicted scores better than the note-taking medium did. | Moderate (correlational) | `P/jansen-2017-…/source.md` §2.2.3; `P/morehead-2019-*/source.md` lines 1546–1556 | Correlational: better learners may take better notes. |
| 1.6 | **Reviewing your own notes helps; reviewing your own highlights does not.** Mueller Study 3: longhand notes plus a chance to study them was the only condition that rose above the rest (d = 0.64, n = 109, one-week delay). Jansen et al. conclude that taking notes and then reviewing them is the best option, ahead of having the lecturer's notes. Highlighting plus later review: g = −0.06, k = 5 (Ponce). | Moderate | `P/mueller-2014-*/extraction.md`; `P/jansen-2017-…/source.md` §2.2.2 end; `P/ponce-2022-*/extraction.md` | Morehead Exp 2 found no difference between note-taking methods after a 7-minute note review. Ore always keeps the source, so storage is never the bottleneck. What a "review" of notes can add is *retrieval*. **[confirms D29 "no review-your-highlights screen"; extends to notes]** |

**Bottom line.**
- For a reader whose source is permanently stored, the useful functions of a note are:
  - **encoding**: the generation and attention while writing it;
  - **cue-making for later retrieval**: the note becomes the seed of a card or prompt.
- Passive re-reading of notes is the weakest use. Nothing in the library supports building a notes-review surface.

## 2. Generative vs verbatim notes; which generative activities, and when

| # | Claim | Grade | Source | Caveat |
|---|---|---|---|---|
| 2.1 | **Writing in your own words beats copying when learning from text.** Bretzing & Kulhavy 1979 (n = 180, 2,000-word text) compared summarizing (3 lines per page), paraphrased notes, copying the 3 most important lines, a letter-search task and read-only. Summary and note groups did best on both immediate and 1-week tests of cross-text integration. Verbatim copying ≈ read-only. Dunlosky: writing important points in your own words "produced a benefit over and above that of selecting important information." | Moderate (one well-known study, reported consistently by two reviews) | `P/dunlosky-2013-*/source.md` §3.1; `P/jansen-2017-…/source.md` §2.2.2 | High-school students; the text stayed present; one study. This is the best library evidence for *reading* notes. **[confirms brief; replaces its [web] citation with in-library sources]** |
| 2.2 | **For lectures, organizing can lose to transcribing.** Bui, Myerson & Hale 2013 (3 experiments, n = 80/76/76, 11-minute audio): transcription beat organized notes on immediate tests. At 24 hours the organized notes did better (Jansen's report of Study 2). | Moderate | `P/jansen-2017-…/source.md` §2.2.2, §2.4 | Jansen attributes this to the simultaneous load of a live stream, which self-paced text doesn't impose. The reversal at 24 hours matters, because immediate tests favor shallow strategies. **[extends]** |
| 2.3 | **The verbatim-overlap mechanism is weaker than the brief implies.** In Mueller 2014, verbatim overlap predicted worse performance (β = −0.43, partial R² = .12). Telling students "don't take notes verbatim" changed nothing: verbatim content p = .97, performance p = .91. In replications, laptops still produce far more words and more verbatim overlap (Urry meta of 8 studies: words g = −0.91, verbatim g = −0.78). Yet the outcome difference vanishes, and Urry calls the verbatim-performance link "not robust" in her replication. | Strong (process); Moderate (that verbatim notes harm learning) | `P/mueller-2014-*/extraction.md`; `P/urry-2021-urry-2021-*/extraction.md`; `P/morehead-2019-*/extraction.md` | **[qualifies]** The brief rates "verbatim copying predicts worse conceptual performance" as Moderately supported, citing Mueller. The Mueller leg of that does not survive replication; the claim now rests on Bretzing & Kulhavy (2.1). Also: **instructions don't change note behavior; design does.** |
| 2.4 | **Conceptual self-explanation has the strongest evidence.** Bisra et al. 2018: overall g = 0.55 (k = 69, N = 5,917, I² = 65%).<br>By prompt type:<br>• conceptualize 0.87 (k = 13)<br>• explain 0.68 (k = 12)<br>• justify 0.42 (k = 20)<br>• metacognitive 0.19 ns (k = 3)<br>By prompt format:<br>• fill-in-the-blank 0.90 (k = 2)<br>• multiple choice 0.24 ns (k = 2)<br>Other results:<br>• Studying text: 0.79 (k = 14).<br>• Self-explanation vs. being given an instructional explanation: 0.35 (k = 6).<br>• No detectable moderation by education level or knowledge type. | Moderate–Strong | `P/bisra-2018-*/extraction.md` | Mostly immediate tests. Effects vs. no-explanation controls are inflated (0.67). East Asian studies run higher (1.19). **[confirms; adds the "justify" row (0.42) and the explain row]** |
| 2.5 | **Elaborative interrogation ("why is this true?") works for facts, but sparse prompts dilute it.** Dunlosky rates it "moderate utility". It needs little training and adds little time (32 vs 28 minutes in Smith et al. 2010). Effects were "substantially diluted" (Callender & McDaniel 2007) or "even reversed" (Ramsay et al. 2010) when prompts came only once every 1–2 pages. Benefits may be limited for learners with little domain knowledge. | Moderate | `P/dunlosky-2013-*/source.md` §1.4–1.5 | Evidence is mostly fact lists. Hamilton (via Dunlosky) says it is unclear where to aim "why" questions for complex systems. **[extends: dosage]** |
| 2.6 | **Summarization is low utility; it works only for skilled summarizers.** Dunlosky: "low utility"; "summarization is not one strategy but a family." Summary quality predicts learning: in Bednall & Kehoe 2011 only 64% of summaries had the correct definition, and correct-definition counts correlated .42–.52 with test scores. Text-present vs text-absent summarizing is "most likely a complicated" question:<br>• Dyer et al. 1979: text-absent summaries gave no overall benefit, because what was left out got forgotten.<br>• Bretzing (text present) worked.<br>Donoghue & Hattie 2021: summarization d = 0.44 overall, but **d = 0.19 at university level** (151 effects). High-ability students showed negative effects for summarization. | Strong (that it is low utility as typically done) | `P/dunlosky-2013-*/source.md` §3.1–3.5; `P/donoghue-2021-*/source.pdf` Tables 1, 3 and text | Donoghue's controls are mixed and most outcomes are surface-level and measured within a day. **[confirms "low utility"; qualifies the brief's "untrained summarizing with text open = wasted effort"]** Short, frequent, own-words summaries with the text open (Bretzing's 3 lines per page) did work in that study. |
| 2.7 | **Learner-made summaries, organizers and drawings can lose to good provided ones for novices.** Clark & Mayer report the following (book reporting studies; no effect sizes given):<br>• Stull & Mayer 2007, run 3 times: author-made graphic organizers beat learner-made ones.<br>• Leopold et al. 2013: provided summaries, text or picture, beat generated ones.<br>• Drawing from scratch is "not effective". Supported drawing, using premade elements on a background, scored 28% vs 12% on transfer (Schwamborn et al. 2010).<br>The book flags that most of this work used low-prior-knowledge learners. Summarizing "may in fact benefit learners with greater prior knowledge." | Moderate (named studies, secondhand via the book) | `B/e-learning-and-the-science-of-instruction-…/11-engagement-in-e-learning.md` lines 109–113, 138, 194 | This sits against Bisra's self-explanation vs. instructional explanation g = +0.35. Reconciliation: what is generated must be *accurate*. An unsupported product made from scratch adds load and errors, while a prompted explanation of a specific point does not. **[contradicts / qualifies the brief's blanket "user-generated > provided"]** |
| 2.8 | **The generation effect is robust.** Bertsch et al. 2007: d = 0.40 (86 studies, 445 effect sizes, 17,711 participants). Moderators:<br>• Generating the whole target: 0.55; part of it: 0.32.<br>• Delay over 1 day: 0.64; immediate: 0.41.<br>• Between-subjects designs: 0.28; within-subjects: 0.50.<br>McCurdy et al. 2020 (126 articles, 1,653 estimates): **less-constrained generation produces larger memory benefits.** Generation also helps new material "particularly when feedback is given to correct errors." | Strong (for words and lists) | `P/bertsch-2007-*/source.pdf`; `P/mccurdy-2020-*/source.pdf` (conclusion section) | The base paradigm is word pairs. I did not map McCurdy's table rows to standardized effects, so only the direction is reported. The between-subjects figure (0.28) is the fairer one for "app with prompts vs. without". **[extends]** |
| 2.9 | **Concept mapping with the text open loses to free recall from memory.**<br>• Karpicke & Blunt 2011: retrieval d = 1.50 over concept mapping (Exp 1, n = 80); d = 1.07 (Exp 2, n = 120); d = 1.01 even when the final test was a concept map. 84% of students individually benefited.<br>• Yang 2021 (classroom): testing vs. elaborative strategies such as concept mapping and note-taking g = 0.095, ns (k = 25).<br>• Concept maps made *from memory*, or partially completed maps, are the book-recommended variants (Blunt & Karpicke 2014, via Ultralearning and Weinstein). | Strong (the active-vs-passive gap); Moderate (which active strategy) | `P/karpicke-2011-*/extraction.md`; `P/yang-2021-*/extraction.md`; `G/guidebook/ch02-retrieval-practice.md` lines 76–98; `B/ultralearning-…/08-retrieval-test-to-learn.md`; `B/understanding-how-we-learn-…/03-strategies-for-effective-learning-part-1.md` | **[confirms the brief and guidebook]** The guidebook reconciles the two (optimal lab vs. messy classroom). |
| 2.10 | **Prior knowledge and working memory moderate most generative strategies.**<br>• Note-taking only helped those with low prior knowledge in Shrager & Mayer 1989, via Jansen.<br>• High-memory learners gained from notes; low-memory learners gained from post-section questions (Berliner).<br>• Highlighting helped airmen with high mechanical aptitude (Klare 1955, via Dunlosky).<br>• Elaborative interrogation is weaker with low domain knowledge.<br>• Breitwieser & Brod 2021 (preregistered, n = 25 + 25): generating predictions and generating examples were "similarly effective in adults," while children did better with predictions. Different generative strategies need different cognitive prerequisites. | Moderate (pattern across sources); Weak (each one) | `P/jansen-2017-…/source.md` §2.3; `P/dunlosky-2013-*/source.md` §1.5, §4.2b; `P/breitwieser-2021-*/source.pdf` | Breitwieser used numerical trivia facts with a tiny sample. **[extends]** |
| 2.11 | **Training in a strategy matters.** Highlighting with training: g = 1.02 (k = 4). Summarization needs "relatively intensive training" for non-skilled summarizers. Self-explanation works with "minimal instructions", though lower-skill students produce paraphrases rather than explanations (Didierjean & Cauzinille-Marmèche 1997). | Moderate | `P/ponce-2022-*/extraction.md`; `P/dunlosky-2013-*/source.md` §2.4, §3.4 | Tyler is a skilled adult reader, so training is less binding than for K-12 learners. |

**Bottom line.**
- The best-supported in-reader activity is a **conceptual "explain how or why" prompt** attached to specific content (Bisra).
- Next best are **short own-words notes or summaries at a regular cadence**, with the text available (Bretzing).
- Weakest are unsupported large products (a full summary, a concept map or a drawing from scratch), and verbatim copying.
- Prompt **frequency** matters: prompts that are too sparse wash out (Dunlosky, elaborative interrogation).

## 3. Longhand vs typing

| # | Claim | Grade | Source | Caveat |
|---|---|---|---|---|
| 3.1 | **The outcome difference does not replicate.**<br>• Urry et al. 2021 (preregistered direct replication, n = 142): factual g = −0.08, conceptual g = −0.13 (directionally favoring laptop).<br>• Urry's mini meta-analysis of 8 studies: total g = 0.04 [−0.13, 0.20]; factual 0.03; conceptual 0.14 [−0.07, 0.35]; equivalence test significant.<br>• Morehead et al. 2019, combining the four direct replications: factual d = 0.22 [−0.01, 0.46], conceptual d = 0.17 [−0.07, 0.40], both ns. | Strong | `P/urry-2021-urry-2021-*/extraction.md`; `P/morehead-2019-*/extraction.md` | Every study used TED talks with internet-disabled laptops. Real-world distraction is untested. **[confirms]** |
| 3.2 | **The process difference does replicate.** Typists write more words (meta g = −0.91; Morehead d = 0.77) and more verbatim overlap (g = −0.78; d = 0.59). | Strong | Same as 3.1 | **[confirms]** This shows typing *enables* transcription, so a typed-notes app must not reward volume. |
| 3.3 | **Tablet stylus (eWriter) ≈ longhand** in both test scores and note characteristics. | Moderate | `P/morehead-2019-*/source.md` lines 1580ff | Not needed for a Mac app. |
| 3.4 | **The books lag the evidence.** Neelen & Kirschner, Weinstein, Teaching Tech Together, Jha and Oakley still recommend handwriting. Willingham says "the issue is not settled". | n/a | Book sub-agent report (`B/…/10-nuanced-design-tools.md`, `B/why-dont-students-like-school-…/09-evaluating-new-technology.md`) | The books predate Urry 2021, and N&K misreport Mueller (see header). |

**Bottom line.** Typing is fine. The medium is not the lever; generation is. Typing makes copying cheap, so the design should make generation the default path.

## 4. Highlighting and underlining

| # | Claim | Grade | Source | Caveat |
|---|---|---|---|---|
| 4.1 | **Learner highlighting helps memory a little, not comprehension.**<br>• Ponce 2022: memory g = 0.36 (k = 12, I² = 79%, prediction interval [−0.63, 1.35]); comprehension 0.20 ns; college students 0.39.<br>• Mason 2024 (n = 192, online, 1,028-word text): no main effect on literal or inferential comprehension, transfer or calibration.<br>• Dunlosky: "low utility". | Strong | `P/ponce-2022-*/extraction.md`; `P/mason-2024-mason-2024-*/extraction.md`; `P/dunlosky-2013-*/source.md` §4 | **[confirms]** |
| 4.2 | **The quality and amount of selection matter.**<br>• Mason: highlighting quality, measured as the proportion of expert-key information marked, predicted literal comprehension (β = 5.42) and transfer (β = 3.17). This is correlational.<br>• Fowler & Barker: amount highlighted correlated r = −.29 with test score (ns, n = 19).<br>• Limiting underlining to **one sentence per paragraph** improved recall (Rickards & August 1975).<br>• Training studies that worked all had "some safeguard against overuse."<br>• Inappropriate highlighting: g = −0.70 (k = 6). | Moderate | `P/mason-2024-*/extraction.md`; `P/dunlosky-2013-*/source.md` §4.1, §4.4; `P/ponce-2022-*/extraction.md` | **[confirms the brief's "nudge selectivity"; adds the 1-sentence-per-paragraph benchmark]** |
| 4.3 | **Highlight-then-review can hurt inference.** In Peterson 1992, underliners who reviewed their marked text did worse on inference questions at 2 months. Facts were equal across groups. | Weak (single study; Dunlosky says it "requires replication") | `P/dunlosky-2013-*/source.md` §4.2d | **[extends]** Another reason to avoid any "review your highlights" surface. |
| 4.4 | **Pre-marked highlighting helps immediately but fades.**<br>• Instructor-provided highlighting: g = 0.44 for memory and for comprehension (Ponce).<br>• But in Mason, the experimenter-highlighted group showed a significantly greater *drop in transfer* from immediate to 2-week test (β = −1.03). Learner-highlighting and control groups showed no drop.<br>• Learner highlighters spent 36% more time reading. | Moderate (Ponce); Weak (Mason's decay, a single non-preregistered study) | `P/ponce-2022-*/extraction.md`; `P/mason-2024-*/extraction.md` | **[qualifies the brief's idea of "AI-suggested key passages ≈ instructor highlighting g = 0.44"]** Durability may be worse than that number suggests. |
| 4.5 | **Highlighting plus a second, generative step is the useful form.** Highlighting combined with note-taking or a graphic organizer: g = 0.82 (k = 3). | Weak–Moderate | `P/ponce-2022-*/extraction.md` Table 7 | **[qualifies]** The prediction interval is [−3.09, 4.73] on k = 3. The brief reports this as "Emerging", which is right, but treat 0.82 as direction only. |

**Relation to notes.**
- A highlight is selection only. The learning comes from what the reader *does* with the selection: explain it, connect it, turn it into a question.
- Keep-only highlights are closest to Wong's photo-taking: capture without generation.

## 5. Timing: during reading, after a section, end of source; from memory vs source open

| # | Claim | Grade | Source | Caveat |
|---|---|---|---|---|
| 5.1 | **When you self-explain doesn't detectably matter.** Bisra, by timing:<br>• during learning: g = 0.52 (k = 57)<br>• after: 0.57 (k = 8)<br>• before: 1.24 (k = 4)<br>Moderator test ns (p = .26). | Moderate | `P/bisra-2018-*/extraction.md` | Small k after and before. **[extends]** Timing can be chosen for flow and cost rather than efficacy. |
| 5.2 | **Self-paced text allows sequential note-taking: read, then note.** This removes most of the load conflict that makes lecture note-taking fail. | Moderate (theory plus Schoen 2012: no medium difference for text) | `P/jansen-2017-…/source.md` §2.2.1, §3 | **[extends]** This supports per-section or after-paragraph notes rather than note-while-reading-each-sentence. |
| 5.3 | **Prompt cadence should be frequent and regular.**<br>• Bretzing's effective summaries were 3 lines after **each page**.<br>• Elaborative-interrogation prompts every 1–2 pages diluted or reversed the effect (2.5).<br>• Chi 1994 prompted after every sentence, which doubled study time (125 vs 66 minutes).<br>• Dunlosky: the frequency debate (small pieces vs larger summaries) "remains unresolved". | Moderate (that dosage matters); Weak (the optimal cadence) | `P/dunlosky-2013-*/source.md` §1.4, §2.4, §3.1, §3.2a | **[extends]** No study gives an optimal cadence. "Per page or section" is the tested middle ground. |
| 5.4 | **End-of-source closed-book recall is strongly supported.**<br>• Karpicke & Blunt: free recall after reading d = 1.07–1.50 over concept mapping with the text open.<br>• Carey reports Gates 1917: best results from about 40% reading and the rest reciting. No effect size is given beyond "about 30 percent."<br>• Ultralearning's Feynman technique: an open-book explanation "lacks the benefits of retrieval practice." | Strong (retrieval after reading) | `P/karpicke-2011-*/extraction.md`; `B/how-we-learn-…/05-the-hidden-value-of-ignorance.md`; `B/ultralearning-…/11-intuition-dig-deep-before-building-up.md` | **[confirms D18]** |
| 5.5 | **Blank-page recall needs scaffolding when knowledge is low.** Fourth graders recalled 9% on a blank page and, after 4 days, did no better than read-only. Partially completed concept maps, filled with the text first and then from memory, did beat reading (Karpicke, Blunt, Smith & Karpicke 2014, via Weinstein). Peverly 2013 (n = 204): an outline with headings led to more complete summaries afterward. | Weak (book-reported) / Moderate (Peverly via Jansen) | `B/understanding-how-we-learn-…/03-strategies-for-effective-learning-part-2.md`; `P/jansen-2017-…/source.md` §2.2.2 | Children, so transfer to Tyler is limited. In a hard new domain, structure cues (headings) can rescue recall without giving away content. **[extends]** |
| 5.6 | **Text-absent summarizing is unresolved.** Absence adds retrieval and prevents copying, but omitted material suffers (Dyer 1979). Some studies show benefits (Ross & Di Vesta 1976), others none (Anderson & Thiede 2008; Thiede & Anderson 2003). Text-absent summarizing did improve metacognitive accuracy. | Moderate (that it is mixed) | `P/dunlosky-2013-*/source.md` §3.2a, §3.2d | **[extends]** Pair closed-book recall with an AI gap check (D18 already does this), so omissions are not simply lost. |
| 5.7 | **Immediate tests mislead about note strategies.** Transcription won immediately and organized notes won at 24 hours (Bui 2013). Generation effects grow at delays over 1 day (0.64 vs 0.41, Bertsch). | Moderate | `P/jansen-2017-…/source.md` §2.4; `P/bertsch-2007-*/source.pdf` | Judge any in-app A/B on delayed retention, not same-session performance. |

## 6. Structure: guided notes, matrices, outlines, Cornell, provided vs learner-made, AI-provided

| # | Claim | Grade | Source | Caveat |
|---|---|---|---|---|
| 6.1 | **Matrix templates beat lists for comparative content.** Kauffman, Zhao & Yang 2011 (n = 30 and 119; text about several animals × attributes): a matrix outline gave the best declarative knowledge. List outlines did no better than free notes. | Weak–Moderate (small, a single lab) | `P/jansen-2017-…/source.md` §2.2.2 | Only fits material with an items × attributes structure. **[extends]** |
| 6.2 | **Provided outlines and diagrams help.**<br>• Peverly 2013 (n = 204): an outline gave more inclusive summaries.<br>• Bui & McDaniel 2015: diagram > outline > control on short answer.<br>Caveat: the diagram also contained more information. | Moderate | `P/jansen-2017-…/source.md` §2.2.2 | Lecture contexts. |
| 6.3 | **Complete provided notes hurt application.** Katayama & Robinson 2000 (n = 117, 3,500-word text) compared empty, partial and complete outlines. Complete notes did *worse* on application questions than partial or empty ones. There was no effect of matrix vs list. | Moderate (one study, long study time) | `P/jansen-2017-…/source.md` §2.2.2 | **[extends]** This is the most direct library evidence on "AI-provided notes": a skeleton is fine, completed content costs application. |
| 6.4 | **Instructor notes beat no notes, but taking and reviewing your own notes is best** (Jansen's summary of Fisher & Harris 1973; Kiewra 1985; Peper & Mayer 1978). | Moderate (secondhand within the review) | `P/jansen-2017-…/source.md` §2.2.2 end | Lecture contexts. |
| 6.5 | **Guided notes beat slides-only and unstructured notes** (Weinstein citing Barbetta & Skaruppa 1995 and the Konrad, Joseph & Eveleigh 2009 meta-analysis). The book gives no number. | Weak (book-reported, from applied behavior analysis) | `B/understanding-how-we-learn-…/04-tips-for-teachers-students-and-parents.md` lines 258–268 | Classroom and lecture contexts. |
| 6.6 | **Cornell notes (cue column + summary) have no controlled study in the library.** Neelen & Kirschner describe the method as advice only. | Weak (practitioner) | `B/evidence-informed-learning-design-…/12-nuanced-design-ingredients.md` | The active ingredient they name is "cover the notes and recall from the cues", which is just retrieval practice. |
| 6.7 | **Provided vs learner-made products: the comparison condition decides the winner.**<br>• Own-words generation beats copying or reading (Bretzing; Gingerich et al. via Make It Stick: "approximately half a letter grade", N over 800, still "robust" at about 2 months).<br>• Accurate expert products beat novices' from-scratch products (Stull & Mayer; Leopold).<br>• A *prompted* explanation beats being handed an explanation (Bisra, +0.35). | Moderate | `B/make-it-stick-…/04-4-embrace-difficulties.md` line 241; `B/e-learning-and-the-science-of-instruction-…/11-engagement-in-e-learning.md`; `P/bisra-2018-*/extraction.md` | **[qualifies the brief]** "AI as drafting partner, not author" still holds. The extra rule: AI may supply **structure** (headings, matrix axes, the prompt itself) but not **content**, and must not make its answer available before the attempt (see 7.4). |
| 6.8 | **Embedded questions help weaker readers.** Questions embedded in text bring "low structure builders" up to the level of high ones (Callender & McDaniel 2007, via Make It Stick). A notes box beside the text, with an inference question every couple of paragraphs, "led to better learning outcomes" (Roelle, Berthold & Renkl 2014, via Clark & Mayer). No numbers given. | Weak–Moderate (book-reported) | `B/make-it-stick-…/06-6-get-beyond-learning-styles.md`; `B/e-learning-and-the-science-of-instruction-…/11-engagement-in-e-learning.md` line 174 | The Roelle design (a note box beside the text plus periodic inference questions) is the closest tested match to an in-reader prompted-note feature. **[extends]** |

## 7. Notes into retrieval: questions and cards; self-generated vs given

| # | Claim | Grade | Source | Caveat |
|---|---|---|---|---|
| 7.1 | **Retrieval of the material is the payoff step.**<br>• vs restudy: g = 0.51 (k = 195)<br>• vs nothing: g = 0.93<br>• classroom: g = 0.499 (Yang)<br>• free recall vs concept mapping: d = 1.07–1.50 (Karpicke) | Strong | `P/adesope-2017-*/extraction.md`; `P/yang-2021-*/extraction.md`; `P/karpicke-2011-*/extraction.md` | **[confirms]** |
| 7.2 | **Self-questioning beat summarization in two head-to-heads.**<br>• Dunlosky: summarization was "less powerful than generating explanations (Bednall & Kehoe 2011) or self-questioning (A. King 1992)".<br>• Brozo et al. 1985: self-questioning training (learners wrote MC comprehension questions) > summarization training on the Georgia Regents' exam. No pre-test and no control group. | Weak (secondhand, small or flawed designs) | `P/dunlosky-2013-*/source.md` §3.2d, §3.4 | **[extends]** This is the only library evidence on question generation. A dedicated meta-analysis (Rosenshine et al. 1996) is not in the library. |
| 7.3 | **Self-made vs ready-made cards: the library evidence is mixed.**<br>• Lei & Reynolds 2022 (vocabulary word cards, 32 studies): "more of the reviewed studies showed larger effects... for the use of ready-made word cards than self-constructed." This is descriptive effect-size plotting, not a head-to-head test; they call for direct comparisons.<br>• Deng et al. 2015 (n = 72 medical students, correlational): unique Anki cards seen predicted Step 1 score (B = 5.9 × 10⁻⁴). Commercial Firecracker cards did not.<br>• Pan et al. 2023 (user-generated > premade), cited [web] in the brief, is **not in the library**. | Weak | `P/lei-2022-*/source.pdf` (abstract); `P/deng-2015-*/source.pdf` | Lei is L2 vocabulary. Deng can't separate self-made from shared Anki decks, and is confounded by diligence. **[qualifies the brief's Pan 2023 claim]** It remains the only support for "user-generated > premade" and is web-only. |
| 7.4 | **On-demand model answers kill effort.** In Schworm & Renkl 2007 (via Clark & Mayer), self-explanation helped only when learners *could not* see the provided explanations. With access, "many learners invested minimal effort." The book's rule: "Do not provide immediate feedback to self-explanation assignments." Clark & Mayer ch. 12 recommends showing the expert explanation *after* an attempt, as backup when the learner's explanation is wrong. | Moderate (named study, secondhand) | `B/e-learning-and-the-science-of-instruction-…/11-engagement-in-e-learning.md` line 167; book sub-agent report for ch. 12 | **[confirms and strengthens the brief's attempt → model-answer order]** It is not enough to show the AI answer after the attempt. The answer must not be **reachable** before the attempt is committed. |
| 7.5 | **Advice on question-writing: one big-idea question per section; avoid trivial restatement.** Young's own failure was fact questions made by "lazily restating" the text. Make It Stick: convert main points into questions. | Weak (practitioner) | `B/ultralearning-…/08-retrieval-test-to-learn.md`; `B/make-it-stick-…/01-1-learning-is-misunderstood.md` | Matches D19/D24 (prompts on central ideas). |
| 7.6 | **Generation helps new material most when errors get corrected.** Generating before seeing the answer helps even when the guess is wrong (Metcalfe & Kornell 2007, via McCurdy; Kornell & Metcalfe via Range). | Moderate | `P/mccurdy-2020-*/source.pdf`; `B/range-…/05-chapter-4-learning-fast-and-slow.md` | **[confirms D18/D20]** Feedback always comes after the attempt. |

## 8. Effort, cost, compliance, abandonment

| # | Claim | Grade | Source | Caveat |
|---|---|---|---|---|
| 8.1 | **Generative note activities cost real time.**<br>• Self-explanation: +30–100% time; Chi 1994: 125 vs 66 minutes.<br>• Bisra: equal-time studies still showed g = 0.41.<br>• Elaborative interrogation was cheap: 32 vs 28 minutes.<br>• Active highlighting: +36% reading time (Mason).<br>• Signaling: more learning time, g = −0.30 (Schneider 2018). | Moderate | `P/dunlosky-2013-*/source.md` §1.4, §2.4; `P/bisra-2018-*/extraction.md`; `P/mason-2024-*/extraction.md`; `P/schneider-2018-*/extraction.md` | **[confirms; adds the elaborative-interrogation contrast: "why" prompts are the cheap option]** |
| 8.2 | **Learners misjudge note strategies.**<br>• Wong: learners rated longhand, photo and no-notes as equally effective.<br>• Karpicke: 75% judged concept mapping as good as or better than retrieval.<br>• Effort ratings correlate negatively with judgments of learning, r = −.355 (Baars 2020 meta-analysis, cited in de Bruin 2023), so effortful strategies *feel* worse. | Strong | `P/wong-2023-*/extraction.md`; `P/karpicke-2011-*/extraction.md`; `P/debruin-2023-*/extraction.md` | **[confirms the brief §7; extends with the r]** |
| 8.3 | **Instructions alone don't change behavior; feedback and structure do.**<br>• "Don't take verbatim notes" did nothing (Mueller Study 2, p = .97).<br>• *Individual* performance feedback produced more lasting retrieval-practice choices than a general explanation of the benefits (Hui et al. 2021b, via de Bruin). No number given.<br>• Perceived effort for interleaving fell with practice, and adoption rose (Onan 2022, via de Bruin).<br>• Feedback on *strategy use* strengthens self-regulated-learning training (Theobald, via the guidebook). | Moderate | `P/mueller-2014-*/extraction.md`; `P/debruin-2023-*/extraction.md`; `G/guidebook/ch08-self-regulated-learning.md` line 138 | **[extends]** |
| 8.4 | **Learners can highlight well but often don't bother.** Underlining helped only when a $5 prize was at stake (Fass & Schumacher 1978). Learners with easy access to answers minimize effort (Schworm & Renkl). Without assigned retrieval, students "don't do anything until the day before the test" (Wenderoth, via Make It Stick). | Weak (single studies and anecdote) | `P/dunlosky-2013-*/source.md` §4.2b; Clark & Mayer ch. 11; `B/make-it-stick-…/08-8-make-it-stick.md` | The default path decides what happens. |
| 8.5 | **Blank-page recall runs dry fast.** Students "will run out of ideas after two minutes" (Wenderoth, advice). Prequestion-style pretesting reduced persistence in an optional MOOC (already in the brief §8). | Weak | `B/make-it-stick-…/08-8-make-it-stick.md`; brief §8 | Keep closed-book steps short and optional. |

---

## Design implications

Each item cites the findings above. Most of these refine the existing reader (D15, D18, D27, D29); none reopens a settled decision.

1. **Treat notes as encoding and retrieval seeds, never as a store to reread** (1.5, 1.6, 4.3).
   - The library already keeps the source, so a note's job is to make Tyler generate something and to seed a later prompt or card.
   - Keep D29's ban and extend it to notes: no "review your notes" screen. Notes surface only inside retrieval items, as the source link or the rubric context, *after* an attempt.
2. **Make the note field's prompt conceptual, not relevance or rating** (2.4, 2.5).
   - D15's placeholder "in my words / why it matters" mixes paraphrase with a relevance prompt. "Why it matters" is utility-value writing, a motivational prompt with no self-explanation evidence.
   - Prefer, by highlight intent:
     - Card: "In my words: …" or a fill-in stem, "This works because ___".
     - Question: "What I'd need to know: …"
   - Keep "How I will use this" as an optional note (D15), but don't count it as the generative step.
   - Never use a "rate your understanding" or pick-the-best-explanation prompt (Bisra: metacognitive 0.19 ns; MC 0.24 ns).
3. **Add a section-boundary prompt rather than relying on optional per-highlight notes** (2.1, 2.5, 5.1–5.3, 6.8).
   - Per-highlight notes are optional and sparse, which is the dilution risk (Callender & McDaniel; Ramsay).
   - The tested model is a short own-words note at a regular unit:
     - 3 lines per page (Bretzing);
     - a note box with periodic inference questions (Roelle 2014).
   - Proposal: at each heading boundary, or about every screenful in long unheaded text, show one quiet optional line in the margin. For example, "Explain the main point of this section" or a single AI-written inference question about it.
   - Text stays visible (that is the tested condition). Skippable with one key; no counter.
   - Grade: Moderate for "regular short own-words notes help"; Weak for the exact cadence.
4. **Keep D18's closed-book finish step as the main "after" activity, and scaffold it with structure, not content** (5.4–5.6, 6.2, 6.3).
   - Free recall from memory beats any open-book elaborative product (Karpicke).
   - For hard or unfamiliar sources, offer the source's **headings as cues** during recall: the outline, not the text. This is the Peverly outline / partial-map idea.
   - Then the AI gap list, which covers the "omitted material is lost" problem (Dyer).
   - Keep it short: blank-page recall runs dry in minutes (8.5).
5. **AI supplies structure and questions, never finished notes or summaries** (2.7, 4.4, 6.3, 6.7, 7.4).
   - Allowed: section prompts, inference questions, a matrix skeleton (6.1) for compare-type sources, heading cues.
   - Not allowed: completed notes (Katayama: complete notes hurt application), AI summaries (D29), pre-highlighted "key passages" by default (Mason: provided highlighting's transfer decays by 2 weeks).
   - If key passages ever ship, show them only after Tyler's own pass, as the brief already says.
6. **Make the AI model answer unreachable until Tyler commits an attempt** (7.4, 2.4).
   - This tightens the brief's "attempt → model answer" order.
   - No "show AI answer" button next to an empty note or prompt field.
   - Applies to section prompts, prequestion re-asks and the finish step.
7. **Make generation the path of least resistance; don't rely on instructions** (2.3, 8.3).
   - Telling learners not to copy failed (Mueller S2).
   - Provide no "copy highlight text into note" action.
   - Optionally, when a Card note substantially repeats the highlighted words, show a one-line nudge ("rephrase in your own words?"). Keep it soft: the replications show the verbatim-overlap → outcome link is not robust, so it must not block saving.
8. **Nudge highlight selectivity with a concrete benchmark** (4.2).
   - Treat about one highlight per paragraph as the soft reference (Rickards & August).
   - A quiet density indicator per section is enough. This matches the brief's "selectivity nudges".
   - Keep-only highlights resemble photo-taking (1.4). A highlight starts generation; the existing note popup is where generation happens.
9. **No handwriting mode or medium settings** (3.1–3.3). Typing is fine. Spend the effort on prompts.
10. **Let Tyler write the question for Question-intent highlights; the AI only polishes it** (7.2, 7.5, 2.8).
    - Evidence for self-generated questions is weak but positive (King 1992; Brozo 1985).
    - Less-constrained generation gives larger memory benefits (McCurdy).
    - Keep D19: Question highlights don't become review items by themselves. When the Question note is written as a question, it is a ready seed if Tyler later converts it.
11. **Show Tyler his own evidence instead of explaining the science** (8.2, 8.3).
    - Individual feedback beats general explanation for sticking with effortful strategies (Hui, via de Bruin).
    - Once enough reviews exist, state retention for items that had his own note vs Keep-only highlights. Use plain numbers and no trend arrow, per D23 at small n.
    - This also doubles as the n-of-1 test of implications 2 and 3.
12. **Judge note features on delayed retention, not same-session feel** (5.7, 8.2). Immediate tests and fluency favor shallow strategies (Bui 2013; Bertsch delay moderator). Any in-app comparison should use FSRS review outcomes days later.
13. **Budget the time cost and keep every note prompt optional** (8.1, 8.4, 8.5).
    - Self-explanation can add 30–100% time. "Why" prompts are the cheap variant.
    - Optional prompts that one key dismisses fit D23, which forbids quotas and streaks.
    - Fit with Tyler as a skilled adult (2.10, 2.11): he is the population where self-explanation and summarizing work. The novice-protection findings (2.7, 5.5) apply mainly when a source is far outside his knowledge, which is when heading cues (4) and AI-written questions (3) matter most.

## Changes to the existing brief (summary)

- **Confirms:**
  - pen vs keyboard null;
  - learner highlighting weak, review of highlights null;
  - conceptual self-explanation strongest and metacognitive or MC prompts null;
  - summarization low utility;
  - closed-book recall after reading;
  - attempt before feedback;
  - no highlight-review screen.
- **Extends:**
  - encoding vs storage and load theory (1.2–1.4);
  - prompt dosage and dilution (2.5, 5.3);
  - the "justify" row (0.42) and timing null (5.1) from Bisra;
  - generation-effect moderators (2.8);
  - matrix and partial-outline structure, and complete-notes harm (6.1, 6.3);
  - on-demand answers reduce effort (7.4);
  - effort–JOL correlation and individual feedback (8.2, 8.3);
  - the one-sentence-per-paragraph benchmark (4.2).
- **Qualifies or contradicts:**
  - "Verbatim notes underperform": the Mueller leg doesn't replicate; the claim rests on Bretzing (2.3).
  - "Untrained summarizing with text open = wasted effort": short per-page own-words summaries with text present worked in Bretzing, though university-level summarization effects are small (d = 0.19) (2.6).
  - "User-generated > provided" holds against copying, but accurate provided organizers and summaries beat novices' from-scratch products (2.7, 6.7). The library has no copy of Pan 2023, and Lei 2022 leans the other way for vocabulary (7.3).
  - Highlight + notes g = 0.82: the prediction interval spans [−3.09, 4.73] (4.5).
  - AI key passages ≈ instructor highlighting g = 0.44: transfer may decay (4.4).
  - Donoghue & Hattie 2021 report rereading at d = 0.47 and underlining at 0.44. Read alone, that undercuts the brief's "passive fails" framing. Their controls are mixed and the outcomes mostly surface-level and immediate (surface d = 0.60 vs deep d = 0.26), so it doesn't overturn Adesope or Yang. Note the tension, though.

## Gaps: sources not in the library that would materially strengthen this

I'm confident each of these exists. For the ones marked "cited", I am relying on the citation in a library source.

- **Fiorella, L., & Mayer, R. E. (2015).** *Learning as a Generative Activity: Eight Learning Strategies That Promote Understanding.* Cambridge University Press. Covers summarizing, mapping, drawing, imagining, self-testing, self-explaining, teaching and enacting, with boundary conditions. This is the single most useful missing book. It is cited by Clark & Mayer and Breitwieser.
- **Fiorella, L., & Mayer, R. E. (2016).** "Eight ways to promote generative learning." *Educational Psychology Review*, 28. A journal-length version of the above, with effect sizes per strategy.
- **Chi, M. T. H., & Wylie, R. (2014).** "The ICAP framework: Linking cognitive engagement to active learning outcomes." *Educational Psychologist*, 49(4). It names the passive / active / constructive / interactive levels that this brief keeps approximating. Also **Chi (2009)**, "Active-constructive-interactive," *Topics in Cognitive Science* (cited in Dunlosky).
- **Kobayashi, K. (2005).** "What limits the encoding effect of note-taking? A meta-analytic examination." *Contemporary Educational Psychology*, 30. And **Kobayashi (2006)**, a meta-analysis of combined note-taking and reviewing, *Educational Psychology*, 26. These are the quantitative answer to question 1 (cited by Morehead and in the DiVesta reconstruction).
- **Kiewra, K. A. (1989).** "A review of note-taking: The encoding-storage paradigm and beyond." *Educational Psychology Review*, 1. And **Kiewra (1985)** on notetaking and review, *Educational Psychologist*, 20. Kiewra's matrix-notes work is the main line behind 6.1 (cited by Jansen).
- **Bretzing, B. H., & Kulhavy, R. W. (1979).** "Notetaking and depth of processing." *Contemporary Educational Psychology*, 4. It is the load-bearing reading-notes study here, and the library has only secondhand descriptions.
- **Bui, D. C., Myerson, J., & Hale, S. (2013).** "Note-taking with computers." *Journal of Educational Psychology*, 105. Needed for its delay reversal. **Bui & Myerson (2014)** covers working memory and note-taking (*Learning and Individual Differences*, 33).
- **Stull, A. T., & Mayer, R. E. (2007).** Learner-generated vs author-provided graphic organizers, *Journal of Educational Psychology*. It is the primary source for 2.7, which the library has only through a book.
- **Rosenshine, B., Meister, C., & Chapman, S. (1996).** "Teaching students to generate questions: A review of the intervention studies." *Review of Educational Research*, 66. It would answer question 7 directly.
- **Pan, S. C., Zung, I., Imundo, M. N., Zhang, X., & Qiu, Y. (2023).** User-generated vs premade flashcards, *JARMAC*. The brief cites it [web]; it should be in the library given how central "AI drafts, you finish" is.
- **Nesbit, J. C., & Adesope, O. O. (2006).** "Learning with concept and knowledge maps: A meta-analysis." *Review of Educational Research*, 76. And **Blunt & Karpicke (2014)**, "Learning with retrieval-based concept mapping," *Journal of Educational Psychology*, 106.
- **Miyatsu, T., Nguyen, K., & McDaniel, M. A. (2018).** "Five popular study strategies: Their pitfalls and optimal implementations." *Perspectives on Psychological Science*, 13. It covers rereading, highlighting, outlining, flashcards and note-taking, with fixes for each.
- **Konrad, M., Joseph, L. M., & Eveleigh, E. (2009).** "A meta-analytic review of guided notes." *Education and Treatment of Children*, 32. Cited by Weinstein; would give 6.5 a number.
- **Brod, G. (2021).** "Generative learning: Which strategies for what age?" *Educational Psychology Review*, 33. A review of age and prior-knowledge prerequisites, extending Breitwieser & Brod.

Also missing: any controlled study of **annotation UI** (margin notes vs a notes pane), any study of **AI-written notes vs learner notes**, and any study of **prompt cadence while reading** beyond the elaborative-interrogation dosage findings. These are still the n-of-1 candidates.
