# Follower — two weeks of Feed visits

I used the supplied release WebKit Mac app at 1280×800, screenshots at 2×, with only the follower scratch library. Visits were on **November 28 and 30, December 2, 5, 9 and 11, 2026** (Days 1, 3, 5, 8, 12, 14), moving the page clock forward through every intervening day. I followed five real feeds, kept **nine sources**, wrote a note on each, read whole short pieces or focused sections of longer pieces, dismissed posts, used Undo, revisited saved notes, unfollowed/refollowed Latent Space, followed a migrated DeepMind address temporarily, and exercised two injected refresh failures. **Two S2 findings and one S3 finding; no lost saved note or S1 failure.** The source servers did not publish new material during this accelerated calendar: after the first visit I chose from **All**; only one unkept post remained on Day 12 and none on Day 14, so twelve new keeps were not possible. I skipped iPhone, native video playback, Review/Finish/AI grading, exhaustive transcript accuracy, and visual taste. Earlier runs and relevant known rows were consulted; the specific PDF, math, tutor and review-goal repairs in #587/#593 were not exercised. All artifacts are here; no product/repo files were changed, and the owned browser context and connection are closed.

## Findings, greatest learner cost first

### 1. Article imports remove the paragraphs that explain what the remaining text refers to — S2 · Mac

**Cost across Days 1 and 8:** the material itself stops making sense. I had to inspect the saved original to identify the person in “He walks through…” and the event and metric discussed in the second article. This undermines D122 even though the files save successfully.

1. From a fresh page dated November 28, follow `https://www.latent.space/feed` through Add → Follow.
2. Open **[AINews] Inside the exploding Coding Data Market**. Read its first paragraphs; write a source note to keep it.
3. Compare the text with its kept `source.html`: the original introduces **Gabe Greenberg**, links his interview and presents its video. The saved `doc.md` skips the introductory paragraph and video link, then says **“He walks through…”** without introducing him.
4. Reopen the saved source through the command palette, choose Source actions → Reimport. The same paragraph remains absent.
5. Independently open and keep **[AINews] Jensen Is Back! and OpenAI Shows Its Pretraining Curve, joined by Microsoft**. Its original first explains Jensen's return and the board's decision, and later introduces OpenAI's pretraining curve and the measured quantity. Ore drops those paragraphs. Its text starts **“As Matt Levine points out…”** and then **“Think of it…”**.

**Expected:** preserve the article's explanatory paragraphs and usable embedded-media links, or explicitly refuse/inform the learner when content cannot be kept. **Actual:** these paragraphs exist in the saved original but not the canonical learning text, with no warning. The missing introductory context is the finding; I do not claim every omitted promotional/social element must be kept.

**Reproduction:** two independently imported articles, plus a repeated reimport of the first (same omission). Reimport's backend completed in **692 ms**; the automation waited for the wrong success wording afterward, so that 60-second selector timeout is not app latency.

**Evidence:** [Day 1 missing introduction](day1-first-post.png), [Day 8 second article](day8-jensen.png), [first article after reimport](day8-missing-context-reimport.png), [exact checks](fidelity-checks.json). Full original, canonical text and note pairs are in [fidelity/](fidelity/). The first source is `inside-the-exploding-coding-data-market-01M8HE9D3KKADMCCGVWW8EF5SA`; the second is `jensen-is-back-and-openai-shows-its-pretraining-curve-joined-01M93F086AMR2DDWB4HCV71986`.

**Suspected code:** `packages/core/src/ingest/web.ts:538` accepts Defuddle's extracted article as the complete text. The exact removal heuristic is not isolated. `web.ts:34` handles iframe/native-video links; the first original instead contains a linked video facade, so this is not a demonstrated recurrence of #587/F869's native `<video>` fix.

### 2. A kept YouTube Short opens from Feed as a new, empty-note preview — S2 · Mac · related recurrence of F610

**Cost across Days 1 and 3:** the learner sees a saved video as if it were another Feed item, waits for it to import again, and finds an empty note. The original work is safe, but the screen makes it look missing. Two unnecessary opens cost **3,836 ms each**.

1. From a fresh page dated November 28, follow `https://www.youtube.com/@3blue1brown`.
2. Open **Encoding the encyclopedia on a rod**. Its Feed URL is `https://www.youtube.com/shorts/0IZcjWtWmDA`.
3. Write a source note and wait for **Not saved** to disappear. Leave the reader.
4. Reload, open Feed → Recent → All. The kept Short is still listed, unlike ordinary kept articles.
5. Open it again and open Source note. It is a new **Not saved** preview with an empty note. Repeat after leaving/reloading while it remains within the Feed's fourteen-day window.

**Expected:** a kept post leaves Feed, or reopening the same video returns the saved source and note. **Actual:** saving canonicalizes the URL to `https://www.youtube.com/watch?v=0IZcjWtWmDA`; the Feed's `/shorts/` URL is treated as different. A second item is imported. Leaving the unmodified duplicate preview removes that preview; the original saved note survives.

**Reproduction:** **2/2 repeat opens** after the original save, once on Day 1 after a fresh page and once on Day 3. Not just the deliberate retention of already-read rows during one Feed visit.

**Evidence:** [still in Feed after fresh page](day1-kept-short-returned.png), [first reopen](day1-short-second-open.png), [second empty-note preview](day3-kept-short-empty-note.png), [first duplicate metadata](day1-short-reopen/docs.json), [second duplicate metadata](day3-short-repeat/docs.json), [original retained note](sources-audit.json). Saved ID: `01M8HEANXZNTVNFEN5K2Z1Y74T`; repeat preview IDs: `01M8HHKHBCMJ3B1E68ZKH48J03` and `01M8PK25S1ZD81BSS0JS2HMZ3A`.

**Suspected code:** `packages/core/src/ingest/index.ts:584` (`linkKey`) and `:590` (`byLink`) compare host/path/query without unifying YouTube URL forms; `packages/core/src/feeds.ts:435–452` uses that comparison both to exclude kept sources and open posts. **F610's saved-link symptom recurs for Shorts → watch.** Its original http/www cases were not retested.

### 3. Mark read ignores a single post selected with Command-click — S3 · Mac

**Cost:** my last unread post would not dismiss with the shortcut advertised in its menu. I had to use the context menu instead. This appeared while clearing the remaining posts, after the same shortcut had worked on the larger selection.

1. From a fresh page with an unread Feed post, use Recent → Unread.
2. **Command-click** one post, without first navigating the list with arrow keys. In this run it was **How Clay Builds GTM Agents — Jeff Barg, Head of AI**.
3. Press **Shift-Command-U**, the Mark read shortcut shown in the post menu.
4. Observe no read mark, disappearance, error or wait indicator. Right-click the same selected row → **Mark read**; it works.

**Expected:** the keyboard action applies to the selected post, whether one or several are selected. **Actual:** a one-row mouse selection is ignored by that key path.

**Reproduction:** **2/2**, Days 5 and 8, with a reload between. First remained unread for the full **12-second** observation timeout; second remained selected/unread after **255 ms**. No corresponding `feed read` call was sent. Context-menu recovery succeeded.

**Evidence:** [first failure](day5-single-selected-mark-no-effect.png), [repeat](day8-single-selected-mark-no-effect.png), [request log](requests.jsonl). **Suspected code:** `apps/desktop/src/Feed.tsx:156` only defines `current` after keyboard navigation, `:256–270` selects by mouse without setting that state, and `:342–346` handles a picked group only when its length exceeds one. Related to F24, but the previously fixed multiple-selection case passed; this is the single-selection gap.

## Known rows and test boundaries

- **F610:** the saved-link symptom reappeared for YouTube Shorts; detailed above. No other known-row recurrence was established.
- **F144:** ordinary note-based keeping immediately cleared Not saved and retained the source; later saved-note reopening passed. This is not a pending-save race test of F143/F603.
- **F24/F638:** marking a multi-pick worked. Undo restored the 18 changed posts without making the already-read Short unread.
- **F739 held for Feed writes:** followed, checked and read-mark timestamps advanced to the page's calendar date. This does not verify review scheduling, limits or missed-day queue behavior.
- **#587/#593:** no blanket verification claim. The specific matrix, related-work, native-video, PDF, tutor/citation, phone note and goal-rounding fixes are outside these Feed journeys. The new article omission is documented separately from those fixes.
- The video-player startup message is **harness-limited**: `Video.tsx:94` needs Tauri's `player_port`; the supplied mock supplies no native player. Transcripts remained usable. It is not counted as a product finding.
- A Day 1 immediate Redo followed by reload did not persist the redo. The save was interrupted by the test; it was not repeated under controlled timing and is **not a finding**. A subsequent Mark read was allowed to settle and persisted.
- Two 60-second selector timeouts expected an error/success message that never should have appeared: DeepMind migration succeeded and reimport returned without the expected wording. They are excluded from learner wait totals. One startup connection closed on stdin EOF; one Day 1 automation session restarted at 09:00, forward from its prior time. No simultaneous tester contexts were used.

## Feed and file audit

Initial library: **67 sources**, no `feeds.yaml`. Final: **76 sources, nine nonempty new source notes, five subscriptions, no leftover preview**. Saved sources and notes are listed in [sources-audit.json](sources-audit.json). Evidence snapshots for each day contain `feeds.yaml`, `.index/feeds.json`, read-mark logs, review/session files and canonical documents; [daily-audit.json](daily-audit.json) summarizes them.

The five subscriptions were BAIR (research blog), One Useful Thing (newsletter), Latent Space (podcast/newsletter), 3Blue1Brown (YouTube), and arXiv cs.AI (research category). BAIR and One Useful Thing had no entries within the relevant window; arXiv returned no entries. The feed proof accurately disclosed the newsletter's newest date, November 9.

| Visit | Date | New keeps | Total sources | Posts cached for the five subscriptions | Latest read / unread marks |
|---|---|---:|---:|---:|---:|
| 1 | Nov 28 | 2 | 69 | 20 | 20 / 0 |
| 3 | Nov 30 | 2 | 71 | 20 | 19 / 1 |
| 5 | Dec 2 | 2 | 73 | 14 | 19 / 1 |
| 8 | Dec 5 | 2 | 75 | 8 | 19 / 1 |
| 12 | Dec 9 | 1 | 76 | 5 | 20 / 0 |
| 14 | Dec 11 | 0 | 76 | 2 | 20 / 0 |

Cached counts include kept posts, which the UI correctly excludes except for the Short URL issue. Read-mark history outlives the display window. The one intentional unread mark on Days 3, 5 and 8 was **How Clay Builds GTM Agents**, restored with Undo each visit; it became a kept source on Day 12. No dismissed post unexpectedly returned. Older posts expired as the clock moved forward. The last two cached posts on Day 14 were already kept, so Feed All was empty.

Day 8 unfollow/refollow produced four then five subscriptions; it preserved read history and kept sources. Day 12's old `https://deepmind.com/blog/feed/basic/` resolved to `https://deepmind.google/blog/rss.xml`, persisted under that current URL and was then unfollowed, returning to the five chosen subscriptions. This verifies a **real moved address**, not a real publisher outage. Two explicitly injected `feed --refresh` HTTP-503-style failures displayed an error and preserved the cached row; clearing the hook restored refresh. Per-publisher persistent error rows were not forced.

**Review claims:** zero ratings were made; all six saved review-log snapshots equal the baseline byte-for-byte. No end screen was opened, so there are no end-screen counts to certify. Day 14 Home showed **0 of 10 min**, consistent with reading not counting toward the review goal ([screenshot](day14-home.png)). Review timing code was read (`review-session.ts:568–573` records capped active time at ratings); this Feed run makes no FSRS/new-limit claim.

**Import fidelity:** nine retained documents have notes and kept originals. The Short has timestamps through 01:58; the three podcast transcripts reach 32:21, 53:27 and 72:04. This checks boundaries, not word error rates. Article headings and figures were spot-checked; the two confirmed narrative omissions prevent an “all imports whole” pass. Background enrichment ran, but generated exercise quality was not evaluated.

## What passed

- Follow found and persisted all five selected feeds without saving their posts as sources automatically.
- Single-click opening, split Feed/reader layout and source-note keeping worked for ordinary article/podcast URLs.
- Nine kept source notes survived subsequent visits; the Day 5 formal-verification note reopened verbatim on Day 14 in 198 ms.
- Read marks persisted across reload, skipped days, expiry and Latent Space unfollow/refollow.
- Multi-selection Mark read and its Undo restored the correct prior read states.
- Expired unsaved posts left the Feed while kept sources remained accessible through the library.
- A moved real feed address resolved to its current endpoint.
- Two injected refresh failures showed errors and retained cached content; recovery succeeded.
- No product file was edited, and no server, watcher, installed app or owner's live library was started, stopped or touched.

## Where the minutes went

These are **instrumented intervals, not a human-speed study benchmark**. No artificial reading dwell was inserted and no full podcast was watched. “Reading/note interval” runs from a successful Feed open response to the first saved note; it includes inspection/typing overhead and excludes the import wait. “Adding” is subscription-command time. “Waiting” sums feed opens, refreshes and reimport requests, including the duplicate Short opens. Those categories do not include every automation/debugging minute. Lost time is a subset of waiting or a separately observed no-response interval, not an extra number to add to it. Day 14 rereading had no new note save and was not separately timed.

| Day | Review | Reading/note interval | Adding | Waiting | Lost / recovery observed |
|---|---:|---:|---:|---:|---|
| 1 | 0 | 0.91 min | 0.06 min | 0.15 min | 3.836 s unnecessary Short reopen; missing-context investigation unmeasured |
| 3 | 0 | 1.07 min | 0 | 0.60 min | 3.836 s unnecessary Short reopen |
| 5 | 0 | 0.77 min | 0 | 0.87 min | Single-select shortcut unresponsive for 12 s observation; context-menu recovery |
| 8 | 0 | 0.90 min | 0.02 min | 0.06 min | Same key unresponsive for 255 ms; source-comparison work unmeasured |
| 12 | 0 | 0.93 min | 0.02 min | 1.15 min | No established wasted save; 65.59 s episode import was the major wait |
| 14 | 0 | Not separately timed | 0 | 0.03 min | None observed |

Raw derivation: [time-audit.json](time-audit.json), [requests.jsonl](requests.jsonl). The measured action waits below include UI overhead, so they differ slightly from backend-only totals.

## Felt slow

All successful action measurements from `performance.now()` are listed below, slowest first. Loading feedback was visible during imports/follows. The 65.59-second Clay import exceeded the 60-second UI probe; its backend duration is exact, while exact press-to-readable time was not captured. Refresh and discovery request waits over one second are listed separately afterward; they overlap the action timings where noted and must not be added twice.

| Day | Action | Press to usable |
|---|---|---:|
| 12 | Clay episode: backend only, UI probe exceeded 60 s | 65.589 s backend |
| 5 | Open The Revolution vs The Renaissance — Thariq Shihipar, OpenAI | 49.059 s |
| 3 | Open Inside the AI Training Data Market — Gabe Greenberg, G2i | 30.962 s |
| 1 | Open Encoding the encyclopedia video | 4.894 s |
| 1 | Reopen kept Short from Feed | 3.836 s |
| 3 | Open Encoding the encyclopedia on a rod | 3.836 s |
| 5 | Open The War Against Slop and an Emerging Weapon to Fight it: Formal Verification | 3.338 s |
| 3 | Open [AINews] Math Proofs Are Landing Faster Than We Can Read Them | 1.829 s |
| 8 | Open [AINews] Jensen Is Back! | 1.828 s |
| 1 | Follow https://www.youtube.com/@3blue1brown | 1.317 s |
| 1 | Open coding-data article | 1.313 s |
| 8 | Open [AINews] Gemini 4 Neon marks | 1.310 s |
| 8 | Follow https://www.latent.space/feed | 1.308 s |
| 1 | Follow https://rss.arxiv.org/rss/cs.AI | 0.808 s |
| 1 | Follow https://www.latent.space/feed | 0.801 s |
| 1 | Follow One Useful Thing | 0.798 s |
| 8 | Dismiss 1 unread posts | 0.294 s |
| 1 | Open Feed | 0.244 s |
| 1 | Keep coding-data article by note | 0.205 s |
| 14 | Reopen saved formal-verification article | 0.198 s |
| 5 | Day 5 reload Feed | 0.149 s |
| 12 | Day 12 reload Feed | 0.146 s |
| 8 | Day 8 reload Feed | 0.137 s |
| 14 | Day 14 reload Feed | 0.133 s |
| 3 | Day 3 reload Feed | 0.126 s |
| 1 | Mark rest read settled | 0.014 s |

Additional measured waits: Day 1 Latent Space discovery **1.298 s**, 3Blue1Brown discovery **1.794 s**; Day 8 reimport **0.692 s backend**; Day 12 moved-DeepMind follow **1.043 s backend**; feed refreshes **1.984 s** and **1.701 s** on Day 12, **1.975 s** on Day 14. The 2 ms BAIR completion probe began after following had finished, so it is not a valid action-latency measure; BAIR follow itself took **0.791 s backend**. All individual backend waits over one second are retained in [slow-requests.json](slow-requests.json).
