# Ore

Ore is a calm place to learn anything: read, highlight, answer, remember. It is dark and quiet, and it has one signature: what it draws, it draws in round dots.

This page is the short version, for people and for agents making something in Ore's name (a screen, a deck, a video, a mock). The full spec, with every token and component, is [`DESIGN.md`](../../DESIGN.md); the look's history is [`signature-style.md`](signature-style.md). Where they differ, `DESIGN.md` and the code win.

## Feel

Learning makes people anxious, so Ore is calm first. Then satisfying, and a little advanced, like a well-made terminal tool. Premium here means restraint and precision, never decoration.

| Borrowed from | What |
| --- | --- |
| opencode | the calm base: neutral greys, mono labels |
| Nothing OS | dots where they carry character |
| Railway | pixel art woven into the screen, never in the way |
| Charm | play, in small doses |

## Voice

- Plain words. Say what happened and what to do next.
- Sentence case everywhere. A label is four words at most.
- Never cheer for nothing: no streaks, XP, badges or scores. A reward marks today's real progress and stays on screen as the record.
- Mining lives in nouns and moments (ore, gems, cut, the cart, the mole), never in the app's frame.
- What review brings back is an **exercise**. A highlight marked with the gem is a **Key point**.

## Eight rules

1. **One level of boxes.** A section is a label over a hairline. Never a box in a box.
2. **Round dots are the signature.** Icons, gems, rings, bars, a screen's one hero number and the mole. Words and controls stay smooth. Only a cut gem has square pixels: its dots have fused.
3. **Three voices of type.** Geist for the interface, OpenTUI Mono for labels and numbers, Charter for what he reads.
4. **Colour means something.** See the table below. Never a colour for decoration.
5. **One main action per view**, in `paper` white.
6. **A 4px grid**, and edges that line up across columns.
7. **Flat.** No glow, grain or gradient on the page. Only what floats has a shadow.
8. **Nothing decorative.** Every element is something he needs to see or do to learn.

## Colour

| Colour | Means | Token |
| --- | --- | --- |
| Neutral greys, `paper` white | the interface | `bg`, `text`, `muted`, `faint`, `paper` |
| Gold, blue, purple, green | a highlight, a Key point, a question, a try | `keep-solid`, `card-solid`, `question-solid`, `apply-solid` |
| Eight pastels | a skill | `c-red` to `c-pink` |
| Green | progress | `c-green` |
| Amber | running right now (the lamp) | `lamp` |
| Rim gold | a memory won back | `seam` |

## Type

| Face | For |
| --- | --- |
| Geist | the interface, 13px |
| OpenTUI Mono | labels, metadata, numbers; the main button |
| Geist Pixel Circle | a screen's one hero number, 40px, never under 24px |
| Charter | a source's text, 17px |
| System font | his own notes |

## Motion

Two moods. Everyday moves are quick and calm (100 to 300ms, ease-out, no bounce). A few moments celebrate real progress and may take 600ms and a spring. Keys and anything done a hundred times a day don't move at all. Reduce Motion stills everything.

Three motions have names:

| Name | Says | How | Where |
| --- | --- | --- | --- |
| **The lamp** | this is running right now | dots turn amber and breathe in place with the real signal; grey and still when off | the radio playing, Listen reading aloud, the mole's helmet while the tutor writes |
| **The glint** | you earned this | one light crosses a dot drawing, once | the goal ring, a result number |
| **The spring** | a moment | 600ms with a little overshoot | a gem cut, the cart, the mole |

Dots only ever swell and brighten where they stand. Nothing drawn in dots slides, spins or blurs.

## The mole

The tutor is a miner mole with a lamp on his helmet: one traced drawing at every size. He reacts to what just happened and then rests. He never nags, and a miss gets a set jaw, never a sad face.

## Sound

Every sound has a visual twin. The ambience radio (Cave, Rain, Lamp, Deep mine, Focus) is off until asked for.

## The mark

The app icon is a pickaxe in white-to-grey halftone dots on the dark tile. The wordmark is "ore_" in Poppins ExtraBold Italic with a green underscore, used only where the name is written.

## Formats

`DESIGN.md` is laid out in the open DESIGN.md format (tokens as YAML on top, rules below), whose own tool converts it to W3C design tokens (`npx @google/design.md export --format dtcg DESIGN.md`) for any tool that wants those. The browsable version of this page, with live components, is built from the app's own code by `bun apps/desktop/scripts/design-system/build.ts <folder>`.
