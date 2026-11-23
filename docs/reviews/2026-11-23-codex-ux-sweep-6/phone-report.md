# iPhone UX findings — round 6

Tested checkout `a47f392c679094e00268f7744fbb856867694999` through the supplied phone build at `http://localhost:1766/` and shared WebKit connection. Completed two fresh-page, continuous learner journeys at 390×844: Today, two Fact exercises and a typed Explain answer, review end, reading and a highlight action, a source note saved and reopened, a link imported and opened, a skill and its Forge, Settings, and drawer organization. These were task journeys, not two timed twenty-minute endurance tests. Followed the working agreements, daily-session description, findings registry, prior five phone reports, sweep history, relevant decisions and iOS-check skill. Investigated three points of hesitation below, twice at 390×844 and twice at 375×667, with touch and 2× screenshots. Skipped the excluded known rows, F493/F494, pending-write Undo, artificial save failures, exhaustive repetitions of prior sweeps, visual taste, and Mac pages. Native keyboard, system gestures/selection handles, haptics, background/relaunch, simulator, iCloud, real AI and native network handoffs remain unverified. Only `codex-out/phone/` was written; no implementation, registry, installed-app or real-library changes were made.

## Findings

**No new S1, S2 or S3 finding confirmed.** The three suspicious moments did not survive inspection and repeat checks. This is a bounded pass over the supplied seed, not a claim that every phone feature or Mac parity requirement is complete.

### Checked and rejected as findings

1. **The long skill name appeared to crowd the try’s actions.** Open the drawer → Distributed Systems and Consensus Protocols for Very Large Clusters → Forge → +; add `Explain consensus`, with `On the bus`, and open it. The location text wraps, but its last text rectangle ends about 6 pt before the actions icon begins. Try actions opens the Remove sheet on one tap and the sheet dismisses on an outside tap. Passed 4/4 fresh-page checks, twice at each size, both with the supplied text scale and a separate standard-scale measurement. The apparent overlap in the exploratory screenshot was not a hidden control. Evidence: `confirm-results.json`, `confirm-long-390-1.png`, `confirm-long-390-2.png`, `confirm-long-375-1.png`, `confirm-long-375-2.png`, and corresponding `confirm-long-standard-*` screenshots. Code inspected: `apps/desktop/src/Forge.tsx:316` (location links), `apps/desktop/src/styles.css:1781–1787` (header layout).
2. **The plan fields and small action icon looked below 44 pt.** On the same try page, the When textarea itself measures 34 pt, but its enclosing, actionable label is 44 pt tall. A tap in the label focuses the field in all four fresh runs. The actions icon and location links have a 13 pt touch extension on every side. These are not the unextended new-try fields from F505. Evidence: `confirm-results.json`; same screenshots. Code: `apps/desktop/src/Forge.tsx:470` wraps the field in a label; `apps/desktop/src/styles.css:3487–3493` supplies the touch extensions and label minimum.
3. **Leaving a note uses “Source”, then Back.** The accessible labels change because the first action returns from the note to its source; the second leaves the source. Both transitions went to the expected place, and the note survived reopening. Passed 4/4 dedicated fresh-page checks, twice at each size, in addition to both broad journeys. Evidence: `navigation-results.json` and `confirm-note-{390,375}-{1,2}.png`. No missing save or wrong destination reproduced.

## Known rows seen come back

None confirmed. No excluded open row is re-reported.

## What passed

- Each broad journey rated two Fact exercises and one typed Explain exercise; manual key-point marking provided a working fallback without AI.
- Leave review reached the end screen; Done returned to Today with recorded review time.
- Passage selection offered highlight actions; the second journey added a highlight and showed the new Collected count.
- Source notes in two different sources survived leaving and reopening with their exact new text.
- Two supplied article links imported, appeared in Today and opened in the reader.
- A new try appeared immediately in the Forge and opened its saved plan in each journey.
- The first journey recorded a try’s use and showed its reflection on the try page.
- The long-named skill’s Forge and try page remained navigable at both widths.
- The daily goal changed to 20 minutes and reached Today; the second journey’s daily plan survived Settings reopening.
- Learning and Habits moved into Craft in the respective journeys, with the drawer immediately showing the new placement.
- The try’s actions sheet opened and dismissed at both sizes without losing the plan.

## Evidence and limits

`driver.cjs` connects to the supplied WebKit server; it launches no browser or server. `actions.log` records exploratory commands, including corrected locator/harness mistakes. `journey2.cjs`, `journey2-rest.cjs` and `journey2.log` preserve the second journey. `confirm.cjs` and `confirm-navigation.cjs` are bounded four-run confirmations. The remaining screenshots show the two journeys’ review end, notes, imported source, try page and drawer organization. One context and one page were open at a time.

Ordinary actions used Playwright taps. Long presses used stationary touch events at the actual row’s coordinates. Text selection used a DOM Range to reach Ore’s actions; native selection is not certified. Import routes served only the two `https://example.org/ore-bus-r6*` test articles, through the real phone importer, to avoid native-fetch/CORS differences. No saved state or command output was fabricated.

Desktop-hosted WebKit reports a 13px system body font, so Ore sets `--type: 0.765`. The broad journeys used that supplied environment unchanged. The Forge confirmation also measured `--type: 1` to check that its target/layout conclusions did not depend on the smaller type. This was a CSS measurement, not a native Dynamic Type or keyboard test. Native font changes and their field resizing are outside this result.
