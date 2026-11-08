# More components in Rare UI's spirit (2026-11-08, round 2)

Tyler asked for more candidates and pointed to [Rare UI](https://www.rareui.com/components): small components, each
doing one interaction with some craft in its motion. The first round (`2026-11-08-shadcn-components.md`) built
1, 2, 3, 5 and 6 (D141–D143); its 4 (keep part of a tutor reply) and 7–10 are still open. This is a pitch list:
nothing is built until he picks.

**Searched:** all 28 of Rare UI's components (site and registry), then the MIT registries for the same kinds of
pieces: assistant-ui, Cult UI, Dice UI, Magic UI, Motion Primitives, Animate UI, Kibo UI, shadcn.

**Constraints kept:** purpose rule (each pitch names what he learns or does better); D120: Rare UI's license
(MIT plus Commons Clause, attribution) bars copying its code, so it gives the idea and the behaviour, and the
code comes from an MIT source or is written for Ore; motion follows `review-animations/STANDARDS.md` (keyboard
and 100-times-a-day actions don't animate); D23 (no streaks or scores).

## Already in Ore from Rare UI (D113, 2026-11-03)

Bounce sidebar (the sidebar's pixel arrow), Rail TOC (the outline rail), Toast (the toast stack with Undo),
Animated counter (rolling pixel digits), Web Search (the tutor's source pills, D139).

## Ranking

★ = the ones I'd build, in order.

| # | Pitch | Where | Replaces / adds | Idea from | Code from | Effort |
|---|---|---|---|---|---|---|
| ★1 | A dot-matrix status that says what the AI is doing | Tutor, grading, Explain, enrich | The pixel spinner and a fixed "Thinking…" | Rare UI Matrix orb, Inline AI status | assistant-ui `dot-matrix` (MIT) | S–M |
| ★2 | A card's reviews on a timeline | Card details, after a rating | Nothing: the schedule is invisible | assistant-ui Timeline | assistant-ui `elements-timeline` (MIT) | M |
| ★3 | A step track over Show me's steps | Tutor | Steps with no sense of how many are left | Rare UI Step player | Dice UI `stepper` (MIT) | S |
| ★4 | A reading-progress pill that opens the sections | iPhone reader, narrow windows | No outline where the rail doesn't fit | Rare UI Scroll progress | Motion Primitives `scroll-progress` (MIT), Radix Popover | S–M |
| ★5 | Reading page and font picked from previews | Settings › Reading | A text segmented control; no serif choice | Rare UI Theme selector | Radix RadioGroup | S |
| 6 | Audio sources play with a waveform and their highlights | Podcasts, lectures | Audio read only as a transcript | Rare UI Voice note | Written for Ore (wavesurfer.js, BSD-3, if needed) | L |
| 7 | A card opens out of its row | Card lists, Review queue | The editor appears from nowhere | Cult UI Expandable screen | Motion Primitives `morphing-dialog` (MIT) | M |
| 8 | Next due questions fan out from a skill | Home | A due count with no preview | Rare UI Folder | Written for Ore | M |
| 9 | One sheet that steps through on the phone | iPhone Add, source menu | Sheets stacked on sheets | Rare UI Family drawer | Cult UI `family-drawer` (MIT) | M |
| 10 | A pixel burst when a source is finished | Finish | Finish closes quietly | — | Magic UI `confetti` (MIT), square pixels | S |

## ★1 A dot-matrix status that says what the AI is doing

- **Replaces:** the pixel spinner with a fixed label ("Thinking…", "Searching the web…") in the tutor, grading,
  Explain and background enrich.
- **Behaviour:** a 5×5 dot matrix (Ore's pixel grid) with its own blink pattern for each thing the AI is doing:
  reading his sources, searching the web, writing, checking his answer. The label names it ("Reading Make It
  Stick…"), and the pattern changes the moment the stage does (the tutor already streams a search starting).
  It stays still under reduced motion.
- **Why:** a wait he understands is a wait he trusts. "Reading your sources" vs "Searching the web" also tells him
  where the answer will come from before it lands (D137). It is the matrix loader he liked on transitions.dev,
  in the 8-bit grid Ore already uses for its pixels.
- **From:** assistant-ui `dot-matrix` (MIT) for the patterns per state; Rare UI's Matrix orb and Inline AI status
  for the idea of one mark per stage.

## ★2 A card's reviews on a timeline

- **Adds:** in a card's details and for a moment after he rates it, a line of its reviews in time: a dot per review
  coloured by his rating, the gaps between them to scale, and a hollow dot for the next one.
- **Why:** learners distrust spacing because massed practice feels better (Kornell & Bjork 2008). Seeing the gaps
  widen while recall holds shows him the method working on his own card, and a card that keeps dropping back
  shows him what to rewrite or split. It's about this card, not a score (D23).
- **From:** assistant-ui `elements-timeline` (MIT): events on a time axis, what happened and what's coming. The
  dates come from the card's review log (FSRS, ts-fsrs), nothing new to store.

## ★3 A step track over Show me's steps

- **Adds:** above a worked answer (D142), a row of short marks: the steps he has shown are filled, the current
  one is a longer bar, the rest are dots. A filled mark scrolls back to its step.
- **Why:** knowing there are two moves left, not five, tells him how big his own next try is, which is the point of
  showing steps one at a time.
- **From:** Rare UI's Step player for the look (a step stretches into a bar), without its play button: he reveals
  each step himself. Dice UI `stepper` (MIT) for the structure and keys.

## ★4 A reading-progress pill that opens the sections

- **Adds:** where the outline rail doesn't fit (the iPhone, a narrow window), a small pill with a ring that fills as he
  reads and the current section's name. A tap opens the section list; a section jumps there, Esc closes.
- **Why:** in a long chapter on the phone he can't see where he is or go back to reread the section a question came
  from. The rail does this on the Mac; the pill is the same thing for small screens.
- **From:** Rare UI's Scroll progress for the behaviour (ring, label crossfade, pill opens into the list); Motion
  Primitives `scroll-progress` (MIT) and Radix Popover for the code.

## ★5 Reading page and font picked from previews

- **Replaces:** Settings › Reading page, a Dark / Light segmented control.
- **Behaviour:** a row of small reader previews, one per page (Dark, Light) and one per reading font
  (Charter serif, Geist sans, the serif reading option he asked for); a ring marks the pick; arrows move and pick.
- **Why:** he picks what reads best by seeing it, not by guessing from a word.
- **From:** Rare UI's Theme selector for the idea; Radix RadioGroup for the control.

## 6 Audio sources play with a waveform and their highlights

- **Adds:** a podcast or recorded lecture plays in place: a waveform he can scrub, his highlights as ticks on it,
  and the transcript following along (as video does, D48–D50).
- **Why:** reviewing a lecture means going back to the moments he marked.
- **From:** Rare UI's Voice note for the bar (waveform fills as it plays, tap the time to change speed). Waits for
  audio to play in place at all (D122); same call as the first round's 10.

## 7 A card opens out of its row

- **Adds:** clicking a card in a list grows it into the editor from where it sits, and Esc folds it back into its row.
- **Why:** he sees which card he is editing and where it goes back to, in a list of near-identical questions.
- **From:** Motion Primitives `morphing-dialog` (MIT); Cult UI's Expandable screen is the same idea.

## 8 Next due questions fan out from a skill

- **Adds:** hovering a skill on Home fans out its next three due questions, as Rare UI's Folder fans its cards.
- **Why:** a glance at what's due tempts a short session more than a number does. Risk: the purpose rule. It must
  show the questions, not decorate.

## 9 One sheet that steps through on the phone

- **Adds:** on the iPhone, Add and a source's menu become one sheet that changes height and content between steps
  (pick → skill → done) instead of sheets on top of sheets.
- **From:** Cult UI `family-drawer` (MIT), Rare UI's Family drawer. iPhone work needs Tyler at the Mac.

## 10 A pixel burst when a source is finished

- **Adds:** finishing a source sets off a short burst of square pixels in the skill's colour, once.
- **Why:** priority 3 (delight). Risk: D23. It marks a source done, never a count or a streak.
- **From:** Magic UI `confetti` (MIT), drawn as squares.

## Looked at, left out

- **Already built:** Bounce, Hook and Proximity sidebar, Rail TOC, Toast, Animated counter, Web Search, Gooey
  nav (the segmented control).
- **Against a rule:** GitHub activity (streaks, D23); Delete button (Ore undoes instead of confirming); Task list
  (reorders under him); Emoji reaction and Notification bell (nothing he learns from).
- **No place in Ore:** OTP and Password input, Duration picker (no timer), FAQ thread, Grid reveal (no AI images),
  Code block (code in sources already renders), Gravity letters and Fluid orb (decoration).
- **Motion on 100-times-a-day actions:** text scramble, typewriter and roll on the Review answer (Magic UI
  `hyper-text`, Cult UI `typewriter`, Motion Primitives `text-roll`).
