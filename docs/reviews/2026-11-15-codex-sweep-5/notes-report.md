# Notes sweep — findings only

Tested the supplied release Mac page in WebKit at 1280×800 and 2× scale against the real scratch-library bridge. Coverage includes a timed, ten-burst writing session with 2,000 words of prose plus structural examples; repeated close/reopen and disk comparisons; nine clipboard payloads; the app's own copy/paste; 100 links, self-links, rename/deletion and backlinks; table/block/diagram undo; concurrent writes through two app pages; and failed-save recovery. Direct edits to library files were **not performed**, because the preamble permits library changes only through the app. Instead, seven Markdown preservation cases were checked directly against the real editor and `preserve.ts`, twice each, and two app pages exercised the real merge path. Google Docs, Notion, Word and Apple Notes clipboard cases are **constructed representative payloads, not captures from those applications**. The supplied phone fixture has independent IndexedDB storage and no live Mac sync; it cannot establish what a real iPhone write sends to the Mac. Final writing totals and phone results are recorded below. No source code, findings registry, installed app, or real library was changed.

## Findings

### N1 — Copying an Ore link destroys its destination

**S2 · Mac and iPhone**. The copied label still looks like a link, but no longer opens its target or contributes a backlink. This also affects pasting an existing Markdown link with an `ore:` destination.

1. From a fresh Mac page, open Habits and focus its skill note.
2. Insert a link using `[[Learning` and Enter. Let it save.
3. Select the link's paragraph with ⌘A, copy it, move to a new paragraph, and paste.
4. Open the pasted link, then close/reopen the note and inspect `skills/habits/notes.md`.

**Expected:** both copies retain `ore:skill/learning` and open Learning.

**Actual:** the first saves as `[Learning](ore:skill/learning)`, the pasted copy as `[Learning]()`. Clicking the copy reports `Ore opens web links, mail links and links to sources and skills; “” isn’t one of those.` The actual Ore copy handler emits `<a class="ore-link" href="">Learning</a>`; its plain-text flavor is just `Learning`. A plain-Markdown paste of `[Learning](ore:skill/learning)` independently produces the same empty URL.

**Reproduced:** 2/2 independent Mac app-copy runs, the second in a fresh page; also 2/2 Markdown paste passes and 2/2 iPhone app-copy runs. Copy/paste events used explicit `ClipboardEvent`/`DataTransfer` payloads, exercising Ore's real clipboard handlers without the operating-system clipboard.

**Evidence:** `link-before-copy.md`, `link-after-copy.md`, `app-clipboard.json`, `link-copy.png`, `link-copy-click.png`, `paste-markdown.md`; script `copy-link.js`.

**Suspected cause:** `apps/desktop/src/editor/editor.ts:28` only marks Ore links with a class, and `:54` installs Milkdown's clipboard plugin. Milkdown's `preset-commonmark/src/mark/link.ts:45` sanitizes the custom scheme to an empty DOM `href`. The clipboard plugin serializes Markdown through that DOM at `plugin-clipboard/src/index.ts:118–133`, then parses the already-empty URL. `NoteEditor.tsx:348` works around sanitized DOM URLs for *clicking existing links*, but the clipboard has no equivalent preservation route. Dependency paths are under `node_modules/.bun/@milkdown+…@7.22.3/`. Phone evidence: `phone-check.json`, `phone-final-files.json`, `phone-paste-issues.png`. On the phone, open Building Effective Agents → Note and repeat the same picker/copy/paste sequence; taps were used for navigation and picker selection, with the same synthetic clipboard-event method.

### N2 — Plain TSV paste loses its column boundaries

**S2 · Mac and iPhone**. Multiword cells become an ambiguous run of prose instead of a usable table or preserved tab-separated text.

1. From a fresh page, open any skill note and place the caret in an empty paragraph.
2. Paste this as `text/plain` only, with actual tabs between cells:

   ```text
   Term\tValue\tNotes
   Chain\t2\tFixed stages
   Agent\t3\tDynamic choices
   ```

3. Close/reopen the note and inspect its Markdown.

**Expected:** preserve the cells as a table, or at minimum retain the tab delimiters so the data can be recovered.

**Actual:** saved text is `Term Value Notes\nChain 2 Fixed stages\nAgent 3 Dynamic choices`; every tab is replaced by a space. On screen the soft lines run together. Plain text `Plan\n\tClaim\n\t\tEvidence\nEnd` also loses the indentation completely. This is limited to the plain-text flavor: the equivalent HTML table pastes as a real table.

**Reproduced:** 2/2 Mac paste passes, including an isolated empty-note pass, plus 2/2 iPhone pastes.

**Evidence:** `paste-spreadsheet-tsv.md`, `paste-spreadsheet-tsv.png`, `paste-plain-tabs.md`, `paste-plain-tabs.png`, `paste-spreadsheet-html.md`, `spreadsheet-html.png`; payloads in `paste-cases.cjs`, runner `paste-run.js`.

**Suspected cause:** `apps/desktop/src/editor/editor.ts:54` uses Milkdown clipboard handling with no TSV path. `plugin-clipboard/src/index.ts:118–133` parses all plain text as Markdown, serializes it to DOM, then reparses the DOM. Tab delimiters/continuation indentation are lost along that route. Phone evidence: `phone-check.json`, `phone-final-files.json`, `phone-paste-issues.png`; paste the same plain-text TSV into Building Effective Agents → Note.

### N3 — Backlinks keep the old name after a skill is renamed

**S2 · Mac**. The sidebar and backlink list disagree about which note links here until the page is reopened.

1. From a fresh page, insert a `[[Learning` link in Habits' note and save.
2. Open Learning so its Linked from list shows Habits.
3. Keep Learning open. In the sidebar, open Actions for Habits → Edit skill, rename it, and press Enter.
4. Compare the sidebar with Linked from. Reload and open Learning again to see the current name.

**Expected:** the backlink displays the linking skill's new name when the rename finishes.

**Actual:** the sidebar updates immediately, but the list retains the old name. The CLI's read-only `backlinks --skill learning` already returns the new name. Reloading fixes the display. Renaming the same skill again reproduces it with the previous name.

**Reproduced:** 2/2, with a fresh page between the renames. Names tested: `Habits` → `Habits renamed & café [notes]` → `Habits renamed again`.

**Evidence:** `backlink-after-rename.png`, `backlink-after-rename-2.png`, `backlink-after-rename.txt`, `backlink-rename-2.json`, `backlinks-after-rename.json`.

**Suspected cause:** `apps/desktop/src/Notes.tsx:342–351`: `LinkedFrom` fetches only when the target key changes, not when skill names or library contents change.

### N4 — Deleted skill notes remain as unusable backlinks

**S2 · Mac**. A deleted skill can leave dozens of dead entries in Linked from, including after a fresh load.

1. From a fresh page, write a link to Learning in Habits' skill note.
2. Delete Habits through its sidebar actions, keeping its sources if prompted.
3. Reload and open Learning.
4. Click the backlink from `habits notes`.

**Expected:** an ordinary backlink list excludes notes whose owning skill no longer exists, or offers an explicit, working route to the retained note.

**Actual:** the backlink remains, now named by the raw ID (`habits notes`). Clicking it cannot open the retained writing and says the skill is no longer in the library, suggesting editing or removing the link. The learner cannot reach that originating note from this entry. The 100-link note left 100 such entries. The note file itself is correctly retained; the finding is the inaccessible entries, not retention of the file.

**Reproduced:** 2/2 separate skills: Habits (100 links) and Teaching (one link). The first was checked after reload; the second after navigating away and back, with the skill absent from `skills.yaml`.

**Evidence:** `backlink-deleted.png`, `backlink-deleted-click.png`, `backlink-deleted.txt`, `backlink-deleted-2.png`, `hundred-links.md`.

**Suspected cause:** `packages/core/src/links.ts:58–62`: `noteFiles()` enumerates every retained skill-note directory even when its ID is absent from the active skills, falling back to the ID as its title. `backlinks()` then exposes those files as normal navigable entries.

## Known rows

No fixed finding was confirmed to have returned. F1 remains a relevant known open limitation. One check of ⌘Z after a merged save followed by editor close/reopen did nothing (`merge-undo.json`); that combines merge and remount, so it is not claimed as a new finding or a clean isolation of F1. The heading-link behavior covered by F247 worked (`heading-link.json`), and a link to a deleted skill gave a helpful error. F193's canceled-drag behavior was not part of this run.

## Passed and coverage details

- `preserve-check.ts`: 14/14 checks. An unrelated paragraph edit preserved wiki links, front matter, HTML comments, footnotes, hard line breaks, four-level lists and their combined case byte for byte. This is a direct editor/`preserve.ts` check, not an external-file watcher test.
- Pasted Markdown headings, four-level lists, checked/unchecked todos, callouts, toggles, a table, fenced tab-indented code and inline/display math rendered and survived subsequent saves/reopens. Internal `ore:` links are the N1 exception.
- All nine constructed clipboard cases supported ⌘Z and ⇧⌘Z, restoring the pre-paste and post-paste text respectively (`paste-results.json`).
- Rich web and Google Docs-shaped HTML kept headings, bold text and nested lists without retaining their inline styles or empty spans. Nonbreaking spaces remained as U+00A0. No functional harm was demonstrated, so that residue is not a finding.
- Native-application clipboard fidelity remains unverified. The constructed Word payload flattened CSS-defined bullets; the constructed Notion payload flattened an HTML checkbox and `<details>` into ordinary content. Those need actual source-app clipboard captures before attributing a product-level bug to Word or Notion.
- VS Code's `vscode-editor-data` flavor correctly created a Python fence and retained tabs (`paste-vscode-metadata.md`). Generic styled-code HTML without that metadata did not become a fence; see `paste-code-editor.md` for the observed output.
- HTML spreadsheet content became a GFM table (`paste-spreadsheet-html.md`); plain TSV did not (N2).
- 100 links inserted through the actual `[[` picker saved with their IDs and produced 100 backlinks, with the correct heading and line (`hundred-links.md`, `hundred-links-backlinks.txt`). A self-link was excluded from the source note's own backlink list, as intended; read-only CLI returned `[]`.
- A link still opened its target after renaming the target to `Learning & memory [café]`; the saved link retained the stable ID (`renamed-target-opens.png`). After deleting that target, clicking the retained link gave a useful missing-skill explanation (`deleted-target-link.png`).
- Table-cell edit, block move, and their undo/redo matched the disk contents exactly (`table-block-check.json`).
- Diagram edit changed live shapes 1 → 2; ⌘Z restored 1; ⇧⌘Z restored 2; closing/reopening retained 2 (`diagram-check.json`, `diagram-edit-redo.png`). An earlier harness attempt lacked reliable focus and is not used as a result.
- Two app pages editing the same note preserved both contributions. The first page had stale text; its next autosave merged the second page's sentence exactly once, retaining every earlier prose paragraph (`concurrent-before-merge.md`, `concurrent-after-merge.md`).
- A second-page write made while the first note pane was closed was not visible on immediate tab reopen without a simulated native focus event (`closed-other-editor.json`); the next write merged it without loss. A follow-up using the app’s actual window `blur`/`focus` events after more than its documented 10-second absence threshold is recorded in `closed-other-editor-focus.json`. The Tauri clipboard-focus mock hook alone does not exercise that path. These are app-originated writes in the browser fixture, not a test of the live native file watcher or direct edits by Obsidian/the CLI.
- Two simulated full-disk note saves showed an error, left the marker absent from disk, retained the draft through navigation, and saved it on reopening after the failure hook was cleared (`save-failure-results.json`, `failed-save-1.png`, `failed-save-2.png`).

## Writing session and phone completion

The writing session ran from 13:36:50 UTC to 13:56:52 UTC on 2026-11-15 (1,202 seconds). The final file contains all ten 200-word prose paragraphs exactly once: 2,000 prose words, 2,181 words including headings, examples and concurrent-edit markers. Every close/reopen left the just-saved file unchanged. Nested lists, todos, callout, toggle, table, tab-indented fenced code, inline/block math, heading/odd-character links and the diagram reference remained present. All three concurrent-edit markers occur exactly once. Evidence: `final-writing.md`, `writing-verification.json`, `writing-log.jsonl`, `burst-0.md` through `burst-9.md`, `writing-final.png`. Prefix comparison differs only on the two bursts that merged another page’s additions; all expected text survived. The heading link also scrolled to its heading (`heading-link.json`). On the phone (390×844, touch/mobile WebKit, 2×), typed prose and Markdown headings, nested lists, a table and tab-indented fenced Python saved in IndexedDB. Editing a table cell, ⌘Z and ⇧⌘Z matched the stored text. The two clipboard findings reproduced twice each on this build. Evidence: `phone-initial-files.json`, `phone-final-files.json`, `phone-check.json`, `phone-writing.png`, `phone-paste-issues.png`; scripts `phone-start.js` and `phone-check.js`. Reloading the same phone page preserved both the rendered editor text and IndexedDB bytes (`phone-reload-check.json`, `phone-after-reload.png`). Native iOS keyboard/IME behavior was not tested. The Mac file is unchanged by these phone writes, as expected for the explicitly unsynced fixture; this does **not** validate production iCloud sync. The initial harness used the wrong document-end/select-all sequence; those setup mistakes were corrected, the first two prose bursts were re-entered, and no harness mistake is reported as an app defect. All explicit artifact writes are confined to this folder; library changes came from the app.
