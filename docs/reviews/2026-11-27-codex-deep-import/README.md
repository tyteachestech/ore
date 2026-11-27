# Deep import pass, 2026-11-27

Queue item 5 of `../codex-coverage.md`: import at real breadth (D122). Earlier passes read the import code with hand-made inputs; this one imports many real files per type and reads each against its original from start to end.

- **Three Codex scouts on Tyler's Mac** (`preamble.md` + `<name>-prompt.md`), code and `ore add` only, no app: `books` (EPUB, his Calibre library and openly licensed books), `pdfs` (whole textbooks, papers, slides, scans without the page reader), `media` (YouTube, podcasts, audio and video files).
- **Claude in the cloud** takes the web at breadth (`bun run intake:live` and fifty more live sites) and office files found on the web (Word, PowerPoint, Excel, notebooks, Markdown, RTF).

Off limits (other threads): doubled OpenStax formulas, the blank Original view for scans, podcast episode web pages, library upgrades.

Run from a worktree, each scout only when `bun apps/desktop/scripts/mac-load.ts check` passes, two minutes apart:

```sh
D=docs/reviews/2026-11-27-codex-deep-import
for n in books pdfs media; do
  bun apps/desktop/scripts/mac-load.ts check || break
  mkdir -p codex-out/$n
  { cat $D/preamble.md $D/$n-prompt.md; } | sed "s#<your name>#$n#g" > codex-out/$n-prompt.md
  nohup codex exec -m gpt-6-astra -c model_reasoning_effort=high -c sandbox_workspace_write.network_access=true \
    --sandbox workspace-write -C "$PWD" "$(cat codex-out/$n-prompt.md)" < /dev/null > codex-out/$n.log 2> codex-out/$n.err.log &
  sleep 120
done
```
