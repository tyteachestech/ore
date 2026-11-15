# Looks test report

## 1. Coverage

Tested the supplied Mac release server (`1767`, bridge `1768`) and phone build (`1769`) in the supplied WebKit browser, with 2× screenshots; repository inspected at `81b2105`. Covered Home/Today, sidebar/drawer, a skill, All sources/Sources, empty Feed, Add, Settings, command palette, reader, highlight popup, source menu, source note, tutor, Finish, Review and session endings. Mac sizes were 800×600, 1024×700, 1280×800, 1440×900 and 2560×1440, with CSS zoom at 125% and 150%; phone sizes were 390×844, 375×667 and 844×390. Checked system appearance switches, explicit light/dark reading pages, reading-size endpoints, simulated phone text scales from 14/17 to 28/17, reduced motion, and the accepted forced-colors/contrast media settings. The shell intentionally stays dark. Skipped pure polish, the listed known open issues, AI answer quality, prior sweeps' unrelated functionality, and native device validation. Phone Auto appearance cannot be verified here because its native `system_dark` call is stubbed. The native app explicitly locks portrait (`apps/phone/src-tauri/Info.ios.plist:7`); landscape results describe the browser harness, not a supported native orientation. No application code or findings registry was changed.

## 2. Findings

### LOOKS-1 — Enlarged command palette hides its last choices below the window

**S2 · Mac**

1. Open a fresh Mac page at `http://localhost:1767/`, with the supplied bridge initialization and an 800×600 viewport.
2. Set 150% CSS page zoom: `document.documentElement.style.zoom = '1.5'`.
3. Open the command palette with ⌘K.
4. Scroll its results to the bottom. Alternatively, press End to select the final skill.
5. Try to read or click the final skill, “Distributed Systems and Consensus Protocols for Very Large Clusters.”

**Expected:** The palette fits the available window. Scrolling or moving the selection to the final row brings that row into view, with its label readable and its pointer target reachable.

**Actual:** The palette extends to y=798 in a 600px-high window. Even at the list's maximum scroll position, the final row occupies approximately y=679–733, entirely outside the window. End selects this invisible row. Wheel scrolling does not bring it into view; the outer overlay does not scroll. The bottom skill rows and the Open/Close footer remain hidden. A learner must narrow the search, reduce zoom, or enlarge the window to reach these choices visibly.

**Reproduction:** 4/4 fresh-page runs at 800×600 and 150%, including two runs of the standalone reproducer. At 125%, one additional check showed the last row partly clipped (y=566–611). At 1280×800 and 150%, the skill rows remain reachable but the footer is clipped.

**Screenshots:**

- [Final row selected but below the window, run 1](repro-palette-1.png) — `codex-out/looks/repro-palette-1.png`
- [Independent run 2](repro-palette-2.png) — `codex-out/looks/repro-palette-2.png`
- [After attempting wheel scrolling](palette-small-wheel-1.png) — `codex-out/looks/palette-small-wheel-1.png`
- [125% comparison](palette-125-small.png) — `codex-out/looks/palette-125-small.png`

**Suspected location:** `apps/desktop/src/styles.css:416` positions the overlay with `padding-top: 14vh`; `styles.css:417` gives the panel no available-height cap; `styles.css:430` caps the results list at a fixed 360px. Together with the input and footer, these exceed the visible height under zoom.

**Reproducer:** From the repository root, run `node codex-out/looks/reproduce-palette.cjs`. It uses only the looks server, opens pages sequentially in one context, closes them, and writes measurements to [repro-palette.json](repro-palette.json). It does not change library content.

## 3. Known rows seen again

No previously fixed row was confirmed to have returned. The specified open rows were not re-reported. In particular, F326's fix held: choosing Light also lightened the phone's Aa sheet.

## 4. What passed

- Home, the skill page, source lists and empty Feed remained readable and navigable across the four requested Mac window sizes.
- Add and the three Settings sections remained usable in the tested normal-size layouts; this does not clear the known Settings zoom limitation F259.
- System light/dark switches left the intentional dark shell consistent; explicit light reader text, question highlights and their popup remained readable.
- The Mac reader remained scrollable at both 14px and 26px reading sizes.
- A source note remained readable across appearance switches and reopened with the saved text intact.
- Tutor controls and input remained reachable across the requested Mac sizes and 125%/150% zoom.
- The source menu and highlight popup repositioned after shrinking the window; Escape closed them under reduced motion.
- Resizing the window during a sidebar-divider drag left no stuck drag state; All sources opened normally afterward.
- Start review's keyboard focus ring was visible on its light button; see [start-focus.png](start-focus.png).
- Reduced-motion figure zoom opened and closed, and Finish hid the source and showed its recall form.
- Finish's actions at 125% and 150% were reachable by scrolling its own panel; they were not treated as an unreachable-control finding.
- Review questions, revealed answers and ratings rendered through the Mac size/zoom changes; recorded reviews reached a settled reduced-motion ending.
- At 800×600 the ending initially scrolled past part of the greeting, but scrolling recovered it; results and Done remained usable. Excluded as recoverable presentation rather than a new learning blocker.
- Phone Today, Sources, a skill, Settings and source notes remained readable at the tested small/default/large simulated text scales.
- Phone Aa controls fit at 375×667 and 844×390, including the largest supported simulated system text scale; explicit Light and Dark choices applied correctly.
- Phone Review at 375×667 with large text, and a fresh 844×390 landscape page, both reached an answer, accepted a rating and reached the ending.
- WebKit accepted `forcedColors: active` and `contrast: more`; inspected reader text and highlights remained visible. This was not a native high-contrast or full contrast-ratio audit.

A portrait-to-landscape browser resize did blank the reader: the keyboard-height code retained the old portrait height and reserved 454px for a nonexistent keyboard (`apps/desktop/src/phone/PhoneApp.tsx:609`). A fresh landscape load recovered it. This is retained in the evidence as a harness-only limitation, not reported as a native iPhone bug because the shipped app is portrait-only.

The JSON logs and exploratory scripts in this folder record the broader coverage. Some exploratory attempts used the wrong ARIA role/name; the affected note, review and Finish paths were subsequently exercised successfully. Only the standalone palette reproducer and the measurements above support the reported finding. All browser contexts opened by this run were closed.
