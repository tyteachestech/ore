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

## What ran
| Scenario | How | Result |
|---|---|---|
| A source note restored while open in the Reader | Claude, journey in `e2e/journeys/history.ts` | Shown once he is back in the window; his next words keep it |
| A highlight removed, its source's annotations restored, then ⌘Z | Claude, journey | Shows again, one copy after ⌘Z |
| A whole day rolled back while Home is open, then ⌘Z on a rating | Claude, journey | Due again; ⌘Z said a timestamp and an id (fixed: says the rating is no longer in the library, and leaves the history) |
| A source archived, cut or deleted, then restored; notes, diagrams, chats; a whole day by reset and by checkout | Codex `restore` | Index, queue, FSRS replay, stats, search and doctor all match a fresh rebuild; a cut's Undo doubled text; a stale open session |
| What history holds, when it snapshots, git states an agent leaves | Codex `snapshot` | Conflicts and detached checkouts committed; two snapshots at once; session end failed with no git |
| ⌘Z, the open Reader and Review, the iPhone after a restore | Codex `app` | ⌘Z wrote older values over a restore; an open Review keeps a removed rating |

Every finding is a row in `../findings.md` (F-new rows of 11-27 and 11-28 naming this pass). The scouts' reports and red scripts are in `restore/`, `snapshot/` and `app/`.
