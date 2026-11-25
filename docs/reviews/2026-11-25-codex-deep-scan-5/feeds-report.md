# Deep scan 5 — feeds

Covered feed parsing and discovery, subscription identity and ordering, overlapping refreshes, read-state actions with failed writes, queued links/files, and Feed metadata versus disk. Tested RSS 0.91/0.92/1.0 RDF/2.0, Atom, namespaces, CDATA/entities, encodings, GUIDs, relative addresses, dates, redirects, HTML responses, and 5,000 items with synthetic documents and stubbed fetches. Read the working agreement, spec, glossary, decisions including D107, findings and sweep history, and skimmed the four previous scans. Skipped their preview-close races (F143/F144/F603), scroll behavior (F303), duplicate-item/truncated-download tests (F366/F367), equivalent saved URLs (F610), mixed-selection Undo (F638), podcast episode matching (F584 and scan 2), EPUB front matter, highlight animation, all real sites, AI, windows, devices, servers, watchers, full suites, and benchmarks. No application source or review registry changes remain; all artifacts are under `codex-out/feeds/`.

Snapshot: `05c68297d33d46d6b17b404c101543bc9dfd9557`, Bun 1.4.4, 2026-11-24 local. **Ten findings, twelve red scenarios, each reproduced 3/3 times in the final runs.** Commands below run from the repository root. Each runs one short Bun process, exits 1 at its symptom assertion, uses only this folder's scratch libraries, and stubs network/AI. Time is pinned to `2026-11-24T12:00:00Z`; race order uses explicitly released promises. Full outputs are in `logs/<script>-<mode>-{1,2,3}.txt`. No finding depends on a real window or macOS API. The queued-file issue uses shared core reached on both platforms; Feed itself is Mac-only under D107.

## Findings

### feeds-01 — Removing a queued file's sync copy deletes the original entry's payload

**S1 · Both (shared inbox core; reproduced on Mac filesystem).**

Red command:
```sh
ORE_NO_ENRICH=1 bun codex-out/feeds/state.ts inbox-copy
```
```text
[DEEP] inbox-copy {"before":2,"after":0,"originalEntry":true,"payload":false}
AssertionError: removing a sync copy must preserve the still-queued original payload
false !== true
```

Minimised steps: queue one file; copy its `<id>.file.json` metadata to `<id> 2.file.json` as a sync conflict can do; remove only the copy by its displayed id. Both metadata entries refer to the same captured file.

Expected: only the selected entry disappears; the original remains importable. Actual: `removeQueuedLink` deletes the shared file directory. The original metadata remains on disk, but `queuedLinks` hides it because its payload is gone. The captured inbox copy is lost; recovering it requires the original outside Ore or another backup. This is not merely duplicate display.

Ranked hypotheses and probes:
1. Removal owns the shared payload unconditionally. **Confirmed:** the original JSON survives, while the payload does not.
2. Listing only collapses the duplicate. **Rejected:** `existsSync` confirms physical deletion.
3. Only the suffixed copy id is mishandled. **Rejected:** removing the original first also leaves its copy with no payload.

Probe: `ORE_NO_ENRICH=1 bun codex-out/feeds/probes.ts state`, output in `logs/probes-state.txt`. The code expressly treats conflict copies as independent entries (`inbox.ts:68–69`), so the fixture represents a supported state. **Cause:** `packages/core/src/inbox.ts:81–85` removes the payload directory without checking surviving references; `:67` subsequently hides the remaining entry. **Reproduced:** 3/3.

### feeds-02 — A reorder containing a URL and its title silently deletes another subscription

**S1 · Mac CLI/core.** This requires a mixed-reference reorder supplied through the CLI/core; the current drag UI normally supplies URLs only.

Red command:
```sh
ORE_NO_ENRICH=1 bun codex-out/feeds/state.ts arrange-alias
```
```text
[DEEP] arrange-alias {"urls":["https://example.test/a.xml","https://example.test/a.xml"]}
AssertionError: invalid order must not silently delete followed feed B
```

Minimised steps: follow A and B; call `arrangeFeeds(lib, [A.url, "A"])`. The two input strings are distinct, but both resolve to A. The CLI accepts the same string array through `feed arrange` (`packages/cli/src/cmd-feed.ts:32–35`).

Expected: reject an order that does not contain each followed feed exactly once, leaving `feeds.yaml` unchanged. Actual: save A twice and drop B from canonical `feeds.yaml`, with success returned. The file contains one YAML entry and an alias pointing to that same A; B is absent.

Ranked hypotheses and probes:
1. Uniqueness is checked before resolving URL/title aliases. **Confirmed:** distinct inputs resolve to the same object and both get written.
2. Only returned/displayed data is duplicated. **Rejected:** reading `feeds.yaml` confirms B is gone.
3. Reordering generally drops B. **Rejected:** `[B.url, A.url]` preserves both and passes.

Probe: `ORE_NO_ENRICH=1 bun codex-out/feeds/probes.ts state`. **Cause:** `packages/core/src/feeds.ts:284–286` validates raw strings and then writes resolved references; `:253–254` accepts both titles and URLs. **Reproduced:** 3/3.

### feeds-03 — An older refresh can remove newly fetched posts or a newly followed feed's cache

**S2 · Mac.** These are two deterministic symptoms of refresh results committing without checking whether their snapshot is still current. Source documents and read marks are not deleted.

Red commands:
```sh
ORE_NO_ENRICH=1 bun codex-out/feeds/state.ts refresh-follow
ORE_NO_ENRICH=1 bun codex-out/feeds/state.ts refresh-order
```
```text
[DEEP] refresh-follow {"before":["A","B"],"after":["A"],"followed":["A","B"],"cache":{"feeds":{"https://example.test/a.xml":{"checked_at":"2026-11-24T12:00:00.000Z","posts":[{"url":"https://example.test/A","title":"A","feed":"https://example.test/a.xml"}]}}}}
AssertionError: a refresh started before Follow must not erase the new feed cache

[DEEP] refresh-order {"before":["new","old"],"after":["old"]}
AssertionError: an older refresh must not replace the later successful refresh
```

Minimised steps, new-feed case: follow A; hold A's refresh response; follow B and refresh B successfully; release A's older response. Same-feed case: hold a refresh returning only `old`; complete a newer refresh returning `new, old`; release the older one.

Expected: the current successful cache remains current. Actual: B stays followed but has no cache/posts; or the newly fetched post vanishes. Both operations report success, without a feed error. A later successful refresh can repair the cache.

Ranked hypotheses and probes:
1. Pruning uses the subscription list captured before waiting on network. **Confirmed for B:** cache inspection shows B exists before release and is physically removed afterward, although `listFeeds` still includes it.
2. B/new post never parsed or saved. **Rejected:** the before-release `feedView` includes it.
3. A date/dedup display filter hides it. **Rejected:** date-free, distinct URLs are used; cache content itself changes.
4. Only cross-feed pruning is faulty. **Rejected:** the second red loop shows an older response also replacing newer posts within one feed.

The response gates and before/after disk/view probes are inside the red script. **Cause:** `packages/core/src/feeds.ts:308` captures `all` before network; `:324` unconditionally replaces the cache entry; `:326` prunes against old `all`; `:327` commits without a generation guard. Reachable without a second Feed window: `apps/desktop/src/App.tsx:819` refreshes independently of Feed's local `singleFlight`; CLI Follow also refreshes its new subscription (`cmd-feed.ts:19–20`). **Reproduced:** 3/3 for each scenario.

### feeds-04 — A failed Mark read save contaminates later Undo and can leave the screen opposite to disk

**S2 · Mac.** Related failure-order family to F635/F636, newly reproduced in Feed's action. This is not F638's already-fixed mixed-selection case: the script uses one post.

Red commands:
```sh
ORE_NO_ENRICH=1 bun codex-out/feeds/actions.ts undo-failed
ORE_NO_ENRICH=1 bun codex-out/feeds/actions.ts rollback
```
```text
[DEEP] undo-failed {"shown":true,"disk":true,"writes":["unread","read"],"expected":false}
AssertionError: Undo must restore the state that actually saved before the action
true !== false

[DEEP] rollback {"shown":false,"disk":true,"writes":["unread","read"],"expected":true}
AssertionError: after the last successful Mark read, the screen must match disk
false !== true
```

Minimised steps: start with an unread post; issue Mark read while its write is held; issue Mark unread; fail the first write and let the second succeed; Undo. For the screen/disk variant, add a third Mark read before releasing the failed first write and omit Undo.

Expected: Undo restores the last saved unread state; after the final successful Mark read, the screen says read. Actual: Undo writes `read`, a state the preceding failed action never saved. In the three-action variant the saved log says read while the screen remains unread.

Ranked hypotheses and probes:
1. The action assumes its inverse is the opposite boolean, rather than the previous successfully saved value; older rollback has no owner check. **Confirmed:** the recorded successful writes are `unread, read`, and the earlier rollback overwrites the newest visible state.
2. Writes land out of order. **Rejected:** successful writes are serialized in the requested order; final disk is read.
3. The fake disk/history causes the symptom. **Rejected:** final harness uses the real `History`, `markFeedRead`, `markRead`, append-only log and `feedView`; only the first write failure is injected.
4. Undo is wrong even without a failure. **Rejected:** `ORE_NO_ENRICH=1 bun codex-out/feeds/actions.ts control` passes, with writes `read, unread, read` and screen=disk=true.

**Cause:** `apps/desktop/src/feed-actions.ts:15–19` uses a plain boolean `change`, retaining no committed predecessor or field ownership; `apps/desktop/src/change.ts:112` applies rollback without a newer-field check when no field is supplied. The screen calls this exact action at `Feed.tsx:166`. **Reproduced:** 3/3 per scenario with the real core log. No mounted React screen required.

### feeds-05 — Atom xml:base is ignored, so opening a post targets the wrong site/path

**S2 · Mac.**

Red command:
```sh
ORE_NO_ENRICH=1 bun codex-out/feeds/parser.ts base
```
```text
[DEEP] base {"actual":"https://feeds.example.test/rss/one","expected":"https://site.example.test/learn/one"}
AssertionError: Expected values to be strictly deep-equal
```

Minimised input: an Atom feed fetched from `https://feeds.example.test/rss/feed.xml`, root `xml:base="https://site.example.test/learn/"`, one entry with `href="one"`.

Expected: resolve the post against the declared base. Actual: resolve against the feed download address. The resulting `Post.url` is the address handed to `openPost`/`addSource`, so a learner opens a different page or gets an error, not just a misleading label.

Ranked hypotheses and probes:
1. URL resolution ignores the inherited base. **Confirmed:** with and without root `xml:base`, the same wrong URL comes out; an absolute href passes.
2. The XML parser drops the attribute. **Rejected:** DOM inspection returns the correct `xml:base` string.
3. Only nested bases are faulty. **Rejected:** removing the entry-level base leaves the minimal root-only case red; nested bases also failed in the initial case.

Probe: `ORE_NO_ENRICH=1 bun codex-out/feeds/probes.ts parser`. **Cause:** `packages/core/src/feeds.ts:111–114` closes over only the download URL; link, image and site callers never pass the element's inherited base. **Reproduced:** 3/3 final minimal runs.

### feeds-06 — Latin-1 XML becomes replacement characters and broken post addresses

**S2 · Mac.**

Red command:
```sh
ORE_NO_ENRICH=1 bun codex-out/feeds/parser.ts encoding
```
```text
[DEEP] encoding {"actual":"Caf�","expected":"Café","actualUrl":"https://example.test/caf%EF%BF%BD","expectedUrl":"https://example.test/caf%C3%A9"}
AssertionError: Expected values to be strictly equal
```

Minimised steps: stub an RSS response containing Latin-1 bytes, with both XML `encoding="ISO-8859-1"` and HTTP `charset=ISO-8859-1`; follow it and refresh. The post address contains `café`.

Expected: title and address decode correctly. Actual: title becomes `Caf�`, and the cached clickable URL contains UTF-8 replacement-character bytes instead of `é`. This changes the destination, not only its appearance. The raw byte fixture is `fixtures/encoding.xml`.

Ranked hypotheses and probes:
1. UTF-8 response decoding destroys bytes before XML parsing. **Confirmed:** the bad character is introduced by the fetch path; explicit `TextDecoder('ISO-8859-1')` followed by the same `parseFeed` returns Café.
2. XML parsing cannot preserve accented text. **Rejected:** UTF-8 responses and correctly decoded strings pass.
3. Only declaration/header disagreement is at fault. **Rejected:** agreeing header+declaration and header-only Latin-1 both fail.

Probe: `ORE_NO_ENRICH=1 bun codex-out/feeds/probes.ts parser`. **Cause:** `packages/core/src/feeds.ts:85` calls `Response.text()` without decoding from bytes according to the feed encoding. **Reproduced:** 3/3 with follow, refresh and view.

### feeds-07 — An explicitly non-link RSS GUID becomes a fabricated clickable post URL

**S2 · Mac.**

Red command:
```sh
ORE_NO_ENRICH=1 bun codex-out/feeds/parser.ts guid
```
```text
[DEEP] guid {"actual":true,"expected":false}
AssertionError: Expected values to be strictly deep-equal
true !== false
```

Here `actual` is whether Ore manufactured `https://feeds.example.test/rss/opaque-123`.

Minimised input: one RSS item with a title, no link, and `<guid isPermaLink="false">opaque-123</guid>`. Adding an audio enclosure does not change the result.

Expected: never use that opaque identifier as a post address. Actual: the identifier is resolved as a relative web link and shown as a post that cannot open the intended content. A legitimate fallback, if implemented, must use actual content/episode data; inventing a URL is wrong.

Ranked hypotheses and probes:
1. Attribute lookup uses the wrong capitalization. **Confirmed:** proper `isPermaLink` remains on the DOM but is ignored; changing only the attribute spelling to lowercase `ispermalink` makes Ore omit the invented URL.
2. Every GUID is used unconditionally. **Rejected:** lowercase false is respected.
3. The podcast enclosure triggers the fallback. **Rejected:** removing the enclosure leaves the exact failure, and the final fixture has none.

Probe: `ORE_NO_ENRICH=1 bun codex-out/feeds/probes.ts parser`. **Cause:** `packages/core/src/feeds.ts:128` looks up `ispermalink`, although XML attribute names are case-sensitive. **Reproduced:** 3/3 final minimal runs.

### feeds-08 — Plain-text Atom titles lose meaningful angle-bracket text

**S2 · Mac.**

Red command:
```sh
ORE_NO_ENRICH=1 bun codex-out/feeds/parser.ts text-title
```
```text
[DEEP] text-title {"actual":"Use in TypeScript","expected":"Use <T> in TypeScript"}
AssertionError: Expected values to be strictly deep-equal
```

Minimised input: one Atom entry whose title is `type="text"`, containing XML-escaped `Use &lt;T&gt; in TypeScript`.

Expected: show `Use <T> in TypeScript`. Actual: remove `<T>` entirely. A technical post's subject disappears from the list and copied title; this is information loss, not a styling preference.

Ranked hypotheses and probes:
1. HTML stripping runs on plain-text titles. **Confirmed:** the DOM has `Use <T> in TypeScript`; only the final title loses `<T>`.
2. XML entity decoding removed it. **Rejected:** DOM text is intact.
3. Only explicit `type="text"` is faulty. **Rejected:** omitting type (also plain text) produces the same loss; `type="html"` takes the same code path instead of a distinct interpretation.

Probe: `ORE_NO_ENRICH=1 bun codex-out/feeds/probes.ts parser`. **Cause:** `packages/core/src/feeds.ts:89` strips anything between angle brackets, called for every title at `:150` without examining Atom's type. **Reproduced:** 3/3.

### feeds-09 — Namespace-prefixed Atom is refused as a truncated feed

**S3 · Mac.**

Red command:
```sh
ORE_NO_ENRICH=1 bun codex-out/feeds/parser.ts prefix
```
```text
[DEEP] prefix {"actual":{"error":"feeds.example.test sent a feed that stops partway."},"expected":1}
AssertionError: Expected values to be strictly deep-equal
```

Minimised input: Atom elements use an `a:` prefix bound to `http://www.w3.org/2005/Atom`, including the closed root and one entry. Prefix choice does not change what those elements represent.

Expected: read the entry as for default-namespace Atom. Actual: direct parsing claims the feed stops partway; discovery's corresponding signature check also does not recognize the prefixed root.

Ranked hypotheses and probes:
1. Root recognition hardcodes tag spellings. **Confirmed:** removing only the prefixes and making the same namespace default gives one post.
2. The XML parser cannot read those names. **Rejected:** DOM probe has root `a:feed` and one `a:entry`.
3. The feed is cut off. **Rejected:** the fixture has its closing `</a:feed>`; the same content unprefixed passes.

Probe: `ORE_NO_ENRICH=1 bun codex-out/feeds/probes.ts parser`. **Cause:** `packages/core/src/feeds.ts:62`, `:96–98` recognize literal root names; `:103`, `:124–126` also compare literal qualified tag names. **Reproduced:** 3/3. This is a different input from F366's genuinely incomplete document, not a claim that its existing test regressed.

### feeds-10 — Future-dated entries evict today's posts from the last-two-weeks Feed

**S3 · Mac.** A malformed publisher clock can make otherwise valid current posts inaccessible through this feed until its dates are repaired or enough posts change.

Red command:
```sh
ORE_NO_ENRICH=1 bun codex-out/feeds/matrix.ts future
```
```text
[DEEP] future {"count":30,"todayPresent":false,"firstPublished":"2100-01-01T00:00:00.000Z"}
AssertionError: future-dated items must not evict today from the last-two-weeks Feed
```

Minimised steps: return 30 distinct entries dated 2100 plus one dated today; follow and refresh at the pinned 2026 clock.

Expected: the Feed's last-14-days contract (D107) includes today's entry; future dates must not consume its entire cache budget. Actual: all 30 slots contain future entries and today's post is dropped. The view admits those future dates too. Feed's date label treats them as Today (`apps/desktop/src/Feed.tsx:36–39`).

Ranked hypotheses and probes:
1. Future-first sorting and the pre-filter cap evict current entries. **Confirmed:** with zero or 29 future entries, today remains; with 30, today disappears.
2. Date parsing misreads 2100. **Rejected:** parsed dates are exactly `2100-01-01T00:00:00.000Z`.
3. Today's item is malformed or independently filtered. **Rejected:** it parses in every variant and is visible alone and with 29 future entries.

Probe: `ORE_NO_ENRICH=1 bun codex-out/feeds/probes.ts future`. **Cause:** `packages/core/src/feeds.ts:152` sorts all dates, `:314` slices to 30 before checking the window, and `:366` checks only a lower date bound. **Reproduced:** 3/3.

## Leads — not counted as findings

- JSON Feed: a stubbed `application/feed+json` response is rejected with the generic no-feed/email-service advice. Current parser contract explicitly lists XML formats; no assertion that JSON Feed is promised, so this is a support gap to decide, not a proven regression (`matrix.ts unsupported`).
- Inline-only Atom newsletters: valid-shaped entries with content but no alternate web link yield zero posts. No live Kill the Newsletter feed was fetched, so compatibility with the recommended service remains unverified; establish that service's actual entry shape before elevating (`matrix.ts unsupported`).
- Podcast feeds with only audio enclosures, no item link/GUID, yield zero posts; no end-to-end transcript/import claim was tested. General Feed podcast support is not explicit in D107 (`matrix.ts unsupported`).
- Equivalent feed URLs that both return 200 without redirects are compared literally in `followFeed`; a moving feed's redirect destination is not persisted during refresh. No red identity assertion: normalization could incorrectly merge feeds that differ intentionally.
- `Feed.tsx:102–105` installs asynchronous reads without the read guards used in other screens. A late read may replace optimistic marks, but no mounted/headless hook replay was built, so not counted.
- `PhoneApp.tsx:1158` reconstructs a removed waiting entry with `inbox --add` on Undo, even though inbox entries can represent files. No red loop through that phone callback was built; investigate whether removing a pending file then Undo loses its file identity. This is separate from feeds-01's shared payload deletion.

## What passed

`ORE_NO_ENRICH=1 bun codex-out/feeds/matrix.ts passes` exits 0; output is `logs/matrix-passes.txt`.

- RSS 0.91, 0.92 and 2.0 each retain a linked post.
- RSS 1.0/RDF with channel outside the item sequence retains its post and `dc:creator`.
- Two-digit RFC-822 years, numeric offsets, GMT and EST resolve to the same pinned instant.
- CDATA content supplies its image; ordinary XML entities preserve the author; relative root links resolve against the download address when no explicit base overrides it.
- `media:thumbnail` resolves its image address.
- UTF-8 BOM does not prevent feed discovery.
- HTML alternate discovery preserves an escaped query and uses the final redirected response URL.
- An HTML sign-in page served instead of a feed is refused.
- Re-following the exact URL keeps one subscription.
- Changing a GUID while keeping the post URL does not reset its read mark.
- Duplicate GUIDs with different post links retain both posts.
- Old dates expire; missing dates remain while listed, matching the explicit code contract.
- A 5,000-item synthetic feed parses all 5,000 and refresh stores/displays 30; the combined parse and refresh probe completed in tens of milliseconds on this run, well below the CPU limit.
- Unfollowing removes that feed's posts from the view.
- Queued link normalization, failed import retry, repeated-error suppression, another device's initial grace period and successful removal work with a stub importer.
- `matrix.ts kept` passes: adding a linked post by hand removes it from Feed; unfollowing preserves the saved source and its original URL (`logs/matrix-kept.txt`).
- `actions.ts control` passes: queued read → unread → Undo restores read when every preceding save succeeded (`logs/actions-control.txt`).
- A valid URL-only reorder preserves both subscriptions (`logs/probes-state.txt`).

All final red-run logs include the intended assertion and `[DEEP]` symptom, not setup/import failures. No full test suite was run. Artifacts remain available for the fixing thread; no fixes, commits, pushes, or app installation were attempted.
