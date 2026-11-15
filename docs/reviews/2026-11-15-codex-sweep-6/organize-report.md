# Organize — findings

Tested the supplied Mac release page in remote WebKit at 1280×800 and the separate phone build at 390×844 with touch, with screenshots at 2×. Covered title, author, typo, body, highlight-note, source-note and common-word searches; a Japanese body match; search filters; command-palette context; skill/collection creation, renaming, moving, reordering, archiving/deletion and undo; bulk filing and bulk archive; and back/forward navigation. **The actual seed contained 238 sources (213 active, 25 archived), 14 skills and no courses—not roughly 950 sources.** Consequently this does not establish behavior at 950 sources. Courses and course navigation were not exercised: none were seeded, and no external course was imported. No skill merge control was offered; nested skills are deliberately outside D174, so neither is reported as a bug. Collection operations were exercised instead. Did not exhaustively run every palette action, every filter combination, drag reorder, delayed phone Undo, injected write failures, or unrelated screens covered by earlier sweeps. The phone was tested against its own seed and its own changes, not as a sync test. No app/source files were edited and no servers were started or stopped. Repository HEAD inspected: `81b21051e1778ac229658e8f80ac842113f04d7e`.

## Findings

### 1. A filtered text search falsely says there are no matching sources

**S2 · Mac · New · Reproduced 2/2**

1. From a fresh Mac page, open **All sources → To read**.
2. Search for `durability usually wins`.
3. Open **Filter → Skill**, select **Piano**, then dismiss the filter menu with Esc.
4. Observe the empty result. Clear only the search text to see the four Piano sources.

**Expected:** All four unread Piano sources match this exact phrase in their bodies and should be available in the filtered results.

**Actual:** The screen says **“Nothing in To read matches ‘durability usually wins’.”** It offers Clear the search and no indication that results were cut off. All four sources are present without the query:

- Notes on scales and arpeggios
- The complete guide to scales and arpeggios (with examples, pitfalls, and a worked case study from a real project)
- Notes on reading bass clef (part 1)
- Notes on reading bass clef

Read-only inspection of their `doc.md` files confirmed the phrase in all four. Across To read, 91 source bodies contain it; the unfiltered UI showed only 14 source rows. This is already misleading at 238 total sources.

**Suspected cause:** `apps/desktop/src/App.tsx:1148` requests only 60 hits across the entire library, including annotation/exercise/note hits. `App.tsx:1151` collapses these to source IDs; `App.tsx:1170` intersects that limited set with the selected tab/filters. The query is not scoped to Piano before its limit, nor rerun with a larger/scoped limit when the filter changes.

**Evidence:**

- `codex-out/organize/filtered-body-search-empty.png`
- `codex-out/organize/filtered-body-search-repeat.png`
- `codex-out/organize/expected-body-matches.json` — 91 matching To read source bodies, including the four Piano sources.
- `codex-out/organize/body-match-rows.json` — 14 returned source rows before filtering.
- `codex-out/organize/navigation.cjs` — includes the second filter reproduction.

### 2. Opening a search result discards the location of the matching note

**S2 · Mac · New · Reproduced 2/2, with a working ⌘K comparison**

1. From a fresh Mac page, open **All sources → To read**.
2. Search for `Does this hold for kids`.
3. Click **What I learned about notification hygiene**. Its result snippet shows the matching question.
4. Inspect the reader and its side panel.

**Expected:** Open the highlight's note containing those words, at its passage. A learner searching for a remembered question should not have to find it again manually.

**Actual:** The reader opens at the top. The highlight popup is closed, no Find field opens, and the side panel shows the general Source note. The searched question is not visible. Both runs had zero open textareas. Searching the same phrase in **⌘K** and opening the same source's question result correctly opens the textarea containing **“Does this hold for kids?”** at its passage. The phone's global search also opens this question correctly.

**Suspected cause:** `apps/desktop/src/App.tsx:1151` retains only the snippet per source, losing the hit kind and reference. The row click at `App.tsx:2065` calls `openSource(r.id)` without a jump target; Enter at `App.tsx:2285` does the same. The palette separately constructs `ann:` / `note:` / `find:` targets in `apps/desktop/src/Palette.tsx:99`.

**Evidence:**

- `codex-out/organize/list-question-search.png`
- `codex-out/organize/list-question-open.png`
- `codex-out/organize/list-question-open-repeat.png`
- `codex-out/organize/palette-question-correct.png`
- `codex-out/organize/phone-question-match.png`
- `codex-out/organize/search-check.cjs`

### 3. Phone search cannot find sources by their author

**S2 · iPhone · New · Reproduced on 2 fresh pages**

1. From a fresh phone page, tap **Search**.
2. Enter `Ana Ruiz` and wait for results.
3. Replace the query with `Embeddings | Full lecture` and open that title.
4. Read the source's byline.

**Expected:** Searching a saved author should find her sources. This is a routine way to retrieve material whose title the learner cannot remember; Mac's **Search sources** already supports it.

**Actual:** Phone Search says **“No matches”** for `Ana Ruiz`. The title query finds the source immediately, and the source's byline says **Ana Ruiz**. Multiple other sources also carry that author. The phone provides no author filter in this Search sheet. Re-entering the query in the first journey also failed; the count above uses the two fresh-page checks.

**Suspected cause:** The phone uses `Palette`. `apps/desktop/src/Palette.tsx:214` scores sources using only `i.title`, whereas Mac list search uses `searchFields` with the author at `apps/desktop/src/App.tsx:1166`. The full-text table in `packages/core/src/db.ts:25` has title/body fields, with no author field to supply the missing matches.

**Evidence:**

- `codex-out/organize/phone-author-search.png`
- `codex-out/organize/phone-author-search-repeat.png`
- `codex-out/organize/phone-author-exists.png`
- `codex-out/organize/phone-author-repeat.cjs`

### 4. Back returns to the source list but loses the search

**S2 · Mac · New · Reproduced 2/2**

1. From a fresh Mac page, open **All sources → To read** and search `Embeddings`.
2. Open **Embeddings | Full lecture** from the two results.
3. Click **AI** in the sidebar to visit its skill page.
4. Click the app's **Back** button twice.

**Expected:** Return to the two Embeddings results, with the original query still in the field.

**Actual:** All sources returns with a blank search field and the full To read list (105 rows in the first run). A learner following a result into its skill loses the search they were working through. Three additional Forward/Back cycles stayed navigable but did not recover the query. The independent repeat began after a reload and lost it again.

**Suspected cause:** `apps/desktop/src/App.tsx:1004` records only source ID, skill, status and place in navigation history. `App.tsx:1141` clears the query when the skill changes; history never restores it. This finding is specifically about the query, not a claim that every scroll position or filter state was verified.

**Evidence:**

- `codex-out/organize/back-search-before.png`
- `codex-out/organize/back-lost-search.png`
- `codex-out/organize/back-lost-search-repeat.png`
- `codex-out/organize/navigation.cjs`
- `codex-out/organize/finish-mac.cjs`

## Known rows seen again

None confirmed as recurring. Japanese substring search worked in the new fixture, so F288 was not reproduced. The phone's immediate Archive → Undo restored its search result; this did not test F16's specifically late tap. Out-of-scope open rows were not re-reported.

## What passed

- Mac list search finds titles and authors; `Embeddngs` still finds the Embeddings sources.
- ⌘K puts exact title matches above body matches; common-word searches return results without a crash.
- Source-note searches such as `Big idea` return identified source-note matches; landing was not separately asserted for every note result.
- ⌘K and phone Search open a highlight-note match with the correct question popup.
- Searching `日本語` inside an unspaced Japanese paragraph finds the newly imported source and opens Find with that word.
- ⌘K's main actions follow the open source or skill; selecting ten list rows did not insert actions for those selected sources. Action inventories are in `palette-source.txt`, `palette-skill.txt`, and `palette-ten-selected.txt`.
- Mac skill creation, rename, and their stacked Undo restored the prior state.
- Filing both Embeddings sources into a skill worked; Undo removed both memberships and Redo restored both.
- Moving the test skill from Craft to Life and Undo placed it in the expected sidebar collections.
- Skill archive hid it from the sidebar; Undo restored it.
- Deleting the test skill and Undo restored the skill with both filed sources.
- Creating a collection and its first skill worked; collection Move up, rename, delete, and Undo worked. Deleting the collection kept its child skill.
- Archiving ten picked sources removed them; Undo restored the batch. Final disk inspection found all original source IDs and archive states preserved.
- Pinning an unpinned source marked it pinned; Undo removed the pin, including on disk.
- Phone skill creation and rename updated the skill page and drawer; rename's touch Undo and creation's keyboard Undo restored the prior state.
- Phone filing put Embeddings in Piano immediately; Undo removed it from Piano.
- Phone source Archive followed by immediate touch Undo restored its exact title in Search.
- Final Mac file audit: all 238 original source IDs remain, no duplicate IDs, all 14 original skills remain, and no source or exercise refers to a missing source/skill. Checked 239 final source files and 288 exercise files.

## Saved state and evidence limits

The extra source is the self-authored Japanese fixture, imported through the app's Open file flow and then archived through the app. The two temporary skills and their collection were removed through the app. Original source memberships, pin flags and archive flags match the starting inventory. Expected reading changes remain: Embeddings changed from inbox to reading, and opened-at timestamps were recorded for three visited sources. No original source was lost, duplicated or left under a deleted test skill. Skill ordering in YAML was normalized into sidebar collection order by the app's arrange operation; the original skill metadata is retained.

Read-only snapshots: `baseline.json`, `filed.json`, `restored.json`, `final-mac.json`; comparisons: `final-audit.json`, `reference-audit.json`. Inventory scripts only read the assigned library and write this tester's output folder. Phone checks verify rendered state in its own page; they do not claim to inspect the native iCloud files or sync with the Mac. The active Mac and phone journey contexts/pages were explicitly closed. Cleanup limitation: the first non-interactive setup runner (exec session 89128, inferred PID 22572 from the sole remaining WebKit client connection) remained idle after stdin closed. The sandbox denied both process enumeration via ps/pkill and a targeted TERM signal. Its original Home page/connection may remain; the sweep owner should close that leftover connection. The later interactive runner was stopped. No supplied server was stopped.
