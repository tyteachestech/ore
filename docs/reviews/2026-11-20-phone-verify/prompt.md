# Verify: the iPhone native-feel fixes merged 2026-11-19 and 11-20

Your name is `verify`. First read `docs/reviews/2026-11-13-codex-phone-edges/common.md` and follow it (how you touch the phone with `sim.ts`, your own simulator, scratch libraries, the report). Your sweep folder is `codex-out/verify/`. Seed: `bun apps/desktop/scripts/mock/seed.ts codex-out/verify/libs/seed`, then `bun apps/phone/scripts/sim.ts start --fresh --lib codex-out/verify/libs/seed`.

**Report only.** Change no file in the repo.

## The job
Each fix below is merged on master. For each one: do what it says on the simulator, compare with Apple's own app named, and mark it **PASS**, **FAIL** (what you did, what happened, a screenshot) or **CAN'T CHECK** (why: e.g. haptics, a setting the simulator lacks). Try each twice. Also note anything the fix broke next to it.

1. **Bounce (F402).** Every list (Today, Library, Settings, a skill) and the reader rubber-band past the top and bottom, even a short page. Apple: Settings, Notes.
2. **Pushed screens slide (D331).** A source and Review slide in from the right and out on back; a bottom sheet rises and lets down; a long-press menu grows from its row. Apple: Notes, Mail.
3. **Keyboard keeps the field in sight (F403).** Focus every text field you can find (search, note, rename, plan field, answer box in Review, tutor): the field and caret stay above the keyboard, no jump on open/close.
4. **Search clear button and Search key (F404).** Search shows an ⓧ once there is text; a tap clears it and the keyboard stays up; the Return key reads Search. Apple: Settings search.
5. **Light page behind the clock (F405).** With the reader's page set to Light (Aa sheet) and the system in dark mode, the strip behind the status bar/clock is light, not dark, at rest and while scrolling. Note editing (noting) still looks right.
6. **Switches slide (F406).** In Settings, drag a switch's knob across and release off the track: it flips once and stays. Drag back and forth before lifting: it saves once (one Undo toast, not several). A plain tap still flips it. Apple: Settings.
7. **Settings title folds into the bar (F407).** Scroll Settings: the big "Settings" title leaves and a small title appears in the top bar, back again at the top. Apple: Settings, Mail.
8. **No white flash at launch (F415).** In dark mode, cold launch (terminate, then launch): the launch screen is dark and goes straight to the first frame. If the simulator shows an old launch screen, erase the app and reinstall once (iOS caches it).
9. **Mole's voice switch starts as Sound effects was (F417).** Fresh install: turn Sound effects off, relaunch: Mole's voice starts off too. Turn voice on alone: it stays on after relaunch.
10. **Bonus lap ticks climb (F418).** If you can reach a Review that runs past the daily goal, the lap marks count up one step at a time. CAN'T CHECK is fine if the seed can't get there.
11. **Bold Text (F409).** Turn on Bold Text (Settings › Accessibility › Display & Text Size, in the simulator's own Settings app, or by `defaults`/`simctl` if you find a way), return to Ore: row text and titles are heavier; turn it off, return: back to normal. Apple: Settings.
12. **Haptics (D332).** CAN'T CHECK in the simulator; one line.

## Report
`codex-out/verify/report.md`: one section per item (verdict, what you did, screenshot paths under `codex-out/verify/shots/`). End by printing a table: item, verdict, one-line note.
