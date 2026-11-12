# Use Ore's iPhone app like a person, in the iOS Simulator

You are testing the iPhone app of Ore, a learning app: you read sources, highlight, take notes, and
review exercises with spaced repetition. Use it the way a real person does, with your fingers on the
screen, and report every place where a person would get stuck, confused, misled or lose work.
Do not change any source code. Only write the report and its screenshots.

## How you touch the phone

The real app is installed and running in the iOS Simulator (iPhone 18 Pro, 402 × 874 points) with a
scratch library. A driver turns your commands into real touches (XCUITest) and saves a screenshot
after every action. Run from the repo root:

```bash
bun apps/phone/scripts/sim.ts tap X Y             # X Y in points from the top left
bun apps/phone/scripts/sim.ts longpress X Y [SECS]
bun apps/phone/scripts/sim.ts swipe X Y X2 Y2 [SECS]   # a flick (scroll, swipe a row, edge swipe from x=2)
bun apps/phone/scripts/sim.ts drag X Y X2 Y2      # press and hold first, then move (select text, move things)
bun apps/phone/scripts/sim.ts type "some text"    # into whatever field has focus
bun apps/phone/scripts/sim.ts key return|delete
bun apps/phone/scripts/sim.ts tree                # every element with its label and frame, in /tmp/ore-sim/tree.txt
bun apps/phone/scripts/sim.ts shot                # a screenshot without acting
bun apps/phone/scripts/sim.ts launch              # quit and relaunch the app (data kept)
bun apps/phone/scripts/sim.ts home | activate     # leave the app, come back
bun apps/phone/scripts/sim.ts reset               # delete the app and its data: a first launch
```

Each prints JSON with `shot`, a 3× PNG of the screen (pixels / 3 = points). **Look at the screenshot
after every action** (open the image) before you decide the next one, as a person looks at the
screen. Use `tree` to find exact frames; tree frames can be offset while the drawer is open, so check
the screenshot. If a command says the driver did not answer, run `bun apps/phone/scripts/sim.ts start`.
Never touch `~/Ore` or anything under iCloud. Don't run `start --lib`.

## What exists on the phone

- Today: review ring, Start review, Continue reading, skills grouped by collection.
- Drawer (top-left icon or swipe in from the left edge): Today, Sources, Archive, skills.
- Search (magnifier, or pull down at the top of a list): sources by title and text, skills, actions.
- Source rows: swipe left archives (Undo in the toast), swipe right moves To read ⇄ Done,
  long-press (about half a second) opens a menu. In Archive, swipe left restores.
- A source: Back and ⋯ on top, a bottom bar that hides as you scroll down and returns on scroll up,
  select text to highlight (actions appear at once), a note page (swipe from the right edge), find in
  source, Finish at the end and in ⋯.
- A skill: its sources and a note that opens full screen.
- Review: answer, rate, finish, go again. AI grading isn't on the phone: it should say so, not fail.
- Not built yet, don't report: adding sources on the phone, AI features, sync (the library is a copy
  built into the app).

## Who you are

Play these four people in turn, each with a goal, the way they would really use a phone: one hand,
quick taps, not reading instructions. Stay in character for what you try; switch to a careful tester
only to reproduce what went wrong.

1. **Maya, on the bus, 10 minutes.** Do today's review, then keep reading what she was reading. She
   highlights two passages she likes, writes a short note on one, and finishes the source.
2. **Sam, tidying up.** Finds a source by a word from its middle, moves sources between To read and
   Done, archives two by swiping, undoes one, restores the other from Archive, opens a skill and
   writes its note.
3. **Priya, interrupted.** Starts a review, leaves the app halfway (home), comes back, then quits the
   app (launch) in the middle of reading and a note. Does she land where she was, with nothing lost?
4. **Rex, clumsy thumbs.** Mis-taps near edges, half swipes that should spring back, mostly vertical
   swipes on rows (should scroll), double taps, long text and emoji in notes and answers, the
   keyboard covering things, rotating the phone, tapping fast twice on buttons.

## What counts as a finding

Anything a person would notice: a tap that does nothing or does the wrong thing, a target too small
or too close to another, something hidden under the keyboard, notch or home bar, text cut off or
overlapping, a screen with no way back, lost text or lost place, a confusing word or state, an error
or raw id shown to the person, a gesture that works differently from Apple's own apps (Books, Notes,
Mail), slowness you can feel, an animation that jumps.

## Report

Write `docs/reviews/2026-11-12-codex-phone/report.md` and copy the screenshots it cites into
`docs/reviews/2026-11-12-codex-phone/shots/` with short names.

1. Summary: the findings in order of how much they hurt a person, one line each.
2. Each finding: title; severity (blocker / major / minor / polish); who hit it; screen; the exact
   commands to reproduce it; what you expected (and what Apple's app does) vs what happened; the
   screenshot; whether it happened again on a second try. Only report what you saw on screen.
3. Each person: what they did, what worked, what was hardest, in two or three sentences.
4. What you could not test and why.
