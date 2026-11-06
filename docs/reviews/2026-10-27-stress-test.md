# Stress test and foundation check (2026-10-27)

> Master at `6a852fb` (Mac app plus the iPhone phase 0 build, PR #85). Builds on the [2026-10-24 foundation check](2026-10-24-foundation-check.md) and the bug sweep after it; what those fixed is not repeated here.

**Verdict.** The Mac foundation holds up under stress: files stay canonical, the review log replays the same states, notes merge instead of overwriting, and the library snapshots itself to git. One real race in the index is fixed. The open risk has moved to the phone: today it is a demo that forgets what you do on it at every reinstall, and the file layout is not yet safe for two devices writing to one library. Both are cheap to settle now and expensive after sync ships.

## What was run

| Check | Result |
| --- | --- |
| `bun test`, `bun run typecheck`, Mac `vite build`, iPhone `vite build` | All green (152 tests before, 154 after) |
| CLI edge cases: bad ratings, confidence, colours, statuses, empty titles, unknown skills, text not in the source | All refused with a clear message, except one (fixed, below) |
| Note merge: an agent appends while the note is open, then a second conflicting save | Agent's line kept; a true conflict keeps both lines, nothing lost |
| 7 reviews, 3 `due` and 3 `today` at once, 20 rounds, some with no index yet | 3 failures in 8 rounds before the fix, 0 in 12 after |
| Index schema bump with 6 commands launching at once | Rebuilt in place, search works after |
| Big demo library (240 sources, 1,085 reviews) | `today` 170 ms, `due` 120 ms; Home and Review render with no console errors |
| iPhone build in Chromium at 390 pt with touch | Home, a full 4-card review, a card edit, relaunch: all work; edits survive a relaunch |
| `ore doctor` after all of the above | 0 errors, 0 warnings |

## Bugs fixed (this PR)

1. **Index race on first launch or after an update.** When several `ore` commands opened a missing or outdated index at the same moment (what the app does at launch), one could delete the file while another was building it: "disk I/O error", "attempt to write a readonly database" or "database is locked" as an error toast. The index is now rebuilt in place under a write lock. Test: 8 processes opening a fresh index at once.
2. **Selecting an existing highlight made a second one on top of it** (flagged in the 10-24 sweep). The core now gives back the existing highlight for the exact same passage, and the reader opens its popup with its note instead of a blank one. Test added.
3. **iPhone: every save left a dead entry in storage forever.** Each atomic write's temp file was deleted with a permanent tombstone in IndexedDB. Tombstones are now kept only for files that came with the snapshot.
4. **iPhone: AI steps failed with a file path as the error** ("ENOENT: http://…/grade.md"). They now say "AI runs on your Mac for now." Storing a recall or your own key-point marks still works.
5. **Schema errors showed as `ore: [`** (for example a bad reminder time). Errors now name the field and the problem, on the Mac and the phone.
6. **Raycast "Review Due" still said review happens in `/ore` in Claude Code.** It now points to ⌘R and the quick quiz, with an "Open Ore" action.

## Foundation check

### Data model and library integrity: solid on the Mac

Plain files, append-only logs, FSRS state replayed from the log, atomic writes, the lock, merge-on-save for notes and automatic git snapshots all behaved under the stress above. ULIDs make ids safe to create on two devices. Nothing to change for a single Mac.

### iPhone data: a demo, not a place to learn yet (judgment call 1)

The phone runs the same core in-process over an in-memory copy of the library shipped inside the app, with its writes kept in IndexedDB. Two consequences Tyler should know:

- **Every reinstall throws away what you did on the phone**, reviews included, because a new snapshot resets phone data (deliberate, so the Mac stays the truth). With a free Apple account the app must be reinstalled every 7 days.
- **Nothing reaches the Mac.** A review done on the phone never counts toward the Mac's schedule or goal.

Smaller: library search fails on the phone (its SQLite build has no ranking function; no phone screen uses search yet); the library lock does nothing there (one command at a time, so harmless); a save is written to storage a moment after it happens, so a write in the last instant before iOS kills the app can be lost.

**Recommendation:** make the next phone step (phase 1) start with real files in the app's own folder, kept across installs, before adding screens. Until then, treat phone reviews as practice.

### Sync: make the files two-device safe before iCloud (judgment call 2)

The plan (iCloud Drive, per-device logs) is right, but the code still assumes one writer. Under iCloud each of these becomes a "conflicted copy" that the app silently ignores or a lost write:

| File | Today | Two-device safe |
| --- | --- | --- |
| `reviews/2026-10.jsonl`, `sessions/…` | One file per month, both devices append | One file per month **per device** (`2026-10.mac.jsonl`); `reviewLogFiles` reads them all. A conflicted copy such as `2026-10 2.jsonl` is skipped today, so its reviews vanish |
| Undo a rating | Rewrites the month's log | Append an "undone" record instead; logs stay append-only |
| `annotations.jsonl` per source | Both devices append | Per-device file beside it, merged by `latestRevs` (already rev-based) |
| Card `state: draft → live` | Written into the card file at the first review | Derived from the log (a card with a review is live), so the card file only changes when its text does |
| `notes.md`, `skills.yaml` | Whole-file writes | Fine with merge-on-save (notes) and rare edits (settings); keep |

**Recommendation:** do this layout change now, while only the Mac writes, as one small migration with replay tests. It is a day of work today and a data-recovery project after sync.

### AI path: right for the Mac, unsolved for the phone

Vendor-swappable, schema-checked, recorded with vendor, model and prompt version, run outside the lock; failures now say why at once (PR #84). On the phone there is no AI by design (D7, "the Mac does AI"), which only works once sync exists. Nothing to change until phase 2; the phone now says so plainly.

### Decisions drift (judgment call 3)

`DECISIONS.md` still says "Phone later only if free" (D3), "no accounts, no sync" (D4), "iCloud only after a phone client exists" (D5) and "the app runs the installed CLI" (D30), while master ships a phone build that runs the core in-process. Every new thread reads these first. **Recommendation:** record one D78 for the phone as built (phase 0, Tauri on both, the core in-process on iOS, portrait and dark only, the Mac does the AI, sync next) and mark D3, D4, D5 and D30 as amended by it.

### Purpose rule

Home on both screens passes: the ring and "of 10 min" set today's slice, the skill chips with counts pick what to review, the skill tiles show strength and the next step. No decoration found. Not re-audited screen by screen; the 10-25 pass covered the rest.

## Not fixed, low priority

- `ore goal --minutes -5` is read as an option by the argument parser (`--minutes=-5` works); CLI only, the app uses a slider.
- Raycast's TypeScript check needs Raycast's generated `raycast-env.d.ts` (made by `ray build`), so `tsc` alone reports missing `Preferences` and `Arguments`; not a code bug.

## Follow-up (same day)

Tyler said yes to all three calls. Built in the next PR: D78 in `DECISIONS.md` (D3, D4, D5 and D30 marked amended); per-device review, session and highlight logs read together with conflicted copies counted once; undo appended; a draft's finishing review read from the log instead of written into the card; the phone keeps its data across new builds, taking the Mac's version only of files the Mac changed since the last build. Phone reviews still reach the Mac only once sync exists.

