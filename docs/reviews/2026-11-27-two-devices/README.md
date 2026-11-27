# Mac and iPhone writing at once (2026-11-27)

Queue item 4 of [codex-coverage.md](../codex-coverage.md): both apps open on one library, each writing. Run by Claude in the cloud, not Codex: the angle needed a harness first, and with it the scenarios ran in minutes with no load on Tyler's Mac.

## The harness
`apps/desktop/scripts/mock/phone-shell.ts` stands in for the iPhone shell's library commands (`library_scan`, `library_read`, `library_apply`, `library_write`, `library_bytes`, `library_dir` in `apps/phone/src-tauri/src/lib.rs`) on a real folder. The phone build in a browser then takes the iPhone's own path: it mounts that folder as it mounts Ore's iCloud Drive folder (`mountDisk` in `src/phone/fs.ts`), sends each write back, and rescans. A Mac page whose bridge has the same folder is the other device. In the journeys: `phoneOnMacLibrary()` (e2e/harness.ts) opens that phone beside the journey's Mac page, on the file's library; `e2e/journeys/two-devices.ts` holds them.

Not stood in for: iCloud's own transport (its delay, `.icloud` placeholders, conflict versions). That needs his two real devices.

## What ran
| Scenario | Result |
|---|---|
| Each rates a different exercise at once | Both reviews kept (per-device logs, D78.4); both devices show the same due list after a scan |
| Both rate the same exercise at once | Both reviews kept; replay as deep scan 1 found it (F-rows from #522) |
| A highlight on each in one source | Both kept (annotation logs are per device) |
| The Mac writes a note line, then the phone, open on that note and not yet rescanned, types in it | **Lost the Mac's line** (F765) |
| The Mac renames a source, then the phone opens it (status) | **Title put back** (same row) |
| The Mac archives a source, then the phone pins it | **Archive undone** (same row) |
| The Mac adds a skill, then the phone sets the daily goal | **Skill gone** (same row: skills.yaml written whole) |
| The phone adds a skill, then the Mac moves one in its sidebar (drawn before) | **Move refused**: "layout leaves out "juggling"" (F766) |
| The phone archives a source open in the Mac's Reader, and the reverse | Both keep showing it, as an archived source opened from Archived does; nothing lost |
| Conflict copies | Not rerun: deep scans 4 and 5 covered them below the screens, and only real iCloud makes them |

The phone wrote whole files from memory that could be up to 30 s older than the folder: it read the Mac's changes only when it came back and every 30 s while on screen, and D222's "a file it hasn't sent yet keeps its version" covered what the phone had changed, not what it was about to. Every command on the phone now reads the folder's changes first (at most one scan a second), so a write lands on the Mac's latest. What iCloud hasn't brought down yet still keeps iCloud's latest, as D222 says.
