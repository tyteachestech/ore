# Fresh — recent changes sweep

Tested checkout `cc6e604` on 2026-11-15, using the supplied release build at `1741`, scratch-library bridge `1742`, and shared WebKit endpoint. Read the preamble, working agreement, daily-session model, relevant decisions D274/D277–D289, recent Git history, and findings register. Covered the Mac pick bar in All sources and Learning; filter tags with search and navigation; Feed reading, saving notes, read/unread, J/K, Esc and a failed download; pointer/keyboard menus; sound starts, Undo, failed ratings, mute and simulated hidden-page completion; goal crossing, the bonus ring, both cart variants and a no-cart ending. Also checked touch review and the miss ending at 390×844 on the supplied phone build. No application code or tracked files changed. Screenshots are 2×. No new servers or browsers were launched; created contexts/pages were closed. Limits: eight consecutive fast misses exhausted the seeded session, so the remaining two were in a second session; native OS hiding/mute, iOS Simulator behavior, every menu in the entire application, a genuinely empty remote post, D285 media chapter controls, and the second bonus lap were not verified. The phone check was a focused review smoke test, not a full iOS audit. Pure visual polish and the preamble's excluded known rows were not reported.

## 1. Findings

### F301 — Esc loses the Feed's reading position

**S2 · Mac · reproduced 4/4** (two initial runs, then two after a page reload; Unread and All).

1. From a fresh page, open Feed. If no feed exists, use Add to follow `https://simonwillison.net/atom/everything/`.
2. Choose Recent → All, so previously read posts remain available. Use a feed long enough to scroll.
3. Scroll to a lower post and open it. In this run, the post was **Terry Pratchett's Study**, around the twentieth post before the two saved posts left the Feed.
4. Press Esc to return to the full list.

**Expected:** The post just read remains in view, with the list retaining a usable reading position, as D289 promises.

**Actual:** The list returns to scroll position 0. The tested row moved from viewport y=421 before opening to y=809 after closing, below the 800px window. The split pane had scrollTop=470. All scroll containers read 0 after Esc. The list itself still holds focus, but `aria-activedescendant` was empty; Enter did not reopen the post in additional checks. The actionable, consistently measured failure is the lost scroll position.

**Evidence:** `codex-out/fresh/feed-scroll.json`; screenshots `codex-out/fresh/feed-scroll-return-0.png` and `codex-out/fresh/feed-scroll-return-1.png`. Reproduction script: `codex-out/fresh/feed-scroll.cjs` (run inside `live.cjs`). The last two measurements were made after reloading, using Recent → All.

**Suspected location:** `apps/desktop/src/Feed.tsx:136–145` restores cursor/focus on closing, but only scrolls a row into view when opening. The layout switches between `.feed-col` and `.contents` in `apps/desktop/src/App.tsx:2384–2388` / `apps/desktop/src/styles.css:3054–3058`; retaining the same DOM node did not retain its scroll position. The exact reason Enter loses its target needs a separate trace; `Feed.tsx:501` also clears the keyed state on pointer movement.

### F302 — Fast reveals and ratings stack up to four sounds

**S2 · Mac · reproduced across multiple consecutive ratings and again in the later Good/goal session.**

1. Start a review in a fresh seeded library, with Sound effects on.
2. For a Fact exercise, choose a confidence option to reveal its answer, then immediately click Again or Good.
3. Repeat on successive exercises at roughly three ratings per second. The actual UI labels here are **Again** and **Good**, corresponding to the prompt's Missed and Got it.

**Expected:** Feedback remains distinct at fast input speed, without layering several old answer/rating sounds over the next exercise.

**Actual:** Every answer tick and rating creates another independently playing source. A tick lasts 550ms; the next rating starts roughly 75–95ms later. Subsequent exercise ticks and misses overlap them. The first eight-miss run reached **four simultaneous sounds**. There were no calls to stop a previous source. Even the goal chime begins 500ms after a Good sound whose playback lasts about 849ms at its current pitch, so those overlap too.

Example from the first run, using the audio engine's clock: tick at 72.8468s, miss at 72.9223s, next tick at 73.1429s, next miss at 73.2299s; all four remain active at the fourth start.

**Evidence:** `codex-out/fresh/audio-first-session.json` and `codex-out/fresh/audio-first-session-overlap.json`; second sequence in `codex-out/fresh/goal-cart.json`. Supporting screenshot: `codex-out/fresh/miss-0.png`. Audio logs, rather than the screenshot, establish the overlap. Hook: `codex-out/fresh/live.cjs` intercepts the real `AudioBufferSourceNode.start`, records buffer identity/duration/rate and still calls the original implementation.

**Suspected location:** `apps/desktop/src/sfx.ts:60–75`: every play constructs and starts a source without retaining or stopping the previous one. `apps/desktop/src/Review.tsx:693` delays the goal by a fixed half second without accounting for the rating sound's duration.

### F303 — A rating saved after hiding the page still starts audio

**S2 · Mac · reproduced 2/2**, once for Good and once for Again.

1. Start a review with Sound effects on and reveal an answer.
2. Hold its next review write using `window.__ORE_HOLD = { review: ['manual'] }`.
3. Click a rating, then put the page into the hidden state while the save is waiting.
4. Release the write with `window.__ORE_RELEASE('review')`.

**Expected:** The rating saves, but its sound does not begin while the page is hidden.

**Actual:** Both successful writes started their real audio source with `document.hidden === true`: `/sounds/fx-right.mp3` and `/sounds/fx-missed.mp3`.

**Evidence and limitation:** `codex-out/fresh/sound-prechecks.json` and the two `hidden: true` records in `codex-out/fresh/audio-first-session.json`; screenshot `codex-out/fresh/sound-background-save.png`. The test explicitly overrode the page's `document.hidden` getter and dispatched `visibilitychange`; it did **not** prove macOS window/background audio behavior. The release player's lack of a visibility guard is independently visible in the source. Scripts: `sounds.cjs` and the second iteration of `rapid.cjs`.

**Suspected location:** `apps/desktop/src/sfx.ts:68` checks availability, mute and lateness, but not page visibility; `sfx.ts:86–90` likewise checks only mute. `Review.tsx:646–649` plays after the asynchronous save returns.

## 2. Known rows seen again

No exact prior finding was confirmed as reopened. The Feed result is related to F230's Esc/focus work, but this reproduction uses a retained post in All and measures lost scrolling, rather than the previously fixed post-hidden-by-Unread case. F200's stranded closing popup did not recur in twenty rapid openings. F209's invisible retained pick did not recur. F144's source-note save worked after committing the edit; the source and its note survived reopening. No new row was written into `docs/reviews/findings.md`, per this run's findings-only boundary.

## 3. What passed

- All sources: ⌘-click selects separate rows, ⇧-click extends the range, ordinary click opens the source.
- All sources: bulk filing to Teaching, Mark done and Archive saved; toast Undo and ⌘Z restored the affected sources and their prior skills/statuses.
- Learning: removing both picked sources from Learning, Mark done and Archive each removed both rows; one ⌘Z restored both. See `skill-pick.json`.
- Pick bar: Esc clears it; a filter hiding picked sources clears the pick; selection survives scrolling at a shorter viewport.
- Filters: pointer and keyboard selection work; typed/pasted text combines with a skill tag; deleting text leaves the tag, an additional Backspace removes it; Back/Forward between filtered list and reader retains the tag. Reload starts on Home and discards the transient filter; this was observed, not counted as persistence passing.
- Feed: initial empty-feed screen was usable; a real feed followed successfully; three settled J/K round trips returned to the original post; opened unread posts remained during the reading session.
- Feed: marking unread/read worked; a note kept the source and persisted on disk; a simulated failed next-post download displayed its reason and left the current reader intact, and pressing J after clearing the failure opened the next post.
- Menus: source row right-click, row details, skill importance, skill icon, source actions, source skills, filter, Feed view and reminder picker opened and dismissed. Source actions opened by keyboard had `animation: none`; pointer openings used `pop-in` with edge origins. Twenty rapid source-action/skill-picker openings left no mounted popup. See `menus.json`.
- Sounds: one play per tested reveal/rating; Undo and a failed review write added zero plays; a muted two-miss session, including its ending, added zero plays. The later successful ratings used the ascending pitch steps.
- Goal: a 5-minute goal crossed mid-session played one goal chime. At the end, 9 actual minutes showed as `9 of 5` and `+4`, with the bonus dots in the ring. See `goal-cart.json`, `goal-mid-session.png`, `cart-beat-7.png`.
- Endings: cart with sleeping rider (`Math.random=.1`), cart without rider (`.9`, verified `.review-end.carted`), and no-cart/miss endings completed and allowed Done. Each applicable cart/jingle/pop started once. Frame samples: `cart-beat-*.png`, `cart-no-rider-*.png`, `muted-miss-end.png`.
- iPhone: confidence, two Again ratings and Done worked by touch; the miss-ending animation entered `nod` and no `set` pose was recorded; audio starts remained zero. See `phone-results.json` and `phone-miss-end.png`.

### Counted audio starts

The first Mac context recorded 37 starts in `audio-all.json`; the final cart-without-rider context recorded 5 in `cart-no-rider.json` (identified by unique buffer durations). Total: **42**. These are real Web Audio start calls, not a development-only event counter. Muted moments and the phone added zero.

| Sound | Starts |
| --- | ---: |
| Answer tick | 15 |
| Recall / right | 7 |
| Missed | 8 |
| Goal | 1 |
| Cart | 3 |
| Done jingle | 4 |
| Pop | 4 |

The count includes the original Good later undone and the Good saved in the hidden-state check. Two extra misses were made with sound off. The maximum concurrent count is derived from the audio clock, buffer duration and playback rate, not wall time: the goal journey deliberately advanced `Date` to accrue review minutes.

## 4. Handoff

Only `codex-out/fresh/` holds written scripts/report/screenshots. Scratch-library changes were made through the app: reviewed exercises, two saved Feed posts with test notes, and a followed test feed. Original source filing/status changes were undone; the daily goal was returned to 10 minutes. No changes to the real library, installed app, other tester folders, or running servers. All owned browser contexts were closed and the interactive driver exited. No full unit/e2e suite was run because this was a release-build exploratory test with no code changes.
