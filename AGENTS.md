# Ore — agent working agreement

Ore is a Mac-first, AI-first, local-files personal learning app: capture anything (its core promise, below) → read → highlight → AI-drafted prompts and cards → FSRS review → skill-level stats. Owner: Tyler. Single user.

## Read first
- `docs/DECISIONS.md` — settled decisions. Do not reopen them; propose changes explicitly.
- `docs/SPEC.md` — data model, CLI, scheduling, AI adapter, deliverables.
- `docs/research/` — evidence and option briefs behind the decisions.

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
- Keep the repo buildable and `bun test` green after every change. Add tests for anchoring, queue order, review replay, frontmatter round-trips. CI (`.github/workflows/test.yml`) runs typecheck, tests, the build and `bun run e2e` on every PR; never merge red.
- A bug fix starts with a test that fails without it: write the test, watch it fail, then fix. A bug no test caught is a gap in the suite, so the test goes where its kind would be caught next time (a core test, an intake case and grid cell, or an e2e journey). If no test can reach it (a macOS-only API, pixels), say why in the PR.
- Intake (D96): a new content type, or a fix to how one imports, lands with a saved example in `packages/core/test/fixtures/intake/` (one we may share: openly licensed, written for Ore, or a page's markup with its words rewritten by `rewrite-page.ts`) and a case in `test/intake.test.ts` (title, author, date, phrases from start to end, headings, images, code), and fills its row in `test/intake-grid.test.ts` (every type × every hazard: a test, n/a, or a named gap). Never save a page that isn't the content: refuse it with the next step. `packages/core/test/golden.test.ts` keeps each sample's whole doc.md: a change shows as a diff in the PR, saved on purpose with `bun run golden:update`. `bun run intake:live` checks the real sites.
- TypeScript strict. Bun runtime, one version everywhere: CI's `bun-version` in `.github/workflows/test.yml` is the Bun on Tyler's Mac (1.4.4, Tyler 2026-11-07, after a download that only broke on his older Bun); bump both together. React for UI. Tauri 2 for the shell. Tiny Swift CLI helpers only where macOS APIs are unavoidable, compiled with `swiftc`.
- Commit task-related work with clear messages; keep unrelated edits out.
- On Tyler's Mac, `~/Developer/ore` stays on `master`: the installed app runs its CLI (D30) against his real library. Build branches in a worktree (`git worktree add ../ore-<topic>`), never by checking one out there.
- Git housekeeping is the thread's job, never Tyler's: do resets, rebases, branch cleanup and reinstalls yourself on the Mac (Remote Control), and never ask him to run a git command. Never rewrite master's history; if it ever must be, the thread that does it also resets `~/Developer/ore`, rebases open PRs and deletes the old branches. Name files in NFC Unicode (macOS shows NFD names as untracked).

## UI quality bar (apps/desktop)
- Match the best app that already does it (Notion, Raindrop, Linear, Raycast, ChatGPT). Before building a control, name the app you are copying and how it behaves there.
- Before building toward that app, audit how it behaves into a checklist first, instead of waiting for Tyler to report gaps: every shortcut in every context, keys at the edges of things, empty states, paste, undo, selection. Test each item and fix the plain misses (`apps/desktop/test/notion-parity.test.ts` is the model). Ask him only about items that clash with Markdown storage or the purpose rule, in one short list.
- Use a proven library for any standard control instead of hand-rolling or downgrading it: Radix primitives (popover, tabs, menus), cmdk (command lists, comboboxes), frimousse (emoji), the pixel UI icons in `apps/desktop/src/icons.tsx` (Pixelarticons, MIT, D105: add a missing one from that set or draw it on its 24 grid, never another icon library), MingCute (skill icons). A text field is never a stand-in for a picker, a menu, a color or a date.
- Constrain input to valid values: pick from a list, validate in `packages/core` on write, and never save half-typed text on blur.
- One click opens what it shows: a list row, card or link opens on a single click (Linear, Raindrop), never a double click; arrows move the selection and Enter opens it.
- Every control whose action has a shortcut shows it on hover through `<Hint keys=…>` (`apps/desktop/src/Hint.tsx`, read from the keymap, Linear-style), never a `title=`. A new binding with no control goes in `NO_CONTROL` in `apps/desktop/test/hints.test.ts` with the reason, or the test fails.
- Style rules (`DESIGN.md` "Style rules", Tyler 2026-10-30): one level of boxes (page sections are a label over a rule, never framed; never a box in a box); 8-bit only where it means something (big numbers, gems, UI icons, badge corners, rings and bars), at the sizes its grid stays sharp; Geist / Geist Mono caps labels / Charter for a source's text, system font for notes; colour only for intents, skills, progress and focus (and the colours he picks for his own note text); one `paper` primary per view. Anything bigger than a fix gets two or three options mocked with `apps/desktop/scripts/mock/ab.ts` (2× shots, 4× crops) for Tyler to pick before it is built. Before the PR, `bun apps/desktop/scripts/mock/style-check.ts` and `.claude/skills/impeccable/scripts/impeccable detect apps/desktop/src --no-advisory` add no new findings.
- Follow `DESIGN.md` tokens and states (hover, selected, focus-visible, empty, loading, error, long text truncation) and keyboard support (arrows, Enter, Esc).
- Run the interaction checklist below before calling UI work done.
- Motion: any change that adds or edits an animation follows `.claude/skills/emil-design-eng` and is checked against `.claude/skills/review-animations/STANDARDS.md` (Emil Kowalski's skills, MIT). Keyboard-driven and 100-times-a-day actions don't animate. For worst-case data, `/break-ui` on the screen you touched.
- Look at it before calling it done, as Tyler sees it: run `vite` with a mocked `ore` (`apps/desktop/scripts/mock/`; its seeds carry Finder junk like `.DS_Store`) or the Tauri app, with real-length and junk data, and fix what you see. Screenshot at `deviceScaleFactor: 2` (his Retina screen), then a 4× crop of every component the diff changes and check each crop against its `DESIGN.md` entry: edge, fill, text colour, and icons and emoji on the text's midline. A whole-page shot hides a 1px outline or an emoji 2px low; the cloud renders Linux fonts, so check emoji and glyph alignment in the real macOS webview (mock README). Put the crops in the PR.

## Interaction checklist (every UI change)
The common-sense behavior every good Mac app has; Tyler should never have to ask for it. How to run it, the matrix to fill and the detail per rule: `.claude/skills/interaction-check/SKILL.md`.
- Full lifecycle for every object he sees (skill, collection, source, highlight, card, question, note, diagram): create, open, rename, move or re-file, reorder where the order is his, delete or archive. A missing one is a bug unless a decision rules it out; list any you skip in the PR.
- Three ways to every action: a visible control (hover ⋯ on rows, Linear-style), the right-click menu (same actions as ⋯, destructive last), and ⌘K.
- Create in place: the new object appears where it lives, selected, name field focused; Enter commits, Esc drops it.
- Rename inline on the title and from its menu ("Rename…", or the "Edit…" dialog when one holds the name and the rest); Enter saves, Esc restores. One menu item per dialog: never two items that open the same dialog.
- Delete or any destructive step acts at once and shows a toast with Undo; it goes on the app history, so ⌘Z takes back a run of steps and ⇧⌘Z redoes them (pass `redo` to `notify`). No "Are you sure?" unless undo is impossible. Every other change he makes (create, rename, type, pin, reorder, edit) goes on that history too, without a toast: `notify(msg, "quiet", undo, redo)`. A change ⌘Z can't take back is a bug.
- Drag and drop wherever he would try it (reorder, file into a group, drop files to add); the target lights up, Esc cancels, and a "Move to…" menu item does the same by keyboard.
- Nothing highlighted until the keyboard moves; one click opens; arrows, Enter, Esc (closes the top layer only and returns focus); Tab reaches every control.
- Every click shows its result within 100 ms (optimistic, rolled back with an error toast); every list has an empty state with its create action; every error says what to do next.
- Every wait on the AI or the network shows that it is working at once, where the result will land: `<Working label="Checking your answer…">` (`apps/desktop/src/Working.tsx`: pixel spinner and what it is doing, `slow=` says how long once it passes 5 s). Never a blank, a still line, or a button that only greys out. `apps/desktop/test/waits.test.ts` lists every slow `ore` call with the label its screen shows (or why nothing waits on it); a new call fails until it is listed.
- Every state, not just the happy path: after any action he knows what happened, can take it back, and knows what to do next. Background work (enrich, remix, grading) that fails says why, with a retry, as soon as it fails, never a silent wait. A status line never hides what is waiting ("All caught up" while new cards are held back).
- Break it before calling it done: AI signed out or missing, offline in the middle of an add, a link that won't open, a scanned PDF, an empty library, the daily limit reached. Each says what happened and the next step, and keeps what he typed. A retry never repeats what already worked.
- Scroll, tab, collapsed groups and selection survive navigation and relaunch. The same object behaves the same on every screen.
- Conventions by surface: every list, reader, palette, picker, editor and window behaves the way that kind of surface does in the best app (the Conventions table in the interaction-check skill). When Tyler has to ask for something obvious, add it to that table in the same PR, so it is never missed again.

## iPhone (apps/phone, apps/desktop/src/phone)
Copy what Apple's own apps do (Books, Notes, Mail) and check against Apple's Human Interface Guidelines; Tyler should never have to ask for basic iOS behavior.
How to run it and the full checklist: `.claude/skills/ios-check/SKILL.md`.
- Native gestures: swipe from the left edge goes back on every pushed screen; pull, tap and long-press act as they do in Apple's apps.
- One tap per action: a selection offers its actions at once (as Books shows its highlight colours), never a button that opens another button.
- Fits a regular iPhone (390 to 430 pt wide, no foldables): nothing wider than the screen, popovers included (they portal outside the phone screens, so style them under `.phone`); inputs 16px so iOS never zooms; nothing hidden under the keyboard (`--keyboard`) or the home indicator (safe areas).
- Check it at 390 pt with touch (Playwright `hasTouch`) and in the iOS simulator before calling it done.

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
bun run eval:grade          # grading eval: Ore's grader on 20 labeled cards (packages/core/eval/grade-cases.json) with Claude and Codex; prints accuracy, cost, time, saves packages/core/eval/results/grade-<date>.json. Spends AI usage: run by hand, never in CI
bun run eval:ask            # Ask-your-library eval: 20 questions over the golden docs (packages/core/eval/ask-cases.json) plus 5 they don't answer; answer and citation accuracy per vendor, saved to packages/core/eval/results/ask-<date>.json. Spends AI usage: by hand only
bun run e2e                 # end-to-end journeys in a browser on a seeded mock library (apps/desktop/e2e); add one when a UI bug slipped past the unit tests
bun link                    # from packages/cli: puts `ore` on PATH (~/.bun/bin/ore), pointing at this checkout
ore --help                  # CLI reference; every command accepts --json
ORE_LIBRARY=/tmp/lib ore init   # scratch library for manual testing; never test against ~/Ore
bun run app:install         # from ~/Developer/ore on master (the live checkout; ~/Desktop/projects/omni-learn is an old copy with no remote): builds the Tauri app and replaces /Applications/Ore.app; dev: `cd apps/desktop && ORE_LIBRARY=/tmp/lib bun run tauri dev` (Cargo target in ~/Library/Caches/ore)
git config core.hooksPath .githooks   # once per clone: every commit touching apps/desktop/ reinstalls the app in the background (log: ~/Library/Caches/ore/app-install.log)
```
AI vendor for enrichment and grading: `ai:` in the library's `skills.yaml` (`claude` or `codex`), `ORE_AI` overrides; its model: `models:` there (Settings › AI › Model, D116), `ORE_AI_MODEL` overrides. Background enrich logs: `<library>/.ore/logs/`.

## Where things are
- `packages/core/src/ai/prompts/*.md` — versioned prompts; bump the `version` header when you change one.
- `packages/core/src/queue.ts` — due-queue order (D22, D24). `scheduler.ts` — ts-fsrs wrapper and retention mapping.
- `packages/core/src/links.ts` — note links and backlinks (D39). `apps/desktop/src/editor/` — the note editor (D38): Milkdown setup, toggle and callout blocks, and `preserve.ts`, which keeps lines he did not edit.
- `apps/desktop/src/QuickQuiz.tsx` — the quick quiz window (D76): Review in quick mode, shown by the system-wide shortcut or menu bar item set up in `src-tauri/src/main.rs` and `src/quick.ts`.
- `apps/desktop/src/Video.tsx` — the YouTube player for video sources (D48–D50), driven over the embed's postMessage protocol; `transcript.ts` maps word times to the rendered text.
- `packages/core/src/templates/library-agents.md` — the AGENTS.md written into every library by `ore init`.
- `skills/ore/SKILL.md` — the `/ore` Claude Code skill (symlinked from `~/.claude/skills/ore`).
