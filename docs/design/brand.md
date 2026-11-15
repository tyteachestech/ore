# Ore

Ore is a calm place to learn anything: read, highlight, answer, remember. It is dark and quiet, and it has one signature: what it draws, it draws in round dots.

This page is the short version, for people and for agents making something in Ore's name (a screen, a deck, a video, a mock). The full spec, with every token and component, is [`DESIGN.md`](../../DESIGN.md); the look's history is [`signature-style.md`](signature-style.md). Where they differ, `DESIGN.md` and the code win.

## Feel

Learning makes people anxious, so Ore is calm first. Then satisfying, and a little advanced, like a well-made terminal tool. Premium here means restraint and precision, never decoration.

## Voice

- Plain words. Say what happened and what to do next.
- Sentence case everywhere. A label is four words at most.
- Never cheer for nothing: no streaks, XP, badges or scores. A reward marks today's real progress and stays on screen as the record.
- Mining lives in nouns and moments (ore, gems, cut, the cart, the mole), never in the app's frame.
- What review brings back is an **exercise**. A highlight marked with the gem is a **Key point**.

## Eight rules

1. **One level of boxes.** A section is a label over a hairline. Never a box in a box.
2. **Round dots are the signature.** Icons, gems, rings, bars, small marks, a screen's one hero number and the mole. Words and controls stay smooth. Only a cut gem has square pixels: its dots have fused.
3. **Three voices of type.** Geist for the interface, OpenTUI Mono for labels and numbers, Charter for a source's own text and nothing else.
4. **Colour means something.** See the table below. Never a colour for decoration.
5. **One main action per view**, in `paper` white.
6. **Spacing in steps of 2px**, and edges that line up across columns.
7. **Flat.** No glow, grain or gradient on the page, and only what floats has a shadow. Two exceptions: the lamp glows, and a key pressed to answer has a lip.
8. **Nothing decorative.** Every element is something he needs to see or do to learn.

## Dots

A dot drawing sits on a grid, one round dot per cell, the dot's radius 0.38 of a cell. Icons are drawn on a 16 grid and shown at 20px. A ring is one dot per step (14, 20 or 30 dots by size); an unlit dot is smaller and one step lighter than the ground. Off the app (a slide, a video), keep the same grid and scale the whole drawing up: never smooth it, never redraw it finer.

## Colour

| Colour | Means | Token |
| --- | --- | --- |
| Neutral greys, `paper` white | the interface; `paper` is also the main button and what is selected | `bg`, `text`, `muted`, `faint`, `paper` |
| Gold, blue, purple, green | a highlight, a Key point, a question, a try | `keep-solid`, `card-solid`, `question-solid`, `apply-solid` |
| Eight pastels | a skill | `c-red` to `c-pink` |
| Green | progress, and a right answer | `c-green` |
| Red | an error, and a wrong answer | `error`, `c-red` |
| Red, orange, green, blue | the four ratings: Again, Hard, Good, Easy | `c-red`, `c-orange`, `c-green`, `c-blue` |
| Orange | a match Find has found | `c-orange` |
| Amber | running right now (the lamp) | `lamp` |
| Rim gold | a memory won back | `seam` |

## Type

| Face | For |
| --- | --- |
| Geist | the interface, 13px |
| OpenTUI Mono | labels, metadata, numbers; the main button |
| Geist Pixel Circle | a screen's one hero number (the figure it is there to show), 40px, never under 24px; the end screen's results may set three |
| Charter | a source's text, 17px |
| System font | his own notes |

## Motion

Three moods. Everyday moves are quick and calm (100 to 300ms, ease-out, no bounce). A few moments celebrate real progress and may take 600ms and a spring. A few small marks move in hard steps, like a terminal: the sidebar arrow, the waiting matrix, a rolling number. Keys and anything done a hundred times a day don't move at all. Reduce Motion stills everything.

Three motions have names:

| Name | Says | How | Where |
| --- | --- | --- | --- |
| **The lamp** | this is running right now | dots turn amber and breathe in place with the real signal; grey and still when off | the radio playing, Listen reading aloud, the mole's helmet while the tutor writes |
| **The glint** | you earned this | one light crosses a dot drawing, once | the goal ring, a result number |
| **The spring** | a moment | 600ms with a little overshoot | a gem cut, the cart, the mole |

## The mole

The tutor is a miner mole with a lamp on his helmet: one traced drawing at every size. He reacts to what just happened and then rests. He never nags, and a miss gets a set jaw, never a sad face.

## Sound

Every sound has a visual twin. The ambience radio (Cave, Rain, Lamp, Deep mine, Focus) is off until asked for.

## The mark

The app icon is a pickaxe in white-to-grey halftone dots on the dark tile. Where the name is written it is a plain "Ore" in Geist beside the icon: there is no wordmark.
