# Codex deep scan 4, 2026-11-25

The fourth scan in the shape of `2026-11-24-codex-deep-scan/`, `-2/` and `-3/`: Codex follows the diagnosing-bugs loop (phases 1 to 4, a red script per finding, report only), Claude writes the failing tests and the fixes. Two testers: `refactors` hunts regressions in the six moves of #529–#537 (shared undo, the shared list actions, the Review session owner, the Reader's highlight store, the --json answer types, the split journeys) and the open rows F618 and F631; `edges` takes the Leads the first three scans left without a red loop, writes cut off mid-way, a lost or stale `.index`, iCloud conflict copies, and lifecycles nobody ran end to end.

Run with `bun run sweep docs/reviews/2026-11-25-codex-deep-scan-4` from a worktree.
