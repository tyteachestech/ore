# The cart ending, built from nothing in Rive

A comparison test, not part of the app. Built blind from `/mnt/project-files/cart-rive/briefing.md`: the end
screen's own cart animation, its clips and its pull requests were not opened. Nothing under `apps/` or
`packages/` is changed. Tyler compares this with the app's version and decides.

## What is here

- `gen.mjs` writes the whole Rive file as text (`rive/scene.rml`, Rive's markup): the mole from Ore's own
  traced dots (`apps/desktop/src/mole-fine-data.ts`), a body, belly and feet drawn for this, the cart, the ore,
  the rig, seven timelines, a state machine and a view model. No Rive editor was opened and no scripts are used.
- `stage/` is the page it plays on: a stand-in end screen, 1280 by 800, that owns the ring, the gem place, the
  results, Done and the mole's line.
- `film.sh` makes the clip and frame sheet (`shoot.sh`, `key.py`, `rec.mjs`).

Run: `node gen.mjs`, then `rive rive --verify` (Rive CLI 1.9.2).

## How it works

- **Dots.** Every dot is one Rive ellipse, grouped by colour (3,557 ellipses in 150 shapes). Parts hide what is
  behind them with a copy of their dots in the page colour, slightly larger.
- **Rig.** Mole > bob > squash > breath > head (eyes, helmet, moustache halves, nose), arms, body, feet. Each
  part turns on its own pivot; the helmet, moustache, belly and limbs are keyed late so they lag and settle.
- **Riding the cart.** A constraint pins the mole to a seat inside the bucket, so he tips and slides with it;
  its strength is keyed to 0 when the cart leaves him in the air.
- **Ore.** Each piece is blended from its place in the heap to a target node whose x and y are bound to numbers
  the page sets (`ore0x`, `ore0y` … `ore29x`, `ore29y`, `stone0x` …). The target's aim point falls at a steady
  rate while the blend runs, which gives an exact parabola with one gravity for every piece.
- **How much ore.** `ore` and `stones` are view model numbers. Pieces past the count are hidden through a
  converter; the pour's length is picked by the state machine from five states at different speeds.
- **Hand-over.** The file fires `land`, `stoneLand`, `knock`, `settled` and `speak`. The page lights its own ring
  dot under each landing piece, moves the ring on the knock, and shows the line on `speak`.
- **Never blocks.** The canvas takes no pointer events. With Reduce Motion the page shows the resting frame.

## Findings

**Easy in Rive**
- A real rig. Squash, a head that turns, a helmet that arrives late, a moustache that flutters: each is a few
  keys on a named part, and they layer without touching each other.
- Riding, sliding and being left behind are constraints with a keyed strength, not code.
- Data in, events out. The page gives counts and places and hears about landings; the split of who owns what
  is clean.
- Writing the file as text worked: the CLI checks it in under a second and renders any frame without a browser.

**Hard in Rive**
- The dot look is carried by brute force. Rive has no "draw this shape as dots": a mask or shader over a smooth
  rig would need Rive's scripting, which this build avoids. So the dots are rigid parts that move, turn and
  scale. They leave the grid when a part turns, go oval under squash, and never change size where parts overlap
  the way a halftone would.
- Anything that varies in number. Thirty ore pieces means thirty copies of the timeline, and a state's speed
  cannot be bound to data, so "longer pour with more ore" is five states. The file reports 30 landings whatever
  the count; the page ignores the extras.
- Keys set absolute values, so every keyed part needs a wrapper node for its resting place, and one timeline
  cannot be reused at another position.
- The text has to be generated: the scene is 437 KB of markup from a 570-line script. Nobody edits it by hand,
  and it is not something to tweak in the Rive editor and merge back.
- A `.riv` file cannot be written without signing in to a Rive account, even for a project with no scripts.
- The CLI's batch capture (`--commands`) returned blank frames after the first few on this Linux machine, so the
  film is one CLI run per frame.

**Did the dot look survive?** At rest and in slow moves, yes: it is the same traced mole, dot for dot, and at
Retina size the dots are round. In fast turns the grid swims, because the dots turn with the part. That is the
honest difference from a renderer that re-samples a pose onto a fixed grid.

**Size.** Rive's web runtime 2.40.1 (MIT): `@rive-app/canvas-lite` is 1.16 MB (396 KB gzipped: 84 KB script,
312 KB wasm); the full `@rive-app/canvas` is 2.22 MB (836 KB gzipped). The scene itself is about 124 KB as Rive
builds it in memory; the published file's size is not known yet.

**Not checked yet**
- The scene in the web runtime. Everything shown is Rive's own headless renderer from the CLI, with the page's
  cues worked out from the timeline. `stage/stage.js` has the runtime path written (bind the view model, listen
  for events) but it has never run, because there is no `.riv` until Tyler signs in. Whether the small runtime
  supports this file's data binding is part of that.
- Whether the free plan adds a splash or watermark to the published file.
- Counts other than twelve ore and one stone were not filmed.

**What it would take to put it in the app**
1. Sign in, publish the `.riv`, confirm it plays in the web runtime in WKWebView on the Mac and the iPhone.
2. Add the runtime (lazy-loaded on the end screen; about 400 KB gzipped) and the `.riv` to the bundle.
3. A small React wrapper: set the counts and the ring's dot positions, pass events to the ring, gems and the
   speech box, skip mounting under Reduce Motion, unmount at `settled` and show the app's own mole.
4. Decide who owns the mole. Here he is a second drawing of the same dots; the app's mole would have to match
   him at the hand-over frame, or move into Rive everywhere.

## Where the blind test leaked

Two things reached this thread before the build: a shared memory note listing what the technique thread found
weak and what it added (squash and stretch, a lagging helmet, 14 dirt dots, a ring knock, a cart hop), and one
truncated line of `docs/DECISIONS.md` describing the cart ending. No clip, frame, code or pull request was
opened. The dirt count and the lagging helmet here may owe something to that note.
