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
- Wordmark: A "ore_" in Poppins ExtraBold Italic with a green cursor underscore; the app icon (Mac and iPhone).
- Railway touch: B Rail + stations (Review steps as track with an ore cart; Home week as stations). The dot grid was dropped: no purpose.
- Popup closing animation: A Settle (popup lifts away, margin mark pops in three pixel steps, the passage glows once).
- Dropped: cute (too Duolingo), 3D pressed keys, 8bitcn.

## Open
- Redraw Hand, ThumbsDown, Paperclip, Compass.
- A Rive trial; sound.
- A mascot later; sound after the look.

## Built
2026-11-08, PR #114: segmented control for the side panel tabs (A) and the highlight popup's types (E); dot icons (E). Process: `/mnt/project-files/board/` (board.md, one round folder per element). Home and the skill page layouts stayed as they were (Tyler, after seeing them at a year's scale). Module rounds followed: the skill page's reading list is Reader's with a question mark for sources that may answer an open question (D130, `toread-round-1/`); its Questions are one-line rows with a purple Answered circle (D131, `questions-round-1/`); its warm-up is one quiet line with a bordered Start (D132, `note-round-1/`).
D129 (amends D101 and D105): palette, OpenTUI Mono, sentence case, pixel MingCute icons and the grey-key popup (PR #84); Settle in its own PR.
