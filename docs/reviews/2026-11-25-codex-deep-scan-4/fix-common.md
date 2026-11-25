# Deep scan 4: drafting the fixes (shared rules, read first)

You are drafting fixes for findings in this folder's reports. Claude reviews every fix before merge and may replace it, so aim for the **most durable fix at the cause**, not the smallest patch that turns one script green: if a whole class of bug shares one cause (an inverse captured from an optimistic value, a lock that isn't held, a path joined from data), fix the class at its source and say which other callers it covers.

Read `CLAUDE.md` (the bug-fix rule, Intake rule, change.ts / list-actions.ts / review-session.ts / highlights.ts notes), `docs/SPEC.md` where it touches your finding, and the decision numbers the report names.

For each finding, in the report's order, one commit each:
1. **Test first** at the seam where the bug happens: `packages/core/test/*.test.ts` for core, `apps/desktop/test/*.test.ts(x)` for app modules (copy their setup). Turn the report's red script (`codex-out/<tester>/…` in the deep4 worktree, `~/Developer/ore-wt/deep4/codex-out/`) into the smallest test that fails on the exact symptom. Name the test so it says what he would see. Run it and save the red output.
2. Fix. Run the test green, then the whole file it lives in, then `bun run typecheck`.
3. Commit with a message saying the symptom in plain words, the cause you confirmed, and the test's name. End the message with the red and green command lines and their last 5 lines of output.

Rules: never skip, retry or loosen a test. Do not edit `docs/reviews/findings.md` or `docs/DECISIONS.md` (Claude numbers rows). Do not run `bun run e2e`, `bun run bench` or anything that starts a browser or server. If a fix needs a product decision (what he should see), stop on that finding, write the question and your recommendation in `FIX-NOTES.md` at the repo root, and move on. If a finding turns out not to be real, say why in `FIX-NOTES.md` and move on. Keep `FIX-NOTES.md` as one short paragraph per finding: what you changed, why that fix and not a narrower one, what else it covers.

When done: `bun test` once for the whole repo; write its last lines into `FIX-NOTES.md`; commit it.
