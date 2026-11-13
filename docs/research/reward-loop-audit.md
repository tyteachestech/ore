# The reward loop: audit and proposals

> Research and design pass, 2026-11-13. **Nothing here is built or decided.** Tyler asked for a rigorous look at the metrics Ore shows, when its messages arrive, and the whole "make it maximally rewarding" layer: flaws first, then enhancements from first principles, both to the metaphor and loop and to single moments. Read against master at 974441d (D242) plus the open #341 (D243, the mole speaks at a session's end). `DECISIONS.md` stays the source of truth; each proposal names the decisions it would amend. Earlier rounds: `rewarding.md` (D197), `skill-metrics-motivation.md` (D90), `design/daily-session.md`, `design/learning-system.md`.

How to read the evidence tags: **[meta]** a meta-analysis or large preregistered study; **[study]** one or a few experiments; **[repo]** taken from the guidebook paper summaries in `docs/guidebooks/`; **[inference]** my reasoning from the code or from theory, no direct study. What I read and how is in Sources.

## Short version

The foundations are right and should stay: rewards keyed to memory, a miss that reads as learning, a proximal goal (nearly cut), a level line that follows the small-area rule, no streak, no currency. The flaws are in what the numbers count and where the messages land:

1. **Review's header bar measures the backlog.** It is exercises done over everything due, a miss adds a step, and the session ends on minutes, not on the bar. With 200 due it reaches 10% and stops.
2. **The end screen's one hero number is volume.** "Memories kept" is the count of exercises not rated Again. It tracks session length, barely moves day to day, and D62 rules volume out.
3. **"+7 months of memory" does not mean what it says.** The sum of stability gains is led by a few old exercises and by Easy ratings. Per exercise ("+34 days") it is true; summed, it is not a thing he could check.
4. **Rewards hang on his own rating, and the stake is shown before he rates.** The gem (nearly cut) sits at the check step; Good cuts it.
5. **The moment after an answer plays over the next exercise** for four to six seconds.
6. **Every session ends with the same ceremony, and the rarest news comes last** in a fixed order of lines.
7. **Ore means two things**: what he highlighted, in the reader, and minutes, at a session's end.
8. **Twelve progress signals** where three time scales need about three.

Ranked proposals are in the table under "Ranked". My pick to do first: 1 (header ring), 2 (the session's find) and 3 (the honest-rating guard), because each fixes a flaw in something already shipped and each is small.

## 1. What Ore shows today

| When | Signal | Counts | Decision |
| --- | --- | --- | --- |
| During an exercise | Confidence tap; key-point marks and the words that earned them; the line of past reviews with a hollow dot for the next | His judgment, the check, this exercise's history | D21, D141, D149 |
| At the check step | The exercise's own gem (rock, nearly cut, cut, loose) | FSRS stability against 21 days | D237.1 |
| After a rating that changes a gem | A moment: gem before and after, "+N days", one line from the mole, 4 s (6 s on a miss) over the next exercise | Stability added by this rating | D237.2 |
| Review's header | Step dots (up to 30 due) or a dot bar | Exercises done over done plus all still due | D62, D59 |
| Session end | Cart tips ore into the ring; stones cut where they land | Minutes of the goal; exercises that became solid | D190, D239 |
| Session end | Emblem: ring, gems, mole; hero number "N memories kept" | Exercises not rated Again | D242 |
| Session end | Lines, one at a time, 2.6 s each (in the mole's bubble with #341): verdict, depth, longest gap, rescued, levels, minutes left, held-back new | See findings 2, 3, 6 | D241, D243 |
| Session end, weekly | Calibration bars for Guess, Think so, Sure | His taps against the key-point check | D69, D165 |
| Home | Ring and "N of 10 min", plan line, week dots, Start review's hint (N due, about M min) | Minutes; days met; the backlog | D58, D60, D65.4 |
| Start review's picker | "N exercises ready" per skill | The backlog, per skill | D80 |
| Home tiles, skill page | Level ring, cut count, nearly cut due today, missed, depth, grades (gold rim, sparkle), growth line, "You can now explain" | Solid memories and their history | D63, D90, D197, D236 |
| Reader | Highlight vein, ore to Collected, a Key point's stone in the margin | A highlight made | D240 |

## 2. What already works, and why

Worth writing down so a later pass doesn't undo it.

- **Rewards are information about his memory**, not points. Expected tangible rewards undermine interest in tasks people already care about (d = −0.40, Deci, Koestner & Ryan 1999 [repo]); informational feedback does not. Feedback's effect on learning depends on the information it carries (d = 0.48 overall, moderated by content, Wisniewski, Zierer & Hattie 2020 [meta]).
- **A miss reads as learning.** "Loose, not lost", the hypercorrection line after a sure miss, the gold rim on a gem won back (D236, D237). The gold rim is also the repair that the streak studies found rescues most of a break (85% against 45% continuing, Silverman & Barasch 2023 [repo]).
- **A near goal on every screen.** Nearly cut gems due today (D90). Effort rises close to a goal (Kivetz, Urminsky & Zheng 2006 [repo]).
- **The level line switches framing at halfway**: "N since level k", then "N to level k+1" (D63). That is the small-area finding: attention on whichever is smaller, progress made or progress left, raises adherence (Koo & Fishbach 2012 [study]).
- **A session opens and closes on a likely recall** (D176, D177). Beyond peak-end in general, this holds for study itself: people preferred, and chose again, a hard study episode that ended on an easier stretch, even though they learned no more from it (Finn 2010 [study]).
- **Moments are rare by rule** (D237.2): only a rating that changes a gem for good gets one.
- **No streak, no currency, no ranking** (D23, D62). The evidence in `rewarding.md` stands.

## 3. Findings

Each has what the code does, why it is a flaw, and the proposal that answers it.

### F1. Review's header bar measures the backlog (high)

`Review.tsx` draws `done / (done + left)`, where `left` is the whole due queue (`ore due --start` has no limit), and a miss adds a step (`afterAnswer`). The session ends when the minutes goal closes (D65, D144), not when the bar fills. So with a standing backlog, which `daily-session.md` says is the steady state, the bar creeps to a small fraction and the session ends there; on a bad run it stalls while he works. It is the "backlog as a number to work down" that doc's Never list rules out, drawn as a bar.

- A meta-analysis of 32 experiments on progress indicators found a constant-speed bar did not reduce drop-off, one that starts fast and slows reduced it, and **one that moves slowly early raised it** (Villar, Callegaro & Yang 2013 [meta]). A bar helps only when the task is expected to be short and is (Yan et al. 2010 [study]).
- The pull of "almost there" works on the real goal (Kivetz 2006 [repo]). The real goal of a session is the minutes ring.

Answer: P1. This agrees with the bug sweeps thread, which raised dropping the bar.

### F2. The hero number is volume (high)

`kept` is the count of exercises whose first answer this session was not Again (`sessions.ts`). For a 10-minute session it is roughly exercises answered × 0.9. It rises with speed and session length, it is the numerator of percent correct (which D62 keeps out), and it is nearly the same number every day, so it says nothing. D242 made it the screen's one hero number, drawn 56px tall.

- People steer toward whatever is counted and stop when the count is reached (badges on Stack Overflow: activity rose two to four times near a threshold and fell back after, Anderson et al. 2013 [repo]). A count of passes steers toward fast, easy exercises and generous ratings.
- Gamified engagement rises without the outcome following (engagement g = 0.72, cognitive outcome g = 0.27 ns, Vermeir et al. 2020 [repo]). The hero should be the outcome.

Answer: P2.

### F3. Session depth is not a quantity he can check (medium)

`depth_days` sums, over exercises passed, the stability each gained. Three problems. One Good on a six-month-old exercise adds more than twenty young ones, so the number follows the age of the library, not today's work. Easy adds more than Good, so it pays for generous ratings (F4). And "+7 months of memory" from ten minutes invites a literal reading that is false: nothing lasts seven months longer. On one exercise the same unit is true and checkable ("+34 days": this one is now due in about that much longer), and the skill's "3 months deep" has the same summing problem in a quieter place. [inference, from the FSRS arithmetic]

Answer: P6.

### F4. The reward depends on his own rating, and the stake is on screen when he rates (high for the schedule)

D21 makes his rating the record. D237.1 puts the exercise's gem at the check step, so before he rates he sees a nearly cut stone that Good will cut. D237.4 already guards Explain answers (a second press to rate two steps over the marks). Fact exercises, which he rates himself, have no guard.

- People who fall just short of a goal overstate their performance more than people told to do their best, with or without money at stake (Schweitzer, Ordóñez & Douma 2004 [study]).
- Learners over-credit their own recall even with the right answer in front of them; judging against idea units, as Ore's key points do, reduces it (Rawson & Dunlosky 2007; Dunlosky, Hartwig, Rawson et al. 2011 [study]).

A generous Good is not a harmless white lie here: FSRS lengthens the interval, and the memory the gem stands for is the one lost. The reward layer can damage what it rewards.

Answer: P3.

### F5. The moment plays over the next exercise (medium)

After a rating that earns a moment, the next exercise is already up, and the toast sits over it for 4 s, or 6 s when the news is a miss. He has two things to read, and the feedback on one memory arrives while he is trying to recall another.

- The boost a surprising reward gives to memory is time-locked to what was on screen when the surprise came, not before or after (Jang et al. 2019 [study]); surprising rewards are remembered better and mark a boundary between events (Rouhani, Norman & Niv 2018; Rouhani et al. 2020 [study]). The reward belongs on the exercise it is about.
- Redundant "juicy" feedback raised players' ratings of a game while their performance fell (Juul & Begy 2016, a preliminary study; Prook, Janssen & Gualeni 2015, n = 42, where added praise impaired play [study]). Feedback that competes with the task costs something.

This is a risk to check in use, not a proven fault: D237 chose "never holds the next exercise back" on purpose. Answer: P5.

### F6. Every ending is the same size, and the rarest line comes last (medium)

With anything to tip, the cart, the pour, the count-up and the mole run every session. The lines run in a fixed order (verdict, depth, longest gap, rescued, levels, minutes left) at 2.6 s each, with Done focused and ↵ closing the screen. A level reached, which happens every few weeks at most, is fifth, about ten seconds in.

- What is fully predicted stops registering as a reward; it is the surprise that drives learning and memory (Rouhani & Niv 2021; Rouhani 2018 [study]).
- Gamification effects fell from ES 0.45 in weeks one and two to 0.03 by weeks five and six, and what lasted past novelty was competence information and adaptive challenge, not cosmetics (Rodrigues et al. 2022; guidebook ch9 [repo]).
- Abundant feedback does work when it marks something: in a preregistered experiment (n = 1,699) juicy feedback raised felt competence, curiosity and effectance (Kao et al. 2024 [meta]); in a small study it was juiciness, not points and badges, that met all three basic needs (Hicks et al. 2019, n = 36 [study]).

So keep the big moment and make it mean something by not spending it daily. Answer: P2, P4.

### F7. Ore means two things (low, but it is the metaphor)

In the reader a highlight's ore flies to Collected and a Key point gathers into a stone (D240): ore is what he dug out of a source. At a session's end the cart pours ore into the minutes ring (D190): ore is time. Stones in the same cart are exercises. And the emblem (D242) sets gems, which are memory, inside a ring that is minutes. He never reads these words, but a metaphor earns its place by letting him predict what the next thing means. [inference]

Answer: P9.

### F8. Twelve signals for three time scales (medium)

Minutes ring, week dots, cut count, level, nearly cut, missed, depth, grades, kept, rescued, longest gap, calibration. Four of them (kept, rescued, depth, longest gap) say the same thing, "your memory held", in different units on the same screen. The guidebook's test (ch11 [repo]): every element completes the sentence "this serves [need] by [mechanism]", or it is decoration. The purpose rule says the same.

Answer: P2 and P6 remove three from the end screen; nothing is added without removing.

### F9. The picker and Home's hint show what is owed (low)

Start review's picker says "N exercises ready" per skill (D80) and Home's hint gives the total due (D65.4). Both are backlog sizes. `daily-session.md` idea 1 already proposes dropping the hint's count. Answer: P7.

### F10. Nothing changes at week four (medium, later)

Levels sit at 5, 20, 45 and 80 solid memories, and a memory takes one to ten weeks to become solid, so the second level is months out. The middle of a long arc is where effort is lowest (guidebook ch5 [repo]), and weeks four to eight are the valley where novelty has gone and habit has not formed (ch9 [repo]). Ore has the day (nearly cut) and the far arc (levels) and nothing between. Answer: P8.

### Smaller notes

- **Week dots** on Home are a log of met and unmet days. A logged broken run lowered continuation below having no log at all (45% against 65%, Silverman & Barasch 2023 [repo]). The week resets and nothing is counted, so this is a watch, not a fault. If it ever reads as a broken chain, show met days only.
- **Rich ore and the rescued line disappear on backlog days** (`rescuedWorthSaying`), which are the days of the hardest recalls. Right as a rule (never reward the backlog); P2's "find" still names the single best recall on those days.
- **Calibration** compares his taps to the AI check, which matched the labels on about 88% of the grading eval's answers. Fine weekly; don't show it at smaller counts than D165 already requires.
- **The mole's lines** in #341 are about the work, never the person, which is what the feedback evidence asks for (a third of feedback interventions lower performance, more so when attention goes to the self, Kluger & DeNisi 1996, 1998 [meta]). The risk is repetition: about nine templates, heard daily. Occasional automated praise tied to the act did raise homework submission (Motz et al. 2021, n = 1,766 [study]); praise in a constant voice impaired play (Prook 2015). The lesson is frequency. P2 has him say one thing.
- **Agents themselves** help a little: small positive effects on learning and motivation across 17 reviews (Schroeder et al. 2013, 2024 [meta]). The mole is worth keeping; he is not where the gain is.

## 4. First principles

What a reward layer has to do for a ten-minute daily memory habit whose benefit arrives weeks later:

1. **Make the delayed benefit visible, truthfully.** The gain from retrieval and spacing can't be felt in the moment, and learners misjudge it; showing them their own results changes that (Hui et al. 2021, in `rewarding.md`).
2. **Pay only for what helps**: an effortful recall, an honest rating. Anything else that can raise the number will be done (F2, F4).
3. **One signal per time scale**: this answer, this session, this month. Near goals carry motivation that far ones can't (Bandura & Schunk 1981, in `skill-metrics-motivation.md`).
4. **Size the celebration to the event.** Let rarity come from what really happened, never from a random draw (guidebook ch6: variability that is the content [repo]).
5. **Put feedback where and when its cause is** (F5).
6. **Build on what survives novelty**: competence he can verify, content that is always new because it is his (ch9 [repo]).
7. **Never a debt.** No number that grows while he is away (D62, `daily-session.md`).

## 5. Proposals

### The loop and the metaphor

**P2. A session has a find.** The end screen's hero stops being a count and becomes the one most notable true thing the session did, named by its exercise. A fixed order of rarity picks it: a level reached; a skill's first gem; a gem cut; a gem won back; a gem polished; the longest recall of three weeks or more; a rescue; on a return after days away, how much held ("5 days away. 16 of 18 still there."); else the plain verdict. The mole says it (#341's bubble) with the exercise's own question under it: *"Why does spacing beat cramming?" · 41 days gone, and you still had it.* At most two more lines follow; "N memories kept" moves to a hover on the ring.

- Purpose: he leaves knowing which idea he now owns, which is the competence statement D63 calls "You can now explain" and today lives in a popover.
- Why it should work: information over count (Wisniewski 2020; Deci 1999); a specific end is what is remembered (Finn 2010); the content is new every day, so it does not wear out (ch9). It is mechanic 9 of `rewarding.md`, promoted from one more line to the rule that orders the screen.
- Fixes F2, F6, F8 and the repetition note. Amends D242 (hero number), D241 and D243 (order and number of lines). Cost: small; the receipt already has every fact but the exercise's id for the longest gap.

**P4. Three sizes of ending.** Quiet: no gem changed. The ring closes, the mole nods, one line, Done; about a second, no cart. Good: gems cut, today's cart and cut (D239). Big: a level, or a skill's first gem. The full moment, the level's ring drawn large, sound when sound exists.

- Purpose: the big ending keeps meaning something in month three.
- Why: F6's evidence. Amends D190 (the cart runs when a gem is cut, not for ring dots alone). Cost: small, mostly a condition. Tyler's call: the cart is the product video's hero, and on quiet days it would not run.

**P8. The month has a shape: then and now.** On the first session after four weeks of use, and each four weeks after, the end screen adds one card: an exercise he missed or guessed a month ago and passed today, his first answer beside today's (the review log keeps `answer`), and the month's gems in a row. Nothing to earn, nothing counted.

- Purpose: the benefit of spacing shown on his own words (principle 1), placed where the valley is (F10).
- Why: learners who saw their own retrieval results came to value retrieval (Hui 2021); past novelty, "here is how you've grown" is what holds (ch9). Mechanic 8 of `rewarding.md`, given a schedule. Cost: medium. New decision.

**P9. One chain of custody: ore, stone, gem, tool. Time is the lamp.** A highlight is ore (built). An exercise is a rough stone (built). A solid memory is a cut gem (built), polished on a new case (built), set in a tool when used in a real try (waiting on tries, D148.3). Minutes are never ore: at a session's end the cart carries the session's stones, and the ring is the shift that closes.

- Purpose: each new thing predicts the next (F7).
- Cost: a redraw of what the cart pours, which D190, D239 and D242 only just settled. So: don't reopen it for this alone; adopt the chain as the rule for the next thing built, and fix the cart if P4 is built.

**P7. Today's seam, not today's debt.** In Start review's picker and Home's hint, replace "N exercises ready" with what today could turn: the skill's nearly cut and loose gems as small gems, no number ("three nearly cut" drawn, not written).

- Purpose: he picks a skill by what a session there would win.
- Why: the pull is toward a near, winnable goal (Kivetz 2006; Bandura & Schunk 1981); a due count is the backlog (F9). Amends D80, D65.4. Cost: small.

### Single moments

**P1. Review's header: the goal ring, not a count.** Drop the step dots and the bar. Show the 22px goal ring the quick quiz already has, filling by minutes. If he keeps going past the goal, the ring closes once with its burst in the corner and then stays quiet. No timer, no digits.

- Purpose: how far through today's session he is, on the one scale the session actually ends on.
- Why: F1. A ring that only moves forward is the fast-early, never-backward kind of indicator. Amends D62's "the session bar fills". Cost: small. An even smaller option is no indicator at all until the corner mark; the meta-analysis says a constant bar adds nothing, but the last third of the ring is where the goal gradient pulls, so my pick is the ring.

**P3. An honest-rating guard.** (a) On Fact exercises, show the gem only after the rating. (b) On every exercise, the gem before the rating never shows the nearly cut swell; that state is for Home and the skill page, where it is a goal and not a temptation. (c) `ore stats --json` gains one number the app never shows: how often he rates Good or Easy on nearly cut exercises against others of the same recall chance. If the first runs clearly higher after a few hundred reviews, the gem is bending the ratings.

- Purpose: the reward never pays for a wrong rating.
- Why: F4. Amends D237.1. Cost: small.

**P5. The moment lands on its own exercise.** On a rating that earns a moment, the exercise's gem changes where it sits, in one `t-moment` beat (600 ms), before the next exercise comes in; the line stays as a quiet note in the corner and leaves when he starts to type. A miss gets the same beat, not six seconds.

- Purpose: he sees which memory changed, and then has the next question to himself.
- Why: F5. Amends D237.2 ("never holds it back": it would, by 0.6 s, on about one rating in ten). Tyler's call, and worth trying both in a recording before deciding.

**P6. Days of memory stay on the exercise.** Keep "+34 days" on a moment and on the find. Drop the session sum from the end screen and the skill's "N deep" from the popover. If one number is wanted for a session, the honest candidate is a median: "Today's exercises now hold about 5 weeks, up from 2."

- Purpose: every number he sees is one he could check against the calendar.
- Why: F3. Amends D197.4. Cost: small (a removal).

**P10. Sound follows the three sizes.** When the sound work lands (in progress in the house-style thread): one sound for a gem cut, one for won back, one for the goal closing; nothing on an ordinary rating. No direct evidence for sound on learning; the support is that feedback which marks a real event raises felt competence (Kao 2024; Hicks 2019).

### Not now

- **Set in a tool.** The loop's real end is use, and it is the largest change still open, but D148.3 holds it until he has done tries. Still right.
- **Geodes, teach the mole, the deep cut, mined-out sources** (`rewarding.md` 4, 5, 6, 10): each adds a mechanic. Fix what the shipped ones count first.
- **Anything social, any streak.** Unchanged.

## 6. Ranked

Order is value to the learner × confidence in the evidence ÷ cost.

| # | Proposal | Fixes | Evidence | Cost | Amends |
| --- | --- | --- | --- | --- | --- |
| 1 | P1 Header: goal ring, not a count | F1 | meta | S | D62 |
| 2 | P2 A session has a find | F2, F6, F8 | meta + study | S | D241–D243 |
| 3 | P3 Honest-rating guard and the log watch | F4 | study | S | D237.1 |
| 4 | P4 Three sizes of ending | F6 | study + repo | S | D190 |
| 5 | P6 Days of memory stay on the exercise | F3 | inference | S | D197.4 |
| 6 | P5 The moment lands on its own exercise | F5 | study, indirect | S–M | D237.2 |
| 7 | P7 Today's seam in the picker and hint | F9 | repo | S | D80, D65.4 |
| 8 | P8 Then and now, every four weeks | F10 | study + repo | M | new |
| 9 | P9 One chain of custody (with P4) | F7 | inference | M | D190, D239 |
| 10 | P10 Sound on the three sizes | none | weak | with the sound work | none |

2 and 4 are best built together, and 2 can ride on #341 before it merges. 1 and 3 are independent of everything.

## 7. Questions for Tyler

1. Which of 1 to 10 to build. My pick: 1, 2, 3 now; 4 and 5 with 2; mock 6 as a recording before deciding.
2. P2: is the exercise's question welcome on the end screen, or should the find stay a sentence without it?
3. P4: is a quiet ending acceptable on days no gem is cut, given the cart is the video's hero?
4. P6: drop the session's "+N months" outright, or try the median line?

## 8. How to tell whether it worked

All from the logs, read with `ore stats --json`, none of it shown in the app. Check after two weeks of daily use and again at eight (the valley).

- Sessions started per week, and the share that reach the goal (the habit; `brief-learning-science.md` §10 calls starts the primary measure).
- Keep going taken after the end screen (did the ending leave him wanting more).
- Good and Easy on nearly cut exercises against matched others (P3c).
- His rating against the AI's (`ai_agreement`, D176.3), before and after P3.
- Seconds on the end screen before Done. If it is under two, nothing on it is being read, whatever it says.

## Sources

Read as abstracts through Consensus and SciSpace on 2026-11-13 (not full text):

- Villar, Callegaro & Yang 2013. Where am I? A meta-analysis of experiments on the effects of progress indicators for web surveys. *Social Science Computer Review.*
- Yan et al. 2010. Should I stay or should I go: the effects of progress feedback, promised task duration, and length of questionnaire. *International Journal of Public Opinion Research.*
- Finn 2010. Ending on a high note: adding a better end to effortful study. *JEP: Learning, Memory, and Cognition.*
- Schweitzer, Ordóñez & Douma 2004. Goal setting as a motivator of unethical behavior. *Academy of Management Journal.*
- Rawson & Dunlosky 2007. Improving students' self-evaluation of learning for key concepts in textbook materials. *European Journal of Cognitive Psychology.* Dunlosky, Hartwig, Rawson et al. 2011. Improving college students' evaluation of text learning using idea-unit standards. *Quarterly Journal of Experimental Psychology.*
- Koo & Fishbach 2012. The small-area hypothesis: effects of progress monitoring on goal adherence. *Journal of Consumer Research.*
- Wisniewski, Zierer & Hattie 2020. The power of feedback revisited: a meta-analysis of educational feedback research. *Frontiers in Psychology.*
- Kluger & DeNisi 1998. Feedback interventions. *Current Directions in Psychological Science* (summarising their 1996 meta-analysis).
- Motz et al. 2021. The influence of automated praise on behavior and performance. *Technology, Mind, and Behavior.*
- Prook, Janssen & Gualeni 2015. The negative effects of praise and flattery. *Foundations of Digital Games.*
- Juul & Begy 2016. Good feedback for bad players? A preliminary study of "juicy" interface feedback.
- Hicks, Gerling et al. 2019. Understanding the effects of gamification and juiciness on players. Hicks, Gerling et al. 2019. Juicy game design: understanding the impact of visual embellishments on player experience. *CHI PLAY.*
- Kao, Ballou, Gerling et al. 2024. How does juicy game feedback motivate? Testing curiosity, competence, and effectance. *CHI.* I read the summary only; its finer result on which feedback features matter is not used here.
- Rouhani, Norman & Niv 2018. Dissociable effects of surprising rewards on learning and memory. *JEP: LMC.* Rouhani et al. 2020. Reward prediction errors create event boundaries in memory. *Cognition.* Rouhani & Niv 2021. Signed and unsigned reward prediction errors dynamically enhance learning and memory. *eLife.*
- Jang et al. 2019. Positive reward prediction errors during decision-making strengthen memory encoding. *Nature Human Behaviour.*
- Schroeder, Adesope & Gilbert 2013. How effective are pedagogical agents for learning? A meta-analytic review. Schroeder, Davis, Yang et al. 2024. Designing and learning with pedagogical agents: an umbrella review. *Journal of Educational Computing Research.*

From the repo's guidebook summaries (`docs/guidebooks/gamification/research/paper-summaries/`), written from full text: Anderson 2013, Deci, Koestner & Ryan 1999 (via ch2), Kivetz 2006, Rodrigues 2022, Silverman & Barasch 2023, Vermeir 2020. From earlier Ore research, not re-read: Bandura & Schunk 1981, Hui 2021, Kahneman 1993.

Limits: almost none of this was measured on adult self-study with spaced repetition. The survey and game studies transfer by mechanism, not by setting. Effect sizes are for their own settings; none should be read as a forecast for Ore. Findings marked [inference] are mine.
