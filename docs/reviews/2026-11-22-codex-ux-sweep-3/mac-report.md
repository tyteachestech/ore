# Mac UX sweep — round 3

Tested the supplied release build at `http://localhost:1761/`, bridge `1762`, using the supplied WebKit server, one context and one page at a time, at 1280×800 with 2× screenshots. Baseline commit: `acba0b7e6b8cca24cbda6b264f9358304e49088c`. Covered reader annotations and Collected, a locally served RSS feed through keeping posts, Review's Later/edit/retire/leave/end controls, Settings, Ask your library and citation navigation, PDF Original navigation, and the seeded recording's player/transcript. Focused on delayed-save Undo and repeat submission beyond today's prior sweeps. Every finding below reproduced **2/2 from fresh pages** and was checked against application code. Skipped iPhone, visual taste, the specified known rows, real AI, native OS effects and the optional 2 GB reader download. Did not repeat the previous sweeps' ordinary Find/outline, note-editor, Forge, organization and tutor-history journeys. All direct artifact writes are in `codex-out/mac/`; scratch-library changes were made through the app. No application or documentation files were changed.

A fresh page resets page memory, not the scratch library. The slow hook delays the response to a real CLI write; it does not implement Undo. The failures below remain after writes settle. Saved annotation revisions in [library-evidence.json](library-evidence.json) establish that the removed writing is absent from the active state; older revisions remain in the append-only files, so these are not claims of unrecoverable byte loss.

## Findings

### MAC-1 — Undo during a Key point save deletes the previous point

**S1 · Mac · 2/2.** Previously saved learner writing is removed instead of the new point being canceled.

1. From a fresh page, open **Building Effective Agents**, then **Collected**.
2. Click **Add a key point**, type `Baseline key point 1`, press Enter, and wait for it to save.
3. Set `window.__ORE_SLOW = { highlight: 1800 }`.
4. Add `Second key point 1`, press Enter, and immediately press ⌘Z.
5. Wait at least four seconds. Repeat from a fresh page with suffix `2`.

**Expected:** The second point is undone; the baseline remains.

**Actual:** Collected retains the second point and deletes the baseline. The toast says **Undone: Key point added**. The baseline's saved annotation gets `status: deleted`.

**Evidence:** [run 1](keypoint-pending-undo-1.png), [run 2](keypoint-pending-undo-2.png), [script](keypoint-undo.js), [saved records](library-evidence.json).

**Code:** `apps/desktop/src/Reader.tsx:1920` awaits the new highlight; line **1925** adds its history entry afterward. The preceding point remains the latest undoable action during that wait. This is the typed Key point creation path, distinct from selecting text to highlight, which passed pending Undo.

### MAC-2 — Undo during a highlight-note edit erases the baseline note

**S1 · Mac · 2/2.** The earlier saved note is removed from the current annotation.

1. From a fresh page, open **Building Effective Agents**. Select `Prompt chaining decomposes a task` to create a Highlight if one does not already exist, then press Enter.
2. Open that highlight, write `Baseline note 1` in **Note**, and press Enter. Wait for saving to finish.
3. Reopen the highlight and replace the note with `Changed note 1`.
4. Set `window.__ORE_SLOW = { annotate: 1800 }`, press Enter to close/save, then immediately press ⌘Z.
5. After four seconds, reopen the highlight. Repeat from a fresh page with suffix `2`.

**Expected:** The note returns to `Baseline note 1`.

**Actual:** The note is empty. Disk revisions show baseline → changed note → no note. The older note creation was undone, rather than the pending replacement.

**Evidence:** [run 1](note-pending-undo-1.png), [run 2](note-pending-undo-2.png), [script](note-run.js), [saved revisions](library-evidence.json).

**Code:** `apps/desktop/src/Reader.tsx:2244` awaits `annotateWaking`; **2247** registers Undo only afterward. This is not F23's failed-save draft loss, nor F28's intentional saving on Esc: both writes here succeed, and the wrong history entry is selected.

### MAC-3 — Undo during Finish removes an earlier highlight and still finishes the source

**S1 · Mac · 2/2.** A saved annotation is deleted as a side effect of attempting to cancel completion.

1. Import `packages/core/test/fixtures/intake/files/contents.pdf` through the app's Open file picker. It appears as **Notes Guide**. From a fresh page, open it.
2. Highlight `A note is a promise to your later self.`, press Enter, and wait for the highlight to save.
3. Click **Finish**, type a free recall, and click **Continue**. Wait for **Done with this source?**; the AI-feedback error does not prevent continuing.
4. Set `window.__ORE_SLOW = { status: 1800 }`, click **Done**, then immediately press ⌘Z.
5. Wait for completion. For the second fresh-page run, first restore the source to reading through the completed Finish action's Undo, and use `The first mistake is writing everything down.` as the highlight.

**Expected:** Undo reverses finishing, leaves the source in To read, and preserves the highlight.

**Actual:** The source finishes and leaves Continue reading. The earlier highlight receives a deleted revision. Only a second Undo, after completion, reverses the Finish action. Both recalls remain in the source note.

**Evidence:** [run 1](finish-pending-undo-1.png), [run 2](finish-pending-undo-2.png), [script](finish-undo.js), [recalls and deleted highlight revisions](library-evidence.json).

**Code:** `apps/desktop/src/Finish.tsx:225` writes Done; `finish` at **301** waits for it, then also waits for the completion animation before calling `onDone`. `apps/desktop/src/App.tsx:2616` only then registers the Finish history entry. Unlike Review's busy-state handler, Finish does not defer ⌘Z for this pending action. This differs from F393's already-fixed Move to Done action in lists/palette.

### MAC-4 — Undo during a daily-goal change restores the value before the previous change

**S2 · Mac · 2/2.**

1. From a fresh page, open Settings → Review. Start with **Minutes a day = 10**.
2. Select **15** and wait for saving to finish.
3. Set `window.__ORE_SLOW = { goal: 1800 }`.
4. Select **20**, immediately press ⌘Z, and wait at least four seconds.

**Expected:** The goal returns to **15**.

**Actual:** It returns to **10**. The previous 10→15 edit was undone, while 15→20 only joined history later.

**Evidence:** [run 1](settings-pending-undo-1.png), [run 2](settings-pending-undo-2.png), [script](settings-run.js), [run 1 state](settings-undo-1.txt), [run 2 state](settings-undo-2.txt).

**Code:** `apps/desktop/src/Settings.tsx:152` updates the form immediately and queues the write; **178** registers its Undo after awaiting the write. `setGoal` at **184** uses this common path. F145 covers write ordering, not this history-registration gap. F275 explicitly exempts appearance preferences; this finding is the daily goal, which already supports Undo.

### MAC-5 — Undo during Mark read reverses the previous post's read mark

**S2 · Mac · 2/2.**

1. Follow a feed with at least two unkept posts. The local fixture is [rss.cjs](rss.cjs); its URL is written to `rss-url.txt` when started.
2. From a fresh page, open Feed and choose **Recent → All**. Start with Study posts 2 and 3 unread.
3. Right-click Study post 2 → **Mark read**; wait for completion.
4. Set `window.__ORE_SLOW = { feed: 1800 }`.
5. Right-click Study post 3 → **Mark read**, immediately press ⌘Z, and wait four seconds.

**Expected:** Post 2 stays read; post 3 returns to unread.

**Actual:** Post 2 becomes unread; post 3 stays read. The read-log writes and row classes agree.

**Evidence:** [run 1](feed-mark-pending-undo-1.png), [run 2](feed-mark-pending-undo-2.png), [run 1 classes](feed-mark-1.json), [run 2 classes](feed-mark-2.json), [script](feed-undo.js), [read log](library-evidence.json).

**Code:** `apps/desktop/src/Feed.tsx:162` updates the read mark immediately; **169–170** register history only in the fulfilled write callback. This is separate from F24's multi-selection shortcut issue.

### MAC-6 — Unfollow ignores immediate Undo and undoes the preceding read mark

**S2 · Mac · 2/2.**

1. From a fresh page, open the followed **Mac Study Notes** feed with **All** selected.
2. Mark Study post 2 read and wait for it to save.
3. Set `window.__ORE_SLOW = { feed: 1800 }`.
4. Right-click a post → **Unfollow Mac Study Notes**, then immediately press ⌘Z.
5. Wait four seconds.

**Expected:** The subscription and posts return; the earlier read mark stays.

**Actual:** The feed remains unfollowed and shows the empty Follow state. Undo reaches the previous read-mark action. Clearing the delay and pressing ⌘Z a second time restores the subscription; this recovery was verified both times.

**Evidence:** [run 1](feed-unfollow-pending-undo-1.png), [run 2](feed-unfollow-pending-undo-2.png), [script](feed-unfollow.js), [run 1 state](feed-unfollow-1.txt), [run 2 state](feed-unfollow-2.txt).

**Code:** `apps/desktop/src/Feed.tsx:178` removes the feed immediately; **181–184** await the command's return before registering restore/Undo. There is no history entry covering the optimistic removal while the response is pending.

## Known rows seen come back

None confirmed on their original paths. These are additional handlers with the delayed-history pattern seen in F22/F146/F156/F393/F459/F470. Existing exceptions and excluded open rows were not re-reported. No page errors were recorded during these journeys.

## What passed

- Highlight → Key point, Question, and Try it type changes, followed by immediate Undo during delayed annotation saves; highlight deletion and immediate Undo also restored the highlight, twice.
- Collected displayed saved highlights and typed points and allowed opening their annotations; failed pending-Undo paths are listed above.
- Two feed journeys followed the local RSS feed, opened a post beside the list, and kept the post by highlighting; kept posts left the feed and appeared as sources.
- Unfollow followed by Undo after its write completed restored the subscription and its remaining posts.
- Review Later followed by Undo returned to the same exercise, twice.
- Explain with AI grading off exposed the error and usable manual key-point/rating controls, twice.
- Review exercise editing and retirement both handled immediate Undo during delayed saves, twice; retirement recovery said the exercise would return in a later review.
- Leaving Review mid-session worked; two fresh-page runs exercised the end screen's Keep going and Done buttons successfully.
- Reading Settings: every width, line-spacing, page and font choice responded; text size changed up/down. General's skill tags and diagram controls changed and changed back, twice.
- Review Settings: weekday, new-exercise count, daily-plan text, reminder, remix, sound and voice controls changed and changed back, twice. Menu-bar and login switches responded in the mock; native effects were not verified.
- Shortcut controls: quick-quiz remapping, disabling/Undo and restoring its original combination; sidebar-shortcut remapping/reset; search by shortcut keys, twice. This verifies the UI, not native global registration. Each recorder was allowed a frame to take focus.
- AI provider changed Claude → ChatGPT → Claude, and model Sonnet → Opus → Sonnet, twice; no AI was run.
- Ask your library from ⌘K opened the tutor and exposed Try again with AI off. A controlled reply citing the seeded Testing Effect source opened it and highlighted the exact cited sentence, twice ([script](ask-citation.js), [run 1](ask-citation-1.png), [run 2](ask-citation-2.png)). This tests citation navigation, not AI answer quality.
- PDF Original rendered and its Next/Previous page buttons worked; a fresh-page reopen also navigated successfully ([run 1](pdf-original-1.png), [run 2](pdf-original-2.png)).
- The seeded recording played/paused, skipped forward/back, changed speed and played from a transcript highlight, twice ([script](audio-run.js)). Sound content and native media keys were not assessed.
- Finish kept recall writing in source notes with AI feedback unavailable. A repeated submission key during the delayed recall/Done saves did not append the recall twice; pending Finish Undo failed as MAC-3.

## Artifacts and limits

The `.js` journey snippets execute inside [driver.cjs](driver.cjs), which connects to the supplied browser and loads the two required init scripts in order. Run from the repo root with `node codex-out/mac/driver.cjs`; load [helpers.js](helpers.js) before snippets needing text selection. The local RSS fixture uses an ephemeral port and has a 25-minute lifetime cap. It was stopped at the end of this run; the browser context and page were closed. No supplied server was started or stopped.

The ordinary Find/outline paths, completed source-note editing, keyboard-recording cancellation, and basic PDF import had already passed today's earlier sweeps; this run targeted their untested adjacent actions instead. Native Finder, notification scheduling, login launch, global shortcut registration, table-reader installation, real AI and real YouTube/podcast network playback remain outside this browser test's verified coverage.
