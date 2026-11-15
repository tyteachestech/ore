# Upgrade tester report — 2026-11-15

## 1. Coverage

Tested the library written by `aa6bc6f` against checkout `637e036418f4dfdc7ec1758489be5d715e95fae3`, using the supplied release Mac page/bridge and touch-enabled WebKit phone page. Copied the entire Mac library to `before/` before opening it. Covered Home, All sources including Done, all ten Mac skill pages, all five old sources, Settings, empty Feed, command search, reading/Collected/notes, filing, skill rename and a refused rename, Review and Undo, and a newly added source beside the old sources. On iPhone covered Today, Sources, reading and Collected, note editing/reopening, a Done source, and all four due exercises. The seed contains five Markdown sources, seven exercises, four annotations, three prequestions, one note, five historical reviews and one completed session; it has no media/PDF/EPUB examples, populated old topics, chat history or populated old SQLite index. Those upgrade paths, native app lifecycle/sync, pure visual polish and the explicitly excluded known issues were not tested. A direct CLI read unexpectedly triggered background enrichment; see the limitation below.

## 2. Findings

**No confirmed new S1, S2 or S3 findings.** No old file was deleted. All five original source bodies, all seven original exercise bodies and the kept original files are unchanged. The original review, session and annotation logs retain their original records. No silent priority, review-history or FSRS-state reset was observed.

This is a result for this small old-format seed, not proof of compatibility with every historical Ore library.

### Important run limitation: direct CLI catch-up

The initial CLI read batch included `today`, which starts daily background catch-up unless `ORE_NO_ENRICH=1` is set. The browser bridge sets that flag; the initial direct invocation did not. Catch-up enriched five sources, adding five topics and two exercises, and replacing three unattempted prequestions with new wording. The old seed provided those prequestions without an `enriched_at` stamp. These are enrichment writes, not a demonstrated format migration failure. They prevent calling the later Mac journey a completely AI-disabled, untouched-old-data test. Subsequent direct CLI reads disabled catch-up. The independently seeded phone journey did not have this contamination.

The Mac note also contains test-created duplicate/reformatted passages from scripted selection attempts; these are not reported as upgrade corruption. The phone append preserved the original Markdown note exactly, followed by the added paragraph. Full attribution is in [format-review.md](format-review.md), with the complete [library diff](library-diff.patch).

## 3. Known rows seen returning

None confirmed. The emoji skill icons falling back to dots are intentional under D157, and their stored values remain intact. Doctor's warning about `items/2026/untitled folder` names deliberate seed junk; it is not lost imported content or a returning F283.

## 4. What passed

- Mac Home and all ten skill pages loaded, including empty skills and the long skill name; old priorities, hooks and collections survived.
- Mac To read showed the three unfinished old sources; Done showed both finished sources with their old finish dates retained ([02-sources.png](02-sources.png), [47-mac-done.png](47-mac-done.png)).
- All five old Markdown sources opened; their full bodies and originals remained byte-identical after the journey.
- The old plain highlight, Key point and question appeared in the reader/Collected; adding a highlight appended a new record and kept the old records ([09-old-source.png](09-old-source.png), [10-old-collected.png](10-old-collected.png), [12-new-highlight.png](12-new-highlight.png)).
- The old note opened and saved through navigation; iPhone's added paragraph preserved the original heading, text and list exactly ([34-phone-note.png](34-phone-note.png), [35-phone-note-reopened.png](35-phone-note-reopened.png)).
- Mac Review completed four unique due exercises with twelve total ratings and eight Undo operations; every new rating started from the exact old saved FSRS state, and the final session counted four reviews ([preservation-checks.json](preservation-checks.json)).
- Explain's missing AI grade showed a recoverable message and let the learner mark both key points and rate; it did not block Review ([19-explain-no-ai.png](19-explain-no-ai.png)).
- Renaming Learning to Learning practice changed only its name in `skills.yaml`; priority P1, hook, icon, color, collection and stable id remained.
- A refused skill rename kept the typed name and dialog open, showed the reason, and left the saved name intact; checked twice ([45-old-skill-failed-save.png](45-old-skill-failed-save.png)).
- Filing the old Testing Effect source under Creativity, undoing and filing again preserved the three original exercises' distinct skill assignments while adding Creativity.
- A current source added through the app opened and appeared beside old sources in All sources, the renamed skill and command-search results ([27-current-source.png](27-current-source.png), [28-mixed-sources.png](28-mixed-sources.png), [30-mixed-search.png](30-mixed-search.png)).
- Settings read the old library's default review settings and Claude vendor; the empty Feed and command palette loaded without errors.
- iPhone Today, Sources, a Done source and Collected recognized the old records ([31-phone-today.png](31-phone-today.png), [33-phone-collected.png](33-phone-collected.png), [36-phone-sources.png](36-phone-sources.png), [37-phone-done-source.png](37-phone-done-source.png)).
- iPhone completed four unique exercises with five ratings and one touch Undo; every rating resumed the exact original FSRS state. New records used the phone log without overwriting the Mac log ([phone-preservation-checks.json](phone-preservation-checks.json), [phone-writes.json](phone-writes.json)).
- The phone Explain exercise offered self-marking, completed the session, and updated Today ([42-phone-explain.png](42-phone-explain.png), [43-phone-end.png](43-phone-end.png), [44-phone-today-after.png](44-phone-today-after.png)).
- All 25 final JSON CLI reads succeeded: `ls`, `skills`, `due`, `cards`, `search`, `doctor`, `today`, `questions`, both show forms for each original source, and `card show` for each original exercise ([cli-after.json](cli-after.json)). Doctor reported zero errors and only the seeded unfinished-folder warning.
- No browser page errors were observed in the instrumented Mac and phone journeys ([browser-errors.json](browser-errors.json)). All tester browser contexts/pages and the driver process were closed; supplied servers were left alone.

## Evidence and boundaries

- [before/](before/) — original snapshot; [before-sha256.json](before-sha256.json) — snapshot file hashes.
- [file-audit.json](file-audit.json) — changed/added files and an empty removed-file list; [library-diff.patch](library-diff.patch) — every changed text file, excluding disposable index and library Git internals.
- [format-review.md](format-review.md) — schema/decision comparison and attribution of enrichment writes.
- The seed has only four due exercises. The twelve Mac ratings include eight undone repeats, not twelve unique exercises.
- No app/repository source files were edited, no repository test suites, builds or servers were started, and no commit was made. All tester artifacts are in `codex-out/upgrade/`; scratch-library writes went through app actions, apart from the documented CLI-triggered catch-up.
