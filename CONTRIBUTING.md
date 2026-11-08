# Contributing to Ore

Ore is one person's learning app, built mostly with Claude Code and shared under the AGPL. Issues and pull requests are welcome. The most useful thing you can send is a source that didn't come in whole.

## Report a source that came in broken

Ore's core promise is that whatever you learn from imports whole (D122): its own title, author and date, its outline, its images, tables, math and code, and timestamps for anything that plays. A broken import is a core bug, not polish. Open an issue with the **A source came in broken** form and give the link (or the kind of file) and what was missing. The repo is public, so attach a file only if you're allowed to share it.

## Set up

You need [Bun](https://bun.sh) 1.4.4, the version CI uses. Tests and the browser UI run on macOS or Linux; the desktop app needs macOS and [Rust with the Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/).

```bash
bun install
bun run typecheck                        # tsc strict, whole workspace
bun test                                 # unit and intake tests
bunx playwright install chromium         # once, for e2e
bun run e2e                              # journeys in a browser on a seeded mock library

ORE_LIBRARY=/tmp/lib bun packages/cli/src/ore.ts init   # a scratch library; never test against ~/Ore
cd apps/desktop && ORE_LIBRARY=/tmp/lib bun run tauri dev
```

No Mac or no Rust: the UI runs in a plain browser against a fake library ([`apps/desktop/scripts/mock/README.md`](apps/desktop/scripts/mock/README.md)).

## Before you open a pull request

[`AGENTS.md`](AGENTS.md) is the working agreement, for people and AI agents alike (`CLAUDE.md` points to it). The rules that catch most changes:

- **Decisions are settled.** [`docs/DECISIONS.md`](docs/DECISIONS.md) records them by number. Grep the ones your change touches; to change one, say so in the PR instead of quietly working around it.
- **A bug fix starts with a test that fails without it.**
- **Imports** land with a saved example in `packages/core/test/fixtures/intake/`, a case in `test/intake.test.ts` and a row in `test/intake-grid.test.ts`. A fixture must be shareable: openly licensed, written for Ore, or a page whose words are rewritten by `rewrite-page.ts`. `bun run golden:update` saves an intended change to the golden docs; read its diff.
- **Every element on screen has a purpose** for learning. No stat pills, taglines or decorative counts, and no streaks, XP, badges or leaderboards (D23).
- **Dependencies** must be AGPL-compatible: MIT, BSD, ISC, Apache-2.0, MPL-2.0, LGPL, GPL-3.0 or AGPL-3.0 (D120). The iPhone app bundles only permissive code.
- **UI changes** follow [`DESIGN.md`](DESIGN.md) and the interaction checklist in `.claude/skills/interaction-check/`, with screenshots in the PR.
- **CI must be green**: typecheck, tests, build, e2e, the style gate and the speed benchmark.

## AI prompts and evals

Prompts live in `packages/core/src/ai/prompts/`; bump a prompt's `version` header when you change it. The evals spend your own Claude or Codex usage, so they never run in CI. Run the one your change touches and put its numbers in the PR:

| Command | Guide |
| --- | --- |
| `bun run eval:grade` | [`docs/guides/grading-eval.md`](docs/guides/grading-eval.md) |
| `bun run eval:ask` | [`docs/guides/ask-library.md`](docs/guides/ask-library.md) |
| `bun run eval:tutor` | [`docs/guides/tutor-eval.md`](docs/guides/tutor-eval.md) |
| `bun run eval:questions` | [`docs/guides/question-eval.md`](docs/guides/question-eval.md) |

## How the maintainer's work ships

[`docs/WORKFLOW.md`](docs/WORKFLOW.md) covers how Tyler's own Claude Code threads merge and reinstall the app on his Mac. It doesn't apply to outside pull requests, which get a review before they merge.

## License

Contributions are licensed under the same [AGPL-3.0-or-later](LICENSE) as the rest of Ore. A fork is welcome but must use another name.
