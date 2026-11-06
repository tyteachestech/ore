# Foundation check (2026-10-24)

> Review only, no fixes. Master at `1a989f2` (PRs #1 to #19), 96 tests pass, typecheck clean. Its answers led to the [review plan](../design/review-plan.md) (D58 to D62) and the [bug sweep](#what-the-bug-sweep-should-cover). Some items below are fixed since.

The core is in good shape: plain files, anchoring, FSRS replay, the lock, and a vendor-swappable AI layer. The risks sit above it. The app had polished everything around reading, while the step that makes learning last (spaced review) still had no place in it. The written rules also disagreed with the intended feel, and the user's own writing could be lost without a trace.

## What is solid

- Files are canonical, and the index rebuilds itself from file times and sizes, so agents can edit the library directly (D5, D6).
- Writes are atomic (temp file, then rename). The review log is append-only, and FSRS state is replayed from it without fuzz, so it is deterministic and tested.
- AI calls run outside the library lock. Output is checked against a schema with one retry, and every AI write records vendor, model and prompt version. Claude and Codex are interchangeable.
- The queue follows the evidence brief: interleaving by topic, definitions kept together, priority mapped to retention only (D22, D24).
- The decisions follow the brief closely: retrieval before feedback, nothing from AI before your attempt, no highlight-resurfacing screen, no AI notes.

## Top 3 risks

### 1. Review, the learning engine, has no home in the app (High)

**Found.** The desktop app never called `ore due`, `grade` or `review`. Review existed only as a list in Raycast and the `/ore` Claude Code skill. The brief ranks spaced retrieval with feedback as #1. Meanwhile every finished source drafts prompts and cards live with no approval (D9, D19), with no daily limit on new cards, no due count and no reminder, so the first review could mean a wall of 100+ cards.

**Change.** Make Review the next build, reusing the quiz panel (D57). Add a due count, a time estimate, and a limit on *new* cards per day. → Done as D58 to D62.

### 2. "Duolingo-like" and the written rules point in opposite directions (High)

**Found.** The direction set on 10-24 was encouraging and a bit playful, with hover-only shortcut hints and minimal text. The repo said otherwise: D26 "Dark Raycast-style … no chrome", D57 no sounds or confetti, `PRODUCT.md` visible shortcut hints, `DESIGN.md` describing an old layout. Every new thread reads these files first, so each one re-decided the tone.

**Change.** One short "Feel" decision defining encouraging within the evidence, then rewrite `PRODUCT.md` and `DESIGN.md` to match. → Done as D62.

### 3. Your writing can be overwritten with no history to recover it (Medium-high)

**Found.** `ore init` runs `git init` in the library, but nothing ever committed. The note editor autosaved by replacing the whole file with no check, so an agent's append to `notes.md` while the note was open would be silently wiped. The installed app runs whatever is checked out in the live repo folder (D30).

**Change.** (a) Core commits the library to its local git automatically. (b) `--set` takes the hash of the text it started from and refuses if the file changed. (c) Threads build branches in worktrees, never in the live folder (now in `AGENTS.md`).

## Smaller issues

- **Background AI fails silently.** If enrich fails, the error lives only in `.ore/logs/`. Show "Couldn't draft questions · Retry".
- **Skill notes and links don't feed cards yet** (D39, D41).
- **Confidence is recorded but never shown back** (calibration).
- **The nightly catch-up (D8) isn't in the repo**; it's meant to be a Claude Code Desktop scheduled task.
- **Docs drift** between SPEC, DECISIONS and the glossary.
- **ChatGPT-agnostic holds only partly** until in-app Review exists.

## What the bug sweep should cover

| Area | Checks |
| --- | --- |
| Data paths | Note autosave against outside edits, quitting mid-save, `preserve.ts` round-trips on long notes, `ore doctor` on a copy of a real library |
| Reader | Anchoring on real PDFs, EPUBs and transcripts; re-anchoring after a body edit; outline with 40+ headings; split pane at narrow widths |
| Quiz and finish | Esc keeps the draft; chapter recalls; key-point quotes that don't anchor; Esc with several layers open |
| Skill page | Resize limits, stacking under 1000px, long names and notes, empty states |
| Video | The embed relay, resume position, follow vs manual scroll |
| AI failure | No CLI on PATH, logged out, invalid output twice, timeouts: every case visible and recoverable |
| Consistency | Leftover `title=` tooltips, focus-visible and keyboard on every control, tokens against `DESIGN.md` |
| Other clients | Raycast build and lint, `/ore` skill commands against the current CLI |
