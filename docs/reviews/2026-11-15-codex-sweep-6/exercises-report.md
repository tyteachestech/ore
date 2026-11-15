# Exercise sweep — findings only

Tested the supplied release Mac app at `http://localhost:1764/` (bridge 1765) and phone build at `http://localhost:1766/`, using the supplied WebKit server, one context at a time, and 2× screenshots. Repository HEAD was `81b21051e1778ac229658e8f80ac842113f04d7e`. Covered Fact and Explain edits, changed rubric points, long/empty/formatted answers, a hand-made figure exercise, source skill propagation, retirement/deletion and undo, failed writes, AI-off correction, and review history across simulated days. Three new findings are below. Skipped pure appearance, excluded known rows, real AI generation, native UIKit gestures/keyboard, and operations this build does not expose: a general hand-written Fact/Explain form from highlights/notes/without a source, changing an exercise's kind, independent exercise skill assignment, and permanent source deletion. The seed has no saved variants; variant rejection and its failed-write path were therefore not exercised. No tracked repository files were changed; test artifacts are in this folder, and library mutations went through the app.

## Findings

### EX-1 — Asking to fix an exercise crashes Review when AI returns null

**S1 — Mac.** Reproduced **2/2 completed attempts**, on an Explain and a Fact. This is specifically the supplied AI-off response; it does not establish that the production AI adapter normally returns null.

1. Open a fresh Mac page with bridge 1765 and the supplied Tauri init script.
2. Click **Start review**, then **Start review** in the picker.
3. Reveal a Fact with **Sure**. For an Explain, type an answer, choose confidence, and click **Check**.
4. Click **Ask about this**, then **Make this exercise clearer**.
5. Allow the supplied `ask` command to return null.

**Expected:** An actionable error inside Ask, with the exercise, current answer, ratings, and ability to continue intact.

**Actual:** The Review view is replaced by the error boundary: **“This view hit a snag.”** and **“null is not an object (evaluating 'i.session')”**, with **Go home**. The current Review controls disappear. This is a crash of the view, not merely a missing AI answer. A deliberately rejected `ask` command, by contrast, stays in Review and offers **Try again**.

**Evidence:**

- `codex-out/exercises/mac-ask-null-crash-1.png`
- `codex-out/exercises/mac-ask-null-crash-2.png`
- `codex-out/exercises/mac-ask-command-failure.png` — ordinary command failure handled correctly.

**Suspected cause:** `apps/desktop/src/Ask.tsx:68` dereferences `r.session`, `r.reply`, and `r.proposal` inside a state updater without validating `r`. An exception when React runs that updater escapes the surrounding async `try/catch` at lines 66–70.

### EX-2 — Saving an edit removes the exercise's history and next-review preview

**S2 — Mac and iPhone.** Reproduced on **two distinct Mac exercises** (Fact question edit and Explain rubric edit) and **one phone exercise**; every checked edit removed the line.

1. From a fresh page, start Review on the seeded library.
2. Reveal **What is the hypercorrection effect?** with **Sure**.
3. Observe its colored history dots and **next in …** preview above the ratings.
4. On Mac, click **Edit exercise**. On iPhone, tap **Exercise actions → Edit exercise**.
5. Change the question or answer and save.
6. Compare the area above **Again / Hard / Good / Easy** with step 3. Reopen the exercise in a new review to check its history again.

**Expected:** Changing wording keeps the history dots and next-review preview available for the rating being chosen (D149).

**Actual:** The entire history line and next-review preview disappear immediately after Save. Reopening the exercise restores them. The effect also occurs when editing Explain key points. The stored reviews are intact: this is lost review context on screen, **not erased history or a reset schedule**. Rating the edited exercise still uses its original ID and prior scheduling state.

**Evidence:**

- `codex-out/exercises/mac-history-before.png`
- `codex-out/exercises/mac-history-after-1.png`
- `codex-out/exercises/mac-grade-ai-off.png` and `mac-explain-rubric-edited.png` — the second Mac case.
- `codex-out/exercises/phone-history-before.png`
- `codex-out/exercises/phone-history-after.png`
- `hyper-before-rating.json`, `hyper-rated.json`, `hyper-undone.json`, and `hyper-log.json` — retained history and rating/undo records.

**Suspected cause:** `apps/desktop/src/Review.tsx:925–927` replaces the displayed review object with the `card set` result. `packages/cli/src/cmd-study.ts:74` adds `history` and `in_head_ok` for `card show --review`, but the `set` response at line 94 does not include those review-only fields. The shared Review component then has no history to draw.

### EX-3 — Exercise math, code, and image Markdown are displayed as literal text

**S2 — Mac verified.** Reproduced math/code on **two edits**, and the valid source-relative image case on **two further edits**. The phone uses the same render path, but phone formatting was not separately verified.

1. Open a fresh Mac page and open **Building Effective Agents**.
2. Confirm that its workflow diagram is visible in the source.
3. Choose **Source actions → Review this source**.
4. Reveal the agent/workflow Fact, then choose **Edit exercise**.
5. Put `What does $$E=mc^2$$ mean in this diagram?` in the question. Put the following in the answer and save:

````markdown
![Workflow patterns](assets/patterns.svg)

$$E=mc^2$$

```js
const e = m * c ** 2;
```
````

6. Read the question and answer, then reopen Edit to check the saved text.

**Expected:** A usable formula, code block, and source image when reviewing the saved Markdown. In particular, the learner should be able to see an image that supplies the answer.

**Actual:** The question shows the dollar delimiters; the answer shows the literal image path, TeX, and code fences. There is no rendered answer image (`.review-answer img` count is zero), even though `assets/patterns.svg` exists and renders in this source. Text is preserved on disk and on reopening Edit; the failure is in presentation. The separate figure-occlusion exercise route does render its image correctly.

**Evidence:**

- `codex-out/exercises/mac-valid-image-markdown.png`
- `codex-out/exercises/mac-valid-image-markdown-2.png`
- `codex-out/exercises/mac-format-1.png`
- `codex-out/exercises/mac-format-2.png`
- `codex-out/exercises/formatted-card-saved.json`

**Suspected cause:** `apps/desktop/src/Review.tsx:1228` renders the question directly inside an `h1`; line 1291 renders the answer directly inside a `p`. Neither uses the source/tutor Markdown and math renderer. This is distinct from F320: that row fixed formulas in tutor and Ask replies, not exercise questions and model answers.

## Known rows seen again

No fixed finding was confirmed to have regressed. F14's long-answer layout was excluded from reporting as requested. F320 is adjacent to EX-3 but its corrected reply renderer is a different surface. The known mock-only recall case F269 was not retested; EX-1 concerns an actual Review error-boundary crash under the explicitly requested null-response test.

## What passed

- Mac Fact question/answer edits save to the original exercise ID and reopen with the saved wording.
- A 60-paragraph answer reopens exactly as entered; an empty answer disables Save.
- A failed `card` write leaves the edit form and typed text intact; clearing the failure allows Save.
- Explain rubric edits save all points; the UI says the key points changed and requests new marks; Undo restores the original rubric.
- Null AI grading ends with an explicit error and manual marking/rating controls, rather than an endless wait.
- An `ask` command rejection stays inside Review, retains the request, and offers Try again.
- A failed rating leaves the same exercise available to retry; a successful retry records its rating.
- Mac rating after an edit retains prior history; Undo restores the due entry and all FSRS state fields exactly. Two ratings separated by Undo had identical `state_before` objects (`hyper-log.json`).
- Phone edits survive rating and **Undo last rating**; hardware Command-Z restores the exercise wording and retirement state in the saved phone files.
- Phone retirement followed immediately by the toast's Undo restores the exercise; draft deletion followed by Undo restores `state: draft`.
- A hand-made figure Fact rejects an empty label, retains its label after an injected write failure, saves its image/box/answer/skill, and appears in **Review this source** immediately.
- Editing that figure exercise retains its image; Mac Delete/Undo changes retired/draft state correctly.
- Adding Learning to a source also files its existing exercises and the new figure exercise under Learning; Undo restores each to AI.
- Archiving a source keeps its exercises reviewing, as `docs/SPEC.md:169` specifies; Undo restores the source.
- Deleting the seeded Key point leaves its exercise and history on disk; this run did not finish a second UI pass through that exercise's removed-passage presentation.
- Phone ratings on December 1 and January 1 preserve the exercise ID, previous state, and due-state chain. After a later rating on March 2, Undo followed by an answer edit and a new rating again uses exactly the same prior FSRS state (`phone-review-log.json`). The final Easy rating schedules April 27 from March 2.

## Coverage limits and artifact notes

- General manual authoring was not available in the inspected source actions, highlight popup, Collected panel, or Review editor. The editor exposes question, answer, and Explain key points; no kind or independent skill selector. These are coverage gaps, not assumed regressions or feature requests disguised as bugs. Figure authoring was exercised instead.
- No generated exercise/variant quality was evaluated: the supplied AI is off, and the seed contains no variants. The correction path was tested through Review's Ask.
- Permanent source deletion is not offered in the inspected source menu; Archive was tested. Moving a linked highlight's endpoints and editing its note were not completed in this run.
- Phone evidence is from the browser build's IndexedDB, not the seed folder: browser writes do not update that folder. `phone-*.json` snapshots are read-only exports of the page's saved files. Native shake/three-finger gestures cannot be validated in this browser; phone edit Undo used hardware Command-Z, while retire/delete Undo used touch toasts.
- The first March 1 clock experiment froze multiple operations at exactly the same millisecond. Those duplicate-timestamp results were excluded from the scheduling conclusion; March 2 repeated rating/undo/re-rate at distinct seconds. The raw exported log retains both experiments for audit.
- `runner.cjs` is the bounded-session CommonJS harness; `actions.log` records the executed action lines, including exploratory selector/timeouts. No browser was launched and no server was started or stopped. All tester pages and contexts were closed at completion.
