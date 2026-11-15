# Codex sweep 5 (2026-11-15)

Five Codex testers, findings only, on master, each on ground no earlier sweep took (earlier: the daily path, edge cases, undo, personas, outside edits and a second device, time, intake, AI failures, phone edges and sizing, UX parity, diagrams, hostile content, numbers, the CLI, lifecycle, accessibility and keyboard-only, first run, scale, durability, settings, languages).

| name | focus | Mac page | bridge | iPhone page |
|---|---|---|---|---|
| `fresh` | what shipped in the last four days | 1741 | 1742 | 1743 |
| `pointer` | the whole loop by mouse and trackpad only | 1744 | 1745 | 1746 |
| `notes` | notes as he writes them, and what reaches the disk | 1747 | 1748 | 1749 |
| `media` | learning from videos, podcasts and recordings | 1750 | 1751 | 1752 |
| `tutor` | the rebuilt tutor chat, with faked replies | 1753 | 1754 | 1755 |

One Playwright WebKit server for all: `ws://[::1]:1759/`. Mac load rule (`docs/WORKFLOW.md`): `mac-load.sh check` before each tester, two at a time (fresh + pointer, notes + media, then tutor alone), `mac-load.sh clean` after each pair. Setup and rules: `preamble.md`. Verified findings go to `../findings.md`; triage in `triage.md`.
