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

## Results (2026-11-27)
The three Codex scouts ran on the Mac, one after another two minutes apart, 30 to 40 minutes each; Claude ran the web, Office and notebook lane in the cloud. Their full reports stayed on the Mac (`codex-out/`, each over 20 KB); every finding is a row in `../findings.md` (the `deep import pass` rows of 11-27) with the test that guards it, and a row per tester is in `../sweeps.md`.

- Books: 38 EPUBs, 7 bugs, all fixed. What passed: every saved original byte for byte, every table of contents entry in spine order, a 2,014-chapter Sanskrit epic in exact order, Arabic, Hebrew and Japanese with its readings.
- PDFs: 26 files, 5,131 pages, 9 bugs: 7 fixed, one the web lane's arXiv fix already covered, one (a scanned page among text pages) left open for the scanned-PDF fix. The scouts' Mac couldn't run Apple's text recognition in Codex's sandbox, so scans were judged by what was refused.
- Media: 31 links, 5 bugs, all fixed; a video file now keeps its original (Tyler's pick). Speech to text refused in the sandbox, so captions were compared word by word, not listened to.
