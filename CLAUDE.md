# Ore — agent working agreement

Ore is a Mac-first, AI-first, local-files personal learning app: capture anything (its core promise, below) → read → highlight → AI-drafted exercises → FSRS review → skill-level stats. Owner: Tyler. Single user.

## Read first
- `docs/DECISIONS.md` — settled decisions, by D-number: grep the ones your change touches. To change one, see "Rules are defaults" below.
- `docs/SPEC.md` — data model, CLI, scheduling, AI adapter, deliverables.
- `docs/research/` — evidence and option briefs behind the decisions.
- `docs/design/daily-session.md` — who Ore is for and the daily session: a 10 min to 1 hour habit over a due backlog that never empties. Check queue rules, Home and rewards against it.
- `docs/WORKFLOW.md` — merging, reinstalling the app on Tyler's Mac, parallel threads.

## Rules are defaults (Tyler, 2026-11-13)
Tyler makes many of these rules and decisions in the moment. When good evidence says one is wrong for the case at hand, raise the rule instead of designing around it: name the rule, the evidence and what you would do instead, and he decides whether it bends, changes or goes. A rule changes only with his yes. A new rule says why it exists and what would reopen it; a one-off fix is a test, not a rule (how decisions are written: the top of `docs/DECISIONS.md`, 2026-11-20).

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
- Shipping (`docs/WORKFLOW.md`): once `/code-review` is clean, `bun run ship --reviewed` merges your PR when CI is green and pulls `~/Developer/ore` on the Mac, which reinstalls the app. `~/Developer/ore` stays on `master`; branches live in worktrees. Git housekeeping is yours, never Tyler's.

## UI work (apps/desktop, the iPhone screens in apps/desktop/src/phone)
Before any UI change, read `apps/desktop/CLAUDE.md`: the quality bar (which app to match, proven controls, shortcuts, style rules, motion, looking at it at 2× and 4×) and the interaction checklist every UI change runs.

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
bun run eval:mine:tutor     # prints the tutor turns in his saved chats that he asked again, reworded, stopped or that failed, as candidate tutor cases, and sums the waits in .ore/logs/tutor.jsonl (read-only, no AI)
bun run eval:ask            # Ask-your-library eval: the tutor's retrieval, answers and citations (docs/guides/ask-library.md)
bun run eval:tutor          # tutor pedagogy eval: hints before answers, feedback, A/B of prompts (docs/guides/tutor-eval.md)
bun run eval:questions      # question-quality eval: the AI's exercises scored by code and a judge (docs/guides/question-eval.md)
bun run eval:transcripts    # transcript eval: word error rate per transcript method; Mac only (docs/guides/transcript-eval.md)
# every eval spends AI usage or reads live sites: run by hand, never in CI
bun run bench               # speed of the built app on a 950-source library; CI's bench job gates it (docs/guides/bench.md)
bun run e2e                 # end-to-end journeys in a browser on a seeded mock library (apps/desktop/e2e); add one when a UI bug slipped past the unit tests. CI runs them in five parts side by side, each on a fresh library (ORE_E2E_SHARD=2/5 runs one), so a journey sets up the state it needs instead of leaning on an earlier one
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
- `apps/desktop/src/change.ts` — a change he can take back: a new undoable change calls `change()` (it shows it, puts the step on the history before the write, orders the writes, reverts on failure, reads again), not a hand-written `notify` with its own write order: written by hand in each screen, "⌘Z took back the step before it" had to be fixed place by place (F146, F156, F459 to F487). Every screen uses it. Reopen it if a change can't be said as show, write and its inverse: that one keeps its own steps, marks its write with `whileOut` (`ore.ts`, which ⌘Z waits for) and says why beside it. Today: a highlight and its note (the stand-in id), a Review rating, a toast worded from what the write returns (a cut, a suggested skill), a failure said in its own words or place (a chapter recall, an exercise from a table cell, Ask a question), Finish (its moment), an import (it can take a minute). `apps/desktop/test/undo-waits.test.ts` finds a hand-written step that has neither.
- `apps/desktop/src/list-actions.ts` — what the lists of sources and skills do, once for the Mac (`App.tsx`) and the iPhone (`phone/PhoneApp.tsx`): archive, restore, move, file under a skill, pin, rename, importance, several at once, a course, the skills' layout and collections. A new list action, or a fix to one, goes there, never into one device's screen: written twice, the two drifted (F442, F486, F492 to F494, F573, F620, F621, F622). A device keeps how he asks (keys, drags and right-clicks; swipes and long presses) and where he lands after. Reopen it if a device must behave differently on purpose: that action takes the difference as an argument and says why. `apps/desktop/test/list-actions.test.tsx` runs it headless.
- `apps/desktop/src/highlights.ts` — one source's highlights as the Reader holds them: the list on screen, the stand-in id a new one has until its save lands (either id finds it), the writes still out, and the merge when the library is read again. The Reader keeps only what is the page's (where each sits, its popup). A new lookup or write of a highlight goes through it, never a map of its own in `Reader.tsx`.
- `apps/desktop/src/review-session.ts` — one review session, for Review, the quick quiz and the iPhone: start and end, what is next, the time and goal, Later, and each step's undo. `Review.tsx` draws it and keeps the exercise on screen (answer, marks, grade, editor). A change to when one rating becomes the next exercise goes there, with a case in `apps/desktop/test/review-session.test.ts` (no browser: a slow or failed save, a second press, a close mid-save).
- `apps/desktop/src/QuickQuiz.tsx` — the quick quiz window (D76): Review in quick mode, shown by the system-wide shortcut or menu bar item set up in `src-tauri/src/main.rs` and `src/quick.ts`.
- `apps/desktop/src/Video.tsx` — the YouTube player for video sources (D48–D50), driven over the embed's postMessage protocol; `transcript.ts` maps word times to the rendered text.
- `packages/cli/src/answers.ts` — what each command's `--json` answer holds, typed from the code that builds it; `apps/desktop/src/ore.ts` re-exports it. The app never declares an answer's shape itself: its hand-kept copies drifted from the library with no error (a search hit's `item`). A new answer the app reads gets its type there, from the function that builds it.
- `packages/core/src/templates/library-agents.md` — the AGENTS.md written into every library by `ore init`.
- `skills/ore/SKILL.md` — the `/ore` Claude Code skill (symlinked from `~/.claude/skills/ore`).
