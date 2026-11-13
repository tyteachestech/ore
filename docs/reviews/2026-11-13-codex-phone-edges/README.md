# Codex iPhone edge-case sweeps, 2026-11-13

Tyler asked for a bug pass on the iPhone app over edge cases, with Codex using the iOS Simulator itself and taking screenshots as it goes. Two sweeps run side by side on the Mac, each with its own simulator, `ORE_SIM_DIR` and scratch libraries (never `~/Ore`):

- `s4a-prompt.md`: data at its extremes (an empty library, a big one, long and odd text, the largest text size, dark mode, the smallest iPhone).
- `s4b-prompt.md`: interruptions (no network, imports cut off, leaving and quitting mid-task, rotation, the keyboard, fast double taps, bad links into the app).

Codex writes its report and shots under `codex-out/s4a/` and `codex-out/s4b/` in its worktree on the Mac. Claude verifies each finding, logs it in `docs/reviews/findings.md`, and fixes the real ones test-first.

## Results

Reports: `s4a-report.md`, `s4b-report.md`, with the screenshots they cite in `shots/`.

| Sweep | Found | Rows | Fixed in |
|---|---|---|---|
| s4a data at its extremes | 8 | first source missing until relaunch, Move to To read, text size (Tyler's call), Today rename under the keyboard (also s4b), pill over Finish (not a bug), chapter jump under the Back bar, empty Today, status-bar tap (open) | #350 |
| s4b interruptions | 5 | highlight note lost on quit, an episode the phone can't hear, F32 again (paste advice), Remove with no answer | #350 |

What it says about our checks: every phone journey runs on the same seeded library, so nothing ever met an empty one, and the phone's file layer only broke where no folder existed yet. A phone journey now empties the library (archives everything) to check Today, and the fs test makes a folder with no parents. The F32 fix matched one wording of the Mac's advice; the cut now drops any sentence's "copy … paste" or Browser-tab clause. Leaving the app mid-task was checked only for home and back, never for iOS ending the app, which is when a draft kept in memory is lost.
