---
name: triage-report
description: Turn an outside tester's report (ChatGPT or Codex computer use, a Codex deep read, a stress test, a friend's notes) or a bug Tyler jots down into verified fixes. Use when Tyler hands over a report, its path, pasted findings, or a bug.
---

# Triage a report

An outside report is a list of claims. Each one is **verified** against the code before it costs a PR, recorded in `docs/reviews/findings.md` (the one list a sweep reads, so nothing is checked twice), and each real one ships with the test that would have caught it.

## Steps

1. **Land the report.** Copy it into `/mnt/project-files/<pass-name>/` (a report on the Mac comes over by `device_stage_files`). Done when you have it in full.
2. **Check it against the list.** For each finding, look for its row in `docs/reviews/findings.md`. A finding that matches a `fixed`, `not a bug`, `Tyler:` or `known limit` row is dropped, unless the report shows it came back. Done when every finding is matched to a row or marked new.
3. **Verify each new finding** against `origin/master` with a feedback loop that goes red on it: a failing core test, an e2e journey, or a Playwright script on the mock (`apps/desktop/scripts/mock/`, `window.__ORE_FAIL`, `__ORE_SLOW`, `__ORE_PICK`). For a flaky or racy one, raise the hit rate until it fails every time: load beside the run, `page.route` holding one write back (`e2e-harness` notes in memory). Mark it `real`, `not a bug (D-number or reason)` or `taste call`; check project memory for an earlier answer from Tyler before marking a taste call. Add a row to the table for each, with its status. Done when every new finding has a row.
4. **Batch the taste calls** (`Tyler:` rows) into one short list for him, each with a recommendation, while you fix the rest. Never block on them.
5. **Fix in rounds**: a few related `open` rows per PR. For each:
   - Shrink the loop to the smallest case that still fails, then make that the test at the place the bug happens (the core write, the journey that does what he did). A test at a shallower place than the bug is not a guard; if only that is possible, say so in the row.
   - Run it red, fix, run it green, and put both runs (the command and its last lines) in the PR body.
   - Set the row to `fixed #PR` with its guard in the same PR.
   Ship per `docs/WORKFLOW.md`.
6. **Close the gap at its source.** For each class of miss, ask why our own checks didn't catch it: a missing row in the interaction-check Conventions table, an e2e journey or hygiene rule, a `waits.test.ts` entry. Add it in the same PR. Done when every fixed row's class has a guard or a stated reason it has none.
7. **Record** in project memory only the pass's name, its PRs and Tyler's answers; the rows themselves live in the table.

Steps 3 and 5 follow Matt Pocock's `diagnosing-bugs` skill (github.com/mattpocock/skills, MIT): a red-capable loop first, minimise it, then the regression test at the seam where the bug happens.
