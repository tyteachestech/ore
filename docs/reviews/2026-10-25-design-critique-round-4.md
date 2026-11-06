# Impeccable critique, round 4: Ore desktop (2026-10-25)

Same method as rounds 2 and 3. **Score: 30/40, flat on round 3.** Error recovery rose to 3. Consistency fell to 2 on new findings: the header bar looked like Home's meter but meant something else, and Esc kept drafts in one dialog and dropped them in another. Both are fixed below. Each round's reviewer finds a fresh layer of smaller issues, so the total is holding at "Good" while the issues get smaller.

Detector: 230 findings, all token drift in `styles.css`; no live contrast failures.

## Fixed in round 4
- Selecting inside a highlight opens it instead of stacking a second one.
- Arrow keys move across Home's skill tiles and Continue reading.
- ⌘K matches actions and skills by word start ("rev" finds only Start review).
- Finish quiz: an empty key-points reply fails instead of hanging, and each failed AI step offers try again.
- Leaving review before rating no longer says "All caught up" while cards are due.
- Esc in the skill warm-up keeps what he wrote as a draft.
- The skill header bar is the same level meter as on Home tiles; the solid/growing/new split moved into the popover. A skill with no cards shows no Strength.
- Errors name the action that failed (find sources, answer, save your recall).
- The closing card's button reads "Done"; the multi-add toast drops "Nice haul!".
- Purpose sweep: the warm-up's 🧠, Questions' "N open" while open, and the warm-up as a nested card (now a flat tinted band).
- Tokens: type ramp down to 11 sizes and radii to 9, both documented in DESIGN.md. No overshoot on toasts or the collected pill. `text-wrap: pretty` in the reader.

## Needs Tyler
- ⌘R from the reader: return to the same place after review (today it lands on the list).
- A question typed on the skill page is stored as a snippet source, so it also shows in To read and in counts.

## Still open
- Home tiles and Continue reading rows have no ⋯ or right-click menu.
- "Delete skill…" confirms instead of offering Undo.
- Add doesn't open or select what it added.
- Shadow tokens.
