# Brief: active note-taking (2026-10-22)

> **Since then:** D91 (2026-10-28) dropped the Research type and the "In my words…" placeholder; D94 then gave each type its own generative prompt: Keep "Connects to…", Card "This works because…", Question "My question… my guess:". The decisions file wins where this brief differs.

Input to the active note-taking design step. It summarizes three supporting briefs; each claim there carries its citation:
- `brief-notetaking-evidence.md`: research in the local library (papers, books, the learning-science guidebook), graded and with caveats.
- `brief-notetaking-practice.md`: practitioner methods (Zettelkasten, Cornell, Adler, Matuschak, Nielsen…), research outside the library, and how reading tools handle notes. Web sources.
- `brief-notetaking-notionrpg.md`: how notes actually worked in NotionRPG, including what Tyler filled in on his real Notion pages.

## Answer

A note is worth what it makes Tyler produce at the moment he writes it, plus what it seeds for later retrieval. Storing it is worth little, because the library already keeps the source. So the design should:
- make generating text in his own words cheap at three moments (on a highlight, at a section boundary, after the source);
- keep AI to structure and questions, never note text;
- send notes into cards and prompts rather than a notes archive.

The one note-taking habit Tyler kept up in NotionRPG was a long synthesis per source in his own words. Ore has no place for it yet.

## What the evidence says

| Finding | Grade | Where |
|---|---|---|
| Taking notes helps through processing (encoding). Reviewing your own highlights adds nothing (g = −0.06). Reviewing your own notes helped in Mueller Study 3 (d = 0.64); with the source always kept, what a later pass can add is retrieval. Notes beat no notes in some studies (Wong 2023, d ≈ 0.5–0.7) but not in others (Morehead 2019). | Moderate | evidence §1 |
| The best-supported note is a **conceptual self-explanation** ("how / why does this work"): g = 0.87. Justification prompts g = 0.42. "Rate your understanding" g = 0.19 and choosing among given explanations g = 0.24 are both non-significant (Bisra 2018). Timing did not matter. | Strong | evidence §2 |
| **Dose matters.** "Why" prompts given only every page or two diluted or reversed the effect (Dunlosky 2013). The tested form is a short own-words note at a regular interval, e.g. 3 lines per page (Bretzing & Kulhavy 1979). | Moderate | evidence §2, §5 |
| **Pen vs keyboard makes no difference** (g = 0.04 over 8 studies; Urry 2021). Laptops produce more verbatim copying, but in replications copying did not reliably predict worse scores. The case for writing in your own words now rests on studies of notes taken while reading, not on Mueller 2014. | Strong | evidence §3 |
| **Telling people not to copy does nothing** (Mueller Study 2, p = .97). Defaults and structure have to do the work. | Moderate | evidence §2, §8 |
| **AI beside the notepad leads to copying.** Notes alone beat notes + LLM, which beat LLM alone (Kreijkes 2026, preregistered RCT, N = 344, ages 14–15). With the LLM available, 25.6% of students copied over 70% of their notes from it. Students preferred the LLM. | Moderate (one strong study) | practice §2.5 |
| **Offloading**: expecting to keep access to notes lowers memory. An explicit goal to remember, plus recall without the notes, removes most of the cost. | Moderate | practice §2.5 |
| **Closed-book recall at the end is the strongest single step.** It beat concept mapping with the text open by d = 1.07–1.50 (Karpicke & Blunt 2011). Recitation beat note-taking in less time (McDaniel 2009, 3R). | Strong | evidence §5, practice §1.7 |
| **Provided vs own work.** Own words beat copying. But accurate provided organizers beat novices' from-scratch versions, and complete provided notes hurt application questions (Katayama & Robinson 2000). So: provide structure, not finished notes. | Moderate | evidence §6 |
| **Questions you write yourself** encode about as well as being tested (Ebersbach 2020). They take about twice as long and often miss what matters, so they make poor review items. | Moderate | practice §2.4 |
| **Highlighting** helps memory a little (g = 0.36), not comprehension. The "highlight plus note" boost (g = 0.82) rests on 3 studies with a huge spread. About one highlight per paragraph is a tested soft benchmark. | Moderate | evidence §4 |
| **Effortful strategies feel worse** (effort vs felt learning r = −0.355). People keep using them when shown their own results, not when the science is explained. | Moderate | evidence §8 |
| Practitioner systems (Zettelkasten, Cornell, SQ3R, progressive summarization, Feynman) are **unvalidated as packages**. Their core moves are supported: own words, self-questioning, reciting, spacing. Every user community reports the same failure: notes are never revisited. | Weak (packages) / strong (moves) | practice §1, §3 |

Corrections to `brief-learning-science.md`:
- The longhand-vs-laptop result does not hold up as a reason for own-words notes.
- "User-made beats provided" needs the structure caveat above.
- The library has no copy of Pan 2023 (user-made vs premade flashcards), and a 2022 vocabulary synthesis leans the other way.

Two library sources are unreliable on this topic:
- The DiVesta 1972 file is reconstructed from secondary sources.
- Neelen & Kirschner misreport Mueller & Oppenheimer 2014.

## What NotionRPG got right

From his live Notion pages (`brief-notetaking-notionrpg.md` §3):
- **Of 18 source notes, Tyler wrote My Notes in 2** (953 and 468 words) and marked passages in 3. The rest were ingested and never touched.
- **The two he wrote are structured syntheses in his own words.** Make It Stick ch. 8 has a thesis, then for each technique "Definition / Why it works / Easy + ineffective evil brother", then his own metaphor. That is close to the self-explanation and matrix formats the research favors.
- **Cards drawn from that synthesis**, credited to Tyler rather than the author, were the most clearly D1-shaped cards in the system.

Worth carrying over:
1. Two zones per source: **his writing, separate from the verbatim text**.
2. **One idea linked to many passages.** One marker, K2, tagged three sections.
3. **Questions captured with his own tentative answer**, kept as a menu, not a backlog.

Friction to avoid:
- **Marking cost.** Each mark took a button, a title, a pasted marker and a background color. This is already fixed by D15.
- **Prompts buried in the source text.** About 6 of 322 were answered.
- **Status fields** nobody set.
- **Post-reading chores**: walking the highlights, transferring inquiries.
- **More cards than he could review**: 49 cards from one note, never reviewed.

One contradiction was never resolved: one spec says My Notes never seeds cards, while the card skill used them as card material. Ore should decide this explicitly.

## Design principles for the next step

These already fit the existing decisions:
1. **No notes archive, notes-review screen or canvas.** Notes show up inside retrieval items after an attempt, and in search. (Extends D29.)
2. **No AI in the highlight popup or note fields.** No prefilled or suggested note text, and no "copy highlight into note" action. (Extends D9 and D29.)
3. **Nothing from AI is reachable before Tyler's attempt.** This applies to prequestions, section prompts, the finish step, and any future "explain this passage". (D18, D20.)
4. **During the finish step, hide his own notes and highlights too**, not just the text. A card's source note appears only after he answers.
5. **Notes stay optional.** One key dismisses any prompt. No counts of un-noted highlights. (D23.)
6. **Notes live in the right margin, anchored to the passage.** That keeps the thought next to the passage it came from. (D27; Readwise, Hypothesis and Glasp do the same.)
7. **No handwriting or input-medium settings.**
8. **Judge note features on retention days later**, not on how a session feels. Once there are enough reviews, show retention for items with his own note vs Keep-only highlights, as plain numbers. (D23.)
9. **Card drafts from opinion sources say "According to <author>, …".** For central ideas, write a pair of items (definition + application), not one orphan card.

## Decisions the design step needs from Tyler

Each one would change or add to DECISIONS. They are ordered by how much the evidence and his own history support them.

1. **A per-source "My notes" area.** One Markdown section per source, his writing only, editable with the source open at any time. It is the only note format he sustained, and D15's one-liners can't hold it.
2. **The finish recall becomes the first draft of My notes.** After closed-book recall and AI feedback (D18), his recall text is saved into My notes. He then refines it with the source open. That gives one artifact and no separate chore, and it orders the steps the evidence supports: retrieve first, then elaborate with the text.
3. **Whether My notes seeds cards and prompts.** Recommendation: yes, credited "from your notes". This clarifies D19's "Key-Point-like notes".
4. **Note placeholder wording (D15).** Drop "why it matters", which is a relevance prompt with no self-explanation evidence. For Card intent, use something like "In my words: …" or "This works because …". For Question intent, ask for his question and a tentative answer.
5. **Optional section-boundary prompt.** At each heading, or about once per screen of headingless text, show one quiet margin line ("main point of this section, in your words"). It can be dismissed with one key and has no counter. The evidence for regular own-words notes is moderate; the exact frequency is a guess.
6. **Per-chapter finish for EPUBs.** A short recall at each `<!-- chapter N -->` marker, not only at the end of a 300-page book. This extends D18.
7. **A note linked to several highlights** (NotionRPG's "one idea, many passages"). Lowest priority; could wait until My notes shows whether it is needed.
8. **"Where would you use or dispute this?" at the finish** (Adler). Backed by practitioners, not evidence; it fits D1.

## Sources to get

Already in the library but not read for this brief (both in `~/Desktop/library/books/3-integrated/`; the research checked only `2-library/`, corrected 2026-10-23):
1. Fiorella & Mayer, *Learning as a Generative Activity* (Cambridge, 2015). The main source on which generative activities (summarizing, mapping, self-explaining, teaching…) work and when.
2. Ahrens, *How to Take Smart Notes*. The clearest argument for notes as writing rather than storage. Evidence-light.

Books to get:
3. Adler & Van Doren, *How to Read a Book*. The reader's questions behind the prequestion and finish prompts.
4. Kiewra, *Learn How to Study and SOAR to Success*. Matrix notes and note review, from the main note-taking researcher.

Papers worth adding to `~/Desktop/library/papers/` (findable online):
- Kobayashi 2005 and 2006 (note-taking meta-analyses)
- Chi & Wylie 2014 (ICAP)
- Fiorella & Mayer 2016 ("Eight ways to promote generative learning")
- Pan et al. 2023 (user-made vs premade flashcards)
- Kreijkes et al. 2026 (*Computers & Education* 243:105514)
- Bretzing & Kulhavy 1979

No studies exist on margin vs side-panel note UI, prompt frequency while reading, or AI-written vs self-written notes for adults. Those are candidates for n-of-1 tests.

## Check against Fiorella & Mayer and Ahrens (2026-10-23)

Both books were read in full text from `~/Desktop/library/books/3-integrated/`. Details and line citations:
- `brief-notetaking-check-fiorella-mayer.md`: *Learning as a Generative Activity* (2015). Graded A; reports effect sizes.
- `brief-notetaking-check-ahrens.md`: *How to Take Smart Notes*. Practitioner workflow resting on one case.

The audit also covers 12 practices another session distilled from the same two books. The test for each: does it earn its place, and can it fold into a step Tyler already takes? Generative effort (rephrasing, recalling, explaining) is the learning. Extraneous effort (UI mechanics, organising choices, extra steps) is a cost and gets cut.

Corrections to the distilled numbers, checked against the chapter text:
- "−0.89 for 'picture it' with novices" is one timed, low-experience comparison (Leahy & Sweller 2005), not a median.
- "1.25 vs −0.35 for split labels" is about how the lesson is laid out, not app UI. Applying it to app chrome is an inference.
- Summary frequency is mixed:
  - Infrequent summaries beat frequent ones in Spurlin 1988 (0.86 vs 0.21) and Foos 1995 (0.42 vs 0.08).
  - Frequent one-sentence summaries still worked (Doctorow 1978: d = 1.58 low-ability, 0.99 high-ability; Bretzing 1979: d = 0.50).
  - The book itself states both. D32's one-liners are the form that works when frequent.

| # | Practice | Status | Where it lives | UX tax | Cheapest fix, or why skip |
|---|---|---|---|---|---|
| 1 | Learner produces first, AI second | Met | D18, D20, D34.3. `Finish.tsx` shows feedback only after submit; drafts first appear in review answered cold (D20). Prequestions are AI questions, never answers. | None | — |
| 2 | A highlight is not a note; turn it into own words within a day or two, or bin it | Deliberately skipped | Keep highlights persist with no fuse. A Card highlight focuses its note field (D15). A Keep highlight with no note never becomes an item (`enrich.ts` `pendingHighlights`). | High if added | **Conflicts with D29 and D34.5** (no highlight-review screen, no un-noted counts). NotionRPG's post-reading highlight walk went unused. The finish recall plus My notes already does the conversion, from memory, in one step. Skip. |
| 3 | Own words, gist over coverage | Met | Section lines (D32, `Margin.tsx`), finish and chapter recall (D18), My notes (D31). | Low | Quality matters: untrained summaries were often inaccurate (Hooper 1994). Optional fold-in: the chapter and finish feedback adds one line on whether his section lines state a main idea or a detail. |
| 4 | Retrieval with feedback, recall not recognition; card what matters, including explain/apply items | Partial | D19–D21 grading, relearn pass, `prompt` items. Desktop review is not built yet (D29); the `/ore` skill runs it. **Gap:** prequestions are answered twice (before reading and at the finish), both in the same session, and never again. The testing benefit is mostly item-specific, and a test two days later beat an immediate one (Glover 1989: 1.95 vs −0.10). | None at read time; 2–4 more reviews per source | **Turn the prequestions into `prompt` items after the finish**, with the feedback's key points as rubric, finished in first review like any draft (D20). Changes D19. |
| 5 | Focused prompts, not blank boxes | Partial | Per-intent placeholders (`Reader.tsx`), section-line prompt, use/dispute line. The Card placeholder still opens with paraphrase ("In my words…"). "Type comments to yourself" gave d = 0.11 (Hausmann & Chi 2002). The prompt that worked asked what it means plus how it links to prior knowledge (O'Reilly 1998). My notes uses a generic placeholder. | None | **Card placeholder → "This works because… / connects to…"**. Changes D15 wording. My notes can stay open: it is seeded by recall and is his synthesis space. |
| 6 | Link at write time; old notes resurface | Missing | D33 deferred. Search finds notes. AI assigns topics. | Low (wording); high (resurfacing UI) | Fold linking into the existing optional finish line: **"Where would you use this, and what does it connect to?"** This is Ahrens's core move; this exact prompt is untested. Skip automatic resurfacing (a new surface). When D33 is revisited, make it cross-source. |
| 7 | Low extraneous load; no time limits | Met | D26 (compact, keyboard-first, no chrome), D23 (no quota, no timer). Every prompt dismisses with one key (D34.5). | — | Watch: section lines add one quiet line per section. |
| 8 | Fit the form to the content (matrix for compare/contrast, d = 1.07, 8 of 8) | Missing | — | High | Skip for now. It needs a new UI, applies only to compare material, and AI-chosen rows would do some of the selecting. Candidate n-of-1 later. |
| 9 | Scaffold more for novices | Partial | Prequestions only. | Medium | Skip. Tyler reads mostly in known domains; prompts help low-knowledge learners most. Revisit if a source far outside his knowledge stalls. |
| 10 | Prequestions before reading | Met | D18, `Reader.tsx` prequestion strip. | Low | See #4: what they lack is spacing, not presence. |
| 11 | Teach-back | Deliberately skipped | — | — | Every teaching study is spoken, on video, or with a peer; writing for an imagined audience is untested. Restating without monitoring lost to self-explaining (−1.63). Spoken recall is parked in v2+. |
| 12 | Show the payoff | Partial | `ore stats` reports retention for own-words vs no-note items (D34.8). No UI until the stats screen (D29). | None | Show it in the stats screen when that is built. No onboarding flow. |

Ahrens-specific findings:
- He supports D29 and D34.2 strongly: no copying quotes, no rereading for memory.
- He disagrees with D34.5–34.7 (optional notes, margin notes, typing over handwriting). On handwriting his only evidence failed to replicate. On the other two, his own reasoning cuts the other way. Keep the decisions.
- His real gap for Ore: My notes is a *literature note*, tied to one source. His method gets its value from linking ideas across sources. That is #6 and the D33 scope note.

Proposed decision changes, in order of evidence and fit. None adds a screen or a step:
1. D19: prequestions become `prompt` items after the finish.
2. D15: Card placeholder "This works because… / connects to…".
3. D18: finish line "Where would you use this, and what does it connect to?"
4. D32: chapter and finish feedback adds one line on section-line quality.
5. D33: scope the deferred link to "one idea across several sources".
