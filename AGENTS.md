# Ore — agent working agreement

Ore is a Mac-first, AI-first, local-files personal learning app: capture anything (its core promise, below) → read → highlight → AI-drafted exercises → FSRS review → skill-level stats. Owner: Tyler. Single user.

## Read first
- `docs/DECISIONS.md` — settled decisions, by D-number: grep the ones your change touches. To change one, see "Rules are defaults" below.
- `docs/SPEC.md` — data model, CLI, scheduling, AI adapter, deliverables.
- `docs/research/` — evidence and option briefs behind the decisions.
- `docs/design/daily-session.md` — who Ore is for and the daily session: a 10 min to 1 hour habit over a due backlog that never empties. Check queue rules, Home and rewards against it.
- `docs/WORKFLOW.md` — merging, reinstalling the app on Tyler's Mac, parallel threads.

## Rules are defaults (Tyler, 2026-11-13)
Tyler makes many of these rules and decisions in the moment. When good evidence says one is wrong for the case at hand, raise the rule instead of designing around it: name the rule, the evidence and what you would do instead, and he decides whether it bends, changes or goes. A rule changes only with his yes.

## Talking to Tyler
Name the thing in plain words: the screen, what it does now, what he does next. A finding, decision or PR number only follows as a link or in brackets, never in place of the words.

## Purpose rule (Tyler, 2026-10-25)
Everything on screen MUST have an explicit purpose: a thing Tyler needs to see or do to learn. Build minimal by default. Never add an element to make the app look like an app (stat pills, counts, taglines, decorative cards). Before adding one, name its purpose in one line; if you can't, leave it out. When you touch a screen, remove what fails this test and list what you removed in the PR.

## Core promise: everything you learn from comes in whole (Tyler, 2026-11-06, D122)
Ore's core promise is that whatever someone learns from imports as fully and robustly as possible, into one format built for learning. That covers at least the top 80% of what people learn from: web articles, YouTube and other video, podcasts and audio, every kind of PDF (papers, textbooks, slides, scans, with their tables and formulas), EPUB books, documents, slides, notebooks and screenshots. Every type lands as the same `doc.md`: its own title, author and date; its headings as the outline; its images, tables, math and code intact; timestamps for anything that plays; the original kept so a better reader can reimport it. That one shape is what lets every source be read, highlighted, noted, quizzed and reviewed the same way. Import is the base the whole loop stands on: a source that comes in broken can't be learned from, so a broken import is a core bug, not polish. What can't come in is refused with the next step (D96), never saved half-read. Open gaps: `"gap:"` in `packages/core/test/intake-grid.test.ts`, ranked in `docs/reviews/2026-11-06-import-promise.md`.

## Rules
- Smallest complete solution. Add features only when the behavior requires them. No speculative abstractions.
- Files in the library are canonical; `.index` is disposable. Never write to the library from the UI or agents except through `packages/core` (or the `ore` CLI).
- One FSRS implementation (ts-fsrs). Priority never alters FSRS math (D22).
- AI never sets the recorded rating (D21). AI output always records vendor, model, prompt version.
- No streaks, XP, quotas, badges, leaderboards (D23).
- Licenses (D120): Ore is AGPL-3.0-or-later. A dependency must be compatible: MIT, BSD, ISC, Apache-2.0, MPL-2.0, LGPL, GPL-3.0 or AGPL-3.0, and its model weights' own license counts too. Never GPL-2.0-only, proprietary, non-commercial, or license-key tools (tldraw). The iPhone app bundles only permissive code (no GPL/LGPL/AGPL), since the App Store's terms clash with GPL; GPL tools run on the Mac only, and the phone gets their results through sync. Big tools (Python, ML models) are optional Mac downloads, never needed to add or open a source.
- Keep the repo buildable and `bun test` green after every change. Add tests for anchoring, queue order, review replay, frontmatter round-trips. CI (`.github/workflows/test.yml`) runs typecheck, tests, the build and `bun run e2e` on every PR; never merge red. A flaky test is a real race until shown otherwise: give it a findings row and find the cause (`triage-report` step 3), never a rerun, a retry or a skip.
- A bug fix starts with a test that fails without it: write the test, watch it fail, then fix. A bug no test caught is a gap in the suite, so the test goes where its kind would be caught next time (a core test, an intake case and grid cell, or an e2e journey). If no test can reach it (a macOS-only API, pixels), say why in the PR. Every bug found, by a sweep, a review or Tyler, gets a row in `docs/reviews/findings.md` (read it before a sweep; `triage-report` skill), set to `fixed #PR` with its guard in the PR that fixes it (a new row is `F-new-<slug>` until `bun run ids` numbers it at merge), and the PR shows the test's red and green runs.
- Intake (D96): a new content type, or a fix to how one imports, lands with a saved example in `packages/core/test/fixtures/intake/` (one we may share: openly licensed, written for Ore, or a page's markup with its words rewritten by `rewrite-page.ts`) and a case in `test/intake.test.ts` (title, author, date, phrases from start to end, headings, images, code), and fills its row in `test/intake-grid.test.ts` (every type × every hazard: a test, n/a, or a named gap). Never save a page that isn't the content: refuse it with the next step. `packages/core/test/golden.test.ts` keeps each sample's whole doc.md: a change shows as a diff in the PR, saved on purpose with `bun run golden:update`. `bun run intake:live` checks the real sites.
- TypeScript strict. Bun runtime, one version everywhere: CI's `bun-version` in `.github/workflows/test.yml` is the Bun on Tyler's Mac (1.4.4, Tyler 2026-11-07, after a download that only broke on his older Bun); bump both together. React for UI. Tauri 2 for the shell. Tiny Swift CLI helpers only where macOS APIs are unavoidable, compiled with `swiftc`.
- Names (D43, D181): what review brings back is an **exercise** (kinds Fact and Explain) in everything the app shows and in new docs, never a card or flashcard; a highlight marked with the gem (D229) is a Key point. Files, the CLI, key ids and code keep `card`. `apps/desktop/test/names.test.ts` checks the app's strings.
- Commit task-related work with clear messages; keep unrelated edits out.
- Shipping (`docs/WORKFLOW.md`): merge your own PR once CI is green and `/code-review` is clean, then pull `~/Developer/ore` on the Mac, which reinstalls the app. `~/Developer/ore` stays on `master`; branches live in worktrees. Git housekeeping is yours, never Tyler's.

## UI quality bar (apps/desktop)
- Match the best app that already does it (Notion, Raindrop, Linear, Raycast, ChatGPT). Before building a control, name the app you are copying and how it behaves there.
- Before building toward that app, audit how it behaves into a checklist first, instead of waiting for Tyler to report gaps: every shortcut in every context, keys at the edges of things, empty states, paste, undo, selection. Test each item and fix the plain misses (`apps/desktop/test/notion-parity.test.ts` is the model). Ask him only about items that clash with Markdown storage or the purpose rule, in one short list.
- Use a proven library for any standard control instead of hand-rolling or downgrading it: Radix primitives (popover, tabs, menus), cmdk (command lists, comboboxes), the pixel UI icons in `apps/desktop/src/icons.tsx` (MingCute redrawn on a 16 grid, D105 as amended by D129: draw a missing one on that grid from its MingCute glyph, never another icon library), the pixel skill icon set in `apps/desktop/src/skill-icon-set.ts` (D157: no emoji, no smooth glyph anywhere; a new subject is added there, redrawn and checked at 4×). A text field is never a stand-in for a picker, a menu, a color or a date.
- Constrain input to valid values: pick from a list, validate in `packages/core` on write. A text field edited in place saves on Enter and on a click away, as Finder, Notion and Linear do; Esc throws the edit away (D211). Only a value that fails validation stays open and says why.
- One click opens what it shows: a list row, card or link opens on a single click (Linear, Raindrop), never a double click; arrows move the selection and Enter opens it.
- Every control whose action has a shortcut shows it on hover through `<Hint keys=…>` (`apps/desktop/src/Hint.tsx`, read from the keymap, Linear-style), never a `title=`. A new binding with no control goes in `NO_CONTROL` in `apps/desktop/test/hints.test.ts` with the reason, or the test fails.
- The current style direction is `docs/design/signature-style.md` (D129): read it before any style work. Style rules (`DESIGN.md` "Style rules", Tyler 2026-10-30): one level of boxes (page sections are a label over a rule, never framed; never a box in a box); one way of drawing, round dots (D183), only where it means something (icons, gems, rings, a screen's one hero number), never a square pixel beside them except a cut gem, whose dots have fused into pixels (D236); Geist / OpenTUI Mono sentence-case labels / Charter for a source's text, system font for notes; colour only for intents, skills, progress and focus (and the colours he picks for his own note text); one `paper` primary per view. Anything bigger than a fix gets two or three options mocked with `apps/desktop/scripts/mock/ab.ts` (2× shots, 4× crops) for Tyler to pick before it is built. CI fails on a new style finding: `bun run e2e` ends with `style-check.ts` (nested frames, off-ramp sizes) and `impeccable-gate.ts` allows no Impeccable finding beyond its baseline (`--update` accepts one; say why in the PR).
- Follow `DESIGN.md` tokens and states (hover, selected, focus-visible, empty, loading, error, long text truncation) and keyboard support (arrows, Enter, Esc).
- Run the interaction checklist (below) before calling UI work done.
- Motion: speeds and curves come only from the motion tokens (`DESIGN.md` "Motion", D185: everyday moves quick with no bounce, the spring only on moments). Any change that adds or edits an animation follows `.claude/skills/emil-design-eng` and is checked against `.claude/skills/review-animations/STANDARDS.md` (Emil Kowalski's skills, MIT). Keyboard-driven and 100-times-a-day actions don't animate (exceptions: a highlight landing, D240; the mole's springs, D214; the sidebar cursor's one-frame bounce, D113). For worst-case data, `/break-ui` on the screen you touched.
- Look at it before calling it done, as Tyler sees it: run `vite` with a mocked `ore` (`apps/desktop/scripts/mock/`; its seeds carry Finder junk like `.DS_Store`) or the Tauri app, with real-length and junk data, and fix what you see. Screenshot at `deviceScaleFactor: 2` (his Retina screen), then a 4× crop of every component the diff changes and check each crop against its `DESIGN.md` entry: edge, fill, text colour, and icons and emoji on the text's midline. A whole-page shot hides a 1px outline or an emoji 2px low; the cloud renders Linux fonts, so check emoji and glyph alignment in the real macOS webview (mock README). Put the crops in the PR. An animation is looked at the same way, beat by beat: a frame sheet of every beat at 4×, the ones the change did not touch too, and in each frame every place two drawings meet (dots have gaps, so one shows through the other; a thing turning must not pass through what it carries). A critic given a whole-screen sheet misses this (F155).

## Interaction checklist (every UI change)
Every UI change runs `.claude/skills/interaction-check/SKILL.md` before it is done: the rules (full lifecycle for every object, three ways to every action, undo for every change, every wait and error state), how to run them, and the Conventions table. When Tyler has to ask for something obvious, add it to that table in the same PR.

## iPhone (apps/phone, apps/desktop/src/phone)
Every phone change runs `.claude/skills/ios-check/SKILL.md` (Apple's own apps and the HIG, 390 pt with touch, the iOS simulator) before it is done.

## Layout
```
packages/core    domain, storage, ingest, anchoring, scheduling, ai adapter
packages/cli     `ore` command-line tool (thin over core)
apps/desktop     Tauri 2 app (v1)
skills/ore       Claude Code skill for quizzing and library work
docs/            decisions, spec, research
```

## Commands
```bash
bun install                 # workspace deps (packages/*, apps/desktop)
bun test                    # all tests (packages/core/test, apps/desktop/test: the note editor, headless)
bun run typecheck           # tsc strict, whole workspace
bun run golden:update       # rewrite test/golden/*.md (whole doc.md per sample source) after an import change you mean; read the diff
bun run eval:grade          # grading eval: Ore's grader on labeled exercises, Claude vs Codex (docs/guides/grading-eval.md)
bun run eval:mine           # prints real reviews where Tyler's rating and the grader's fell on different sides, as candidate golden cases (read-only, no AI)
bun run eval:ask            # Ask-your-library eval: the tutor's retrieval, answers and citations (docs/guides/ask-library.md)
bun run eval:tutor          # tutor pedagogy eval: hints before answers, feedback, A/B of prompts (docs/guides/tutor-eval.md)
bun run eval:questions      # question-quality eval: the AI's exercises scored by code and a judge (docs/guides/question-eval.md)
bun run eval:transcripts    # transcript eval: word error rate per transcript method; Mac only (docs/guides/transcript-eval.md)
# every eval spends AI usage or reads live sites: run by hand, never in CI
bun run bench               # speed of the built app on a 950-source library; CI's bench job gates it (docs/guides/bench.md)
bun run e2e                 # end-to-end journeys in a browser on a seeded mock library (apps/desktop/e2e); add one when a UI bug slipped past the unit tests. CI runs them in four parts side by side, each on a fresh library (ORE_E2E_SHARD=2/4 runs one), so a journey sets up the state it needs instead of leaning on an earlier one
bun run release:check       # the built app (`bun run --cwd apps/desktop build` first) under the release CSP from tauri.conf.json, in WebKit, on a seeded mock: Home, a source, a skill, All sources, a review; fails on a CSP refusal or page error (CI's e2e shard 1)
bun link                    # from packages/cli: puts `ore` on PATH (~/.bun/bin/ore), pointing at this checkout
ore --help                  # CLI reference; every command accepts --json
ORE_LIBRARY=/tmp/lib ore init   # scratch library for manual testing; never test against ~/Ore
bun run app:install         # from ~/Developer/ore on master (the live checkout): builds the Tauri app with its own compiled `ore` (D30) and replaces /Applications/Ore.app; dev: `cd apps/desktop && ORE_LIBRARY=/tmp/lib bun run tauri dev` (Cargo target in ~/Library/Caches/ore)
git config core.hooksPath .githooks   # once per clone: a commit or pull on master touching apps/desktop/ or packages/ (its compiled `ore`) reinstalls the app in the background (log: ~/Library/Caches/ore/app-install.log)
```
AI vendor for enrichment and grading: `ai:` in the library's `skills.yaml` (`claude` or `codex`), `ORE_AI` overrides; its model: `models:` there (Settings › AI › Model, D116), `ORE_AI_MODEL` overrides. Background enrich logs: `<library>/.ore/logs/`.

## Where things are
- `packages/core/src/ai/prompts/*.md` — versioned prompts; bump the `version` header when you change one. How an exercise is written (D182: the process, each type, what to avoid) lives in `enrich.md`, `variant.md` and `tutor.md`, its evidence in `docs/research/brief-exercise-types.md`; a change to it is checked with `bun run eval:questions`, run twice.
- `packages/core/src/queue.ts` — due-queue order (D22, D24). `scheduler.ts` — ts-fsrs wrapper and retention mapping.
- `packages/core/src/links.ts` — note links and backlinks (D39). `apps/desktop/src/editor/` — the note editor (D38): Milkdown setup, toggle and callout blocks, and `preserve.ts`, which keeps lines he did not edit.
- `apps/desktop/src/QuickQuiz.tsx` — the quick quiz window (D76): Review in quick mode, shown by the system-wide shortcut or menu bar item set up in `src-tauri/src/main.rs` and `src/quick.ts`.
- `apps/desktop/src/Video.tsx` — the YouTube player for video sources (D48–D50), driven over the embed's postMessage protocol; `transcript.ts` maps word times to the rendered text.
- `packages/core/src/templates/library-agents.md` — the AGENTS.md written into every library by `ore init`.
- `skills/ore/SKILL.md` — the `/ore` Claude Code skill (symlinked from `~/.claude/skills/ore`).
