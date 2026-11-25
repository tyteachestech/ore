# Draft the fixes for refactors-report.md (R01 to R09)

Read `fix-common.md` in this folder first, then `refactors-report.md`. Claude's first read of the durable fix for each, to confirm or beat:
- R01: `history.ts` `forget` removes only its own step, by identity, never one another step put on Redo; check review-session's held-key dispatch against Review.tsx's old order.
- R02 (F618): when the review's removal commits and the reopen fails, the end screen and history follow what is on disk (the rating is gone; the next ⌘Z does not ask again), or the removal is put back.
- R03: a highlight's note step goes on the history when he types it, as `change()` does, not when its write returns.
- R04: a batch change is keyed on each item it touches, so it queues behind and ahead of single-item changes to those items. This likely belongs in `change.ts`.
- R05: an inverse is taken from the last value that saved, not from a value still being written; fix it in `change.ts` (or one helper) for every caller with this pattern (the report names importance, badge, goal, collection, rename).
- R06: a failed write puts a field back only if no later change to that field has been made since.
- R07: filing under an archived skill registers the skill's re-archive as the compensation of the step that revives it, so a failed batch puts it back.
- R08 (F631, F474): a source read that started while any filing was in flight keeps the optimistic skills (count writes outstanding at read start, not a counter changing during the read); check `reads.ts` for the same pattern.
- R09: Undo of Mark read puts back each post's own read state.
