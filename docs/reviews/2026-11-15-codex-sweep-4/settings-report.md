# Settings sweep

## 1. Coverage

Tested the release Mac page on port 1730 with bridge 1731 and the supplied year-old scratch library, plus the iPhone page on 1732, in the supplied WebKit server. Inventoried Settings before testing, including storage, defaults and decision references: [inventory.md](inventory.md) lists the controls and all 135 editable keyboard bindings. Checked changes while reading, while Review was paused on its source and resumed, on Home/Today, on the end screen, after reopening Settings, and in a fresh page; tested undo, reset, failed saves, constrained inputs and malformed YAML. **Nine findings below reproduced at least twice.** No application source or shared findings file was edited. All scripts, copied fixtures and screenshots are in this folder. Native login, tray visibility, OS hotkey registration, actual notification delivery, iCloud transport, paid/live AI execution and the optional 2 GB PDF-tool installation are outside what this harness can verify. No UI bug is inferred from those native mocks. Tutor and the three explicitly excluded known issues were skipped. The complete per-setting result/limit matrix is [coverage.md](coverage.md).

The supplied library is writable only through the app. Malformed YAML and older eligible drafts were therefore tested on copies inside this output folder, through the real core/CLI, using page routing to the same bridge URL; no extra server was started. The supplied seed's unseen exercises were all created today, so its ordinary queue correctly contains no new exercises yet. `new-cap-mid.cjs` changes only `created:` dates in its own copied fixture to November 12 to exercise the daily-cap case. AI is stubbed and `ORE_NO_ENRICH=1` for that copied-library bridge.

## 2. Findings

### SETTINGS-01 — Review keeps the old goal; its end screen uses the new one

**S2 · Mac · reproduced 2/2 through the same-window pause/resume path.**

1. From a fresh page, go Home and set Minutes a day to 30.
2. Start review. Answer one exercise, with about three minutes of active time.
3. Reveal the next answer and click **Open in source**. Review remains paused.
4. Open Settings with ⌘,. Lower Minutes a day to 5; close Settings; click **Back to Review**.
5. Spend another three minutes on the current exercise and rate it Good.
6. Observe the next exercise, then leave Review.

**Expected:** the open session and its ending agree on the goal. The new five-minute goal should be acknowledged when crossed, or an explicit session-only policy should consistently retain the old target.

**Actual:** no goal notice appeared at six minutes. Leaving immediately produced **Goal met** and a ring labeled **6 of 5 minutes today**. The second run started at six minutes, changed 30→10, and likewise gave no notice at twelve minutes, then ended at **12 of 10**. This is a mixture of old and new settings, with no explanation. A separate quick-quiz check also retained **0 of 20** after the saved goal became 10 (2/2); the same-window reproduction is the primary evidence.

**Evidence:** [paused-goal-no-notice-1.png](paused-goal-no-notice-1.png), [paused-goal-end-1.png](paused-goal-end-1.png), [paused-goal-no-notice-2.png](paused-goal-no-notice-2.png), [paused-goal-end-2.png](paused-goal-end-2.png); `mid-paused.cjs`, `evidence.log` (`paused-goal-*`). Playwright changed the page's clock to accrue time; actual ratings still went through the supplied bridge, with the normal three-minute cap per exercise.

**Suspected code:** `apps/desktop/src/Review.tsx:257` snapshots Today; `:635` refreshes it only for a new day; `:650` tests the saved goal. The ending reads a fresh Today at `:431`. D60, D246, D274.

### SETTINGS-02 — Turning new exercises off does not stop an open session serving unseen exercises

**S2 · Mac · reproduced 2/2 on an eligible-draft copy.**

1. Use a library with due exercises and unseen exercises created before today. Start fresh with New exercises a day set to 20.
2. Start a normal all-skills review, reveal the first answer and open its source.
3. In Settings, change New exercises a day to **0**; return to Review.
4. Use Later four times to reach the first interleaved unseen exercise.

**Expected:** exercises not yet encountered follow the newly saved cap, or the UI clearly says the change starts next session.

**Actual:** Review still showed an exercise explicitly labeled **New**, although a fresh `ore due` returned **zero** unseen exercises. The session retained its initial queue. No notice described a deferred setting. Not a source-specific review, which intentionally bypasses the daily cap.

**Evidence:** [new-cap-zero-mid-1.png](new-cap-zero-mid-1.png), [new-cap-zero-mid-2.png](new-cap-zero-mid-2.png); `new-cap-mid.cjs`, `clone-browser.cjs`, `evidence.log` (`new-cap-mid`). Setup difference from the provided seed is documented above.

**Suspected code:** `apps/desktop/src/Review.tsx:263` loads the queue only at session start; `:299` reconciles with `due --all`, explicitly bypassing new-exercise limits. D60/D144.

### SETTINGS-03 — iPhone Today does not refresh after a Settings change

**S2 · iPhone · reproduced 2/2.**

1. From a fresh phone page, note Today says **0 of 10 min**.
2. Open menu → Settings → Minutes a day → **5**.
3. Tap the back button **Today**.
4. Reopen Settings to confirm 5 is selected; reload the page to compare.

**Expected:** Today immediately shows the saved five-minute goal.

**Actual:** Today still showed **0 of 10 minutes today**. Settings saved the new value. Reload picked up the file correctly. Weekdays only and the other shared fields also lack an explicit refresh path; the live reproduction here is the goal. Changing Weekdays only persisted and produced **Today is off** after reload on Saturday.

**Evidence:** [phone-goal-home-1.png](phone-goal-home-1.png), [phone-goal-home-2.png](phone-goal-home-2.png), [phone-reloaded.png](phone-reloaded.png); `phone-settings.cjs`, `evidence.log` (`phone-goal-home`, `phone-settings-saved`, `phone-persistence`). Undo was subsequently tested through ⌘Z, which exercises the same history as native phone Undo; a missing toast is not reported as a bug because iOS has native gestures.

**Suspected code:** `apps/desktop/src/phone/Settings.tsx:36` saves without notifying Home; `phone/PhoneApp.tsx:1130` closes without incrementing its refresh tick. `Home.tsx:136` requires a reload/change/day signal.

### SETTINGS-04 — Undo restores the goal file but leaves Home showing the undone value

**S2 · Mac · reproduced 2/2 in a dedicated script, also seen during initial exploration.**

1. Fresh page → Home → Settings → Review. Set Minutes a day to 10, then 5.
2. Close Settings. Home correctly shows the five-minute goal.
3. Press ⌘Z and wait for the save.
4. Compare Home with reopened Settings or `skills.yaml`.

**Expected:** Home returns to 10 as part of undo.

**Actual:** the file contained `goal_minutes: 10`, but Home still said **12 of 5 minutes today** in the dedicated runs (initial exploration: **0 of 5**). Reopening and closing Settings corrected it. Undo's data operation succeeds; the display is stale.

**Evidence:** [home-undo-stale-1.png](home-undo-stale-1.png), [home-undo-stale-2.png](home-undo-stale-2.png); `home-undo.cjs`, `evidence.log` (`home-undo-stale`).

**Suspected code:** `apps/desktop/src/Settings.tsx:167` replays the setting without invalidating Home. `App.tsx:942` refreshes Home only when Settings closes. `ore.ts:22` broadcasts only selected other mutations.

### SETTINGS-05 — Several Settings changes have no undo history

**S2 · Mac · each listed control checked twice.**

1. Fresh page → Settings → General. Change Reading width Medium→Wide and press ⌘Z.
2. Repeat for Text size, Reading page, Reading font, Skill tags and Diagram style controls.
3. In Review settings, change Sound effects, Show in menu bar, or record a new quick-quiz shortcut; press ⌘Z.
4. In a fresh page with empty action history, open Keyboard shortcuts, change Go to Home to ⌃⌥H, then press ⌘Z.

**Expected:** the last setting change is reversed under the project rule “undo for every change.”

**Actual:** the new value remains. With earlier history, ⌘Z can instead undo an earlier unrelated setting or review. The ordinary shortcut reproduction was isolated in two fresh contexts to avoid an older shortcut reset accidentally making it look as though the new rebind had been undone.

Confirmed controls: **width, size, page, font, skill-tag appearance, diagram style-control mode, sound effects, menu-bar preference, quick-quiz rebind, ordinary keyboard rebind**. The menu-bar result concerns the saved preference, not native tray visibility. Open at login was not classified because the native mock cannot verify it.

**Evidence:** [local-settings-undo-1.png](local-settings-undo-1.png), [local-settings-undo-2.png](local-settings-undo-2.png), [local-switch-undo-1.png](local-switch-undo-1.png), [quick-shortcut-undo-1.png](quick-shortcut-undo-1.png), [clean-shortcut-undo-1.png](clean-shortcut-undo-1.png), [clean-shortcut-undo-2.png](clean-shortcut-undo-2.png); `local-preferences.cjs`, `review-settings.cjs`, `shortcut-clean.cjs`, `evidence.log`.

**Suspected code:** `reading.ts:61`–`:79`, `Skills.tsx:22`, `draw/quick.ts:15`, `sfx.ts:19`, `Settings.tsx:389` and `:449`, `Shortcuts.tsx:107` directly save without recording an undo step. Reset/remove shortcut actions do record steps; plain rebinding does not.

### SETTINGS-06 — A failed plan save discards the new text

**S2 · Mac · reproduced 2/2.**

1. Fresh page → Settings → Review → When you review. Save **before my study block**.
2. Set the documented failure hook: `window.__ORE_FAIL = {goal: "Settings test: disk unavailable"}`.
3. Replace the cue with **keep these unsaved words** and press Enter.
4. Observe the error and the input.

**Expected:** retain the unsuccessful draft so it can be corrected or retried (D211).

**Actual:** the error toast appears, but the input resets to **before my study block**. The new text is lost; clearing the simulated error gives nothing to retry. The stored value is safely preserved.

**Evidence:** [failed-plan-1.png](failed-plan-1.png), [failed-plan-2.png](failed-plan-2.png); `review-settings.cjs`, `evidence.log` (`failed-plan-draft`).

**Suspected code:** `Settings.tsx:148` restores saved data; `PlanField` at `:526` replaces its text whenever that restored plan changes. In contrast, the skill-goal editor retained its failed draft in the same test.

### SETTINGS-07 — A valid custom minute goal has no selected setting

**S2 · Mac · reproduced 2/2 on a copied library.**

1. Use a valid saved `review.goal_minutes: 7` (the core accepts whole minutes 1–240; a user can also set this through `ore goal --minutes 7`).
2. Open a fresh page. Home shows the seven-minute goal.
3. Open Settings → Review → Minutes a day.

**Expected:** the saved value is visible and selected, as New exercises a day handles custom saved values.

**Actual:** only 5, 10, 15, 20 and 30 are offered; **zero choices are selected**. The panel conceals the active value and there is no way to select 7 again there after trying another option.

**Evidence:** [yaml-custom-goal-home-1.png](yaml-custom-goal-home-1.png), [yaml-custom-goal-settings-1.png](yaml-custom-goal-settings-1.png), [yaml-custom-goal-settings-2.png](yaml-custom-goal-settings-2.png); `custom-goal.cjs`, `evidence.log` (`custom-goal-ui`, selected=0).

**Suspected code:** `Settings.tsx:36` and the Minutes selector use only `GOALS`, unlike `newOptions` at `:39`. The phone uses the same list, but this report's live custom-minute reproduction is Mac only. Related to the class fixed in F132, not a recurrence of F132's New exercises control.

### SETTINGS-08 — Invalid YAML falls back silently in the app

**S3 · Mac · reproduced 2/2 through the real CLI on a copied library.**

1. On a disposable library copy, set `review.goal_minutes: -1` in `skills.yaml`.
2. Open a fresh app page on that copy.
3. Inspect Home and Settings → Review.

**Expected:** stay usable with a safe fallback and tell the learner which file/field needs correction.

**Actual:** the app uses 10, presents 10 as the normal setting and shows no error/warning. The bad value remains in the file. `skillsFileProblems` produces the correct diagnostic, but only `ore doctor` consumes it. The 132 read cases confirmed this fallback pattern across malformed review fields, priority, AI provider and wrongly typed model fields. Syntax errors/nonrecoverable fields do have actionable errors; the gap is recoverable invalid values.

**Evidence:** [yaml-invalid-home-1.png](yaml-invalid-home-1.png), [yaml-invalid-settings-1.png](yaml-invalid-settings-1.png), [yaml-invalid-settings-2.png](yaml-invalid-settings-2.png); `yaml-probes.ts`, `yaml-results.json`, `yaml-ui.cjs` and `evidence.log` (`invalid-yaml-ui`, errors=[]). The same UI fixture also contains the independent blank-name case below.

**Suspected code:** `packages/core/src/skills.ts:96` discards `dropped`; `:104` exposes diagnostics only separately. Settings returns the fallback review object without those diagnostics.

### SETTINGS-09 — An empty skill name in YAML is accepted as a nameless skill

**S3 · Mac · reproduced 2/2.**

1. On a disposable library copy, change the AI skill's name to `name: ""`, leaving its id and other fields intact.
2. Open a fresh page.
3. Inspect the sidebar, Home skill tile and source's skill label.

**Expected:** use an identifiable fallback, or report the invalid name and how to repair it. The core write path already refuses empty names.

**Actual:** the AI skill becomes an unlabeled icon in the sidebar and Home; its source labels also lose the name. There is no diagnostic, even in `skillsFileProblems`. The skill and its data are retained, but it is no longer identifiable by its name.

**Evidence:** [yaml-invalid-home-1.png](yaml-invalid-home-1.png), [yaml-invalid-home-2.png](yaml-invalid-home-2.png); `yaml-results.json` (`field: name`, `value: ""`, `problems: []`) twice.

**Suspected code:** `packages/core/src/skills.ts:24` uses unrestricted `z.string()` for `name`; the write-time nonempty check is at `:228`.

## 3. Known findings

No known row was confirmed to have returned. F145's ordered-save fix passed two 10→5→15→10 sequences with the first write held for one second; both disk and selection ended at 10. F147's quick-quiz recorder accepted clicked-and-typed modified shortcuts in WebKit. F132 concerns custom **new-exercise** counts; SETTINGS-07 is the remaining **minutes** counterpart. F161's native phone undo is present in `phone/native-undo.ts`; absence of an Undo toast was not treated as a regression. F14, F259 and F260 were explicitly excluded.

## 4. What passed

- Settings' numeric controls use fixed choices; text size stops at 14 and 26 and Default returns 17.
- Core writes reject zero minutes, negative/huge/decimal/text/empty numeric values; zero new exercises is valid. See the 12 write cases in `yaml-results.json`.
- Core reads safely recover bad optional review values, booleans, priority and AI provider; unrecoverable skill-name types report the field and correction step. The missing UI warning is separately reported.
- Plan text is capped at 80; skill goals at 140. Numeric-looking strings are valid text, not numeric settings. Esc kept the saved text.
- Skill names accepted ordinary and numeric-looking text and a 1,000-character name; duplicate names were refused with the draft kept. Rename and undo preserved the skill id.
- Skill-goal saves, Try it prompts, clearing, undo and failed-draft preservation worked.
- Importance Focus→Light lengthened the next scheduled dates; the existing rating log and all four projected memory gains stayed identical. Undo restored Focus, twice.
- On a copy evaluated tomorrow, new/day caps 0/5/10/20 yielded exactly 0/5/10/20 unseen exercises, one in every five positions while there were enough due exercises. All 163 due exercises stayed; reviews were never capped. `queue-results.json`.
- AI provider and model selections saved and undid correctly, twice; provider-specific model defaults appeared. Actual AI use is stubbed, not certified by this run.
- Weekdays and Remix switches saved and undid correctly; the reminder time saved to YAML and undid to Off.
- Sound effects took effect inside a paused/resumed review: an enabled reveal started audio once; after disabling, the next rating and reveal started no audio. Text size also changed to 20 without reloading Review. `sound-live.cjs`.
- All **135 editable keyboard bindings** accepted a valid replacement and their individual reset restored their default. Full results are in `keyboard-results.json`; this checks configuration, not 135 end-to-end action journeys.
- Reading width, page, font and text size visibly updated the open reader; skill-tag appearance updated its byline, without a reload.
- Width, size, page, font, chip style, diagram setting, sounds, tray preference and quick-quiz binding persisted into a fresh page in the same browser context.
- Shared phone settings saved in IndexedDB and survived reload; the phone used the copied seed, and its Saturday weekday-only behavior was correct after reload.
- There is a dedicated text-size Default and keyboard reset (individual/all); shared settings can be manually returned to documented defaults. No universal Reset Settings control exists.

## Artifacts and limits

`evidence.log` records observed values and filenames; screenshots are Retina (2×). `browser.cjs` is the CommonJS controller connected to the supplied WebKit server. Each scenario is a separate `.cjs` file required by that controller. `yaml-probes.ts` and `queue-check.ts` use the actual core on output-folder copies. These are diagnostic scripts, not new repository tests. No code fix, CI claim, commit or merge is part of this findings-only run. Adjacent skill icon/color/collection/archive and the actual diagram canvas are explicitly marked as source-inspected rather than exhaustively exercised in the coverage matrix.
