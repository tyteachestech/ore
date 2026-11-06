# Edge-case pass (2026-10-29)

> Master at `f83296b`. Builds on the [2026-10-27 stress test](2026-10-27-stress-test.md) and the bug sweeps; what those covered (index races, concurrent writes, note merges, the phone build) is not repeated. Courses and page+video sources were left to their own thread.

**Verdict.** The common paths hold. The weak spot was trust in files: one bad line or one hand-edited file anywhere took down every screen. Each fix below is at the reader or writer that every caller shares, not at a screen.

## What was run

| Area | Cases |
| --- | --- |
| Add | empty, whitespace, emoji-only and right-to-left text; a folder; a file with no extension; random bytes; a cut-off and a damaged PDF; a password-locked PDF; UTF-16, Windows-1252, BOM and CRLF text; the same file twice; `http://`, `ftp://`, `javascript:` |
| Library files | a broken frontmatter in one source and one card; a typo in `skills.yaml`; `null`, arrays, field-less objects and cut-off lines in review, session and highlight logs; a library path with spaces, accents and emoji |
| Skills | names that slug alike (`C++`/`C#`, `🧠`/`日本語`), `../../etc`, duplicates, bad colours and icons |
| CLI | bad ratings, confidences, offsets, ids, prefixes, empty notes and headings, unknown skills; 8 different writes to one source at once, 3 rounds |
| App (mock) | an empty library; a 4.6 MB source (opens in ~1.7 s, find over 20k matches stays responsive); a title with no spaces; 44 skills with long names and collections; review with a card whose source folder is gone; note links to a deleted skill and source; four time zones |

## Fixed

1. **One unreadable source or card file emptied every list.** Lists now leave it out; `ore doctor` names it.
2. **A typo in `skills.yaml` failed every screen with "YAML Parse error".** It now names the file and line, and doctor reports it instead of crashing.
3. **One stray line in a review or session log (`null`, an array, an object with no card or time) failed Home, Review, stats and doctor; one in a highlight log failed opening that source.** Such lines are skipped; doctor names them.
4. **Skill names that slug alike couldn't both exist:** `C#` after `C++`, or any second name with no Latin letters, said "already exists". Ids are now numbered when taken.
5. **Text files in other encodings imported as "Caf�"**; UTF-16 (Notepad) was unreadable. The byte-order mark is honoured, and non-UTF-8 falls back to Windows-1252. CRLF bodies are stored with LF, so doctor no longer flags them as changed.
6. **A file with no extension** ("README") is read when it is text. **A folder, a file over 200 MB, a damaged PDF, a locked PDF, a cut-off link and a non-web link** each say what to do; pdf.js no longer prints warnings to the terminal.
7. **The same file added twice made two sources.** It is now the source already here, as a repeated link already was.
8. **Titles could hold line breaks** (PDF metadata, a pasted rename); they are one line. **A long title with no spaces ran under the side panel**; text now wraps at the page level.
9. **A note link to a deleted skill or a source folder removed in Finder** opened a raw "ore: no item matches" page; it now says the target is gone. Its hover preview threw an unhandled error when the pointer left early; it no longer does.
10. **An AI research result with a malformed link** could crash the hover card; such links are refused when the AI answers.

## Not fixed, low priority

- Negative numbers after an option (`--at -5`) read as an option (known since 10-27; `--at=-5` works, the app never sends them).
- An `mc:` icon name that isn't in MingCute (hand edit or CLI) draws an empty tile instead of falling back to a dot.
- Deleting a skill keeps its note file; adding a skill with the same name later brings the note back. Nothing is lost, which is arguably right.
