# Offline tester — Feed and network failures

Tested commit `32f3dc4763411212971ab2297d1e2c4b6c648999` in the supplied WebKit, using Mac 1764/bridge 1765 and phone 1766. Covered real RSS follow/refresh, added/edited/removed posts, malformed/truncated/empty/HTML responses, a vanished fixture returning, duplicate items, a 5,000-item feed, 12 additional subscriptions/360 displayed posts, posts kept by notes, repeated URL imports, Mac import/tutor/grading/explanation/enrichment failures, and phone offline reading/queued links. Fixtures were served by the **already-running assigned phone Vite server**, through `/@fs/<repo>/codex-out/offline/`; no server was started. Feed findings used the real CLI and cache, not fabricated Feed replies. Browser clock changes triggered stale-feed refreshes and later reading states; publication dates tested the 14-day cutoff because `page.clock` does not change the CLI's clock. Skipped pure visual polish, listed known limits, live AI, actual weeks of CLI wall time, HTTP redirects/feed URL migration, and real YouTube playback (the supplied mock has no native player relay), and a separate Mac remote-image disconnect test. Mac network-command failures were injected rather than disconnecting the local HTTP bridge, which would also break otherwise-offline library reads. Phone dev-module fetch failures while disconnected were excluded as harness artifacts. No tracked files were changed; library writes happened through the app.

## Findings

### OFF-1 — Truncated XML silently removes the feed's cached posts

**S2 — Mac. Reproduced 2/2, with separate feed files and fresh pages.**

1. Open a fresh Mac page with the assigned bridge init scripts. Put a valid RSS file in this tester's output folder, containing two recent posts with unique URLs. Use a new filename/post URL suffix when repeating against the already-used scratch library.
2. Paste `http://localhost:1766/@fs/Users/tylerpoelking/Developer/ore-wt/sweep8/codex-out/offline/<fixture>.xml` into Add. Wait for the feed preview, then press Enter to follow it. Open Feed and confirm both posts.
3. Replace only the fixture's response body with `<rss><channel><title>Offline feed` — an interrupted XML response with no closing tags.
4. Advance the page clock at least 31 minutes, go Home, then return to Feed to trigger a refresh. In the script this uses `page.clock.setFixedTime(new Date(Date.now() + 31 * 60000))`.
5. Observe that the posts disappear with no error, Try again, or indication that refresh failed. With no other posts present, the screen says **“No posts in the last two weeks.”**

**Expected:** Reject malformed XML, retain the last successfully fetched posts, and show the feed's error with a retry action, as happens for an HTML or empty response.

**Actual:** The forgiving XML parser returns zero posts as a success. Refresh replaces the previous cache with that empty result. This falsely tells the learner there is nothing recent and removes their pending reading choices until a later successful refresh. Kept sources/notes were not lost, so this is S2 rather than S1.

**Evidence:** `feed-live.json` entries `initial`, `edited and removed`, `truncated`, and `html`, for runs 1 and 2; independent parser confirmation in `parser-results.json`.

**Screenshots:** `codex-out/offline/feed-initial-1.png`, `codex-out/offline/feed-truncated-1.png`, `codex-out/offline/feed-truncated-2.png`. `feed-html-1.png` shows the working error alternative.

**Suspected code:** `packages/core/src/feeds.ts:94` parses without checking well-formedness; `:178` accepts the RSS prefix and passes the body to the parser; `:314` replaces cached posts for anything that did not throw. `apps/desktop/src/Feed.tsx:447` renders the misleading empty state.

### OFF-2 — Repeated items consume the feed's limit and hide distinct recent posts

**S2 — Mac. Reproduced 2/2, with separate feeds and fresh pages.**

1. From a fresh Mac page, follow a fixture feed containing recent posts A and B with unique URLs, as above. Confirm both appear.
2. Change the fixture to contain 30 copies of A followed by B. Give all entries the same recent publication date. The XML is valid and contains only **two distinct posts**.
3. Advance the page clock 31 minutes, go Home, and return to Feed.
4. Only A appears. B is absent, although it is still in the feed and is recent/unread.
5. Replace the fixture with one A and one B and refresh again. B returns without any other change.

**Expected:** Duplicate entries should not use up the 30-post allowance; both distinct posts should remain available.

**Actual:** Refresh takes the first 30 raw entries, then `feedView` deduplicates the resulting list. Thirty copies of A become one visible row; B never reaches the cache. The same ordering issue can reduce a larger duplicated feed's coverage before its distinct-post limit is reached. No duplicate source was created.

**Evidence:** `feed-live.json`, runs 1 and 2, `initial` → `duplicates` → `recovered`; `duplicates.xml` and `parser-results.json` show 31 parsed entries but only one unique URL in the first 30.

**Screenshots:** `codex-out/offline/feed-initial-1.png`, `codex-out/offline/feed-duplicates-1.png`, `codex-out/offline/feed-duplicates-2.png`.

**Suspected code:** `packages/core/src/feeds.ts:304` truncates before `:354` deduplicates. Deduplication needs to precede the per-feed limit.

## Known rows seen again

None confirmed. The ordinary note-keep/reopen path did not reproduce F143/F144. Their exact held-save race was not repeated. F303's long-list scroll restoration was not retested. No findings are assigned registry numbers or added to `docs/reviews/findings.md`, per the findings-only instruction.

## What passed

- Real refresh replaced edited titles, added new posts, and removed posts no longer published (`feed-live.json`, both runs).
- Missing fixture, empty body, and HTML body retained cached posts and showed Try again/Unfollow; returning valid XML cleared the error without reloading (`feed-edges.json`). The missing fixture received Vite's fallback rather than a controlled HTTP 404.
- A 15-day-old publication disappeared under the actual CLI's 14-day cutoff (`feed-edges.json`).
- Twelve additional feeds produced 360 rows; the 5,000-entry feed contributed 30. Following, navigating, and refresh completed within the script's waits; this was not a formal frame-time benchmark (`feed-edges.json`).
- A delayed Feed answer completed after release, and the list remained usable (`feed-edges.json`); no claim about arbitrarily long upstream hangs.
- A note kept each of two previews as a source. After the feed removed its posts, the source and exact note still existed on disk (`keep.json`).
- Adding each kept URL again retained the same source path and note, with one matching source rather than two (`keep.json`).
- Two injected Mac add failures retained the entered URL, showed the connection error, and created zero matching sources; submitting again after clearing the fault saved one source without reload (`keep.json`, `add-offline-1.png`, `add-offline-2.png`).
- Tutor connection errors offered Try again; a synthetic successful reply recovered the same conversation without reload, twice (`journeys.json`).
- Grading failures preserved the typed answer, exposed manual key-point marking and rating, and offered retry. A synthetic successful retry marked both points (`grade.json`; the final script's second iteration stopped on a confidence-selection setup issue, not an app finding).
- Enrichment failure showed “Couldn’t write prequestions,” the connection reason, and Try again, twice (`enrich-explain.json`). Live successful enrichment was not run.
- Explain showed its connection failure and Retry; a synthetic successful retry displayed the explanation in the same popup, twice (`enrich-explain.json`).
- Phone reading already loaded content continued offline; the review picker still opened. This does not claim a complete offline rating journey (`phone-final.json`).
- Phone HTTPS adds while offline remained visible in Coming in with the connection reason, “Your Mac will try it,” and Remove, twice. Reconnection alone did not immediately import the waiting link; the visible Mac handoff remains the current recovery route (`phone-final.json`, `phone-queued-1.png`, `phone-queued-2.png`).
- No phone Feed was expected or reported missing: D107 explicitly says it is not on iPhone yet.

## Reproduction artifacts and limits

- `feed-live.cjs`: the two full-path finding reproductions. It was run before the keep tests; use new fixture/post suffixes or a fresh assigned seed to replay, because some original posts are now saved sources and correctly excluded from Feed.
- `feed-edges.cjs`, `keep.cjs`, `journeys.cjs`, `enrich-explain.cjs`, `phone-final.cjs`: additional coverage; each has its corresponding JSON log.
- `parse-fixtures.ts`: read-only parser checks; writes only fixture files/results in this folder.
- AI successes were synthetic `__ORE_REPLY` data; failures were `__ORE_FAIL`. These validate UI recovery, not vendor behavior or generated-content quality.
- `phone-final.cjs` warmed the importer online before disconnecting, used a fresh context per repetition, touch input, and a controlled HTTPS article response. Its offline request was aborted while `context.setOffline(true)` was active.
- Exploratory `probe`, `net`, `explore`, `phone`, and `phone-https` scripts/logs remain for traceability. The earlier phone runs exposed the development-server module-fetch limitation; only `phone-final.json` is used for the stated queued-link behavior.
- Browser pages/contexts created by these scripts were closed. No background tester process or server was left running.
