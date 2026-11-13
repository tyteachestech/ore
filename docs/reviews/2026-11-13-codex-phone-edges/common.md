# Shared rules for the s4 iPhone edge-case sweeps

Read `docs/reviews/2026-11-12-codex-phone/prompt.md` first: it is how you touch the phone (the `sim.ts` driver, screenshots after every action, `tree` for frames) and the report shape. Its "Not built yet" list is out of date: the phone now adds sources (+ and the share sheet, D227), reads, highlights, takes notes, reviews and has skills and Settings (D225, D228, D230, D235). Only AI features and sync are still Mac-only.

## Rules
- Read-only on the repo. Write only under your own `codex-out/<sweep>/` (report.md, shots/, and scratch libraries in libs/).
- Your own simulator and driver folder: `ORE_SIM_DEVICE` and `ORE_SIM_DIR` are set for you. Never touch another simulator or another thread's `/tmp/ore-sim*` folder, and never kill sim processes you didn't start.
- Scratch libraries only, made under `codex-out/<sweep>/libs/`. Never `~/Ore`, never iCloud. To switch the phone to another library run `bun apps/phone/scripts/sim.ts start --fresh --lib <that dir>`.
  - Ordinary: `bun apps/desktop/scripts/mock/seed.ts <dir>` (has Finder junk, `.DS_Store` and the like, on purpose).
  - Big: `ORE_SEED_SCALE=4 bun apps/desktop/scripts/mock/seed-big.ts <dir>` (about 950 sources, months of reviews, a 1.5 MB book).
  - Empty: `ORE_LIBRARY=<dir> bun packages/cli/src/ore.ts init`.
- Read `docs/reviews/findings.md` before you start: every bug already known. Don't report a row again unless you saw it come back; then name the row.
- Every finding is tried twice. Say whether it came back. Only report what you saw on a screenshot.
- Look at every screenshot before your next action, the way a person looks at the screen. Zoom into the part that matters (crop it) when you judge alignment, clipping or overlap.

## What counts
Anything a person would notice: a tap that does nothing or the wrong thing, something under the keyboard, notch or home bar, text cut off or overlapping, a screen with no way back, lost text or lost place, a stuck spinner or a wait that never says what it is doing, a raw error or id shown, a crash or a blank white screen, a gesture unlike Apple's own apps (Books, Notes, Mail, Podcasts), a jump in layout.

## Report
`codex-out/<sweep>/report.md`: a ranked one-line summary, then each finding (severity blocker/major/minor/polish; screen; exact commands; expected, and what Apple's own app does, vs what happened; screenshot; second try), then what you could not test and why. Finish by printing the ranked findings one line each, or "clean".
