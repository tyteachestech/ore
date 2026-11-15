# Highlights test report

Tested the supplied Mac release server at `http://localhost:1761/` with bridge `1762` and the phone build at `http://localhost:1763/`, using the supplied WebKit connection, one context/page at a time, 1280×800 Mac and 390×844 touch-enabled phone, screenshots at 2×. Checkout HEAD: `ca2f432f42066c5fd189c9bc1e5ce065be27b9f9`. Covered overlapping highlights, type changes, notes, removal/Undo, delayed and refused writes, code colours with Find/Explain, Listen over a Key point, headings, tables across cells/rows, inline/display math, inline/fenced code, lists, quotes, callout text, footnotes, links, emoji/CJK/Arabic, timed lecture text, imported PDF/EPUB/PPTX, EPUB captions, document boundaries, an 8,153-character selection, edge carry and endpoint shrinking. Four findings reproduced at least twice; no page crash observed. Native iOS long-press/selection handles were not available through this Mac WebKit connection: phone selection-specific tests used a DOM Range followed by real taps; table/code double taps used actual touchscreen events. Skipped native phone handle/edge-carry validation, image-only annotation and original PDF/slide canvas selection, live AI-generated exercises/quotes and quiz-evidence paint (AI is disabled), and pure visual polish. All test-created sources were added through the app; library files were only read directly. No application, test, documentation or findings-ledger files were changed.

## Findings

### H1 — Immediate Undo during deletion erases the highlight's saved note

**S1 — saved note loss. Mac.**

1. From a fresh Mac page, use **+ Add** to paste a short source containing `The essential passage should survive an immediate undo. Another sentence provides context.` Use a new title for each repeat.
2. Highlight `essential passage`, mark it **Key point**, and write `My explanation must remain.` in its note. Press Enter and let the save finish.
3. Reopen that highlight. Set the supported test hook `window.__ORE_SLOW = { annotate: 1500 }`.
4. Click **Remove highlight**, then press **⌘Z** about 100 ms later, while the deletion response is pending. Wait 3.5 seconds.
5. Clear the delay hook. Click the **Undo** on the now-visible **Highlight removed** toast, wait for restoration, then reload, reopen the source and open the highlight.

**Expected:** The first ⌘Z reverses the deletion. The highlight retains its Key point type and its saved note.

**Actual:** The first ⌘Z reverses the preceding *note edit* instead. The highlight stays deleted and a real `annotate --note=` write clears its note. The later deletion Undo restores the highlight's status, but the note is still blank after reload. The library log ends at revision 6 with `status: open` and no `note`; this is a saved-state problem, not just a stale popup. The previous note text still exists in an older log revision, but the normal restore path does not recover it.

**Reproduced:** 2/2 complete delete → immediate Undo → restore → reload journeys, plus 2/2 earlier delete/Undo checks. Delay was deliberately injected; no claim about its frequency on an un-delayed Mac.

**Evidence:** [pending-delete-recovery.json](pending-delete-recovery.json), [disk-evidence.json](disk-evidence.json). Screenshots: `codex-out/highlights/pending-delete-lost-note-1.png`, `codex-out/highlights/pending-delete-lost-note-2.png`. Runner: [pending-delete-recovery.cjs](pending-delete-recovery.cjs).

**Suspected code:** `apps/desktop/src/Reader.tsx:2194` awaits the deletion before `:2200` registers its Undo. The prior note action remains the top history action during that wait. `:2089` restores only status, so the subsequently cleared note stays cleared. The Collected-list removal path at `:2203` already registers history before awaiting its write.

### H2 — Formula highlights reopen on unrelated prose or disappear

**S2 — wrong saved location/quote. Mac; corroborated on iPhone's selection path.**

1. From a fresh page, add [math.md](math.md) through the Mac **+ Add** box. On a second run use a different source title, retaining its initial `Equation…`.
2. With an Option-drag, select only the visible **E** in the inline formula `E = mc²`. Press Enter to keep it.
3. Select only the visible **x** in the display formula and keep it.
4. Select from the inline formula's **c²** through `after this equation.` and keep it.
5. Reload and reopen the source.

**Expected:** Each selection remains on its equation and preserves the chosen mathematical content; an unsupported selection must not silently become a different passage.

**Actual:** The **E** selection is saved against the `E` at the start of the Markdown title (`start: 2`), then paints the **E** in the unrelated sentence `The variables x and E appear in this plain sentence too.` on reopening. The display **x** is saved inside the TeX but has no painted highlight after reopening. The selection starting inside **c²** silently saves only `after this equation.` and drops the selected formula portion. The initial live selection looks correct, hiding the mistake until reopening.

**Reproduced:** 2/2 fresh Mac sources using real pointer drags for E/x; the cross-formula selection was confirmed by a real pointer drag on the second source. Also 2/2 fresh phone journeys for E/x: import [phone.md](phone.md), establish the selected Range, tap **Key point**, go Back and reopen on the same page. Phone corroboration does **not** validate native long-press/handle behaviour.

**Evidence:** [math-calls.json](math-calls.json), [repeat-log.json](repeat-log.json), [phone-full.json](phone-full.json), [disk-evidence.json](disk-evidence.json). Screenshots: `codex-out/highlights/math-E-selected.png`, `codex-out/highlights/math-reopened.png`, `codex-out/highlights/repeat-reopened.png`, `codex-out/highlights/phone-reopened-1.png`, `codex-out/highlights/phone-reopened-2.png`. Runners: [math-check.cjs](math-check.cjs), [confirm-repeat.cjs](confirm-repeat.cjs), [phone-full.cjs](phone-full.cjs).

**Suspected code:** `apps/desktop/src/text.ts:240` excludes KaTeX nodes; `sourceQuote` at `:316` uses only indexed characters, so a partial formula disappears from its quote. `apps/desktop/src/Reader.tsx:1869` falls back to raw selected text when no quote is found, with the rough location from `text.ts:308`. `rangeFor` at `text.ts:353` cannot repaint a quote wholly excluded from the index.

### H3 — Code highlights lose meaningful boundary symbols when saved

**S2 — altered code quote and invisible symbol-only highlight. Mac; corroborated on iPhone for inline code.**

1. From a fresh page, add [math.md](math.md) through **+ Add**. Use another title for the repeat.
2. Option-drag to select the entire inline code `items[0]`, then press Enter.
3. In the fenced code block, separately select and keep `[1, 2, 3]`, `_private_`, and the single `|` in `left | right`.
4. Reload and reopen the source.

**Expected:** Code is literal text. All selected brackets, underscores and operators remain in the saved quote and the highlight reopens over the same characters.

**Actual:** The saved quotes are `items[0`, `1, 2, 3`, and `private`. The live paint initially includes the complete selection, but reloading exposes the truncated range. The `|` quote is saved correctly on disk yet disappears from the reader's paint after reopening, so its operator cannot be clicked as a highlight. The same happened to a standalone `_` in the other lab source.

**Reproduced:** 2/2 fresh Mac sources, real pointer drags for all four examples. `items[0]` also reproduced 2/2 on the phone after Range selection → **Key point** tap → Back/reopen. See the native-selection caveat in H2.

**Evidence:** [symbol-calls.json](symbol-calls.json), [repeat-log.json](repeat-log.json), [phone-full.json](phone-full.json), [disk-evidence.json](disk-evidence.json). Screenshots: `codex-out/highlights/symbol-0-selected.png`, `codex-out/highlights/symbol-1-selected.png`, `codex-out/highlights/symbol-2-selected.png`, `codex-out/highlights/symbol-3-selected.png`, `codex-out/highlights/symbol-reopened.png`, `codex-out/highlights/repeat-reopened.png`. Runners: [confirm-symbols.cjs](confirm-symbols.cjs), [confirm-repeat.cjs](confirm-repeat.cjs).

**Suspected code:** `apps/desktop/src/text.ts:9` ignores `*_\`[]|~` in both source and rendered skeletons, including literal code. `sourceQuote` at `:326` rebuilds the boundaries from the remaining characters; `rangeFor` at `:353` returns no range when a symbol-only quote has no remaining characters.

### H4 — Undo changes which overlapping highlight opens under the same words

**S2 — a restored inner note becomes inaccessible from its highlighted words. Mac.**

1. From a fresh page, add a new source containing `Alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november.`
2. Highlight `bravo charlie` and save note `INNER note`. Separately highlight `golf hotel` and save `SECOND note`.
3. Highlight the larger passage from `Alpha` through `juliet` and save `OUTER note`. Covering two existing highlights creates a separate outer highlight.
4. Click the word `bravo`. Confirm its popup says `INNER note`. Remove that highlight.
5. Wait for **Highlight removed**, then click its **Undo**. Click the same word `bravo` again.

**Expected:** Undo restores the inner highlight and the same click opens its own note, as before removal.

**Actual:** The click opens `OUTER note` and activates the entire outer passage. Both annotations still exist, but the restored inner highlight is behind the outer highlight in hit-testing order. Selecting the exact inner words also chooses the outer one. This is an opening/targeting failure, not evidence that the inner note was deleted.

**Reproduced:** 2/2 fresh sources, using actual mouse clicks before and after Undo. The lifecycle run also exhibited it on three restored inner passages.

**Evidence:** [overlap-open.json](overlap-open.json), [lifecycle.json](lifecycle.json), [disk-evidence.json](disk-evidence.json). Screenshots: `codex-out/highlights/overlap-before-1.png`, `codex-out/highlights/overlap-after-1.png`, `codex-out/highlights/overlap-before-2.png`, `codex-out/highlights/overlap-after-2.png`. Runner: [overlap-open.cjs](overlap-open.cjs).

**Suspected code:** `apps/desktop/src/text.ts:382` returns the first matching Map entry. `apps/desktop/src/Reader.tsx:2073` re-adds a restored range at the end of that Map; the containing highlight then wins. The selection route has the same first-match behaviour at `Reader.tsx:1926`.

## Known rows seen again

No previously fixed row was confirmed to have returned. In particular, **F331/F339 did not recur** in the tested code/Find/type-change/removal/Undo combinations. Open F6 describes the two text maps; this report records concrete incorrect quotes and locations, not another report of that architectural observation. The pending-deletion issue is a different control from the older title/drag pending-Undo findings. Excluded known rows and AI-null results were not re-reported.

## What passed

- Three independent highlights plus a fourth covering them stayed present; type changes and note saves did not crash WebKit.
- Selecting an already highlighted passage reused it; a selection extending one existing passage grew it instead of creating a duplicate.
- Settled deletion Undo restored highlighted text/types; H4 describes the remaining opening problem for overlapping inner highlights.
- Code syntax paint with Find remained responsive during six bounded cycles of selection, type changes and deletion; the separate lifecycle test confirmed a completed deletion Undo with Find still open.
- Explain's lookup underline coexisted with code colours and Find without a crash; the disabled AI reply displayed a retry/continue message. Evidence: `paint-extra.json`.
- Listen's sentence underline coexisted with a Key point without a crash and stopped on the second L. Evidence: `paint-extra.json`.
- Resizing an endpoint across another highlight worked; ⌘Z restored the earlier span. Evidence: `lifecycle.json`.
- Dragging the end past the start stopped at the last nonempty word instead of saving a zero-length annotation. Evidence: `zero-edge.json`.
- A refused `highlight` write showed `Test write refused`, removed the optimistic highlight and left existing highlights intact. Evidence: `lifecycle.json`.
- Heading text, a table cell, a span crossing table cells/rows, emphasized list text, quote text, callout text, footnote text/reference crossings and link labels reopened on the same rendered words. Link-label checks do not validate a native drag beginning on a link (open F3).
- Emoji sequences, Chinese, Arabic, a standalone `Z`, and the final sentence reopened on the same words. Boundary whitespace was trimmed; no neighbouring words were added.
- Imported `paper.pdf` prose, `book.epub` prose/chapter headings/caption/table headings, and `deck.pptx` heading/bullet/speaker-note passages retained their highlights after reload. Evidence: `import-types.json`, `remaining-content.json`.
- Two passages in the seeded lecture's timestamped transcript reopened on the intended words; extending its pre-existing highlight retained the correct sentence. Evidence: `remaining-content.json`.
- A whole 36-section source selection retained all 8,153 rendered characters after reload. Holding the pointer at the page edge carried a later selection down 705 px and saved a 1,564-character range without a crash. Evidence: `long-edges.json`.
- On the phone, actual double taps created table-cell and whole-code-block highlights; changing their type worked, twice. Evidence: `phone-full.json`.
- On the phone, Aa changes to larger text, Geist, wider margins and Light page left the already loaded highlight ranges unchanged, twice. H2/H3 occur on reopening, independently of Aa.

## Evidence and execution notes

`disk-evidence.json` is a read-only snapshot of the latest annotation revisions from eleven test sources. The individual JSON logs include selected text, CLI arguments/results where captured, and browser paint ranges. Phone writes were checked by leaving/reopening within the same page; no phone writes were made to the on-disk seed. The finding runners create sources through the app; use fresh titles when re-running them. Some exploratory scripts remain beside the final runners; a selector failure in an exploratory script was not treated as an app finding. All browser contexts created by these scripts were closed. No servers, watchers, extra browser processes, full test suite or live AI evals were started.
