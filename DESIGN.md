---
name: Ore desktop
description: Dark, Raycast-style shell around a calm Notion-style reading column.
colors:
  ground: "#1b1b1b"  # opencode's neutral ramp, a step softer (D129): no blue or violet cast
  sidebar: "#1b1b1b"
  card: "#1b1b1b"  # cards are hairline frames, no fill (D101)
  raised: "#232323"
  hover: "#262626"
  selected: "#2f2f2f"
  hairline: "#2f2f2f"
  text: "#e4e4e2"
  paper: "#e4e4e2"  # flat light buttons and inverted Review picks (D101)
  text-read: "#cfcfcc"
  muted: "#a2a2a0"
  faint: "#8c8c8a"
  accent: "#e4e4e2"  # focus and links stay neutral (D129)
  error: "#ff7b7b"
  intent-keep: "#dcc070"  # pastel intents (D129)
  intent-card: "#82bde6"
  intent-question: "#b59aec"
  intent-research: "#79d6b2"  # research results on a question (D75); no longer a highlight type (D91)
typography:
  ui:
    fontFamily: "Geist, -apple-system, sans-serif"  # labels and big numbers: OpenTUI Mono, sentence case (D129)
    fontSize: 13px
    lineHeight: 1.45
  reading:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, sans-serif"
    fontSize: 17px
    lineHeight: 1.65
  label:
    fontFamily: "OpenTUI Mono, Geist Mono"  # opencode's mono (Iosevka build, OFL); Geist Mono fills missing glyphs
    fontSize: 12px
    use: "sentence-case section and card labels, 0.06em tracking; metadata at 11px; big numbers (strength, goal)"
  doc-title:
    fontSize: 30px
    fontWeight: 700
  # The whole ramp (px), one entry per step so `impeccable detect` checks against it. Anything else is drift.
  caption:
    fontSize: 11px
    use: "kicker, mono metadata and counts"
  meta:
    fontSize: 12px
    use: "meta, small UI, mono section labels"
  secondary:
    fontSize: 14px
    use: "secondary body"
  heading:
    fontSize: 15px
    use: "list and nav headings"
  glyph:
    fontSize: 16px
    use: "glyphs"
  dialog-title:
    fontSize: 20px
    use: "dialog title"
  number:
    fontSize: 24px
    use: "big numbers"
  page-title:
    fontSize: 28px
    use: "page title"
  hero-number:
    fontFamily: "Geist Pixel Circle, OpenTUI Mono"  # the dot face (OFL), D183
    fontSize: 40px
    use: "a screen's one hero number: today's minutes on Home, a skill's cut gems. Never below 24px"
rounded:
  hairline: 2px
  chip: 4px
  control: 6px
  row: 8px
  card: 10px
  panel: 12px
  sheet: 14px
  pill: 999px
spacing:
  gap: 8px
  row: 40px
  titlebar: 38px
  sidebar: 216px
  measure: 60ch
---

# Design System: Ore desktop

The source of truth is `apps/desktop/src/styles.css`, with the Terminal look (D101) layered on top in `retro.css`. Every colour and size is a token on `:root`.

**Direction in progress:** the look is being re-picked; read `docs/design/signature-style.md` before any style work. This file describes what is built today.

## Overview

There are two modes in one window:

- **Operate** (Home, review, sources list, ⌘K palette, add panel). Raycast: dense rows, a quiet sidebar, shortcuts shown on hover through `Hint`, and no chrome. Panel footers keep their `kbd` hints.
- **Read** (reader, prequestions, finish). Notion: one 60ch column (about 70 characters of Charter), 17px text, nothing moving behind the text.

Two choices are intentional:

- **Fonts.** Geist for the interface, OpenTUI Mono (OFL) in sentence case for labels and numbers (D129), Geist Pixel Circle (OFL) for a screen's one hero number (D183); a source's text reads in Charter, the book serif that ships with macOS (Tyler 2026-11-07, Matter and Apple Books); notes and review passages stay in the system font (SF Pro). No other web font.
- **Dark.** No light theme; the one exception is the optional light reading page (D26), which lightens only the source pane.

## Style rules

The look is "quiet terminal": a calm, modern Mac app with one dot-matrix signature. Premium here means restraint and precision, not decoration. These rules hold on every new screen; `style-check` and `impeccable detect` (see the end) catch the ones a machine can.

1. **One level of boxes.** A page section is a mono label over a 1px `hairline` rule, set apart by space (36px between sections), never framed. Nothing inside a section is boxed either: a prompt, a callout or an empty state is a line of text with its action. Only things that float (menus, popovers, panels, toasts, the highlight popup) or that he picks and drags (rows, tiles, chips) get an edge or a fill; what he writes in a note (callouts, diagrams) is his content, not chrome. A box inside a box is always wrong.
2. **The dot layer is a signature, not a theme, and it is one way of drawing: round dots** (D183, Tyler's pick B, 2026-11-10; before it gems, rings and the week were square pixels beside dot icons). Dots appear only where they carry meaning: icons, gems, rings, the week's days and a screen's one hero number. Sentences, body text and controls stay smooth.
   - **Icons**: UI icons from `icons.tsx` (pixel MingCute on a 16 grid, D105 as amended by D129), highlight-type and section icons from `PixelIcon.tsx`; every sprite pixel is a round dot (Tyler's pick E, 2026-11-08; radius 0.38 of a cell, `src/dots.ts`), a quarter bigger than asked: 20px for 16, 40px at 24 and up (16px inside an 18px chip), each drawing centred by its ink, a sidebar icon's middle on its label's capitals (D170, D171).
   - **Gems** (`Gem.tsx`) are halftone: one dot per cell in the skill's colour, its size the shade (highlight 0.5 of a cell, light 0.44, mid 0.36, shade 0.25), a crack a line of missing dots, an empty slot an outline of small dots. A 10×8 drawing below 22px, 14×11 from there up.
   - **Rings** (`DotRing` in `Ring.tsx`) are one dot per step: 14 dots up to 36px, 20 up to 60px, 30 above. A lit dot is full size in the ring's colour (green for the goal, the skill's colour for a level), today's would-be dots are dimmer, the track sits one step above the ground. Any progress lights one dot; only a finished ring lights them all.
   - **The hero number** is set in Geist Pixel Circle at 40px. A dot face is unreadable small, so counts in rows stay in the mono.
   - **Bars** (`DotBar` in `Ring.tsx`, D184) are a row of whole dots lit by the ring's rule: 4px dots 2px apart, the track at 0.65 size one step above the ground, lit ones full size (`paper` for how far he has read, green for a session). 10 dots on a Home reading row, 12 under a list thumbnail, 60 6px dots across a long Review session.
   - **Corners are soft** (D184): round dots sit in round-cornered things. Rows 8, buttons and fields 6, chips 4, menus, panels and sheets 12, passages and answers in Review 10, the skill badge 10, the level chip a pill. No square corner on anything he clicks.
3. **Three voices of type.** Geist for what he reads in the interface, OpenTUI Mono in sentence case for labels and metadata (four words at most; never a sentence), Charter for a source's text and the system font for his own writing. Sizes come from the ramp in the frontmatter only.
4. **Colour means something.** Neutral ink and `paper` white carry the interface. A hue appears only as an intent (highlight gold, key point blue, question purple, try green), a skill, progress green, or the accent for focus and links. Never a colour for decoration. The one exception is his own writing: in a note he may colour text or highlight it in the skill palette (Notion's colours, Tyler 2026-11-06), saved as `<span data-color>` / `<mark>` so the file stays readable elsewhere.
5. **One primary action per view.** It is the flat `paper` button in mono caps. Everything else is a ghost control or an icon button.
6. **Align to a 4px grid, and line up across columns.** Section heads in side-by-side columns share one baseline and one rule height; text edges line up with the rule's start.
7. **Flat.** No glow, grain, gradient or shadow on the page. A floating layer gets one hairline and `--float`.
8. **Nothing decorative** (the purpose rule): no count, pill, tagline or icon that he doesn't need to see or do something.

**How a new screen or look gets made.** Name the app being copied and the reference for the look (claude.dev, Geist, Linear, Playdate). Before building anything larger than a fix, mock two or three options as a CSS override on the mock app (`scripts/mock/ab.ts`), shoot them at 2× with 4× crops, and let Tyler pick. Then build the pick, run `bun apps/desktop/scripts/mock/style-check.ts` (nested frames, off-ramp text) and `.claude/skills/impeccable/scripts/impeccable detect apps/desktop/src --no-advisory` (off-token colours, radii, fonts) and add no new findings, then run Impeccable's `critique` on the screen for anything the scripts can't see.

## Colors

- **Neutrals.** A warm neutral black ramp (D101): `ground` (also the sidebar and card), `raised`, `hover` and `selected`. Selection and hover change the background, never the border.
- **Depth.** Raised things get a 1px top highlight (`--lift`: cards, the selected sidebar row, the selected segment); floating things (panels, popovers, popup, toast) get `--float`, the highlight plus a layered shadow. No glow, grain or gradient borders.
- **Text levels.** There are three: `text`, `muted` (secondary) and `faint` (hints, metadata, placeholders). `faint` stays at or above 4.5:1 on `ground`, `sidebar` and `raised`; on hover and selected rows, counts and metadata step up to `muted`.
- **Accent.** One accent (`accent`). It is used only for focus, links, the caret and text selection.
- **Intent colours.** These are the only other hues. They paint highlights as a tint (Keep a warm gold, since plain yellow at low alpha goes olive on the dark page), colour each intent icon in the popup, and fill the active intent. Highlighted text is always full-contrast `text`, even in a playing transcript's dimmed part.
- **Progress green** (`--c-green`). It marks progress: the goal ring, the session bar, rubric ticks and the finish verdict. It is never a link or focus colour.
- **Skill colours** (`--c-*`). These tint a skill's icon, chip, tile and its selected sidebar row, never text on their own.

## Typography

- **UI** is 13px. List and nav headings are 15px/600. The document title is 30px/700.
- **Reading text** is 17px/1.6 Charter with headings at 650 weight.
- Numbers in counts and dates use tabular figures.

## Layout

The shell has these parts:

- A fixed 38px titlebar band, which is the drag region.
- A 216px sidebar: 28px rows, section headers in sentence case as he typed them (never all caps), muted pixel nav icons (`icons.tsx`; selection shows on the row, never a filled icon). Skill icons sit bare at 15px with `text-read` names (Dia, Notion), and the open skill's row is tinted with its colour (`--skill` 24% over `sidebar`), as Dia tints a space; never a tile or ring behind a sidebar icon.
- A main pane:
  - **Lists** use 40px rows.
  - **The reader** centres the measure.
  - **Reader shortcut hints** sit in the titlebar band so they stay put while the text scrolls.

## Components

- **Rows.** The `.row` background shows hover; `.on` marks the selected row: neutral grey `selected`, and while the list has keyboard focus a 1px white (28%) inset edge, never the accent. The list owns focus and manages the active row through `aria-activedescendant`.
- **Panels.** The palette and add panel are centred near the top. Each holds one input with focus kept inside it, and Esc closes. Their footer shows `kbd` hints.
- **Highlight popup.** Three switches on the highlight, ★ Key point, Question and Try it (D127, green, a checked box: a technique to try on his own work), each with its pixel icon (`PixelIcon.tsx`, 16-grid dot sprites drawn at 20px: a highlighter tip for a plain highlight, a star for a key point, a question mark), key point in blue (D124), question in purple, try in green. The types are one segmented control (shadcn Tabs, Tyler's pick E of five, 2026-11-08; the side panel's tabs match): a 32px `bg` track with a 1px `border` edge and 8px corners, each type 12px/500 `faint` with its icon in its colour, the one that is on a 24px `bg-hover` pill with `--lift` and a 1px drop shadow (never an underline or a coloured fill); its hover says what it does with its 2–4 shortcut (D118). The margin shows the star, the question mark and the checked box; the Collected tab and its pill use all four. The note field below them, full width (typing anywhere while the popup is open writes into it, D133), whose placeholder fits the type (D126: "Note…" for a plain highlight, open to any thought; "This works because…" for a key point; "My question… my guess:"; "I'll try this on…" for a try, the where and when of an implementation intention). The popup is a `raised` sheet with 10px corners and a 1px `border` edge; the note field has no frame. At the right, a thin column of muted 24×20 icon tools: Copy with source, Remove text, Remove highlight last; Play from here (videos) and Explain (one word) in a second column beside it, so the popup never grows taller (D112). On the phone the tools run in a row under the note. It opens where the selection ended: under the last line, centred on where the mouse let go; above the first line after an upward drag; never over the passage (D112).
- **Look Up panel (D83).** Replaces the popup in its place, same surface: the word 15px semibold, its pronunciation muted 12px on the same line (both truncate), the entry 13px `--text-read` in a 168px scroll area, then a ghost Make card button whose card icon lines up with the text edge. The looked-up word is underlined like the active highlight. Icon-only popup buttons (Look up, Remove) are 26px squares.
- **Figure zoom (D143).** A source's figure shows `zoom-in` on hover (a linked one, `pointer`). A click grows it to the window less 24px, drawn at that size so it stays sharp, with its 6px corners: 300ms strong ease-in-out from its place as the page behind fades to `bg` (ease-out). The open figure shows `zoom-out`; no button. A click or a scroll shrinks it back the same way; Esc puts it back at once (keys don't animate); reduced motion cuts both.
- **Listen bar (D85).** A raised pill in the reader tools, left of ⋯: pause/play, the video's speed pill without its outline, stop; 26px round `.ctl`s. The spoken sentence: 2px accent underline, 5px offset.
- **Source lists: skill page and All sources** (D130, Tyler's pick B of five, 2026-11-08; All sources too, D135). Rows are Readwise Reader's: a 96×54 picture (`.thumb`, 16:9, the kind's icon on `bg-hover` when there is none), the title at 500, line two the author (`faint`, 12px) and the other skills as pills, line three the kind as an 11px mono uppercase `faint` label; 70px minimum, 12px gap. A source that may answer an open question shows a bare question mark (`QuestionMark`, 20px dot sprite) in `question-solid` at the row's right, vertically centred, before the ⋯; its hint lists the questions, one a line, each led by a purple "?". Nothing else is added to the row: no counts, no sort line.
- **Reader side panel** (D75, D99; segmented 2026-11-08, Tyler's pick A of five shadcn and Origin UI structures). A segmented control on the panel's head (shadcn Tabs): a 32px `bg-raised` track with a 1px `border` edge and 8px corners, 3px inset; Source note and Collected each carry an icon and tone (NotePencil `keep-solid`, Stack `card-solid`, 12px; at 55% opacity when not selected) at 13px/500 `faint`, and the open tab is a 26px `bg-hover` pill with `--lift` and a 1px drop shadow. Hover only lifts the text to `text`. No sheet: the note or the collected list sits on the panel's ground with 20px side padding. N and Q switch tabs. It opens and closes from a toggle at the window's top right that mirrors the sidebar's (SidebarRight, 16px, `faint`, `bg-hover` on hover, ⌥⌘S); an accent dot on it says a source note waits while the panel is shut. No close button in the panel: the toggle is the one way out.
- **Tutor button** (D160, D168, D169, after Notion AI's bubble). A 52px round button at the bottom right (16px in from both edges), `bg-raised` with `--float`, `bg-hover` on hover, scale 0.96 pressed; its hint is "Tutor ⌘J", to its left. Inside, the mole (D169): its head and two paws over a row of dirt, round dots of one size on a 22×18 grid at 40px, the dirt low in the button. Tones: fur `faint`, muzzle `faint` into `text-read`, its middle `text-read`, paws and eye glints `text`, eyes black (dots a little bigger so each eye reads as one shape, the glint top right), the nose pink `#f096ac` (its one colour), dirt `faint` half into `bg-raised`. Every move shifts whole dots, never off the grid: it comes out of its hole once a launch (three steps up, a one-dot overshoot, a blink); at rest it blinks every 5 to 9 s and glances a column every 15 to 20 s; while a reply is written with the tutor closed it looks up and taps a paw; when the reply lands it hops with arc eyes (a jolt with wide eyes for an error); hover or focus makes it face him and blink. Still under reduced motion (a mood shows its main pose). At the end of a Review session (not the quick quiz) the same mole, 64px wide with no button, stands just above the ring and cheers once (paws waving on four beats, then arc eyes), then rests. Hidden while the tutor or a quiz panel is open. Scrolling lists and columns keep `--mole-room` (84px) at their foot so their last line clears it.
- **Mole's chat** (D186, `Tutor.tsx`). A reply is a `bg-active` bubble, radius 12, padding 9px 12px, up to 92% wide, text `text-read`; chips inside it (citation pills, Sources, code) sit 9% of `text` above its fill. His message is outlined (1px `border` inset, radius 12, `muted` text), right-aligned. Only the newest reply has a tail: a 9px stair of 3px steps under its left end, pointing down at the mole. The mole (36px wide, no button, `aria-hidden`) stands on the field's top edge 12px in from the left, with the chips for what the chat is pointed at beside it; it looks up and taps a paw while a reply is written, hops when one lands, jolts for an error. The block: 0.55em × 1.05em in `text`, on for half of each second in one step (a caret, so it keeps its own time), after the waiting line and the streaming reply's last line, and at the start of the empty field when it has focus (`faint` and still without focus; the system caret returns once he types). Still under reduced motion.
- **Chat Stop and Copy** (D187). Stop takes the send button's place while a reply is written: the same 26px circle in `bg-active`, the Stop sprite in `text`, 14% of `text` over it on hover, hint "Stop ⌘." above. Copy is a 26px icon button in the gap right of a reply's bubble, at its foot: `faint`, `text` on `bg-hover` on hover, shown on the newest reply and on hover or focus for older ones; it shows a check for 1.5 s after copying. A stopped reply ends with the "Stopped" label (as "Not from your sources"); one with no words reads "Stopped." in `muted` with an underlined Try again.
- **Chat attachments and starters** (D189). Attach is a 26px icon button (the paperclip) left of send: `faint`, `text` on `bg-hover` on hover; the field keeps 68px clear at its right for both. A file being attached is a chat chip (22px, `bg-active`, radius 6) beside the mole: a 16px kind icon (picture, PDF, page), its name truncated, a ×. Sent, files sit right-aligned over his message: a picture as a thumbnail up to 160×120, radius 8, 1px `border`; anything else as the same chip without ×. Starters in an empty chat are menu rows (28px, radius 6, `muted`, `text` on `bg-hover`), each a 20px icon then the words, stacked above the mole.

- **Cart tip** (D190, `CartTip.tsx`). The end screen's one moment. The cart is 60px wide: round dots on a 20-wide grid at 3px a cell, rim `text`, body 62% `text` on `bg` with shade by dot size, two 5-dot wheels that turn with the roll; its load is ring dots (8px, `c-green`) under up to three 18px rough gems in their skills' colours. It rides a 2px `bg-active` rail 2px over the ring, enters from the window's left edge in `t-moment` on `ease-out`, tips 58° about its front foot in `t-4` on `ease-spring`, pours for at most 600ms (a dot every 18 to 60ms), rights itself in `t-4` and leaves by the right edge on `ease-in-out` (`t-moment` over twice the distance, so it crosses the edge at speed). Ore and stones fall under gravity (2600px/s² after a 90px/s hop), so a far dot takes longer than a near one; a landing lights its ring dot from scale 1.55. The mole's place stays empty until the cart leaves, then it rises and cheers. Never plays with nothing to tip, in the quick quiz, on the phone or under Reduce Motion.
- **Mole says** (D159, after Cult UI's speech bubble). A reply that lands while the tutor is closed: a `bg-raised` bubble with `--float`, radius 12, 78px in from the right and 24px up, so its tail (a 9×15 stair of 3px steps in `bg-raised`) points at the mole's middle. Up to 280px wide, 13px system text in `text-read`, three lines then an ellipsis. The text is one button (opens the tutor, "Open the tutor ⌘J" hint above); a 20px × at the top right shows on hover or focus. Enters once: 200ms ease-out from 6px right and 0.96 scale, origin at the tail; none under reduced motion. Hidden with the mole.
- **Collected tab** (D99). Groups Cards, Questions, Keeps as Linear's collapsible group headers: caret, the type's filled icon in its tone, an 11px `faint` mono label; the header's + (Card here on Cards, Ask on Questions) shows on hover or focus. Rows are one line, truncated with an ellipsis, 30px tall, `bg-hover` on hover, the spoken time in `faint` tabular figures at the right on a video. A line he typed is `text`; a passage's own words are `muted`. Keeps start collapsed and show their count only while collapsed. The Card here field is a `bg-raised` row with a 1px `border` edge and the focus ring; Enter adds, Esc drops, a blur keeps it open with what he typed.
- **Finish scope** (D100). Under the recall field, one quiet 36px `field` line, placeholder "Leave anything out? Like “the coding part”", shown only when the source has questions; the recall's sub line says "Everything up to 15:05" on a partway finish. Source rows: a 2px `accent` bar on `bg-active`, 4px under the thumbnail, the thumbnail's width, only while reading.
- **Review quotes** (D99). A Card here card's passage box shows one quote at a time between bare ◂ ▸ caret buttons (24px, `muted`, `bg-hover` on hover, 30% at either end); the quote keeps two lines of height so flipping never moves the rating row. The caption leads with the spoken time in tabular figures.
- **Find** (D81, ⌘F in a source). The Claude app's find bar: a floating raised bar at the top right of the source, field, `n/N` count (tabular, "Not found" in `faint`), ↑ ↓ and ×, each with its key on hover. One list over the source then the side panel, left to right. Matches are orange at low alpha, the current one solid orange with dark text, like the quiz's "In the source" passages; never an intent tint. No motion.
- **File drop** (ChatGPT's "Add anything"). While files are dragged over the window the main pane dims (the sidebar stays lit; its skills are targets too) and three tilted 54–62px source tiles rise and fan out, the front one in `accent` showing the kind being dragged (PDF, book, note, web page), the back ones accent mixed with white; then "Add to" the target skill at 22px/650 and one muted line. A file Ore can't read turns the tiles grey with a red ✕ and says which types it reads. Rise 300ms, fan 300ms, slight overshoot; fades out in 150ms; under reduced motion only the dim fades.
- **Prequestions.** An unboxed strip at the top of the column, closed off by a hairline; a chevron toggles it. Each question is a row (Perplexity "Related") that stays visible as something to read for; only the one he is on opens an answer line. Enter stores it and opens the next unanswered one, `?` on an empty line is "no idea", Esc closes it. An answered row shows a tick and his answer.
- **Reading for chip** (D179, `Reader.tsx` ReadingFor). In the reader's top bar, left of the collected chips and built as one (`collected-chip`): "Reading for N", 13px `muted`, `bg-hover` and `text` on hover or while its card is open, 2px `focus` ring. Its hover card sits 6px under it, 340px wide: `raised` fill, 1px `hairline` edge, 10px radius, `float`; each question 14px `text`, his guess under it 12px `muted`, clamped to three lines; scrolls past 420px. No motion. Hidden in a window under 860px, where the bar has no room; ⌘K still goes to the block.
- **Source note.** A second pane beside the source (D44), with the note editor (D38); the divider drags from 280px to 60% of the window. Below 1100px wide, an open note hides the sidebar (its hover peek still works, ⌘\ brings it back) so the column keeps its measure.
- **Skill tags** (Settings → General → Skills, and ⌘K). "Icon and name" (default) or "Icon only": the chip keeps its colour and icon, the name hides visually (still read by VoiceOver) and shows on hover.
- **Settings** (⌘,). A large sheet over the app, as ChatGPT's settings: the app stays visible in a margin of up to 96px (an inch) on every side under a 50% black scrim, and a click there or Esc closes it (× at the top left, "Close Esc" on hover). The sheet is `ground` with a 1px `hairline` edge, 12px corners, `--float`. Inside: the sections list on the left, and on the right each group is a mono label over a hairline rule with its rows on the page between hairlines, never a card; the shortcut list follows the same pattern. A choice of a few (reading width, reading page, skill tags, style) is the side panel's segmented control: the 32px `bg-raised` track, the chosen option a 24px `bg-hover` pill with `--lift` (D135). No motion: it opens from a key.
- **Diagram** (D40, D103, D175). A sheet centred over the window, as Notion's centre peek: the window's shape with 15% of it showing on every side under Settings' 50% black scrim; the page colour inside, 12px corners, `--float`, no edge. Its 40px head over a `border` rule holds the name (mono, renames in place), an Expand/Collapse corners icon (16px, `muted`, `bg-hover` on hover, ⇧⌘↵) for the full window and back, and Done. A press on the scrim, Esc or Done saves and closes. Under 720px wide the tools bar drops Map's and Matrix's labels. No motion. The phone has only the full window.
- **Home** (D58). Today on top in one band as tall as the ring (goal ring, due count, plan and week; Start review and the gear centred on the right), then two columns split by the skill page's drag bar (⅔ | ⅓ by default, remembered, double-click resets; one column under 1000px or when either side is empty): Continue reading on the left, Skills by collection on the right, one row each (badge and name left, gem and number right). Each section is a 12px mono label over a hairline rule, as on the skill page; nothing on Home is framed (2026-10-31, option C).
- **What to review** (D80). A small centred panel: one row per skill with cards due, most due first (checkbox, icon, name, "N cards ready" muted), then Start review with its ↵. The checkbox is Duolingo's: a rounded box with a 2px lip, filled green with a dark bold check when on, a muted outline when off. The whole row toggles on one click or Space; ↑↓ move, ↵ or ⌘R start, Esc closes.
- **Skill page questions** (D131, Tyler's pick A of five with E's circle, 2026-11-08). One row per question, a 1px `hairline` between rows: a 16px circle (`.q-check`, 1.5px `question-solid` edge, `question` fill on hover; done: no edge, a 12px dot-sprite check in `question-solid`, the try's pop) at the left, 28px column; then the question at 14px `text`, one line with an ellipsis, and its source at 12px `faint` under it; a done question is struck. A source that may answer it is an 8px `question-solid` square at the top right (`.q-lead`, in a 20px hit area, `bg-hover` on hover); its hint lists the sources one a line. The row's hint carries the passage. Hover actions (Answer, Begin research, ⋯) float at the bottom right.
- **Skill page sections** (Your note, To read, Questions). Not cards: each is a 12px mono `muted` label led by its 12px two-tone pixel icon from `PixelIcon.tsx` (notepad in `keep-solid`, open book in `card-solid`, question mark in `question-solid`), with its + at the right, over a 1px `hairline` rule; 14px to the content, 36px between sections; the heads of both columns share one height so their rules line up. The warm-up ("What do you already know about…?", D132) is one 14px/500 `muted` line, 16px under the head, with a 26px bordered Start (`.warm-start`: 1px `border`, 6px radius, 12px/500 `text`, `bg-hover` on hover) at its right; no band, no ⓘ, the why in Start's hint. The reader's Source note and Collected tabs use the notepad and a stack of cards. Your note's + is Notion's: a new line at the end with the / menu open; Esc on the untouched "/" takes the line back out.
- **Terminal look** (D101, `retro.css`). A soft neutral black (D129); Home and the skill page are open pages: sections are a label over a rule, never framed; soft corners (D184: rows 8, controls 6, chips 4, menus and panels 12); section and card titles in 12px OpenTUI Mono `muted`, sentence case, with no icon; metadata and counts in 11px mono; primary buttons flat `paper` with ink mono; big numbers in the mono; rings and bars drawn in dots (D183, D184). A selected list row is `selected` with a 2px `paper` bar on its left edge; in Review the picked sure-button and the suggested rating invert to `paper` with ink text on a 3px lip. A source's text is Charter; notes and review passages stay in the system font. The skill badge is a matte tile (skill colour 26% on `ground`) with 10px corners and no outline; keyboard focus is the 2px `focus` ring.
- **Sidebar cursor** (D113, `SideCursor.tsx`). A 3×5 arrow of 2px `paper` cells in the sidebar's 8px left gutter, centred on the open row; `muted` inside a source, hidden while rows drag. After a click in the sidebar it hops in five 28ms frames (eased, snapped to 2px, one 4px frame past the row); keys and reduced motion move it at once. The reader's outline uses the same arrow beside the current heading's line, which is `paper`; lines already passed are `faint`, the rest `hairline`; the arrow hops as the current heading changes and hides while the outline panel is open.
- **Toasts** (D113, `Toast.tsx`). Up to three stack at the foot of the window, all as wide as the widest, the newest in front; older ones show only a 6px top edge. Hovering fans them out a full height and 8px apart in three hard frames (84ms); leaving snaps them back. Each keeps its own Undo or Redo, which acts on its own step (Linear). A long step's toast has the dot matrix (work) and turns into its result in place: a green pixel check, or a red cross for an error.
- **Skill fan** (D154, `Home.tsx` SkillTile). A hover card 6px under the tile, as wide as it (min 210px): `raised` fill, 1px `hairline` edge, 10px radius, `lift`, 6px padding; rows are 12px `text` one-liners with ellipsis, 6px 8px padding, 6px radius, `bg-hover` on hover. Rows arrive from under the tile 30ms apart, 150ms ease-out; none under reduced motion.
- **Pixel burst** (D153, `Burst.tsx`). From the finished badge's edge (36px) out to 72px and 92px: 14 4px dots in `--skill` (the skill's intent colour; `c-green` when none), the far ring 60ms later, after the badge's 220ms pop, `steps(6)` over 600ms, fading to 0. Once, on mount; none under reduced motion.
- **Action sheet** (D155, `Menu.tsx` ActionSheet, phone). A ⋯ menu as the phone bottom sheet: full width, 16px top radius, grab handle, 44px `pick-row` rows in 16px `text` (`error` for a destructive one), a 1px `hairline` separator 6px above a new group, a `faint` caret at the right of a row that steps in; the submenu step opens with a 36px back row (caret left, the submenu's name in 14px `muted`), then its rows with a 14px tick column (`accent` check) and the skill's icon; the sheet's height eases 300ms ease-out between steps, nothing under reduced motion.
- **Reading pill** (D152, `Outline.tsx` ReadingPill, phone). Centred 10px above the safe area at the foot of the page: 28px tall, 14px radius, `bg` fill, 1px `hairline` edge, 6px left padding, 10px right; a 16px ring (r 6, 2px stroke, track `hairline`, fill `text`) and the section name in 12px `muted`, one line, ellipsis, at most 70% of the width; the name fades in 150ms when it changes. Its sheet is the phone bottom sheet: full width, 16px top radius, grab handle, 44px rows, the current section's name in `accent`.
- **Reading previews** (D151, `Settings.tsx` Previews). Settings › Reading page and Reading font: 64×44 cards 8px apart, 1px `hairline` edge, 6px radius, the label in 11px `faint` (`text` when picked or hovered) 6px under; the picked card a 2px `focus` ring in place of its edge. The page card is the page's own colour with three 2px `muted` lines; the font card sets 20px "Aa" in the face on `bg`. Arrows move and pick (Radix RadioGroup).
- **Step track** (D150, `Tutor.tsx` Steps). Above a worked answer's steps: 4px-tall marks 4px apart, 1px radius; hidden steps 4px `hairline` dots, shown steps 12px `muted` marks (`text` on hover), the current step a 24px `text` bar. Width eases 150ms on Next step; none under reduced motion. Focus ring 2px `focus` at 3px.
- **Review timeline** (D149, `Timeline.tsx`). Above the ratings at the check step: a `hairline` 1px line, 8px round dots in the rating's intent colour (`--c-red/orange/green/blue`) centred on it at their time to scale, and the next review as a hollow dot (2px inset ring in the rating's colour on `bg`). 22px above, 14px to the ratings. Hover tips name a dot. No motion.
- **Working line** (D113, D146, `Working.tsx`). A wait's label in its own colour with a 14px dot matrix before it on the midline: 5×5 cells of 2px a pixel apart, lit in the label's colour, trailing cells at 40% of it, the unlit grid at 12% so the mark keeps its square. Its pattern is the stage's, in hard frames (read: a line down the rows, 160ms; search: a radar arm, 110ms; write: typed cells, 90ms; check: the pixel check drawing itself, 120ms; work: two cells round the edge, 100ms); still on the stage's telling frame under reduced motion. No light sweep.
- **Wordmark and app icon** (D129). "ore" in Poppins ExtraBold Italic `text`, then "_" in progress green, centred on a `raised`-to-`ground` gradient tile with a 1px `#333` edge (macOS 824/1024 body; the iPhone icon is the full-bleed square). Only on the icon, About and the Dock: no screen shows the name. Sources: `/mnt/project-files/signature-style/wordmark/`.
- **Rail** (D129, Tyler's pick B of three, 2026-11-07, after Railway; drawn in dots by D184). Review's steps (30 exercises or fewer) are a 2px track with an 8px round dot at each exercise: one step above `selected` ahead, green where he has been, `text` on the one he is on, and a 20px ore cart (the 16-grid sprite, each cell a dot) in `text` riding above it; it jumps to the next when he rates, never animated. Over 30 exercises it is a dot bar. Home's week is the same track with a 12px round dot per day: green when met, a 2px `selected` outline otherwise, `muted` outline today, `hairline` outline on a day off.
- **Settle** (D129, Tyler's pick A of three, 2026-11-07). When the highlight popup closes on a highlight he gave a type or a note, by Esc, a click away or a key: the popup lifts 6px and fades in 140ms ease-out (an inert copy, so the next selection or key never waits), the highlight's margin mark pops 0.6 → 1.25 → 1 in three hard frames (180ms), and the passage glows once in its tint (an overlay over its lines, opacity only, 420ms). A plain highlight with no note, a dropped selection and Remove just close. None under reduced motion.
- **Rolling numbers** (D113, `Roll.tsx`). Home's goal minutes and the solid-gem counts on Home and the skill page roll when they change: each changed digit slides out and its new digit in, up when the number grows, in four hard frames (112ms), clipped to its slot. A number remembers what it last showed for the life of the window, so one that changed on another screen rolls when he comes back; never on its first showing, never under reduced motion.
- **Gems** (D90). A skill's strength: cut gems for solid memories, rough stones for growing cards, a glow on one whose next Good review makes it solid, dull grey for one to win back. Halftone dot sprites drawn in `Gem.tsx` (D183, style rule 2). Numbers and "Lv N" only; words live in the hover hint.
- **Review** (D59). One card centred in the measure, a segmented session bar, a `kbd` footer; the passage opens at the right only after the answer. Hovering or focusing a key point he got underlines the words of his answer that earned it (D141): `text` colour, a 2px progress-green underline 3px below the baseline, no fill; nothing is underlined until he points at a point.
- **Chapter sign** (D115). "Recall this chapter" with the pixel `Signpost`, 12px mono caps `faint`, hover `bg-hover` + `muted`, centred in the gap after a chapter's last block, inside the column. An overlay on the page, never inside `.doc`. The block it opens: a `##` heading and placeholder lines in `faint` (`.ghost`), feedback under the note behind a hairline (`.chapter-fb`).
- **Fields.** Filled inset (darker than their surface) with a faint hairline that brightens on hover; focus is the accent border plus a soft halo (`--halo`), never an outline ring as well.
- **Answer buttons.** Every button he answers with ("how sure", ratings) is the same pressed-lip button: a 3px lip it drops into when pressed (Duolingo).
- **Switch.** Compact, green when on, thumb on a slight spring; iOS proportions on iPhone.
- **Callouts** in the note editor are a raised box with a hairline border and a muted kind label, as in Notion. No coloured side stripe.
- **Hints** open on hover, and on focus only after Tab, so a field focused by code never covers its own label.

## Motion

One system, two moods (D185, Tyler's pick B "Glide" of three, 2026-11-10). The tokens live at the top of `styles.css`; `test/motion.test.ts` fails a stylesheet speed of 400ms or less, or a curve, that is not one of them.

| Token | Value | For |
| --- | --- | --- |
| `--t-1` | 100ms | a press, a hover |
| `--t-2` | 150ms | a small move: tabs, chips, carets |
| `--t-3` | 200ms | what opens: menus, toasts, popups |
| `--t-4` | 300ms | what slides in: panels, sheets |
| `--t-moment` | 600ms | a moment |
| `--stagger` | 16ms | between the dots of a ring or bar as they light |
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | the default: anything entering or leaving |
| `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | something already on screen moving or growing |
| `--ease-spring` | `cubic-bezier(0.34, 1.4, 0.64, 1)` | moments only |

- **Everyday** moves are quick and calm: `--t-1` to `--t-4` with `--ease-out`, never a bounce. A menu, a tab, a toast, a switch and a panel all belong here.
- **Moments** are the few places the app celebrates real progress: a ring filling, a gem cut, a try or a question ticked, a finished session. They may take `--t-moment` and the spring, with dots lighting a `--stagger` apart. A moment that was drawn by hand and runs longer than 400ms (Settle, the ring's burst, the pixel burst) keeps its own time, as do stepped pixel frames (the mole, the working line) and endless loops.
- **Nothing** moves for a keyboard-driven action or one done a hundred times a day: arrows through a list, rating an exercise, the cart on Review's track, ⌘K.
- Under Reduce Motion everything appears in place.

## Do's and Don'ts

### Do

- Show a control's shortcut on hover with `<Hint keys=…>`; `kbd` only in panel footers and the review footer.
- Use motion for real progress (D62), from the motion tokens only (D185, see Motion below): transform and opacity, none under `prefers-reduced-motion`.
- Keep focus visible (`:focus-visible`) and return focus when a panel closes.
- Respect `prefers-reduced-motion`.
- Suppress rubber-band scrolling.

### Don't

- Add XP, badges, hard-reset streaks, leaderboards, reading-speed metrics or a session score (D62). Progress shows only as the goal ring, the session bar, the reader's position bar (or its outline, when the source has headings) and a skill's gems (D90).
- Add standing explanatory copy; put it in a hover hint or an ⓘ.
- Use `transition: all`.
- Add a second accent colour.
