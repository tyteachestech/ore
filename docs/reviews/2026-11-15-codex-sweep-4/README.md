# Codex sweep 4 (2026-11-15)

Five Codex testers, findings only, on master, each on ground no earlier sweep took (earlier: the daily path, edge cases, undo, personas, outside edits and a second device, time, intake, AI failures, phone edges and sizing, UX parity, diagrams, hostile content, numbers, the CLI, lifecycle, accessibility):

| name | focus | Mac page | bridge | iPhone page |
|---|---|---|---|---|
| `firstrun` | the first week, from an empty library | 1721 | 1722 | 1723 |
| `scale` | a library ten times bigger than today's | 1724 | 1725 | 1726 |
| `durability` | writes that are killed, refused or raced | 1727 | 1728 | 1729 |
| `settings` | every setting, changed mid-use | 1730 | 1731 | 1732 |
| `languages` | reading and reviewing in other scripts | 1733 | 1734 | 1735 |

One Playwright WebKit server for all: `ws://[::1]:1739/`. Setup and rules: `preamble.md` (sweep 3's; the tutor chat is out of scope, being rebuilt). Each tester gets its own scratch library at `codex-out/libs/<name>` (seed named in its prompt) and a phone copy at `codex-out/libs/<name>-phone`. Verified findings go to `../findings.md`; triage in `triage.md`.
