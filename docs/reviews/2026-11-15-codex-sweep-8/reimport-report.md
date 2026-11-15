# Reimport and kept-original test report

Tested the supplied Mac release page in WebKit at 1280×800 and the phone build at 390×844 with touch, with screenshots at 2×. Imported Markdown, saved HTML, PDF, EPUB, DOCX, PPTX, notebook and subtitle fixtures through Add; checked saved annotations and source notes across reimport, changed paragraphs/headings/tables, duplicates, deletion, Undo, invalid/missing/unreadable originals, injected command failure, and typing during a delayed reimport. Checked PDF and slide originals and the phone rendering of the reimported sources. Three new findings follow, each reproduced twice. AI was disabled: one linked exercise was seeded through core to check preservation, not AI drafting. Markdown has no Reimport by design (D93). Original-file edits were confined to `codex-out/reimport/scratch-library/`, a copy of the assigned library: Playwright routed this page's bridge requests to the real CLI with that root and the bridge's same AI-null behavior; no server was started or stopped. The phone received that copy through its supported `/library.json` snapshot loader; actual iCloud transport was not tested. Native external-app opening, OCR/transcription, full changed-original coverage for every binary format, and pure visual polish were skipped. Source inspection: `637e036418f4dfdc7ec1758489be5d715e95fae3`. No product, test-suite or findings-register files were changed.

## Findings

### R1 — Two reimports cannot both be undone; the earlier removed highlight and note stay gone

**S1 · Mac · 2/2 reproductions**

1. From a fresh page, add `codex-out/reimport/anchor-study.ipynb` through Add. Open **Anchor study**.
2. Highlight “The copper kettle whistles before the water boils.” and give it the note “Keep this kettle note.” Save and close the popup.
3. In this scratch source's kept `source.ipynb`, delete that sentence and reimport from **Source actions → Reimport**. The toast correctly reports one removed highlight. Call this version V1; the initial version is V0.
4. Edit the kept original again, renaming **First section** to **Updated first section**, and reimport. This is V2.
5. Click ordinary source text so the source note does not own keyboard Undo. Press ⌘Z, wait for completion, then press ⌘Z again.

**Expected:** The first Undo returns V1; the second returns V0, including the kettle passage, highlight and its note.

**Actual:** The first Undo returns V1. The second returns **V2**, while its toast says **“Undone: Reimported. 1 highlight is no longer in it, so it was removed.”** The updated heading reappears and the kettle passage is still absent. Its annotation remains `status: deleted`, so the highlight and attached note are not restored. The append-only annotation log still contains the note, but ordinary Undo cannot recover the original source version or show its work again.

**Evidence:** `double-undo-1.json` and `double-undo-2.json` contain V0, V1, V2 and both Undo results. In both, `undo1.body == v1.body`, `undo2.body == v2.body`, and `undo2.body != before.body`. Screenshots: `codex-out/reimport/double-undo-1.png`, `codex-out/reimport/double-undo-2.png`. Reproducer: `double-undo.cjs`.

**Suspected cause:** `packages/core/src/ingest/index.ts:825` uses one stash per source and line 827 deletes it on every reimport. `undoReimport` at line 970 toggles only the current pair. `apps/desktop/src/Reader.tsx:3143` puts the same unversioned `reimport --undo` callback on every distinct UI history step, so older steps operate on the newest stash.

### R2 — A Key point silently attaches to the wrong duplicate passage

**S2 · Mac · 2/2 reproductions**

1. From a fresh page, add the same notebook and mark “The blue heron nests beside the river each spring.” as a Key point. Add the note “My observation: north habitat.”
2. The original surrounding paragraphs are “A learner studies birds beside a quiet river.” and “This observation describes the northern habitat.”
3. In the kept original, move that entire three-paragraph block below the table. At its old location, leave a copy with **quiet → noisy** and **northern → southern**. These equal-length substitutions leave the duplicated highlighted sentence at the old character offset. Keep the original northern block intact at its new location.
4. Reimport and inspect both occurrences and the Key point's note.

**Expected:** The Key point follows the intact northern block, whose surrounding text matches the saved context; or Ore identifies the ambiguous placement for review.

**Actual:** The blue Key point remains on the **southern** duplicate, with the note still saying **north habitat**. The intact original northern occurrence is unmarked. The toast only says **“Reimported with the latest text.”** Saved `start: 81`, `end: 131`, and `anchor.method: position` confirm the wrong occurrence; the stored prefix still mentions the quiet river, despite the selected occurrence now following “noisy river.”

**Evidence:** `wrong-duplicate-1.json`, `wrong-duplicate-2.json`; screenshots `codex-out/reimport/wrong-duplicate-1.png` and `codex-out/reimport/wrong-duplicate-2.png`. Reproducer: `orphan-and-duplicate.cjs`.

**Suspected cause:** `packages/core/src/anchoring.ts:99` accepts an identical quote at its old offset before checking context or other occurrences. The context comparison at lines 101–106 is never reached, even though another occurrence retains the original context. This case exposes the risk in the documented position-first ordering; it is not a complaint about ordinary duplicate text with no evidence distinguishing the copies.

### R3 — A question loses its passage without warning, and “Show where it was asked” does nothing

**S2 · Mac · 2/2 reproductions**

1. From a fresh page, add the notebook. Mark “Questions make learners examine the evidence carefully.” as a Question and write “How strong is the evidence?” in its note.
2. Delete that sentence from the kept original and reimport.
3. Open **Collected**, right-click the question, and choose **Show where it was asked**.

**Expected:** Keep the learner's question, identify that its original passage could not be placed, and make the location action explain that condition.

**Actual:** The question correctly survives, but reimport says only **“Reimported with the latest text.”** There is no unmatched-passage indication. **Show where it was asked** remains enabled and silently does nothing: the reader stays at the same scroll position and no popup or error appears. `ore show` reports this question with `anchor: null`; the information never reaches the learner.

**Evidence:** `orphan-jump-1.json`, `orphan-jump-2.json`, including null anchor, UI text and unchanged scroll positions; screenshots `codex-out/reimport/orphan-jump-1.png`, `codex-out/reimport/orphan-jump-2.png`. Earlier views: `orphan-question-1.png`, `orphan-question-2.png`. Reproducer: `orphan-jump.cjs`.

**Suspected cause:** `packages/core/src/ingest/index.ts:850` excludes questions from the removed list, and line 852 returns no separate list of questions whose anchors failed. The CLI at `packages/cli/src/cmd-items.ts:536` and reader toast at `apps/desktop/src/Reader.tsx:3150` therefore omit them. `apps/desktop/src/Questions.tsx:507` offers the location action based on source identity alone; `apps/desktop/src/Reader.tsx:1769` returns silently when its range is missing.

## Known rows

- No fixed row was confirmed to have regressed.
- **F5**, already open, was observed during the missing-original check: “Only a source added from a link or a file can be reimported.” Not reported as a new finding. Saved source text, annotations and notes were unchanged in both attempts.
- F14, F259, F260, F275, F293 and F294 were outside this run's scope. Plain Markdown lacking Reimport is D93, not F181 returning.

## What passed

- Add accepted all eight fixture types: Markdown, saved HTML, PDF, EPUB, DOCX, PPTX, notebook and SRT.
- Word's saved Key point and note, question, code highlight and source note survived unchanged reimport byte for byte (`word-before-state.json`, `word-after-state.json`).
- EPUB's table-cell and code highlights, Key point, question and source note survived unchanged reimport (`A-Small-Book-of-Remembering-before.json`, corresponding `after.json`).
- PDF, PPTX, notebook and subtitle reimport preserved the tested annotations and source notes; unchanged bodies reported “already up to date” (`unchanged.jsonl`).
- Saved HTML reimport preserved the tested annotation and source note. Some remote image bytes/assets changed; this was not treated as an unchanged-body test or an offline-network test.
- Inserting text before marks, moving an otherwise unique marked sentence, renaming a heading and inserting a table row preserved the intended quote and attached note (`mutation-*.json`). A mild rewording reanchored fuzzily; the report does not count that intentional behavior as a finding.
- Deleting a plain marked passage reported its removal count. A single completed reimport could be undone; the failure is stacking two reimports of the same source.
- A display-formula highlight saved the whole `$$…$$`, retained its note and reanchored after preceding text was inserted (`formula-reimport-1.json`, `formula-reimport-2.json` and screenshots).
- A linked exercise created through `writeNewCard` retained its file and annotation link through the tested subsequent reimports (`seeded-exercise.json`, `exercise-preservation.json`). AI exercise generation itself was not exercised.
- Injected reimport failures preserved saved source data and showed the reason, twice (`failure-1-before.json`/`after.json`, corresponding round 2 and screenshots).
- Invalid notebook JSON and PDF bytes substituted for the notebook were refused without replacing the reader text; actual unreadable-original permission failures also showed an error (`unreadable-*.png`, `permission-*.png`).
- Source notes typed while a reimport response was delayed two seconds were saved and survived reopening, twice (`typing-1.json`, `typing-2.json`).
- PDF Original rendered its page, and PPTX Original rendered the matching slide text and allowed previous/next navigation, twice (`original-pdf-*.png`, `original-slides-*.png`). No internal Original tab was offered for saved HTML; external app launch cannot be verified through the no-op shell mock.
- On the phone, reimported Word, EPUB, PDF, PPTX, notebook, subtitle and HTML marks painted on the saved words (`phone-*.json`).
- The changed notebook's six marks, including the formula and code, retained their ranges across phone reload and a Collected → Source round trip; no duplicate annotations appeared (`phone-result.json`, `phone-preservation-*.json`, `phone-collected.png`).

## Harness and interpretation notes

All report evidence and scripts live in `codex-out/reimport/`. `driver.cjs` connects to the supplied WebKit instance; `helpers.cjs` drives real pointer selection and app controls. `fork.cjs` reproduces the supplied bridge's CLI behavior for the isolated copy, preserving `ORE_NO_ENRICH=1` and AI-null responses. `phone.cjs` feeds that copy through the phone's snapshot loader. Only one browser context was open at a time, with one page. No production library or installed app was touched. The initial inspection found an unrelated untracked `docs/reviews/2026-11-15-codex-sweep-8/`; it was left untouched.

The exploratory `mutations.cjs` initially issued its first Undo with the source note focused, so that key correctly undid note typing instead. Its second insertion was consequently a no-op. This is not a finding and is not counted as two independent insertion checks. The reported double-Undo reproduction explicitly focuses ordinary reader text and resets the source between its two runs. The initial formula setup also used JavaScript replacement-string `$$` syntax, producing a single dollar; it was corrected to a replacement callback before formula results were recorded. Neither harness mistake is attributed to Ore.
