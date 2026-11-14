Your name is `time`. First read `codex-out/preamble.md` and follow it.

PORTS

## Your focus: days, clocks and time away
Ore is a daily habit over a backlog that never empties (`docs/design/daily-session.md`). Read D22 to D24 and anything on the daily goal, minutes and "today" in `docs/DECISIONS.md`, and `packages/core/src/queue.ts` and `scheduler.ts`. Use Playwright's `page.clock` and `page.emulateTimezone`-style context options (`timezoneId`) to move time in the page; to age the library, write past-dated records into your library's review logs the way the app writes them (read the code for the shape), never by hand-editing a file the app keeps open.
1. **Time away.** Come back after 1 day, 3 days, 30 days and a year with a full library: what Home says, how much is due, the order Review takes, the daily goal, and whether anything reads as guilt or a streak (D23 forbids streaks).
2. **Midnight.** Start a session at 23:55 and keep reviewing past midnight; leave the app open overnight and come back. Which day do the minutes count to, does the goal reset, does Home update without a reload, does the end screen's ring tell the truth?
3. **Time zones and DST.** Change `timezoneId` between sessions (fly from New York to Tokyo and back), and run a session across the US DST change (8 March 2026, 1 November 2026). Are due dates, "today" and "next in N days" right?
4. **Clock wrong.** The Mac clock set a day ahead then back (review then undo across it), a review log record from the future.
5. **Dates shown.** Every date and relative time on Home, a source, a skill page, Review's memory line, Settings' reminder: right, in his time zone, never "in 0 days" or "1 days" (F131 was fixed for the memory line; look for the same kind elsewhere).
On the iPhone too, where the screen exists (Today, Review, the reminder time).
