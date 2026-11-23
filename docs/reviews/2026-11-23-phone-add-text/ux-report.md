# iPhone Add text UX audit — PR #519

Tested the supplied WebKit apps, using only ports 1761/1762/1763 and the `ux` scratch libraries. The 96 core phone input journeys cover 390×844 and 375×667, dark and light browser appearance, touch taps, Today’s +, a skill’s Add, and the empty-active-library hint. Inputs include a typed/short pasted note, a 6,125-word article, a rich answer with headings/list/code, and two links. Also covered interrupted drafts, slow adds, failures/retries, duplicate adds, keyboard clearance, Undo/Redo, filing, and search. Mac comparisons use its 1280×800 Add box. Screenshots are 2×. Native iOS keyboard, Paste menu, autocorrect, VoiceOver speech, native scrolling/gesture delivery, lock/background/relaunch, and the simulator remain unverified; no simulator or server was started. Empty-library journeys archive the seeded sources through the app, rather than altering library files. No project file was changed.

## Findings

### UX-1 — A finishing add erases the next draft

**S1 — data loss · iPhone.** Two fresh-page reproductions; Mac comparison twice preserves the second draft.

1. From a fresh phone page, open Today’s +.
2. Paste a rich note containing an image whose download is still pending, and tap Add. The reproduction script holds only `http://localhost:1763/ux-race.png` to make this deterministic.
3. Press Esc while the first note is being added. Open + again.
4. Replace the selected text with a different note, `UX second draft must survive`, and leave it unsent.
5. Allow the first image download/add to finish.
6. The first source opens and closes the second sheet. Go Back, then open + again.

**Expected:** The first add may finish and notify, but the current sheet and its unsent text survive. **Actual:** The second sheet is dismissed and its draft is empty on reopening. The first operation removes the shared draft and invokes its old close callback against the new sheet. This loses a learner’s second thought without their submitting or discarding it.

**Parity:** Mac keeps the second Add box open, with all its text, when its first delayed add finishes. This difference has no exception in D349.

**Evidence:** [second draft before completion](shots/ux-race-phone-1-second-draft.png), [first add takes over](shots/ux-race-phone-1-landed.png), [phone trace](race-phone-1.json), [second phone trace](race-phone-2.json), [Mac preserves draft](shots/ux-race-mac-1-landed.png), [Mac trace](race-mac-2.json). Runner: `node codex-out/ux/race.cjs`.

**Suspect:** `apps/desktop/src/phone/AddLink.tsx:61` deletes the draft and calls `onAdded`/`onClose` without checking whether that instance is still open. `apps/desktop/src/phone/PhoneApp.tsx:1558` closes whichever Add sheet is current. The Mac checks its mounted/open state in `apps/desktop/src/Add.tsx:175`.

### UX-2 — Reopening a rich paste silently drops its formatting

**S2 · iPhone.** 8/8: twice at each size/appearance combination. Mac preserves formatting in 2/2 comparisons.

1. From a fresh page, open +.
2. Paste an answer carrying both plain text and HTML: a heading, a subheading, two bullet items, and a code block. Exact clipboard payloads are in `deep.cjs`.
3. Press Esc, then open + again. The original words return, selected.
4. Tap Add and read the saved source.

**Expected:** The recovered draft adds the same source as an uninterrupted paste. **Actual:** The source contains plain prose; the subheading, bullet structure, and code block have disappeared. The interrupted reader’s body contains **0 headings, 0 list items, 0 code blocks**, versus **1 subheading, 2 list items, 1 code block** in the corresponding Mac result. The text field itself gives no indication that the clipboard’s richer representation has been discarded.

**Parity:** The Mac keeps the HTML alongside its draft. D342’s interruption protection and D349’s rich-paste parity should extend to the whole paste.

**Evidence:** [phone after reopening and adding](shots/ux-deep-390-dark-1-rich.png), [small/light example](shots/ux-deep-375-light-2-rich.png), [phone trace](deep-375-light-2.json), [uninterrupted phone result](shots/ux-390-dark-rich-1-added.png), [Mac interrupted result](shots/ux-mac-interrupted-1-added.png), [Mac trace](mac-interrupted-2.json). Runner: `node codex-out/ux/deep.cjs`.

**Suspect:** `apps/desktop/src/phone/AddLink.tsx:23` stores only a string; `:39` initializes `pasted` to null every time. The Mac preserves it at `apps/desktop/src/Add.tsx:138`.

### UX-3 — Scrolling toward the start of a long paste dismisses the sheet

**S2 · iPhone.** 8/8 synthetic touch-handler reproductions across both sizes and appearances, plus 2/2 timed 250ms gestures. Native finger delivery needs simulator confirmation; this is not claimed as a native-device reproduction.

1. From a fresh page, open + and paste enough text to make the field scroll internally.
2. Scroll the field well below its beginning.
3. Drag downward inside the text field to return toward earlier text.

**Expected:** The textarea consumes the gesture while it has earlier text to show; the sheet stays open. **Actual in the WebKit handler test:** The sheet’s swipe-down handler consumes the downward gesture and dismisses Add. The field’s scroll position does not move toward its beginning. Reopening restores the words, but interrupts inspection/editing; a rich paste also hits UX-2. Example: field `scrollTop` stayed **6,829** while the sheet closed.

**Parity:** Mac’s Add has a scrollable field without this sheet-dismiss gesture. There is a phone reason for swipe-to-dismiss, but no reason for it to steal a textarea scroll away from its boundary.

**Evidence:** [closed sheet after gesture](shots/ux-deep-375-light-2-swipe.png), [trace with unchanged scroll position](deep-375-light-2.json), [timed gesture before](shots/ux-touch-1-before.png), [after](shots/ux-touch-1-after.png), [timed gesture trace](touch-2.json). Runner: `node codex-out/ux/deep.cjs`; `touch.cjs` provides a timed touch-handler reproduction and before/after screenshots. The tests dispatch touch-shaped events because this desktop WebKit rejects the `Touch` constructor; they exercise Ore’s actual listeners but do not synthesize native scrolling.

**Suspect:** `apps/desktop/src/phone/sheet.ts:48` recognizes only `.pick-list` / `[cmdk-list]` as internal scrollers. It does not recognize the new textarea. At `:78` it prevents the field’s scroll and translates the sheet.

### UX-4 — Adding text shows no progress state

**S2 · iPhone.** Reproduced twice with a held image download, and twice again in UX-1. Mac comparison twice shows “Adding…” and its working indicator.

1. From a fresh page, open + and paste rich text with an image.
2. Tap Add while the image request takes time to complete. `slow.cjs` deterministically holds that request.
3. Look at the sheet during the wait.

**Expected:** A visible working indicator says the source is being added, as required by the interaction checklist. **Actual:** The field becomes read-only and both buttons dim, but the sheet still says only “Add” and “Choose a file or photo.” There is no “Adding…” label or working indicator within the sheet. The learner cannot distinguish progress from a dead control. Return during the wait does not add a second source, and releasing the request completes the add.

**Parity:** Mac’s Add displays “Adding…” with `Working`. D349 supplies no phone exception. The imported `Working` component in `AddLink.tsx` is used for queued-link reading, not this text-add wait.

**Evidence:** [phone wait](shots/ux-phone-slow-1.png), [repeat](shots/ux-phone-slow-2.png), [phone trace](slow-1.json), [Mac wait](shots/ux-race-mac-1-busy.png), [Mac trace](race-mac-2.json). Note: `slow-*.json`’s `statusCount` includes a page-wide status region; it is **not** an adding indicator in the sheet. `race-phone-*.json` measures the dialog’s `.working` count directly: zero.

**Suspect:** `apps/desktop/src/phone/AddLink.tsx:110`–`:115` render only the error and the unchanged button labels when `busy` is true. The Mac renders `Working` in `apps/desktop/src/Add.tsx:255`.

## Known rows seen again

No known fixed row was observed returning in its original form. F550’s rejection of ordinary text is fixed in these runs. F464/F449’s plain-text draft recovery works; UX-2 is the newly relevant rich-paste case. F160’s missing Undo does not recur. The listed out-of-scope open rows were not re-reported.

## What passed

- Ordinary text adds immediately and opens the reader, with an “Added” toast and Undo.
- A 6,125-word article adds as one source, with its first-line title and ending paragraph present.
- An uninterrupted HTML paste preserves the tested subheading, list, and code block.
- Two links remain two inbox entries, rather than becoming one text source; a refused fetch says the Mac will try it.
- Add remains reachable above a simulated 291px keyboard at both viewport sizes, including the long paste.
- The long textarea is height-limited and internally scrollable; it does not push Add off-screen.
- Return submits and Shift+Return inserts a line in typed text.
- Plain drafts survive Esc and tapping outside, reopen selected, and clear after successful Add.
- General and Learning-skill drafts stay separate; returning to each restores its own words.
- Adding from Learning files the new text under Learning and opens it.
- Undo removes the text from Today, Sources, the skill page, and search; Redo restores it.
- The empty-active-library hint includes “any text”; following its + instruction adds and opens a first active source.
- A failed `add` and a failed `inbox` retain their full input; clearing the injected failure and pressing Add/Return succeeds (8/8 each, both sizes and appearances).
- Adding the same text again opens the existing source and says “Already here” (8/8).
- Blank input disables Add. The sheet’s accessible name is “Add a source”; the field’s is “Link or text.”
- A refused add retains the text, focuses the field, and links its alert through `aria-describedby` with `aria-invalid=true`.

## Parity observations and three hesitation moments

| Moment | Phone versus Mac | Judgment |
| --- | --- | --- |
| Text entry, Return, Shift+Return, uninterrupted rich paste | Same basic behavior | Parity achieved |
| Skill filing | Phone uses the originating skill; Mac also offers a picker before Add | Origin-based filing is explicit in D349; no incorrect filing observed |
| Link lists | Phone saves to inbox and displays Coming in; Mac imports through its Add flow | Explicit D349 phone reason |
| Local file paths | Phone treats them as words; Mac reads paths | Explicit D349 exception; code reviewed, native filesystem-picker work outside this audit |
| Draft recovery | Phone recovers words but loses HTML; Mac retains both | UX-2 parity gap |
| Finish of a dismissed add | Phone deletes the newer draft; Mac preserves it | UX-1 parity gap |
| Wait | Phone disables controls; Mac says Adding… | UX-4 parity gap |
| Long-field scroll | Phone’s sheet handler steals a downward scroll; Mac has no such gesture | UX-3, with native confirmation outstanding |
| Input preview | Mac identifies Text/word count or the number of links; phone shows no classification | Observable parity difference; not a separate finding without a demonstrated wrong save |
| Undo while reader is open | Both leave the source visible in the reader; it is removed from active lists | Shared behavior, not a phone-only regression |
| Appearance | Browser dark/light media tested; main phone chrome remains dark, while the reader follows its page appearance | No color contrast or clipping failure observed in the tested Add flow |

The three strongest hesitation moments, each repeated at least twice:

1. **“Did Add start?”** The frozen field and dim Add button give no answer during the image wait (UX-4).
2. **“Where did my next note go?”** An earlier save takes over the sheet and empties the draft I am now writing (UX-1).
3. **“Why did Add close when I tried to reread the beginning?”** The downward text gesture is interpreted as dismissing the sheet (UX-3; synthetic-handler evidence).

## Reproduction notes

All runners are CommonJS scripts launched with `node` from the repo root and connect to the supplied WebKit server. They create and close contexts sequentially, never more than one at a time. Fresh pages within a *shared* context retain IndexedDB/localStorage in this environment, so completed repeats use fresh contexts. Early harness selector/navigation failures were excluded from findings. The phone supports `__ORE_FAIL`; its core code has no matching `__ORE_SLOW` hook, so phone wait tests hold a same-origin image fetch instead. Mac wait tests use the supplied `__ORE_SLOW` hook.

Coverage artifacts: `matrix.cjs` / `matrix.log` (32 Today cases), `skill-empty.cjs` / `skill-empty.log` (8 skill notes plus 8 empty-library notes and their lifecycle checks), `entry-matrix.cjs` / `entry-matrix.log` (48 other skill/empty cases), `errors.cjs` / `errors.log` (8 phone failure/retry/duplicate journeys and 2 Mac comparisons), and `mac.cjs` / `mac.log` (8 Mac input/interruption comparisons). All 96 core phone submission journeys completed; all 80 measured keyboard layouts kept Add in reach. The remaining 16 short-note skill/empty cases exercised the lifecycle rather than measuring keyboard geometry. Slow-add fault tests used 390×844 dark mode. The natural metadata-only error says “text is empty: only frontmatter, no text to read”; synthetic failure wording is test-supplied and is not evidence of real phone error wording.

The Mac skill-entry comparison also passed twice: Learning is selected in Add, survives Esc/reopen, and appears on the saved source (`mac-skill-1.json`, `mac-skill-2.json`).

The Mac empty-active-library hint was also checked twice after archiving both To read and Done through the UI. Its ⌘N instruction opens Add and the submitted note opens in the reader (`mac-empty-1.json`, `mac-empty-2.json`). The phone’s + wording is the appropriate equivalent. `git diff --stat` and `git status --short` were empty at completion; all scripts, traces, screenshots, and this report are confined to `codex-out/ux/`.
