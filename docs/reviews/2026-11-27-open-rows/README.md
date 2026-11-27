# Open rows pass, 2026-11-27

Queue item 2 of `docs/reviews/codex-coverage.md`: burn down `open` rows in `findings.md` that need no call from Tyler. No scouting: the bugs are known, so Codex drafts fixes (`fix-prompt.md` + `<name>-rows.md`) and Claude QAs every line before merge.

Groups: `editor` (F1, F6, F547, F548), `shell` (F421, F660, F662, F729), `perf` (F294, F727, F13, F2). Claude takes F3 and F737 in cloud WebKit (both need a browser). F684 needs Tyler's choice of where a saved page's own files live. F538 was already fixed (#516).

Run from one worktree per group on Tyler's Mac, after `apps/desktop/scripts/mac-load.sh check`, started 2 minutes apart:

```sh
D=docs/reviews/2026-11-27-open-rows
for n in editor shell perf; do
  git worktree add ~/Developer/ore-wt/rows-$n origin/claude/project-thread-d59v4n
  cd ~/Developer/ore-wt/rows-$n && bun install >/dev/null && mkdir -p codex-out/$n
  { cat $D/fix-prompt.md $D/$n-rows.md; } | sed "s#<name>#$n#g" > codex-out/$n-prompt.md
  nohup codex exec -m gpt-6-astra -c model_reasoning_effort=high --sandbox workspace-write -C "$PWD" \
    "$(cat codex-out/$n-prompt.md)" < /dev/null > codex-out/$n.log 2> codex-out/$n.err.log &
  sleep 120
done
```

## Result
Codex drafted 7 fixes; Claude reworked one (`ore ls --ids` now skips a source gone since, so its row drops instead of the list failing), restored a journey a draft's stale base removed, and fixed F737 (one mount pass a frame; probe `F737-scroll-probe.ts`) and guarded F3 (fixed by #495, red in Chromium with its two guards removed). Fixed: F2, F3, F6, F294, F421, F547, F660, F727, F737. Stale: F13. Kept on purpose: F548. Left with a plan in the notes: F1, F662, F729. F684 is drafting from Tyler's pick. The three suite failures the drafters saw on the Mac (two `Bun.serve` binds, one OCR case) come from Codex's sandbox: the whole suite passes in the cloud.
