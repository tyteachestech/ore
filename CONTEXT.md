# Ore glossary

Names as the app says them (D43). Settled decisions: `docs/DECISIONS.md`.

- **Source**: anything Tyler reads: an article, PDF, YouTube video (its transcript), Markdown file, EPUB book, or captured snippet. Stored as an *item* in `items/`; "source" is the UI word, "item" the file and CLI word.
- **Course**: an ordered set of lesson sources that share `course:` in their frontmatter (D79). A course has no file of its own.
- **Highlight**: a passage Tyler selected in a source, with one *type* and an optional one-line *note*. Stored as an annotation; the files and CLI call the type its *intent*.
- **Highlight types**: Keep (worth keeping; drafted into a card only when its note marks a key point), Card (becomes a review card), Question (something to find out). Research was folded into Question on 2026-10-28 (D91).
- **Note**: Tyler's own words on a highlight. Never AI-written.
- **Source note**: Tyler's own Markdown about one source (`notes.md`, was "My notes"). **Skill note**: the same for one skill, across sources.
- **Question**: a Question highlight (or one typed on a skill page). Answered in his own words where the answer turns up (D75); never a card unless he picks Answered + card.
- **Prequestion**: a broad AI-written question shown before reading. Tyler's *attempt* before reading and his closed-book answer at *finish* are stored; neither is scored.
- **Finish**: the closing quiz for a source: text hidden, a *free recall*, prequestions re-asked and checked against their passages, then the closing card. Marks the source done.
- **Free recall**: what Tyler writes from memory at finish, in his own words.
- **Card**: every review item. Two kinds: **Fact** (`card`, flipped) and **Explain** (`prompt`, typed and checked against 2 to 4 key points). A **variant** is a remixed version of a known card (D66).
- **Skill**: one of Tyler's areas (AI, Learning, …) with a priority P1–P3, an optional icon, colour and **collection** (a sidebar group). Sources and cards are tagged with skills.
- **Strength**: a skill's count of solid memories (live cards with FSRS stability of 21 days or more), shown as **gems** (D63, D90).
- **Topic**: an AI-created grouping inside a skill. Exists in the files; not shown in the UI.
