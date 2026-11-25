# Soak — 24 November 2026

Covered master `05c68297d33d46d6b17b404c101543bc9dfd9557` in the supplied Mac release page and WebKit, with one page kept open throughout the soak: 24 hourly source additions, reading/highlighting, tutor opens without sending, 45 saved ratings, outside CLI/core writes, delayed and failed enrichment, one midnight crossing, and a four-hour sleep/wake jump. The page advanced from **24 Nov 08:00 to 25 Nov 11:09 Pacific**, without reload. Read the working agreement, specification, findings/sweeps, earlier scan reports and the supplied diagnosing-bugs guide (present under `2026-11-25-codex-deep-scan-5`). **Two S2 findings: one new race and one remaining F173 case.** Skipped appearance, EPUB front matter, highlight-animation timing, real AI, native iCloud/iPhone/Tauri behavior, and the earlier scans' core/import/scheduling investigations. Wrote scripts, evidence and this report only here; library mutations used core/CLI against the explicitly assigned disposable `codex-out/libs/soak`. No tracked source, findings row, installed app, server or other tester's folder was changed.

## Findings

### SOAK-01 — An older Home response replaces a newer saved daily goal

**S2 · Mac observed; `Home.tsx` is shared with iPhone, which was not run. New finding.**

Run from `/Users/tylerpoelking/Developer/ore-wt/deep5` with the supplied browser and bridge available:

```sh
node codex-out/soak/driver.cjs home-race
```

Output excerpt from [home-race-red-1.log](home-race-red-1.log); exits **1** on the symptom assertion:

```text
[DEEP] {"test":"home-race","control":"held","original":10,"next":15,
  "fresh":"1 of 15 min\nPlan when you review\nM\nT\nW\nT\nF\nS\nS\nStart review",
  "afterOld":"1 of 10 min\nPlan when you review\nM\nT\nW\nT\nF\nS\nS\nStart review","disk":15}
AssertionError [ERR_ASSERTION]: An older Today response replaces the newer goal on Home
```

**Minimised steps:**

1. Open Home with a ten-minute goal. Return from an absence, holding the resulting `today` reply **after** the real CLI has calculated it. The mock's `__ORE_SLOW.today` holds delivery; it does not fabricate the answer.
2. Outside the page, run `ore goal --minutes 15 --json` with the assigned scratch library and `ORE_NO_ENRICH=1`.
3. Return again, allowing the second `today` reply through. Verify Home says `1 of 15 min`.
4. Release only the older reply. Home now says `1 of 10 min`, while a new CLI read still returns `goal_minutes: 15`.

**Expected:** A completed newer read remains authoritative. **Actual:** The earlier snapshot replaces the newer goal on screen and in the shared Today cache. No goal write was lost; this is a false displayed state under D5/D60. This differs from F125's stale Home on leaving Review and F274's missing refresh after Undo: here the fresh result already appeared, then an older result replaced it.

**Reproduction:** 3/3 in the uninterrupted soak page; **3/3 standalone confirmation runs**, 1.78–1.88 seconds each. Three serial controls passed in the soak and **3/3 standalone controls passed**. The control releases the old answer before changing the goal:

```sh
SOAK_CONTROL=serial node codex-out/soak/driver.cjs home-race
```

It prints `fresh: "1 of 15 min…", afterOld: "1 of 15 min…", disk: 15` and exits 0. Scripts restore the original goal before exiting.

**Ranked hypotheses and probes:**

1. **Home accepts reads in completion order without checking which is newest.** Prediction: delivering the old result last goes red; serial delivery passes. Both predictions hold in all counted runs.
2. **The external goal write was reverted or did not save.** Prediction: a fresh CLI `today` also reports ten. Rejected: it reports fifteen after the screen has reverted to ten.
3. **An independent cached value or number animation restores the old goal.** Prediction: the screen changes without releasing the held response, or settles back to fifteen. Rejected at the measured boundary: fifteen is displayed before release, ten after release and settling; changing only reply order removes the symptom.

**Cause:** [apps/desktop/src/Home.tsx:147](../../apps/desktop/src/Home.tsx#L147), especially lines **148–154**: every fulfilled read unconditionally calls `rememberToday(t)` and `setToday(t)`; there is no read generation or cancellation check. The effect at line **160** can start another read while the first remains outstanding. Both the displayed value and the cache receive the stale result. No implementation fix was made.

### SOAK-02 — Returning from another app does not refresh renamed sidebar skills (F173 remains)

**S2 · Mac. Recurrence/remaining case of F173, not a new independent finding.**

```sh
node codex-out/soak/driver.cjs focus-sidebar
```

Output excerpt from [focus-sidebar-red-1.log](focus-sidebar-red-1.log); exits **1**:

```text
[DEEP] {"test":"focus-sidebar","expected":"Soak external skill",
  "sidebar":["Home","Feed","All sources","No skill","Creator Business","Creativity", …],
  "commands":{"today":1,"ls":2,"settings":2,"inbox":2}}
AssertionError [ERR_ASSERTION]: Sidebar keeps the old skill name after returning from another app
```

**Minimised steps:** Open Home; outside the page run `ore skills set creativity --name 'Soak external skill' --json`; blur the page, flush its zero-delay blur callback, advance twelve seconds, then focus it. Let all commands finish. Compare the sidebar with a fresh `ore skills --json` read.

**Expected:** The sidebar uses the saved name after returning. **Actual:** Disk says `Soak external skill`; the sidebar still says `Creativity`. Home and source-list reads do run, but no `skills` call occurs. The script restores the original skill name after capturing the evidence. [Screenshot](focus-sidebar.png).

**Reproduction:** 3/3 correctly clocked checks in the uninterrupted page and **3/3 standalone confirmations**, 1.46–1.47 seconds each. An initial setup attempt that did not flush the blur callback before advancing time was discarded, because it did not exercise the return handler.

**Ranked hypotheses and probes:**

1. **The return handler reloads sources but omits skills.** Prediction: `ls`/`today` occur, but `skills` does not. Confirmed by the command counters in each run.
2. **A skills request runs, but its result is discarded by the read guard or renderer.** Prediction: at least one skills request is present. Rejected: there is none.
3. **The CLI still returns the old name.** Prediction: an independent `skills` read returns `Creativity`. Rejected: it returns `Soak external skill`. Other outside changes are read successfully: the source author, Home's due count and Continue reading title controls pass.

**Cause:** [apps/desktop/src/App.tsx:406](../../apps/desktop/src/App.tsx#L406), lines **409–411**, calls `refresh()`, `fromPhone()` and `wakeScreens()`. `refresh()` reloads source lists; the sidebar's `reloadSkills()` at lines **359–373** is not called. The combined `reload()` at lines **375–378** does load skills, but this return path does not use it. F173's original [outside report](../../docs/reviews/2026-11-14-codex-sweep-2/outside-report.md) explicitly included the stale sidebar name. The open-source portion now passed; this sidebar portion still fails. D5/D78 provide the canonical-file/two-device context.

## Leads and limits

- **Heap retention remains unmeasured:** WebKit exposed no `performance.memory`. Stable DOM, timers and window/document listeners do not prove every JavaScript object is reclaimed; detached-node/heap profiling was not available in this run.
- **One scripted review start at hour 16 produced no recognized answer control before the helper left.** No app error or state snapshot was captured at that instant, and later starts worked. No deterministic red loop, so it is not a finding or a claim that F142 returned.
- **Real midnight/native wake:** `page.clock` advances the web page, not the bridge process. The explicit midnight check used real `today(lib, date)` results from [today-at.ts](today-at.ts), selected by the browser's date through `__ORE_EDIT.today`. This verifies the mounted Home's midnight refresh and display, not OS sleep or a wall-clock change in the native CLI. The four-hour jump and all normal outside-write checks used the actual bridge.
- Listener tracking covers explicit registrations on `window` and `document`; it deliberately does not retain all DOM targets. The mock's own Tauri callback bookkeeping is not treated as an application memory leak.

## What passed

- **One uninterrupted page, no reload:** 27 hours 9 minutes of browser time; **zero page errors**. The two red commands were subsequently confirmed in fresh, sequential single-page contexts, after the soak page closed. No extra browser or server was launched.
- **24 hourly sources, 24 saved highlights:** `Soak hour 00` through `Soak hour 23` each have exactly one annotation on disk. [soak-final.json](soak-final.json) records their IDs and counts.
- **45 ratings saved through the page:** real CLI `review` calls, no AI grading; fixtures supplied Fact exercises through core. No claim of two ratings at every checkpoint: the first hour had one and hour 16 had none.
- **23 automated outside-author checks:** every reopened/refreshed source showed its externally saved author. The four-hour sleep/wake jump also showed the author changed while absent.
- **Home vs disk controls:** an outside rename appeared in Continue reading; newly created due exercises appeared in the hover count (`6 due`); the last four hourly comparisons each matched disk (`8 due`), all sidebar names and all sampled Continue reading titles matched. These controls do not erase SOAK-02's explicit rename failure.
- **Midnight:** the mounted Home made one new Today request and settled from the prior day's nonzero minutes to `0 of 10 min`; production core returned `active_ms: 23080 → 0` and `due: 6 → 8` for the selected dates. The first text read caught the number animation mid-transition; after 1.6 seconds it settled correctly. This was a harness timing correction, not a finding about highlight animation or midnight behavior.
- **Pending enrichment is bounded:** [poll-idle.cjs](poll-idle.cjs) observed exactly **45** four-second `ls` reads; on tick 46 both the poll and its Working animation interval were gone. A further idle sample and Home after closing the source made **zero** `ls` calls.
- **Failed enrichment retry:** the injected `enrich` failure appeared with `Try again` and its reason; it invoked no real AI and left no repeating poll after closure.
- **Late enrichment response controls:** a poll from the closed Alpha source did not insert its question into Beta; a held poll on the same source did not overwrite a newer outside skill assignment. [poll-race.cjs](poll-race.cjs), [reader-poll.cjs](reader-poll.cjs). The first Alpha setup used `--no-enrich`, which correctly disabled polling; that invalid setup was corrected and was not counted as a bug.
- **Idle load stayed bounded:** all 23 post-warm-up hourly samples made zero ore calls during their approximately 61.8-second measurement windows. The three-hour feed interval remained one interval throughout; it fired eight times across the run, with missed firings coalesced by the simulated sleep. The initial Home sample included one-time inbox/settings reads.

| Screen | Hourly samples | DOM nodes | Active intervals | Tracked window/document listeners | Idle ore calls/minute |
| --- | ---: | ---: | ---: | ---: | ---: |
| Home | 7 | 781–782 | 2 | 106 | 0 |
| Reader | 8 | 262 | 1 | 98 | 0 |
| Reader + tutor | 8 | 307 | 1 | 100 | 0 |

Two short recurring animation timeouts remained bounded; one reader sample also caught a temporary 120 ms timeout. A tooltip after the sleep check temporarily added DOM/listeners and disappeared on subsequent navigation; final Home returned to 106 listeners and two intervals. No unbounded growth, accumulating idle poll, or closed-screen repeating timer was demonstrated. Measurements are in [metrics.json](metrics.json) and [metrics-summary.json](metrics-summary.json); chronological probes are in [session.jsonl](session.jsonl).

**Verification and handoff:** [confirmation.json](confirmation.json) contains six expected red exits and three successful serial controls, generated by `python3 codex-out/soak/confirm.py`. Each counted failure contains the exact symptom assertion, not a timeout. The scripts restore the changed goal and skill name. All owned browser contexts and driver/confirmation processes were closed; the supplied browser/servers were left running. `git status --short` remained empty. No fixes, findings-registry edits, commits or pushes were made.
