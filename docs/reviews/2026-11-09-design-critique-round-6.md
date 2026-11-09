# Impeccable critique, round 6: Ore desktop (2026-11-09)

Method: dual-agent (A: design review on the mock app, 1280×800 at 2×, plus 900×700 and 1600×1000; B: `impeccable detect`,
the CI gate, `style-check.ts` and the browser overlay on six views), on master at d27e779, after the evening's
~60 merges (#128–#195). **Score: 29/40, up 1 from round 5 (28).** Trend: 26 → 28 → 30 → 30 → 28 → 29.

Detector: 10 counted findings, all in the CI baseline (Geist `@font-face` ×7, three blockquote-style left rules);
152 advisory (colour and radius literals in `styles.css`, 8 overshoot easings, 7 off-ramp sizes). `impeccable-gate.ts`:
no new findings. `style-check.ts`: clean. Browser overlay on Home, the review picker, All sources, a skill page, the
reader and Settings: one finding per view, Geist as the primary font (chosen, D129) and the gem rings' tick masks
read as stripes (allowed: rings and bars).

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | ⌘R with an empty queue only toasts; Home's button state doesn't change |
| 2 | Match with the real world | 3 | "TEXT" kind label, "Lv 0", the target glyph before the skill subtitle, the flask with no word |
| 3 | User control and freedom | 3 | Esc leaves review and the finish sheet with no "saved" cue |
| 4 | Consistency and standards | 2 | Hints in two forms (kbd footer vs hover); emoji and pixel icons mixed in the sidebar; To read's head carries two chevrons, Your note none |
| 5 | Error prevention | 3 | ⌘↵ without a confidence picked nudges instead of submitting; the Add box classifies as you type |
| 6 | Recognition rather than recall | 3 | Ask / Edit / Retire under the ratings and the two titlebar icons are icon-only until hover |
| 7 | Flexibility and efficiency | 4 | ⌘K, ⌘R, ⌘N, 1–4, ↵ = suggested, N/Q, typing straight into the popup note |
| 8 | Aesthetic and minimalist design | 3 | Skill header: ring, level, count, near goal in one corner; reader titlebar's three counts as standing chrome |
| 9 | Error recovery | 3 | "Couldn't check this one… Mark what you got, or try again" is right; a failed link preview is silent |
| 10 | Help and documentation | 2 | Shortcut sheet and Settings descriptions only; nothing explains key point vs highlight, Try it, or the ring |

Design-specificity: authored. The ore-cart rail, the 30-segment ring, dot-sprite icons, mono labels over rules, the
Charter column and copy like "About 3 min of your most urgent cards" belong to Ore alone. The sources list (Reader rows,
D130/D135) and Settings (ChatGPT sheet) are deliberate copies.

Cognitive load: 3 of 8 fail (moderate). Decision points over four options: the highlight popup (7 targets), the review
check step (9), the ⌘K Actions group (15, unchunked). Review itself is single-focus and one step at a time.

## What the review raised, and what held up
Every priority issue the design review raised was checked against the code and a second screenshot before it went in
this report. Four of five were the app working as decided:
- **The end-screen gem "reads as a dull stone"** (P1 as raised). A screenshot artefact: `gem-in` starts 500 ms after the
  end screen mounts, so a shot at ~900 ms catches it dark and small. At 3 s the cut gems are pink and purple in their
  skills' colours. Not a defect.
- **Digits type into a typed card but pick confidence on a show card** (P1 as raised). By design and said in the footer
  (⌘↵ Check, then 1–3), with the reason in `Review.tsx`'s KeyFoot. A taste call at most; it costs nothing once learned.
- **The popup covers the lines under the selection, including an existing key point.** D112: the popup opens at the
  pointer's end of a drag. By design.
- **Retire is one icon from Edit, with no confirm or undo.** Wrong: Retire toasts "Card retired" with Undo, and ⌘Z takes
  back ratings one by one (#170).
- **Skill header stacks four numbers.** D90 (ring = level, count = cut gems, near goal), and the skill page layout was
  settled on 2026-11-08. Taste call, already answered.

## Open, small
- Tabbing fast through Home showed four hover hints at once in a headless shot (`+ Add`, plan, Start review, gear),
  gone within 300 ms. Radix tooltips open on focus; worth one look in the real webview before calling it a bug.
- `Hint` names the end screen's flask row only on hover ("To try on your own work"); a first-timer sees a line with
  no heading. D148 says one line, no count; a two-word label is the most it should get, if anything.
- Home's skill column shows a `0` cut-gem count on every skill in the seed. A zero he cannot change today is close to
  the purpose rule's line; in a real library most are non-zero.
- The What to review panel is one stop between ↵ and the first card every session (Enter passes through it).
- At 1600×1000 the Continue reading row floats in a 900px empty column; 1280 and 900 hold well.

## Persona notes
- Alex (power user): happy. ↵ takes the suggested rating, typing anywhere writes the popup note, ⌘K covers everything.
- Jordan (first-timer): "Lv 0", "TEXT", the eye and flask icons have no words; the only teaching copy is the warm-up
  line. Won't know what a key point does to their cards.
- Tyler (keyboard first, standing backlog, 10 min a day): the seed reaches "All caught up", which daily-session.md calls
  rare and not the reward; the goal-met-with-backlog end screen wasn't reachable in the seed and should be shot next
  round with a backlog seed.

## Questions the review left
- If a session ends when the time is up and not when the queue empties, what would the one, only end screen say?
- What if a typed card and a show card looked identical until he started typing: one card shape, one key map?
