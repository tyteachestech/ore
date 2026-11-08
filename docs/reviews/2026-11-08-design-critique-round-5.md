# Impeccable critique, round 5: Ore desktop (2026-11-08)

Method: dual-agent (A: design review on the mock app; B: `impeccable detect` + browser overlay), after tonight's
element-loop picks (#114, #118, #120, #121), which this round kept as they are. **Score: 28/40, down 2 from round 4.**
Both P1s were regressions from #114's Tailwind import.

Detector: 8 counted findings, none new against the baseline (Geist `@font-face`, three blockquote-style left rules);
145 advisory (colour and radius literals in `styles.css`). Browser overlay: one straggler word in Settings; the
"stripes" are the gem rings' tick masks (allowed: rings and bars). `style-check.ts`: clean.

| # | Heuristic | Score |
|---|---|---|
| 1 | Visibility of system status | 3 |
| 2 | Match with the real world | 3 |
| 3 | User control and freedom | 3 |
| 4 | Consistency and standards | 2 |
| 5 | Error prevention | 3 |
| 6 | Recognition rather than recall | 3 |
| 7 | Flexibility and efficiency | 3 |
| 8 | Aesthetic and minimalist design | 2 |
| 9 | Error recovery | 3 |
| 10 | Help and documentation | 3 |

## Fixed
- #122: Tailwind utilities are `tw:`-prefixed; bare ones had framed Home's goal ring and the reader's outline
  (`test/tailwind.test.ts`). Home's minutes are the 24px number again, not 15px grey like "of 10 min".
- #123: letters typed with the highlight popup open no longer start Listen (L) or open the original (O); speech
  errors in words. ⌘K leads with Start review, display settings last. Search no longer lists a card or note
  twice (an index race between `ore` processes; schema 6 rebuilds once).
- This PR: skill-page heads line up (To read's caret and icon with Questions'); Questions rows hover as one
  Linear row with ghost actions (no box on a box); a question highlight with no question typed shows its passage
  muted; Collected group labels in mono; no glow on the met ring; focus ring on Review's Open in source;
  Settings hints wrap cleanly; the minus sprite matches the plus; DESIGN.md's colour rules match the app.

## Taste calls for Tyler
1. Typing straight after highlighting writes the note (Notion's comment box), instead of Tab first.
2. The To read count beside every skill in the sidebar: drop it (purpose rule), or show something he acts on.
3. The white dot after a title that has a source note reads as "unread" (Mail, Reader, Linear): drop it, or use the note glyph.
4. Unopened titles are dimmed and opened ones bright, the reverse of readers' convention.
5. All sources rows: take the Reader-style rows picked for the skill page (D130), or keep them compact.
6. The floating ✦ tutor button covers the panel foot and, at 900px, Home's skill column: keep it, or move it to the title bar.
7. Questions inside the reader's Collected tab wrap to three lines with links under each; DESIGN says one-line rows with the links in ⋯.
8. Settings uses a third segmented-control style; switch it to the one picked for the panel and popup.

## Still open
- Questions on the skill page take five Tab stops per row and no ↑↓.
- 73 `outline: none` overrides; a few leave only a `bg-hover` fill as focus.
- The ⓘ and Questions-head dot sprites barely read at 20px (glyph cut out of a filled disc).
- Add saves any text as a source; a bare domain could offer "Add as a link?".
