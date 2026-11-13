# The mole in the reward loop

Where the old miner comes in during a review session, what he does there, and what he says. Written 2026-11-13 at Tyler's ask, while the mole's look and his wider set of expressions are being finished in another thread, so the two can be joined without a second round of design.

Status: a proposal. Each row is Tyler's to accept or strike (purpose rule: a pose is used only where it tells him something). Nothing here is built except the rows marked "today".

## What he is for

The numbers say what happened. The mole says how to feel about it, in one look and at most one line. He is the only thing in the reward loop with a face, so he is where surprise, pride and "that one was hard" can show without another number.

## Rules

1. **Only between exercises.** Never on screen while a question is open or being rated: Tyler called a ring or timer there a distraction, and a face is a stronger one.
2. **One mole, one line.** He never appears twice on a screen, and he says one line at a time in his speech box (`MoleSays`). The numbers belong to the row under the ring, not to him.
3. **His size follows the size of the thing.** A pose for an ordinary answer is small and short; the big moves (a hop, a laugh) are kept for the rare things: a new level, a memory pulled back, a goal met. If everything gets a cheer, the cheer means nothing.
4. **Never guilt.** A miss gets a steady, on-your-side look and the reason it was worth it (D62). No sad face, no head shake, no sigh on a miss, ever.
5. **He reacts to the result, never to the person.** Lines stay about the memory and the rock ("Schist happens."), never "you're smart" or "you're slipping".
6. **He looks at the thing he is talking about.** Down at the row as it lands, across at a gem as it is cut. Where he looks is how the eye is led.
7. **Reduce Motion:** he holds the still pose of the same mood. Nothing is lost but the move.
8. **Sound and voice** follow these same cues. A line he says here is the line his voice says, so the list below is also the voice script.

## Cue sheet

Mood names are the ones in `Mole.tsx`. "Today" moods are on master; the rest come from the mole thread's new set (nod, shake, wink, laugh, proud, curious, sad, sleepy, set, shy, wave, huff, lookdown) and are suggestions to check against how each one actually reads.

### During a session

| Moment | Today | Proposed | Line |
|---|---|---|---|
| A question is open, or being rated | not on screen | not on screen | none |
| An ordinary pass, nothing changed | not on screen | not on screen (rule 3) | none |
| A gem is cut | small mole, `happy`, beside the two gems | looks across at the gem as it cuts, then `proud` | today's line ("Cut: you'd still recall this three weeks from now.") |
| A gem is won back (gold rim) | `happy` | `laugh`: the biggest mid-session pose, since it is the hardest thing to do | "Won back. It keeps a gold rim." |
| A gem is polished (passed on a new case) | `happy` | `wink` | "Polished: you recalled it on a new case." |
| Recalled across a long gap | `happy` | `surprised`, settling into `nod` | today's line (how long it had been) |
| A miss on a cut gem | `peek` (he only looks up) | `set`: chin up, steady. Never `sad` or `shake` | today's lines ("Loose, not lost…") |
| Today's goal is met | 48px, `happy`, "Goal met. The rest is extra." | rises, one `wave`, then rests while the line is up | same line |
| Past the goal, still going | not on screen | not on screen: the bonus is in the end screen's numbers | none |

The mid-session mole is 40px today, which is under the size where the new traced drawing is used (48px). Proposed: show him at 48px there too, so it is one mole all through a session.

### The end screen

In order, as it plays:

| Beat | Today | Proposed |
|---|---|---|
| The cart tips into the ring | he is not up yet | same |
| He comes up | `peek` (rises out of the ground) | built since (D255): two endings in three he rides the cart in asleep (`doze`), hangs in the air when it leaves, falls (`fall`) onto the ring and covers for it in his line; otherwise `peek` |
| The row of results lands, one at a time | he cheers at once, before the row is in | `lookdown`: he watches each one land |
| The last result is in | he says his line | he reacts to the day (table below), then says his line |
| After | idle blinks and glances | same; hovering a result turns him to `lookdown` again |
| Done is pressed | the screen closes | a `wave` only if it costs no wait (he waves as the screen leaves) |

His reaction once the row is in, by what the day's third result is:

| The day | Pose | His line (one of a few, as built) |
|---|---|---|
| A skill reached a new level | `cheer` (the hop) | "AI hit level 3." |
| Memories pulled back in time | `proud` | "2 pulled back just before you'd have lost them." |
| A long gap recalled across | `surprised`, then `nod` | "41 days gone and you still had it." |
| Gems cut, nothing rarer | `happy` | a pun: "Gneiss work." |
| Goal met, nothing rarer | `happy`, one `nod` | "Goal met. Quarry on tomorrow." |
| An ordinary day | `nod` | a pun: "You rock." |
| Nothing left due, short of the goal | `happy` | "Seam's empty. Today counts." |
| Every answer a miss | `set`, no cheer | "Schist happens. Every miss comes back sooner." |
| Then and now is showing (once in four weeks) | `curious`, looking down at the two answers | "6 weeks back that one beat you. Read it now." |

Today every day with something kept ends on the same `cheer`. Scaling it is the last piece of "three sizes of ending": the row's colour already makes a big day look bigger, and his pose would make it feel bigger.

### Where he stays out

- **The quick quiz** (the menu bar window): no mole. It is a 30-second visit.
- **What to review** and **Home**: no mole. They are choices, not results. If he ever lives on Home it is a separate decision.
- **The reader**, when a highlight lands: no mole. The highlight's own landing is the reward there.

## Not decided

- `sleepy`, `shy`, `huff`, `shake`, `sad` have no place in the reward loop under the rules above. They may fit the tutor chat; that is the mole thread's call.
- Whether he waves on Done.
- Whether the mid-session mole grows to 48px.
- iPhone: the same cues without the cart. The bubble sits to his right and is narrow at 390pt, so lines there stay under about 40 letters.

## Wiring, once the look is final

All of it is in `apps/desktop/src/Review.tsx`: the mid-session mole is the `moment-mole` (its pose picked from `moment.tone` in `moment.ts`, which would gain the kind of change: cut, won back, polished, long gap, miss), the goal note is `review-goal`, and the end screen's pose is `mood` in `EndScreen`, which would follow the third result from `endTiles()` in `end-says.ts`. No new component is needed.
