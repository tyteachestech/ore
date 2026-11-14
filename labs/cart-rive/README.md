# The cart ending, built from nothing in Rive

A comparison test, not part of the app. Built blind from `/mnt/project-files/cart-rive/briefing.md`: the end
screen's own cart animation, its clips and its pull requests were not opened. Nothing under `apps/` or
`packages/` is changed. Tyler compares this with the app's version and decides.

## Second pass (Tyler, 2026-11-13)

After the first clip Tyler asked for cleaner arms and body, the nap on his back with a nose bubble, a slow slide
off the bucket, and a wide-eyed wake right before a comic fall. Changes: a stouter body and real arms (the
traced paws are now shown only in the hole); a nose bubble that swells and shrinks with his breath and pops to
wake him; the cart stops so the lip leaves him right over his hole; he creeps while the ore pours and slides off
as the stones drop; then a long stare, a scramble on nothing, a look down, a look at us, and a drop feet first
with his arms and helmet a beat behind. This departs from the briefing's head-first dive.

## Third pass (Tyler, 2026-11-13)

"He needs to be on his back while on the cart", "stout", "overalls are good". He now has a second drawing, a
side view flat on his back: round belly up, overalls with a strap and button, helmet with its lamp, nose and
bubble pointing up, feet in the air. It is used for the ride, the slide and the float; when the bubble pops the
scene cuts to the front view (now also in overalls). On the tipped bucket he sinks onto the rim as the load
leaves, slides off feet first, hangs tilted until the bucket has swung home and the cart is leaving, then
settles level in the air. Checked beat by beat that the bucket never passes through him.

Two drawings and a cut is the cheap way. A rig that turns from side view to front view is a bigger job in any tool.

## What is here

- `gen.mjs` writes the whole Rive file as text (`rive/scene.rml`, Rive's markup): the mole from Ore's own
  traced dots (`apps/desktop/src/mole-fine-data.ts`), a body, belly and feet drawn for this, the cart, the ore,
  the rig, seven timelines, a state machine and a view model. No Rive editor was opened and no scripts are used.
- `stage/` is the page it plays on: a stand-in end screen, 1280 by 800, that owns the ring, the gem place, the
  results, Done and the mole's line.
- `rive/build/cart-ending.riv` is the published file. `node rec.mjs out/live "runtime=vendor/lite/"` records it
  in the web runtime (put `rive.js` and `rive.wasm` from `@rive-app/canvas-lite@2.40.1` in `stage/vendor/lite/`).
- `film.sh` makes the same clip from Rive's headless renderer instead (`shoot.sh`, `key.py`, `rec.mjs`).

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
- Recording the web runtime frame by frame needed the page to own the clock (`&manual`, `cart.step`).
- The CLI's batch capture (`--commands`) returned blank frames after the first few on this Linux machine, so the
  film is one CLI run per frame.

**Did the dot look survive?** At rest and in slow moves, yes: it is the same traced mole, dot for dot, and at
Retina size the dots are round. In fast turns the grid swims, because the dots turn with the part. That is the
honest difference from a renderer that re-samples a pose onto a fixed grid.

**Size.** Rive's web runtime 2.40.1 (MIT): `@rive-app/canvas-lite` is 1.16 MB (396 KB gzipped: 84 KB script,
312 KB wasm); the full `@rive-app/canvas` is 2.22 MB (836 KB gzipped). The scene itself is about 124 KB as Rive
builds it in memory, and the published `.riv` is 123 KB.

**Checked in the web runtime.** The published `rive/build/cart-ending.riv` (123 KB) plays on the stage page in
the small runtime (`canvas-lite`) in Chromium: the counts and places are set through the view model, the
constraints hold, and the ring, gem and speech box are driven by the file's events. The clip is recorded from
that. No splash or watermark is drawn on it (account on the Cadet plan).

**Not checked yet**
- WKWebView on the Mac and the iPhone.
- Counts other than twelve ore and one stone were not filmed.

**What it would take to put it in the app**
1. Confirm the `.riv` plays in WKWebView on the Mac and the iPhone (Chromium is checked).
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

## Fourth pass (2026-11-14)

Tyler's comparison: Rive's motion is better, the code version's still side view is better, and neither should
lift him much before he drops into his spot.

- Side view: his real traced head, turned on its side and facing us, on a deeper belly-up body in overalls.
- The rise is cut: he drifts up 14 px while he hangs (was more), the wake lifts him 8 px, and the pop out of
  the hole overshoots by 5 px.
- He stops 10 px higher on the tipped bucket (`SLIDE = 36`), so his feet clear the dirt line while he is tilted.

Clip: `cart-rive-v4.mp4`, frames `cart-rive-v4-frames.png`, both recorded from the published file in the web runtime.

## Fifth pass (2026-11-14): the blind test is over

Tyler: keep Rive's motion, use the code version as the baseline look. The scene now draws the mole as the app does.

- Asleep: the app's own side view (`sideDots` in `apps/desktop/src/mole-fine.ts`, from the cart-technique branch), carved
  into parts (head, helmet, lobe, arm, belly, feet) so each can move; shown at 0.55 size on the cart, as the app shows him small.
- Awake: the app's whole body (torso, belly, legs with flat feet, arms from the shoulder), full size, growing in as he wakes.
  No overalls: that was this lab's own design.
- The paw shadows on his chest show only with the paws, as in the app.
- He wakes with his soles 8 px over the dirt, rises 8 px in the scramble, then drops.

Clip: `cart-rive-v5.mp4`, frames `cart-rive-v5-frames.png`.

## Sixth to ninth pass (2026-11-14): a critic before every clip

Rule since Tyler's "why is it not caught proactively": no clip goes to him until a fresh critic, given only frame
sheets beside the code version's, has listed every defect and they are fixed. Four critics ran on these passes.

What changed, against the code version as the baseline:
- He lies in the bucket, drawn behind the cart (as the app does), centred on the load.
- The side view keeps every part whole (no hole at the back of his head), one shade, its own profile helmet, a shorter brim.
- Ore slides to the low lip and falls from it from rest, behind the cart; each ring dot lights as its piece lands.
- The stones are rough gems in their colours: they slide to the lip with the last of the load and drop into the ring.
- No brake sparks, no post on the rail; the rail stops where the dirt of his hole begins.
- Waking, he grows once, over 0.4 s, soles still, to the size he is in his hole. No rise before the drop.
- At rest the whole traced drawing shows (it was cut 5 dots short, which hid his paws), with clods of dirt banked round the hole.
- The Zs are the app's Z on a 4 by 4 grid.

Left as is, on purpose: ore for the ring's left half passes behind the front wheel; the side-to-front swap is a cut on the bubble's pop, as in the code version.
