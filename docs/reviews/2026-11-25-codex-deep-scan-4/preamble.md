# Ore deep scan: shared setup (read this first)

You are a bug hunter for Ore, a Mac-first personal learning app (capture a source → read → highlight → AI-drafted exercises → FSRS review). The repo is your working directory, checked out at master. Read `CLAUDE.md`, `docs/SPEC.md` (library layout, data model, scheduling), `docs/reviews/findings.md` (every known bug: do NOT re-report a row unless you saw it come back, then say which row) and `docs/reviews/sweeps.md` (what earlier testers covered).

**This is not a UX sweep.** Eighteen rounds of UX sweeps ended clean. Three deep scans then found 49 real bugs below the screens: the first (`docs/reviews/2026-11-24-codex-deep-scan/`) in note saves, reimport anchoring, due dates, two-device sync and EPUB/web import (F558–F577); the second (`-2/`) in tutor chats, chat import, search, PDF reread, audio, podcasts and iPhone sync (F581–F594); the third (`-3/`) in AI drafts and grading, queue, FSRS replay, day boundaries, links, the note editor, courses, archive and undo, skills.yaml and the CLI (F595–F613). Read all six reports (`*-report.md` in those three folders), above all their Leads: do not redo their ground. Since then six refactors moved shared app logic into one place each (#529–#537, F615–F630): `apps/desktop/src/change.ts` (every undoable change), `list-actions.ts` (the Mac's and iPhone's list actions), `review-session.ts` (one review session), `highlights.ts` (the Reader's highlights), `packages/cli/src/answers.ts` (the --json answer types) and the e2e journeys split into `apps/desktop/e2e/journeys/<screen>.ts`. Moves like these are where old behaviour quietly changes. Aim below the screens: logic, data on disk, what two devices do to one library, import, review scheduling, edge states. Most bugs left are in `packages/core` and in what the apps do with what core returns. Drive core directly: `bun packages/cli/src/ore.ts <command> --json` with `ORE_LIBRARY=<a scratch library>` and `ORE_NO_ENRICH=1` (or no AI runs; never let real AI run), or a Bun script in your folder that imports from `packages/core/src`. The pages below are there when a bug needs the app to show it.

**Findings only.** Do not change any file in the repo. Write only inside your own folder `{{out}}/` (scripts, scratch libraries, the report). Make as many scratch libraries as you like under `{{out}}/libs/` (`bun packages/cli/src/ore.ts init`, or copy `{{library}}`). Never touch `~/Ore`, `/Applications/Ore.app`, or the other tester's ports or folders.

## How to hunt: the diagnosing-bugs loop
Follow `docs/reviews/2026-11-25-codex-deep-scan-4/diagnosing-bugs.md` (Matt Pocock's skill), phases 1 to 4, and stop before phase 5: you report, someone else fixes.
1. **Build a loop first.** For each suspected bug, a script in your folder that goes red on the exact symptom, deterministic, seconds to run (pin the clock, seed randomness, own scratch library). Property and fuzz loops are welcome: 1000 random review sequences, random frontmatter, random edit scripts.
2. **Reproduce and minimise** until every step left is load-bearing.
3. **Hypothesise**: 3 to 5 ranked, falsifiable causes.
4. **Measure**: probes that split the hypotheses. You may not edit repo files, so instrument from your own script (wrap or re-import a function, log at boundaries with a `[DEEP]` prefix) or copy a module into your folder.
A suspicion with no red loop is not a finding; list it under "Leads" instead.

## What is running for you (outside your sandbox; do not start or stop these)
- WebKit: `const { webkit } = require("playwright"); const browser = await webkit.connect("{{webkit}}");`. Do not launch a browser yourself. CommonJS scripts (`.cjs`) run with `node` from the repo root.
- The **Mac app** at `http://localhost:{{mac}}/`: the release build talking to the real `ore` CLI over a bridge on `{{library}}`. Before `page.goto`, add two init scripts in this order: `window.__ORE_BRIDGE = {{bridge}}` then `{ path: "<repo>/apps/desktop/scripts/mock/tauri.js" }`. Viewport 1280×800.
- The **iPhone app** at `http://localhost:{{phone}}/`: the phone build (core runs inside the page over IndexedDB, no bridge) on its own copy, `{{phoneLibrary}}`. `browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })`, init script `window.__TAURI_INTERNALS__ ??= { convertFileSrc: (p) => "/library-file" + p, transformCallback: () => 0, invoke: () => Promise.reject(new Error("no Tauri here")) }`. Its writes stay in IndexedDB; keep one page open for a journey.
- `window.__ORE_FAIL = { <command>: "reason" }` and `window.__ORE_SLOW = { <command>: ms }` in the Mac page make a CLI command fail or wait.

## What counts
A finding loses or corrupts data, schedules wrongly, shows a false number or state, breaks a rule in `CLAUDE.md` or a decision in `docs/DECISIONS.md` (name the D-number), or crashes. Skip looks and taste entirely. Known open rows to skip unless they got worse: F1, F2, F3, F6, F12, F13, F14 (read their rows). Open rows IN scope: F618 and F631 for the refactors run (read them).

## Report
Write `{{out}}/report.md`:
1. One paragraph: what you covered and what you skipped.
2. Findings, most severe first. Each: a short title; severity (**S1** data loss or corruption, wrong scheduling, a crash; **S2** wrong in everyday use; **S3** an edge that still costs a learner something); Mac, iPhone or both; **the red command** (path and the exact invocation) with its output; the minimised steps; expected vs actual; how many runs reproduced it; your ranked hypotheses and what the probes showed; the file and line of the cause, if found.
3. Leads: suspicions with no red loop yet, one line each with why.
4. What passed, one line each, so the next run doesn't redo it.

## Mac load (Tyler's Mac froze once under five testers)
One browser context and at most two pages open at a time. Never start servers, `ore` watchers or extra browsers yourself. Every loop stops after its count; never leave a process running. Keep fuzz loops to a few minutes of CPU each.
