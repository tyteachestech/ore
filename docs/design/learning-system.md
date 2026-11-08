# The learning system, end to end (proposed, 2026-11-08)

Tyler, 2026-11-08, before a deeper pass on `daily-session.md`'s reward ideas: "if we don't have the fundamentals down, we might overfit the gamification metrics to a system that ends up changing." This doc maps the whole learn-and-apply loop the science asks for, marks what Ore has, and says which rewards are safe to tune now. Nothing here is decided; `DECISIONS.md` stays the source of truth.

Sources: the Learning Science guidebook (`docs/guidebooks/learning-science/`, chapters cited as ch1 to ch9), `research/brief-learning-science.md`, `reviews/2026-11-02-science-pass.md`, `research/skill-strength.md`, `design/skill-goals-and-parts.md`.

## Why the order matters

The Gamification guidebook (`docs/guidebooks/gamification/`, ch11) says the same thing Tyler suspects: design the core activity loop first and pick game elements last, and build the long arc from milestones the learner has shown they can do ("You can now…"), not from points. Rewards amplify a loop. If the loop gains a step, every reward keyed to the old loop has to move.

## The loop

| # | Stage | What the science asks | Ore today | Status | Fundamental? |
| --- | --- | --- | --- | --- | --- |
| 1 | Aim | A goal you could show you can do; a learning goal for new skills, never a score (ch6, ch8) | Skill goal and its closed-book Try it (D102) | Partial: no per-session aim | Goal: yes, built. Session aim: later |
| 2 | Encounter | Material that comes in whole; scout it with questions first (ch2 pretesting) | Import (D122), prequestions (D18) | Built | Yes |
| 3 | Encode | Highlighting only paired with a task (ch5, ch9) | Highlights with notes, ★ key points, the AI plans cards (D118, D126), main-point lines (D32), side quests (D97) | Built | Yes |
| 4 | Elaborate | Produce explanations, concrete examples, then see a model (ch5); worked examples for beginners, faded (ch6) | Chapter recall in the note (D115), finish recall (D53), Explain cards (D1), tutor Practice (D128.6), Show me in steps (D142) | Built | Yes |
| 5 | Retrieve | Recall by default, always with feedback (ch2) | Review (D59), finish quiz (D52 to D56), key-point evidence (D141), corrective answers (D140), in-head answers (D68) | Built | Yes |
| 6 | Space | Gaps over days; late is cheap, early costly; successive relearning for what matters most (ch3) | FSRS by priority (D22), first review a day later (D65.3), new cards one in five (D144), a miss returns today | Built; relearning to a criterion only one pass | Yes |
| 7 | Mix and vary | Mix what must be told apart, block definitions; new cases for transfer (ch4) | Topics interleaved, confusables served together (D24, `queue.ts`), remixed cards (D66) | Built | Yes |
| 8 | Judge your own learning | Calibration; explain the difficulty when it's felt; show delayed benefit, not today's score (ch1, ch8) | Confidence taps, calibration (D69), "rescued" on the end screen (D62) | Partial: no "this is hard because…", no "you remembered this from 9 days ago" | Later (messages on top of any loop) |
| 9 | **Apply for real** | Practice that looks like the use (ch2); one specific aim, feedback, adjust, again (ch7); reflect after doing (Di Stefano 2015) | Try it highlights and To try (D127), the finish's "Where would you use this?" (D18) | **Partial: one rep, no way back, no outside feedback** | **Yes** |
| 10 | Keep showing up | A cue that starts the session; forgive one miss, step in on runs of misses (ch8) | Plan and one reminder (D67), forgiving goal (D60), no streaks (D23) | Built; no smaller session when misses pile up | Built part: yes. Rest: later |
| 11 | See progress | Competence you can trust: memory and use, never volume (ch7, gamification ch11) | Gems count solid memories (D63, D90); "You can now explain" | Partial: counts memory only, never use | **Decide now, build later** |

Stages 2 to 7 are the strongest part of Ore. The two gaps that would reshape rewards are 9 (applying) and 11 (what progress means), and 11 depends on 9.

## The missing loop: apply it for real

**What the science asks.** Most adult skills here (teaching, writing, the creator business) are "wicked" fields where hours explain almost nothing; what helps is varied tries, feedback, and reflection (ch7). Self-taught practice lacks the outside view that catches what you don't know you are doing wrong (ch7). The learning cycle ends with "look back and adjust" (ch8), and a try that is never repeated with a change is the automaticity trap's mirror: experience without practice.

**What exists (D127).** Mark a passage Try it, write "I'll try this on…", check it off on the skill page, write how it went, and enrich drafts one Explain card from the reflection.

**Where the loop breaks.**

1. **It never comes back.** Tries wait on the skill page; nothing brings one up on a day he could do it.
2. **One rep.** Checking off ends it. There is no "next time I'll…", so no second try with a change.
3. **Only his own feeling as feedback**, which ch1 and ch8 call a broken instrument.
4. **It counts nowhere.** Progress shows memories; using an idea leaves no mark.

**A minimal first version** (proposal; three small steps on D127, no new type, no schedule, no count):

- **A. Next time.** "How did it go?" gets a second line, "Next time I'll…". When he fills it, a new try goes on the list with that line as its plan; the old one stays tried. That closes plan, do, reflect, adjust, again.
- **B. Back where he already is.** One open try, the oldest, shows as one line in a place he sees every day (Home or the session's end screen; open question 2). A click opens it. No reminder, no badge, nothing owed.
- **C. An outside view on demand.** Beside "How did it go?", Ask the tutor opens it with the try, its passage and his reflection, to say what matched the technique and what to change. Optional; his reflection still saves without it.

**Not yet:** reminders at his cue, outcome numbers (views, scores), uploading the work itself, plateau detection, tries counted in gems. D127.4's caution stands: watch him use tries before adding more.

## Order

1. **Decide what progress means** (stage 11): memories only, or memories plus ideas used. A decision, not a build; every reward on the long arc keys off it.
2. **Apply loop v1** (A, then B, then C if wanted).
3. **Messages that track learning, not performance** (stage 8): "you remembered this from 9 days ago" on a pass after a long gap, one line on why a hard card is hard. Cheap, and they work on any loop.
4. **Later:** a two-question aim before a session and a look back after (ch8), a smaller session when fewer than 80% of the last 14 days met the goal (ch8), relearning to a criterion for P1 cards (ch3), strategy-mix feedback (ch8).

## `daily-session.md`'s rewards: safe now or likely reshaped

**Safe now.** These key off retrieval and the habit of starting, which every future loop keeps:

- The cue and one reminder, the easy start, the wins during a card, forgiveness.
- Idea 1, drop the full due count from Home's hover.
- Idea 2, start on a likely win (order within today's slice only).
- Stage 8's two messages above.

**Likely reshaped once applying exists:**

- **Gems and levels as the only growth signal.** The long arc should include ideas he has used, not only memories kept (gamification ch11: milestones he has shown).
- **The end screen.** It may carry the one try line (B).
- **"The daily goal counts review only."** Holds while tries happen away from the desk; revisit if written practice (D128.6) joins the session.
- **Idea 4, the glowing gem as one-click review.** What a gem stands for may widen.
- **Idea 3, end on a win.** Not in the research briefs yet; cheap to wait.

## Open questions for Tyler (round 1)

1. **Have you checked off a try yet?** If not, the gap is B (it never comes back) before A. *Rec: build B first either way.*
2. **Where does the one try line live?** Home under today's slice, or the end screen after the goal closes. *Rec: the end screen, when he has just finished and the next real task is ahead.*
3. **Should using an idea count as progress?** *Rec: yes, but not in gems yet. A tried try shows on the skill page as "used"; decide the gem question after a few weeks of tries.*

## Related

- `design/daily-session.md` (#169): the daily session and its reward ideas.
- `DECISIONS.md`: D102 (goal), D127 (Try it), D128.6 (Practice), D62, D63, D90 (motivation, strength, gems), D144 (new-card share).
- `reviews/2026-11-02-science-pass.md`: rec 1, use it two weeks before more learning features.
