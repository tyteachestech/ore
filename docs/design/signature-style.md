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
- Big numbers in the mono; Geist Pixel retired. Labels in sentence case.
- Popup closing animation: A Settle (popup lifts away, margin mark pops in three pixel steps, the passage glows once).
- Dropped: cute (too Duolingo), 3D pressed keys, 8bitcn.

## Open
- Redraw Hand, ThumbsDown, Paperclip, Compass.
- Railway touches on Home and Review (dot grid, progress track); the Charm-style wordmark experiment; a Rive trial.
- A mascot later; sound after the look.

## Built
D129 (amends D101 and D105): palette, OpenTUI Mono, sentence case, pixel MingCute icons and the grey-key popup (PR #84); Settle in its own PR.
