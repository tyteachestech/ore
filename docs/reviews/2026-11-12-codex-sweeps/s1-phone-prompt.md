# Sweep 1 (iPhone): reading and the share card, as real tasks in the iOS Simulator

Same rules, driver and setup as `docs/reviews/2026-11-12-codex-phone/prompt.md` (read it, and its report). Read-only on the repo; write only under `codex-out/s1-phone/` (report.md and shots/). Never touch `~/Ore` or iCloud; don't run `start --lib`.

## Read first
`docs/reviews/findings.md`: every finding already known. Don't report a row again unless you saw it come back; then say which row. Decisions D225, D227, D228 and D230 in `docs/DECISIONS.md` say what the phone should do.

## Under test (merged today, never swept)
- #304 / D230: pictures open full screen (pinch, double tap, swipe down), video pinned under the top bar, a recording's bar above the bottom bar, timestamps that seek, Rename… and Edit author… in ⋯, a PDF's Original page.
- #301 #313 #315 #318 / D227: adding a link with +, the share sheet (`bun apps/phone/scripts/share-target.ts`, read it), "Coming in" with Reading… and the reason when the phone can't read a link, Remove.
- #305 / D228: skill page, a course's lessons, New skill in the drawer, Settings and the reminder.

## Tasks, twice each
1. **Read a mixed source list.** Open a source with pictures: open one, pinch, double tap, pan, put it back. A video source: scroll the transcript, tap a timestamp. A recording: play, scroll down until the bottom bar hides, pause from the bar, Back to current. A PDF: its Original page, turn two pages, pinch, Back.
2. **Fix a title.** Rename a source and edit its author from ⋯; leave one edit by tapping away and one with the keyboard's return; check the list shows the new title.
3. **Save a link for later.** Add a link with +, then share one in from another app; leave the app mid-import and come back; add a link the phone can't read and remove it from Coming in.
4. **Set up a skill.** New skill from the drawer (try a name you already have), open its page, open a course's next lesson, set the reminder time in Settings, relaunch and check it stuck.

Report as in the earlier prompt (ranked one-line summary, then each finding with commands, expected vs what Apple's own app does, screenshot, both tries), plus what you could not test. Finish by printing the ranked findings one line each, or "clean".
