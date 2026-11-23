# Codex test of the iPhone Add taking pasted text (PR #519), 2026-11-23

Tyler, before merging #519: "Test this thoroughly in codex first before we add more. Test ui and ux as well as basic technical implementation against all edge cases." Two testers on the PR's branch: `ux` (the sheet as a learner meets it, beside the Mac's ⌘N box) and `edges` (what goes in and what is saved, every input kind). Run from a worktree of the branch: `bun run sweep docs/reviews/2026-11-23-phone-add-text`.

## Triage
Seven findings, all real, all fixed in #519 test-first: `ux` UX-1 to UX-4 and `edges` E1 to E5 (UX-2 and E1 are one bug, UX-4 and E4 are one). Two were older and on the Mac too: a paste that is only a list lost its list (E2), and a paste of only invisible characters made a nameless source (E5). Rows F551 onward in `docs/reviews/findings.md`. Not reachable here: the real iOS keyboard, its Paste menu and a real finger's drag in the field (UX-3 was a synthetic touch).
