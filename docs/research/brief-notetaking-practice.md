# Active note-taking: practitioner methods, tool UX, and research beyond the core set

Research brief for the Ore "active note-taking" design. Compiled 2026-10-22.

**Scope.** This brief covers practitioner methods, reading-tool note UX, and research *outside* the core set (Jansen 2017, Mueller 2014 and its replications, Bisra 2018, Ponce/Mason highlighting, Dunlosky 2013). It does not repeat the tool survey in `docs/research/brief-landscape.md` (formats, pricing, APIs, selection-to-highlight flows). It adds three things that brief lacks: where notes live, how notes become cards, and what users complain about.

**Labels.**
- **[E]** marks evidence: a peer-reviewed study or review.
- **[P]** marks practitioner opinion or vendor documentation.
- **[U]** marks user reports from Reddit and forums.

**How sources were read.** Effect sizes appear only where I read them. Nearly all come from abstracts, via Consensus or the publisher. The exception is Kreijkes et al. 2026, which I read in full text. A number I could not verify is marked *unverified*.

---

## 0. Bottom line

1. **The note matters as a generative act, not as a stored object.**
   - Writing in your own words counts as Constructive in ICAP. Verbatim copying counts as Active.
   - Practitioners agree that notes are rarely reread. This holds across Matuschak, the Zettelkasten forum, r/ObsidianMD and r/readwise.
   - So a note earns its keep at the moment it is written, and later only if it feeds retrieval (a card or prompt).
2. **AI next to note-taking pulls people into copying.**
   - In the best 2025–26 RCT (Kreijkes et al., N = 344 analysed), notes alone beat notes + LLM, which beat LLM alone.
   - When the LLM was available alongside the notepad, 25.6% of students copied more than 70% of their notes from it.
3. **External notes reduce memory when you expect to have them later.**
   - This is the offloading literature: Grinschgl 2020, Eskritt & Ma 2013, Burnett 2026.
   - The fix is an explicit goal to remember, plus closed-book retrieval. Ore's finish step already does this.
4. **Self-generated questions help about as much as testing (Ebersbach 2020), but there are costs.**
   - They take roughly twice as long (Weinstein 2010).
   - They often miss what matters (Myers 2023).
   - A Question-intent note is better treated as elaboration or curiosity than as a review item.
5. **Practitioner methods are mostly unvalidated as packages.** That applies to Zettelkasten, Cornell, SQ3R, progressive summarization and the Feynman technique. Their core moves map onto validated mechanisms: own-words generation, self-questioning, recitation/retrieval, self-explanation, and spaced review.

---

## 1. Practitioner methods

For each method: the core move, the evidence for that move, and known failure modes.

### 1.1 Zettelkasten / Ahrens, *How to Take Smart Notes*

**Core move [P].**
- **Fleeting notes:** quick reminders, processed soon and then discarded.
- **Literature notes:** brief, in your own words, with the source. They go into a reference system.
- **Permanent notes:** one idea each, full sentences, understandable in isolation, linked to other notes. These are what enter the slip-box.
- The real unit of work is writing.
- Sources: [Zettelkasten Forum essay on fleeting notes](https://forum.zettelkasten.de/discussion/comment/14175/), [honnef.co reading notes](https://honnef.co/notes/references/ahrenshowtakesmart2022), [Matuschak's note on the book](https://notes.andymatuschak.org/How_to_Take_Smart_Notes_-_Ahrens).

**Evidence for the move.**
- There is no rigorous test of the method as a whole.
  - The only study I found is a 2023 *Emerging Science Journal* paper testing Zettelkasten combined with interval repetition, which cannot isolate the Zettelkasten [E, weak] ([DOAJ](https://doaj.org/article/3f36b99ae6564f068dae5ed0df745bbf)).
  - A critical review notes the book's main evidence is Luhmann's productivity ([Goodreads review](https://www.goodreads.com/book/show/60654237)).
- The "own words" move is supported indirectly.
  - ICAP classes verbatim notes as Active and own-words notes as Constructive, and predicts C > A [E] ([Chi & Wylie 2014](https://consensus.app/papers/details/b48499f242b7538c9b39e29b3c5b3e8c/); classification tables: [MIT ICAP table](https://tll.mit.edu/wp-content/uploads/2023/06/ICAP-Table.pdf), [PMC key-features table](https://pmc.ncbi.nlm.nih.gov/articles/PMC5998321/table/T2)).
  - In a 5-year classroom translation of ICAP, students learned more in Constructive than in Active activities [E] ([Chi et al. 2018](https://consensus.app/papers/details/937395c3469f5779a09d82646fa194ed/)).
- **Caveat:** ICAP's strict ordering is contested.
  - Overt behaviour does not reliably indicate the underlying process, and "supposedly inferior" modes can excel [E, commentary] ([Thurn et al. 2023](https://consensus.app/papers/details/96f9b7cefee9570a961905b526654cd6/)).
  - A field test with 3,820 student assessments did not find C/I superior to P/A [E] ([Wekerle et al. 2024](https://consensus.app/papers/details/67897ba9284c5689bb9eb172a5d84d6e/)).

**From the book itself (2026-10-23, `brief-notetaking-check-ahrens.md` §4).**
- Ahrens counts highlights and margin comments as fleeting notes, to be processed or binned within a day or two.
- He opposes archives and rereading for memory, but designs his slip-box so old notes are met again while writing new ones. Don't cite him for "notes are never revisited".
- His handwriting claim rests on Mueller & Oppenheimer 2014, which did not replicate (Urry 2021). His claim that the slip-box gives spacing and retrieval for free is an overclaim, so FSRS stays necessary.

**Failure modes.**
- **Collector's fallacy:** gathering feels like knowing [P] ([zettelkasten.de](https://zettelkasten.de/posts/collectors-fallacy/)). The remedy: short research–process cycles and own-words notes.
- **System overhead** displaces thinking. A 7-year, roughly 10k-note archive was deleted because "filing replaced reflecting" [P/U] ([Westenberg, "I deleted my second brain", 2025](https://westenberg.beehiiv.com/p/i-deleted-my-second-brain); [FlowingData commentary](https://flowingdata.com/2025/07/10/second-brain-deleted/)).

### 1.2 Forte, *Building a Second Brain* / Progressive Summarization

**Core move [P].**
- CODE: Capture, Organize (PARA), Distill, Express.
- Progressive summarization works in layers: L1 capture, L2 bold, L3 highlight the best, L4 an executive summary in your own words.
- It is done "opportunistically", only when a note is touched again for a project.
- The stated goal is discoverability for an "impatient and skeptical" future self.
- Learning is said to happen through application.
- Source: [Forte, Progressive Summarization](https://fortelabs.com/blog/progressive-summarization-a-practical-technique-for-designing-discoverable-notes/).

**Evidence for the move.**
- Layers 1–3 are highlighting, which is the weak case covered in the core set.
- Layer 4 (own-words summary) is generative. But untrained summarizing has low utility (Dunlosky, core set).
- I found no study of the method itself. Reviewers flag the lack of evidence [P] ([ICE Blog review](https://iceblog.royalcollege.ca/?p=182324)).

**Failure modes.**
- It is designed for retrieval *by search*, not retrieval *from memory*. It has no testing step.
- Users report notes are never revisited [U]:
  - [r/ObsidianMD "How often do you actually revisit…"](https://www.reddit.com/r/ObsidianMD/comments/1w6jyr3/how_often_do_you_actually_revisit_your_obsidian/): "never"; "90% of the value is the act of creating the note".
  - [r/ObsidianMD "Thousands of note MD files, but I never read or open them"](https://www.reddit.com/r/ObsidianMD/comments/1qahf2n/thousands_of_note_md_files_but_i_never_read_or/).
  - [r/readwise "…I never actually revisit them"](https://www.reddit.com/r/readwise/comments/1oblyn1/convince_me_to_stay_with_paid_readwise_reader/).

### 1.3 Andy Matuschak: evergreen notes, "Why books don't work", the mnemonic medium

**Core move [P].**
- **Evergreen notes** are atomic, concept-oriented (not organized by source), densely linked, and written for yourself ([Evergreen notes](https://notes.andymatuschak.org/Evergreen_notes)).
- **Reading workflow:** alternate between *collecting* passages and thoughts and *processing* clusters into evergreen notes.
  - Cluster by your own understanding, not the book's chapter order.
  - Write a broad note per cluster, then finer notes, then connect and revise ([Write about what you read…](https://notes.andymatuschak.org/Write_about_what_you_read_to_internalize_texts_deeply); [How to process reading annotations into evergreen notes](https://notes.andymatuschak.org/How_to_process_reading_annotations_into_evergreen_notes)).
- **Explicit warnings:**
  - "Most people take only transient notes" ([note](https://notes.andymatuschak.org/Most_people_take_only_transient_notes)).
  - Highlighting and marginalia create little pressure to synthesize.
  - Collecting feels more useful than it is.
  - Most texts aren't worth detailed notes. A practical compromise is spaced repetition for a few details, with fuller notes later if the text proves valuable ([Collecting material feels more useful than it usually is](https://notes.andymatuschak.org/Collecting_material_feels_more_useful_than_it_usually_is)).
- **"Why books don't work":** books rest on "transmissionism". Only readers with strong metacognitive habits (questioning, summarizing, self-checking) learn well from them. The proposal is new media whose structure does that work, such as Quantum Country's interleaved spaced prompts. In his words, "books are surprisingly bad at conveying knowledge, and readers mostly don't realize it" ([andymatuschak.org/books](https://andymatuschak.org/books/)).
- **Prompt-writing guide.**
  - Retrieval prompts should be focused, precise, consistent, tractable and effortful.
  - Concepts should be probed through lenses: attributes, similarities/differences, parts/wholes, causes/effects, significance.
  - *Salience prompts* tied to contexts in your life, and *application/creative prompts* that ask for a new answer each time.
  - Delete prompts that no longer matter ([How to write good prompts](https://andymatuschak.org/prompts/)).
- **Author-provided prompts** spare readers a hard skill. The cost is losing the benefit of writing your own. He leaves open whether self-writing matters ([note](https://notes.andymatuschak.org/zJSUEFHrJLVspreiCpnAnKJ)).

**Evidence for the move.**
- Self-generated flashcards beat premade ones [E] ([Pan et al. 2022](https://consensus.app/papers/details/5324a180f3a655ef887c2a0e9903cc8e/)):
  - memory d = 0.45 (95% CI 0.25–0.66),
  - application d = 0.29 (95% CI 0.12–0.45),
  - 48-hour delay, six experiments.
- Students mostly write *detailed* cards. Conceptual cards helped less-able "structure builders" [E] ([Lin et al. 2018](https://consensus.app/papers/details/734cb40cb3f2531d881071763fd2ba4a/)).
- Quantum Country's question-accuracy figures are Matuschak's own data, reported in his notes [P].

**Failure modes [P].**
- Writing good prompts is hard, and bad prompts are not obviously bad ([Writing good spaced repetition memory prompts is hard](https://notes.andymatuschak.org/Writing_good_spaced_repetition_memory_prompts_is_hard)).
- Non-technical prompts are forgotten more ([note](https://notes.andymatuschak.org/z6o8Aojmr6o9RyBqocdVEWf)).

### 1.4 Michael Nielsen, "Augmenting Long-term Memory"

**Core move [P]** ([augmentingcognition.com/ltm.html](https://augmentingcognition.com/ltm.html)):
- **Shallow paper reads:** 10–60 minutes producing 5–20 questions, mostly from the abstract, intro, figures and conclusion. Skip a paper if it cannot yield 5 good questions.
- **Card rule of thumb:** add a card if the fact is worth about 10 minutes of future time. Add striking facts regardless.
- **Atomic Q/A:** keep the integrative card too, so cards form a hierarchy.
- **No orphan cards:** write 2–3 per new idea.
- **No yes/no questions.**
- **Doubtful material:** phrase as "what does paper X claim", not as fact.
- **Make your own decks:** making them is part of understanding.
- **Tie cards to a project:** cards for a creative project work far better than cards stockpiled for a vague future use.
- **Budget:** 15–20 minutes of review a day. More means you are adding too fast.
- **Limit:** Anki builds declarative knowledge, not procedural skill.

**Evidence.**
- Self-made over premade cards: Pan 2022, above [E].
- The rest is practitioner experience.

**Failure modes [P].** Overloading, programmer's-efficiency disease (chasing features), and ankifying misleading material.

### 1.5 Cornell notes (Pauk)

**Core move [P].**
- Notes column, plus a **cue column** of questions written soon after class.
- **Recite** by covering the notes and answering from the cues.
- **Reflect:** what is the significance, how can I apply it?
- **Review** weekly.
- **Summary** at the bottom of the page.
- Sources: [Pauk handout (College of the Desert copy)](https://www.collegeofthedesert.edu/_web-items/documents/pdf-files/academic-skills-center/cornell-notes.pdf), [SUNY SCCC](https://sunysccc.edu/Current-Students/Academic-Advisement/Cornell-Note-Taking.html).

**Evidence.**
- The package evidence is weak: mostly small quasi-experiments in EFL and school settings that report gains [E, low quality] ([Seo 2025](https://consensus.app/papers/details/e0458f93ef64521b8e68b7d9779b1f65/); [Amhout 2023](https://consensus.app/papers/details/488f15b9ab9856f6b0a80cd3d4bbe450/)).
- The one recent randomized study (N = 134, 5 weeks) found no group differences at post-test. At retention, only Cornell beat the "sentence" method [E] ([Yıldırım 2026](https://consensus.app/papers/details/3600a5218b9251b489a109a8767cb3f9/)).
- Its *components* are the active ingredients:
  - recite from cues = retrieval;
  - cue-questions = self-questioning (§2.4);
  - summary = generative summarizing.

**Failure modes.** The recite and review steps are the ones students skip. The cue column then becomes decoration [P].

### 1.6 Adler & Van Doren, *How to Read a Book*

**Core move [P].**
- Four questions:
  1. What is the book about as a whole?
  2. What is being said in detail, and how?
  3. Is it true, in whole or part?
  4. What of it?
- Marking a book is "an expression of your differences or agreements" with the author: underline, margin lines, stars, numbering an argument's steps, circling key words.
- Reading levels: inspectional, analytical, syntopical.
- Sources: [fs.blog summary](https://fs.blog/the-art-of-reading-how-to-be-a-demanding-reader/), [ACCU review](https://accu.org/bookreviews/2014/bruntlett_1869).

**Evidence.**
- Questions 1–2 resemble prequestions and summary, which the core brief covers.
- Questions 3–4 (evaluation and significance) are untested as a package.
- Matuschak's "significance and implications" lens and Nielsen's "what does X claim" framing are practitioner echoes.

**Failure modes.** Analytical reading is slow and taxing. Matuschak notes the best reading is "highly contextual" [P].

### 1.7 SQ3R / PQ4R

**Core move [P].** Survey, Question, Read, Recite, Review. PQ4R adds Reflect.

**Evidence.**
- The SQ3R literature is dominated by small pre-post or quasi-experimental classroom studies [E, low quality] ([Cataraja 2022](https://consensus.app/papers/details/3c42aff5d74b5ffabdd6b1732654400b/) and similar).
- The clean test is of the core **recite** move. McDaniel, Howard & Einstein's 3R (read–recite–review) [E] ([McDaniel et al. 2009](https://consensus.app/papers/details/e2fe9d43d8795b349d70848bded53087/)):
  - beat rereading *and* note-taking on immediate and 1-week free recall;
  - on complex engineering texts, matched note-taking on inference and problem-solving *with less study time*.
- Adding "judgments of inferencing" to 3R improved inference performance [E] ([Nguyen & McDaniel 2016](https://consensus.app/papers/details/c54b4aab80dd52f082ff2aad8a961c94/)).

**Failure modes.** Learners skip the Survey and Question steps, and recite with the text visible.

### 1.8 Feynman technique

**Core move [P].**
1. Explain the topic plainly, as if to a sixth grader.
2. Find the gaps and return to the source.
3. Simplify and organize.
4. Optionally, teach it.
- Source: [fs.blog](https://fs.blog/feynman-learning-technique/).

**Evidence.**
- *Written* explaining to a fictitious student has a small effect: g = 0.29 conceptual, g = 0.22 transfer, cumulative meta-analysis.
- Self-explaining beat instructional explaining when written. Oral explaining beat written explaining [E] ([Lachner et al. 2021](https://consensus.app/papers/details/5333b6cedb575dd695935b9415111021/)).
- Explaining on video helped. Writing to a fictitious student did not [E] ([Hoogerheide et al. 2016](https://consensus.app/papers/details/fba9b3aafde255a2bce5e3f52c4c3fd3/)).
- Oral beat written explaining for a complex text, but not a simple one [E] ([Jacob et al. 2020](https://consensus.app/papers/details/faf3725fadd15332abc9c624604e11b0/)).
- Adding social presence (a chat-style editor) to written explaining did not help [E] ([Jacob et al. 2021](https://consensus.app/papers/details/778868c405ef5ff2bed85be0992d8e56/)).
- After video lessons, writing explanations beat rewatching (retention d = .58, transfer d = .87) and beat drawing [E] ([Fiorella et al. 2020](https://consensus.app/papers/details/57a33a10676d55d7af4a64c9421b02df/)).
- Teaching improved *research-question generation* more than retrieval practice or concept mapping [E] ([Wong et al. 2023](https://consensus.app/papers/details/913ea1276bfc572c84e36c281c591715/)).

**Failure modes.** "Explain it to a child" in *writing* adds little over plain self-explanation. Oral or recorded explaining is where the audience effect shows up. Fiorella & Mayer (2015, ch. 8) agree from the other side: every teaching study they review is spoken, on video or with a peer; teaching that merely restates the material lost to self-explaining (d = −1.63, Roscoe & Chi 2008).

---

## 2. Research beyond the core set

### 2.1 ICAP (Chi)

- **Engagement modes [E]:** Passive (attending) < Active (manipulating: highlighting, copying notes) < Constructive (generating beyond the text: own-words notes, self-explaining, concept maps) < Interactive (co-generating in dialogue).
- **Note-taking** is one of the paper's three worked examples ([Chi & Wylie 2014](https://consensus.app/papers/details/b48499f242b7538c9b39e29b3c5b3e8c/); [author PDF](https://chilab.asu.edu/sites/default/files/lcl/chiwylie2014icap_2.pdf)).
- **Copying an existing map is Active, not Constructive** ([Chi & Boucher classroom guide](https://www.stonybrook.edu/celt/design-and-teach/active-learning/itow-applying-the-icap-framework-to-improve-classroom-learning-chi-boucher-accessible.pdf)). This matters for AI-drafted content: copying an AI note or card is Active.
- **Critiques:** Thurn 2023 and Wekerle 2024 (see §1.1). ICAP is a useful heuristic, not a law.

### 2.2 Fiorella & Mayer: generative learning strategies

- **The eight strategies [E, review]:** summarizing, mapping, drawing, imagining, self-testing, self-explaining, teaching, enacting.
- **Framework:** Mayer's select–organize–integrate (SOI).
- Each strategy chapter covers boundary conditions ([Fiorella & Mayer 2016, *Educ Psychol Rev*](https://consensus.app/papers/details/00814a2a523555679bdeb93403953693/); book: [*Learning as a Generative Activity*, 2015](https://consensus.app/papers/details/e55d9b597b7f59169221a846c7cfa3b9/)).
- **Effect sizes not verified.** The book and article report median effect sizes per strategy. I could not access them (Springer paywall), so none are quoted here.
- **Age matters** [E] ([Brod 2020](https://consensus.app/papers/details/09b366b378565b93b8b1a51ef29f1c7b/)):
  - all six reviewed strategies (mapping, explaining, predicting, questioning, testing, drawing) work for university students;
  - drawing and questioning are weak before secondary school;
  - irrelevant for Tyler, but it confirms adult efficacy.
- **Text quality moderates generative vs retrieval tasks** [E] ([Roelle & Nückles 2019](https://consensus.app/papers/details/15cc1f5d43935dcb91099f6ce3e8d40b/)):
  - for well-written, cohesive texts, retrieval practice helped and generative tasks did not;
  - for low-cohesion texts, only generative tasks helped;
  - adding retrieval to generative tasks then cancelled their benefit.
- **Generative AI blurs who did the generating** [E, conceptual] ([Cho 2026, AI-GLM framework](https://consensus.app/papers/details/c7b152f6373f57d88da01afa43829d28/)):
  - AI can act as a "Generation Partner", a "Generation Substitute", or a "Generation Catalyst";
  - its "production-to-evaluation shift" is the risk when AI drafts and the learner only approves.

### 2.3 Kiewra: note review, matrix notes; Peverly: note quality; Bui et al.: organized vs transcribed

- **Encoding vs storage functions [E].**
  - Taking notes helps (encoding), and reviewing them helps (storage) ([Kiewra 1989 review](https://consensus.app/papers/details/db9c5886fe5c568e86ebbd8def274a3e/)).
  - With processing time equated, taking-then-reviewing beat the other functions on factual recall but *not* on higher-order tests.
  - **For text (not lecture), simply reading twice beat taking notes** ([Kiewra et al. 1989](https://consensus.app/papers/details/b2cfa0da022c53d281b156f46b9f90fd/)).
- **Meta-analysis [E]:** taking and reviewing notes together has "substantial" effects. Interventions add a modest increment. Providing a framework or instructor notes beat training alone ([Kobayashi 2006](https://consensus.app/papers/details/cd10d463302c5cdda1edde9e46748e34/); effect sizes not shown in the abstract).
- **Matrix notes [E].**
  - Matrix displays produced more relational learning than outlines, and both beat text ([Kiewra et al. 1999](https://consensus.app/papers/details/c2f5a44d59d953e69b183288dba1a1df/)).
  - The benefit comes from *localizing* related ideas by topic and category. Signalling or extracting alone did not help ([Kauffman & Kiewra 2010](https://consensus.app/papers/details/cc6e27b09e96568ca20f392468a93add/)).
  - One study found the matrix advantage on relation judgments disappeared at a delayed test ([Robinson & Kiewra 1994](https://consensus.app/papers/details/c1e2867fc4825443844af73c265e5571/)).
  - The matrix worked best when used for both taking and review ([Risch & Kiewra 1990](https://consensus.app/papers/details/2315b3e798af52fb811d203085cdec0c/)).
- **Note quality (Peverly) [E].**
  - Transcription fluency was the only predictor of note quality, and note quality the only predictor of test performance ([Peverly et al. 2007](https://consensus.app/papers/details/7cb82a05d95a5a36b9e0318a6d1836bf/)).
  - For *text* notes, the notes predicted essay and memory items but **not inference items** ([Peverly et al. 2011](https://consensus.app/papers/details/9c5e49a6d27859968f251f710a1898ce/)).
- **Organized vs transcribed (Bui, Myerson & Hale 2013) [E]** ([WUSTL abstract](https://profiles.wustl.edu/en/publications/note-taking-with-computers-exploring-alternative-strategies-for-i/)):
  - transcribing on a laptop gave the best *immediate* recall;
  - organized notes did better at a *delay* (Exp 2);
  - when notes could be restudied, transcribers recalled more at a delay (Exp 3);
  - working memory predicted outcomes for organized note-takers.
  - For reading (not lecture), the transcription pressure does not exist: the text stays available. So the "volume" argument for transcription does not transfer.
- **Typed vs handwritten (adjacent) [E]:** handwritten notes beat typed on achievement (g = 0.248), though typing produced more notes (g = 0.919) ([Flanigan et al. 2024 meta-analysis](https://consensus.app/papers/details/eef6b240be5f5ccd90b9ee57b32a51bf/)). This is relevant only as a reminder that volume ≠ value.

### 2.4 Learner-generated questions

- **Rosenshine, Meister & Chapman 1996 [E].**
  - Teaching students to generate questions improved comprehension on tests of new material.
  - Snippet-level median effect size 0.36 (*unverified*: full text not read) ([citation listing](https://www.scinapse.io/papers/2169231635)).
- **Ebersbach et al. 2020 [E]:** in a real lecture, generating questions and answering them (testing) both beat restudy at 1 week. Bayesian analyses suggest similar benefits for factual and transfer knowledge ([Ebersbach 2020](https://consensus.app/papers/details/cd593133633b5e88803fbb93f9bd63fe/)).
- **Weinstein et al. 2010 [E]:** generating and answering your own questions was no better than answering experimenter questions, both beat rereading, and **generating took at least twice as long** ([Weinstein 2010](https://consensus.app/papers/details/c778c2a8da82521f91dbbca2138086bf/)).
- **Myers et al. 2023 [E]:** answering your own questions *after a delay* gave no benefit and tended to be worse, because **self-generated questions often missed criterion material** ([Myers 2023](https://consensus.app/papers/details/5204ed62b76b5b12ac68be2461b49411/)).
- **Hoogerheide et al. 2018 [E]:** generating *multiple-choice* questions was worse than restudy with time held equal ([Hoogerheide 2018](https://consensus.app/papers/details/73c32d9f20ca50ba9fb1b571473cde0a/)).
- **Takeaway:** question *generation* is a decent generative act. Self-written questions are poor *review items* unless they target what matters.

### 2.5 AI-generated notes and summaries vs self-made; offloading (2020–2026)

**Kreijkes et al. 2026, *Computers & Education* 243:105514 [E, RCT, full text read]**

**Design.**
- Pre-registered randomised experiment. 405 students recruited, 344 analysed, aged 14–15.
- Within- and between-subject conditions: LLM vs Notes, and LLM vs LLM + Notes.
- Tested 3 days later.

**Results.**

| Outcome | LLM alone | Notes | LLM alone | LLM + Notes |
|---|---|---|---|---|
| Comprehension (max 12) | 4.00 | 4.89 | 3.80 | 4.11 |
| Literal retention (max 20) | 8.83 | 10.80 | 8.95 | 9.68 |
| Free recall (max 50) | 4.32 | 5.36 | 4.32 | 4.20 |

The first pair (LLM alone vs Notes) is Group 1. The second pair (LLM alone vs LLM + Notes) is Group 2.

- Notes beat LLM alone on all three measures.
- LLM + Notes beat LLM alone on retention and comprehension, but not on free recall.
- The Notes effect was significantly larger than the LLM + Notes effect.
- Time on task did not predict outcomes.

**Copying behaviour.** In LLM + Notes, 25.63% of students had more than 70% trigram overlap between their notes and the LLM output, and 16.25% had more than 90%.

**Preference.** Students *preferred* the LLM and rated it more helpful.

**Sources.** [Microsoft Research page](https://www.microsoft.com/en-us/research/?p=1143413); [PDF](https://researchdmr.com/files/LLM_Notes_Reading_Comp.pdf).

**Other studies**

- **Şimşek et al. 2025 [E]:** GPT summaries at self-paced video pause points did no better than transcripts on retention or transfer (N = 101). A second experiment compared summaries with GPT reflective prompts (N = 215) ([Şimşek 2025](https://consensus.app/papers/details/430dc9ae1560537798ceae2d70a05214/)).
- **Khurana et al. 2025 [E, case study]:** AI summaries and Anki cards for medical students left exam scores unchanged. Students reported time savings ([Khurana 2025](https://consensus.app/papers/details/45846b210d6a58b68f2a4424453f586e/)).
- **Talwalkar et al. 2025 [E, non-randomized]:**
  - medical students wrote their own note *first*, then saw an AI note: note quality was unharmed;
  - the authors credit the workflow requiring "independent judgments before exposure to AI-generated content";
  - 21% worried AI notes "may reduce my ability to learn how to write a good note";
  - source: [Talwalkar 2025](https://consensus.app/papers/details/b34f3a9bdf665e57873cef7128a93bfa/).
- **AI feedback on the learner's own summary [E, longitudinal]:** gains came when students *added concepts* in response to feedback, rather than making surface edits ([Kim et al. 2026](https://consensus.app/papers/details/57013f49c6fd566f9640ec48b4348c7c/)).
- **Students' own reflections [E, quasi-experimental]:** a "mastery" approach (using GenAI to construct and augment knowledge) went with higher-level learning than a "procedural" approach ([Pallant et al. 2025](https://consensus.app/papers/details/2d9c54a28dd452209127b571e9cae483/)).
- **Correlational and preprint work:**
  - Gerlich 2025 (*Societies*) is a survey of 666 people: AI use correlates negatively with critical thinking, mediated by offloading. Correlational only.
  - Kosmyna et al. 2025, "Your brain on ChatGPT", is an EEG preprint with N = 54. Not peer reviewed.
  - Both are known only from secondary summaries here, so treat them as signals, not findings ([PsyPost on Gerlich](https://www.psypost.org/ai-tools-may-weaken-critical-thinking-skills-by-encouraging-cognitive-offloading-study-suggests)).

**Offloading notes [E]**

- **Grinschgl et al. 2020** (3 experiments, N = 172 each) ([Grinschgl 2020](https://consensus.app/papers/details/3042321e3dfb59ba933920060219c72b/)):
  - offloading boosted immediate performance but hurt later memory;
  - **with an explicit goal to learn, forced maximal offloading almost fully counteracted the cost**.
- **Eskritt & Ma 2013:** note-takers whose notes were unexpectedly removed remembered less location information than studiers. Note-taking acts like intentional forgetting ([Eskritt & Ma 2013](https://consensus.app/papers/details/57c4bbfcc01056f0bdc31a51e3ab466c/)).
- **Burnett et al. 2026:** with unexpected loss of access to notes, recall fell *below shallow encoding* ([Burnett 2026](https://consensus.app/papers/details/b9df8c339e735c62a060bb3e75c6050d/)).
- **Kelly & Risko 2019:** offloaded items show a directed-forgetting signature ([Kelly & Risko 2019](https://consensus.app/papers/details/30004e84ef1755e3ad8348bb8267654c/)).
- **Gilbert 2024 model:** offloading is value-based. It also produces "saving-enhanced memory" for *other* items ([Gilbert 2024](https://consensus.app/papers/details/430b11b9406c5247a781c675a2a02f5a/)).
- **Takeaway:** a note app is an offloading device. Whether it helps or hurts memory depends on whether the learner intends to remember, and on whether retrieval is later done without the note.

---

## 3. Tool UX: what happens when you select text and want to write a thought

Selection-to-highlight mechanics are in brief-landscape §A. This section covers *where the thought goes* and *how it becomes a card*.

| Tool | Select → write a thought | Where notes live | Notes → cards | Friction and complaints |
|---|---|---|---|---|
| **Readwise Reader** | Highlight, then **N** opens a note; Enter saves, Shift+Enter adds a newline. A document-level note also exists. | Beside the highlight in the margin, and in the **Notebook** tab of the right panel (`]` toggles the panel, Shift+1 opens Notebook). Exports to Markdown via a Jinja template. [O] [docs llms.txt](https://docs.readwise.io/reader/llms.txt) | Action tag in the note: `.qa [Q?][A]` creates a Mastery card. Other action tags: `.h1`, `.c1`/`.c2` concatenation. [O] same source | Writing good Mastery cards is slow; one user (more than 1k cards) built an extension for AI drafts. You cannot tell from the API which highlights have cards. [U] [r/readwise](https://www.reddit.com/r/readwise/comments/1ud29s1/i_got_tired_of_copypasting_my_readwise_highlights/). Accidental highlights pollute the Obsidian export. [U] [r/readwise](https://www.reddit.com/r/readwise/comments/1szb4hs/readwise_obsidian_export_almost_useless_due_to/). "I highlight… but never actually revisit them." [U] [r/readwise](https://www.reddit.com/r/readwise/comments/1oblyn1/convince_me_to_stay_with_paid_readwise_reader/) |
| **Kindle** | Select → Note. | `My Clippings.txt` on the device (one messy file; includes sideloaded books) and read.amazon.com/notebook (purchased books only). [P] [export guide](https://web-highlights.com/tutorials/pdf-web-highlighter/how-to-export-kindle-highlights), [MobileRead](https://www.mobileread.com/forums/showthread.php?p=1106244) | None native (cards come via Readwise). | Notes are scattered by source type, and export is per book. |
| **Hypothesis** | Select → **Annotate** (with a note) or **Highlight** (no note). Page notes are separate. Tags, threaded replies, private or group visibility. [O] [help](https://web.hypothes.is/help/annotation-basics/) | Sidebar beside the page. | None. | Social layer by default. Notes are tied to the URL. |
| **Zotero 7/8** | Select → colour popup (highlight or underline); comment on the annotation. | Annotations in the left sidebar. **Notes pane** at the reader's right (child or standalone notes). "Add Note from Annotations" builds a note; you can drag annotations or raw selections into a note. [O] [Zotero PDF reader docs](https://www.zotero.org/support/pdf_reader) | None native (plugins). | The note doc is separate from the margin, so the thought lands in a second place. |
| **LiquidText** | Drag a selection into the workspace (an excerpt). Comment from the toolbar, on text or on excerpts. One comment can link to several sources. Tapping returns to the source. [O/3P] [Macworld](https://www.macworld.com/article/3097025/liquidtext-for-ipad-review-all-you-need-for-deep-research-projects.html), [pricing/features](https://www.liquidtext.net/pricing-features) | **Canvas** beside the document. | None. | Paywalled tiers, no dark mode (landscape brief). |
| **MarginNote 4** | Select → **excerpt**, which is at once a highlight, a mind-map card and a flashcard. A card holds one excerpt plus comments and tags. [O/P] [OhMyMN concept guide](https://ohmymn.marginnote.cn/en/guide/concept.html), [App Store](https://apps.apple.com/us/app/marginnote-4-ai-notes-mindmap/id1531657269) | Mind map beside the document. | Automatic: every excerpt is a card candidate; FSRS. | "A large unstructured pile of cards can be overwhelming"; users process in small chunks. Editing an excerpt no longer updates from source in MN4. [U] [forum](https://forum.marginnote.com/t/tips-of-use-new-features-i-found-useful-of-mn4/9391) |
| **Heptabase** | Highlight the PDF → place the highlight on a whiteboard as a card linked to page and line. A Highlights sidebar lists all highlights. [O] [wiki](https://wiki.heptabase.com/fundamental-elements), [roadmap](https://wiki.heptabase.com/roadmap) | Whiteboard canvas. | None (AI Tutor suggests questions). | Mobile PDF annotation was still unshipped as of Mar 2026. |
| **RemNote** | Highlight → a reference is copied to the clipboard and the cursor jumps to the **Notes pane**; paste it (as a reference, pin or source). **N** adds a note to the highlight. [O] [help](https://help.remnote.com/en/articles/6690975-annotating-files-with-the-remnote-reader) | A side-by-side document (rems) that links back to the PDF. | **AI Cards** from a highlight (suggestions; click to add); hand-written cards are recommended for wording. | Feature request to *stop* auto-adding notes to every highlight. [U] [feedback](https://feedback.remnote.com/p/option-to-stop-adding-notes-automatically-to-every-pdf-highlight) |
| **Obsidian + Annotator** | Hypothesis UI inside Obsidian. | A Markdown note: each annotation is a quote block with a block ref and a COMMENT region. Last release Jan 2024; 271 open issues. [O] [GitHub](https://github.com/elias-sundqvist/obsidian-annotator) | Via SR plugins. | Plugin rot. PDF++ users fault Annotator for leaving JSON if the plugin dies. [3P] [PDF++](https://community.obsidian.md/plugins/pdf-plus) |
| **Obsidian + PDF++** | Highlight → backlink in any note. | Annotations can be spread across many notes, kept as plain links. [3P] same | Via SR plugins. | Lag on some PDFs. [U] [r/ObsidianMD](https://www.reddit.com/r/ObsidianMD/comments/1vwn9ts/any_good_plugins_or_vault_templates_for_an/) |
| **Glasp** | Highlight → ✍️ note box under the highlight in the sidebar. Page comment. [3P] [Hongkiat](https://hongkiat.com/blog/glasp-vs-matter), [dev.to guide](https://dev.to/edoriatiri/getting-started-with-glasp-on-chrome-a-comprehensive-guide-gf2) | Sidebar. Exports MD, CSV and TXT. | None confirmed. | Public by default. |
| **Matter** | Notes on a highlight or on the article. [3P] [Hongkiat](https://hongkiat.com/blog/glasp-vs-matter) | Notebook menu. | None. | No retention system (landscape brief). |

**Patterns.** There are three placements for notes:
1. **Margin or sidebar next to the passage:** Reader, Hypothesis, Glasp, Matter.
2. **A separate note document beside the reader:** Zotero, RemNote, Obsidian.
3. **A canvas:** LiquidText, Heptabase, MarginNote.

Only MarginNote and RemNote turn the note act into a card without extra syntax. Readwise needs a `.qa` mini-language, and its users ask for AI drafting.

**Recurring complaints.**
- Notes are never revisited (Obsidian, Readwise, Westenberg).
- Accidental or low-value highlights clutter exports.
- Writing cards from highlights is slow.
- Plugin stacks rot.

---

## 4. Books to get

Checked only `~/Desktop/library/books/2-library/` (2026-10-22). Correction 2026-10-23: Fiorella & Mayer and Ahrens are already in `books/3-integrated/`; Adler, Kiewra and Forte are not in the library.

1. **Fiorella & Mayer, *Learning as a Generative Activity: Eight Learning Strategies that Promote Understanding* (Cambridge, 2015).** The primary source for which generative acts (summarizing, mapping, self-explaining, teaching…) work, their median effects and their boundary conditions. It is the evidence base for Ore's note placeholders and prompt kinds.
2. **Sönke Ahrens, *How to Take Smart Notes* (2017/2022).** The clearest practitioner account of "notes as writing, not storing" (fleeting → literature → permanent). Use it to argue the design, knowing it is evidence-light.
3. **Mortimer Adler & Charles Van Doren, *How to Read a Book* (1972).** The four reader questions and the levels of reading map directly onto the prequestions, the finish step and a possible "is it true / so what" prompt.
4. **Kenneth Kiewra, *Learn How to Study and SOAR to Success* (Pearson, 2004/2005).** Written by the leading note-taking and review researcher. Select–Organize–Associate–Regulate turns his matrix-note and review findings into study practice ([publisher listing](https://learningally.org/bookdetails/bookid/HP106), [Kiewra SOAR page](https://kiewra.unl.edu/soar-success)).
5. *(Optional)* **Tiago Forte, *Building a Second Brain* (2022).** Read it only to know the dominant PKM mental model and its failure mode (storage without retrieval). It is low priority because it adds no learning evidence.

Doyle & Zakrajsek's *The New Science of Learning* is skipped. It overlaps with *Make It Stick*, *Understanding How We Learn* and *How Learning Works*, which are already in the library.

---

## 5. Design implications for Ore

Each implication is mapped to existing decisions (D-numbers). None reopens a decision. Items that would change a decision are marked **[proposal]**.

1. **Keep the note one line, own-words, and optional. Make writing it nearly free.**
   - Note quality predicts outcomes, and fluency predicts note quality (Peverly 2007).
   - The current design already fits: Reader-style key to open, Enter saves, nothing required (D15).
   - The generative placeholder ("in my words / why it matters") matches the Constructive mode in ICAP.
2. **Never prefill or suggest note text with AI.**
   - When AI output sits beside a notepad, about a quarter of learners copy most of it, and the benefit of notes drops (Kreijkes 2026).
   - Copying is Active, not Constructive (Chi).
   - Keep AI out of the highlight popup entirely. This extends D9/D29 to the popup.
3. **Show Tyler's attempt before any AI artifact. Keep this everywhere.**
   - D18 (feedback after the attempt) and D20 (answer cold, then see the draft) match the one AI-notes workflow that did no harm (Talwalkar 2025: independent judgment before exposure).
   - Apply the same rule to any future "AI explains this passage" feature: ask for his one-line take first.
4. **The closed-book finish step is the most important evidence-backed piece. Protect it.**
   - Notes and other external stores reduce memory when you expect to keep access (Grinschgl 2020; Eskritt & Ma 2013; Burnett 2026). An explicit goal to remember plus closed-book retrieval removes most of the cost.
   - Recitation beat note-taking at less time cost (McDaniel 2009, 3R).
   - So: hide the text *and Tyler's own notes and highlights* during the finish re-ask and free recall (D18).
   - Never show a card's source note before the answer in review.
5. **[proposal] For EPUBs, run the recall step per chapter as well as at the end.**
   - 3R and Cornell both recite at the section level. A single free recall after a 300-page book is far coarser than anything tested.
   - A chapter marker already exists (`<!-- chapter N -->`).
   - This would extend D18 to "finish chapter", so it needs Tyler's say-so.
6. **Treat Question-intent notes as elaboration and curiosity, not review items.**
   - This confirms D19.
   - Generating questions is a good encoding act (Ebersbach 2020; Rosenshine 1996).
   - But self-written questions often miss what matters and take about twice as long (Myers 2023; Weinstein 2010).
   - If a Question highlight feeds anything, let it feed Research (D17), or AI-drafted prompts that answer it from the text.
7. **For concept prompts, draft along Matuschak's lenses and Kiewra's matrix idea.**
   - The lenses: attributes, similarities/differences, parts/wholes, causes/effects, significance.
   - Matrices beat outlines for relational learning (Kiewra 1999; Kauffman 2010).
   - Students tend to write detail cards, and conceptual cards help more (Lin 2018).
   - In the card-draft prompt: prefer "how does X differ from Y" for confusable pairs (fits D24), and "why does X matter for my work" for D1.
8. **Card drafts from contested or opinion sources should be framed as "According to <author>, …"**
   - Nielsen's rule for doubtful material.
   - A one-line addition to the enrichment prompt (bump its version).
9. **Write two or more items per idea, not one.**
   - Nielsen warns against orphan cards.
   - Pairing one card or prompt per Card highlight with a sibling (e.g. definition plus application) when the idea is central matches this and D24's "vary application prompts".
   - Keep the volume brake: 15–20 minutes a day signals over-adding.
10. **Do not build a note archive, a "review your notes" screen, or a canvas.**
    - Every community surveyed reports notes are not revisited.
    - The value is in writing them and in feeding retrieval (Westenberg; r/ObsidianMD; r/readwise).
    - This confirms D29.
    - Canvases (LiquidText, Heptabase, MarginNote) bring an "overwhelming pile of cards" problem and conflict with D26.
11. **Where notes live: the right margin, anchored to the passage (D27).**
    - This is the pattern with the least context switching (Reader, Hypothesis, Glasp).
    - A separate note document (Zotero, RemNote) splits the thought from its passage. RemNote users even ask to turn off its auto-note.
    - Notes should also appear on the card's provenance *after* the answer, and in search.
12. **Don't push note-taking on every source.**
    - For well-written text, retrieval helps more than generative note tasks (Roelle & Nückles 2019).
    - Reading twice beat note-taking from text in one Kiewra experiment.
    - Matuschak: "most texts aren't worth detailed notes."
    - The finish recall is the universal step. Notes stay optional, with no nags and no counts of un-noted highlights.
13. **Writing for an imagined audience adds little; speaking does.**
    - Written self-explaining ≥ written "explain to a novice" (Lachner 2021). Oral or video explaining shows the audience benefit (Hoogerheide 2016; Jacob 2020).
    - Keep note placeholders self-directed, not "explain it to a 12-year-old".
    - A spoken free recall (audio is already parked for v2+) is the place to try audience-style explaining. Candidate n-of-1 experiment.
14. **Adler's "Is it true? What of it?" fits D1 (apply in my work).**
    - A finish-step prompt such as "Where would you use or dispute this?" is practitioner-backed, not evidence-backed.
    - Mark it [P] if added; it is optional.
15. **Measure copying, not just volume.**
    - If an n-of-1 on AI-drafted vs self-made items runs (SPEC §9), log the trigram overlap between Tyler's finishing edit and the AI draft.
    - Kreijkes used this metric. High overlap means the finishing step has become Active (approve) rather than Constructive (produce).

---

### Sources not otherwise linked
- Consensus searches (results cited inline above). Upgrade to Consensus Pro to return 20 results per search instead of 10, and include more data like study design and key takeaways for every result.: https://consensus.app/pricing/
