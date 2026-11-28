# CLI recheck: draft the fixes for `<name>`

You are fixing the bugs in `docs/reviews/2026-11-28-codex-cli-recheck/<name>-report.md` (its red scripts are in `docs/reviews/2026-11-28-codex-cli-recheck/red/<name>/`). Your working directory is a worktree of Ore at master, made for you alone. Read `CLAUDE.md` first and follow it: its bug-fix rule, its intake rule, and its "Where things are" list (`change.ts`, `list-actions.ts`, `review-session.ts`, `highlights.ts`, `answers.ts`). Another Claude will review every line you change before it merges, so make each change easy to judge.

For each finding, in the report's order:
1. **Check it is real at master** with its red script. If it is not, or it is a looks/taste call, or fixing it would change how Ore behaves in a way Tyler should decide (a new rule, a changed decision in `docs/DECISIONS.md`), skip it and say why.
2. **Write the test first** where a bug of its kind would be caught next time: a core test in `packages/core/test/`, an app test in `apps/desktop/test/`, an intake case (fixture in `packages/core/test/fixtures/intake/`, a case in `intake.test.ts`, its cell in `intake-grid.test.ts`), never an e2e journey (you must not run a browser). Run it and keep the red output.
3. **Fix the cause, not the symptom**: the smallest change that makes the whole class of bug impossible, in the module that owns it (one place, used by Mac and iPhone alike). No speculative abstractions.
4. Run the test again and keep the green output, plus every existing test file that covers the code you changed (`bun test <file> …`).

Rules learned from the last pass, where the drafts passed their own tests but 12 of them needed rework:
- **Never refuse or rewrite valid existing data** to make a fix simpler: libraries on disk hold weeks of older formats and hand edits. Read old data as before; tighten only what is written from now on.
- **Never edit an existing test to fit your fix.** If one must change, it is a behaviour change: stop and explain in your notes instead.
- Locks, Undo and writes: keep the order "show, write, inverse" (`change.ts`); never leave a window where the file on disk is missing or half-written.
- A fix in a shared screen covers both devices; a fix to one device's copy of shared logic is the wrong fix.
- Don't edit `docs/reviews/findings.md` or `docs/DECISIONS.md`; Claude adds the rows.
- If `doc.md` output changes on purpose, run `bun run golden:update` and say which goldens changed and why.

Load on Tyler's Mac: no browser, app, server, e2e or bench. Run single test files; at the very end run `bun run typecheck` once and `bun test packages/core/test apps/desktop/test` once. Never leave a process running.

You can't commit (the sandbox blocks git's lock). Leave the changes in the worktree and write `FIX-NOTES-<name>.md` at its root: for each finding, its ID, fixed or skipped (and why), the changed files, the new test's name and file, the red output and the green output (last lines), and one line on why this is the durable fix. End with the final typecheck and test summary.

For this pass: a guide fix (`skills/ore/SKILL.md`, `packages/core/src/templates/library-agents.md`, `--help`) is a fix too; its test is one that reads the guide text (as `apps/desktop/test` and `packages/core/test` already do for help lines) or runs the guide's example. An undo that put back the wrong thing is fixed in the command's inverse, never by a special case in the app. `ore doctor` checks you add must never flag a valid older-format library: run `bun packages/cli/src/ore.ts doctor --json` on a fresh `bun apps/desktop/scripts/mock/seed.ts` library before and after, and it must stay clean.
