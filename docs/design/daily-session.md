# Who Ore is for, and the daily session (2026-11-08)

Tyler, 2026-11-08, in the stress-test thread: "assume the user is going to have a large backlog of due cards at any point. This app is more so about making the 10 min to 1 hour a day learning habit for ambitious adults as productive as possible." This doc is that frame, written down so every screen, queue rule and reward is checked against it. `DECISIONS.md` stays the source of truth where they differ; this doc only says what the decisions are for.

## The person

- **An ambitious adult learning on purpose, beside a full life.** They learn to explain and apply ideas in their work, not to collect facts (D1).
- **Time is the scarce thing, not material.** They have 10 minutes to an hour a day. Their reading list grows faster than they read it, and their due cards never run out.
- **The steady state is a standing backlog.** Design for it. "All caught up" is a rare edge case, not the goal and not the reward.
- **Learning feels anxious.** A big count of due cards, a missed day, a hard card or a wrong answer all read as failure (the "calm, delightful, satisfying" feel of D129 exists for this). They come back every day only if starting is easy and leaving feels good.
- **Sessions get cut short.** A meeting starts or a child wakes up. Any minute spent must already have counted (D59: every rating is logged as it happens).
- **Days get missed.** Late reviews cost little and cramming costs a lot (`research/brief-learning-science.md` §5). A missed day must cost nothing but the reviews themselves.

## What productive means here

Per minute of the block: the most memory kept, plus enough new understanding coming in that the skill keeps growing. Two kinds of cards serve those two ends:

- **Due cards** keep what they already learned.
- **New cards** (AI drafts from a finished source, D19) bring in what they just read.

With a backlog that never empties, the question is never "how do I finish?" but "what is worth this minute?"

## The daily session, open to close

| Step | What happens | Built as |
| --- | --- | --- |
| 1. Cue | Their own plan, "After my morning coffee, I review", and one reminder a day while the goal is unmet | D67 |
| 2. Open | Home shows minutes done of the goal beside the ring; the due count waits in Start review's hint. ↵ starts | D58, D65.4, D80 |
| 3. Review | One card at a time, full window. The most valuable due cards first, with new cards mixed in at a fixed share (below) | D59, D22, D24 |
| 4. A new card | Shows the **New** label on first sight, so they read it with care. Answering it approves it; E edits it; ⇧⌘⌫ deletes it. Its FSRS schedule starts from that first answer, like any card | D65.3, D9 |
| 5. Close | When the goal closes the mole says so and the session flows on (D246); when he leaves, the end screen: a gem for each card that became solid, and one row of three results (memories kept, days of memory, the rarest thing; D252). Keep going goes on | D62, D90, D65.4 |
| 6. Read | Continue reading picks up where they left off. Highlights and notes as they go; Finish opens the quiz; Done drafts the source's cards, which start tomorrow | D58, D106, D65.3 |
| Any time | Esc leaves. Nothing is lost and nothing is owed | D59 |

Review comes before reading because it is the part that decays: a day without reading loses nothing, a day without review lets memories slip. Reading is where new cards come from, so the habit needs both.

The daily goal counts review only (Tyler, 2026-11-08): review time is measured per card, reading time isn't, so a one-hour learner sets a 20-minute review goal and reads the rest.

## How cards fill a fixed block

The block is the daily goal in minutes (D60). Inside it:

1. **New cards get a fixed share of every session, mixed in** (Tyler's pick, 2026-11-08, settling review-08 in `reviews/2026-11-08-stress-test.md`; built in #171, its D-line amends D65.2). About one card in five is new, whatever is due, so new material arrives every day. This replaces D65.2's "new only while the goal has room after due cards", which under a standing backlog let no new card in.
2. **The rest of the block takes the most valuable due cards, not the oldest.** The queue already ranks them by skill priority and how close each is to being forgotten (D22), interleaved across topics (D24). Cards at the bottom of the ranking wait, and waiting is cheap.
3. **The goal is told when the time is up, and he ends the session**, not an empty queue (D246, amending the first rule here that the session ended itself at the goal): the mole says "Goal met. The rest is extra." and the next exercise is already there; Esc or Done ends it on the end screen. The quick quiz still closes at the goal.
4. **A card missed today comes back today** (review-07), so a miss is fixed while it is fresh.

## Motivation: a habit they want, not one they owe

Tyler wants the daily session to be something people get hooked on in a good way. The test for every reward: does it pull them back because the time felt well spent, or because they fear losing something? Only the first kind is allowed (D62).

**Why the backlog changes rewards.** Anything keyed to finishing (inbox zero, "queue cleared", "all done") never fires when the backlog is permanent. Anything keyed to the backlog's size punishes them for having a full life. So every reward is keyed to what this session did for their memory, which is always winnable in ten minutes.

| Lever | What Ore does | Built as | Evidence |
| --- | --- | --- | --- |
| A cue | Their own "After X, I review" and one plain reminder | D67 | Implementation intentions, d ≈ 0.65 (Gollwitzer & Sheeran 2006) |
| An easy start | One key from Home, never a card count | D65.4, D80 | Small, predictable load (brief §10) |
| Wins during | The card comes in (ease-out, no spring, D185), rubric marks tick in, the words that earned each key point light up; a new card every few for variety | D62, D141 | Informational feedback (Deci, Koestner & Ryan 1999) |
| A good ending | The goal ring closes; gems drop in for cards that became solid; "rescued" names near-misses saved | D62, D90 | Small wins noticed (`research/skill-metrics-motivation.md`) |
| Growth over weeks | Levels that never drop, and gems a miss loosens but a recall wins back (D236); calibration once a week | D63, D90, D69 | Progress monitoring, d ≈ 0.40 (Harkin 2016) |
| Forgiveness | No streak; this week's met days and the total; weekdays only if they like; nothing resets | D60, D23 | Broken streaks drop below baseline (Silverman & Barasch 2022) |

**Never**, on top of D62's list (no XP, badges, hard-reset streaks, random rewards, leaderboards, guilt copy):

- The backlog as a number to work down, or a goal of clearing it.
- Skipped or waiting cards framed as overdue, late or lost.
- A reward for minutes or cards alone (volume, D62).

## Ideas this frame suggests (not decided)

Each needs Tyler's call before it is built. None touches FSRS math (D22). `learning-system.md` marks which are safe to build now.

1. **Drop the full due count from Home's hover hint** (D65.4). Under a standing backlog it only grows, and nothing in the session changes because of it (purpose rule). The slice in minutes already says what today asks.
2. **Start on a likely win.** The first card of a session is one they will probably recall, so the first ten seconds feel good. Order within today's slice only. **Built as D176** (Tyler, 2026-11-10).
3. **End on a win.** When the goal closes right after a miss, one more likely-recalled card first, so the session's last moment is a success (the peak-end rule, Kahneman et al. 1993; in the field, hard tasks that came last or back to back raised quitting, Kang, Daniels & Schweitzer 2022, `research/brief-learning-science.md` §10). **Built as D177** (Tyler, 2026-11-10).
4. **The nearly cut gem as a one-click review** of the cards it stands for (D90's "later").

## Related

- `DECISIONS.md`: D22 and D24 (queue order), D60 and D65 (daily goal and load), D62 and D90 (motivation and gems), D67 (cue and reminder).
- `reviews/2026-11-08-stress-test.md`: review-07 and review-08, the calls that led here.
- `research/brief-learning-science.md` §5 and §10: spacing costs and habit evidence.
- `design/signature-style.md`: the calm feel (D129).
- `design/learning-system.md` (#177): the whole learn-and-apply loop, and which of the rewards above are safe to tune now or likely to change once applying is built.
