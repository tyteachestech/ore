# firstrun — empty library through the first week

Tested commit `2c2b888f78d041a666fedad94ef575ae45be3c56`, November 14–15, 2026, on the supplied release pages in connected WebKit. Covered Mac Home, empty Review, a starter skill, All sources, Feed, Settings, search and ⌘K; then three local articles, highlighting, Key points, recall, two new skills, manual table exercises, review, date changes, archiving, emptying a skill and Undo/Redo. On iPhone: empty Today/search, article imports and reading, recall/Finish, a manual exercise and first review, a new skill, filing, archiving and the empty skill. Also checked missing and uninitialized library folders twice each. Four findings below: three S2 and one S3; no crash or data loss confirmed. Skipped tutor chat, live AI, native iPhone selection/keyboard behavior, physical-device sync, pure visual polish and the explicitly excluded known rows. No application source or findings-registry edits were made.

## Test setup and boundaries

- `ore init` supplies nine starter skills. Both supplied libraries initially had no sources or exercises. Nothing was seeded into them for this run.
- Mac: `http://localhost:1721/`, bridge `1722`, supplied `codex-out/libs/firstrun`; 1280×800 at 2×. Phone: `http://localhost:1736/`, 390×844 at 2× with touch/mobile/dark enabled. One phone page retained its in-page library throughout the journey.
- Articles are original test text. `fixture.cjs` serves `/1`, `/2`, `/3` on a dynamically allocated local port. The second and third include a two-row table so exercises can be made through the app without AI. `article.html`, `article-2.html` and `article-3.html` preserve their contents.
- Phone imports initially failed because the local fixture server omitted CORS preflight headers. Correcting the **fixture** fixed import. Those preliminary failures are not app findings. `phone-http.cjs` also explored the native fetch stub; it was not the cause of those failures.
- `page.clock` supplied time travel. Since Mac scheduling runs in a separate CLI process, `cli-route.cjs` forwarded the page's clock into the real CLI through `clock-preload.cjs`; it otherwise follows the supplied bridge, including null AI responses and `ORE_NO_ENRICH=1`. App actions still performed every library write through core. `cli-route.jsonl` records commands, times and responses. A focus event prompted the normal date refresh. Early screenshots taken before a refresh settled are not used as failure evidence.
- At Light importance, the first Good ratings scheduled the Mac exercises eight days later. Thus no exercises were due on days 2, 3 or 7. I extended to day 9, just after the first due timestamp and before the second, to exercise the one-due state. This is an actual schedule outcome, not a forced queue response.
- The phone exercise was created using its table context menu via a mouse right-click in the touch-enabled page; review itself used taps. **This does not establish that a physical iPhone long press can create that exercise.** No general free-text exercise editor was found in the reader, Collected or the palette. Key points are inputs for AI drafting, not handwritten Q/A exercises.
- Missing-folder tests used four additional folders **inside `codex-out/firstrun/`**, routed from fresh app pages without changing or restarting the supplied servers. See `missing-library.cjs` and `missing-library.json`.

## Findings

### 1. A short caught-up review displays the full goal as minutes spent

**S2 — Mac and iPhone. Reproduced 2/2: once on each platform.**

1. From a fresh page with an empty library, import the table article.
2. Cover Function, open a covered cell's context menu and choose **Make an exercise of this cell**. Advance to the next day, or choose Review this source to include the new exercise.
3. Leave the goal at 10 minutes on iPhone, or set it to 5 minutes on Mac.
4. Review the only available exercise for about one minute, reveal the answer and rate Good.
5. Let the ending finish animating. Compare its large minute number with Home after Done.

**Expected:** The day may count as met because nothing remains due (D60), but the minute number must still show actual review time.

**Actual:** iPhone displayed **10 min**, while the same end screen's ring accessibility label said **1 of 10 minutes today**, and Home showed **1 of 10 min**. Mac displayed **5 min** after a short review, while its ring and Home showed **1 of 5 min**. The screenshots are after the counter settled, not intermediate animation frames. This overstates the learner's effort precisely when their first library has only one or two exercises.

Evidence:

- `phone-review-end-settled.png` and `.txt` — 10 min at the end, with the 1-of-10 ring label.
- `phone-home-after-review.png` and `.txt` — actual one minute.
- `short-review-state.png` and `.txt` — Mac five-minute claim.
- `short-review-home.png` and `.txt` — actual one minute.

Suspected cause: `apps/desktop/src/Lap.tsx:14` uses `t.met ? Math.max(goal, minutes(t.active_ms))`. `met` includes the caught-up exception. `Lap.tsx:81` then labels that inflated number as minutes today. Counting the day as met is **not** the bug.

### 2. Finish promises drafted exercises even when nothing was drafted, and omits the iPhone's Mac requirement

**S2 — iPhone and Mac with the supplied null-AI bridge. Reproduced on two Mac sources and three phone finishes; the persistent phone closing panel was captured on two sources.**

1. From a fresh empty-library page, add and open the article.
2. On Mac, highlight a passage, mark it as a Key point and click Finish. On either platform, type a recall and Continue, or use Just mark done.
3. Inspect the closing panel, then press Done.
4. Return to Home and advance to tomorrow.

**Expected:** Confirm that the source/recall was saved. Describe drafting truthfully. On phone, explain that exercises require the Mac; on Mac, an empty AI response must not count as successful drafting. A new learner should know what has to happen before Review becomes available.

**Actual:** The phone closing panel states **“New exercises tomorrow”** and **“Drafted from what you marked and answered. They start in tomorrow’s review.”** The source-finished moment makes the same promise. It gives no Mac next step, although the phone deliberately does not draft. On Mac, the supplied null enrichment response is accepted as success and the toast says **“exercises start tomorrow”**. The first prose source produced no exercises. Home simply returns to “All caught up. Read something new.” The only exercises in this run were the table exercises explicitly created later.

Evidence:

- `phone-promised-exercises-repeat.png` and `.txt`.
- `phone-promised-exercises-third.png` and `.txt`.
- `first-finished.png`, `growing-done.png` and their `.txt` files.
- `home-after-finish.png`; `final-cards.json` contains only the two manually created table exercises from the second source.

Suspected cause: `apps/desktop/src/Finish.tsx:212` returns immediately on phone, while `Finish.tsx:622` and `Finish.tsx:640` promise exercises unconditionally. On Mac, `Finish.tsx:204–205` treats any fulfilled enrichment response, including null, as success. D78.3 expressly says the phone should state that AI runs on the Mac. The finding is the false success/absent next step, **not** the test harness withholding AI results.

### 3. Recall feedback keeps saying it is working after the AI call has already returned null

**S2 — Mac. Reproduced 2/2 on the first and third articles.**

1. From a fresh page using the supplied AI-off bridge, add and open an article.
2. Choose Finish, type a nonempty Free recall and click Continue.
3. Wait for all bridge requests to finish. On the repeat, advance `page.clock` ten minutes.

**Expected:** Show a completed failure/unavailable state with a useful next step. The saved recall should remain, and finishing should remain possible.

**Actual:** **“Reading your recall against the source…”** remains indefinitely even though no AI request is pending. It remained after ten simulated minutes on the repeat. Done still works and the recall is saved, so this is misleading waiting rather than data loss or a hard block.

Evidence:

- `first-finish-continued.png` and `.txt`.
- `recall-stuck-repeat-10min.png` and `.txt`.
- The first source's saved `notes.md` contains the recalled text; `cli-route.jsonl` records the repeat's successful recall save.

Suspected cause: `apps/desktop/src/Finish.tsx:255` stores null as feedback without ending the waiting state. `Finish.tsx:653–655` interprets a non-null promise ref plus falsy feedback as still working; the promise ref is never cleared. This reports the endless wait, not the expected absence of live AI in this run.

### 4. Review's Day 0 entry gives a caught-up message instead of a first-exercise next step

**S3 — Mac. Reproduced 2/2, from Feed and Home before adding any source.**

1. Open a fresh initialized library containing no sources or exercises.
2. Press ⌘R, or open ⌘K and run its first suggestion, Start review.
3. Read the response.

**Expected:** Distinguish “you have not made an exercise yet” from “nothing is currently due,” and provide a route into the first source/learning step.

**Actual:** Review never opens; a toast says **“All caught up. Nothing is due right now.”** It provides no action. The palette still presents Start review first. Home's separate add guidance is useful, but the Review response does not explain how the learner gets their first exercise.

Evidence: `day0-review.png`, `day0-review-repeat.png`, `day0-palette.png`, and their `.txt` files.

Suspected location: `apps/desktop/src/Review.tsx:1470`, the generic no-due message. This is not F74 recurring: F74's phone Today first-source guidance is present and works; this is the Review entry point.

## Known rows observed

No previously fixed row was confirmed to have returned. In particular, the first iPhone source appears immediately after import (F68), phone Today tells an empty-library learner to add with + (F74), and one tap opens a Today source (F54). F14, F259 and F260 were not re-reported.

## What passed

- Empty Mac Home gives add instructions and a working + Add; All sources and empty skill Sources also explain how to add. No NaN, undefined or 0-of-0 appeared.
- Empty skill pages omit the gem header; their note and question sections offer working next steps.
- Empty Feed explains following and offers Follow; Settings shows valid defaults and its library folder.
- ⌘K and search open and accept input. An unmatched palette query offers Ask your library; tutor behavior was out of scope.
- The initial zero goal ring is visible on both platforms. It represents the configured daily goal, not invented learning data; no separate empty chart appeared.
- The first local article preserves its title, author, date, headings and text through the final paragraph. It opens automatically on Mac and appears immediately on phone.
- Mac highlighting saves, conversion to Key point saves, and Collected exposes it. The typed recall survives finishing and reopening on both platforms.
- Creating Botany through the Mac source skill picker files the source at once. Ecology creation and third-source filing also work. Phone drawer skill creation, source filing and empty skill state work.
- Table exercises can be created without AI on Mac. Home says one/two new exercises start tomorrow with correct singular/plural. The general handwritten Q/A route was not found; the table route required reading code to discover the cover-then-context-menu sequence.
- The first review reveals the answer and accepts a manual Good on both platforms. Phone rating buttons fit at the foot of the screen.
- Two Mac reviews, each capped at three active minutes, correctly save six minutes for a five-minute goal. Home shows six, the met-day mark, and “Goal met and all caught up.” The extra lap is visible.
- Day changes reset today's minutes. Mac days 2, 3 and 7 have no due exercises, consistent with the saved eight-day schedule. The one-due day-9 review starts and records correctly. Phone day 3 says all caught up; day 7 offers Start review again (its unfiled exercise uses a different retention setting than Light Botany).
- Small-library skill progress remains numerically coherent: two first Good ratings leave zero cut gems and two nearly cut; the later Good produces one cut gem, with level still 0 and four to level 1.
- Archiving removes sources immediately from their active lists. After the first source is archived, the remaining Botany source still appears under To read. Empty Ecology disappears from Home and offers add/finish guidance on its page. Undo restores it; Redo empties it again.
- Source archiving intentionally **keeps exercises** (`packages/cli/src/cmd-items.ts:516`). Botany therefore remains on Home with its saved exercise strength after both sources are archived. This is not a stale count. The empty skill remains in the sidebar, consistent with D173's no-auto-archive rule.
- Phone archiving removes the first source from Sources and leaves its now-empty Botany skill with “Nothing to read. Add a link with +.”
- CLI `ls`, `today`, `due`, `skills` and `doctor --json` each exit 1 with “no library at … (run `ore init`, or set ORE_LIBRARY)” for both a nonexistent folder and an empty folder without `skills.yaml`. All 20 probes gave the expected result and did not initialize a library themselves.
- Fresh Mac app pages initialize each of those four probe folders automatically and reach the ordinary empty Home. No raw missing-library error remains. Evidence: `missing-library.json`, `missing-library-1/2.png`, `empty-library-1/2.png`.

## Findability notes and handoff

The uncertain steps were choosing Key point to request future exercises, realizing that a plain prose source has no direct Q/A creation form, discovering table exercises behind cover + context menu, finding Skills inside the phone's source actions, and realizing that a new phone skill must first be created from the drawer. The false Finish promises make the first two harder: the learner is told the work is done before a reviewable exercise exists.

All evidence is under `codex-out/firstrun/`; paired `.txt` files preserve the accessibility snapshots. App libraries were changed only by app actions. The Mac test library ends with three archived sources, two table exercises and Botany/Ecology skills. No code fixes, repository test-suite changes, commits, pushes or changes to the shared findings registry were made, per the preamble. The unrelated staged `apps/desktop/scripts/mac-load.sh` remained untouched.
