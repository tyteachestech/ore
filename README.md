# Ore

A Mac learning app that turns what you read into things you remember. Capture anything (articles, PDFs, EPUBs, YouTube, notes), read it in a calm reader, highlight what matters, answer a few AI-written questions, and review AI-drafted cards on a spaced schedule (FSRS). Every design choice is checked against learning science; the evidence lives in [`docs/research/`](docs/research/).

![The reader: prequestions at the top, highlights in the text, the source note on the right](docs/images/reader.png)

**The core promise:** whatever you learn from comes in whole. Articles, YouTube and other video, podcasts, every kind of PDF, EPUB books, slides, documents and screenshots all import as robustly as Ore can make them, into one format built for learning: the content's own title and outline, its images, tables, math and code, and timestamps for anything that plays. If something can't come in, Ore says why and what to do instead, and never saves half of it.

It's a personal, single-user tool built by Tyler, mostly with Claude Code. It runs locally, with no accounts or API keys: your library is a folder of plain files (`~/Ore`), and AI runs through the `claude` or `codex` CLI you're already signed in to.

## The loop

1. **Capture.** Paste a URL or drop a file. AI drafts 2 to 4 broad *prequestions* and tags the source with your skills.
2. **Read.** Try the prequestions first, then read. Select text to highlight it as Keep, Card or Question, with an optional note.
3. **Finish.** The source blurs; you write what you remember, then answer each prequestion and check it against the passages it came from.
4. **Review.** Cards from your highlights and notes come back on an FSRS schedule. Fact cards are flipped; Explain cards are typed and checked against a rubric by AI. You always set the rating.
5. **Grow.** Each skill shows its *strength* as gems: one cut gem per memory you'd still recall three weeks out. No streaks, XP or leaderboards.

Glossary: [`CONTEXT.md`](CONTEXT.md).

## Running it

Requirements: macOS, [Bun](https://bun.sh), and for the desktop app [Rust and the Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/). For the AI features, the [`claude`](https://code.claude.com) or [`codex`](https://github.com/openai/codex) CLI, signed in.

```bash
bun install                     # workspace deps
bun test                        # all tests
bun run typecheck               # tsc strict, whole workspace

cd packages/cli && bun link     # puts `ore` on PATH
ORE_LIBRARY=/tmp/lib ore init # a scratch library to play with
ore --help                     # every command accepts --json
```

The desktop app, against that scratch library:

```bash
cd apps/desktop && ORE_LIBRARY=/tmp/lib bun run tauri dev
```

`bun run app:install` builds the app and installs it to `/Applications/Ore.app`. Without `ORE_LIBRARY` it uses `~/Ore`.

No Mac or no Rust? The UI also runs in a plain browser against a seeded fake library: see [`apps/desktop/scripts/mock/README.md`](apps/desktop/scripts/mock/README.md).

Pick the AI vendor with `ai: claude` or `ai: codex` in the library's `skills.yaml` (or `ORE_AI=codex`).

## Repo layout

```
packages/core    domain, storage, ingest, anchoring, scheduling, AI adapter and prompts
packages/cli     the `ore` command-line tool (thin over core)
apps/desktop     Tauri 2 + React app
skills/ore      Claude Code skill: quizzing and library work from the terminal
docs/            decisions, spec, research, design docs, reviews
```

## Docs

Start with **DECISIONS** (what was decided and why) and **SPEC** (how it's built).

| Doc | What it is |
| --- | --- |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Every settled decision, D1 onward. The source of truth |
| [`docs/SPEC.md`](docs/SPEC.md) | Data model, library layout, CLI, scheduling, AI adapter |
| [`CONTEXT.md`](CONTEXT.md) | Glossary: source, highlight, intent, prequestion, finish, skill… |
| [`PRODUCT.md`](PRODUCT.md) · [`DESIGN.md`](DESIGN.md) | Product brief and design system (tokens, components, states) |
| [`AGENTS.md`](AGENTS.md) | Working agreement for AI coding agents: rules, UI quality bar, interaction checklist |

**Research** ([`docs/research/`](docs/research/)): the evidence behind the decisions.

| Doc | Topic |
| --- | --- |
| [`brief-learning-science.md`](docs/research/brief-learning-science.md) | The main evidence brief: retrieval, spacing, feedback, prequestions, motivation, what doesn't work |
| [`brief-ai-tutor.md`](docs/research/brief-ai-tutor.md) | The tutor chat: when AI help helps learning, products and code to borrow, design calls |
| [`skill-strength.md`](docs/research/skill-strength.md) | Which growth metric motivates without gaming (led to D63) |
| [`skill-metrics-motivation.md`](docs/research/skill-metrics-motivation.md) | Round 2: a near goal for strength (led to the gems, D90) |
| [`brief-notetaking.md`](docs/research/brief-notetaking.md) | Active note-taking, with [evidence](docs/research/brief-notetaking-evidence.md), [practice](docs/research/brief-notetaking-practice.md), and checks against [Ahrens](docs/research/brief-notetaking-check-ahrens.md) and [Fiorella & Mayer](docs/research/brief-notetaking-check-fiorella-mayer.md) |
| [`brief-diagramming.md`](docs/research/brief-diagramming.md) | Learner-made diagrams and maps: [evidence](docs/research/brief-diagramming-evidence.md), [tools](docs/research/brief-diagramming-tools.md) |
| [`brief-landscape.md`](docs/research/brief-landscape.md) | Existing apps (Readwise, Anki, RemNote…) and what to take from them |
| [`brief-tech.md`](docs/research/brief-tech.md) | Stack options: Tauri vs others, FSRS, ingest, local AI |
| [`brief-notionrpg-engram.md`](docs/research/brief-notionrpg-engram.md) · [`brief-notetaking-notionrpg.md`](docs/research/brief-notetaking-notionrpg.md) | Tyler's earlier tools, and what carried over |
| [`tp-learn-reference-map.md`](docs/research/tp-learn-reference-map.md) | Open-source projects studied as references |

**Design docs** ([`docs/design/`](docs/design/)): proposals Tyler approved, with the reasoning.

| Doc | Status |
| --- | --- |
| [`review-plan.md`](docs/design/review-plan.md) | Home, Review mode, daily goal, "Ask about this" chat, delight rules (D58 to D62, built) |
| [`in-reader-quiz.md`](docs/design/in-reader-quiz.md) | The finish quiz with the blurred source (D52 to D57, built) |
| [`questions-to-research.md`](docs/design/questions-to-research.md) | Answering questions in the reader's side panel and on the skill page, matched sources, Answered + card (D75, built) |
| [`remixing-cards.md`](docs/design/remixing-cards.md) | Fresh variants of known cards to build transfer (D66, built) |
| [`courses-and-live-links.md`](docs/design/courses-and-live-links.md) | Courses as ordered lesson sources, and live links (D79 built; live links not now) |

**Reviews** ([`docs/reviews/`](docs/reviews/)): audits of the app at a point in time. Some findings are fixed since.

| Doc | What |
| --- | --- |
| [`2026-10-24-foundation-check.md`](docs/reviews/2026-10-24-foundation-check.md) | Architecture and risk review |
| [`2026-10-24-science-audit.md`](docs/reviews/2026-10-24-science-audit.md) | Does the app follow the science? Review-load simulation and 8 ranked recommendations |
| [`2026-10-24-design-critique.md`](docs/reviews/2026-10-24-design-critique.md) | UX heuristics critique (26/40) |
| [`2026-10-24-interaction-audit.md`](docs/reviews/2026-10-24-interaction-audit.md) | Create, rename, move, delete and undo for every object |
| [`2026-10-25-design-critique.md`](docs/reviews/2026-10-25-design-critique.md) · [round 3](docs/reviews/2026-10-25-design-critique-round-3.md) · [round 4](docs/reviews/2026-10-25-design-critique-round-4.md) | UX critique rounds 2 to 4 (28, 30, 30 of 40) |
| [`2026-10-26-motion-review.md`](docs/reviews/2026-10-26-motion-review.md) | Every animation against Emil Kowalski's standards |
| [`2026-10-27-stress-test.md`](docs/reviews/2026-10-27-stress-test.md) | Stress test and foundation check after the iPhone build |
| [`2026-10-28-import-coverage.md`](docs/reviews/2026-10-28-import-coverage.md) | What 53 real links and files keep and miss on import, and the plan to close the gaps |
| [`2026-11-06-import-promise.md`](docs/reviews/2026-11-06-import-promise.md) | The core promise (D122) checked against today's import, with the gaps ranked |
| [`2026-11-02-science-pass.md`](docs/reviews/2026-11-02-science-pass.md) | Second science audit: new features, the draft pile, 8 ranked recommendations |


**Guidebooks** ([`docs/guidebooks/`](docs/guidebooks/)): four evidence-based books the research briefs draw on (Learning Science, Teaching, Gamification, UX and UI Design), each with its paper summaries and source lists.

**Guides**: [`docs/guides/ai-user-testing.md`](docs/guides/ai-user-testing.md) (usability testing with an AI agent driving the app) and its [iPhone version](docs/guides/ai-user-testing-iphone.md), [`skills/ore/README.md`](skills/ore/README.md) (the `/ore` Claude Code skill), [`apps/desktop/scripts/mock/README.md`](apps/desktop/scripts/mock/README.md) (the mocked app for screenshots).

## License

Ore is free software under the [GNU AGPL v3.0 or later](LICENSE) (D120). You may use, change and share it; a copy you share or run for others must stay open under the same license.

"Ore" and its icon name this project. A fork is welcome but must use another name.
