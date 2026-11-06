# Impeccable critique: Ore desktop (2026-10-24)

Method: dual-agent (A: design review in a browser against a mocked app and a seeded library · B: `impeccable detect` + in-page overlay). Impeccable v4.7.1. Tauri has no CDP, so both ran against Vite with a Tauri mock.

**Score: 26/40 (Acceptable, close to Good).** The design is specific to this product (goal ring that never resets, confidence before reveal, blurred source during the finish quiz, "rescued" memories). The weak spots are drift from its own system and a few broken moments, not genericness.

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Status | 3 | Home shows "0 of 10 min" after a session (minutes floored); skill page shifts as the Strength card loads |
| 2 | Real world | 3 | "Original MD", palette titles a source "card: …" |
| 3 | Control | 2 | A missed card can loop back immediately and repeatedly; no undo for a rating |
| 4 | Consistency | 2 | Finish quiz lacks Review's 1/2/3 and ⌘⌫ keys; `title=` tooltips remain beside `<Hint>`; a standing kbd badge in the note header |
| 5 | Error prevention | 2 | A grade with a mismatched rubric suggests Again under "Solid" feedback |
| 6 | Recognition | 3 | Home has no visible keyboard path |
| 7 | Efficiency | 3 | ↵ on Home does nothing (D58 says it starts review) |
| 8 | Minimal | 3 | Standing explanatory copy in Finish and Review; counts repeated on the skill page |
| 9 | Error recovery | 2 | Raw "ore: database is locked" reaches the UI; no error boundary, a bad AI reply blanks the window |
| 10 | Help | 3 | ⌘/ sheet exists but can't be filtered |

## Priority issues
- **[P1] Review end misreports.** "Goal met!" + burst over "0 memories kept"; "Goal met" when he was only caught up; full ring next to "0 of 10 min".
- **[P1] Missed cards loop.** With few cards left, a miss returns at once and keeps returning (D59.3: once).
- **[P1] Reader cramped on a laptop with the note open.** At 1000px wide the column is ~35ch, the title wraps to 7 lines, the prequestion header wraps centred.
- **[P2] Home not keyboard-first.** No ↵ to start review.
- **[P2] Finish quiz and Review keys differ.**
- **[P2] Failures surface raw or blank the window.**

## Detector (B)
- 4 `side-tab` hits; only `.note-editor .callout` (3px accent border, also against "accent only for focus/links") is real.
- `--faint` text on `raised` is 4.2:1 and on `selected` 3.4:1 (placeholders, stat chips, the count on the selected sidebar row): real WCAG misses.
- 195 design-system advisories (19 font sizes, 16 radii vs 3 tokens, undocumented colours): mostly the DESIGN.md frontmatter being a summary, but radii and green-as-primary are real drift.
- Spring easing on cards is intended (D62).

## Minor
Partial verdict uses a check icon; palette footer says "Run" on a source; sidebar count vanishes on hover; "Nothing due" is a disabled green button; highlight popup can cover the selection; mixed sidebar icon styles; typed prequestion answers dropped without Enter.
