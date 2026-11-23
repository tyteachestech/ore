# Ore PR #519 — edges

## 1. Coverage and limits

Tested the iPhone Add sheet at 390×844 with touch and the Mac Add box at 1280×800, using the supplied WebKit server and only the assigned libraries/ports. Covered all 31 small-input cases in the prompt, typing and Shift+Return, rich and hostile HTML, edits after paste, dismissal/reopening, duplicates, double Return, Undo/re-add, skill filing, adding from an archived skill, failed writes, an import already running, and 204,800-/2,097,152-byte pastes. Checked reader output, the phone’s Sources list, phone IndexedDB `doc.md`/originals, Mac library files, and Mac `ore show --json`. Five findings below reproduced at least twice. No application files were changed. Native iOS keyboard/Go, system Paste, autocorrect, IME composition, gestures, simulator behavior, and real iCloud download/sync were not testable here; the iCloud message was injected as an add-command failure, not a real sync test. Browser CORS failures are not reported as native import bugs. AI generation and visual taste were excluded.

## 2. Findings

### E1 — Reopening Add discards the rich paste, including its images

**S1 · iPhone · source content lost**

1. From a fresh phone page, tap **Add a source**.
2. Paste the rich fixture in `specials.cjs`: matching plain text and HTML containing a heading, list, table, code, math, and an image.
3. Dismiss Add with Escape before submitting. Open Add again; the plain text is restored and selected.
4. Submit without editing. Read the source and inspect its IndexedDB files.
5. Repeat the same sequence in the Mac Add box.

**Expected:** Restoring an unedited draft also restores its HTML, as on the Mac. The source retains its image and structured content.

**Actual:** The phone writes `source.md`, not `source.html`. `doc.md` contains only the plain clipboard text: the image reference is absent, the table is tab-separated lines, and list/code/math structure is gone. The reader shows a single paragraph. The Mac retains the HTML. A separate fixture with unique body text confirms the Mac keeps its `##` heading and Markdown table after dismissal, while the phone loses them. This is persisted content loss, not just rendering.

**Reproduced:** 2/2 image-bearing phone trials; another 2/2 heading/table trials. Mac controls preserve the rich content. The unique-body controls avoid deduplication against an earlier paste.

**Evidence:** [Phone with lost content](shots/edges-dismiss-rich-phone-1.png), [repeat](shots/edges-dismiss-rich-phone-2.png), [phone unique-body control](shots/edges-dismiss-unique-phone-1.png), [Mac control](shots/edges-dismiss-unique-mac-1.png). Saved files: `specials.json` and `last-checks.json`.

**Cause:** `apps/desktop/src/phone/AddLink.tsx:23` stores only the string in `leftLinks`; line 39 initializes `pasted` to `null` each time the sheet mounts. Line 101 persists the text only. The Mac’s `apps/desktop/src/Add.tsx:88` draft type retains `pasted`, and line 138 restores it. This happens before either storage backend runs.

### E2 — A paste containing only an HTML list loses the list

**S2 · iPhone and Mac · shared import defect**

1. From a fresh page, open Add.
2. Paste plain text `First recall 1\nThen explain 1\nFinally revisit 1`, with HTML `<ol><li>First recall 1</li><li>Then explain 1</li><li>Finally revisit 1</li></ol>`.
3. Submit and read the source. Repeat with `2` replacing `1`.

**Expected:** The ordered list remains three numbered steps, with its structure kept in the saved source.

**Actual:** Both platforms discard the HTML. `source.md` and `doc.md` contain three unmarked lines, which the reader merges into one paragraph. The numbers/list boundaries supplied by HTML are lost. Lists survive when the same paste also has a heading or table, making this inconsistent.

**Reproduced:** 2/2 on each platform.

**Evidence:** [Phone](shots/edges-list-only-phone-1.png), [Mac](shots/edges-list-only-mac-1.png), repeats `list-only-phone-2.png` and `list-only-mac-2.png`; exact inputs and saved files in `last-checks.json`.

**Cause:** `apps/desktop/src/paste.ts:63–65` recognizes only `img`, `table`, headings, `pre`, and `math` as reasons to retain HTML. `ul`/`ol`/`li` are excluded, so neither platform sends `--html`. This is shared application code, not a phone/mock difference.

### E3 — Re-adding after Undo restores the source without an Undo for that change

**S2 · iPhone · Mac parity regression**

1. From a fresh page, add `Edge undo-readd 1\nA complete learning sentence to keep.`
2. Tap **Undo** in its added toast. Verify the saved source now has `archived_at`.
3. Return to the top-level Add sheet and add the identical text again.
4. Inspect the new toast and saved source. Repeat with `2` in the title.

**Expected:** Say the source was brought back from Archived and provide Undo for that restoration, as the Mac does.

**Actual:** Core restores the original ID and removes `archived_at`, but the phone says only **Already here** and offers no Undo on that toast. The earlier Undo’s Redo is not an Undo for the restoration. The Mac says **“…” is back from Archived** and provides Undo.

**Reproduced:** 2/2 phone trials, with 2/2 passing Mac controls.

**Evidence:** [Phone](shots/edges-undo-readd-phone-1.png), [Mac](shots/edges-undo-readd-mac-1.png), repeat images ending `-2.png`; before/after file snapshots and toast contents in `specials.json`.

**Cause:** `apps/desktop/src/phone/PhoneApp.tsx:883–886` treats every `kept` result as a no-change notification. `packages/core/src/ingest/index.ts:590–601` actually returns `restored` and performs the restoration. The phone’s `AddedText` type at `AddLink.tsx:26` drops that information. Mac handling at `apps/desktop/src/App.tsx:480–496` records a reversible restore.

### E4 — Add silently waits behind a running inbox import

**S2 · iPhone · missing wait feedback**

1. From a fresh page, add a web link whose response is slow. The repeatable harness in `concurrency2.cjs` holds the response to `https://example.org/edges-delayed-article`.
2. While **Coming in / Reading** shows, open Add again and paste `Edges concurrent text\nThis text needs no network fetch.`
3. Press Return. Keep the first request pending for at least 1.2 seconds.
4. Release the request and observe that the text then saves and opens.

**Expected:** The sheet visibly says it is adding/waiting while submission is pending. A learner should know why Add and the field no longer respond.

**Actual:** The sheet stays open with a read-only field and disabled buttons still labelled **Add** and **Choose a file or photo**. It shows no adding/waiting message. The first import’s Reading indicator is behind the sheet. The text eventually saves intact after the held request completes.

**Reproduced:** 2/2 phone trials. The Mac comparison had `inbox --import` verified in flight and delayed Add’s response; its box and toast visibly said **Adding…**.

**Evidence:** [Phone wait](shots/edges-concurrent-phone-wait.png), [phone repeat](shots/edges-concurrent-phone-wait-2.png), [Mac wait](shots/edges-concurrent-mac-wait-2.png); `concurrency.json` and `concurrency2.json`.

**Cause:** The real phone serializes commands at `apps/desktop/src/phone/core.ts:154–159`, including inbox import and text add. `apps/desktop/src/phone/AddLink.tsx:100–115` disables controls while busy but renders no busy message. The phone has no `__ORE_SLOW` hook, so its test held a real fetch through Playwright routing; the Mac used the supplied delay hook. The finding is missing feedback, not a demand to remove command serialization.

### E5 — Invisible-only input creates a source with no readable name or content

**S3 · iPhone and Mac · shared validation edge**

1. From a fresh page, paste exactly U+200B, U+200D, U+2060 into Add.
2. Submit, then inspect the reader and the Sources list.
3. Repeat on a fresh page; the existing source can also be reopened or re-added.

**Expected:** Treat input containing no visible content as empty, or refuse it with a useful explanation.

**Actual:** Both platforms accept it. The title and body consist only of invisible characters. The success toast contains apparently empty quotation marks; Sources includes a blank-looking row that cannot be identified by its title. Ordinary spaces/newlines are correctly blocked.

**Reproduced:** Phone creation in the matrix and the separate specials run, plus duplicate/reopen coverage; Mac creation and multiple fresh-page re-adds. Saved title/body confirm the same issue on both.

**Evidence:** [Phone](shots/edges-invisible-phone.png), [Mac](shots/edges-invisible-mac.png), [phone Sources](shots/edges-phone-sources-list.png); `matrix.json`, `specials.json`, `duplicates.json`, and `phone-sources-list.txt`.

**Cause:** `apps/desktop/src/paste.ts:47–48` and `apps/desktop/src/phone/AddLink.tsx:49` use `trim()` for emptiness. Core repeats that check at `packages/core/src/ingest/index.ts:645,649` and derives the title from the invisible first line at lines 656–658. These format characters survive `trim()`.

## 3. Known rows seen again

No confirmed recurrence of a known findings row. F539’s original rejection of ordinary text did not recur. F518’s playlist guidance correctly says the Mac adds the playlist as a course. The listed out-of-scope open findings were not re-reported. E2 and E5 also affect the Mac and are not specific to PR #519.

## 4. What passed

- Bare HTTPS links, bare domains, and `www` domains take the link path on both platforms; the phone queues them in its inbox.
- A URL with a space, a link in a sentence, two links on one line, mixed links/words, and a URL followed by prose each save as one complete text source on both platforms.
- Links on separate lines with blank lines between queue as separate links; a trailing period is passed through as part of the link on both platforms.
- `README.md` and `main.py` save as text; absolute paths, `file://` paths, and `~/notes.md` save as text only on the phone, as D349 requires. The Mac attempts the paths and reports missing files.
- Playlist, X-post, and Podcasts-show links take the link path and do not create half-read text sources; the playlist’s phone guidance names the Mac. Live network/import success was not established for these test URLs.
- Single words, emoji, leading/trailing blank lines, CRLF, tabs, Hebrew/Arabic, CJK, combining accents, and mixed visible/invisible text preserve their stored words/characters in order. Boundary whitespace is trimmed and CRLF becomes LF.
- Whitespace-only submission is blocked on both platforms, with no saved source (the original Mac button-selector harness miss was corrected with two Enter-based trials).
- Frontmatter-shaped Markdown is parsed consistently: its title becomes metadata, its body is retained, and the original source retains the YAML. Heading-only Markdown is saved intact and its heading becomes the title.
- All 22 phone text matrix cases were re-added twice in a continuous journey; 19 applicable Mac text cases were also re-added. Existing IDs are reused and duplicate messages appear. Mac file-path cases were intentionally excluded from this text-duplicate pass.
- New plain and rich text open in the reader. Phone Sources lists the matrix’s saved sources afterward.
- Direct rich HTML retains list/table/code/math structure, its HTML original, and an image asset reference on both platforms. The separate `image-storage.json` check verifies the phone’s stored image bytes against the seed image.
- Editing after a rich paste drops stale HTML and saves the edited field, including the new final sentence, on both platforms (two trials each).
- Script, image `onerror`, `javascript:` link, and iframe payloads did not execute; the saved readable body contains no active script/iframe/javascript destination (two trials each).
- Typing plus Shift+Return keeps a newline, and Return submits on both platforms.
- Double Return creates one source on both platforms (two trials each).
- Initial Undo archives the new source on both platforms; re-add reuses and restores its ID (phone notification defect is E3).
- Adding from Learning files the source under `learning`; adding from Learning while it is archived restores the skill and files/opens the new source on both platforms.
- Injected add failure keeps the draft, shows the reason, and creates no source; clearing the failure and retrying succeeds. The iCloud-wait error likewise preserves the draft and creates no source (two message-path trials each, not real iCloud sync).
- Text submitted during a running inbox import eventually saves intact on both platforms; phone wait feedback is E4.
- Both large pastes save byte-exact bodies and retain their final marker. Details below.

| Payload | Platform | Paste operation | Submission to inspection* | Largest 50 ms timer gap |
| --- | --- | ---: | ---: | ---: |
| 204,800 bytes | iPhone | 441 ms | 1,663 ms | 443 ms |
| 204,800 bytes | Mac | 382 ms | 1,636 ms | 360 ms |
| 2,097,152 bytes | iPhone | 129 ms | 2,091 ms | 422 ms |
| 2,097,152 bytes | Mac | 122 ms | 1,784 ms | 144 ms |

*Includes an intentional 1,500 ms settling delay, so this is not pure save latency. The 200 KB pass used Playwright `fill` after dispatching paste. Its 2 MB `fill` attempt exceeded the harness’s six-second action timeout on both platforms; the successful 2 MB pass used a paste event followed by the native textarea value setter and input event, as requested, avoiding that injection bottleneck. Thus the paste-operation numbers are not directly comparable. The timer detected brief pauses, not a sustained freeze. System-wide free memory was 45–50% across the recorded large-input checks; process-specific WebKit memory was unavailable (`performance.memory` absent; process listing denied), so no per-page memory claim is made. Evidence: `large-initial.json`, `large.json`, saved-body JSON files, and `mac-2mb-show.json`.

### Evidence and harness notes

All paths above are inside `codex-out/edges/`. Exact inputs, UI text, and saved frontmatter/body are in `matrix.json`, `specials.json`, `last-checks.json`, and the named journey files. `helpers.cjs` connects to the existing server; scripts close their pages/contexts and do not launch a browser or server. Early setup races/selector misses were corrected rather than reported as product defects. One specials run stopped on a Mac Home-load timeout; it was not reproduced or reported, and subsequent focused runs covered the finding candidates independently.

The phone browser’s `/library-file` handler reads the seed directory on disk, while newly added image assets live in IndexedDB. Its broken-image placeholder for a newly imported asset is therefore excluded: the stored image itself was checked separately. A real device’s asset loading, the actual system clipboard, and iCloud interruption/recovery still need a native test.
