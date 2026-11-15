# Codex sweep 3 (2026-11-15)

Five Codex testers, findings only, on master, each on ground no earlier sweep took (earlier: the daily path, edge cases, undo, personas, outside edits, time, intake, AI failures, phone edges and sizing, UX parity, diagrams):

| name | focus | Mac page | bridge | iPhone page |
|---|---|---|---|---|
| `hostile` | hostile and odd content: scripts, links, names, sizes | 1701 | 1702 | 1703 |
| `numbers` | every count, level and date the app shows is true | 1704 | 1705 | 1706 |
| `cli` | the `ore` CLI and the `/ore` skill as an agent uses them | 1707 | 1708 | 1709 |
| `lifecycle` | archive, restore, delete, merge and rename, and what hangs off each | 1710 | 1711 | 1712 |
| `a11y` | VoiceOver and keyboard-only through the whole loop | 1713 | 1714 | 1715 |

One Playwright WebKit server for all: `ws://[::1]:1719/`. Setup and rules: `preamble.md` (sweep 2's, plus an out-of-scope line). Each tester gets its own seeded scratch library (`seed.ts`, or `seed-big.ts` where the prompt says) at `codex-out/libs/<name>`, and a phone copy at `codex-out/libs/<name>-phone`. Verified findings go to `../findings.md`; triage in `triage.md`.
