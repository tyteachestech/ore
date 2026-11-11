# Codex UX parity loop: lists and the sidebar, rerun, 2026-11-10

The first sweep of this surface (`reader-lists.md`) was thin: its "already covered" list was read as "do not test", and the seed had no Feed posts and no list long enough to page. This rerun fixed both. Prompt, checklist and report: `lists2-prompt.md`, `lists2-checklist.md`, `lists2-report.md`. About 29 minutes.

What changed in the setup: the prompt says covered means "do not propose it again", never "do not test it", and asks for each convention to be checked on every list, since All sources, a skill page, Home, the Feed and the sidebar are built apart. The library was `seed-big` (about 240 sources) with two YouTube sources added and two feeds followed from a small local server (12 posts).

80 items: 76 checked, 55 work, 21 differ or are missing, 1 untested. Eight findings, all class C (a convention that holds on one list and not on another), each reproduced twice in Chromium and WebKit; six more differences are ones Codex was unsure the reference does.

| Finding | Verified | Result |
|---|---|---|
| F3 ⌘C copies nothing on a focused Home row or a Feed post | Yes | Fixed |
| F4 Rename… or Edit skill… from a row's menu leaves focus nowhere (Home rows and tiles, a sidebar collection) | Yes (the Home tile only in WebKit) | Fixed |
| F5 Removing a row leaves focus nowhere (Home, the sidebar) | Yes | Fixed: focus goes to the next row |
| F6 Back loses Home's scroll and the row opened by the keyboard | Yes | Fixed |
| F8 Closing Add loses the focus that opened it (Home, the Feed, a skill page) | Yes | Fixed at the root: every panel using the same hook |
| F7 A slow first read shows blank lists | Dropped | `ls`, `today` and a plain `feed` are local reads of milliseconds; Codex delayed them 4 s by hand |
| F1 No multi-selection on Home or the Feed | Yes | Left for Tyler |
| F2 A Home source cannot be dragged onto a skill | Yes | Left for Tyler |

Guard: a fourth rule in the e2e `HYGIENE` script. When the focused control leaves the page and focus is still on nothing a moment later, the journey fails. Beyond the findings it caught the peeked sidebar sliding away with focus inside it (fixed), and about ten places on other screens, listed in the guard's `ALLOW` with a reason each, to fix when those screens are next worked on: Review closing, the finish quiz and the quick quiz, the Find bar, the tutor closing, the reader's title and New question fields, Review's answer-piece editor, Explain's buttons, and the skill page's Try it and name fields.
