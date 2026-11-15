Your name is `phone`. First read `codex-out/preamble.md` and follow it, with these changes:
- Your library is a **copy of the owner's real library**, loaded into the iPhone app's page (below), not a seed. Read what is there first and judge each screen as he would meet it with his data.
- The phone has no AI. Judge how it behaves without it (a wait that never ends, a dead control, no next step), not the missing answers.
- Yesterday's phone rehearsal is in `docs/reviews/2026-11-14-codex-adhoc/daily-report.md`; its touch-Undo and author findings are known (rows in findings.md). Don't redo what it passed; don't re-test undo key by key or edge-case input.

Your ports: iPhone app http://localhost:<PHONE_PAGE>/ (library copy `<PHONE_LIB>`), WebKit at `ws://[::1]:<WS>/`. Keep one page open for a whole journey (its writes live in the page).

## Your focus: the owner's day on his phone, as a commute session
Script: `docs/design/daily-session.md`. He opens Ore on the phone for 10 minutes, one-handed, in short bursts.
1. **Open.** Today as it is on his library: is what today asks clear, is Start one tap away, is anything cut off or overlapping at 390 pt?
2. **Review to the goal and past it.** Start, answer a mix by tapping: reveal, rate Again, Hard, Good, Easy; let a miss come back; reach the goal and the mole's line; go on; leave on the end screen. Check every exercise of his for raw Markdown, a broken or missing passage, text that runs off screen, a control under the thumb that does the wrong thing.
3. **Interrupted.** Mid-review, leave (go back, switch to another screen, reload as a relaunch would) and come back: is the place and every rating kept, does the ring count right?
4. **Read.** Continue reading one of his real sources: does it resume where he was? Highlight two passages by touch, mark a Key point, add a note. Add one article by its link.
5. **Tomorrow.** Move the clock a day: Today and Review on day 2, what is due and that nothing was lost.
Record every moment the session stopped him, naming the step of the daily session it breaks. Time the session and say where the minutes went.
