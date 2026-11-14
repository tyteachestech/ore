# Signature style

The current brief for Ore's look (thread "Find Ore's signature terminal style", 2026-11-07; built as D129). DESIGN.md holds the tokens and component specs; this page keeps the why and what is still open. Update it at each of Tyler's picks.

## Tyler's brief
Learning is anxiety-inducing, so the app feels calm, delightful and satisfying, and also cool and advanced, a feeling of progressing (hence the terminal vibe). Source the look from the best real products, never guesses.

## Picked (2026-11-07)
- North stars: **opencode** (clean, calm: "what this app should be"), **Railway** (pixel art imbued in the screen, never distracting), **Charm** (playful only; no 3D).
- Ground: true neutral greys, softer than opencode: ground `#1b1b1b`, raised `#232323`, text `#e4e4e2`. No blue or purple cast.
- Saturation only on intents, skills and gems, in pastels: key point `#dcc070`, card `#82bde6`, question `#b59aec`, apply `#79d6b2`. No coral or red-orange.
- Picked highlight type: a neutral grey key (option B), integrated, never a big pill or an underline.
- Type: Geist stays; OpenTUI Mono (OFL) for mono; Charter for a source's text.
- Icons: MingCute's weight drawn on a 16 pixel grid (hand-cleaned); replaces Pixelarticons (D105 as amended by D129). Generators: `/mnt/project-files/signature-style/build/` (emit.py writes `icons.tsx` and `PixelIcon.tsx`).
- One icon set (Tyler, 2026-11-07, pixel only 2026-11-09, D157): every icon in the app is a 16-grid pixel MingCute sprite, never a smooth one or an emoji beside it. Skill icons too: `scripts/pixel-skill-icons.ts` redraws the curated set in `src/skill-icon-set.ts` into `src/skill-icons.json` (eroded before sampling so holes stay open; thin shapes drawn plain), hand fixes in `src/skill-icon-fixes.ts` win; every icon checked at 4× before joining.
- Icons (Tyler's pick E of six sets, 2026-11-08, after the panel tabs A and the popup E): every sprite's pixels are round dots, Nothing's glyphs, a quarter bigger than asked (20px for 16, 40px at 24 and up; 16 in a chip), centred by their ink, with a 0.38 dot (D170, D171). Never in a box that cuts them; round ones share `Circle`'s outline, because a circle with long flat sides reads as cut off. `style-check.ts` (pixel icon) and `test/round-icons.test.ts` fail otherwise.
- Big numbers in the mono; Geist Pixel retired. Labels in sentence case.
- Wordmark: A "ore_" in Poppins ExtraBold Italic with a green cursor underscore.
- App icon (D221, Tyler 2026-11-12): a plain pickaxe in halftone dots, white fading to gray, on the dark tile; Mac and iPhone. `apps/desktop/scripts/app-icon.ts`.
- Railway touch: B Rail + stations (Home week as stations; Review's track and its cart went with D246, and the cart's run is now on the end screen, D190). The dot grid was dropped: no purpose.
- Popup closing animation: A Settle (popup lifts away, margin mark pops in three pixel steps, the passage glows once).
- Dropped: cute (too Duolingo), 3D pressed keys, 8bitcn.

## Picked (2026-11-10, D183)
- One way of drawing, round dots (Tyler's pick B of four on the real app): gems are halftone dots (dot size is the shade), rings are one dot per step, Home's week days are round, and a screen's one hero number is Geist Pixel Circle at 40px. Square pixels left the app (D184), except a cut gem, whose dots fuse into pixels (D236).
- House laws he said yes to (2026-11-10): mining lives in moments and nouns, never in the app's frame; two moods of motion (everyday actions fast with no bounce, a playful spring only on a few named moments, the mole's springs (D214) and a highlight landing (D240), and celebrations matter); juice follows success and stays on screen as the record; every sound has a visual twin. The mole may animate as long as it costs no performance and doesn't distract. Consult: https://claude.ai/artifact/5byfzYUCuVvgkQeGKTUAL2.

## Picked (2026-11-10, D184)
- The squares that were left (Tyler's pick B of three on the real app): bars are rows of dots, Review's track has a round dot per exercise and a cart drawn in dots, and corners are soft (rows 8, controls 6, chips 4, floating things 12, a rounded skill badge). Not picked: dots with square corners (still two styles), full pills for the main button and chips (a generic app look). Mocks: `/mnt/project-files/house-style/squares-round-1/`.

## Picked (2026-11-10, D185)
- Motion is "Glide" (Tyler's pick B of three, felt on a clickable page): everyday moves 100/150/200/300ms on one ease-out with no bounce, the spring and 600ms kept for moments, dots lighting 16ms apart. Not picked: Crisp (no spring anywhere, celebrations barely there), Bounce (a spring on everything). Page: `/mnt/project-files/house-style/motion-round-1/index.html`.

## Picked (2026-11-10, D186)
- The mole's chat (Tyler's pick C of three, then place 2 of three): replies in speech bubbles, one mole peeking over the field that wonders while it writes, the newest bubble's stair tail pointing at it, a blinking block where words are about to appear. Not picked: a mono terminal, a game dialogue box, a mole on every reply, beside the newest reply or in the header.

## Picked (2026-11-10, D190)
- The first signature moment (Tyler's pick B of three, played on a copy of the real end screen): a finished session lands with the cart rolling in and tipping its ore into the ring, rough stones dropping to be cut, the mole coming up after. Not picked: Light up (today, tuned), Mole strike. The sketch moved in straight lines and he called it amateur; the build draws the cart in dots with turning wheels and throws the ore on real arcs. Lesson: sketch the idea, but say it is a sketch before he sees it.

## Picked (2026-11-14, D263)
- The radio's playing button is a named motion, the lamp: amber dots breathing in place with the real sound, grey and still when off. It means "running right now". More places for it are Tyler's call, one at a time.
- Brand guidelines: `docs/design/brand.md` is the one page; the browsable version with live components (https://claude.ai/artifact/NotsGBRDucobyz6q4vfNn4) is rebuilt from the app's code by `apps/desktop/scripts/design-system/build.ts`, replacing the hand-drawn kit of 2026-11-07.

## Open
- Redraw Hand, ThumbsDown, Paperclip, Compass.
- A Rive trial; sound.
- A mascot later; sound after the look.

## Built
2026-11-08, PR #114: segmented control for the side panel tabs (A) and the highlight popup's types (E); dot icons (E). Process: `/mnt/project-files/board/` (board.md, one round folder per element). Home and the skill page layouts stayed as they were (Tyler, after seeing them at a year's scale). Module rounds followed: the skill page's reading list is Reader's with a question mark for sources that may answer an open question (D130, `toread-round-1/`); its Questions are one-line rows with a purple Answered circle (D131, `questions-round-1/`); its warm-up is one quiet line with a bordered Start (D132, `note-round-1/`).
D129 (amends D101 and D105): palette, OpenTUI Mono, sentence case, pixel MingCute icons and the grey-key popup (PR #84); Settle in its own PR.
