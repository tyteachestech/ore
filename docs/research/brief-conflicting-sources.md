# Evidence brief: sources in one skill that disagree

Prepared 2026-11-17 to 2026-11-20 for Tyler's question: one Health source says seed oils are bad, another says they aren't, so how should Ore bring that up? Decision: D337 (nothing built; the plan below waits for a real conflict in his library).

Sources were found with Consensus, SciSpace and PubMed and read from their abstracts, not full texts. Check a number in the paper before quoting it in public.

## What the research says

| Finding | Grade | Source |
|---|---|---|
| People keep disagreeing sources straight by remembering who said what; memory for sources predicts deep understanding. | Moderate | Strømsø, Bråten & Britt 2009, *Learning and Instruction*; Braasch & Bråten 2017 (D-ISC), *Educational Psychologist* |
| Readers often miss a conflict between texts unless it is signalled or the two claims are linked. | Moderate | Stadtler et al. 2013, *Discourse Processes*; Delgado et al. 2020, *Reading and Writing* |
| Being asked to resolve the conflict beats being asked to understand each text, for understanding and recall. A summary task gives one-sided accounts; an argument task gives balanced ones with sources named. | Moderate (small studies) | Kobayashi 2015, *Reading Psychology*; Stadtler et al. 2013 |
| Readers side with what they already believe, building a one-sided picture unless they work against it. | Moderate | Richter & Maier 2017, *Educational Psychologist* |
| Repeating a claim raises belief in it, even when the reader knows better, and a "disputed" tag does not undo it. A source seen as not credible dampens it. | Well-established for passive exposure; **inference** for spaced review | Fazio 2020; Pennycook, Cannon & Rand 2018, *JEP: General*; Orchinik, Bhui & Rand 2024 |
| Meeting conflicting nutrition advice with no explanation goes with confusion, then distrust of the whole field ("backlash") and worse eating. | Moderate (surveys, one RCT) | Lee, Nagler & Wang 2017, doi:10.1080/10410236.2016.1278495; Vijaykumar et al. 2021, doi:10.1017/S1368980021000124; Barnwell et al. 2021, doi:10.1007/s10865-021-00256-4 |
| When one side is simply wrong, the wrong idea beside the correction and the reason beats the correction alone (g = 0.41). | Well-established | Schroeder & Kucera 2022, *Educational Psychology Review*; Danielson et al. 2024, *Educational Psychologist* |
| Laypeople explain a disagreement among experts by method and evidence, by the speaker's interests or competence, or by real complexity. They mostly cannot settle it first-hand and judge whom to trust. | Moderate | Dieckmann & Johnson 2019, *PLOS ONE*; Thomm & Bromme 2016, *Reading and Writing*; Bromme, Thomm & Wolf 2015 |

His book library adds: the end state to aim for is a provisional position held with reasons (Perry's "commitment", in *How Learning Works*); clumsy debunking can strengthen a myth (*Evidence-Informed Learning Design*, ch. 7); state the best case against your own view (*Range*).

Gaps: nobody has studied conflicting sources inside spaced review, and most studies are single sessions of students reading.

## What follows for Ore

1. A contested claim names who says it. Already built: `enrich.md` ("For opinion pieces or contested claims, attribute the claim"), `variant.md` rule 3, checked by `eval/questions.ts`.
2. Never a bare "these disagree": a conflict comes with why the two differ, and only for an idea central to both sources.
3. Ask for the best case for each side before where he lands.
4. A one-sided exercise must not go on being rehearsed once a conflict is known.
5. "Ore never picks a winner" is false balance when one side is out of date (learning styles). Tyler's pick, 2026-11-17: the question stays neutral, and after his answer Ore may say where the wider evidence leans, with outside sources.

## Detection test (2026-11-17)

Six real web articles imported with `ore add` into a scratch library (three on seed oils, three on learning), checked with Sonnet in two steps: each source's main claims with a word-for-word quote and a line on who is speaking, then a newly finished source's claims against the others in its skill. Three runs with each source as the new one.

- Both real conflicts (seed oils and inflammation; learning styles) were found in 6 of 6 runs each, with quotes found word for word in the articles.
- The source that disagrees with nothing came back empty in 3 of 3 runs. No false alarm among conflicts marked central.
- Conflicts marked minor came and went between runs: keep central ones only.
- It returned two to four conflicts per pair, so they need merging into one. The kind label wobbled, and it never called a claim out of date from the two sources alone.
- Untested: books, a skill with twenty or more sources, and comparing a new source against existing exercises instead of extracted claims.

Script, claims and results: project files, `conflicting-sources/`.

## The plan that waits

No new element on screen. When a new source is drafted, it is also checked against the skill's existing Explain exercises. An exercise the new source contradicts gets a "two sources" remix (a new type in `variant.md`): the normal exercise screen, both passages quoted with who is speaking, "What is the strongest case for each, and why might they differ?". Why they differ and where the wider evidence leans, with sources, go in the feedback he already gets. Retiring the exercise is the dismiss. It replaces a review he would have done anyway, so the queue does not grow.

Left out on purpose: a separate exercise type, a label for the kind of disagreement, a saved "where I land" line, a memory of dismissed false alarms, and a claims list kept per source.
