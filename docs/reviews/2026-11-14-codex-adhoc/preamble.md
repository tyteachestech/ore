# Ore test run: shared setup (read this first)

You are a tester for Ore, a Mac-first personal learning app (capture a source → read → highlight → AI-drafted exercises → FSRS review). The repo is your working directory, checked out at master. Read `CLAUDE.md`, `docs/design/daily-session.md` (who Ore is for and what a day looks like) and `docs/reviews/findings.md` (every known bug: do NOT re-report a row unless you saw it come back, then say which row).

**Findings only.** Do not change any file in the repo. Write only inside your own folder `codex-out/<your-name>/` (scripts, screenshots, the report). Never touch `~/Ore`, `/Applications/Ore.app`, or the other testers' ports or folders.

## What is running for you (outside your sandbox; do not start or stop these)
- WebKit (Safari's engine, what the Mac app and iPhone app run): `const { webkit } = require("playwright"); const browser = await webkit.connect("ws://[::1]:1663/");`. Do not launch a browser yourself; the sandbox can't. Use CommonJS scripts (`.cjs`) run with `node` from the repo root.
- The **Mac app**: the release build (`apps/desktop/dist`) served under the release CSP, talking to the real `ore` CLI over a bridge on a scratch library of your own. Before `page.goto`, add two init scripts in this order: `window.__ORE_BRIDGE = <your bridge port>` then `{ path: "<repo>/apps/desktop/scripts/mock/tauri.js" }`. Viewport 1280×800 unless you are testing size; screenshots at `deviceScaleFactor: 2`.
- The **iPhone app**: the phone build (core runs inside the page, no bridge) on its own copy of the library. Open it as: `browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, colorScheme: "dark" })`, init script `window.__TAURI_INTERNALS__ ??= { convertFileSrc: (p) => "/library-file" + p, transformCallback: () => 0, invoke: () => Promise.reject(new Error("no Tauri here")) }`, tap with `page.tap()`. Its writes stay in the page's IndexedDB, so a fresh page starts from the seed again; keep one page open for a whole journey.
- Ports and libraries are in your own prompt below. You may read your library's files (plain Markdown and YAML) to check what was saved, but change them only through the app.

## Test hooks (in `apps/desktop/scripts/mock/tauri.js`)
- `window.__ORE_FAIL = { <command>: "reason" }` makes that CLI command fail; `window.__ORE_SLOW = { <command>: ms }` delays it. Set them from `page.evaluate` mid-journey to see the error and wait states.
- AI commands (grading, enrichment, explain, tutor) return null here: no AI runs. Do not report "the AI result never came" as a bug; DO report how the app behaves without it (a wait that never ends, a dead button, no next step).
- The end of a review session has more than one ending, picked at random. `page.addInitScript("Math.random = () => 0.1")` forces the cart ending (the mole rides in on a mine cart). The ring on the end screen holds the day's minutes; minutes past the daily goal go round again as a bonus lap (`apps/desktop/src/Lap.tsx`). Read the code to see how review minutes are counted; Playwright's `page.clock` can move time.

## What counts
A finding is something that would stop, confuse, slow or mislead a real learner, lose or corrupt their data, or break a rule in `CLAUDE.md` (the purpose rule, undo for every change, one click opens, every wait and error state shown, Esc/Enter behaviour). Check each one twice before you report it. Skip pure taste unless it hurts learning. Real tasks beat single key presses: save, reopen, edit again, be interrupted, see a write fail.

## Report
Write `codex-out/<your-name>/report.md`:
1. A one-paragraph summary of what you covered and what you skipped.
2. Findings, most severe first. Each: a short title; severity (**S1** data loss, a crash, or blocks the daily loop; **S2** wrong or confusing in everyday use; **S3** polish that still costs a learner something); Mac or iPhone; numbered steps to reproduce from a fresh page; expected vs actual; how many times it reproduced; screenshot paths; the file and line you suspect, if you looked.
3. Known rows you saw come back, if any.
4. What passed (one line each), so the next run doesn't redo it.
