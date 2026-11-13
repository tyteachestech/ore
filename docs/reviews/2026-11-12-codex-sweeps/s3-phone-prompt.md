# Sweep 3 (iPhone): confirm sweep 2, then the review on the bus it couldn't run

Same rules, driver and report shape as `s1-phone-prompt.md` (read it, and `codex-out/s2-phone/report.md`), writing only under `codex-out/s3-phone/`. Use your own simulator and `ORE_SIM_DIR`. Read `docs/reviews/findings.md` first: rows F29–F48 are fixed.

**A library of its own:** sweep 2's phone library had nothing due, because the desktop sweep had already reviewed the shared one. Seed a fresh scratch library just for this sweep (`bun apps/desktop/scripts/mock/seed.ts <new dir>`) and give the simulator a copy of it. Check that Today shows Start review before you begin. If it doesn't, stop and report that as finding 1.

## 1. Confirm, twice each
- F46: holding a source in a skill's list (To read and Done) opens only its own menu.
- F47: Return in a Sources row's Rename field saves, and stays on the list.
- F48: Today's hold menu has Rename…, which renames in place, and Return opens nothing.
- F49 (seen once): open search with the keyboard up. Does the field ever sit under the keyboard's bar? Try 5 times, and say how many.

## 2. New tasks, twice each
1. **Review on the bus** (D65): Start review, answer Facts and one Explain with the keyboard, leave to the home screen mid-answer and come back, rate, use ⋯ › Later on one, finish, and check Today.
2. **Read a little, then review it**: open a source, highlight a sentence (double tap), make it a Key point, then Review this source from its menu.

Report as before; finish by printing the ranked findings one line each, or "clean".
