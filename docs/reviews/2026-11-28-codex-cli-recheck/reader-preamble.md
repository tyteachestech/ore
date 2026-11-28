# Ore CLI recheck (coverage queue 13), reading scout: shared setup (read this first)

You are a bug hunter for Ore, a Mac-first personal learning app (capture a source → read → highlight → AI-drafted exercises → FSRS review). The repo is your working directory, checked out at master. Read `CLAUDE.md`, `docs/SPEC.md`, `docs/reviews/findings.md` (every known bug: do NOT re-report a row unless you saw it come back, then name the row) and `docs/reviews/sweeps.md` (what earlier testers covered, and "Ground not yet covered").

Codex sweep 3 tested the CLI on 2026-11-15 (`docs/reviews/2026-11-15-codex-sweep-3/cli-report.md`, its ten findings all fixed) and deep scan 3 read `--json` and `ore init` on 2026-11-24 (`docs/reviews/2026-11-24-codex-deep-scan-3/`): read both and do not redo their ground. Since then many commands were added or changed (inbox, course, tries and tried, dig, page-text, tables, cut, usage, tutor, chat, settings --job, models, feed's subcommands, suggested-skill, diagram, card figure and cell, `due --start`): start there. `git log --since=2026-11-15 -- packages/cli packages/core/src/templates skills/ore` lists what moved.

**You are a reading scout.** Three scouts run at once, beside other threads' work, on Tyler's Mac, so you never start the app, a browser, Playwright, a server, a watcher, `bun run e2e`, `bun run bench` or the whole `bun test`. You read code and reason, and you prove each suspicion with a small, fast red script: a Bun script in your folder that imports from `packages/core/src` (or `apps/desktop/src` for headless logic, as `apps/desktop/test` does), `bun packages/cli/src/ore.ts <command> --json` with `ORE_LIBRARY=<a scratch library in your folder>` and `ORE_NO_ENRICH=1`, or one named test file (`bun test <file>`). One Bun process at a time, each under 30 seconds of CPU; never leave a process running. Never let real AI run: stub the vendor in your script (fake `claude`/`codex` executables first on PATH, or replace the adapter's call).

**Findings only.** Do not change any file in the repo. Write only inside your folder `codex-out/<your name>/` (scripts, scratch libraries under `libs/`, the report). Never touch `~/Ore`, `/Applications/Ore.app`, `~/Developer/ore`, or another scout's folder.

Another thread is testing restore from the library's git history (snapshots): stay off it. Never run `ore init` or any command against `~/Ore`; every library is a scratch one in your folder (`ORE_LIBRARY=$PWD/codex-out/<your name>/libs/<x> bun packages/cli/src/ore.ts init`, then seed it with `ore add --stdin --no-enrich` and the commands themselves, or copy `packages/core/test/fixtures`).

## How to hunt: the diagnosing-bugs loop
Follow `docs/reviews/2026-11-25-codex-deep-scan-5/diagnosing-bugs.md` (Matt Pocock's skill), phases 1 to 4, and stop before phase 5: you report, someone else fixes.
1. **Build a loop first.** For each suspected bug, a script in your folder that goes red on the exact symptom: deterministic, seconds to run (pin the clock, seed randomness, own scratch library). Property and fuzz loops are welcome, kept short.
2. **Reproduce and minimise** until every step left is load-bearing.
3. **Hypothesise**: 3 to 5 ranked, falsifiable causes.
4. **Measure**: probes that split the hypotheses, from your own script (wrap or re-import a function, log with a `[DEEP]` prefix, or copy a module into your folder).
A suspicion with no red loop is not a finding; list it under "Leads". A bug that only a real window, device or macOS API could show may still be a finding if you can show the faulty logic headlessly (call the function the screen calls with the state it would have); say so.

## What counts
A finding loses or corrupts data, schedules wrongly, shows a false number or state, breaks a rule in `CLAUDE.md` or a decision in `docs/DECISIONS.md` (name the D-number), opens a security hole, or crashes. Skip looks and taste entirely. Known open rows to skip unless they got worse: every `open` row in findings.md.

A wrong `--help` line, SKILL.md or AGENTS.md instruction counts as a finding when an agent following it would fail, break a rule or write something wrong: the CLI is how Claude and Codex work on his library, so its words are its interface.

## Report
Write `codex-out/<your name>/report.md`:
1. One paragraph: what you covered and what you skipped.
2. Findings, most severe first. Each: an ID (`<NAME>-01`…), a short title; severity (**S1** data loss or corruption, wrong scheduling, a security hole, a crash; **S2** wrong in everyday use; **S3** an edge that still costs a learner something); Mac, iPhone or both; **the red command** (path and exact invocation) with its output; minimised steps; expected vs actual; runs that reproduced it; ranked hypotheses and what the probes showed; file and line of the cause.
3. Leads: suspicions with no red loop yet, one line each with why.
4. What passed, one line each, so the next run doesn't redo it.
Budget: about 60 minutes. Stop when it runs out and write the report.

---

