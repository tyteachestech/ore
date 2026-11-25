# Draft the fixes for edges-report.md (EDGES-01 to EDGES-11)

Read `fix-common.md` in this folder first, then `edges-report.md`. Claude's first read of the durable fix for each, to confirm or beat:
- 01: a reimport swap and its Undo never leave a moment with no `doc.md` (write beside, then rename over); Undo and `doctor` find the stash when the item is missing.
- 02 and 11: one lock design: a lock held by a live PID is never taken over by age; a lock's file is created already holding its PID (write a temp file, then `link` it into place, which fails if one exists), so an empty lock can't exist. Check how the iPhone and a second Mac share the lock over iCloud before trusting a PID from another host.
- 03: skill ids are checked once where `skills.yaml` is read (a slug, never `/`, `\`, `..` or empty), and every path built from an id goes through one helper that refuses to leave its folder.
- 04: filing works from what is on disk for the exercises too, so a retry finishes an interrupted move; or the exercises are written before the source.
- 05: history snapshots take the library lock (or skip the snapshot while it is held), so they never see half a write.
- 06: drafts are checked against the highlights live at save time, under the lock.
- 07 (D63): a level never drops when exercises move skills. If this needs the earned peak stored rather than recomputed, say how in FIX-NOTES.md and build the smallest version.
- 08: opening a damaged `.index` rebuilds it, as `rebuildIndex` already can.
- 09: an EPUB spine entry that can't be resolved refuses the import with the next step (D96), unless the chapter can be found another way.
- 10: both refusals say what was wrong with the file and what to do next (D96), like the other refusals in `packages/core/src/ingest/`.
