# Components fit to how Ore teaches (2026-11-09, round 3)

Tyler asked again for shadcn-based alternatives to Ore's components, this time only ones that fit the learning
workflows Ore is settling on, not basic swaps. It is the redo he asked for when he tabled the Cult UI round
(`2026-11-09-cult-ui.md`, PR #205): the same question, asked of free libraries. This is a pitch list: nothing is
built until he picks.

**Workflows checked against:** the daily session over a standing backlog (`design/daily-session.md`); reading,
highlighting and turning highlights into cards; the tutor's Practice with its committed card and tell apart
(D158); prequestions, confidence and calibration (D18, D21, D69), quizzes, skills and their progress.

**Searched** with `bunx shadcn search` (what the repo's shadcn MCP runs) over shadcn's registry directory, now
548 registries. Each one's description was screened for learning, study, quiz, reading, annotation, audio,
citation, diff, chart and pixel pieces, then the hits were read item by item: Mischief (274 items), assistant-ui
(175), Dice UI (267), drift-ui, Scrim UI, 8bitcn (121), Delta, lmscn (10), Beadkit (27). Licenses read from each
repo's LICENSE file, not the site.

**Already built from rounds 1 and 2** (not re-pitched): source pills with hover cards, evidence words at Review's
check (D141), Show me in steps with a step track (D142, D150), figure zoom (D143), the dot-matrix wait (D146),
the review timeline (D149), reading previews (D151), the phone's section pill (D152), the finish burst (D153), the
due-question fan (D154), the phone's stepping sheet (D155).

**Constraints kept:** the purpose rule (each pitch names what he learns or does better); D120 (every code source
below is MIT; Beadkit's MIT + Commons Clause and lmscn's missing LICENSE make them ideas only, as Rare UI is); Ore
runs on Radix with its own tokens and pixel icons (D157), so "adopt" means take the structure and logic, swap
lucide for `icons.tsx`, and restyle by hand; D23 (no streaks or scores).

## Ranking

★ = the ones I'd build, in order.

| # | Pitch | Workflow | Replaces / adds | Code from (license) | Effort |
|---|---|---|---|---|---|
| ★1 | Cards from a figure: hide its labels, recall them | Highlight → cards, Review | Nothing: a figure can't become a card | Mischief `redaction`, `bounding-boxes` (MIT); idea from lmscn `hotspot` | L |
| ★2 | Tell apart shows its two cases side by side | Practice (D158) | Two cases inside one paragraph | assistant-ui `elements-comparison-card` (MIT) | M |
| ★3 | Practice feedback marks each point with his words | Practice (D158) | Feedback prose; the `covered` marks stay hidden | assistant-ui `elements-confidence-marker` (MIT), D141's own marks | S–M |
| ★4 | See what a card rewrite changes | Review › Ask about this card | "Suggested card" shown whole | drift-ui `diff-viewer` (MIT), word level | S |
| 5 | Calibration across all three confidence taps | Daily session, end screen | One line about Sure only (D69) | Ore's pixel bar; look from 8bitcn `chart-bar` (MIT) | S |
| 6 | Audio plays in place, highlights on its bar | Reading podcasts and lectures; video | Audio read only as its transcript | Mischief `audio-player`, `transcript-viewer`, `scrub-bar` (MIT) | L |
| 7 | Keep part of a tutor reply | Tutor → note, cards | + Card on a whole reply only | assistant-ui `elements-quote-reply` (MIT) | M |

The Cult UI round's four tabled ideas (owl morph, reword popover, stop button, steady reveal) didn't come back:
no free library had a better take on them than Cult UI's. ★4 is close to the reword popover but sits in a
different place (Ask about this card in Review, after an answer) and is about seeing the change, not making it.

Pictures of each component as its library shows it: `/mnt/project-files/learning-components/` (crops of the live
demo pages, 2026-11-09). Ore's version is drawn in Ore's tokens, not the library's look.

## ★1 Cards from a figure: hide its labels, recall them

- **Adds:** in figure zoom (D143), drag a box over a label or part of a diagram. Each box becomes its own Fact
  card (one idea per card, D147): in Review the figure shows with that box covered and the others visible, he
  recalls what's under it, and the confidence key reveals it (D59.2's Fact flow, no typing).

  ```
  ┌─ figure: the heart ────────────────┐       Review
  │   ┌──────┐                         │   ┌──────────────────────┐
  │   │ ████ │ ← box 1   ┌──────┐      │   │  [figure, box 2 ███] │
  │   └──────┘           │ ████ │ ←2   │   │  What's here?        │
  │                      └──────┘      │   │  1 Guess 2 Think 3 Sure
  └────────────────────────────────────┘   └──────────────────────┘
  ```

- **Why:** today nothing in a figure can be learned with Ore. Text can be highlighted into a card; a labelled
  diagram, a map, a slide's chart or an anatomy plate can't, though textbooks and slides are in the core promise
  (D122) and those are where the figures are. Retrieval works on pictures as it does on words: testing on a map
  beat restudying it for later redrawing (Carpenter & Pashler 2007, PMID 17874591). Image occlusion is the
  Anki add-on most textbook learners install for this reason.
- **From:** Mischief `redaction` (MIT): drag to draw regions over an image, stored as fractions of its size, with
  a reveal. `bounding-boxes` (MIT) draws the saved regions read-only, for Review. lmscn's `hotspot` (typed labels
  on a diagram) gives the idea only: its repo has no LICENSE file.
- **Needs:** a D-line, and core storing a card's figure (its asset path in the source) and box. Leaves out
  typing the label (D59.2) and "hide all, guess one" until he asks for it.

## ★2 Tell apart shows its two cases side by side

- **Replaces:** a tell apart arrives as one paragraph with both cases in it (D158).
- **Behaviour:** the two cases sit in two columns, A and B, each with its own line under it for "which idea
  fits, and what decides it". On a narrow window or the phone they stack. His answer goes back as today.

  ```
  ┌ A ─────────────────────┐ ┌ B ─────────────────────┐
  │ A teacher quizzes the  │ │ A teacher quizzes the  │
  │ class the day after…   │ │ class a month after…   │
  │ ▸ fits: ____ because __│ │ ▸ fits: ____ because __│
  └────────────────────────┘ └────────────────────────┘
  ```

- **Why:** comparing two cases is what teaches the difference, and it works when the cases are compared, not read
  one after the other (Gentner, Loewenstein & Thompson 2003, analogical encoding; Alfieri, Nokes-Malach & Schunn
  2013, the meta-analysis D158 already cites). Side by side, the detail that decides it is the thing his eye
  goes to. The two answer lines make him commit to each case before the feedback.
- **From:** assistant-ui `elements-comparison-card` (MIT): two options in columns, the pick named under them.
  Ore leaves out its "pick" badge and the check marks (his answer is the pick).
- **Needs:** `tutor@10` returns a tell apart's cases as two fields instead of prose; `eval:tutor` keeps its
  judge on "doesn't name the idea".

## ★3 Practice feedback marks each point with his words

- **Replaces:** after a Practice answer, feedback in prose. Since D158 the tutor already marks each point of the
  committed card covered or not, but he never sees the marks.
- **Behaviour:** under the feedback, the card's 2 to 4 points with a mark each, the same marks as Review's check
  (D141): hover a covered point and the words of his that earned it are underlined; a missed one says so. +
  Card still appears only on a miss.
- **Why:** it's the most useful feedback there is: which parts of the idea he has and which he doesn't, tied to
  what he wrote (informational feedback, Deci, Koestner & Ryan 1999). It makes Practice and Review read the
  same, so he learns one way of checking himself.
- **From:** assistant-ui `elements-confidence-marker` (MIT), which D141 already adapted for Review: this reuses
  Ore's own marks, so no new component.
- **Needs:** the tutor to quote the shortest stretch of his answer per covered point, checked by core as
  `grade@3`'s quotes are.

## ★4 See what a card rewrite changes

- **Replaces:** in Review's Ask about this card, "Suggested card" shows the new question and answer whole, and Use
  this card replaces the old one (`Ask.tsx`).
- **Behaviour:** the suggestion shows as a word-level change to the card: removed words struck through, new ones
  marked, one card, no side-by-side. Use this card stays as it is.

  ```
  What does ~~spacing~~ **spaced practice** improve, compared with ~~cramming~~ **massed practice**?
  ```

- **Why:** a rewrite should make the same question clearer. If it changes what is asked, his FSRS history no
  longer fits the card. Seeing the words that changed shows which one it is in a second, where comparing two
  whole cards takes a careful read.
- **From:** drift-ui `diff-viewer` (MIT; Radix and Base UI builds) for its word-level diff, in its inline mode.
  assistant-ui `elements-reviewable-diff` (MIT) is the alternative if he wants to keep parts of a rewrite.

## 5 Calibration across all three confidence taps

- **Replaces:** the weekly line "When you say Sure, you're right N% of the time" (D69).
- **Behaviour:** three short pixel bars, Guess, Think so, Sure, each filled to how often he was right when he
  said it. The hover hint gives the counts.
- **Why:** the Sure line says whether he is overconfident; it can't say whether his confidence means anything.
  If Guess and Sure are right as often as each other, his taps carry no information, and that is the thing to
  fix (resolution, not just bias). Same data, same weekly place.
- **From:** Ore's own pixel bar (bars are one of the places 8-bit means something); 8bitcn's `chart-bar` (MIT) is
  only the look, since it wraps Recharts, which Ore doesn't need for three bars.
- **Needs:** amends D69. Guess and Think so need their own minimum counts before they show.

## 6 Audio plays in place, highlights on its bar

- **Adds:** a podcast or recorded lecture plays above its transcript, as video does (D48): a waveform he can scrub
  with his highlights as ticks on it, and every transcript line seekable. The same ticks go on `Video.tsx`'s
  scrubber (round 1's 10).
- **Why:** going back to the moments he marked is how he reviews a lecture; today an audio source can only be
  read.
- **From:** Mischief `audio-player` (MIT: waveform, position, transcript lines that seek), `transcript-viewer`
  and `scrub-bar` (MIT). ElevenLabs UI (MIT) has a similar player.
- **Needs:** core to keep the audio: an audio source's saved original is its transcript (`.vtt`, in
  `ingest/index.ts`), though D122 promises the original is kept. That is the long part; the player is M once the file is there. Round 2's 6, now with code
  to start from.

## 7 Keep part of a tutor reply

- **Adds:** select words in a tutor reply and a small toolbar offers Card and Into note, as the reader's popup
  does for a source.
- **Why:** the line worth keeping is usually one sentence of a reply, and today + Card takes the whole reply.
- **From:** assistant-ui `elements-quote-reply` (MIT). Round 1's 4, still open; it has code to start from now.

## Looked at, left out

- **Recognition formats** (lmscn `match`, `order`, `quiz`; Mischief `sortable-list` as a sequencing exercise):
  picking or arranging given answers is weaker than recalling them, and Ore's cards and Practice are recall.
- **Typing into a cloze** (lmscn `fill-blank`): D59.2 keeps Fact cards in the head; typing slows a card for no gain
  (Smith, Roediger & Karpicke 2013).
- **Against D23:** 8bitcn `xp-bar`, `health-bar`, `quest-log`, `game-progress`; assistant-ui `heat-graph` and
  `elements-activity-graph` and the `@heatmap` registry (streak calendars); lmscn `progress-tracker` (XP, streak).
- **Ideas only (license):** Beadkit's learning set (`quiz`, `flashcard`, `sequence`, `mastery`; MIT + Commons
  Clause). Its `mastery` pairs a self-rating with a measured score per skill, a skill-level calibration that
  could join 5 later. lmscn (no LICENSE file in its repo).
- **Already built or not for learning:** Mischief `floating-index` and `table-of-contents` (the rail and pill),
  `thinking-state`, `chain-of-thought`, assistant-ui `elements-reasoning-panel` (the matrix wait, D146), Delta's
  swipe deck (the phone already swipes, D145), `@soonish` and `@dotmatrix` loaders (D146), Mischief
  `annotation-layer` (notes on page regions: a scanned page is OCR'd into text Ore can highlight).
