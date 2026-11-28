# Ore history recovery pass, reading scout: shared setup (read this first)

You are a bug hunter for Ore, a Mac-first personal learning app (capture a source → read → highlight → AI-drafted exercises → FSRS review). The repo is your working directory, checked out at master. Read `CLAUDE.md`, `docs/SPEC.md` (History, D5), `docs/reviews/findings.md` (every known bug: do NOT re-report a row unless you saw it come back, then name the row) and `docs/reviews/codex-coverage.md` (what earlier passes covered).

**The angle (coverage queue 9).** The library is a local git repo (D5). `packages/core/src/history.ts` snapshots it at most every ten minutes from any `ore` command (always on `ore session end`). Nothing in the app restores from it: when a note is overwritten or a day goes wrong, Tyler asks Claude, which runs git in `~/Ore`. This pass asks: after a restore done the way an agent would do it (`git checkout <sha> -- <path>`, `git restore --source <sha>`, `git checkout <sha> -- .` for a whole day, `git revert`, `git stash`), does every reader in core, the index, the CLI and the app come out right, and is anything he needs missing from the snapshots?

**You are a reading scout.** Up to three scouts run at once on Tyler's Mac, so you never start the app, a browser, Playwright, a server, a watcher, `bun run e2e`, `bun run bench` or the whole `bun test`. You read code and reason, and you prove each suspicion with a small, fast red script: a Bun script in your folder that imports from `packages/core/src` (or `apps/desktop/src` for headless logic, as `apps/desktop/test` does), `bun packages/cli/src/ore.ts <command> --json` with `ORE_LIBRARY=<a scratch library in your folder>` and `ORE_NO_ENRICH=1`, or one named test file (`bun test <file>`). Build scratch libraries with `ore init`, `ore add --add-file` on fixtures from `packages/core/test/fixtures/intake/`, `ore highlight`, `ore note`, `ore log`, then real git commits via `snapshot(lib, { force: true, now })`. One Bun process at a time, each under 30 seconds of CPU; never leave a process running. Never let real AI run: stub the vendor (fake `claude`/`codex` executables first on PATH).

**Findings only.** Do not change any file in the repo. Write only inside your folder `codex-out/<your name>/` (scripts, scratch libraries under `libs/`, the report). Never touch `~/Ore`, `/Applications/Ore.app`, `~/Developer/ore`, or another scout's folder.

## How to hunt: the diagnosing-bugs loop
Follow `diagnosing-bugs.md` in this folder, phases 1 to 4, and stop before phase 5: you report, someone else fixes.
1. **Build a loop first.** For each suspected bug, a script that goes red on the exact symptom: deterministic, seconds to run (pin the clock, own scratch library).
2. **Reproduce and minimise** until every step left is load-bearing.
3. **Hypothesise**: 3 to 5 ranked, falsifiable causes.
4. **Measure**: probes that split them.
A suspicion with no red loop is not a finding; list it under "Leads".

## What counts
A finding loses or corrupts data, schedules wrongly, shows a false number or state, breaks a rule in `CLAUDE.md` or a decision in `docs/DECISIONS.md` (name the D-number), or crashes. Also log **UX misses** (Tyler 2026-11-27: every pass logs them): where recovering costs him extra steps, a wait with no word, or an agent following the library's `AGENTS.md` (`packages/core/src/templates/library-agents.md`) or `skills/ore/SKILL.md` would be told the wrong thing or nothing. Skip looks and taste.

## Report
Write `codex-out/<your name>/report.md`:
1. One paragraph: what you covered and what you skipped.
2. Findings, most severe first. Each: an ID (`<NAME>-01`…), a short title; severity (**S1** data loss or corruption, wrong scheduling, a crash; **S2** wrong in everyday use; **S3** an edge that still costs something); Mac, iPhone or both; **the red command** (path and exact invocation) with its output; minimised steps; expected vs actual; ranked hypotheses and what the probes showed; file and line of the cause; the fix you would make (one paragraph, no patch).
3. Leads: suspicions with no red loop yet, one line each with why.
4. What passed, one line each.
Budget: about 60 minutes. Stop when it runs out and write the report.

---

