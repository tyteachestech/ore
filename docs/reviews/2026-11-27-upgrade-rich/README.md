# Upgrade from an older library, rich (2026-11-27)

Queue item 6 of [codex-coverage.md](../codex-coverage.md). Sweep 9 (11-15) opened a small 11-06 seed with no media, PDF or chats and found nothing. This pass redid it on rich libraries, as a script in the cloud rather than Codex on the Mac, so it can be run again.

## What ran
For each of four Ore versions, `aa6bc6f` (11-06, the oldest in git), `29b12bc` (11-10), `eb29b08` (11-17) and `210792d` (11-24), a worktree at that commit wrote a library with its own code:
- `rich.ts`: that version's own `seed.ts` (skills, collections, articles, highlights of every intent, a note, cards with months of reviews, a session, Finder junk), then its CLI adds 15 files (PDF paper, textbook, tables, EPUB books, Word, PowerPoint, notebook, RTF, Excel, CSV, Markdown, a saved web page), a highlight on each, statuses, a pinned and an archived source, a note with links, a checklist, a callout, a table and math, a diagram in a note and a skill note, a skill hook and goal, a daily goal, tutor cards rated through a session, a retired card, a saved chat with a file, an answered question, a try, a snippet. Steps an old CLI lacks are logged and skipped (11-06 has no tutor cards, chats or tries).
- `reads.ts` + `compare.ts`: every read the app makes (116: lists, skills, cards, stats, today, due, search, doctor, and show, highlights, note and backlinks of every source, every card), by the old CLI and by master's, compared value by value.
- `writes.ts`: master reimports every source, rates the due cards, adds a highlight, edits a note, reindexes and runs doctor.
- `crawl.ts`: master's Mac build (vite and the mock bridge) on each library: Home, every skill, every source with its Collected and note, a whole review to the end screen; page errors, console errors, failed `ore` calls.
- `phone.ts`: master's iPhone build at 390 pt with touch on the 11-06 and 11-24 libraries: Today, sources, skills. (Chromium: this container has no WebKit.)

## Found
- **F-new-old-page-picture** (fixed here): a saved web page added by Ore of 11-06 linked its picture to the file on disk, so today's reader shows it broken, and reimport made it unrecoverable. Reimport now saves that picture beside the source. Only pages added before #9 (11-06) are affected; reimport heals them.

## What held
- Master read all four libraries with nothing lost: every source, highlight, note, card, review state, skill, chat, question and try the old CLI showed, master shows the same. The only differences are new fields, paths, the review previews (computed from now), and stats' retention count, which replays the merged history since F602 on purpose.
- Reads wrote nothing to any library (`diff -r`, index aside).
- Reimport kept every highlight of every PDF, EPUB, Word, PowerPoint, notebook, sheet and saved page; an 11-06 EPUB gains the front matter fold (#539) on reimport.
- Mac and iPhone builds loaded every screen with no page error; the reviews ran to the end screen. The one failed file load was the picture above.
- Doctor reported only the seed's deliberate unfinished add folder.

## Not covered
- Libraries from before 11-06 (Ore's history in git starts there). Tyler's own ~/Ore may hold sources from then: a copy of it, opened by master on the Mac, is the remaining check.
- Recordings, videos, scans and screenshots (they need the Mac's transcriber and OCR), feeds and courses (network).
- Old imports keep their old text until reimported: an 11-06 PDF table stays flat, an EPUB keeps its front matter. That is by design (D93); a pass that reimports a whole old library is a separate question.

Run again: paths in the scripts point at a cloud checkout (`/home/user/ore`); set them to yours.
