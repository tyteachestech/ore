# Codex iPhone edge-case sweeps, 2026-11-13

Tyler asked for a bug pass on the iPhone app over edge cases, with Codex using the iOS Simulator itself and taking screenshots as it goes. Two sweeps run side by side on the Mac, each with its own simulator, `ORE_SIM_DIR` and scratch libraries (never `~/Ore`):

- `s4a-prompt.md`: data at its extremes (an empty library, a big one, long and odd text, the largest text size, dark mode, the smallest iPhone).
- `s4b-prompt.md`: interruptions (no network, imports cut off, leaving and quitting mid-task, rotation, the keyboard, fast double taps, bad links into the app).

Codex writes its report and shots under `codex-out/s4a/` and `codex-out/s4b/` in its worktree on the Mac. Claude verifies each finding, logs it in `docs/reviews/findings.md`, and fixes the real ones test-first.
