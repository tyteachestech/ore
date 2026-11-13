# Sweep 4a — iPhone data extremes

Audit completed with the coverage limits below. Eight findings reproduced; no source-code changes.

## Ranked findings

1. **Major — a successfully imported source stays absent until relaunch.**
2. **Major — the reader's “Move to To read” does not stick.**
3. **Major — iOS accessibility text size does not enlarge Ore.**
4. **Major — the keyboard covers a lower Today row's Rename field.**
5. **Minor — the section indicator overlaps Finish on a short source with a long title.**
6. **Minor — a chapter jump hides its heading behind the Back bar.**
7. **Minor — first launch shows a zero ring and caught-up message without first-source guidance.**
8. **Minor — tapping the status bar does not return Sources to the top.**

## Setup and evidence

Checkout `765c0fbf024a1bbebbf2b5c545fc51aa57f8a742`. Real iOS Simulator app, XCUITest driver in `/tmp/ore-sim-s4a`. iPhone 18 Pro s4a: 402×874 pt, 3× screenshots. iPhone small s4a (SE third generation): 375×667 pt, 2× screenshots. Scratch libraries only; app copies installed by the request helper. Big seed: 953 sources and 4,447 review records; AI has 162 source assignments, Learning 161.

Every screenshot returned by an action was inspected before the next UI action. Full originals are under `shots/`; crops support clipping findings. `actions.jsonl` records exact arguments, screenshots and driver wall time. `ask/*.json` and matching `.out.json` record privileged simulator requests and outcomes. `payloads.json` contains the exact 300-character title, 80-letter word, 60-character skill name, Arabic, Japanese, emoji and 2,000-word note.

Commands below use this shorthand:

```sh
sim() { ORE_SIM_DIR=/tmp/ore-sim-s4a bun apps/phone/scripts/sim.ts "$@"; }
```

`python3 codex-out/s4a/drive.py payload NAME` forwards `sim type` with the exact named text from `payloads.json`, and saves its screenshot. Start/reset and `xcrun simctl ui/openurl` were requested through JSON files, never run directly in this sandbox.

## 1. Imported source stays absent until relaunch

**Severity:** major. **Screen:** Sources and Today, empty library. **Repeat:** both fresh runs.

Expected: a completed import becomes a readable source immediately, as a newly saved item appears in an Apple app's library. Actual: the Coming in row disappears, a success toast says Added, and Sources returns to “Nothing here yet.” Today also lacks the source. Relaunch reveals it and it opens normally. This is distinct from F59: import has finished. No data loss was established; trying again in the first run created two copies.

Fresh-library setup: `ORE_LIBRARY=codex-out/s4a/libs/empty bun packages/cli/src/ore.ts init`, then request `['sim.ts','start','--fresh','--lib','codex-out/s4a/libs/empty']` as a JSON array (double quotes in the actual file). From Sources:

```sh
sim tap 328 84
sim type https://en.wikipedia.org/wiki/Spaced_repetition
sim tap 200 460
sim shot
sim launch
sim shot
```

First run: actions 020–032. Fresh repeat: request 2 reset, actions 053–060. [Pending import](shots/s4a/055-tap.png), [success but empty Sources](shots/s4a/056-shot.png), [empty Today](shots/s4a/058-tap.png), [source appears after relaunch](shots/s4a/059-launch.png), [readable article](shots/s4a/060-tap.png).

## 2. Move to To read does not stick

**Severity:** major. **Screen:** reader menu and Sources. **Repeat:** twice, then checked after relaunch.

On the ordinary fixture, rename The Story Spine to the 80-letter payload (actions 286–289). Open it from Done. Expected: Move to To read persists and the source moves into To read, like marking a Mail message unread. Actual: Finish appears temporarily in the reader; returning to Sources leaves it in Done. Reopening shows the completed state again and offers Move to To read again. Relaunch still leaves it in Done. This describes the observed outcome, not a diagnosed storage cause.

```sh
sim tap 375 84
sim tap 110 526
sim tap 60 84
sim tap 180 513
sim tap 375 84
# Menu again offers Move to To read. Repeat:
sim tap 110 526
sim tap 60 84
sim launch
```

First attempt 299–304; repeat 305–307. [Temporary Finish state](shots/s4a/300-tap.png), [still Done](shots/s4a/302-tap.png), [menu still offers the move](shots/s4a/304-tap.png), [still Done after relaunch](shots/s4a/307-launch.png).

## 3. Accessibility text size is ignored

**Severity:** major. **Screens:** Today, source, Review, Settings. **Repeat:** two maximum-size settings, second with relaunch.

Expected: the system's Larger Text setting enlarges text, as Apple's apps do. Actual: maximum and normal Settings content crops are pixel-identical. Relaunch at maximum keeps the same text size. The other inspected screens also remain at ordinary size. This is separate from D26's deliberate dark theme.

Request sequence: 5 maximum, 6 normal, 7 maximum then `sim launch`, 9 normal. Exact command arrays:

```json
["xcrun","simctl","ui","iPhone 18 Pro s4a","content_size","accessibility-extra-extra-extra-large"]
["xcrun","simctl","ui","iPhone 18 Pro s4a","content_size","large"]
```

[Settings at maximum](shots/s4a/212-tap.png), [normal](shots/s4a/213-shot.png), [relaunched at maximum](shots/s4a/214-launch.png), [comparison, in that order](shots/s4a/text-size-comparison.png). Other maximum-size evidence: [Today](shots/s4a/217-tap.png), [Review](shots/s4a/220-tap.png), [reader](shots/s4a/209-tap.png).

## 4. Keyboard covers Today Rename

**Severity:** major. **Screen:** fourth Continue reading row in Today. **Repeat:** different sources in the same fourth-row position.

Expected: the focused field scrolls above the keyboard, as in Notes. Actual: the keyboard covers the text and caret. Typing and Return save, but the edit cannot be read while typing. Upper rows and the tested Sources fields stay visible. F29 concerns New skill; this is a different field.

First run on The Testing Effect:

```sh
sim longpress 180 550
sim tap 110 610
sim shot
python3 codex-out/s4a/drive.py payload title300
sim key return
```

Repeat on Building Effective Agents after the first source moves to the top: long press (180,550), Rename (110,565), type emoji, Return. Actions 144–148 and 155–158. [First crop](shots/s4a/rename-keyboard-146-crop.png), [repeat crop](shots/s4a/rename-keyboard-156-crop.png).

## 5. Section indicator overlaps Finish

**Severity:** minor. **Screen:** The Story Spine reader, renamed to 80 A letters. **Repeat:** twice.

Expected: separate, readable touch targets; Books keeps reading controls from covering other controls. Actual: the section indicator sits over Finish, covering part of its label and tap area. The long title wraps to four lines; the short body puts Finish at the indicator's fixed position.

From the done source: `sim tap 375 84`, then `sim tap 110 526` (Move to To read). Screenshot after the change. Back, reopen, and repeat. Actions 299–305. [First crop](shots/s4a/finish-overlap-301.png), [repeat crop](shots/s4a/finish-overlap-305.png). This overlap is independently visible even though the status change in finding 2 does not persist.

## 6. Chapter jump hides heading

**Severity:** minor. **Screen:** large book reader. **Repeat:** Chapter 40 and Chapter 39, then Chapters 39 and 40 again after a fresh big-library start.

Expected: selected heading visible below the fixed toolbar, as in Books chapter navigation. Actual: the heading's top is hidden behind Back.

```sh
sim tap 200 763
sim swipe 210 815 210 430 0.1
sim tap 80 816
# Reopen Sections; its list remains at the end:
sim tap 200 764
sim tap 80 772
```

Actions 093–098, after the timed-out taps eventually reached the app. [Chapter 40 crop](shots/s4a/book-jump-header-crop.png), [Chapter 39 crop](shots/s4a/book-jump-repeat-crop.png), [fresh-library Chapter 39](shots/s4a/book-fresh-repeat-header.png), [fresh-library Chapter 40](shots/s4a/book-fresh-chapter40-header.png).

## 7. First launch gives a caught-up state

**Severity:** minor. **Screen:** Today. **Repeat:** two fresh empty-library launches.

Expected: first-source guidance pointing to +, rather than a zero for its own sake (the sweep's explicit requirement). Apple empty-library screens provide an actionable next step. Actual: “0 of 10 min” and “All caught up. Read something new.” occupy the top of an otherwise empty page. Sources has clear + guidance; Today does not.

Request 1 fresh start on the initialized empty library; `sim shot`. Request 2 `['sim.ts','reset']`; `sim shot`. [First launch](shots/s4a/001-shot.png), [second launch](shots/s4a/033-shot.png).

## 8. Status-bar tap does not scroll Sources to top

**Severity:** minor. **Screen:** big Sources list. **Repeat:** two taps.

Expected: iOS status-bar scroll-to-top, as in Mail and Safari. Actual: both taps leave the same bottom rows visible. Swiping back works; navigation is not blocked.

After reaching the bottom (075): `sim tap 200 32`, then `sim tap 80 32`. [First tap](shots/s4a/076-tap.png), [second tap](shots/s4a/077-tap.png). Swipes 078–085 return to the top. A separate full bottom-and-back traversal ran again in 120–140.

## Coverage and what worked

| Task | First pass | Repeat / outcome |
|---|---|---|
| Empty library | 001–032: Today, drawer, Sources, Archive, no-match search, empty review, new skill, Settings, first import | 033–060 after reset. Empty Sources/Archive explain next steps; no-match search stays above keyboard; empty review explains nothing is due. New skill saves. Import needs relaunch, finding 1. |
| Big source list and search | 061–087: bottom and back; search learning | 120–142: bottom and back; search guide. Rows and search results fit; no blank rows observed. |
| Big Review | 105–108 | 115–117. Opens, shows answer and all rating controls. |
| Busiest skill | AI, 110–111, expands all 67 To read sources | 113. Header and list fit. |
| Large book | 088–098: opens, Chapters 40/39 via outline | Fresh second open 332–337; outline 338–340, Chapter 39 jump 341 and Chapter 40 jump 344 reproduce the clipping. Driver timing limits below. |
| Unusual titles | 144–181: 300 chars, emoji, Arabic, Japanese, 80-letter word | 270–290 fresh repeat; Sources truncates, reader wraps. Emoji/Arabic headers also repeated 312/314. |
| Search and title references | All five names fit search Recent twice (202/331); long title Review 152/220/236 | Word title Review 297; emoji title Review 310. Arabic/Japanese fixture sources have no exercises. |
| 60-character skill | 193–204: created, assigned, checked header, byline, picker and search | Today 226, drawer 228, Review chip 219; fresh second creation 327–329 also fits. |
| Notes | Emoji entry 176, reopened 178; 2,000 words entered and exact full payload found after reopen in note2000-tree.txt | Emoji entered again 293; second 2,000-word entry 319–323 also saved exactly, checked against note2000-repeat-tree.txt. |
| Maximum text size | Requests 5/6, screenshots 205–213 | Request 7 + relaunch 214; restored by 9. Finding 3. |
| Light/dark | Initial dark screens; light request 8: Review 221, Today 222, source 223, Settings 229 | Dark request 10: 230/232/233/236. Light request 11: 237/238/239/241. Ore stays dark, consistent with D26. |
| Small iPhone | Today 247, reader/bar 249, written answer with keyboard 255, + sheet 264 | Today 263, reader/bar 262, keyboard 258–259, + sheet 266. Fits. Review menu dismisses keyboard and preserves draft (256–257). |

## Could not test and measurement limits

- **Share-card skill chips:** request 12 opens Wikipedia in Safari (244), but the app-bound driver cannot tap Safari's controls. Action 245 times out while locating `com.tylerpoelking.ore.phone`. The native share card was not reached; no claim about its layout.
- **Frame freezes / exact app load times:** screenshots inspect settled frames, not frame rate. Command durations include XCUITest, touch synthesis and screenshots. The large book repeatedly stalled `Find the Application` before touch synthesis; an outline tap timed out at 60 seconds but completed later. That is not proof of an app freeze. Opening Sources and the book sometimes leaves the old screen in the first screenshot, then finishes on the next (063–064, 088–089, 120–121). The log preserves these observations without inventing app-only timings. [Commands over one second](commands-over-one-second.csv) lists every measured command above that threshold through the completed tests; these are driver wall times, not app load times.
- **Long typing:** the 2,000-word type call exceeds the driver's 60-second reply limit while the typing event continues. Both runs eventually completed and the exact saved 2,000-word payload was verified after reopening in each. No claim of an app freeze from that timeout.
- **Appearance:** iOS light/dark changes do not select Ore's optional light reading surface. D26 chooses dark chrome. The system toggles were tested; a separate light reading-page preference is not implied by them.
- AI and live cross-device sync are outside this scratch-library audit.

Restored the ordinary fixture on iPhone 18 Pro s4a with request 16; [final Today screen](shots/s4a/345-shot.png). System text size is back to `large`.

No source-code or findings-registry changes were made: the sweep instructions allow writing only under `codex-out/s4a/`. The report provides verified findings for later triage.
