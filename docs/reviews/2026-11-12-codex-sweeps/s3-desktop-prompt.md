# Sweep 3 (desktop): confirm sweep 2, then a backlog session, adding sources, and notes

Same rules, setup and report shape as `s1-desktop-prompt.md` (read it, and `codex-out/s2-desktop/report.md`), writing only under `codex-out/s3-desktop/`. The mock serves the branch under test (the commit is in `git log -1`). Read `docs/reviews/findings.md` first: rows F23–F37 are fixed; report one only if you see it come back. To get a backlog, seed with `seed-big.ts` (several hundred exercises), not `seed.ts`.

## 1. Confirm sweep 2's fixes, twice each in WebKit
- F33: on a skill page and in All sources, ←/→ walk all of the folder tabs (To read, Done, Archived) and keep focus on them; ⌘1/⌘2 still hand the keys to the list.
- F34: on Home's Continue reading, ⌘-click a row, then the first ⇧↓ grows the pick (and ⇧-click, then ⇧↓).

## 2. New tasks, twice each (never swept as tasks)
1. **A session over a backlog** (`docs/design/daily-session.md`): with hundreds due, start review from Home and do 10 minutes. Is it clear what's left and when to stop? Do new exercises come in at about 1 in 5? Does Later (⌘L) put one off without losing it? Does the end screen count only today's session?
2. **Add sources** (D96, D122): ⌘N with a URL, a pasted page selection, a dropped file (PDF, EPUB, image), and a link the mock can't read. Each one lands whole, or is refused with a next step, and is never half-saved. Undo each add.
3. **Write a note** (D38): in a source's note and a skill's note, type headings, a list, a to-do, a table, a link to another source, and a diagram; ⌘Z through it; leave and come back.

Interrupt each task once with a failing or slow write (`__ORE_FAIL`, `__ORE_SLOW`). Report as before; finish by printing the ranked findings one line each, or "clean".
