---
name: Ore desktop
description: Dark, Raycast-style shell around a calm Notion-style reading column.
colors:
  ground: "#141413"
  sidebar: "#141413"
  card: "#141413"  # cards are hairline frames, no fill (D101)
  raised: "#1c1c1b"
  hover: "#262626"
  selected: "#303030"
  hairline: "#2b2b29"
  text: "#f2f1ec"
  paper: "#f2f1ec"  # flat white buttons and inverted Review picks (D101)
  text-read: "#d9d8d2"
  muted: "#a3a29c"
  faint: "#8c8b85"
  accent: "#8ea6ff"
  error: "#ff7b7b"
  intent-keep: "#e8c24a"
  intent-card: "#6aa8f7"
  intent-question: "#b98af5"
  intent-research: "#5fcf8a"  # research results on a question (D75); no longer a highlight type (D91)
typography:
  ui:
    fontFamily: "Geist, -apple-system, sans-serif"  # labels: Geist Mono caps; big numbers: Geist Pixel (D101)
    fontSize: 13px
    lineHeight: 1.45
  reading:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, sans-serif"
    fontSize: 17px
    lineHeight: 1.65
  label:
    fontFamily: "Geist Mono"
    fontSize: 12px
    use: "uppercase section and card labels, 0.06em tracking; metadata at 11px"
  pixel:
    fontFamily: "Geist Pixel"
    use: "big numbers only (strength, goal); never words"
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
  measure: 66ch
---

# Design System: Ore desktop

The source of truth is `apps/desktop/src/styles.css`, with the Terminal look (D101) layered on top in `retro.css`. Every colour and size is a token on `:root`.

## Overview

There are two modes in one window:

- **Operate** (Home, review, sources list, ⌘K palette, add panel). Raycast: dense rows, a quiet sidebar, shortcuts shown on hover through `Hint`, and no chrome. Panel footers keep their `kbd` hints.
- **Read** (reader, prequestions, finish). Notion: one 66ch column, 17px text, nothing moving behind the text.

Two choices are intentional:

- **Fonts.** Geist for the interface, Geist Mono caps for labels, Geist Pixel for big numbers (D101); reading text, notes and review passages stay in the system font (SF Pro). No other web font.
- **Dark.** No light theme; the one exception is the optional light reading page (D26), which lightens only the source pane.

## Style rules

The look is "quiet terminal": a calm, modern Mac app with one 8-bit signature. Premium here means restraint and precision, not decoration. These rules hold on every new screen; `style-check` and `impeccable detect` (see the end) catch the ones a machine can.

1. **One level of boxes.** A page section is a mono label over a 1px `hairline` rule, set apart by space (36px between sections), never framed. Nothing inside a section is boxed either: a prompt, a callout or an empty state is a line of text with its action. Only things that float (menus, popovers, panels, toasts, the highlight popup) or that he picks and drags (rows, tiles, chips) get an edge or a fill; what he writes in a note (callouts, diagrams) is his content, not chrome. A box inside a box is always wrong.
2. **The pixel layer is a signature, not a theme.** 8-bit appears only where it carries meaning: big numbers (Geist Pixel), gems, icons (UI icons from `icons.tsx`, D105; highlight-type and section icons from `PixelIcon.tsx`), the skill badge's stepped corners, segmented rings and dithered progress bars. Sentences, body text and controls stay smooth. Pixel art is drawn with crisp edges at sizes its grid survives on a 2× screen: `PixelIcon`'s 12-grid at 12 or 18px, `icons.tsx`'s 24-grid snapped to 12, 16 or 24px; anything between blurs.
3. **Three voices of type.** Geist for what he reads in the interface, Geist Mono caps for labels and metadata (four words at most; never a sentence), the system font for anything he reads at length. Sizes come from the ramp in the frontmatter only.
4. **Colour means something.** Neutral ink and `paper` white carry the interface. A hue appears only as an intent (highlight and key point gold, question purple), a skill, progress green, or the accent for focus and links. Never a colour for decoration.
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
- **Progress green** (`--c-green`). It marks progress and its one primary action: the goal ring, Start review, the session bar, rubric ticks and the finish verdict. It is never a link or focus colour.
- **Skill colours** (`--c-*`). These tint a skill's icon, chip, tile and its selected sidebar row, never text on their own.

## Typography

- **UI** is 13px. List and nav headings are 15px/600. The document title is 30px/700.
- **Reading text** is 17px/1.65 with headings at 650 weight.
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
- **Highlight popup.** Two switches on the highlight, ★ Key point and Question, each with its pixel icon (`PixelIcon.tsx`, 12×12 sprites drawn at 12 or 18px so pixels land whole on Retina: a highlighter tip for a plain highlight, a star for a key point, a question mark), key point in the highlight's gold, question in purple; the one that is on fills with its tint, and its hover says what it does with its 2–3 shortcut (D118). The margin shows the star and the question mark only; the Collected tab and its pill use all three. The note field below them, full width, whose placeholder fits the type (D94: "Connects to…", "This works because…", "My question… my guess:"). At the right, past a hairline, a thin column of muted 24×20 icon tools: Copy with source, Remove text, Remove highlight last; Play from here (videos) and Explain (one word) in a second column beside it, so the popup never grows taller (D112). On the phone the tools run in a row under the note. It opens where the selection ended: under the last line, centred on where the mouse let go; above the first line after an upward drag; never over the passage (D112).
- **Look Up panel (D83).** Replaces the popup in its place, same surface: the word 15px semibold, its pronunciation muted 12px on the same line (both truncate), the entry 13px `--text-read` in a 168px scroll area, then a ghost Make card button whose card icon lines up with the text edge. The looked-up word is underlined like the active highlight. Icon-only popup buttons (Look up, Remove) are 26px squares.
- **Listen bar (D85).** A raised pill in the reader tools, left of ⋯: pause/play, the video's speed pill without its outline, stop; 26px round `.ctl`s. The spoken sentence: 2px accent underline, 5px offset.
- **Reader side panel** (D75, D99). Folder tabs into a sheet (Arc, Dia): Source note and Collected each carry an icon and tone (NotePencil `keep-solid`, Stack `card-solid`, duotone 16px; at 55% opacity when not selected). The selected tab is `bg-card` with a `border` edge on top and sides and joins a rounded `bg-card` sheet (8px inset, radius 10, square corner under the first tab) that holds the note or questions with 20px padding; an unselected tab gets a `bg-hover` pill on hover. N and Q switch tabs. On the phone the sheet is flat. It opens and closes from a toggle at the window's top right that mirrors the sidebar's (SidebarRight, 16px, `faint`, `bg-hover` on hover, ⌥⌘S); an accent dot on it says a source note waits while the panel is shut. No close button in the panel: the toggle is the one way out.
- **Collected tab** (D99). Groups Cards, Questions, Keeps as Linear's collapsible group headers: caret, the type's filled icon in its tone, an 11px uppercase `faint` label; the header's + (Card here on Cards, Ask on Questions) shows on hover or focus. Rows are one line, truncated with an ellipsis, 30px tall, `bg-hover` on hover, the spoken time in `faint` tabular figures at the right on a video. A line he typed is `text`; a passage's own words are `muted`. Keeps start collapsed and show their count only while collapsed. The Card here field is a `bg-raised` row with a 1px `border` edge and the focus ring; Enter adds, Esc drops, a blur keeps it open with what he typed.
- **Finish scope** (D100). Under the recall field, one quiet 36px `field` line, placeholder "Leave anything out? Like “the coding part”", shown only when the source has questions; the recall's sub line says "Everything up to 15:05" on a partway finish. Source rows: a 2px `accent` bar on `bg-active`, 4px under the thumbnail, the thumbnail's width, only while reading.
- **Review quotes** (D99). A Card here card's passage box shows one quote at a time between bare ◂ ▸ caret buttons (24px, `muted`, `bg-hover` on hover, 30% at either end); the quote keeps two lines of height so flipping never moves the rating row. The caption leads with the spoken time in tabular figures.
- **Find** (D81, ⌘F in a source). The Claude app's find bar: a floating raised bar at the top right of the source, field, `n/N` count (tabular, "Not found" in `faint`), ↑ ↓ and ×, each with its key on hover. One list over the source then the side panel, left to right. Matches are orange at low alpha, the current one solid orange with dark text, like the quiz's "In the source" passages; never an intent tint. No motion.
- **File drop** (ChatGPT's "Add anything"). While files are dragged over the window the main pane dims (the sidebar stays lit; its skills are targets too) and three tilted 54–62px source tiles rise and fan out, the front one in `accent` showing the kind being dragged (PDF, book, note, web page), the back ones accent mixed with white; then "Add to" the target skill at 22px/650 and one muted line. A file Ore can't read turns the tiles grey with a red ✕ and says which types it reads. Rise 260ms, fan 280ms, slight overshoot; fades out in 140ms; under reduced motion only the dim fades.
- **Prequestions.** An unboxed strip at the top of the column, closed off by a hairline; a chevron toggles it. Each question is a row (Perplexity "Related") that stays visible as something to read for; only the one he is on opens an answer line. Enter stores it and opens the next unanswered one, `?` on an empty line is "no idea", Esc closes it. An answered row shows a tick and his answer.
- **Source note.** A second pane beside the source (D44), with the note editor (D38); the divider drags from 280px to 60% of the window. Below 1100px wide, an open note hides the sidebar (its hover peek still works, ⌘\ brings it back) so the column keeps its measure.
- **Skill tags** (Settings → General → Skills, and ⌘K). "Icon and name" (default) or "Icon only": the chip keeps its colour and icon, the name hides visually (still read by VoiceOver) and shows on hover.
- **Settings** (⌘,). A large sheet over the app, as ChatGPT's settings: the app stays visible in a margin of up to 96px (an inch) on every side under a 50% black scrim, and a click there or Esc closes it (× at the top left, "Close Esc" on hover). The sheet is `ground` with a 1px `hairline` edge, square, `--float`. Inside: the sections list on the left, and on the right each group is a mono label over a hairline rule with its rows on the page between hairlines, never a card; the shortcut list follows the same pattern. No motion: it opens from a key.
- **Home** (D58). Today on top in one band as tall as the ring (goal ring, due count, plan and week; Start review and the gear centred on the right), then two columns split by the skill page's drag bar (⅔ | ⅓ by default, remembered, double-click resets; one column under 1000px or when either side is empty): Continue reading on the left, Skills by collection on the right, one row each (badge and name left, gem and number right). Each section is a 12px mono label over a hairline rule, as on the skill page; nothing on Home is framed (2026-10-31, option C).
- **What to review** (D80). A small centred panel: one row per skill with cards due, most due first (checkbox, icon, name, "N cards ready" muted), then Start review with its ↵. The checkbox is Duolingo's: a rounded box with a 2px lip, filled green with a dark bold check when on, a muted outline when off. The whole row toggles on one click or Space; ↑↓ move, ↵ or ⌘R start, Esc closes.
- **Skill page sections** (Your note, To read, Questions). Not cards: each is a 12px uppercase Geist Mono `muted` label led by its 12px two-tone pixel icon from `PixelIcon.tsx` (notepad in `keep-solid`, open book in `card-solid`, question mark in `question-solid`), with its + at the right, over a 1px `hairline` rule; 14px to the content, 36px between sections; the heads of both columns share one height so their rules line up. The warm-up ("What do you already know about…?") is a 17px/600 line with its ⓘ and the Start button, no box. The reader's Source note and Collected tabs use the notepad and a stack of cards. Your note's + is Notion's: a new line at the end with the / menu open; Esc on the untouched "/" takes the line back out.
- **Terminal look** (D101, `retro.css`). Warm neutral black; Home and the skill page are open pages: sections are a label over a rule, never framed; square corners on rows, chips, menus and panels; section and card titles in 12px uppercase Geist Mono `muted` with no icon; metadata and counts in 11px mono caps; primary buttons flat `paper` with ink mono caps; big numbers in Geist Pixel; rings cut into 30 segments; bars a 2px dithered track with a solid fill. A selected list row is `selected` with a 2px `paper` bar on its left edge; in Review the picked sure-button and the suggested rating invert to `paper` with ink text on a 3px lip. Reading text, notes and review passages stay in the system font. The skill badge is a matte tile (skill colour 26% on `ground`) with 3px stepped 8-bit corners and no outline; keyboard focus brightens it to 55%.
- **Sidebar cursor** (D113, `SideCursor.tsx`). A 3×5 arrow of 2px `paper` cells in the sidebar's 8px left gutter, centred on the open row; `muted` inside a source, hidden while rows drag. After a click in the sidebar it hops in five 28ms frames (eased, snapped to 2px, one 4px frame past the row); keys and reduced motion move it at once. The reader's outline uses the same arrow beside the current heading's line, which is `paper`; lines already passed are `faint`, the rest `hairline`; the arrow hops as the current heading changes and hides while the outline panel is open.
- **Toasts** (D113, `Toast.tsx`). Up to three stack at the foot of the window, all as wide as the widest, the newest in front; older ones show only a 6px top edge. Hovering fans them out a full height and 8px apart in three hard frames (84ms); leaving snaps them back. Each keeps its own Undo or Redo, which acts on its own step (Linear). A long step's toast has a 4-frame pixel spinner and turns into its result in place: a green pixel check, or a red cross for an error.
- **Working line** (D113, `Working.tsx`). A wait's label in its own colour with an 8px pixel spinner before it on the midline: four 4px cells, one lit in the label's colour walking clockwise every 120ms, the rest `hairline`; still and `muted` under reduced motion. No light sweep.
- **Rolling numbers** (D113, `Roll.tsx`). Home's goal minutes and the solid-gem counts on Home and the skill page roll when they change: each changed digit slides out and its new digit in, up when the number grows, in four hard frames (112ms), clipped to its slot. A number remembers what it last showed for the life of the window, so one that changed on another screen rolls when he comes back; never on its first showing, never under reduced motion.
- **Gems** (D90). A skill's strength: cut gems for solid memories, rough stones for growing cards, a glow on one whose next Good review makes it solid, dull grey for one to win back. 8-bit pixel sprites drawn in `Gem.tsx` (10×8, four tones of `--skill` by `color-mix`, crisp edges; D101). Numbers and "Lv N" only; words live in the hover hint.
- **Review** (D59). One card centred in the measure, a segmented session bar, a `kbd` footer; the passage opens at the right only after the answer.
- **Chapter sign** (D115). "Recall this chapter" with the pixel `Signpost`, 12px mono caps `faint`, hover `bg-hover` + `muted`, centred in the gap after a chapter's last block, inside the column. An overlay on the page, never inside `.doc`. The block it opens: a `##` heading and placeholder lines in `faint` (`.ghost`), feedback under the note behind a hairline (`.chapter-fb`).
- **Fields.** Filled inset (darker than their surface) with a faint hairline that brightens on hover; focus is the accent border plus a soft halo (`--halo`), never an outline ring as well.
- **Answer buttons.** Every button he answers with ("how sure", ratings) is the same pressed-lip button: a 3px lip it drops into when pressed (Duolingo).
- **Switch.** Compact, green when on, thumb on a slight spring; iOS proportions on iPhone.
- **Callouts** in the note editor are a raised box with a hairline border and a muted kind label, as in Notion. No coloured side stripe.
- **Hints** open on hover, and on focus only after Tab, so a field focused by code never covers its own label.

## Do's and Don'ts

### Do

- Show a control's shortcut on hover with `<Hint keys=…>`; `kbd` only in panel footers and the review footer.
- Use motion for real progress (D62): springs on card entry, ticks on rubric marks, a short burst when the goal ring closes; 150 to 300ms, transform and opacity only, none under `prefers-reduced-motion`.
- Keep focus visible (`:focus-visible`) and return focus when a panel closes.
- Respect `prefers-reduced-motion`.
- Suppress rubber-band scrolling.

### Don't

- Add XP, badges, hard-reset streaks, leaderboards, reading-speed metrics or a session score (D62). Progress shows only as the goal ring, the session bar, the reader's position bar (or its outline, when the source has headings) and a skill's gems (D90).
- Add standing explanatory copy; put it in a hover hint or an ⓘ.
- Use `transition: all`.
- Add a second accent colour.
