# Codex deep scan 5, 2026-11-25

The fifth scan in the shape of scans 1 to 4: Codex follows the diagnosing-bugs loop (phases 1 to 4, a red script per finding, report only), may then draft fixes, and Claude QAs every fix before merge. Tyler asked for a wider fan-out this time, so it runs two kinds of scout:

- **Ten reading scouts** (`reader-preamble.md` + `<name>-prompt.md`): code only, small red scripts, no app, browser, server or whole test suite. They run side by side: phone, shell (the Tauri window), office (documents, slides, sheets, notebooks, RTF, Markdown, screenshots), original (the kept original and reimport from it), aivendor (the Codex vendor, model switches, the smaller AI paths), editor (block commands, paste, diagrams), feeds (the parser), keys (keymap, IME, focus, a11y), untrusted (hostile content: script, paths, commands), courses.
- **Two app-running scouts** through `bun run sweep` (`preamble.md`, `sweep.json`): soak (a working day on one Mac page) and perf (the big seed). The runner keeps them to two and checks Mac load.

Off limits: EPUB front matter and highlight animation timing (other threads).

Run from a worktree: start `bun run sweep docs/reviews/2026-11-25-codex-deep-scan-5` first (its load check counts every `codex exec`), then the readers:

```sh
D=docs/reviews/2026-11-25-codex-deep-scan-5
for n in phone shell office original aivendor editor feeds keys untrusted courses; do
  mkdir -p codex-out/$n
  { cat $D/reader-preamble.md $D/$n-prompt.md; } | sed "s#<your name>#$n#g" > codex-out/$n-prompt.md
  nohup codex exec -m gpt-6-astra -c model_reasoning_effort=high --sandbox workspace-write -C "$PWD" \
    "$(cat codex-out/$n-prompt.md)" < /dev/null > codex-out/$n.log 2> codex-out/$n.err.log &
done
```
