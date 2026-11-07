---
name: triage-report
description: Turn an outside tester's report (ChatGPT or Codex computer use, a Codex deep read, a friend's notes) into verified fixes. Use when Tyler hands over a report, its path, or pasted findings.
---

# Triage a report

An outside report is a list of claims. Each one is **verified** against the code before it costs a PR, and each verified one ships with the test that would have caught it.

## Steps

1. **Land the report.** Copy it into `/mnt/project-files/<pass-name>/` (a report on the Mac comes over by `device_stage_files`). Write `report-summary.md` beside it: one numbered line per finding, with file:line where the report gives one. Done when every finding in the report has a line.
2. **Verify each line** against `origin/master`: read the code, reproduce it on the mock (`apps/desktop/scripts/mock/`, `window.__ORE_FAIL`, `__ORE_SLOW`, `__ORE_PICK`) or in a test. Mark it `real`, `already fixed (#PR)`, `not a bug (D-number or reason)`, or `taste call`. Check project memory for an earlier answer from Tyler before marking a taste call. Done when every line carries a mark.
3. **Batch the taste calls** into one short list for Tyler, each with a recommendation, while you fix the rest. Never block on them.
4. **Fix in rounds**: a few related `real` items per PR, each starting with a failing test (AGENTS.md "A bug fix starts with a test"), shipped per `docs/WORKFLOW.md`. Update the summary's marks as PRs merge.
5. **Close the gap at its source.** For each class of miss, ask why our own checks didn't catch it: a missing row in the interaction-check Conventions table, an e2e journey, a `waits.test.ts` entry. Add it in the same PR.
6. **Record** the pass in project memory: what was fixed (PR numbers), Tyler's answers to the taste calls, and what is still open. Done when every finding is fixed, ruled out, or listed as open.
