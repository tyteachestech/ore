# Codex UX parity loop: the reader and the lists, 2026-11-10

How the loop runs: `README.md` here. Prompts, checklists and reports: `reader-*.md`, `lists-*.md`. Both ran side by side from 15:39; lists took about 17 minutes, the reader about 25. Neither sweep found a plain miss, so this PR changes no code.

## The reader, highlighting and the player (Readwise Reader, Apple Books, Kindle; YouTube, Snipd)
80 items: 67 work, 8 differ or are missing, 5 untested. No finding.

- The 8: six are YouTube's own keys (K, J, L, ←→ by 5 s, ↑↓ volume, M), where Ore's keys are set by D50 (Space, ← 15 s, → 30 s, `[` `]`); one is free image zoom (D143); one, Tab inside the highlight popup's note, Codex could not establish for Readwise (D133 keeps Tab's meaning there).
- Untested: the native right-click menu (four items, not visible to a headless browser) and opening an outside link. No video source is in the seed, so nothing about the video frame was checked; the audio player was.
- For Tyler: whether the player should also take YouTube's K, J, L and M beside D50's keys.

## Lists of sources and the sidebar (Linear, Raindrop, Finder)
80 items: 34 checked, 20 work, 14 differ or are missing, 46 untested. Three findings, all class B.

| Finding | Class | Verified | Result |
|---|---|---|---|
| Typing a title's first letters in a list does not jump to that row (Finder) | B | Yes | Left for Tyler |
| The sidebar cannot be resized: it is 216px, while the note panel, the tutor and the video drag to resize | B | Yes: `--sidebar: 216px`, no divider | Left for Tyler |
| A drag from blank space in a list selects nothing (Finder's rectangle; the note editor has it since D188) | B | Yes | Left for Tyler |

- The other 9 that failed are ones Codex was unsure the reference does (Home and End moving the selection, Space selecting a row); in Finder, Home and End scroll without selecting, so they are left out.
- **This sweep was thin, and the prompt is why.** Its "already covered" list (the Conventions rows, the journeys, the 31 bugs of 2026-11-09) was read as "do not test": 33 items were skipped as covered, and 7 more because the seed's Feed is empty and no list is long enough to page. A rerun should say that covered means "do not propose it again", not "do not check it on each list", and should run on a library with Feed posts and `seed-big`.

## What five sweeps show
| Surface | Items | Worked | Findings | Real | Fixed | For Tyler |
|---|---|---|---|---|---|---|
| Tutor chat | 60 | 51 | 4 | 4 | 3 | 1 (built, D191) |
| Note editor | 56 | 52 | 2 | 1 | 1 | 0 |
| Review | 56 | 42 | 2 | 2 | 1 | 1 (Later) |
| Reader and player | 80 | 67 | 0 | 0 | 0 | 1 |
| Lists and sidebar | 80 (34 checked) | 20 | 3 | 3 | 0 | 3 |

The plain misses are drying up: the last two sweeps found none. What is left is choices (new behaviour) and what a headless browser cannot see: native menus, the real video frame, the Mac's own webview.
