# Sweep 5 (iPhone): sizing after the iPhone sizes and two-line titles

Two changes landed today on the iPhone app only:
- **iPhone sizes, not the Mac's (#371):** 17 pt list rows, round 44 pt bar buttons, capsule buttons, small mono section heads, 44 pt taps on a skill page, and Finish placed straight after a source's text.
- **Two-line titles (#364, D256 in `docs/DECISIONS.md`):** a source's title takes up to two lines before it cuts on Today's Continue reading rows, in Sources and in a skill's lists; Today's reading dots (or New) sit under the picture; a row grows only when the title needs its second line.

Your job: walk every phone screen and find what these changes broke or missed. Do not change source code.

## How you touch the phone
Read `docs/reviews/2026-11-12-codex-phone/prompt.md` ("How you touch the phone" and "What exists on the phone") for the `sim.ts` driver. Its "Not built yet" list is out of date: the phone now adds sources (+), reads, highlights, takes notes, reviews and has skills and Settings. Only AI features and sync are Mac-only.

Two simulators are yours, each with its own driver folder. Prefix every driver command:
- `pro`: iPhone 18 Pro, 402 × 874 pt, 3× shots: `ORE_SIM_DIR=/tmp/ore-sim-s5 bun apps/phone/scripts/sim.ts …`
- `small`: iPhone 16e, 390 × 844 pt, 3× shots: `ORE_SIM_DIR=/tmp/ore-sim-s5-small bun apps/phone/scripts/sim.ts …`

`pro` starts running on `codex-out/s5/libs/ordinary`. Your sandbox can't reach CoreSimulator, so for anything that starts, resets, relaunches or changes the simulator, write a request file and wait for its answer: write `codex-out/s5/ask/<unique-name>.json`, and within a few seconds to a few minutes `codex-out/s5/ask/<unique-name>.out.json` appears. Requests (`device` is `pro` or `small`, default `pro`):
- `{"op":"start","device":"small","lib":"codex-out/s5/libs/<dir>"}`: install fresh with that library and start the driver
- `{"op":"driver","device":"pro"}`: restart a stalled driver
- `{"op":"content_size","value":"accessibility-extra-extra-extra-large"}` (or `large` to go back, or any iOS size name)
- `{"op":"appearance","value":"dark"}` / `"light"`
- `{"op":"launch"}`, `{"op":"reset"}`, `{"op":"home"}`, `{"op":"activate"}`

Libraries, made by you under `codex-out/s5/libs/` only (never `~/Ore`, never iCloud):
- Ordinary: `bun apps/desktop/scripts/mock/seed.ts <dir>`
- Big: `ORE_SEED_SCALE=4 bun apps/desktop/scripts/mock/seed-big.ts <dir>`
- Long titles: copy the ordinary one, then edit the `title:` line in some `items/*/doc.md` frontmatter: 200 characters, one 80-letter word with no spaces, a single emoji, Arabic (right to left), Japanese, and a one-word title. Give a skill (in `skills.yaml`) a 60-character name.

## Rules
- Read-only on the repo except `codex-out/s5/` (report.md, shots/, libs/, ask/).
- Read `docs/reviews/findings.md` first: don't re-report a known row unless you saw it come back; then name it.
- Look at every screenshot before the next action. For sizes and clipping, crop and zoom; measure in points (pixels / 3) using `tree` frames.
- Every finding is tried twice; say whether it came back. Only report what a screenshot shows.

## What to check, on every screen
Today (Continue reading rows, the ring, skills), the drawer, Sources (To read, Done), Archive, search (results list), a skill page (header, tabs, its lists, its note), a source (top bar, bottom bar, audio player on an episode, Sections, find in source, highlight popup, note page, Finish at the end on a short and a long source), the ⋯ sheet, the + sheet, Review (answer with keyboard up, rate, end screen), Settings and each of its pages, the rename field.

For each:
1. **Tap targets:** every button, row, tab and chip at least 44 × 44 pt (frame from `tree`). Neighbours not closer than a thumb can tell apart.
2. **Clipping and overlap:** titles on two lines then cut with "…", never cut mid-glyph, never under the picture or the dots; nothing overlaps (pills, bars, the audio player over Finish).
3. **Pictures:** a source thumbnail is always 16:9 (measure width/height in `tree` or a crop), in every list, at every text size; a row growing for a two-line title must not stretch or squash it.
4. **Safe areas:** nothing under the Dynamic Island, status bar or home indicator; fixed bars padded.
5. **Still sized for the Mac:** text under 11 pt, 8 px hover corners, mouse-sized buttons, key hints, ⌘ labels, rows spaced like a desktop list.
6. **Big text and dark:** repeat Today, Sources, a skill page, a source and Review at `accessibility-extra-extra-extra-large`, then at `large` in dark mode. Then the same on `small`.
7. **Long titles:** the long-titles library on both phones: every list, the source's header, search results, Review's source line, the ⋯ sheet's title.

## Report
`codex-out/s5/report.md`: a ranked one-line summary, then each finding (severity blocker/major/minor/polish; device; screen; exact commands; expected, and what Apple's own apps do (Books, Mail, Podcasts, Notes), vs what happened; measured frames; screenshot path; second try). Then what you could not test and why. Finish by printing the ranked findings one line each, or "clean".
