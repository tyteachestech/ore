# Questions → research: design options (2026-10-25)

> **Status:** Tyler picked the hybrid on 2026-10-25; built and recorded as D75. `DECISIONS.md` wins where they differ. Since 2026-10-28 Research is not a highlight type (D91); research starts from a question.

## What NotionRPG did
Source: `_tabled/notionrpg/memory/knowledge-inquiry-loop-design.md` and `_tabled/notionrpg-app/docs/design/spec-learning-foundation.md` on Tyler's Mac.

- A Question highlight ended one of two ways: **Mark Answered** (cheap, in place, no typed answer needed) or **Transfer / Continue as Inquiry**, which made an Inquiry note seeded with the question, its passage and the source's skills. Repeating it opened the same Inquiry.
- The answer went in the Inquiry body, in his own words (self-explanation, g ≈ 0.35). Answered inquiries were "prime flashcard material: offer, never require".
- **Multi-source: mentions, not relations.** A many-to-many relation was rejected as chore. An "Add Source Note" button created a *new* source from the inquiry with provenance both ways (1 click vs 6 steps); @-mentions linked *existing* ones.
- **Menu, not backlog:** no counts, no overdue framing, no obligation to close. Later the closed state was dropped: a written answer is the end.

## Today in Ore (D47)
Question row: **Find sources** (D17, 3–5 AI picks, one click adds one, filed under the skill) and **Answered** (status done, nothing written). Added sources are not linked back to the question; there is nowhere to write the answer on the question.

## Options

### A. Inline (smallest) — (mockup in project files)
Row actions: **Answer** opens a field under the question; ⌘↵ saves his answer on the question and marks it answered (answered rows show the answer). **Begin research** = today's Find sources; a source added from it is linked to the question and shows as a chip under it (with To read / Reading / Done). Linking an existing source: ⋯ → "Link a source…" (cmdk picker).

### B. Question page (NotionRPG Inquiry) — (mockup in project files)
**Begin research** opens a page for the question: "Your answer" in the note editor (blocks, [[ links to sources), a Sources list (added from here, or linked in the answer) and AI suggestions. Mark answered in the header. Most room to think, but a new object with its own full lifecycle, and it overlaps the skill note.

### C. A + questions follow you into sources (recommended) — (mockup in project files), (mockup in project files)
Everything in A, plus: when a source is captured under a skill, enrichment checks it against that skill's open questions. A match shows on the question row as a dashed **May answer it** chip, and at the top of that source in the reader as **Your question**, with an answer field. Answering there saves the answer and links the source automatically; "Not answered here" drops the match. Zero manual attaching, and his own question works as a prequestion while he reads (pretesting effect, d ≈ 0.44 and up, Pan & Carpenter 2023).

## Shared rules (all options)
- No counts or badges for open questions (D23, menu not backlog). Questions never become cards by themselves (D19).
- AI suggests matches and sources; only his click links or adds (D17).
- Data: `answer` and `sources: [item ids]` on the question annotation (append-only revision, as status is today). C adds `questions` to the enrich output (prompt version bump).
- Deferred: a satisfying completion animation on Answered; offering a card from an answered question.

---

# Is it a good idea? Evidence and UX check (2026-10-25)

## Verdict
Yes, with three changes to option C. Asking your own questions and then finding the answers in what you read is well supported. The risks are noise (bad matches), clutter at the top of the reader, and open questions turning into a guilt pile. Each has a cheap fix, listed below.

## Science
| Claim the design relies on | Evidence | Strength |
|---|---|---|
| Reading with a question in mind helps you learn the answer | Prequestions → the content they target: g = 0.54, k = 97 (St. Hilaire, Chan & Ahn 2024 preregistered meta-analysis); pretesting d = 0.44 to >2.0 at 24 h+ (Pan & Carpenter 2023). Already in `docs/research/brief-learning-science.md` §8. | Moderate |
| ...but only the answer, not the rest of the text | Content that wasn't prequestioned: g = 0.04 (≈ none). So his question helps him learn *its* answer, not the whole source. Fine: that's the point of a question. | Moderate |
| Your *own* questions work too | Writing your own questions beats rereading and is about as good as answering given questions (Weinstein, McDermott & Roediger 2010). Self-generated *conceptual* questions help memory for conceptual content specifically (Bugg & McDaniel 2012). Teaching people to generate questions: median ES 0.36 on standard tests, 0.86 on researcher tests (Rosenshine, Meister & Chapman 1996, review of 26 studies). | Moderate |
| Curiosity makes the answer stick | A high-curiosity state improves memory for the answer, and even for unrelated things learned meanwhile (Gruber, Gelman & Ranganath 2014, Neuron). Curiosity is strongest when you feel you almost know (Wade & Kidd 2019). His own question is curiosity by definition. | Moderate (lab, trivia) |
| Writing the answer in your own words is the learning act | Self-explanation g ≈ 0.55–0.87; generation effect. Brief §2, §4. NotionRPG reached the same rule. | Moderate–strong |
| AI-curated sources beat open-ended "go research it" | Minimally guided inquiry learns less than guided (Kirschner, Sweller & Clark 2006). D17's 3–5 picked sources keep research guided. | Moderate |
| Open questions must not become a backlog | Confronting learners with unanswered questions cut persistence in an optional MOOC (Janelli & Lipnevich 2021, one study). Unfinished goals nag less once a plan exists (Masicampo & Baumeister 2011). NotionRPG landed on "menu, not backlog". | Preliminary |

Not supported, so not claimed: that linking sources to questions helps by itself (storing links has no effect, Bisra 2018 via the NotionRPG brief). Links are there for navigation, not for learning.

## UX check
- **Precedents.** Answer inline: Linear and GitHub let you resolve an issue in place. Auto-suggested links: Obsidian's "Unlinked mentions" (suggested, one click to confirm) and GitHub's "may fix #12". Suggestions are never silent links, which matches D17's "AI suggests, Tyler clicks".
- **Purpose check.** Each element has a purpose: the Answer field is where the learning happens; the source chip is how he gets back to the source; the "May answer it" chip tells him which source to read next for this question; the reader prompt is the prequestion effect. No counts or badges.
- **Risk 1, noise.** A wrong match wastes his attention. Fix: show a match only when the AI quotes the passage that answers it (anchored like highlights, dropped if the quote doesn't anchor, as D56 does). "Not answered here" removes it with one click.
- **Risk 2, clutter at the top of the reader.** A second box above "What do you already know?" competes with it. Fix: put his matched questions *inside* that block, labelled "Your question", at most 2. Clicking the quote jumps to the passage only after he has written something (D34.3: attempt first).
- **Risk 3, guilt pile.** Fix: no counts anywhere, open questions capped at 5 with "Show all" (already there), and "Let go" in the ⋯ menu as a soft archive next to Delete.

## Revised recommendation: C, refined
1. Question row: **Answer** (inline, own words, ⌘↵ saves and marks answered) and **Begin research** (today's Find sources). A source added from it is linked and shows as a chip.
2. On capture, enrichment matches the new source to the skill's open questions, but only with an anchored supporting quote.
3. A matched question shows as **May answer it** on the row, and as "Your question" inside the reader's "What do you already know?" block (at most 2), with an answer field.
4. Answering anywhere saves the answer on the question and links that source.
5. Future: a completion animation on Answered; offering a card from an answered question (offer, never require).

---

# Option D: questions in the reader's side panel (Tyler's idea, 2026-10-25) — (mockup in project files)

While reading, **Q** (or ⌘K "Questions") swaps the right panel from Source note to **Questions**: the open questions of every skill this source is filed under. Same panel, two tabs (Source note N, Questions Q), like Notion's side peek and Linear's details panel.

- Top group, **May be answered here**: questions enrichment matched to this source with an anchored quote (C's matching, without the extra box at the top of the reader). Clicking "Jump to the passage" scrolls there.
- Then the rest, grouped by skill. Questions asked in this source are marked "from this source".
- Click a question to open a box under it. If text was selected when he pressed Q, the selection comes in as the quote. He writes in his own words, then:
  - **Save contribution** (↵): adds a dated entry to the question's answer, with this source and quote. The question stays open. Partial answers from several sources build up.
  - **Answered**: saves and closes the question.
  - **Answered + card** (⌘↵): saves, closes, and drafts a card from his answer and the quote ("from your answer", reviewed like any other draft).
- **Contributing is what links a source to a question.** Many sources per question happen naturally, with no separate attach step. The question row on the skill page shows "2 contributions · from A, B".

## Science check for D
- Same support as C: his question is a prequestion for the passages that answer it, and writing the answer in his own words is self-explanation.
- Answering *while the source is open* is fine for the first write (note-taking with the text available works; Brief §2). Retrieval comes later, from the card.
- **Answered + card** is "offer, never require" (NotionRPG's rule, and the brief's "answered inquiries are prime card material"). It needs a small change to D19: a question never becomes a card *by itself*, only when he presses this button. AI drafts the card from *his* answer, so it stays his words (D21 untouched).
- Risk: the panel lists every open question for broad skills. Fix: matched ones first, the rest folded per skill after 5, no counts.

## Recommended: hybrid of A + D
- Skill page: inline **Answer** and **Begin research** (A). Contributions and source chips show under each question.
- Reader: the Questions panel (D), with C's matching only as the top "May be answered here" group. No box at the top of the reader.
- One answer model everywhere: contributions, each with its source and optional quote. Answered, or Answered + card.
- Dropped: the question page (B), and C's separate "Your question" block.
