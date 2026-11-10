# Review UX parity audit

**Two new findings: A = 1, B = 1, C = 0.** No repo edits, commits, stashes, server changes, or installed-app changes. The worktree was clean at the beginning and final checks. Artifacts live in this folder. Only the supplied scratch library was exercised.

56 checklist items are accounted for: **51 tested, 5 untested or only partly testable**. Every retained app observation was repeated twice in Chromium and twice in WebKit. Where engines disagree, the table follows WebKit, as requested. “Works” describes the tested path, not all possible data or native macOS behavior.

## Method and evidence

`checklist.md` was written before the first Ore UI source read or navigation. Its original 56 items and confidence labels are unchanged. Anki/Mochi confidence is prior knowledge; there was no live installation audit of those apps. The [Anki studying manual](https://docs.ankiweb.net/manual/studying#keyboard-shortcuts) confirms reveal/rating shortcuts, shortcut hints, and its [temporary bury operation](https://docs.ankiweb.net/manual/studying#editing-and-more). Mochi’s [review guide](https://www.mochi.cards/docs/getting-started/reviewing-cards/) and [archiving guide](https://www.mochi.cards/docs/reviewing/archiving/) confirm the broad review and archive model; they do **not** establish the uncertain picker/focus claims below.

Playwright used the specified init scripts, localhost:1520 and bridge 1523. Screenshots use deviceScaleFactor 2. Test inputs used keyboard, real mouse clicks, wheel, down/move/up drags and native clipboard shortcuts. Long content was entered through the exercise editor. Quick quiz used the documented `__ORE_LABEL="quiz"` and `__emit("quiz-open")` hooks. `__ORE_FAIL` and `__ORE_SLOW` were used only after reading their implementation.

Ratings, edits and retire actions were exercised through the UI. Test-state cleanup also used the mock app’s own `__TAURI_INTERNALS__.invoke("ore", …)` bridge to undo this audit’s scratch ratings and restore a retired scratch exercise. This setup/cleanup is **not** counted as evidence that the UI Undo works; those checks used real ⌘Z/⇧⌘Z. No direct library-file writes were made. Scratch session receipts and undo records remain, as expected.

The actual bridge returned no usable canned grade. The supported delay hook established the four-second pending state; failure and manual-rating fallback were tested. A successful streamed/canned AI completion is not claimed.

`observations.jsonl` is the raw chronological ledger, including provisional test failures. The final table below is the adjudicated result. `audit.cjs`, `targeted.cjs`, `finalchecks.cjs`, `lastchecks.cjs` and `menu-final.cjs` retain the input sequences. Early scripts included overly short waits, a palette query-clear mistaken for closure, and attempts after the scratch queue changed; these were corrected and rerun. Empty-copy results were discarded; final copy checks require a nonempty selected word. Tooltip checks were repeated with fresh pointer entry and sufficient delay.

## Full checklist results

C = Chromium; W = WebKit. Raw differences remain in this table to account honestly for the checklist written in advance. **Excluded decisions/conventions and unsure-reference failures are not findings.**

| # | Reference behavior and confidence | Result | Engines/repeats | Observation / scope |
|---|---|---|---|---|
| 1 | sure; Anki: The study picker can be operated with Tab and Enter without a pointer. | **differs** | C works ×2; W differs ×2 | C passes. W: Tab after the last skill moves focus to BODY; Enter does not start. Excluded modal-focus convention. |
| 2 | unsure; Mochi: Esc dismisses the study picker and returns focus to its launch control. | **differs** | C works ×2; W differs ×2 | C restores Start review focus. W restores BODY (the launch click did not focus the button). Unsure reference; no finding. |
| 3 | unsure; Mochi: A selected study scope survives cancelling and reopening the picker. | **differs** | C + W, twice each | Cancelled skill toggles are discarded; the last started scope persists. Unsure reference; no finding. |
| 4 | sure; Anki: A picker with many choices keeps the start action reachable in a short window. | **untested** | C + W attempted; see reason | Four due skill rows fit at 1280×480; a genuinely large choice list was unavailable. |
| 5 | sure; Anki: Space reveals the answer when no editable field or menu has focus. | **differs** | C + W, twice each | Fact reveal uses confidence 1–3. Intentional D21/D59; no finding. |
| 6 | sure; Anki: Enter reveals the answer when no editable field or menu has focus. | **differs** | C + W, twice each | Fact reveal uses confidence 1–3. Intentional D21/D59; no finding. |
| 7 | sure; Anki: Rating keys do not rate an exercise while its answer is hidden. | **works** | C + W, twice each | 4 before reveal makes no rating; 2 reveals with confidence but makes no rating. |
| 8 | sure; Anki: Each available rating key selects its corresponding rating after reveal. | **works** | C + W, twice each | Each of 1, 2, 3, 4 checked against its outgoing rating command, then undone. |
| 9 | sure; Anki: Space after reveal invokes the default positive rating. | **differs** | C + W, twice each | Space does not rate; Enter does. Intentional D59; no finding. |
| 10 | sure; Anki: Enter after reveal invokes the default positive rating. | **works** | C + W, twice each | Enter on the Review surface records Good; focused controls retain their own Enter behavior. |
| 11 | sure; Anki: Typing a rating digit in an answer field does not submit a rating. | **works** | C + W, twice each | Digits 1234 remain in Your answer; no review command. |
| 12 | sure; Anki: Space inside an answer field inserts a space without revealing the answer. | **works** | C + W, twice each | Space remains in Your answer. |
| 13 | unsure; Mochi: Shift+Enter in a multiline answer inserts a newline without submitting. | **works** | C + W, twice each | Shift+Enter produces a newline. |
| 14 | sure; Anki: An open menu takes keyboard priority over review shortcuts. | **works** | C + W, twice each | 4 and Space type into the palette without a rating. |
| 15 | sure; Anki: Esc closes an open review menu without leaving the session. | **works** | C + W, twice each | Esc clears a nonempty palette query; the next Esc closes it and leaves Review. This follows the existing palette convention. |
| 16 | sure; Anki: Review shortcuts do not fire inside the exercise editor. | **works** | C + W, twice each | 1234, e and / stay in the Question editor; no rating occurs. |
| 17 | sure; Anki: After closing the editor, the same exercise remains available for review. | **works** | C + W, twice each | Cancel restores the same question and Review focus. |
| 18 | sure; Anki: Editing an exercise offers an explicit save and cancel path. | **works** | C + W, twice each | Save and Cancel are available; both exercised. |
| 19 | sure; Anki: An edit made during review appears in the current exercise after saving. | **works** | C + W, twice each | Saved suffix appears in the current question; Undo restores the original. |
| 20 | sure; Anki: A retirement or suspend action removes the current exercise from active review. | **works** | C + W, twice each | Retiring the only selected-skill exercise removes it and closes review; app Undo restores it for a later session. |
| 21 | sure; Anki: A bury or skip equivalent postpones the current exercise without grading it. | **missing** | C + W, twice each | F2: no temporary skip/bury action. |
| 22 | sure; Anki: Undo of a rating returns to the exercise that was just rated. | **works** | C + W, twice each | The previous exercise returns after ⌘Z. |
| 23 | unsure; Anki: Redo after undo reapplies the rating and advances once. | **works** | C + W, twice each | ⇧⌘Z advances to the same next exercise. |
| 24 | sure; Anki: Undo remains available after the last exercise is rated. | **works** | C + W, twice each | After rating the only Teaching exercise, ⌘Z restores it from the end screen. |
| 25 | unsure; Anki: Redo after an end-screen undo restores the completed state. | **works** | C + W, twice each | ⇧⌘Z restores completion and Done focus. |
| 26 | sure; Anki: Undo while editing text affects that text rather than an earlier rating. | **works** | C + W, twice each | Text undo stays in the editor; character grouping differs by engine and is not a defect. |
| 27 | sure; Anki: After advancing with the pointer, keyboard reveal works on the next exercise. | **works** | C + W, twice each | Pointer Good advances, then 2 reveals the next Fact answer. |
| 28 | sure; Anki: A rapid repeated activation cannot rate an unseen next exercise. | **works** | C + W, twice each | During delayed rating, repeated 3 sends one rating command. |
| 29 | unsure; Mochi: Leaving and returning to review retains the current unsubmitted answer. | **works** | C + W, twice each | Esc and reopening the Teaching scope retains the answer draft. |
| 30 | sure; Anki: An empty due queue offers a clear route back out. | **works** | C + W, twice each | Rated all five due exercises; empty quick quiz shows the waiting-new-exercises message; Esc closes. Ratings then undone. |
| 31 | sure; Anki: Long question and answer content can be scrolled to the end. | **works** | C + W, twice each | 22 question paragraphs and 30 answer paragraphs saved through Edit; bottom reached by real wheel scrolling. |
| 32 | sure; Anki: Answer and rating actions remain reachable at 1280 by 480. | **works** | C + W, twice each | Easy button remained within the 480px viewport after scrolling the long content. |
| 33 | sure; Mochi: Review controls remain reachable at 760 pixels wide. | **works** | C + W, twice each | 760px layout has reachable ratings and no document horizontal overflow. |
| 34 | sure; Anki: Double-click selects a word in rendered exercise text. | **works** | C + W, twice each | Double-click selects First in a rendered answer. |
| 35 | sure; Anki: Triple-click selects a paragraph in rendered exercise text. | **works** | C + W, twice each | Triple-click selects the first rendered paragraph. |
| 36 | sure; Anki: Pointer drag can select text across paragraphs of an answer. | **works** | W works ×2; C differs ×2 | W passes twice. C drag sequence yielded an empty selection twice; W is authoritative per request. No cross-engine parity finding. |
| 37 | sure; Anki: Selected rendered exercise text can be copied. | **works** | C + W, twice each | Copied a nonempty double-click word into the editor in both engines; W also copied the multi-paragraph drag selection. |
| 38 | sure; Anki: Right-click offers a copy route for selected exercise text. | **untested** | C + W attempted; see reason | Real right-click sent twice per engine; native context menu is not exposed by these headless sessions. |
| 39 | sure; Anki: Plain, multiline, rich text and URL paste into an answer field remain editable text. | **works** | C + W, twice each | Real clipboard: rendered heading text (rich source), plain text, multiline and URL paste tested in Your answer. |
| 40 | sure; Anki: Answer-field select-all, cut, undo and redo preserve the intended text. | **untested** | C + W attempted; see reason | C passes. W cut→⌘Z also fails in a bare textarea outside Ore; cannot attribute or validate this in the mock. |
| 41 | sure; Anki: Keyboard focus on review actions is visible and Tab reaches every available action. | **differs** | C works ×2; W differs ×2 | C reaches actions; W Tab alternates between Guess and BODY. Already covered by the review Tab journey and modal Conventions; no new finding. |
| 42 | sure; Anki: Controls with keyboard shortcuts expose their bindings on hover; Ore uses Hint, not title. | **missing** | C + W, twice each | F1: Cancel has no hover hint for Esc; footer does list Esc. |
| 43 | unsure; Mochi: Every icon-only toolbar control explains its action on hover; Ore uses Hint. | **works** | C + W, twice each | Fresh hover checks show Edit, Ask, Retire and Leave hints and their shortcuts. Rapid tooltip-to-tooltip sampling was discarded. |
| 44 | unsure; Mochi: Menus use icons consistently among sibling actions; Ore uses its dot icon set. | **untested** | C + W attempted; see reason | No Review action menu with sibling rows exists to compare. UI imports use icons.tsx; no bare title attribute found in the audited components. |
| 45 | sure; Anki: A failed save or rating leaves a visible error and a usable retry path. | **works** | C + W, twice each | Injected review failure leaves an error toast and enabled rating controls; retry succeeds. |
| 46 | sure; Anki: While a rating is pending, repeated activation cannot submit duplicate ratings. | **works** | C + W, twice each | __ORE_SLOW.review=1200: one request despite repeated rating keys. |
| 47 | unsure; Mochi: During delayed feedback, a pending state is visible and controls cannot submit twice. | **works** | C + W, twice each | __ORE_SLOW.grade=4000 shows Checking your answer and one grade request. Successful canned grading was unavailable. |
| 48 | unsure; Mochi: A stopped or failed feedback request leaves the answer and manual rating usable. | **works** | C + W, twice each | Injected grade failure retains the answer and enables manual marking/rating and try again. A distinct stopped-response path was not claimed. |
| 49 | sure; Anki: In the compact review window, reveal and rating keys work through a full exercise. | **works** | C + W, twice each | Quick quiz confidence reveal then 3 records Good and advances. |
| 50 | sure; Anki: Compact-window review shortcuts are suppressed while its menu is open. | **untested** | C + W attempted; see reason | Quick quiz has neither the main palette nor an action menu; no open-menu state could be created. |
| 51 | sure; Anki: Compact-window actions remain reachable in a 480-pixel-tall window. | **works** | C + W, twice each | Quick quiz at 680×480 keeps ratings reachable by wheel scrolling. |
| 52 | sure; Anki: Compact-window undo brings back the just-rated exercise. | **works** | C + W, twice each | Quick quiz ⌘Z restores the just-rated exercise. |
| 53 | unsure; Anki: Compact-window redo reapplies an undone rating. | **works** | C + W, twice each | Quick quiz ⇧⌘Z advances again. |
| 54 | sure; Anki: Compact-window errors leave a way to retry or leave. | **works** | C + W, twice each | Injected quick rating error remains visible with enabled controls and Esc exit. |
| 55 | sure; Anki: The compact review window can be dismissed with Esc without grading an exercise. | **works** | C + W, twice each | Esc removes the quick Review without a rating command. |
| 56 | unsure; Mochi: Closing and reopening compact review returns focus to a usable review control. | **works** | C + W, twice each | quiz-open after closing focuses the Review surface; subsequent keyboard reveal works. |

## New findings

### F1 — Cancel omits its Esc hover hint (item 42, class A)

1. Start review, select AI, and start the session.
2. Reveal the answer with Think so.
3. Click Edit exercise.
4. Hover Cancel for at least 600 ms; repeat in a fresh run.

**Ore:** Cancel never opens a Hint and has no `title` fallback. Save does have its ⌘Enter Hint. The footer already displays Esc Cancel, and Esc works, so the precise miss is hover discoverability, not a missing cancel action.

**Reference/requirement:** Anki exposes shortcuts on hover for common study controls. Ore’s explicit local requirement is stronger: each control with a shortcut must show it through Hint. Cancel has an Esc shortcut but is a bare button.

**Responsible source:** [Review.tsx:1204](apps/desktop/src/Review.tsx:1204). The adjacent Save Hint begins at line 1207. This is an obvious small consistency fix, with no new behavior or storage decision.

**Repeated evidence, all 2×:** [Chromium 1](shots/chromium-1-cancel-targeted.png), [Chromium 2](shots/chromium-2-cancel-targeted.png), [WebKit 1](shots/webkit-1-cancel-targeted.png), [WebKit 2](shots/webkit-2-cancel-targeted.png). The same EditCard component is used by QuickQuiz through Review; this is a shared implementation, not a separately counted finding.

### F2 — No temporary skip/bury route (item 21, class B)

1. Start review with AI selected.
2. Reveal the current exercise.
3. Inspect the available actions; right-click the exercise text.
4. Press Anki’s bury key, `-`.

**Ore:** The current question stays. Its controls offer Ask, Edit and Retire (or Delete for a draft), with no temporary postponement. Right-click adds no Ore action menu; `-` does not advance. Retire is permanent until explicitly restored, rather than “leave this for later without a rating.”

**Reference:** Anki’s Bury Card hides the current item until the next day without requiring a grade. Its separate Suspend command keeps an item out until restored. This finding is about the missing temporary option; Ore’s Retire already serves the longer-term removal need.

**Responsible source:** [Review.tsx:1060](apps/desktop/src/Review.tsx:1060) contains rating actions; [Review.tsx:1069](apps/desktop/src/Review.tsx:1069) contains the full exercise toolbar. The key handler at [Review.tsx:755](apps/desktop/src/Review.tsx:755) offers retire, confidence, rating, edit and Ask, with no temporary skip path.

**Why B:** Tyler must choose whether postponement belongs in Ore, and whether it means later in this session or tomorrow. It changes visible review behavior and queue disposition; it should not be slipped in as a minor fix. No decision located explicitly bans postponement, and this audit does not propose changing D22/D24 ranking or FSRS math.

**Repeated evidence, all 2×:** [Chromium 1](shots/chromium-1-skip-targeted.png), [Chromium 2](shots/chromium-2-skip-targeted.png), [WebKit 1](shots/webkit-1-skip-targeted.png), [WebKit 2](shots/webkit-2-skip-targeted.png).

## Unsure-reference failures — not findings

- **Item 2, focus after picker cancellation:** Click Start review, then Esc. Chromium focuses Start review; WebKit leaves BODY focused, which was also the focus before the pointer-opened picker. Mochi’s exact behavior was not established. Source: [ReviewPick.tsx:52](apps/desktop/src/ReviewPick.tsx:52), which stores/restores the previously focused element. This is also within the excluded modal-focus convention. If investigated further, class B; not counted. Evidence: the `lastchecks.log` focus records and [WebKit dismissal 1](shots/webkit-1-picker-dismiss-final.png), [WebKit dismissal 2](shots/webkit-2-picker-dismiss-final.png).
- **Item 3, cancelled scope selection:** Open the picker, toggle the first skill with Space, Esc, reopen. The uncommitted toggle is gone; the selection from the last started session remains. The original assumption was that Mochi retains cancelled selections; this is unverified and may be the wrong expectation. Source: [ReviewPick.tsx:78](apps/desktop/src/ReviewPick.tsx:78), which saves the pick only when starting. If a change were desired, class B; not counted. Evidence: [Chromium 1](shots/chromium-1-cancel-pick-final.png), [Chromium 2](shots/chromium-2-cancel-pick-final.png), [WebKit 1](shots/webkit-1-cancel-pick-final.png), [WebKit 2](shots/webkit-2-cancel-pick-final.png).

## Excluded differences — no new findings

- **Items 5, 6, 9:** On a Fact question, Space/Enter do not reveal; confidence 1–3 does. After reveal, Space does not rate; Enter gives Good. This is precisely D21/D59’s chosen flow. Anki uses Space/Enter for reveal and Good. Source: [Review.tsx:760](apps/desktop/src/Review.tsx:760). Evidence: [question](shots/webkit-1-fact-space.png), [answer](shots/webkit-1-fact-space-after.png), repeated [question](shots/webkit-2-fact-space.png), [answer](shots/webkit-2-fact-space-after.png). No class assigned because the behavior is decided.
- **Items 1 and 41:** In this WebKit environment, Tab after the last picker skill moves focus to BODY, leaving Enter unable to start; in the Explain answer flow, Tab cycles Guess/BODY instead of reaching all controls. Chromium reaches the expected actions. These were observed twice, but modal focus containment is already in the excluded Conventions table, and `journeys.ts:237` explicitly tests review Tab containment. No new finding or class. Relevant implementation: [Trap.tsx:9](apps/desktop/src/Trap.tsx:9), [ReviewPick.tsx:85](apps/desktop/src/ReviewPick.tsx:85). Evidence: [picker 1](shots/webkit-1-picker-final.png), [picker 2](shots/webkit-2-picker-final.png), [Review 1](shots/webkit-1-tab-focus-final.png), [Review 2](shots/webkit-2-tab-focus-final.png). Native WebKit keyboard-navigation settings were not changed; this does not prove the installed Tauri app behaves identically.

The already-covered rating undo/redo, end-screen behavior, loading errors, preserved answers, edit/retire history and quick-quiz session behavior produced no new findings. The known Ask Send-hint/undo issue was not re-reported. No naming, reward, ranking, emoji, styling, or excluded Anki feature requests were added.

## Untested limits and engine differences

- **4:** The seed has four due skill choices. Ordinary short-window behavior was checked, but a many-choice picker was not created.
- **38:** Native right-click menus were not observable in headless Playwright. A missing DOM menu does not prove a missing native Copy command.
- **40:** Chromium select-all/cut/undo/redo passes. WebKit does not undo a cut in this setup even in a standalone native textarea with no Ore code. This cannot be called an Ore defect or a pass for the installed app. The independent reproduction and outputs are `native-control.cjs` and `native-control.json`.
- **44:** Review has no sibling action menu to inspect. Existing toolbar SVG imports come from `icons.tsx`; audited component source has no bare `title=`. This static check does not substitute for a nonexistent menu interaction.
- **50:** Quick quiz has no command palette or review action menu, so menu-open shortcut suppression could not be exercised there. Main-window palette suppression was exercised separately.
- **36:** WebKit’s real drag selects across both paragraphs and copies them. Chromium’s repeated same coordinate sequence produced no selection. Under the requested WebKit-wins rule, the row passes; this is not treated as a confirmed cross-platform defect. Separate nonempty-word copy/paste passes in both engines. See [WebKit drag](shots/webkit-2-drag-targeted.png) and [Chromium drag](shots/chromium-2-drag-targeted.png).

The grading pending state and failure fallback were exercised, but a successful canned/streamed grade was unavailable. Variant-specific Bad version and multiple-source-passage controls did not appear in the seed, so no claim is made about their interaction or hover behavior.

## Totals

| Measure | Count |
|---|---:|
| Checklist items accounted for | 56 |
| Items checked with a retained result | 51 |
| Works | 42 |
| Missing | 2 |
| Differs | 7 |
| Untested / partial | 5 |
| New findings, class A | 1 |
| New findings, class B | 1 |
| New findings, class C | 0 |
| Unsure-reference failures, excluded from findings | 2 |
| Decided/already-covered differences, excluded from findings | 5 |

**Totals: 56 items; 51 checked; 42 works, 2 missing, 7 differs, 5 untested. New findings: A 1, B 1, C 0.**
