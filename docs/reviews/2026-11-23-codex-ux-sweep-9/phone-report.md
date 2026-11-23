# iPhone UX findings — round 9

Tested checkout `01bb4985019462bfc039fa0c024f48aa67cef1c8` at the supplied `http://localhost:1766/`, using the supplied WebKit connection, touch and 2× screenshots. Completed two continuous learner journeys in separate fresh browser storage at 390×844: Today, two Fact ratings and a typed Explain, review ending, reading and highlighting, source notes with links, Archive/Restore, a skill and its Forge, Settings, link capture and drawer organizing. These were task journeys, not two timed twenty-minute endurance tests. Extended coverage to note-text search, backlinks, exercise-history details and hardware-keyboard review. Rechecked chapter recall completion and Undo, the skill note's place and the Dig's targets. Read the working agreements, daily-session document, findings register, sweep history, all eight earlier UX sweeps' passed sections and the iOS checklist. Skipped the excluded rows, Sources filters/multi-selection, pending-write Undo, Claude Academy, pure taste and Mac pages. AI chat is explicitly deferred on the phone by D78.3/D145; a long tutor conversation was therefore not tested or reported as missing parity. Confirmed each finding twice at 390×844 and twice at 375×667. Only `codex-out/phone/` was written. All owned pages and contexts are closed.

## Findings

### 1. Back after following a note link skips the note and returns to Today

**S2 · iPhone · New**

1. From a fresh page, open **Building Effective Agents** on Today.
2. Tap **+ Note**. Type `Bus link: `, then `[[Testing`.
3. Pick **The Testing Effect: Why Retrieval Beats Rereading** and let the note save.
4. Tap the inserted link. The Testing Effect opens correctly.
5. Tap its top-left **Back**.

**Expected:** Return to the originating source note, retaining its place, so the learner can continue connecting the two ideas.

**Actual:** Back closes the reader and returns to Today. The originating note is no longer open. The learner must find Building Effective Agents again and open Note. Its writing is retained; this is a broken return path, not data loss. It interrupts a routine comparison between sources.

**Reproduced:** 4/4 final fresh-storage confirmations, twice at each size, plus the first broad journey in the opposite direction. No failures, delays or AI responses were injected.

**Screenshots:** `codex-out/phone/origin-note-{390,375}-{1,2}.png`, `link-destination-{390,375}-{1,2}.png`, and `link-back-{390,375}-{1,2}.png`. For example: [origin note](origin-note-390-1.png), [linked source](link-destination-390-1.png), [Back lands on Today](link-back-390-1.png).

**Code:** `apps/desktop/src/phone/PhoneApp.tsx:818–824` replaces the current source ID and clears the note state; `:835–839` uses that replacement for note links. The reader's Back and edge-back handlers at `:1162–1164` only clear `openId`. No originating source/note is kept for a return. These are application navigation handlers, independent of the Tauri shim. The iOS checklist requires Back to return through pushed screens and preserve the learner's place.

### 2. “Linked from” opens the article instead of the note it quotes

**S2 · iPhone · New**

1. From a fresh page, create the Building Effective Agents note and Testing Effect link described in finding 1.
2. Follow the link to **The Testing Effect**, then tap **Note**.
3. Find **Linked from**, which shows **Building Effective Agents** and the sentence `Bus link: The Testing Effect: Why Retrieval Beats Rereading`.
4. Tap that backlink row.

**Expected:** Open the linking note at the quoted sentence (and heading, when present). The row shows the learner's writing, so that writing should be the destination.

**Actual:** The source's article opens, starting with **Workflows and agents**. The note remains closed. The sentence the learner tapped is nowhere on the visible page; tapping **Note** again reveals it. This differs from finding 1: the forward destination of the backlink is wrong even without using Back.

**Reproduced:** 4/4 final fresh-storage confirmations, twice at each size, plus the second broad journey. Every run verified the note still contained the exact linking sentence afterward.

**Screenshots:** `codex-out/phone/backlink-before-{390,375}-{1,2}.png` and `backlink-after-{390,375}-{1,2}.png`. Examples: [quoted note row](backlink-before-375-1.png), [article opened instead](backlink-after-375-1.png).

**Code:** `apps/desktop/src/Notes.tsx:359` passes only `l.from` when the backlink is tapped; the displayed heading and line at `:362–364` do not become a note destination. `apps/desktop/src/phone/PhoneApp.tsx:835–839` clears `noting` and opens the item as a source. `:818–824` also clears note state. D39 defines this list as the linking note, its heading and its line. No harness routing, network response or AI is involved.

### 3. Exercise-history dates and ratings are unavailable by touch

**S3 · iPhone · New · Hover-only information**

1. From a fresh page, tap **Start review**, then **Start review** in the picker.
2. The seeded first Fact asks **What is the hypercorrection effect?** Tap **Sure** to reveal it.
3. Tap a separated dot in the history line above the rating buttons, such as the fifth historical dot. Hold it as well.

**Expected:** A touch action reveals the review's rating and date, as hovering does on the Mac. The iOS checklist explicitly prohibits information that depends on hover.

**Actual:** Neither tap nor a stationary hold reveals anything. The history remains eight coloured dots; the only accessible summary is `8 reviews; next in 6 days if Good`, which does not identify those historical ratings/dates. As a diagnostic only, moving a mouse over the same dot immediately reveals **Good · Oct 11**. The information exists but has no phone interaction. The dots are 8×8 points and are not focusable controls; the finding is the unavailable history detail, rather than counting each decorative dot as a separate target-size defect.

**Reproduced:** 4/4 final fresh-storage confirmations, twice at each size, plus the second broad journey. Each run recorded empty tooltip results after touch and a nonempty result after diagnostic hover. Review itself remains usable.

**Screenshots:** `codex-out/phone/history-touch-{390,375}-{1,2}.png` and `history-hover-diagnostic-{390,375}-{1,2}.png`. Examples: [touch gives no details](history-touch-390-1.png), [same dot with diagnostic hover](history-hover-diagnostic-390-1.png).

**Code:** `apps/desktop/src/Timeline.tsx:37–44` renders historical and future dots as `<i>` elements inside `Hint`, with no click/touch handler or focus stop. `apps/desktop/src/Hint.tsx:30–37` provides a hover/focus tooltip only. `apps/desktop/src/styles.css:3870–3873` sets the line and 8px dots. The same app component renders on the phone; the result does not depend on native APIs.

## Known rows seen come back

None confirmed. The recent chapter recall and Undo fixes (F511/F512/F514), skill-note place (F519) and Dig target sizes (F520) passed. F518's playlist handoff and F513's PDF error text were not rechecked. Excluded open rows and F493/F494 were not re-reported.

## What passed

- Both broad journeys rated two Fact exercises and one typed Explain, then returned through the end screen to Today with recorded review time.
- The phone's Explain fallback said grading runs on the Mac; manual key-point marking and rating worked in the second journey.
- A separate fresh-page check completed Review entirely by hardware keyboard, including opening the picker, two Fact ratings, a typed Explain, both manual key-point marks, rating and exit to Today (`keyboard-results.json`). The first broad journey also used hardware keys after opening Review.
- Both journeys saved a source note containing an ID-backed `[[` link; reopening retained the exact words and link.
- Following a note link opened the intended target, and the target's Linked from list appeared with the saved sentence.
- Both sources retained their notes through Archive → Archive list → open → Restore; restored sources were available again.
- A search for `Bus nine` found text just added to a source note and opened the matching note.
- Both reading journeys saved a Key point through the selection actions.
- Both journeys imported an original test article through Add a link and the real phone importer.
- Learning and Teaching each accepted a new Forge try and immediately displayed its saved text and When line.
- Settings retained both daily plans and reminder times through Back/reopen: `boarding the bus` / `07:45`, and `sitting down for the ride home` / `18:15`.
- Learning and Teaching moved up in the drawer through their long-press menus in the respective journeys.
- The long Learning note reopened at scrollTop **700**, unchanged from before Back.
- The Dig's Close, Cancel and Done each measured **44 points high**; Done saved its writing under the dated Dig heading.
- An original two-chapter Markdown source imported through the app. Recall this chapter measured **44 points high**; Done recorded recall, and Undo offered the chapter again while preserving its writing.
- No page errors were recorded.

## Evidence and limits

`confirm-results.json` records all four final runs. `confirm.cjs` is the bounded confirmation; `driver.cjs` connects to the supplied browser and creates only one owned context/page at a time. Replay from the repository root while the supplied services remain available:

```sh
printf "await runfile('confirm.cjs');\nquit\n" | node codex-out/phone/driver.cjs
```

`actions.log` preserves exploratory input, including corrected selector errors and an input line cut by the terminal. `journey2-*.cjs` preserves the second broad journey; the overly broad Testing Effect option selector in `journey2-read.cjs` was corrected interactively to the exact title, as the log shows. A preliminary confirmation selected an overlapping history dot; the final script uses the separated fifth dot. Another preliminary confirmation used the wrong direct-child selector for Back; the final script uses the actual descendant. Neither harness mistake is a finding.

Ordinary actions used Playwright taps. Long presses used stationary touch events; text selection used a DOM Range and mouseup to reach the app's highlight actions. Native selection handles, software keyboard, edge swipes, haptics, notifications, iCloud and simulator behavior remain unverified. No simulator, server, watcher or extra browser was started. The reminder setting's persistence is verified, not notification delivery. The two `example.org/ore-nine*` article requests returned original fixture HTML through Playwright routes, exercising the real importer without native-fetch/CORS differences. No saved state or command output was fabricated. Fresh journeys and confirmations used a new context after closing the previous one, because pages in the same context retain IndexedDB.

The supplied desktop-hosted WebKit uses Ore's smaller detected text scale (about 0.765). Navigation findings do not depend on geometry; the history dots' fixed 8px dimensions and hover-only handlers also do not depend on that scale. No native Dynamic Type result is claimed. The skill-note fixture was entered as text through the editor; its Markdown-looking headings are not claimed as rich-paste coverage.

Git status remained unchanged: only the pre-existing untracked `docs/reviews/2026-11-23-codex-ux-sweep-9/` directory. No application code, findings-register row, real library, installed app, other tester folder or service was changed. No fix, commit, push or application test-suite run was performed, per findings-only scope.
