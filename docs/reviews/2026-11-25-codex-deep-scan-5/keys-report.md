# Ore deep scan 5 — keys

Read-only scout of keyboard dispatch, shortcut rebinding and hints, text/IME guards, review key handling, focus traps/restoration, menu isolation, and accessibility attributes in the desktop and shared phone components. Inventoried handlers in `handlers.txt` and traced the main screen handlers and their helpers, including the note and diagram editors. Read the working agreement, specification, relevant decisions, daily-session/workflow documents, findings register, sweeps and earlier deep-scan coverage. Skipped the other threads' EPUB front matter and highlight animation work, prior scans' intake/storage/AI investigations, and known focus findings such as F355 and F547. No app, browser, server, watcher, e2e, bench, full test suite, real AI, or real library was used. All artifacts are confined to `codex-out/keys/`; no production or registry files changed.

## Method and reproduction

Commands below run from the repository root. `extract.ts` parses production TSX and executes the **unchanged handler body** with explicitly supplied component state and action spies. It re-reads production source on each run. It does not mount React or simulate native event delivery. The retirement loop additionally uses the real `ReviewSession` with a fake command runner. Thus action dispatch, bindings and session queue changes are demonstrated; native IME event delivery and physical keyboard repeat timing are not claimed as device-tested. All outbound actions/AI boundaries are replaced; no AI process can run from these scripts.

Each red script was run twice in separate Bun processes, followed by a hypothesis probe run. All three runs reproduced each finding and exited **1** intentionally. See `<script>-run1.log`, `-run2.log` and `-probe.log`. Every process finished in under one second. `--probe` retains the original failing expectation, so its exit 1 is expected too. A green control script and three individually named existing test files also ran. A first draft of the green control selected a click callback instead of a key handler; its discriminator was corrected, and that harness mistake is not a finding.

## Findings

### KEYS-01 — Composition confirmation/cancellation triggers submit, save or close

**S2 · Mac; shared Tutor/Review handlers also affect iPhone if the corresponding hardware/IME event is delivered.** IME means an input method that converts typed characters into a selected word. Confirming or cancelling that conversion should remain text editing. Instead, several handlers treat it as an application command. The ordinary composition flag is missing in some handlers; others lack the `keyCode === 229` fallback already documented and implemented in Ore's Questions editor.

**Red command:** `ORE_NO_ENRICH=1 bun codex-out/keys/ime.ts`

```text
[DEEP] handler apps/desktop/src/Add.tsx:233
[DEEP] Add: composing Enter must not import unfinished text: actual=1 expected=0
[DEEP] handler apps/desktop/src/Tutor.tsx:967
[DEEP] Tutor: WebKit composition-confirm Enter must not send: actual=["日本"] expected=[]
[DEEP] handler apps/desktop/src/Review.tsx:581
[DEEP] Review: IME cancel must not finish session: actual=1 expected=0
[DEEP] handler apps/desktop/src/TitleField.tsx:56
[DEEP] TitleField: WebKit composition-confirm must not save/close title: actual=1 expected=0
[DEEP] TitleField: IME cancel must not discard rename: actual=1 expected=0
```

**Minimised steps / expected versus actual:** Each case starts with its own ready handler. (1) Deliver Enter with `isComposing=true, keyCode=229` to Add: `go()` runs once instead of leaving the text alone. (2) Deliver Enter with `isComposing=false, keyCode=229` to Tutor with a nonempty draft and no mention picker: `send("日本", true)` runs instead of only confirming composition. (3) Deliver composing Escape from Review's answer textarea: `s.finish()` runs instead of only cancelling composition. (4) Deliver the fallback Enter to an idle TitleField: its save boundary runs. Independently deliver composing Escape: the rename closes and marks itself settled, suppressing blur-save. No prior event, race or AI result is needed. These are action-boundary observations, not a claim that a particular draft was persisted to disk.

**Ranked hypotheses and probes:**

1. **Missing composition guards** dispatch ordinary shortcuts during text conversion. Confirmed for Add and Review Escape: even `isComposing=true` reaches their action spies.
2. **Incomplete WebKit fallback** makes flag-only guards fail. Confirmed for Tutor and TitleField Enter: false/229 dispatches; Tutor true/229 does not. Production `Questions.tsx:180–182` explicitly describes this WebKit event shape.
3. **Bubbling or an enclosing global shortcut** causes the extra action. Ruled out for these reproductions: each unchanged handler is called once without any parent listener.
4. **The fixtures accidentally represent normal Enter/Escape.** Split by controls: ordinary Enter still adds and ordinary Escape still leaves Review, while Questions and diagram text handlers preserve all 12 tested composing Enter/Escape/ArrowDown combinations.

**Cause:** `apps/desktop/src/Add.tsx:234` dispatches Enter without a composition guard; `Tutor.tsx:986` checks only `isComposing`; `TitleField.tsx:59` closes on Escape before any composition guard and `:63` checks only the flag for Enter; `Review.tsx:595` consumes Escape before checking whether it belongs to composition. Review registers this handler in capture phase at `:685`, so a textarea's later handler cannot prevent it. Green comparison: `Questions.tsx:182`, `draw/Editor.tsx:1657`.

**Reproduced:** 2/2 final red runs and 1/1 probe run. Probe command: `ORE_NO_ENRICH=1 bun codex-out/keys/ime.ts --probe`.

### KEYS-02 — Replace leaves a second live shortcut conflict

**S2 · Mac.** Assigning K to “Recall this chapter” succeeds, but K still plays/pauses a video instead. This violates D195's explicit requirement that K/J/L conflict with every reader command, while their sound/silent default bindings may coexist.

**Red command:** `ORE_NO_ENRICH=1 bun codex-out/keys/clash.ts`

```text
[DEEP] first conflict: prev-post
[DEEP] replace result: null
[DEEP] active commands: [ "section", "play-alt" ]
[DEEP] handler apps/desktop/src/Reader.tsx:2393
[DEEP] K on a video after assigning Recall this chapter: play=1 recall=0; expected play=0 recall=1
```

**Minimised steps:** Reset to default bindings. Rebind `section` to `KeyK` with Replace, exactly as the shortcut editor does. Deliver plain K to a ready video reader with no field, popup or blocked state. Expected: the requested chapter recall runs and the conflicting player binding has been removed. Actual: both match and the reader takes Play/Pause first. No media playback or browser is needed to observe the wrong action dispatch.

**Ranked hypotheses and probes:**

1. **Replace clears only the first conflict.** Confirmed: initial conflict is `prev-post`; after successful replacement `clash('section','KeyK')` still reports `play-alt`.
2. **Sound/silent scope separation incorrectly treats chapter recall as sound-only or silent-only.** Ruled out: the residual `clash` correctly recognises that chapter recall meets Play/Pause. The two default K commands correctly report no conflict with each other.
3. **Reader ignores a valid custom binding even when unique.** Ruled out: removing only the remaining `play-alt` binding makes the same handler invoke recall once and playback zero times.

**Cause:** `apps/desktop/src/keys.ts:336` uses `find` to return one conflict; `:350–354` removes just that one when replacing. The shortcut editor calls this path at `Shortcuts.tsx:86`. Reader resolves playback first at `Reader.tsx:2444`, before chapter recall at `:2529`. The problem is the incomplete replacement, not the intentional default sound/silent overlap.

**Reproduced:** 2/2 red runs and 1/1 probe run. Probe command: `ORE_NO_ENRICH=1 bun codex-out/keys/clash.ts --probe`.

### KEYS-03 — Accepted modified Review shortcuts never reach their action

**S2 · Mac; same shared Review logic with an iPhone hardware keyboard.** Keyboard settings accept Command+E for “Edit exercise,” but Review silently ignores it.

**Red command:** `ORE_NO_ENRICH=1 bun codex-out/keys/review-keys.ts`

```text
[DEEP] Edit exercise rebind Meta+KeyE: null
[DEEP] handler apps/desktop/src/Review.tsx:581
[DEEP] accepted shortcut Edit exercise: edited=0; expected=1
```

**Minimised steps:** Reset bindings; rebind `edit-card` to `Meta+KeyE`; set Review to its checked-answer state, focused on the review surface, outside any modal and more than 300 ms after the answer appeared; press Command+E once. Expected: enter the exercise editor. Actual: no action. `null` from rebind means the assignment was accepted.

**Ranked hypotheses and probes:**

1. **A blanket modifier guard runs before custom action matching.** Confirmed by source and contrast: Command+E is rejected, default E and custom Shift+E both reach the same edit spy.
2. **Binding validation or persistence rejected the assignment.** Ruled out by `rebind` returning success and the real in-process keymap used by the handler; no mocked binding lookup.
3. **Focus, held-key rejection, or the 300 ms protection blocks the event.** Ruled out: event targets the review surface, `repeat=false`, and the clock is pinned 10 seconds beyond the answer timestamp. Only the modifier changes between failing and passing paths.

**Cause:** `apps/desktop/src/Review.tsx:661` returns for any Meta/Ctrl/Alt before the configurable actions at `:669–680`. This also structurally affects customized Ask, bad-version and passage actions in this branch; Edit exercise is the reproduced case. `keys.ts:306–315` allows the assignment.

**Reproduced:** 2/2 red runs and 1/1 probe run. Probe command: `ORE_NO_ENRICH=1 bun codex-out/keys/review-keys.ts --probe`.

### KEYS-04 — Holding Retire retires successive exercises

**S2 · Mac; same shared Review logic with an iPhone hardware keyboard.** A repeat from one held shortcut can retire the next exercise after the first write finishes. Retirement is reversible, but removes exercises from future review without separate deliberate presses. This loop proves retirement commands and queue removal, not altered FSRS calculations.

**Red command:** `ORE_NO_ENRICH=1 bun codex-out/keys/held-retire.ts`

```text
[DEEP] handler apps/desktop/src/Review.tsx:581
[DEEP] handler apps/desktop/src/Review.tsx:581
[DEEP] one press then its repeat, each after prior save: ["card retire A","card retire B"]
[DEEP] remaining due: ["C"]
[DEEP] expected: only card retire A; B and C remain due
```

**Minimised steps:** Give a real `ReviewSession` a queue A, B, C and a successful fake command runner. Dispatch Shift+Command+Backspace with `repeat=false` for A. Await the completed write and resulting next-exercise state. Deliver the same key with `repeat=true` for B. Expected: B remains current and only A has a retire command. Actual: A and B are both retired and C is current. Awaiting the write deliberately models a repeat arriving after a fast save, without relying on timers.

**Ranked hypotheses and probes:**

1. **Retire bypasses the held-key guard.** Confirmed: the unchanged handler invokes retirement for both events; its repeat guard occurs later in a different branch.
2. **The session's busy lock should prevent the second retirement.** Partly true only during a write. Probe with `s.busy=true` prevents another command; after success the real session releases busy and the next repeated key is accepted.
3. **One retirement erroneously removes two queue entries.** Ruled out: the command trace contains two distinct explicit retire calls, A then B, generated by separate key events. The session removes one entry per successful call.

**Cause:** `apps/desktop/src/Review.tsx:634–638` always calls retire for a matching key, before the `e.repeat` guard at `:662`. The adjacent Later action explicitly rejects repeats at `:642`. `review-session.ts:649` guards only busy, `:655` issues the command, `:671` advances the queue, and `:677` releases busy.

**Reproduced:** 2/2 red runs and 1/1 probe run. Probe command: `ORE_NO_ENRICH=1 bun codex-out/keys/held-retire.ts --probe`.

### KEYS-05 — Number-pad digits cannot choose confidence or rate

**S3 · Mac; same shared Review logic with an iPhone hardware keyboard.** A learner using a numeric keypad cannot use the advertised 1–3 confidence or 1–4 rating keys, although number-pad Enter works.

**Red command:** `ORE_NO_ENRICH=1 bun codex-out/keys/numpad.ts`

```text
[DEEP] handler apps/desktop/src/Review.tsx:581
[DEEP] handler apps/desktop/src/Review.tsx:581
[DEEP] Numpad3: confidence=[] ratings=[]; expected [3], [3]
```

**Minimised steps:** With Review focused on its surface, deliver `key='3', code='Numpad3', location=3` once in the answer phase and once in the checked phase. Expected: confidence 3 and rating 3 respectively. Actual: neither dispatches. Clock is pinned well beyond the answer guard; modifiers and repeat are false.

**Ranked hypotheses and probes:**

1. **The physical-code filter accepts only the top digit row.** Confirmed: changing only the code/location to `Digit3/0` makes both calls dispatch 3.
2. **Review's focus or answer delay blocks all keypad actions.** Ruled out: the same surface and clock accept both top-row 3 and `NumpadEnter`, which rates the suggested 3.
3. **Custom bindings override the numeric action.** Ruled out: each process resets the actual keymap and these are fixed digit branches, not custom binding matches.

**Cause:** `apps/desktop/src/Review.tsx:655–657` matches only `Digit[1-3]`, and `:663–665` only `Digit[1-4]`; both extract the number by slicing the top-row code. The Enter branch at `:666` instead matches `key`, explaining the working keypad Enter.

**Reproduced:** 2/2 red runs and 1/1 probe run. Probe command: `ORE_NO_ENRICH=1 bun codex-out/keys/numpad.ts --probe`.

## Leads — not findings

- More field handlers lack either composition guard or the 229 fallback (e.g. Sidebar naming, skill naming, Find, Forge, phone AddLink and Reader prequestions). They were read but not individually reproduced; do not count them as additional findings without their own state/dispatch checks.
- `IconPicker.tsx:117–146` keeps focus in its filter while arrows change a cell's `data-active`, without an active-descendant reference or selected state exposing that movement. No rendered accessibility-tree/VoiceOver loop was run; screen-reader impact remains a lead. This is separate from known F548's tooltip-style issue.
- Non-US layout labels use physical codes in `keys.ts:288`, while displayed symbols are US-style. AZERTY/Dvorak and native-menu accelerator interpretation were not validated with a real layout. Physical-code matching alone is not sufficient to call the behavior a bug.
- Native keydown/menu deduplication has a trusted-event/timing dependency. Existing headless menu tests pass, but they cannot establish the actual trusted native-event sequence; no new double-fire finding is claimed.
- Note-editor composition reaches ProseMirror's event dispatcher before Ore's plugin. No full editor composition loop was run, so missing guards in individual editor callbacks are not independently reported.

## What passed

- `ORE_NO_ENRICH=1 bun codex-out/keys/controls.ts`: 12 composition-key cases preserved in Questions and diagram text handlers; 4 text-field classifications passed. Output: `controls.log`.
- `bun test apps/desktop/test/keys.test.ts`: **18 passed, 0 failed**, 73 assertions; existing conflict, scope, persistence and matching coverage remains green (`keys-test.log`). It does not cover the multi-conflict Replace case above.
- `bun test apps/desktop/test/focus-near.test.ts`: **9 passed, 0 failed**, 16 assertions (`focus-near-test.log`); no additional proven focus-restoration finding.
- `bun test apps/desktop/test/menubar.test.ts`: **8 passed, 0 failed**, 206 assertions (`menubar-test.log`); native event delivery remains unverified as noted above.
- The Review probe ignored a held rating key, a held Later shortcut, and a rating digit targeted at a textarea; it accepted default E and Shift+E for Edit.
- The conflict probe preserved the intentional default K overlap between sound and silent contexts; removing the residual competing binding restored chapter recall.
- The retirement probe confirmed that the real session refuses retirement while busy; the failure specifically requires a repeat after the previous save completes.
- No crash, security issue or irreversible disk corruption was demonstrated. No production fixes were attempted; phases 1–4 only.
