# Impeccable critique, round 3: Ore desktop (2026-10-25)

Same method as round 2 (`2026-10-25-design-critique.md`): A = design review in Chromium against the mocked app, B = `impeccable detect` + overlay + contrast. AI commands return null in the mock, so AI failure paths were judged, not AI output.

**Score: 30/40 (Good), up from 28.** Help reached 4 (searchable ⌘/ sheet, footer hints per step, intent placeholders); Error prevention reached a low 3.

| # | Heuristic | R2 | R3 | Key issue at the time of scoring |
|---|---|---|---|---|
| 1 | Status | 3 | 3 | Archive/restore waited ~0.7 s for the CLI; reader blank while opening; "Card 4 of 3" announced at wrap-up |
| 2 | Real world | 3 | 3 | "markdown" type column |
| 3 | Control | 3 | 3 | Undo toast closed after 6 s even while hovered; "Delete skill…" still confirms |
| 4 | Consistency | 3 | 3 | Strength worded two ways; `esc` vs `Esc` |
| 5 | Error prevention | 2 | 3 | Selecting inside a highlight stacks a second one; Tab left the highlight note |
| 6 | Recognition | 3 | 3 | Home has no arrow-key selection |
| 7 | Efficiency | 3 | 3 | No multi-select in the sources list |
| 8 | Minimal | 3 | 3 | Day one: "0 of 5…" on every tile; empty prequestion strip on finished sources |
| 9 | Error recovery | 2 | 2 | A failed AI check left him to rate unaided, with a bracketed error |
| 10 | Help | 3 | 4 | — |

Detector: 231 findings, all token drift in `styles.css` (font-size 116, radius 67, colour 39) plus D62 springs and 3 side-tab false positives. One new live contrast failure: the ⌘/ search placeholder (3.5:1), fixed.

## Fixed in this round
- **AI check fails in review:** he marks the key points himself and gets a suggested rating, as for in-head answers (D68), with "Couldn’t check this one. Mark what you got, or try again." and a working try again.
- **Archive and Restore** act at once (optimistic, rolled back on error). The **Undo toast holds** while the pointer or focus is on it.
- **Tab stays in the highlight note**; the reader shows a quiet "Opening…" only if opening takes a beat; finished sources hide unanswered prequestions.
- **Confidence buttons:** selected is filled, focus is an outside ring, so they no longer look alike.
- **Copy:** one strength wording ("N of 5 solid memories to level 1"); `Esc` everywhere; the screen-reader line goes quiet at wrap-up; shortcut search placeholder uses the `faint` token.
- **Skill page (D72, Tyler picked layout A):** stat chips and "Nice going" line removed; Strength in the header (number, line, bar; click for the split, growth and "You can now explain"); Sources then Questions on the right.

## Purpose sweep (Tyler's rule, AGENTS.md)
Removed because they had no purpose for him:
- The four skill-page stat pills (done, cards, reviews, retention) and the "N sources finished. Nice going." line.
- The "0 of 5 solid memories to level 1" line on Home tiles on day one.
- The file-format word ("markdown", "epub", "youtube") on every source row and on skill-page rows.
- The Sources header's "1 to read · 1 done" while open (the tabs already show the counts; it stays when folded).
- Unanswered prequestions on a source he has already finished.

## Still open
- Selecting inside an existing highlight stacks a second one (behaviour change; next round).
- Home arrow-key selection; sidebar costs 3 Tab stops per group.
- Multi-select and bulk actions in the sources list (left out under the purpose rule until he asks).
- Add doesn't open or select the new source; "Delete skill…" confirm vs Undo elsewhere.
- Palette fuzzy-matches actions and skills ("rev" finds "Creativity").
- Type/radius/shadow tokens: 16 sizes and 22 radii against a 3-step documented ramp.
- The warm-up card nests inside the note card.
- "Rescued" on every seeded card is correct for the seed (its cards are reviewed days late); check against real data.
