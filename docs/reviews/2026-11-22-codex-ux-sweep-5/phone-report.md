# iPhone UX findings — round 5

Tested checkout `43127940ebb4c533b494cfad382918c4f3e59fa4` using only the supplied iPhone app at `http://localhost:1766/` and connected WebKit. Completed two continuous, fresh-page commute-style journeys at 390×844: Today, two Fact ratings and one typed Explain answer, session end, source reading/highlight/note, link import, a skill and its Forge, Settings, and drawer organization. These were task journeys, not timed 20-minute endurance tests. Then confirmed the three findings twice each at 390×844 and twice each at 375×667, with touch and 2× screenshots. Read the working agreements, daily-session description, findings registry, sweep history, four preceding phone reports and iOS-check rules. Skipped their exhaustive individual-control tests, the excluded open findings, F493/F494, pending-write Undo, visual taste and Mac-only/deferred features. Native keyboard, native selection handles, system undo gestures, simulator, haptics, real AI and iCloud sync remain unverified. Only this folder was written; no implementation, findings-registry, real-library or installed-app changes were made. One context and one page were open at a time; all were closed afterward.

## Findings

### 1. Back drops a plan correction when its save fails

**S2 · iPhone · New**

1. From a fresh page, open **Learning → Forge → +**.
2. Enter **I’ll…** = `Explain one idea`, **When…** = `On the bus`, then tap **Add**.
3. Open that try. Replace **When** with `After I board the train`.
4. Set the supplied failure hook: `window.__ORE_FAIL = { try: "Could not save: disk full. Free space and try again." }`.
5. Tap the top-left Back button to return to the Forge. Wait for the error.
6. Clear the hook (`window.__ORE_FAIL = {}`) and reopen the try.

**Expected:** Preserve the failed correction for retry, or keep the editor open on it. Back is a normal way to save an in-place edit; an unsuccessful save must not discard the only copy of the new words.

**Actual:** The Forge opens, then shows the error. Reopening the try shows `On the bus`; `After I board the train` is gone. There is no retained draft or retry action. The existing saved try remains intact: this loses an attempted correction, not previously saved library data.

**Reproduced:** 4/4 dedicated fresh-page runs, two at each size; also seen in exploration. No delay, AI, Undo or direct library write was involved.

**Screenshots:**

- `codex-out/phone/failed-plan-before-390-1.png`
- `codex-out/phone/failed-plan-error-390-1.png`
- `codex-out/phone/failed-plan-reopened-390-1.png`
- `codex-out/phone/failed-plan-before-375-1.png`
- `codex-out/phone/failed-plan-error-375-1.png`
- `codex-out/phone/failed-plan-reopened-375-1.png`
- The corresponding `-390-2` and `-375-2` files record the second confirmation at each size. Exact results: `failure-results.json`.

**Code:** `apps/desktop/src/Forge.tsx:441–453` keeps the correction only in `PlanField` state and invokes a save on blur without awaiting or retaining its result. `Forge.tsx:148–150` reports the failure but does not keep the attempted value. `apps/desktop/src/SkillPage.tsx:194` replaces `TryPage` with `Forge` as Back changes the subpage, destroying the local field state. This is the app's ordinary navigation and failure handling; the hook only refuses the write.

### 2. Returning from the Forge erases a new try’s draft

**S2 · iPhone · New**

1. From a fresh page, open **Learning → Forge → +**.
2. Type `Explain one idea before opening my notes` into **I’ll…** and `On the bus home` into **When…**.
3. Before tapping Add, tap the top-left Back button to return to Learning.
4. Open **Forge → +** again.

**Expected:** Recover the unfinished plan and cue after the interruption, as Add a link and the Forge’s reflection draft do. Back should not silently discard the only copy.

**Actual:** Both fields are empty. There is no draft recovery, warning or Undo. This is unsaved-input loss; a try explicitly submitted with Add survives navigation.

**Reproduced:** 4/4 dedicated fresh-page runs, twice at each size, plus both broad journeys. No failure hook or other injected state is needed.

**Screenshots:**

- `codex-out/phone/draft-before-390-1.png`
- `codex-out/phone/draft-lost-390-1.png`
- `codex-out/phone/draft-before-375-1.png`
- `codex-out/phone/draft-lost-375-1.png`
- Matching `-390-2` and `-375-2` files record the second confirmations. Values before and after: `confirm-results.json`.

**Code:** `apps/desktop/src/Forge.tsx:407–408` initializes both draft fields to empty component state. Leaving the Forge unmounts it through `apps/desktop/src/SkillPage.tsx:191–198`; reopening also resets its `adding` state (`Forge.tsx:347`). Unlike `Forge.tsx:188–193` for a reflection, there is no retained draft. The phone's Back route is `apps/desktop/src/phone/PhoneApp.tsx:1262`.

### 3. New-try fields are shorter than the required 44-point touch target

**S3 · iPhone · Measured iOS-rule violation**

1. From a fresh page, open **Learning → Forge → +**.
2. Inspect the blank **I’ll…** and **When…** fields before entering multiline text.
3. Measure their bounds and inspect the area immediately above/below each field.

**Expected:** At least 44×44 points of actionable area for each field, per the project's iOS-check Touch rule.

**Actual:** Each field is **34 points high** in the supplied WebKit environment, with no surrounding label or extended hit area. The adjacent Add button is 44 points high. With Ore's text scale set to the standard iPhone baseline (`--type: 1`), each field is still only **39 points high**. This is a small entry target in a form used to capture a plan on the move.

**Reproduced:** 4/4 measurements, twice at each size; all four also measured at the standard text baseline. **Caveat:** WebKit's touch adjustment successfully focused When after a tap 20 points below its centre, although `elementFromPoint` identified the containing form. This is a geometric target-rule failure, not a reproduced dead tap or a claim that the fields are unusable. Native keyboard zoom was not tested.

**Screenshots:**

- `codex-out/phone/target-near-390-1.png`
- `codex-out/phone/target-standard-type-390-1.png`
- `codex-out/phone/target-near-375-1.png`
- `codex-out/phone/target-standard-type-375-1.png`
- Matching `-390-2` and `-375-2` files record the second confirmations. Bounds, actual hit elements, focus and font sizes: `confirm-results.json`.

**Code:** `apps/desktop/src/styles.css:1798–1799` uses a grid aligned at its top and a 34px minimum for these fields. The phone's 44px rule at `styles.css:3493` covers plan rows and several Forge buttons, but not `.forge-add .field`. `apps/desktop/src/Forge.tsx:429–431` renders the fields directly in a div, without a larger clickable label.

## Known rows seen come back

None confirmed. Findings 1–2 concern a failed existing-plan correction and an unfinished new-try draft, respectively; neither is F459/F481's pending-write Undo class. F464's repaired Add-link draft is a separate component. F484/F491 concern the drawer editor and collection targets, not the Forge fields. No excluded open row is re-reported.

## What passed

- Two Fact exercises and one typed Explain answer completed in each journey; manual marking/rating supplied a usable phone fallback without AI.
- Leaving review reached the end screen; Done returned to Today with the recorded minutes.
- Highlights increased Collected in both sources; source notes survived Back and reopening in both journeys.
- A supplied article imported through Add a link, appeared in Today and opened in each journey.
- An initially too-short article was refused with a reason and the Mac fallback; no stub source was counted as a successful import.
- Submitted tries remained in the Forge, and successful When/If edits saved through Back.
- Recording a try's use returned to its page without waiting for unavailable AI.
- The long seeded skill name wrapped in the Forge and still allowed adding and opening a try.
- Daily-goal and plan changes reached Today; reopening Settings retained both journeys' plans and the second journey's sound change.
- Moving Learning and Habits into Craft updated the drawer immediately in the respective journeys.
- The two new-try fields remained within the viewport at both sizes; no horizontal overflow accompanied the draft-loss reproduction.

## Evidence and limitations

`driver.cjs` connects to the supplied browser; it never launches one. `actions.log` records the exploratory journeys, including locator mistakes and corrected assumptions; those errors are not app findings. `confirm.cjs` and `confirm-failure.cjs` are bounded four-run confirmations. Replay from the repo root while the supplied services are running:

```sh
node codex-out/phone/driver.cjs < codex-out/phone/replay-input.txt
```

Ordinary actions use Playwright taps. Drawer long presses dispatch a stationary touch for 650ms. Text selection uses a DOM Range to reach Ore's selection actions; native selection handles are unverified. Imports intercept only `https://example.org/phone-bus-full` with `add-fixture.html`, exercising the real importer without browser CORS/native-fetch differences. No real site or native picker is certified.

This desktop-hosted WebKit reports 13px for `-apple-system-body`, causing Ore to set `--type: 0.765`. The broad journeys use the supplied environment unchanged. The target confirmation separately measures `--type: 1` so that finding does not depend on the harness's smaller text. No font-size or keyboard-zoom bug is reported. The failure test uses the phone's existing `__ORE_FAIL` hook; no served code, storage, command result or Undo history was rewritten.
