# Sweep 5 — iPhone sizing

Ranked: **major — Today ignores the two-line title limit; minor — larger-text “Think so” escapes its button; minor — Review’s Open in source target is only 25–30 pt high.** No blocker observed.

## Run and evidence

- Audit date: 2026-11-13. Checkout: `8174e4ad912dc0723e902aae4f84d652845372de`.
- Real installed Ore, driven through XCUITest using `apps/phone/scripts/sim.ts`; no source changes. All retained audit output is under `codex-out/s5/`. No live library or iCloud data was used.
- Pro: iPhone 18 Pro, 402 × 874 pt. Small: iPhone 16e, 390 × 844 pt. Original screenshots are 3×; coordinates below are **points**, not pixels. Files ending `crop4x.png` are enlarged inspection crops.
- Read `docs/reviews/findings.md` before testing. F87 is related to finding S5-1, but its old one-line truncation did not return: this is a different failure of the new two-line cap. F89 was initially suspected from small accessibility frames, then **ruled out by actual edge taps**. No known row is claimed reopened.
- Ordinary library was supplied already seeded at `libs/ordinary`. Created `libs/big` with `ORE_SEED_SCALE=4 bun apps/desktop/scripts/mock/seed-big.ts codex-out/s5/libs/big`: 953 sources and 4,447 reviews. Copied ordinary to `libs/long-titles`; its six title cases and exact paths are in `libs/long-titles-manifest.json`: 200 characters, an 80-character unbroken word, one emoji, Arabic, Japanese, and one word. Learning has a 60-character name.
- Final fixture check removed a trailing full stop from the initial 61-character skill name. Both phones were freshly reinstalled with the exact 60-character name and checked: [Pro](shots/pro-final-skill60.png), [Small](shots/small-final-skill60.png). The final Today screenshots again reproduce S5-1: [Pro](shots/pro-final-today.png), [Small](shots/small-final-today.png).
- Both phones ran ordinary, long-title, and big libraries. The requested accessibility-extra-extra-extra-large setting was tested on both; D250 intentionally caps the app at the first accessibility size. The cap itself is not a finding.
- Simulator lifecycle, library installation, content-size, and appearance changes went through the JSON request/answer files in `ask/`. For example, `ask/pro-ax.json` and its answer establish the larger-text setting.
- Screenshots were opened after each action before choosing the next action. Several driver screenshots captured the previous frame or an unfinished transition; a subsequent `shot` established the settled result. Those transition frames are retained but are not evidence of bugs.

Command prefixes used throughout:

```sh
ORE_SIM_DIR=/tmp/ore-sim-s5 bun apps/phone/scripts/sim.ts …
ORE_SIM_DIR=/tmp/ore-sim-s5-small bun apps/phone/scripts/sim.ts …
```

The Apple comparisons below are the Books/Mail/Notes expectations specified by the task and repository iOS-check skill. Apple’s apps were not separately measured in this run; the supplied driver targets Ore.

## S5-1 — Today does not stop source titles after two lines

**Severity:** major. **Devices:** both. **Screen:** Today → Continue reading. **Related known row:** F87 / D256; new failure mode, not the old one-line cutoff.

**Expected / Apple comparison:** the requested D256 layout uses at most two title lines, then an ellipsis; the picture retains its shape and progress sits underneath it. Mail’s bounded multiline list text is the reference behavior: a long subject must not consume an arbitrary amount of the list.

**Observed:** ordinary’s long habit title takes four lines at normal size, seven at the large accessibility setting. A 200-character title takes six lines at normal size; the 80-letter word takes five. The content below is pushed down. The same titles correctly stop after two lines in Sources. The thumbnail is not stretched; the title cap is the failure.

**Exact reproduction from a fresh ordinary library on Pro:**

```sh
# The already-running initial Pro was on this library.
ORE_SIM_DIR=/tmp/ore-sim-s5 bun apps/phone/scripts/sim.ts shot
ORE_SIM_DIR=/tmp/ore-sim-s5 bun apps/phone/scripts/sim.ts tree
# Reopen Today through the drawer after visiting Sources:
ORE_SIM_DIR=/tmp/ore-sim-s5 bun apps/phone/scripts/sim.ts tap 34 84
ORE_SIM_DIR=/tmp/ore-sim-s5 bun apps/phone/scripts/sim.ts shot
ORE_SIM_DIR=/tmp/ore-sim-s5 bun apps/phone/scripts/sim.ts tap 80 92
ORE_SIM_DIR=/tmp/ore-sim-s5 bun apps/phone/scripts/sim.ts shot
```

For a fresh long-title copy, write `{"op":"start","device":"pro","lib":"codex-out/s5/libs/long-titles"}` to a unique file in `ask/`, await its `.out.json`, then `shot` and `tree`. Repeat with device `small` and its driver prefix. Larger-text repetitions use `{"op":"content_size","device":"pro","value":"accessibility-extra-extra-extra-large"}` and the analogous small request.

**Measured frames:**

| Case | Title frame (x, y, width, height), pt | Visible lines |
|---|---|---|
| Pro ordinary, normal | 92, 428, 294, 89 | 4 |
| Small ordinary, normal | 92, 413, 282, 89 | 4 |
| Pro ordinary, accessibility | 92, 601, 294, 255 | 7 |
| Pro 200-character title, normal | 92, 428, 294, 133 | 6 |
| Pro unbroken word, normal | 92, 581, 294, 111 | 5 |

**Evidence:** [ordinary Pro](shots/pro-today.png), [4× crop](shots/pro-today-crop4x.png), [Pro tree](shots/pro-today.tree.txt), [ordinary Small](shots/small-today.png), [Small tree](shots/small-today.tree.txt), [Pro accessibility](shots/pro-ax-today-settled.png), [accessibility tree](shots/pro-ax-today.tree.txt), [Small accessibility](shots/small-ax-today.png), [Pro long titles](shots/pro-long-today.png), [long-title tree](shots/pro-long-today.tree.txt), [Small long titles](shots/small-long-today.png).

**Second try:** reproduced after returning to Today on Pro, after a fresh Small install, and after fresh long-title installs on both. [Pro return](shots/pro-search-close-settled.png) still shows the ordinary title on four lines.

## S5-2 — Larger-text “Think so” extends below the button

**Severity:** minor. **Devices:** both. **Screen:** Review → confidence choice, accessibility-extra-extra-extra-large.

**Expected / Apple comparison:** as in Apple’s accessible controls, the entire label belongs within its control’s visible boundary; enlarge the button or change its layout when text wraps. D250’s cap does not excuse overflow at the size Ore actually supports.

**Observed:** “Think” stays in the button but “so” appears below the lower border. Guess and Sure remain inside theirs. Normal text fits.

**Exact reproduction on fresh ordinary Pro, larger text set through `ask/pro-ax.json`:**

```sh
# From Today:
ORE_SIM_DIR=/tmp/ore-sim-s5 bun apps/phone/scripts/sim.ts tap 200 278
ORE_SIM_DIR=/tmp/ore-sim-s5 bun apps/phone/scripts/sim.ts shot
ORE_SIM_DIR=/tmp/ore-sim-s5 bun apps/phone/scripts/sim.ts tap 200 813
ORE_SIM_DIR=/tmp/ore-sim-s5 bun apps/phone/scripts/sim.ts shot
ORE_SIM_DIR=/tmp/ore-sim-s5 bun apps/phone/scripts/sim.ts tree
# Reveal and rate the first exercise, to repeat on another question:
ORE_SIM_DIR=/tmp/ore-sim-s5 bun apps/phone/scripts/sim.ts tap 200 434
ORE_SIM_DIR=/tmp/ore-sim-s5 bun apps/phone/scripts/sim.ts tap 249 711
ORE_SIM_DIR=/tmp/ore-sim-s5 bun apps/phone/scripts/sim.ts tree
```

On Small, after its larger-text request: Today `tap 195 262`, picker `tap 195 784`, then `shot` and `tree`.

**Measured frames:** first Pro question: Guess `(24,411,114,45)`, Think so `(144,411,114,64)`, Sure `(264,411,114,45)`. The accessibility bounds include overflowing text; the screenshot shows the middle button’s border ends level with its neighbors. On the next question these start at y=464 with the same respective heights. This is a visible-label overflow finding, not a claim that the button is only 45 pt tappable.

**Evidence:** [first question](shots/pro-ax-question-settled.png), [4× crop](shots/pro-ax-question-settled-crop4x.png), [first tree](shots/pro-ax-question.tree.txt), [second question](shots/pro-ax-next.png), [second tree](shots/pro-ax-question-second.tree.txt), [Small](shots/small-ax-review.png), [Small tree](shots/small-ax-review.tree.txt). [Normal-size Small](shots/small-large-review.png) shows the label fits again.

**Second try:** reproduced on the next Pro question, on Small’s first question, and again after opening Review from the long-title source on Pro.

## S5-3 — Review’s Open in source link retains a short tap target

**Severity:** minor. **Devices:** both. **Screen:** Review → revealed answer → source line.

**Expected / Apple comparison:** a 44 × 44 pt minimum effective touch target, including any invisible extension, as required by the audit’s Books/Mail-style touch standard. Tapping within 22 pt of its vertical center should activate the control if no other control occupies that space.

**Observed:** the link is 25 pt high at normal text and 29–30 pt at accessibility text. Unlike the skill controls, it did not respond to the tested near-edge taps. Its center opened the source.

**Exact reproduction with the seeded big library on Pro:**

```sh
# From Sources, search for the review action:
ORE_SIM_DIR=/tmp/ore-sim-s5 bun apps/phone/scripts/sim.ts tap 368 84
ORE_SIM_DIR=/tmp/ore-sim-s5 bun apps/phone/scripts/sim.ts shot
ORE_SIM_DIR=/tmp/ore-sim-s5 bun apps/phone/scripts/sim.ts type "Start review"
ORE_SIM_DIR=/tmp/ore-sim-s5 bun apps/phone/scripts/sim.ts tap 130 119
ORE_SIM_DIR=/tmp/ore-sim-s5 bun apps/phone/scripts/sim.ts shot
# First question: What's a common mistake with evaluating llm apps?
ORE_SIM_DIR=/tmp/ore-sim-s5 bun apps/phone/scripts/sim.ts tap 200 326
ORE_SIM_DIR=/tmp/ore-sim-s5 bun apps/phone/scripts/sim.ts shot
# Both taps inside the source container, 19 pt above link center, do nothing:
ORE_SIM_DIR=/tmp/ore-sim-s5 bun apps/phone/scripts/sim.ts tap 290 375
ORE_SIM_DIR=/tmp/ore-sim-s5 bun apps/phone/scripts/sim.ts shot
ORE_SIM_DIR=/tmp/ore-sim-s5 bun apps/phone/scripts/sim.ts tap 290 375
# Center works:
ORE_SIM_DIR=/tmp/ore-sim-s5 bun apps/phone/scripts/sim.ts tap 290 394
ORE_SIM_DIR=/tmp/ore-sim-s5 bun apps/phone/scripts/sim.ts shot
```

**Measured frames from separately captured ordinary and long-title answers:** Small normal `(225,364,127,25)`; Pro accessibility `(191,601,173,29)`; Pro long-title accessibility `(191,654,173,30)`. The enclosing source panel is larger; it is not itself the link’s target. The big-library edge experiment above confirms the practical miss instead of relying solely on an accessibility frame.

**Evidence:** [Small answer](shots/small-large-answer-settled.png), [4× crop](shots/small-large-answer-settled-crop4x.png), [Small tree](shots/small-large-answer.tree.txt), [Pro accessibility answer](shots/pro-ax-answer.png), [Pro tree](shots/pro-ax-answer.tree.txt), [long-title answer](shots/pro-long-review-answer.png), [long-title tree](shots/pro-long-review-answer.tree.txt), [first edge tap settled](shots/pro-review-link-edge-settled.png), [second edge tap](shots/pro-review-link-edge-second.png), [successful center tap](shots/pro-review-link-opened.png).

**Second try:** short frame reproduced on both devices and at both text sizes; near-edge miss reproduced twice on Pro, followed by successful center activation.

## Coverage and checks that passed

| Surface | Checked | Representative evidence |
|---|---|---|
| Today | Ring, start button, source rows, progress below pictures, skills; ordinary and big data; normal and accessibility text on both | `pro-today.png`, `pro-ax-today-settled.png`, `small-ax-today.png`, `pro-big-today.png`, `small-big-today.png` |
| Drawer | Main destinations, long skill names, scroll to Settings, safe-area behavior | `pro-drawer-settled.png`, `pro-ax-drawer.png`, `small-ax-drawer.png`, `small-big-drawer-bottom.png` |
| Sources | To read and Done, two-line truncation, all six title cases; both sizes and devices; big list on Pro | `pro-sources.png`, `pro-skill-back.png`, `small-ax-sources.png`, `pro-long-sources-settled.png`, `small-long-sources-settled.png`, `pro-big-sources-settled.png` |
| Archive | Empty state and a 200-character archived row on both | `pro-archive-settled.png`, `pro-long-archive.png`, `small-long-archive.png` |
| Search | Recent, title results, text/exercise results, keyboard, long title truncation; big results on Pro | `pro-search-results-settled.png`, `pro-long-search-results.png`, `small-long-search-results.png`, `pro-big-search-review.png` |
| Skill | Header, goal, importance, To read/Done, questions, note page; 60-character skill; both text sizes and phones | `pro-ax-skill-settled.png`, `pro-ax-skill-done.png`, `pro-ax-skill-note.png`, `small-ax-skill.png`, `pro-long-skill.png`, `small-long-skill-done.png` |
| Reader | Top/bottom bars, ordinary and unusual title headers, short/long Finish placement, Sections and jump, audio transcript/player, find, selection, highlight popup and note page | `pro-short.png`, `pro-section-end-settled.png`, `pro-audio-settled.png`, `pro-find.png`, `pro-highlight-after.png`, `pro-note-keyboard.png`, `pro-ax-source.png`, `small-ax-reader.png` |
| Source actions / rename | Ordinary and long-title ⋯; 44 pt sheet rows, rename field above keyboard, Return dismisses | `pro-more.png`, `pro-more.tree.txt`, `pro-rename.png`, `pro-rename.tree.txt`, `pro-long-more.png`, `small-long-more.png` |
| Add | Link field, Add, Choose file/photo above keyboard, all 44 pt | `pro-add-keyboard.png`, `pro-add.tree.txt` |
| Review | Picker, confidence, answer, ratings, end screen; typed Explain answer with keyboard; long source line on both; larger text on both | `pro-ax-review-end-settled.png`, `small-answer-typed.png`, `small-check.png`, `small-long-review-answer.png`, `pro-long-review-answer.png` |
| Settings | Entire available page: daily goal, new exercises, weekdays, daily plan, reminder, library status; both devices | `pro-settings-settled.png`, `pro-settings-bottom.png`, `small-settings.png` |

### Frame checks and rejected suspicions

- Main bars: 44 × 44 pt. Source list rows: 60–63 pt normal and about 90–91 pt when the accessibility title needs two lines. Finish: 330 × 53 pt on Pro, 318 × 53 pt on Small. Source sheet rows: 386 × 44 pt on Pro. Find field/navigation/close and note keyboard tools: at least 44 pt high.
- **Thumbnail geometry:** inspected original 3× screenshots and 4× crop. Today’s ordinary and long-title placeholders are 192 × 108 pixels = **64 × 36 pt**; Sources/skill/Archive placeholders are 144 × 81 pixels = **48 × 27 pt**; search placeholders are approximately 96 × 54 pixels = **32 × 18 pt**. These are 16:9. The longer row did not stretch its picture. [List crop](shots/pro-long-sources-settled-crop4x.png) and [Today crop](shots/pro-today-crop4x.png). These fixtures mainly show type-icon placeholders, not photographic thumbnails.
- **F89 did not return.** Accessibility reports compact skill-control frames (e.g. tabs 37 × 33 pt; importance 29 × 28 pt). Those omit invisible extensions. On Small’s big Learning page, `tap 163 352` above the Done tab switched to Done, and `tap 38 352` above the To read tab switched back. `tap 223 104` above Importance opened its sheet. Evidence: `small-big-skill.png`, `small-skill-tab-edge.png`, `small-skill-tab-edge-second.png`, `small-skill-importance-edge.png`. Read-only inspection of `styles.css` confirms the intended invisible margins; the finding decision rests on the visible action results.
- **Settings switch frame was not a failed target.** It is 51 × 32 pt in the tree, but Small `tap 333 448`, 4 pt above its reported frame, toggled Weekdays only on, and the same tap toggled it off. Evidence: `small-settings-switch-edge.png`, `small-settings-switch-edge-second.png`. The setting was restored.
- **Review picker Deselect all also answered an outside-frame tap:** Small big picker `(294,287,82,25)` responded to `tap 334 283`. Do not report its tree height alone as a failure. `small-review-deselect-edge.png`.
- **Sections:** its visible pill/tree can be 34 × 28 pt, but it has a dedicated invisible extension; this is not included as a finding from the compact frame. The sheet opened, its rows were 44 pt, and a section jump put the heading below the top bar. `pro-sections-settled.png`, `pro-sections.tree.txt`, `pro-section-end-settled.png`.
- **F88:** Finish follows the text on the ordinary short source and the end of the longer source, with a deliberate gap of roughly 50–60 pt from the last visible baseline rather than the previous roughly 230 pt. Audio controls did not cover Finish at the tested end position.
- **F72 is still the accepted floating-bar behavior:** Small’s 200-character header initially placed the reading pill over part of Finish; scrolling to the end cleared it. `small-long-header.png` → `small-long-finish-clear.png`. Not re-reported.
- Highlight popup looked compact but its type switches measured 118 × 45 pt and tools 44 × 45 pt. Note keyboard tools fit across the screen. No repeat of F39–F41 was observed in that path.
- No new mid-glyph clipping, thumbnail/title overlap, keyboard-covered typed answer, desktop shortcut labels, or safe-area obstruction was observed in the retained settled screenshots. This is limited to the paths above, not a blanket certification of all controls.

## What could not be tested, and limits

1. **A light Ore theme:** both light requests succeeded, but Ore stayed dark while the system keyboard became light. The installed phone shell explicitly configures `theme: "Dark"`. Later dark requests succeeded and dark keyboards were observed. The app’s dark presentation was checked throughout; a distinct light app layout was unavailable. Requests and answers: `ask/pro-light.*`, `ask/small-light.*`, `ask/pro-dark.*`, `ask/small-dark.*`.
2. **Settings subpages and a ⋯ sheet title:** this build exposes a single scrolling Settings page and source action sheets without a source-title header. Those nonexistent surfaces could not be inspected. No missing-feature finding is inferred.
3. **Photographic thumbnail rendering and every asset type:** the prescribed seeds mostly produced source-type placeholders. Their actual aspect ratios were measured, but the run does not establish photo-loading/cropping behavior for every media type.
4. **AI and live sync:** excluded by the prompt. Review’s manual answer comparison was exercised; no AI grading claim is made. The synthetic lecture displayed its transcript and audio controls, but audible output quality was outside this sizing audit.
5. **Exact font sizes:** screenshots and accessibility text frames cannot establish a font’s point size reliably. Small text was inspected visually; no numerical “under 11 pt” claim is inferred from glyph height.
6. **Combination coverage:** the five main screens were checked at normal and accessibility text across the two devices. Long-title lists/search/headers/Review were sampled as documented; every one of the six titles was not opened on every possible screen at every size. The big library was used for Today and review/skill density on both, and the full Sources accessibility tree on Pro; it was not a full second exhaustive walkthrough of all 953 sources.
7. **Separate Apple-app measurements and hardware thumb accuracy:** the supplied driver runs Ore only. Apple-app comparisons are reference expectations, not side-by-side measurements. Actual near-edge taps were used to reject false positives from compact accessibility frames.

No source code, shared findings registry, or Git metadata was changed. The task-specific read-only rule takes precedence over the general commit/shipping workflow. This is an audit report, not a fix or a claim that CI passed.

## Ranked findings

1. Major — Today ignores the two-line title limit on both phones.
2. Minor — “Think so” extends below its button at larger text on both phones.
3. Minor — Review’s Open in source link has a 25–30 pt target and misses near-edge taps.
