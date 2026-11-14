# Cart ending: code or Rive

A blind A/B of the two builds of the session-end cart, played live on the device it is opened on. Nothing here is
part of the app.

- **Page:** https://claude.ai/artifact/QJvoC1EDwngqxRxD1fUPaS (private to Tyler). A and B are drawn at random per
  visit; the labels show only after a pick. Each play measures every frame's gap for 8 s from the moment the
  ending starts, and saves it, with the device, to the page's own store (`runs`, `picks`).
- **Build:** `./build.sh <checkout of the code branch> <checkout of the Rive lab branch>` writes `out/`. The code
  version is the app's own `EndScreen` (`lab-cart.tsx`, built as a second Vite entry inside `apps/desktop`, then
  removed), on a session that lights the ring's last 12 dots and cuts one gem, with the mole riding asleep (the
  nap ending). The Rive version is `labs/cart-rive/stage` with its published `.riv`, played by
  `@rive-app/canvas-lite@2.40.1`.
- **Made fair:** both screens are cut to the same 760 by 560 window with the ring in the same place, on the same
  ground colour. Still different: the Rive stage is a stand-in end screen (its own results row and mole size).

Hosting changes to the Rive copy only: artifacts serve no `.riv`, so the file goes as base64 JSON and the stage
passes Rive the bytes (`buffer`) instead of a URL.

## Weight (gzipped)

| | Added to the app |
|---|---|
| Code | `CartTip.tsx`, about 5 KB minified (26 KB of source) |
| Rive | runtime 396 KB (84 KB script, 312 KB wasm) + `cart-ending.riv` 27 KB (123 KB raw) + a wrapper still to write |

## One tweak in each: the mole slides off 30% slower

`tweak/` holds both diffs.

- **Code** (`code-slide-30.diff`, 11 lines): the slide lasted until the bucket dropped back, which was keyed to
  the last stone landing, so slowing it meant moving every beat after it (bucket back, cart leaving, his wake) to a
  new anchor. Done in one pass; typecheck and the end-screen tests pass. Ore and stones land on time.
- **Rive** (`rive-slide-30.diff`, 3 lines in `gen.mjs`): the slide is the Pour state, so its speed is one
  number. The first try clashed with an existing `SLIDE` name. After `node gen.mjs` the `.riv` still has to be
  rebuilt with the Rive CLI signed in to Tyler's Rive account, which only the Rive thread's machine has, and the
  lab does not write that step down. So the tweak could not be played here. It also delays the stones, which drop
  in the next state.
