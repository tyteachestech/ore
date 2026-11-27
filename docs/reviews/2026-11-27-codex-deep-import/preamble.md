# Ore deep import pass, 2026-11-27: shared setup (read this first)

You are a bug hunter for Ore, a Mac-first personal learning app (capture a source → read → highlight → AI-drafted exercises → FSRS review). The repo is your working directory, checked out at master. Read `CLAUDE.md` (above all "Core promise", D122, and the Intake rule, D96), `docs/SPEC.md` §6, `docs/reviews/findings.md` (every known bug: do NOT re-report a row unless you saw it come back, then name the row), `packages/core/test/intake-grid.test.ts` (every type × hazard, and its `gap:` cells) and `docs/reviews/codex-coverage.md` (the Import table).

**Ore's core promise is that whatever someone learns from comes in whole**: its own title, author and date; its headings as the outline; its images, tables, math and code intact; timestamps for anything that plays; the original kept. A source saved half-read without a word is the worst finding you can bring; one refused with no next step is next (D96).

Earlier passes read the import code with small hand-made inputs (deep scans 1, 2 and 5: `docs/reviews/2026-11-24-codex-deep-scan*/`, `2026-11-25-codex-deep-scan-5/office-report.md`), and learners brought one real file of each kind (`2026-11-26-simulated-learner-days/`). **This pass goes deep with real files**: many per type, each read against its original from start to end. Fetch real, openly licensed or public files from the web (you have the network) or read the folders named in your run. Never commit or copy a copyrighted file into the repo; your folder is outside git's reach only if you keep it in `codex-out/`.

**How to check one source.** `ORE_LIBRARY=codex-out/<your name>/libs/<n> ORE_NO_ENRICH=1 bun packages/cli/src/ore.ts add <path or link> --json` (after `ore init` there), then read its `doc.md` beside the original: count chapters/sections, headings, figures, tables, formulas, code blocks and footnotes in each; diff the plain text (a script that strips both to words and reports runs missing, doubled or out of order, and where); check the frontmatter's title, author, date and language; open the kept original. Write each comparison as a script in your folder so it reruns in seconds. A number that differs is a lead until you have found the words it lost.

Another thread is fixing, right now, **doubled formulas on OpenStax pages, blank Original view for scanned PDFs, and podcast episode web pages that drop the recording**, and a third is **upgrading older libraries**: stay off those three.

**Findings only.** Do not change any file in the repo. Write only inside `codex-out/<your name>/` (scripts, downloads under `files/`, scratch libraries under `libs/`, the report). Never touch `~/Ore`, `/Applications/Ore.app`, `~/Developer/ore` or another scout's folder. You may read (never write) the folders your run names.

**Mac load.** You run beside other testers on Tyler's Mac. One `ore add` or Bun process at a time, never the app, a browser, a server, `bun run e2e`, `bun run bench` or the whole `bun test`. Never let real AI run (`ORE_NO_ENRICH=1` always). Never download the page reader's model (3.4 GB) or run Settings › AI's Download. Keep downloads under 2 GB in all and delete them at the end. Never leave a process running.

## How to hunt: the diagnosing-bugs loop
Follow `docs/reviews/2026-11-25-codex-deep-scan-5/diagnosing-bugs.md`, phases 1 to 4, and stop before phase 5: you report, someone else fixes.
1. **A red loop first**: a script in your folder that goes red on the exact symptom, deterministic, seconds to run (a saved copy of the file or page, never a live fetch inside the loop).
2. **Reproduce and minimise** until every step left is load-bearing: the smallest part of the file that still loses the words.
3. **Hypothesise**: 3 to 5 ranked, falsifiable causes.
4. **Measure**: probes that split them, from your own script (re-import a function from `packages/core/src/ingest/`, log with a `[DEEP]` prefix).
A suspicion with no red loop is a Lead.

## What counts
Words, headings, images, tables, math, code, footnotes or timestamps lost, doubled, garbled or out of order; a wrong title, author, date or language; the original not kept; a source saved that isn't the content (D96); a refusal with no next step; a crash or hang; an `intake-grid.test.ts` cell marked covered that real files show isn't. Skip looks and taste.

## Report
Write `codex-out/<your name>/report.md`:
1. One paragraph: what you imported (a table: file, type, size, verdict) and what you skipped.
2. Findings, most severe first. Each: an ID (`<NAME>-01`…), a short title; severity (**S1** words lost or garbled with no word, a crash; **S2** wrong in everyday use; **S3** an edge that still costs a learner something); **the red command** with its output; the file (its public URL and licence, so a fixture can be made from it or rewritten); the minimised part; expected vs actual; ranked hypotheses and what the probes showed; file and line of the cause.
3. Leads, one line each with why.
4. What passed, one line each, so the next run doesn't redo it.
Budget: about 90 minutes. Stop when it runs out and write the report.

---
