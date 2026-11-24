# Library deep scan — 24 November 2026

Tested master `c6cc046aabb010328855bf64c667df1a535828cd`, Bun 1.4.4, on the Mac. Covered core/CLI links, Markdown editor parse/edit/save, diagram ownership and collisions, course membership, feeds, archive/restore, cut Undo, YAML, CLI JSON, initialization, file-add edges, and F575 timings. Read the four earlier deep-scan reports and findings/sweeps; skipped their established cases except the requested F575 investigation and an explicitly reproduced F143 recurrence. This is a findings-only run: all artifacts and scratch libraries are in `codex-out/library/`; no tracked source was changed, no AI ran, and no app/server/browser was started. The editor uses the real Milkdown setup headlessly, followed by the real core note writer where stated. “Both” means the shared code is used by Mac and iPhone (`apps/desktop/src/phone/core.ts` runs the same command code); these are Mac/core reproductions, not claims of native iPhone observation. Not covered: live iCloud, native app interaction, heading/highlight navigation, every successful mutating CLI command, or full course progress/reimport UI journeys.

## Findings

11 findings: 6 S1, 2 S2, 3 S3. Severity follows the requested rubric; two S1 cases lose only handwritten metadata. The reference-link omission and code-example false positives are grouped as one Markdown-link parser defect. The 36 confirmation invocations are recorded in [confirmation.json](confirmation.json); each exits 1 on its asserted symptom. Run commands from the repository root. Every script resets only its own scratch library. Generated IDs vary; the asserted outcomes do not. Full stdout/stderr is retained under [logs](logs/).

### LIB-01 — Closing a Feed preview deletes a note that has already saved

**S1 · Mac; shared core race.** Reproduced in **3/3 independent confirmation runs**.

**Red command:**

```sh
ORE_NO_ENRICH=1 bun /Users/tylerpoelking/Developer/ore-wt/deep3/codex-out/library/feed-close-loop.ts overlap
```

Output (diagnostic/assertion excerpt; full log `logs/feed-close-loop-overlap-1.log`):

```text
[DEEP] after-save-before-close {"exists":true,"preview":null,"text":"My saved thought."}
[DEEP] overlap {"save":{"item":"01M878HGW5VE5TJBCJJ3F8RV8E","text":"My saved thought.","path":"items/2026/a-preview-01M878HGW5VE5TJBCJJ3F8RV8E/notes.md","dir":"/Users/tylerpoelking/Developer/ore-wt/deep3/codex-out/library/libs/feed-close-overlap/items/2026/a-preview-01M878HGW5VE5TJBCJJ3F8RV8E","merged":false,"kept_from_feed":true},"close":{"result":"dropped"},"sourceExists":false}
AssertionError: Closing a preview deletes the source after its note save succeeded
```

**Minimised steps:** Create one untouched Feed preview. Hold the library lock; start `commands.notes.run` to save a first note, then `commands.feed.run` to close it. Release the lock and await both. The save finishes first, with the note on disk and `preview` removed. Close then removes the entire source directory. The script uses the real CLI command handlers and lock; it does not fake either result.

**Expected / actual:** A successfully saved note promotes the preview and survives closing. Actual: save reports `kept_from_feed: true`, but close reports `dropped` and the source and note are gone. **F143 recurrence at the core boundary**, with a success-then-delete outcome. The prior single-window UI wait is not claimed to have regressed; another overlapping command can bypass that UI ordering.

**Ranked hypotheses and probes:** (1) Close tests the preview before acquiring the lock and deletes from that stale decision. (2) The note save returned before writing bytes. (3) Preview promotion happens too late. The `after-save-before-close` probe reads the saved note and `preview: null` from disk, eliminating 2 and 3. `feed-close-loop.ts serial` preserves the source. The held-lock sequence forces the precise interleaving for 1.

**Cause:** `packages/core/src/feeds.ts:385–391`: `findItem`, the preview test and `hasHisWork` run before the locked deletion. No reread occurs inside the deletion lock. Related `clearPreviews` code was not exercised and is not a separate finding.

### LIB-02 — Adjacent toggles disappear when the note is edited and saved

**S1 · Both, shared editor and core note save.** Reproduced in **3/3 independent confirmation runs**.

**Red command:**

```sh
ORE_NO_ENRICH=1 bun /Users/tylerpoelking/Developer/ore-wt/deep3/codex-out/library/editor-open.ts adjacent
```

Output (diagnostic/assertion excerpt; full log `logs/editor-open-adjacent-1.log`):

```text
[DEEP] {"mode":"adjacent","base":"","saved":"New writing.\n","onDisk":"New writing.\n"}
[DEEP] {"mode":"adjacent","input":"<details><summary>A</summary>\n\na\n\n</details>\n<details><summary>B</summary>\n\nb\n\n</details>\n","error":"AssertionError [ERR_ASSERTION]: Typing in the blank editor erased the original toggles"}
AssertionError: Editing a note must not delete its original toggles
```

**Minimised steps:** Save two valid `<details><summary>…</summary>` blocks, each with body text, with one newline (no blank line) between `</details>` and the next `<details>`. Open using `createEditor`. Insert `New writing.` and save through `keepUnedited` and `setNotes`. The script reads the final `notes.md` back from disk.

**Expected / actual:** Both toggle titles and bodies survive the new text. Actual: Milkdown logs `Cannot create node for toggle`, but creation resolves with an empty document. The next save replaces both toggles with just the new text. With a surviving paragraph after the toggles, editing that paragraph also drops the toggles (`editor-loop.ts adjacentToggles`). Violates D38 and loses the learner's writing.

**Ranked hypotheses and probes:** (1) Adjacent HTML tags are grouped into an invalid toggle node. (2) Any toggle fails in the headless setup. (3) The core save truncates a valid serialization. `editor-open.ts single` and `blank` pass, eliminating 2. `base` and `saved` are already empty/truncated before core writes, eliminating 3. The parser error contains the combined closing/opening HTML node; adding one blank line fixes parsing. A raw block HTML child inside a toggle also hits this schema boundary, not counted separately.

**Cause:** `apps/desktop/src/editor/blocks.ts:37–64` only recognises standalone opening/closing HTML nodes; the combined `</details>
<details>…` is retained as HTML within a toggle. `blocks.ts:88,100–102` requires block children and rejects it. `preserve.ts:75` then trusts edited output when original/base block counts differ. The production save path is `editor/NoteEditor.tsx:287–303`.

### LIB-03 — A pending cut overwrites a completed source rename

**S1 · Both, shared core; overlapping writers exercised on Mac.** Reproduced in **3/3 independent confirmation runs**.

**Red command:**

```sh
ORE_NO_ENRICH=1 bun /Users/tylerpoelking/Developer/ore-wt/deep3/codex-out/library/cut-loop.ts parallel
```

Output (diagnostic/assertion excerpt; full log `logs/cut-loop-parallel-1.log`):

```text
[DEEP] parallel {"title":"Source","body":"# Source\n\nAlpha paragraph.\n\nGamma paragraph that is long enough to remain beyond the old cut position.\n"}
AssertionError: Cut overwrites a completed concurrent rename
```

**Minimised steps:** Add a source with three paragraphs. Hold the library lock. Start `renameItem` to `New title`, then start `cutText` for the middle paragraph. Release the lock; await both operations.

**Expected / actual:** The paragraph is removed and the completed rename remains. Actual: the cut writes the old title `Source` back to `doc.md`. This is a lost metadata update, not an index display lag.

**Ranked hypotheses and probes:** (1) Cut captures the item before waiting for the lock. (2) Both writes enter the lock simultaneously. (3) Rename never reaches disk. `cut-probes.ts` reads `New title` between the rename and cut writes, eliminating 3. Serial rename-then-cut preserves it. Holding the actual lock puts the rename on disk before the waiting cut executes; source inspection shows a single locked cut write but a pre-lock snapshot, supporting 1 rather than lock exclusion failure. The body is cut at the intended position, so span selection is not the cause.

**Cause:** `packages/core/src/cut.ts:109–118` reads and passes the old `Item`; `apply` captures `item.body` at line 124 and writes `item.meta` at line 137 after acquiring the lock at 126. Unlike `appendText`, it does not reread the item under the lock.

### LIB-04 — Undo after another cut inserts text into the middle of a different paragraph

**S1 · Both, shared core.** Reproduced in **3/3 independent confirmation runs**.

**Red command:**

```sh
ORE_NO_ENRICH=1 bun /Users/tylerpoelking/Developer/ore-wt/deep3/codex-out/library/cut-loop.ts shifted
```

Output (diagnostic/assertion excerpt; full log `logs/cut-loop-shifted-1.log`):

```text
[DEEP] shifted {"refused":false,"actual":"# Source\n\nGamma paragraph thBeta paragraph.\n\nat is long enough to remain beyond the old cut position.\n"}
AssertionError: Undo after another cut inserts restored text into the wrong paragraph
```

**Minimised steps:** Start with paragraphs Alpha, Beta and a longer Gamma. Cut Beta, retaining its Undo token. Cut Alpha. Restore Beta using its original token (for example, Undo in the first window after another writer changed the source).

**Expected / actual:** Restore Beta at its surviving context, or refuse because the source changed. Actual: restoring succeeds and splits Gamma into `Gamma paragraph thBeta paragraph.

at is long enough…`. This corrupts source prose without any concurrency or clock dependence.

**Ranked hypotheses and probes:** (1) Undo trusts an obsolete absolute offset. (2) The stored cut text is damaged. (3) One of the original cuts selects the wrong paragraph. `cut-shift-probes.ts` logs the unchanged cut record (`at: 28`, `text: "Beta paragraph.\n\n"`), eliminating 2. Plain cut/undo and reverse-order Undo of both cuts reproduce the original exactly, eliminating 3. Removing text before the saved offset corrupts; removing later text can trigger the existing short-length refusal. These distinguish the fixed-offset check from contextual validation.

**Cause:** `packages/core/src/cut.ts:232–237`: `restoreCut` rejects only an out-of-range offset or already-present text, then inserts at the original numeric offset. No base-body/context check detects an earlier edit. This is distinct from LIB-03's stale concurrent write.

### LIB-05 — Renaming a source removes handwritten frontmatter fields

**S1 · Both, shared core; custom metadata loss.** Reproduced in **3/3 independent confirmation runs**.

**Red command:**

```sh
ORE_NO_ENRICH=1 bun /Users/tylerpoelking/Developer/ore-wt/deep3/codex-out/library/yaml-loop.ts source
```

Output (diagnostic/assertion excerpt; full log `logs/yaml-loop-source-1.log`):

```text
[DEEP] source {"beforeCustom":"0012","afterCustom":null,"title":"Changed title"}
AssertionError: Renaming a source deletes handwritten frontmatter
```

**Minimised steps:** Add a source. Add `custom: "0012"` to its `doc.md` frontmatter. Rename it through core. Read the raw frontmatter again.

**Expected / actual:** The title changes while unrelated hand-written data remains. Actual: `custom` disappears. The example also carries a provenance comment, but the finding is based on lost field data, not comment formatting. This violates the scan's explicit frontmatter round-trip contract; it is not F564's multiline-scalar conversion.

**Ranked hypotheses and probes:** (1) The typed item schema drops unknown fields. (2) YAML parses `0012` incorrectly. (3) The serializer drops the key. `yaml-probes.ts` preserves the string and custom key through direct `parseFrontmatter` → `stringifyFrontmatter` → parse. `findItem(...).meta` already lacks it, identifying 1. The 1,000-case raw frontmatter round-trip test passes, further separating this from 2/3.

**Cause:** `packages/core/src/items.ts:214–218` projects the parsed mapping through `ItemMetaSchema`. `updateItemMeta` at lines 300–304 writes that projection back after another schema parse, with no unknown-key merge.

### LIB-06 — Undo of deleting a skill drops its custom YAML data

**S1 · Both, shared core; custom metadata loss.** Reproduced in **3/3 independent confirmation runs**.

**Red command:**

```sh
ORE_NO_ENRICH=1 bun /Users/tylerpoelking/Developer/ore-wt/deep3/codex-out/library/yaml-loop.ts restore
```

Output (diagnostic/assertion excerpt; full log `logs/yaml-loop-restore-1.log`):

```text
[DEEP] restore {"after":"# My organization\ncustom: keep-root\nskills:\n  # Skill explanation\n  [ { id: one, name: One, priority: P2 } ]\n"}
AssertionError: Undo of deleting a skill loses its custom YAML fields
```

**Minimised steps:** Give a skill a custom YAML key and an inline name comment. Delete it with `removeSkill`; restore exactly the returned `removed` payload with `restoreSkill`.

**Expected / actual:** Undo restores the skill's data. Actual: its `custom: keep-skill` and `# my label` comment disappear. Root-level `custom: keep-root` survives. The skill's ordinary name, priority and note do return; the finding is narrowly about the extra data/comment.

**Ranked hypotheses and probes:** (1) Delete returns a lossy Undo payload. (2) Every settings write discards custom keys. (3) Restore reads the wrong skill. `yaml-probes.ts` shows the returned payload already contains only typed skill fields. `yaml-loop.ts settings` and `rename` preserve custom values/comments, eliminating 2. The same skill ID and ordinary fields return, eliminating 3. The isolated payload and YAML-node reconstruction support 1.

**Cause:** `packages/core/src/skills.ts:516–517` builds the Undo payload from `parseSkillsFile(...).file.skills[i]`, not the original YAML node. `RemovedSkillSchema` at 499–505 has the typed `SkillSchema`; restore at 544 and 550 revalidates and creates a new node, losing unknown fields and node comments.

### LIB-07 — Linked from treats code as links and misses reference-style links

**S2 · Both, shared links code.** Reproduced in **3/3 independent confirmation runs**.

**Red command:**

```sh
ORE_NO_ENRICH=1 bun /Users/tylerpoelking/Developer/ore-wt/deep3/codex-out/library/links-loop.ts inline
```

Output (diagnostic/assertion excerpt; full log `logs/links-loop-inline-1.log`):

```text
[DEEP] inline {"backlinks":[{"from":{"kind":"item","id":"01M878HJB1FRTJSMX4A1K1VXVP","title":"Linking note"},"heading":null,"line":"Example: `Target`"}],"broken":[],"targetOpens":true}
AssertionError: Code example is falsely reported as a backlink
```

**Minimised steps:** Create a target and a second source note. First put `[Target](ore:item/<id>)` inside backticks in the note. Then separately use a normal Markdown reference link: `See [Target][t].`, blank line, `[t]: ore:item/<id>`.

**Expected / actual:** Only rendered links should produce Linked from entries (D39). Inline code has no link but produces a backlink. The reference link renders as a link but produces none. Indented code and backslash-escaped link text also produce false backlinks; fenced code is correctly ignored.

**Ranked hypotheses and probes:** (1) The regex does not model Markdown link context. (2) A stale index supplies the wrong rows. (3) The target is missing or ambiguous. `links-syntax-probes.ts` compares the remark syntax tree with `parseLinks` and `backlinks`: `inlineCode`/`code`/escaped plain text yield a backlink; `linkReference` with a definition yields none. The calls read current note files without the index, eliminating 2. `targetOpens: true` and the passing ordinary-link control eliminate 3.

**Cause:** `packages/core/src/links.ts:15–20` scans raw text with an inline-link regex. `proseLines` at 25–38 only removes fenced code. The backlink loop at 81–85 parses one line at a time and never resolves reference definitions.

Second red command (also 3/3):

```sh
ORE_NO_ENRICH=1 bun /Users/tylerpoelking/Developer/ore-wt/deep3/codex-out/library/links-loop.ts reference
```

```text
[DEEP] reference {"backlinks":[],"broken":[],"targetOpens":true}
AssertionError: Rendered reference-style Ore link has no backlink
```

### LIB-08 — Feed offers a post already saved under an equivalent URL

**S2 · Mac Feed; shared core result.** Reproduced in **3/3 independent confirmation runs**.

**Red command:**

```sh
ORE_NO_ENRICH=1 bun /Users/tylerpoelking/Developer/ore-wt/deep3/codex-out/library/feeds-loop.ts canonical
```

Output (diagnostic/assertion excerpt; full log `logs/feeds-loop-canonical-1.log`):

```text
[DEEP] canonical {"manual":"01M878HJ3SFHT9A389Y2SM147X","opened":"01M878HJ3SFHT9A389Y2SM147X","feedRows":1,"sourceCount":1}
AssertionError: Feed still offers a post already saved by its equivalent URL
```

**Minimised steps:** Follow a feed whose post URL is `https://example.test/post.md`. Add the same post manually as `http://www.example.test/post.md`. Read `feedView`, then open its post. The fixture uses a fixed RSS body/date and local fetch responses; no live network or AI is involved.

**Expected / actual:** A kept source is removed from Feed (D107). Actual: one Feed row remains even though `openPost` returns the exact same saved source ID and there is only one source. Import deduplication is working; this is a false Feed state, not F63 returning.

**Ranked hypotheses and probes:** (1) Feed uses raw URLs while ingest uses equivalent URL identity. (2) Manual import saved a separate source. (3) Feed cache is stale. The same returned ID and source count of one eliminate 2. `feeds-loop.ts exact`, using the exact post URL against the same freshly built cache, hides the row immediately and passes follow/unfollow/restore checks. The raw stored URL comparison directly accounts for the difference, rather than a cache freshness issue.

**Cause:** `packages/core/src/feeds.ts:357` builds `kept` from raw `meta.url` strings; line 364 tests raw post URL membership. This differs from the ingest deduplication used by `openPost` at 375.

### LIB-09 — A source folder rename makes valid links look broken

**S3 · Mac library doctor; shared core checker.** Reproduced in **3/3 independent confirmation runs**.

**Red command:**

```sh
ORE_NO_ENRICH=1 bun /Users/tylerpoelking/Developer/ore-wt/deep3/codex-out/library/links-loop.ts rename
```

Output (diagnostic/assertion excerpt; full log `logs/links-loop-rename-1.log`):

```text
[DEEP] rename {"backlinks":[{"from":{"kind":"item","id":"01M878HJP6JF9YFTZDSB0PC461","title":"Linking note"},"heading":null,"line":"Target"}],"broken":[{"path":"/Users/tylerpoelking/Developer/ore-wt/deep3/codex-out/library/libs/links-rename/items/2026/linking-note-01M878HJP6JF9YFTZDSB0PC461/notes.md","text":"Target","target":{"kind":"item","id":"01M878HJP4XPYK79APR3ANCX1Y"}}],"targetOpens":true}
AssertionError: Existing source renamed in Finder is falsely reported broken
```

**Minimised steps:** Link from a note to another source by ID. Rename the target's directory in the scratch library to `Renamed in Finder`, retaining `doc.md` and its ID. Call `findItem`, `backlinks` and `brokenLinks`.

**Expected / actual:** The link continues to name the same source. Actual: the source opens by ID and has a backlink, yet the link is reported broken. This is the broken-link checker left behind after F561's folder/index work, not a recurrence of F561's scheduling/index failure.

**Ranked hypotheses and probes:** (1) Broken-link detection obtains IDs from folder names. (2) A stale index remembers the old path. (3) Rename changed the source identity. `links-probes.ts` shows the same valid source ID, search hits and backlink before/after rename. Deleting/rebuilding `.index` does not change the false report, eliminating 2. Restoring an ID suffix alone clears it, isolating 1 and eliminating 3.

**Cause:** `packages/core/src/links.ts:93` uses `itemDirs(...).map(d => d.slice(-26))`, instead of reading canonical IDs from source metadata. The live item resolver already supports this folder rename.

### LIB-10 — Editing one list line rewrites untouched lines

**S3 · Both, shared editor; byte-preservation failure.** Reproduced in **3/3 independent confirmation runs**.

**Red command:**

```sh
ORE_NO_ENRICH=1 bun /Users/tylerpoelking/Developer/ore-wt/deep3/codex-out/library/editor-loop.ts list
```

Output (diagnostic/assertion excerpt; full log `logs/editor-loop-list-1.log`):

```text
[DEEP] {"name":"list","pass":false,"pass2":false,"expected":"* Keep this.  \n* NEW EDIT here.\n    + Nested old.\n","actual":"- Keep this.\n- NEW EDIT here.\n  - Nested old.\n"}
AssertionError: A small note edit rewrites untouched content
```

**Minimised steps:** Open `* Keep this.  \n* EDIT here.\n    + Nested old.\n`. Insert `NEW ` in the second item. Serialize through the real editor and `keepUnedited`; repeat a small edit and save a second time.

**Expected / actual:** Under D38 and this scan's explicit line-level contract, the first and nested list lines remain byte-identical. Actual: both markers/indentation change and the first line loses its trailing spaces. Both save comparisons fail. No lost words are claimed in this case. The cost is unwanted edits to canonical note text and noisy external-edit/history diffs, not visual taste.

**Ranked hypotheses and probes:** (1) Preservation matches whole top-level blocks, so any list edit replaces the whole list. (2) Core writes normalize whitespace. (3) A second save alone causes drift. The mismatch exists in `keepUnedited` output before core persistence, eliminating 2, and appears on the first save, eliminating 3. The matrix's untouched-list-next-to-edited-paragraph controls pass, while list/callout/table interior edits rewrite their enclosing blocks, supporting 1. Separate CRLF/gap/end-newline variants show related boundary normalization and are not counted as extra findings.

**Cause and contract caveat:** `apps/desktop/src/editor/preserve.ts:19–33,76,96` uses top-level Markdown blocks as the preservation unit; changed blocks come from the editor serializer. `SPEC.md` describes top-level block preservation, which is weaker than D38's “lines he did not edit” wording and the explicit requirement for this run. This is reported against the requested stricter contract, with formatting-only impact clearly separated from LIB-02's text loss.

### LIB-11 — Two initializers race on the same fresh library

**S3 · Mac CLI.** Reproduced in **36/36 process pairs**, across three independent 12-pair runs. One process fails while the other completes; no library corruption was observed.

**Red command (unmodified production CLI):**

```sh
ORE_NO_ENRICH=1 bun /Users/tylerpoelking/Developer/ore-wt/deep3/codex-out/library/init-race.ts
```

Output excerpt from `logs/init-race-1.log` (full errors, including paths, are saved there and in `init-race-1.json`):

```text
[DEEP] init-race {"pairs":12,"failedPairs":12,...}
EEXIST: file already exists, symlink 'AGENTS.md' -> '.../CLAUDE.md'
git init failed: fatal: cannot copy '.../templates/info/exclude' to '.../.git/info/exclude': File exists
AssertionError: Concurrent init fails
```

**Minimised steps:** Start two `bun packages/cli/src/ore.ts init <same-fresh-scratch-path> --json` processes together. Wait for both. Each attempt terminates; no workers remain.

**Expected / actual:** Idempotent initialization should tolerate the other process having just created a file. Actual: one exits nonzero with a JSON error for a symlink or Git template collision. This can break two independent setup callers; it does not require a huge folder or AI.

**Ranked hypotheses and probes:** (1) Check-then-create steps are not protected against another initializer. (2) CLI post-command snapshots cause the collision. (3) The sandbox or path cannot support initialization. `init-probes.ts` passes sequential init on one root and simultaneous init on separate roots, eliminating 3. A copied `init.ts`, with only adjusted imports and a barrier after the missing-symlink check, produces EEXIST in **3/3** pairs without any CLI snapshot, eliminating 2 and making the specific schedule deterministic. Both processes really observe the missing path before either proceeds. See `init-instrumented.ts` and `logs/init-barrier-1.log` through `-3.log`.

Deterministic probe command:

```sh
ORE_NO_ENRICH=1 bun /Users/tylerpoelking/Developer/ore-wt/deep3/codex-out/library/init-barrier.ts
```

```text
[DEEP] init-barrier [{"side":"a","stdout":"[DEEP] init failed Error: EEXIST: file already exists, symlink 'AGENTS.md' -> '/Users/tylerpoelking/Developer/ore-wt/deep3/codex-out/library/libs/init-barrier/CLAUDE.md'\n","stderr":"","exit":1},{"side":"b","stdout":"[DEEP] init succeeded\n","stderr":"","exit":0}]
```

**Cause:** `packages/core/src/init.ts:32–39`: the symlink and `.git` checks are separate from their creation, with no initializer lock or collision handling. The copied probe changes scheduling only; the 36 production CLI pairs establish that the same defect occurs without instrumentation.

## Leads and limits

- **F575 remains open:** none of four selected-test runs timed out. The original loaded-Mac failure is not explained by a new red loop here; cold PDF/native work remains a lead, detailed below.
- **Heading/highlight links:** not classified as broken; the current link target type is source/skill, and their UI navigation semantics were not tested in this core run.
- **Other preview cleanup and cut Undo concurrency:** nearby code shares pre-lock checks, but no additional red case was built; do not count those as independent findings.

### F575 timing evidence

Run `ORE_NO_ENRICH=1 bun codex-out/library/f575.ts` from the repo root. It invokes the requested `bun test packages/core/test/reimport.test.ts -t F181` once unloaded and three times with one bounded CPU worker. Scratch and temporary files stay inside this folder; local transcription is stubbed as in the test, and the existing Mac OCR helper is used. No generative AI is invoked. The worker has a 90-second hard stop and was explicitly terminated when the tests ended, after only a few seconds of load. Full outputs: `logs/f575-0.log` through `-3.log`; structured measurements: `f575-results.json`.

| Run | CPU worker | First F181 test | Recording reread | Recording refusal | Word reread | Whole command |
|---|---|---:|---:|---:|---:|---:|
| 0 | No | 1199.34 ms | 245.30 ms | 459.68 ms | 41.99 ms | 2011 ms |
| 1 | Yes | 750.63 ms | 245.47 ms | 452.60 ms | 31.96 ms | 1539 ms |
| 2 | Yes | 533.95 ms | 213.31 ms | 465.55 ms | 32.04 ms | 1300 ms |
| 3 | Yes | 547.92 ms | 261.27 ms | 428.61 ms | 32.70 ms | 1326 ms |

The independent step probe, `ORE_NO_ENRICH=1 bun codex-out/library/f181-steps.ts`, measures each input addition in the first test. In its first pass, PDF addition took **758 ms**, audio **125 ms**, Word **125 ms**, screenshot OCR **77 ms**, Markdown **2 ms**. PDF fell to **19/17 ms** on warm passes; the large cold/warm difference isolates initialization/import work as the dominant observed step, not an observed race. The first test's image branch catches “Found no text…” here, as the original test permits.

Native-boundary wrappers measured OCR at **77/72/72 ms**, exit 0; QuickLook at **11/11/13 ms**, **exit 255**. Consequently, the successful QuickLook path was not exercised. `thumbnail.ts` allows a longer native wait than the 5-second test limit, but no timeout or specific native race was reproduced. The Mac process inventory command was also refused by the sandbox, so no claim is made about the rest of the machine's load. **Do not mark F575 fixed or flaky from these passes.** A successful native QuickLook run under the original competing-test load is still needed.

## What passed

- **ID links:** six title variants (duplicate title, case-only difference, brackets/pipes/hash, composed/decomposed Unicode and emoji), skill filing, source archive/restore, external note edit, index rebuild, and delete/recreate identity isolation (`links-lifecycle.ts`).
- **Link/index controls:** a folder renamed without changing source metadata still opens and remains searchable; index rebuild leaves the same search/backlink results (`links-probes.ts`). Only the broken-link checker fails, as LIB-09.
- **Editor:** 300 seeded fragment compositions, two successive small edits each, preserved unedited fragments. Two real seeded notes failed byte comparison because editing next to their trailing blank gaps normalized those gaps; this is included in LIB-10, not a separate text-loss finding (`editor-fuzz.json`, seed `0xD38`).
- **Editor matrix:** 15 of 24 modes passed both saves, including untouched footnotes, raw HTML, note frontmatter, separated/nested toggles, callouts, tables, math, tab-indented code and repeated blocks; the nine failing modes fall under LIB-02/LIB-10 (`editor-matrix-summary.json`).
- **Diagrams:** saved scene and note embed survive source rename, filing, archive/restore and source-folder move; next-free name allocation works; rename to an occupied diagram name refuses without overwriting (`lifecycle.ts`).
- **Courses:** lesson order, omission of archived lessons from live list, filing and renaming including archived lessons, and moving a lesson to another course produce the expected core membership (`lifecycle.ts`). F573/F576 undo cases were not repeated.
- **Feeds:** following twice produces one followed feed; an exactly matching manually saved URL hides its post; unfollow keeps the saved source; restoring the feed works; serial save-then-close keeps a preview's note (`feeds-loop.ts exact`, `feed-close-loop.ts serial`).
- **Archive and skills:** skill archive/restore leaves source bytes unchanged; skill delete/restore retains its note and backlink; ordinary source archive/restore preserves note/diagram (`lifecycle.ts`).
- **Cut controls:** plain cut/restore and reverse-order restoration of two cuts recover original text; a later edit making the stored position out of range is refused (`cut-shift-probes.ts`).
- **Library Git restore:** grouped source metadata, source note, diagram scene, skill metadata and skill-note link restore from a snapshot; search after restore agrees with a deleted/rebuilt `.index` (`history-lifecycle.ts`).
- **YAML controls:** ordinary settings/skill-name writes preserve custom fields/comments; BOM/CRLF and quoted names parse, aliases survive a settings write, empty/tab-indented YAML gives an actionable error (`yaml-probes.ts`, `yaml-loop.ts settings`, `yaml-loop.ts rename`). Duplicate-ID input was inspected without an asserted correctness result; it is not counted as a pass or finding.
- **Frontmatter:** 1,000 deterministic nested-value cases preserve semantic keys, values and body through the raw parser/writer, including multiline strings, colons, hash signs, quotes, date-like/number-like strings, null and lists (seed `0x4C494252`, `frontmatter-fuzz.ts`). This does not cover typed item writes, which fail LIB-05.
- **CLI JSON:** all 64 commands returned nonzero with valid JSON for the invalid-option error path; 16 read commands returned valid JSON on empty and populated libraries with no stdout contamination (`cli-matrix.json`). Successful AI/mutating branches of every command were not attempted.
- **Initialization:** sequential repeat init, simultaneous different-root init, and a nonempty folder with spaces/Unicode preserve existing user files (`cli-matrix.ts`, `init-probes.ts`). Same-root process concurrency fails LIB-11.
- **Add edges:** extensionless Markdown, symlinked file and a 2,115,014-byte text input import whole; wrong-PDF text, zero bytes, binary Markdown and a directory refuse without creating a visible source; concurrent same-file adds return one ID; same-title collision checks passed (`add-edges.json`).
- **Malformed source doctor:** reports issues and inability to check links without crashing (`doctor-loop.ts`).

## Artifact index

- `confirm.ts`, `confirmation.json`: repeat all production red cases three times; the backlink modes are grouped in the report.
- `controls.ts`, `controls.json`: 17 control/probe commands, all exit 0; some deliberately record contrasting failing states rather than asserting the product is fixed.
- `editor-matrix.ts`, `editor-fuzz.ts`, `frontmatter-fuzz.ts`: bounded deterministic editor/frontmatter matrices.
- `cli-matrix.json`, `add-edges.json`, `f575-results.json`, `f181-steps.json`: detailed coverage and measurements.
- `libs/`: owned scratch libraries, reusable until the corresponding script resets them.

No fixes, registry edits, commits, app installs, or shipping actions were performed.
