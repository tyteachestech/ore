# Impeccable critique, round 2: Ore desktop (2026-10-25)

Method: dual-agent (A: design review in Chromium against the mocked app, 1440×900 and 1000×700 · B: `impeccable detect` + in-page overlay on Home, a skill page, the reader, Review and Settings). Tauri has no CDP, so both ran against Vite with `apps/desktop/scripts/mock/`. AI commands return null in the mock, so AI results and the finish quiz past step 1 weren't judged. No video source was seeded.

**Score: 28/40 (Good, low edge), up from 26/40 on 2026-10-24.** Still specific to this product: the goal ring that never resets, confidence before reveal, "memories kept · rescued", the blurred source during recall, the four intent colours and the dot that flies into the collected pill. Generic parts: the Home skill-tile grid and Settings, both fine where they are.

| # | Heuristic | 10-24 | 10-25 | Key issue now |
|---|---|---|---|---|
| 1 | Status | 3 | 3 | Finishing a source ended in silence (fixed below); skill stat chips blank while loading (fixed) |
| 2 | Real world | 3 | 3 | "markdown" type column, "Original MD" (fixed: shows the file name), "Lv 0" |
| 3 | Control | 2 | 3 | Undo everywhere now, including the last rating (built this round) |
| 4 | Consistency | 2 | 3 | One skill carries three unlabelled numbers on Home; skill-coloured Start pill vs the green primary |
| 5 | Error prevention | 2 | 2 | Digits typed into Explain answers while the footer said "1 2 3 How sure" (fixed); ⌘K offered Archive on a list row he couldn't see (fixed) |
| 6 | Recognition | 3 | 3 | Counts and dots explained only on hover |
| 7 | Efficiency | 3 | 3 | No multi-select in the sources list; ⌘/ sheet not filterable |
| 8 | Minimal | 3 | 3 | Skill strength said three ways on the skill page; day one is a wall of "Lv 0" |
| 9 | Error recovery | 2 | 2 | Raw JS errors reached the UI (fixed: plain message); Finish dead-ended when saving the recall failed (fixed) |
| 10 | Help | 3 | 3 | ⌘/ sheet good, not searchable |

Since round 1 these are fixed: the review end no longer misreports, a miss returns once, the reader no longer cramps at 1000 px, ↵ on Home starts review, finish and review keys match, the disabled green "Nothing due" button is gone, and an error boundary exists.

## Fixed in this round (PR "Critique round 2")
- **Undo a rating** (open since the first interaction audit): ⌘Z or ↺ in the Review header takes back the last rating and shows the card again. Core: `undoReview` drops the card's latest review from the log (a first review puts the card back to draft); `ore review <card> --undo <ts>`.
- **Finishing a source says so:** "Finished “X”. Its new cards start tomorrow." with Undo (back to To read).
- **Explain cards:** the footer no longer advertises 1 2 3 while the answer field has focus.
- **Errors:** JS faults (usually an empty or malformed AI reply) read "Got an unexpected reply. Try again, or carry on without it." Finish offers "Mark done without saving" after a failed save.
- **⌘K** offers Open original, Reveal and Archive for a list row only once the keyboard has selected it, never on Home.
- **Palette:** no "↵ Run" over "No matches".
- **Contrast:** row metadata (type, date, skill-page sub line, note-menu sub) steps up to `muted` on hover and selected rows; `faint` on `selected` was 4.2:1. DESIGN.md already said so; the rows didn't.
- **Settings:** section headings are h2 (were h3 under the page h1).
- **Smaller:** skill stat chips show "—" while loading; "Original MD" shows the file name; the has-note dot uses `Hint` instead of `title=`; the review end shows "Wrapping up…" instead of a blank frame with a stale footer.
- **Interaction gaps closed:** rename a source from its row (Rename… in ⋯/right-click, R on the selected row, inline, Enter saves, Esc restores); questions on the skill page get ⋯ and right-click menus (open passage, find sources, answered, delete with Undo).

## Needs Tyler's pick (layout or behaviour)
1. **The end of reading.** The toast closes the loop; the bigger version is a short closing card in the quiz panel before it closes ("Done · 3 new cards tomorrow · you asked 2 questions"), without pushing an immediate review (D65).
2. **Three numbers per skill on Home.** The sidebar count is sources to read, the chip count is cards due, the tile says "N due · N to read · N done". Options: hide sidebar counts on Home, or label them on hover, or drop due from either the chips or the tiles.
3. **Day one is a wall of "Lv 0".** Say "First level at 5 solid memories" instead, and say strength once on the skill page (today: the big number, "Level 0 · 4 to level 1" and the header "Lv 0 · 1 solid").
4. **"Rescued" on every card.** With the seed data every review counted as rescued just before forgetting; if real data does the same it reads as hollow praise. Worth checking the threshold before changing copy.
5. **The skill-coloured Start pill** on the skill page breaks "one green primary" in DESIGN.md. It's the deliberate playful button; keep, or make it green.

## Still open, no decision needed
- Type and radius tokens: 29 font sizes (12.5/11.5/10.5 px are noise) and 21 radii against 3 documented; no shadow tokens; two near-black "ink on colour" values (`#0f2a19`, `#0d1117`). Document a 5–6 step type ramp and consolidate.
- The `.collect-fly` glow and the 1.6 overshoot on `.collected` and `.drop-hint` (panels, not cards; D62's springs are for cards).
- The warm-up card nests inside the note panel.
- No live region announces a new review card or the AI's marks; margin highlight icons are 16 px at 0.55 opacity.
- ⌘/ sheet filter; multi-select and bulk actions in the sources list.
- Selecting inside an existing highlight stacks a second one.

## Detector (B)
223 findings, all in `styles.css`: 107 font-size and 68 radius drift, 39 raw colours (mostly shadow blacks), 6 bounce easings (D62 springs, intended on cards), 3 side-tab (neutral quote rules, false positives). Overlay: dark-glow (the collect animation), nested-cards (warm-up), skipped-heading (Settings, fixed). Token contrast passes everywhere except `faint` on `selected` (fixed) and 1.1–1.3:1 borders where a border is a control's only edge.
