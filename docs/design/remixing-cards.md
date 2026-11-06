# Remixing review cards

> **Status:** designed and decided by Tyler on 2026-10-24, built 2026-10-25 and recorded as D66 (amends D24 and D59); `DECISIONS.md` wins where they differ. Came out of recommendation 7 in the [science audit](../reviews/2026-10-24-science-audit.md).

## The short version

Once he knows a card, it comes back as a fresh version that asks him to use the same idea on something he hasn't seen. Each version is checked against one rule: **it may only require what the original card's key points already require, and it must not be answerable by repeating the original answer.**

- Explain cards get new scenarios and new kinds of question (predict, diagnose, spot the error). The evidence supports these best.
- Definition cards get one kind: "here's a case, which term is it and why?"
- Fact cards (numbers, specific claims) and changing which cloze is blanked are **not** remixes.
- Remixes start only after two passes on the original, return to the original after a miss, and share the original's schedule.
- Variants are written in the background, checked by a second AI call and by a plain overlap test in code, and he can throw out a bad one with one key without it counting.

## What the evidence says about each kind of change

| Change | What the research found | Verdict |
| --- | --- | --- |
| Rewrite the scenario, same question | Answering about different examples beat repeating the same one, on new examples two days later, in all 4 experiments ([Butler 2017](https://consensus.app/papers/details/754d0960e3a25ea59dd489d7e9aaa4fd/)). Items with the same structure and new surface details stopped people answering by memory, about as well as a full rewrite ([Shappell 2022](https://consensus.app/papers/details/a2ded361f10b51c7961563d0935fcf22/)). | Yes, the main remix |
| New question on a new scenario (predict, diagnose, choose and justify) | Practice tests transfer best to application and inference questions and across formats, d = 0.40 overall ([Pan & Rickard 2018](https://consensus.app/papers/details/c5cee08032d85fd58244269b72d268a6/)). Application quizzes improved both definition and application exam questions; definition quizzes did not help application ([McDaniel 2013](https://consensus.app/papers/details/f06e918f0d4950ea84fd8548152cc4ef/)). | Yes |
| Swap the question type | Across formats transfers well (Pan & Rickard 2018). Short answer helped in university courses and multiple choice did not ([Greving 2018](https://consensus.app/papers/details/d2ca04a7655359579e112aea222270bd/), [2022](https://consensus.app/papers/details/96995618cedd58b9a35dd16937ee3b13/)). Reversing a Q/A pair transfers worst. | Only to another type where he writes the answer. No multiple choice, true/false or reversed cards |
| Change which cloze is blanked | Transfer between different blanks of the same sentence is limited. Each blank is its own memory. | Not a remix |
| Pure rewording | Smaller benefit than a new example (brief §6). A surface change does stop a repeat being spotted as one ([Dellarosa 1985](https://consensus.app/papers/details/aecdc1c681ef5bba925a84536b6f6dc2/)). | Only as part of a new scenario |

One caution shapes the timing. In a real course, varied items helped transfer less than expected, and students with weaker grasp did worse on them ([Foss 2023](https://consensus.app/papers/details/fe3c5b77e9855a3890974f8766c80f3b/)). Variety pays once the base idea is in place, so remixes wait until he has passed the original.

## Variant types, by card kind

Example original (Explain): "Why do prequestions help you learn from a text, and when do they not help?" Key points: they direct attention to what they ask about; they don't help with material they don't ask about; broad questions spread that benefit wider.

| Type | For | What changes | Example |
| --- | --- | --- | --- |
| New case | Explain (concept, procedure) | The situation; the ask stays the same | "You're opening a YouTube explainer on habit loops. Why would two questions on screen at the start help, and what would they not help with?" |
| Predict | Explain | The ask becomes "what happens if…" | "A teacher gives five narrow trivia prequestions before a chapter. What will students remember better and worse, and why?" |
| Diagnose or spot the error | Explain | A short claim or plan containing one mistake to find and fix | "A colleague says: prequestions work because they make people read more carefully overall. What's wrong with that?" |
| Choose and justify | Explain, where the card names an alternative | Pick between two options for a case and say why. Written, never ticked | "For a workshop, two broad questions or ten specific ones? Defend your pick." |
| Name it from a case | Definition (Fact) | A short new case; he names the term and says what makes it fit | "Before reading, you answer 'what do you think causes X?' and get it wrong. What is this called, and why does it still help?" |

Not remixed: Fact cards for a number, date, name or specific claim; cloze cards keep their blank. Procedure cards get New case only.

## Staying inside the card

The boundary is the original card's key points. A variant passes only if all three hold:

1. **Every key point maps back** to an original point, at least one tests the main idea, and nothing tests an idea outside the original's points.
2. **Answerable from the card alone.** Any fact the scenario adds is stated in the question itself.
3. **Same claim, same caveats.** The variant never makes a claim stronger or broader than the source does.

Three checks enforce it, in order:

1. **The writer** (prompt `variant`) gets the card, its key points, the passage and his note, plus the variants already made. It returns the question, a model answer, and its key points, each mapped to an original point.
2. **Plain checks in code** (`packages/core`, no AI): every mapping points at a real original point, there are 2 to 4 points, and the overlap test below passes. A fail is retried once, then dropped.
3. **A second AI call** (prompt `variant-check`) answers yes or no to items 1 to 3 and to "does the question give its answer away?". A no drops the variant and records why.

In review he has the last word: **B** ("Bad version") throws out the variant, the review is not logged, and the original is shown instead. The rejection goes into the card's file so the writer sees it next time.

## Different enough that he can't just recall the answer

Repeating the original answer word for word should earn partial credit at most:

1. **One point is tied to the new case**, so a memorized general answer misses it.
2. **No shared wording.** The code check rejects a question sharing a run of 5 or more words with the original question or answer, apart from the name of the idea.
3. **A new setting each time**, rotating through his skills' hooks, never the source's own example or an earlier variant's setting.
4. **The ask changes too.** The next variant is a different type from the last one shown.

## When variants appear and how they're scheduled

One memory per card. Variants change how it is asked, never when.

- **Starts after two passes** (last two reviews of the original rated Good or Easy).
- **A miss goes back to the original** until it has two passes again.
- **Rotation:** variant, variant, original.
- **Each variant is used twice at most**, then retired and a new one written.
- **One schedule:** FSRS sees one card; every review updates it. Strength (D62, D63) counts cards, not versions.
- **Written ahead, never during review**, by the background enrich queue (up to two at a time). If none is ready, review shows the original.

Storage: `cards/<id>.variants.jsonl` beside the card file, append-only with revisions like `annotations.jsonl`. Each review in `reviews.jsonl` gains `variant: <id>` when one was shown.

## In review

A variant works like any Explain card (D21, D59). New: no label; after the answer, one line "Same idea as: <original question>"; **B** drops the variant; **E** edits the variant; Ask about this (/) sees the variant and the original.

## Decided (24 Oct)

1. **Definitions:** remix them with "Name it from a case".
2. **Cloze:** no extra cards. A cloze card keeps its one blank and is never remixed. Remixing never creates a card.
3. **Timing:** start after two passes and rotate variant, variant, original. A **Remix cards** switch goes in the goal settings popover on Home (on by default). Turning it off shows only originals and keeps variants already written.
4. **Label:** none.
5. **Drift check:** ours to watch, not his. `ore stats --json` reports variant vs original pass rates, and we fix the prompts when variants run well below. The app shows him nothing about it.

## Across kinds of knowledge

Keep what the card tests, change everything around it.

| Kind of knowledge | A remix changes | It keeps | How the answer is checked |
| --- | --- | --- | --- |
| Concepts and principles (Explain cards) | The case and the kind of question | The idea's key points | AI marks against the key points |
| Math procedures | The numbers, the story, how the givens are written | The method and its number of steps | Computed by code, never judged by AI |
| Choosing a method | Mixed problem types: "which method fits, and why?" | The cue that tells the types apart | AI marks the choice and the reason |
| Definitions and terms | A short new case to name | The term and what makes it fit | AI marks the name and the reason |
| Vocabulary in a language | The sentence around the word | The word and its meaning | Exact match, with AI for close spellings |
| Plain facts | Nothing | The fact | Self-rated, as now |

For math, a remix is a new problem with the same structure ("solve 3x + 7 = 22" becomes "a plan costs $7 plus $3 a month; when has he paid $22?"). Same-structure practice transfers most ([Schwerter 2026](https://consensus.app/papers/details/f5c38d96199c59719227c032a7e09d83/)), and mixing problem types beat blocked practice in a classroom trial (d = 0.83, Rohrer 2019). Math adds three rules: code checks the answer, same difficulty, and no numbers that produce the original's answer. The app has no math display or exact-answer checking yet; design that when a math skill exists.
