# Recover from the library's history, 2026-11-27 (coverage queue 9)

Restore a source, a note or a whole day from the library's git snapshots (D5), the way an agent would, then see what core, the index, the CLI and each screen show.

- **Three Codex reading scouts** on Tyler's Mac (`reader-preamble.md` + `<name>-prompt.md`): restore (core and the index), snapshot (what history holds), app (Mac and iPhone screens when files change under them).
- **Claude in the cloud** drives the same restores through the screens (the mock library in Playwright) and QAs every fix.

Run from a worktree on this branch, after `apps/desktop/scripts/mac-load.sh check`, two minutes apart:

```sh
D=docs/reviews/2026-11-27-history-recovery
for n in restore snapshot app; do
  mkdir -p codex-out/$n
  { cat $D/reader-preamble.md $D/$n-prompt.md; } | sed "s#<your name>#$n#g" > codex-out/$n-prompt.md
  nohup codex exec -m gpt-6-astra -c model_reasoning_effort=high --sandbox workspace-write -C "$PWD" \
    "$(cat codex-out/$n-prompt.md)" < /dev/null > codex-out/$n.log 2> codex-out/$n.err.log &
  sleep 120
done
```
