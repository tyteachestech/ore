# Ore deep scan 5 — perf

Covered core/CLI read paths, five single-source/skill mutations, the supplied Mac release page, and the supplied phone page at two library sizes, using diagnosing-bugs phases 1–4. Tested checkout `05c68297d33d46d6b17b404c101543bc9dfd9557`, Bun 1.4.4, on 2026-11-24 Pacific / November 25 UTC. The supplied seed actually contains **238 sources, 288 exercises and 1,216 reviews**, not ~950. Private copies expanded it to **952/1,904 sources, 1,152/2,304 exercises and initially 4,864/9,728 reviews**, preserving references; no orphan review references were found. There are 14 skills at both sizes. I read the agreement, spec, findings, sweep coverage and previous scan reports; scans 4–5 are dated November 25 in this checkout. Skipped previous scans' correctness cases, the named open non-performance rows, EPUB front matter, highlight animation timing, real AI, live importing, native iCloud transport and native iPhone hardware. All authored artifacts and scratch libraries are in this folder; no implementation, tracked tests, findings ledger or decisions were edited. No server, watcher or browser was started, and `bun run bench` was not run. Three new performance findings follow; F293/F294 are profiled separately and are **not counted as new bugs**.

## Findings

### PERF-01 — Review readiness rereads the whole library once per skill

**S2 · Mac and iPhone · reproduced 3/3 per minimal command, and 3/3 at each scale for each command.**

`tries --now` is on the Start review path. `dig --ready` selects the optional end-of-session Dig. With 14 skills, either command reads and parses every `doc.md` **14 times**, even when the result is empty. An empty second skill is sufficient to cause another complete read. This is independent of F293's phone filesystem cost and occurs in the real Mac CLI too. D322/D324/D325 explain the readiness checks' purpose; the finding is redundant work, not a disagreement with those features.

**Red commands** (repo root; scripts at `/Users/tylerpoelking/Developer/ore-wt/deep5/codex-out/perf/red.ts`):

```sh
ORE_NO_ENRICH=1 bun codex-out/perf/red.ts tries readiness-two
ORE_NO_ENRICH=1 bun codex-out/perf/red.ts dig readiness-two
```

Both exit **1**. Relevant output, omitting varying elapsed time:

```text
[DEEP] mode=tries sources=1 reads=2 subprocess=[]
FAIL: one readiness lookup rereads every source once per skill
[DEEP] mode=dig sources=1 reads=2 subprocess=[]
FAIL: one readiness lookup rereads every source once per skill
```

The complete JSON output is in [confirmation.jsonl](confirmation.jsonl).

**Minimised steps:** create one short source and two skills, leaving the second skill empty; run either readiness command. No annotations, reviews, Dig history, source duplication, renamed folders, UI, index rebuild or Git snapshot is required. The readiness fixtures contain no exercise files. [minimal-cases.ts](minimal-cases.ts) creates the fixtures through core. Removing the second skill (`readiness-one`) changes the result to one read and passes the same assertion.

**Expected:** one collection pass at most, shared among skills; a skill with no eligible Dig goal need not scan source text to decide it is ineligible. **Actual:** sources × skills full document reads/parses.

| Command | Document reads, 952 → 1,904 sources | Instrumented command median, 952 → 1,904 | Actual CLI median including startup |
|---|---:|---:|---:|
| `tries --now` | 13,328 → 26,656 | 386 → 804 ms | 394 → 777 ms |
| `dig --ready` | 13,328 → 26,656 | 385 → 814 ms | 394 → 830 ms |

The source-only growth is approximately linear while the skill count stays fixed; the unnecessary multiplier is the number of skills. I am not calling a 2.11× timing ratio proof of quadratic growth.

**Ranked hypotheses and probes:** (1) per-skill command composition repeats the scan; (2) index refresh repeats source parsing; (3) Git snapshots dominate. Adding an empty skill to the one-source fixture adds exactly one read. The trace enters `listItems` through each skill and never enters the index or spawns a process. Thus (1) is confirmed; (2)/(3) do not explain this symptom. Phone parsing instrumentation independently shows 26,656 → 53,312 frontmatter parses across its two development-mode Review startup calls, costing 642 → 1,333 ms.

**Cause:** `packages/core/src/tries.ts:62` calls `listTries` per skill; `listTries` calls `listItems` before filtering at lines 43–45. `packages/core/src/digs.ts:96` calls `digState` per skill; line 90 always calls `digIdeas`, whose line 61 lists every source. In particular, the `ready` calculation on line 89 does not prevent that work. App entry points include `apps/desktop/src/Review.tsx:1678` and the shared Dig readiness path. [Ranked probes](hypotheses.md), [large-size red runs](scale-confirm.jsonl).

### PERF-02 — One source's exercise operations read every exercise; filing does it three times

**S2 · Mac and iPhone · each minimal red command 3/3; exercise listing 3/3 at each scale; actual filing measured three times at each scale.**

Opening one source's exercise collection reads every exercise file before applying its source filter. Filing one source separately repeats that full read for the Undo record, the peak-preservation input and the update loop. This is **inside core/CLI**, before F294's two UI list refreshes. The unrelated exercise files do not change.

**Red commands:**

```sh
ORE_NO_ENRICH=1 bun codex-out/perf/red.ts cards two-two
ORE_NO_ENRICH=1 bun codex-out/perf/red.ts file two-two
```

Both exit **1**:

```text
[DEEP] mode=cards sources=2 cards=2 cardReads=2 unrelatedCardReads=1
FAIL: one source exercise list reads unrelated exercise files
[DEEP] mode=file sources=2 cards=2 cardReads=8 unrelatedCardReads=3
FAIL: one source exercise list reads unrelated exercise files
```

**Minimised steps:** two short sources, each with one exercise; no review history. List the first source's exercises, or file it under Learning. The filing harness resets its membership to AI before measurement so each measured operation is a real filing. Removing the unrelated source/exercise makes the listing control pass. Changing unrelated exercise content is unnecessary.

**Expected:** load the selected source's exercises; reuse that collection through a filing. **Actual:** `cards --item` reads all files once; filing calls `listCards` three times, plus targeted reads and any index work needed to preserve the skill's earned peak.

| Operation | 952 sources / 1,152 exercises | 1,904 sources / 2,304 exercises |
|---|---:|---:|
| One source's exercise list: exercise-file reads | 1,152 | 2,304 |
| List: command median (3 runs) | 37 ms | 67 ms |
| List: actual CLI median (3 runs) | 72 ms | 104 ms |
| Filing: exercise-file reads in the warm measured run | 3,462 | 6,918 |
| Filing: command time, median of two unstacked measurements | 185 ms | 320 ms |

**Ranked hypotheses and probes:** (1) filtering occurs after `listCards`; (2) review replay loads every exercise; (3) index maintenance or snapshots load them. The tiny no-review fixture still reproduces. Exercise-listing traces never enter the index and spawn no process. Filing stacks identify three distinct `listCards` callers, each opening the entire collection. (1) is confirmed. Preserving earned levels can additionally sync the index; it does not account for those three traversals, and D63's preservation must remain intact.

**Cause:** `packages/cli/src/cmd-study.ts:76–77` filters only after `listCards`. That function reads all paths at `packages/core/src/cards.ts:120`. The filing calls are `packages/core/src/skills.ts:467`, `:499` and `:504`, reached from `packages/cli/src/cmd-items.ts:593–594`. [Full read/write traces and stack samples](actions.jsonl).

### PERF-03 — Saving one source note probes every source folder twice

**S3 · Mac and iPhone · minimal case 3/3; 3/3 at both scale sizes.**

A complete, unambiguous source ID still takes the full directory-enumeration path. A nonempty note save does this twice. Archive and rating also inherit full-library source lookup. This has a small absolute cost on this local Mac, so it is an S3 performance finding under this run's “one action does work for every source” criterion, not a claim of broken note saving.

**Red command:**

```sh
ORE_NO_ENRICH=1 bun codex-out/perf/red.ts note lookup-two
```

Exits **1**:

```text
[DEEP] mode=note sources=2 documentChecks=4 unrelatedDocChecks=2
FAIL: one source operation probes every source document
```

**Minimised steps:** have two normally named sources; save a nonempty note on the first using its complete ID. The lookup fixtures contain no exercise files. No review history, folder rename, duplicate source, prefix match, search or UI refresh is needed. Removing the unrelated source (`lookup-one`) passes: there are no unrelated document checks.

**Expected:** a normal full-ID lookup should not recheck every unrelated `doc.md` on each autosave. **Actual:** `findItem` enumerates and checks every source folder before matching the ID, once for `setNotes` and again for the Feed-preview keep check.

| Note-save measurement | 952 sources | 1,904 sources |
|---|---:|---:|
| `doc.md` existence checks | 1,906 | 3,810 |
| Actual documents read | 2, both the target | 2, both the target |
| Command median, three red runs | 8.9 ms | 12.2 ms |

The seed has one additional empty `items/2026/untitled folder`, contributing two existence checks; it is not a source and is not necessary to reproduce. These are **metadata probes**, not reads of all source bodies.

**Ranked hypotheses and probes:** (1) full-ID lookup scans all directories; (2) ambiguity/renamed-folder fallback is responsible; (3) note backlinks, search or Git refresh performs the scan. Normally named distinct full IDs reproduce, ruling out (2). Command-only execution still reproduces without an index or subprocess, ruling out (3). Stack samples identify both callers for (1).

**Cause:** `packages/core/src/items.ts:243–254` checks the directory tree before ID filtering. `findItemDir` also uses that tree at `:275`. For a note save the two callers are `packages/core/src/notes.ts:98,146` and `packages/cli/src/cmd-items.ts:499`. Any future fast path still needs to preserve the existing folder-copy and folder-rename rules (F176/F561); this report does not propose dropping them.

## Requested profiles of known open rows — not new findings

### F293 — Phone pauses: directory enumeration grows quadratically, and readiness repeats parsing

**Existing S2 behaviour · iPhone page, not native hardware.** Two corrected full journeys at each size reproduced the pauses; a separate directory-level red loop reproduced 3/3. The provided phone server is a **development build**: its React development checks execute some mount effects twice. The table therefore separates single-command controls from full-page observations.

**Red command:**

```sh
bun codex-out/perf/phone-directory-red.ts 1
```

```text
[DEEP] unrelatedSources=1 unrelatedChecks=2 result=["note.md"]
FAIL: listing one directory inspects every unrelated source file and folder
```

This exits 1. The `0` control exits 0. The actual phone filesystem module runs entirely in memory: one target directory, one unrelated sibling. Listing only the target still visits the unrelated file and folder. At 952/1,904 unrelated siblings the counts are exactly 1,904/3,808. No browser, SQLite or source parsing is needed for that minimal symptom.

**Expected:** a directory lookup visits that directory's children. **Actual/cause:** `apps/desktop/src/phone/fs.ts:420–432` loops through **all** `files.keys()` and **all** `dirs` for every `readdirSync`. Core's index scan enumerates source annotation directories individually (`packages/core/src/db.ts:62–73`, `fsutil.ts` `logFiles`/`visible`). Their composition visits roughly sources × total stored paths.

| Single warm command / step | 952 sources | 1,904 sources |
|---|---:|---:|
| `stats --skill ai` total | 94 ms | 255 ms |
| Directory-listing calls inside stats | 1,913 | 3,818 |
| File/directory entries inspected by those listings | 7,428,179 | 29,616,226 |
| Time inside directory enumeration | 48 ms | 166 ms |
| Time inside SQLite calls | 23 ms | 40 ms |
| `due` total / directory enumeration | 41 / 21 ms | 132 / 84 ms |
| `tries --now` total | 381 ms | 888 ms |
| `dig --ready` total / frontmatter parsing | 397 / 311 ms | 881 / 670 ms |

**Ranked hypotheses:** (1) directory enumeration, (2) document parsing, (3) SQLite. The minimal directory probe proves (1), and its ~4× path-visit growth explains most of the warm stats scaling. Warm stats parses no frontmatter, excluding (2) there. SQL is measured separately and is smaller than enumeration. For Review startup, (2) instead dominates because of PERF-01: the two development-mode `tries --now` calls parse 26,656/53,312 headers, taking 642/1,333 ms. Thus a single explanation for every pause would be misleading.

Full-page measurements with function instrumentation: opening AI produced a **414/1,016 ms frame gap**, and Review startup a **1,111/2,542 ms frame gap**, at 952/1,904 sources. Command counts: opening a skill ran questions ×2, tries ×2, stats ×2 and notes ×2; starting Review ran tries ×2, session ×3, today ×1, due ×1 and card ×2. Do not treat these development-build counts or the absolute times as native release-phone benchmarks.

Run `node codex-out/perf/phone-profile.cjs large twice-large` to repeat the full profile. It connects to the supplied WebKit, uses one context/one page at a time, routes `/library.json` to private snapshots, and adds boundary counters to script responses without editing source files. [Latest selected profiles](final-profiles.json), [step-profile log](phone-profile-steps.log), [all profile samples](phone-profile.jsonl).

### F294 — One archive still rereads both complete Mac source lists

**Existing behaviour, not a new regression.** Confirmed at both sizes in the supplied Mac release page, with its CLI requests routed to the private scratch libraries. It reads `ls` and `ls --archived` after the archive reply, although the row already responds immediately.

```sh
node codex-out/perf/mac-profile.cjs large twice-large --red
```

Expected exit **1** when the known redundant refresh is observed. Recorded output at both sizes:

```text
[DEEP] F294 FAIL: archive reread both full source lists
```

At 952 sources the archive command took 63 ms and the list calls 81/118 ms; at 1,904, 66 ms and 119/190 ms. The two list calls overlap, so those durations must **not** be added as wall-clock delay. `apps/desktop/src/App.tsx:346` launches both list reads in `refresh`; the shared list action settles through that refresh. The core's read count is one `doc.md` per source per list. Filing's separate three-exercise-list problem is PERF-02 above. Opening a source also caused an `opened` call followed by these two list reads in this release page; that is recorded coverage, not another finding.

## Leads — no new confirmed finding

- **Mac All sources first render:** 127/220 ms frame gaps at 952/1,904 sources, with no CLI calls. This isolates it to rendering the existing list, but no function-level render profile or independent red loop was built; not reported as a new bug.
- **Rating history cost:** rating one exercise parses every review-log file, then parses again after appending when preparing remix eligibility. Measured below. Logs are canonical and scheduling correctness must be preserved; no separate minimal performance contract was established, so this remains an optimisation lead.
- **Live iCloud cost:** directory probes and repeated reads may cost more when files must download. No native cloud-download timing or stale-state case was run; no claim about that amplification.

## What passed and measured coverage

- **18/18 expected-red minimal runs reproduced; 15/15 paired controls passed.** `ORE_NO_ENRICH=1 bun codex-out/perf/confirm.ts` exits 0 only when those outcomes match. Full output: [confirmation.jsonl](confirmation.jsonl).
- **24/24 scale assertions reproduced** (four modes × two sizes × three runs): `ORE_NO_ENRICH=1 bun codex-out/perf/scale-confirm.ts`, [results](scale-confirm.jsonl).
- **132/132 actual read-only CLI invocations succeeded**: 22 commands × two sizes × three runs. [Raw CLI timings](cli-timing.jsonl); [instrumented command matrix](matrix.jsonl). Most observed CLI timings were approximately linear or less for doubling source/exercise/history size at fixed skill count; I found no general claim that every slow command is quadratic.
- **Skill rename stayed independent of source count in core:** zero source/exercise reads, same three small file reads at both sizes. No whole-library write was found in the rename itself.
- **No canonical write fan-out for note save, archive or rating:** their content writes remained one note, one source and one review-log append respectively. PERF-03 concerns lookup work, not extra content mutations.
- **Mac list scrolling made zero CLI calls** at either size; typing `learning` in source search made one search call. No page errors were observed in the completed Mac or phone journeys.
- **Warm-index reads did not reread every source body:** repeat `today`, `stats`, `due` and `search` matrix rows read zero `doc.md` bodies. They still inspect file metadata so external changes are seen. This was not mislabelled a full-body reread.
- **History did not run Git on every command:** the recent-snapshot control returned in ~0.02 ms and spawned nothing. A first snapshot took 1.34/2.69 seconds; a due snapshot after one note change took 89/168 ms at 952/1,904 sources. Each actual snapshot ran `git add -A` twice, `git diff --cached --quiet`, and `git commit`; no `git status`. This is the intentional D5/F643 path, not a new finding. [Snapshot boundary measurements](history-cost.json).
- **Copied review references remained valid:** final inventory has zero orphan review IDs at both sizes. Three deliberately measured ratings were added to each private library; the browser archive leaves one selected source archived. [Inventory](inventory.json).

### What a single action reads and writes

Times are command-body medians of the two runs without stack capture. Counts are from the last of those runs. The first run captures stack samples and is excluded from these timings. Each operation invokes one CLI command; `cmd.run` itself spawned **zero** subprocesses with AI disabled. Native SQLite I/O is outside the `node:fs` wrapper; index activity is visible through scans/SQL profiles, but these are not kernel-level I/O counts. Atomic temporary files and the lock are included in the fs-call totals. Canonical content writes are listed separately.

| Operation | Time, 952 → 1,904 | `readFileSync` calls / distinct paths, 952 → 1,904 | Source existence checks, 952 → 1,904 | Canonical writes |
|---|---:|---|---:|---|
| Rate one exercise | 31 → 48 ms | 103/53 → 199/101 | 953 → 1,905 | One review-log append |
| File one source (three exercises) | 185 → 320 ms | 3,526/1,205 → 7,030/2,405 | 3,812 → 7,620 | Three exercise files and one doc.md; first removal may also preserve an earned peak in skills.yaml |
| Archive one source | 18 → 24 ms | 3/2 → 3/2 | 1,906 → 3,810 | One doc.md |
| Rename a skill | 19 → 19 ms | 3/2 → 3/2 | 0 → 0 | One skills.yaml |
| Save one nonempty source note | 8 → 14 ms | 4/3 → 4/3 | 1,906 → 3,810 | One notes.md |

For rating, the review-log read counts are 96/192 at 48/96 log files. For filing, the exercise-file reads are 3,462/6,918. Total `writeFileSync`/`appendFileSync` calls including lock/temp files are respectively 2, 5, 2, 2 and 2 at both sizes. [Full trace](actions.jsonl), [runner](actions.ts).

### Mac page at scale

The existing page is at `http://localhost:1764/`, 1280×800, connected to supplied WebKit on 1760. Since its actual seed is only 238 sources, the profiling script answers its existing `/ore` requests by running the real CLI against our private 952/1,904-source copies. It starts no bridge/server and denies AI commands. This preserves the supplied UI and real command behaviour while keeping writes inside this folder.

| Action | Elapsed, 952 → 1,904 | Command calls |
|---|---:|---|
| Home startup | 594 → 774 ms | skills, today, ls, ls --archived |
| Open a source | 473 → 568 ms | show, notes, opened, backlinks, ls, ls --archived |
| Start Review → question | 1,613 → 2,110 ms | tries --now, session start, due --start, today, card show ×2; one run also overlaps the scheduled inbox import, another reads settings |
| All sources | 362 → 475 ms | None; 127 → 220 ms frame gap |
| Type source search | 606 → 626 ms | search ×1, 91 → 127 ms command time |
| Scroll six times | 528 → 614 ms | None |
| Archive one source | 697 → 784 ms | archive, ls, ls --archived |

These journey elapsed values include locator/input overhead and the script's settling delays (160 ms after actions, plus intentional search/scroll waits), **not pure latency benchmarks**. Individual command timings and frame gaps are the useful signals. WebKit reports no `longtask` support in `PerformanceObserver.supportedEntryTypes`; therefore there is no honest Long Tasks API attribution to report. The scripts record supported entry types, >100 ms animation-frame gaps, command boundaries, and phone filesystem/parser/SQLite function timings instead. The deliberate sequential command-control batch is not presented as a user-action frame stall. [Mac final log](mac-profile-final.log).

### Actual CLI timings

Three-run medians; real `bun packages/cli/src/ore.ts <arguments> --json`, serial processes, `ORE_NO_ENRICH=1`, `ORE_LIBRARY` pointing into this folder. Standard read timing excludes a due Git snapshot (copies initially had no `.git`); snapshots were measured separately above. This is elapsed time, including process startup and JSON output, rather than CPU time. AI/model discovery, live feed refresh, importing and optional native helpers were not executed.

| CLI command (all use `--json`) | 952 sources | 1,904 sources |
|---|---:|---:|
| `skills` | 38.1 ms | 38.1 ms |
| `ls` | 113.1 ms | 177.4 ms |
| `ls --archived` | 77.6 ms | 103.8 ms |
| `today` | 116.0 ms | 169.6 ms |
| `stats --skill ai` | 141.1 ms | 234.8 ms |
| `due --all --start` | 95.5 ms | 141.7 ms |
| `show <source> --annotations` | 40.6 ms | 44.1 ms |
| `cards --item <source>` | 71.8 ms | 103.5 ms |
| `card show <exercise> --review` | 56.6 ms | 69.8 ms |
| `notes <source>` | 38.9 ms | 43.3 ms |
| `backlinks <source>` | 50.4 ms | 65.7 ms |
| `questions --skill ai` | 99.9 ms | 155.1 ms |
| `tries --skill ai` | 74.5 ms | 105.0 ms |
| `tries --now` | 393.7 ms | 777.3 ms |
| `dig ai` | 75.1 ms | 105.1 ms |
| `dig --ready` | 394.2 ms | 830.1 ms |
| `search learning --sources` | 76.6 ms | 113.6 ms |
| `settings` | 39.4 ms | 38.2 ms |
| `goal` | 130.6 ms | 249.4 ms |
| `inbox` | 35.8 ms | 35.6 ms |
| `chat` | 36.0 ms | 34.7 ms |
| `feed` | 92.5 ms | 142.6 ms |

### Reproduction and artifact notes

Run from `/Users/tylerpoelking/Developer/ore-wt/deep5`. Existing fixtures are ready. To reconstruct them: `bun codex-out/perf/setup.ts --reset`, `ORE_NO_ENRICH=1 bun codex-out/perf/minimal-cases.ts`, then `bun codex-out/perf/snapshots.ts`. The reset affects only this run's named scale copies. `red.ts` rejects a library outside this folder through its probe; confirmation commands pin the clock to `2026-11-25T04:00:00.000Z`. Verdicts assert operation counts/paths, not elapsed-time thresholds. Generated fixture IDs do not affect the outcomes.

`probe.ts` installs `bun:test` module wrappers before loading the real CLI command table. Wrappers call the original fs functions, counting calls and optionally recording stacks; they do not stub their results. CLI timings are separately measured without those wrappers. Phone response instrumentation wraps actual functions; no replacement algorithm or performance fix was introduced. Complete ranked predictions and outcomes are in [hypotheses.md](hypotheses.md).

Early exploratory logs/profile samples remain for provenance. The final report uses the corrected scale copies, [cli-timing.jsonl](cli-timing.jsonl), [actions.jsonl](actions.jsonl), and the latest records selected into [final-profiles.json](final-profiles.json). An initial expansion reused a review-log suffix; that fixture-only mistake was corrected before the final CLI/action runs and final phone profiles. The reconstructed copies preserve the intended review-count doubling. Early selector failures in browser scripts were harness failures; completed journeys have no page errors.

The repository load check was attempted but could not run because this sandbox denies spawning `ps`. I used the already supplied browser/server and kept one context and at most two pages (one during profiling). All owned scripts terminate; no watcher/background loop was created. No commit/push or findings-ledger change was made because this run explicitly asks for findings only in this folder.
