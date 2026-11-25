from pathlib import Path
import json
r=Path(__file__).resolve().parent
findings=[]
def add(title,severity,case,steps,expected,hypotheses,probes,cause,grid,extra=None):
 findings.append(dict(title=title,severity=severity,case=case,steps=steps,expected=expected,hypotheses=hypotheses,probes=probes,cause=cause,grid=grid,extra=extra))
add('A merged Word table puts an outcome under the treatment column','S1','word-merged',
 ['Make a two-column Word table: Treatment / Outcome, then Training / Improved.','Vertically merge Training into the next row, whose outcome is Retained.','Import the DOCX; read the saved doc.md.'],
 'Retained must remain under Outcome, with a blank or repeated Training cell to its left. It is saved under Treatment instead. This changes the facts the learner reads or uses to draft exercises (D122).',
 ['If the Markdown table rule ignores row spans, Mammoth HTML will still have rowspan="2" while the direct converter already shifts Retained left.','If Mammoth loses the Word merge, its HTML will already put Retained in the wrong logical column.','If persistence changes the table, direct conversion will be correct and only doc.md will be wrong.'],
 '`bun codex-out/office/word-probes.ts` → Mammoth returns `<td rowspan="2">Training</td>` and a following one-cell row; direct conversion produces `| Retained |  |`. Replacing the merged cell with an ordinary empty cell gives `|  | Retained |`. H1 confirmed; H2/H3 rejected. [Probe log](logs/word-merged-probes.log).',
 '`packages/core/src/ingest/markdown.ts:34–41`: enumerates each row’s present DOM cells without occupying columns covered by earlier row spans, then pads only at the end. Called by `office.ts:55`.',
 'Word × tables (`intake-grid.test.ts:73`) names the ordinary two-column fixture test. It does not cover merged-cell alignment.')
add('Literal RTF bytes ignore the declared code page and corrupt Cyrillic text','S1','rtf',
 ['Write `{\\rtf1\\ansi\\ansicpg1251 `, the six bytes CF F0 E8 E2 E5 F2, and `}`.','Import that RTF and read doc.md.'],
 'The bytes spell Привет in Windows-1251. Ore saves Ïðèâåò. The canonical text is corrupted; the kept source.rtf remains byte-identical and can support a later repair (D122).',
 ['If raw bytes are decoded as Western text before the RTF code page is applied, literal bytes will fail while equivalent hex escapes work.','If Windows-1251 is unavailable in this runtime, both literal and escaped bytes will fail.','If Markdown serialization corrupts Cyrillic, the direct RTF converter will be correct but the saved item will be wrong.'],
 '`bun codex-out/office/probes.ts rtf` → literal input returns Ïðèâåò directly; the same bytes written as `\\\'cf\\\'f0…` return Привет; a Windows-1252 Café control is correct. H1 confirmed; H2/H3 rejected. [Probe log](logs/probes-rtf.log).',
 '`packages/core/src/ingest/rtf.ts:85` decodes the entire byte stream as latin1/Windows-1252. `:190–194` sends those raw characters straight to put(). Only hex escapes (`:198–200`) reach the codepage-aware decoder at `:120–131`.',
 'Rich Text × language (`intake-grid.test.ts:78`) is marked covered, but the fixtures exercise Unicode/escaped bytes, not literal bytes under a non-Western code page.')
add('A Word equation disappears without a warning or refusal','S2','word-equation',
 ['Create a Word document with one ordinary paragraph and one OMML equation, E=mc².','Import it and read doc.md. The ordinary paragraph is necessary to avoid the existing empty-document refusal.'],
 'The equation must be learnable as math, or the unsupported import must explicitly refuse with a next step (D96/D122). Actual: success, with only “Energy equation follows.” The formula is absent and no limitation is recorded.',
 ['If Mammoth cannot read OMML and its warning is discarded, its result will name the ignored oMath element.','If the HTML-to-Markdown step drops an equation Mammoth understood, the formula will appear in Mammoth HTML but not the direct converter.','If the package or text is invalid, equivalent ordinary text in the same package will also fail.'],
 '`bun codex-out/office/probes.ts word` → Mammoth reports “An unrecognised element was ignored: {http://schemas.openxmlformats.org/officeDocument/2006/math}oMath”; its HTML already omits the equation. The same equation as a plain Word run survives. H1 confirmed; H2/H3 rejected. [Probe log](logs/probes-word.log).',
 '`packages/core/src/ingest/office.ts:49` takes only Mammoth’s value and drops messages; `:55–58` saves the remaining body. There is no OMML conversion or unsupported-content check.',
 'Word × math (`intake-grid.test.ts:73`) says n/a, although Word has OMML equations and D122 explicitly includes math. This is an unrepresented capability gap, not a proven-covered cell.')
add('A PowerPoint table-only slide imports as an empty slide','S2','slides-table',
 ['Use one slide containing a native DrawingML table: Method / Score, Practice / 92.','Import the PPTX. The presentation’s slide list contains only that slide.'],
 'The table and its four cell texts must survive in the canonical source (D122), or be refused with a next step (D96). Actual: success with only the generated slide marker and “Slide 1”; all table content disappears.',
 ['If extraction only traverses text shapes, table cell text will be present in XML but ignored; moving the same text into a shape will work.','If the table is malformed or undecodable, its XML cells will be absent or unreadable.','If storage drops tables, direct pptxToDoc will be correct.'],
 '`bun codex-out/office/probes.ts slides` → XML cells are `["Method","Score","Practice","92"]`; direct conversion is empty except the generated heading. Adding “Practice 92” in p:sp makes that text survive. H1 confirmed; H2/H3 rejected. The initial three-slide reproduction was reduced to this single table-only slide. [Probe log](logs/probes-slides.log).',
 '`packages/core/src/ingest/office.ts:89–92` collects only p:sp shapes, excluding p:graphicFrame/a:tbl; `:100–113` supplies a heading and accepts it as content.',
 'PowerPoint × tables is n/a (`intake-grid.test.ts:74`). PowerPoint × text is covered only by text shapes and notes. A native slide table is not covered.')
add('A teaching figure reused on three slides is removed from the entire deck','S2','slide-repeated',
 ['Use the same large teaching diagram in three slides, each referencing the same media part.','Import the deck. The fixture retains the original large figure dimensions and gives it descriptive teaching alt text.'],
 'The figure should appear on all three slides and may share one saved asset. Actual: zero image references and zero assets. Frequency alone does not make a learning diagram a logo (D122).',
 ['If the repeated-picture heuristic is responsible, two slides will preserve it and three will remove it.','If asset hashing loses repeated references, three different media paths holding identical bytes will also lose the figure.','If the generated relationships are broken, the two-slide control will also fail.'],
 '`bun codex-out/office/slide-repeated.ts probes` → 2 slides, same path: 2 references / 1 asset; 3 slides, same path: 0 / 0; 3 slides, separate paths with identical bytes: 3 / 1. H1 confirmed; H2/H3 rejected. [Probe log](logs/probes-slide-repeated.log).',
 '`packages/core/src/ingest/office.ts:81–85,105` counts media paths across slides and skips any used at least three times. It never checks whether the image is a logo, its position, size, or whether it is the slide’s only teaching figure.',
 'PowerPoint × images (`intake-grid.test.ts:74`) names a test that intentionally drops a repeated logo. The same heuristic also drops repeated instructional figures; the test never distinguishes them.')
add('An Excel formula without a cached result disappears as though its cell were empty','S2','sheets-formula',
 ['Create a workbook with a Result header and A2 containing `<f>1+1</f><v/>`.','Import the XLSX and read doc.md. No cached numeric answer is supplied.'],
 'The formula must remain represented, be computed correctly, or cause a clear refusal asking for a recalculated/exported copy. Actual: the entire formula row vanishes, leaving only the header. Files produced by libraries can legitimately have formulas pending recalculation; silently reading them as blanks violates D96/D122.',
 ['If only cached values are read, adding `<v>2</v>` without changing the formula will make the value appear.','If formulas are discarded even with caches, that cached control will still fail.','If row coordinates or serialization are responsible, the direct converter or a literal numeric cell will behave differently.'],
 '`bun codex-out/office/probes.ts sheets` → direct uncached conversion omits the row; adding only the cache emits `| 2 |`. H1 confirmed; cached-formula and persistence explanations rejected. [Probe log](logs/probes-sheets.log).',
 '`packages/core/src/ingest/sheets.ts:140–152` reads only v/is/shared strings, never f; an empty cached value produces empty text and is not placed in the row. `:154–156` then removes the empty row.',
 'Spreadsheet × tables (`intake-grid.test.ts:79`) points to “formulas’ values,” but that fixture contains cached results only. No guard covers an uncached formula.')
add('Excel clock times become elapsed durations','S2','sheets-time',
 ['Put the same numeric value 1.5 in two cells. Format A2 with built-in format 20 (h:mm) and B2 with 46 ([h]:mm:ss).','Import and compare Clock / Duration in doc.md.'],
 'The clock cell should be 12:00 and the elapsed-duration cell 36:00 (seconds may be omitted when zero). Actual: both say 36:00. A time of day is saved as a false value (D122).',
 ['If clock and elapsed formats share one formatter, both will agree below one day but both become 36:00 at 1.5.','If the workbook style references are wrong, a distinct style/control may not be selected at all.','If the library changes the value after conversion, xlsxToDoc will distinguish the two correctly.'],
 '`bun codex-out/office/probes.ts sheets` → direct conversion with 0.5 gives 12:00 / 12:00; 1.5 gives 36:00 / 36:00. Styles 20 and 46 are distinct in the fixture, but both map to the same “time” kind. H1 confirmed; H2/H3 rejected. [Probe log](logs/probes-sheets.log).',
 '`packages/core/src/ingest/sheets.ts:72,81` collapses time-of-day and elapsed duration formats; `:97–100,145` calculates hours from all days instead of the fractional day for clock formats.',
 'Spreadsheet × tables is marked covered (`intake-grid.test.ts:79`). The dedicated time/duration test (`intake.test.ts:684`) tests a clock below 24h and a duration above 24h, leaving this distinction untested.')
add('A notebook Markdown attachment is never saved as an image','S2','notebooks-attachment',
 ['Create one Markdown cell containing `![Diagram](attachment:heart.svg)` and that SVG in its attachments map.','Import the notebook and inspect doc.md and assets/.'],
 'The diagram must be copied to assets and linked from doc.md (D122). Actual: the unresolved attachment: link is saved unchanged and no asset exists. The minimal notebook has only this one cell.',
 ['If attachments are ignored, the Markdown cell’s attachment map will not produce assets while identical SVG in an output MIME bundle will.','If SVG bytes are unsupported, the output-image control will fail too.','If persistence loses the image, notebookToDoc will contain an asset that is absent after saving.'],
 '`bun codex-out/office/probes.ts notebooks` → direct Markdown-attachment conversion has no assets. Moving exactly the same SVG to display_data creates `a22756674e2f2b56.svg` (112 bytes) and a usable asset link. H1 confirmed; H2/H3 rejected. [Probe log](logs/probes-notebooks.log).',
 '`packages/core/src/ingest/notebook.ts:13,40–45` neither models nor reads attachments; only code outputs at `:51–59` become assets.',
 'Notebook × images (`intake-grid.test.ts:75`) is marked covered by one code-cell plot. Markdown-cell attachments are not covered.')
add('Notebook error outputs and HTML-only results silently disappear','S2','notebooks-error',
 ['Create one code cell containing `1 / 0` and its standard error output: ename, evalue, traceback.','Import it; the saved body contains the code but no explanation of the error.','Independent variant: use show_results() with a text/html-only table containing Improved. Its output also disappears.'],
 'A teaching notebook must retain its demonstrated error and its displayed result (D122). Actual: both output types are silently omitted. These are two standard output encodings, not a long-output truncation or empty code cell.',
 ['If output extraction only accepts stream text, text/plain, and image MIME types, error fields and text/html will be lost while the same content as stream text survives.','If the outputs were rejected by schema/JSON parsing, the direct converter would throw instead of returning code alone.','If the outputs exist until saving, direct conversion will contain them.'],
 '`bun codex-out/office/probes.ts notebooks` → both direct conversions already omit their outputs; replacing only the output representation with stream text preserves ZeroDivisionError / Improved. H1 confirmed; H2/H3 rejected. [Probe log](logs/probes-notebooks.log).',
 '`packages/core/src/ingest/notebook.ts:49` considers only o.text and data[text/plain]; `:51–59` considers only image bundles. Error ename/evalue/traceback and data[text/html] have no conversion path.',
 'Notebook × text/code (`intake-grid.test.ts:75`) are marked covered by Markdown/code/plain-output examples. Tables are n/a, despite HTML tables being ordinary notebook output.',extra='notebooks-html')
add('Notebook outputs are reordered, separating a figure from the explanation that follows it','S2','notebooks-ordered',
 ['Create one code cell with two outputs in order: a PNG figure, then stdout saying AFTER FIGURE.','Import it and compare the image and text positions in doc.md.'],
 'Output order must stay figure → explanation (D122). Actual: explanation → figure. With multiple plots this changes which explanation belongs to which result; the output is not simply folded on screen.',
 ['If all text outputs are collected before image outputs, reversing the original pair will produce the same Markdown.','If asset saving reorders the Markdown, direct notebookToDoc will preserve output order.','If the plot was unreadable, its saved asset will be absent.'],
 '`bun codex-out/office/probes.ts notebooks` → direct conversion already places AFTER FIGURE first; reversing the output array produces the identical body. The PNG is saved (1266 bytes), excluding a decoding failure. H1 confirmed; H2/H3 rejected. [Probe log](logs/probes-notebooks.log).',
 '`packages/core/src/ingest/notebook.ts:49–50` joins every output’s text into one block before `:51–59` appends any images.',
 'Notebook × images/text (`intake-grid.test.ts:75`) do not exercise mixed output order. D199’s folded text presentation cannot restore the order already lost in core.')
add('A Markdown file’s adjacent image is left outside the library','S2','text-relative',
 ['Write diagram.svg beside an .md file containing only `![Diagram](diagram.svg)`.','Import the Markdown file, then inspect its new source folder.'],
 'The existing image must be saved beside doc.md as an asset (D122). Actual: the relative link is unchanged, assets/ has no figure, and diagram.svg does not exist beside the kept source.md. Moving/deleting the external input folder leaves no retained copy of that figure. This is first import of .md, not F568’s reimport of .html.',
 ['If the source-directory context is never used to resolve Markdown images, a relative path will fail while a file:// path to the same bytes will work.','If SVG format or minimum image size causes rejection, the absolute-path control will fail too.','If only persistence is responsible, saveImages with local:true will return the relative image as an asset.'],
 '`bun codex-out/office/probes.ts markdown` → diagram.svg yields no assets; file:// pointing to the same 112-byte file produces `a22756674e2f2b56.svg`. H1 confirmed; H2/H3 rejected. Full CLI import reproduces the unchanged link and empty assets. [Probe log](logs/probes-markdown.log), [CLI log](logs/cli-md.log).',
 '`packages/core/src/ingest/index.ts:227` passes text through markdownFile without resolving image paths against the input path. `packages/core/src/ingest/assets.ts:23,40,69` matches only http(s):// and file:// images and receives no source directory.',
 'Markdown or text file × images is n/a (`intake-grid.test.ts:77`). Local relative images are part of normal Markdown and need a coverage case or named gap.')
add('Word headings set by outline level become ordinary paragraphs','S2','word-outline',
 ['Create one Word paragraph, Chapter one, with w:outlineLvl w:val="0" and no Heading1 style.','Import and read doc.md.'],
 'Outline level 0 should become a level-one heading so the reader can use it as a section (D122). Actual: plain “Chapter one”, with no heading marker. The minimal document has only this paragraph.',
 ['If only named heading styles are handled, changing only the paragraph properties to Heading1 will make the heading appear.','If the Markdown converter strips headings, Mammoth HTML will have h1 while doc.md will not.','If persistence changes it, direct docxToDoc will have a heading.'],
 '`bun codex-out/office/probes.ts word` → outline-level input is already p in Mammoth HTML; Heading1 control becomes `# Chapter one` through the same wrapper. H1 confirmed; H2/H3 rejected. [Probe log](logs/probes-word.log).',
 '`packages/core/src/ingest/office.ts:48–55` relies on Mammoth’s style mappings and adds no outline-level handling; the converter’s HTML has already discarded the heading semantics.',
 'Word × headings (`intake-grid.test.ts:73`) is marked covered by Heading1/Heading2 styles only. Outline-level headings are absent from that guard.')
add('A deck whose only listed slide is missing is accepted as a source','S3','slides-missing',
 ['Keep a PPTX presentation slide id and its relationship, but delete the referenced slide1.xml part.','Import the damaged deck. No other slide remains in its presentation list.'],
 'Refuse the damaged file with a recovery step and save no source (D96). Actual: a new source is saved with an invented Slide 1 heading and no actual slide content. This is the PowerPoint counterpart of a missing required part, not the previously fixed damaged-ZIP error.',
 ['If a missing part reads as an empty string and the generated heading counts as content, even a one-slide deck with that part absent will save.','If the relationship is incorrectly resolved, restoring the part at its expected path will not restore its content.','If the CLI bypasses a converter refusal, direct pptxToDoc will reject the missing part.'],
 '`bun codex-out/office/probes.ts slides` → direct conversion accepts the absent part; restoring only slide1.xml adds “Restored slide”. H1 confirmed; H2/H3 rejected. Reduced from a three-slide deck missing its middle slide to this one missing slide. [Probe log](logs/probes-slides.log).',
 '`packages/core/src/ingest/office.ts:74` treats missing parts as empty; `:88–100` builds a generated heading; `:111–113` checks only whether an iteration added a slide, not whether the slide existed.',
 'PowerPoint × junk (`intake-grid.test.ts:74`) points to an unreadable-type test, not required-part validation. F648 covers damaged Word/parser messaging; it does not cover this successful PPTX partial import.')
add('A workbook silently omits a referenced worksheet that is missing','S3','sheets-missing',
 ['Create a workbook listing two visible sheets. Include sheet1.xml with one text cell, and a relationship to sheet2.xml without that part.','Import and inspect doc.md.'],
 'Refuse the damaged workbook with a next step (D96). Actual: success showing only the first sheet, with no warning that the second is absent. The one real sheet is necessary: with none the existing “no rows” guard would fire.',
 ['If missing sheet XML is treated like an empty sheet, the first sheet will save and only restoring sheet2.xml will make the second appear.','If hidden-sheet filtering causes omission, the second sheet would have to be marked hidden; removing that state should change the result.','If storage truncates the workbook, direct xlsxToDoc will contain both sheet sections.'],
 '`bun codex-out/office/probes.ts sheets` → direct result omits the second visible sheet; it has no hidden state. Supplying only its referenced XML part adds the Missing section and its text. H1 confirmed; H2/H3 rejected. [Probe log](logs/probes-sheets.log).',
 '`packages/core/src/ingest/sheets.ts:106,132` reads an absent worksheet as empty text; `:156–159` ignores it whenever another sheet produced a table.',
 'Spreadsheet × junk (`intake-grid.test.ts:79`) points to a damaged EPUB/Word/PowerPoint test. It does not cover XLSX referenced parts.')
add('OCR helper failures provide no recovery step','S3','ocr-failure',
 ['Use the documented ORE_OCR stand-in to exit 1 with exactly the native helper’s “can\'t open the image” message.','Import a damaged PNG through addSource. The script also verifies that no source is saved.'],
 'Refuse with a next action, such as exporting a valid PNG or pasting the text (D96). Actual: only “can\'t open the image”. There is no blank saved source, so this is an error-handoff defect, not data loss.',
 ['If recognize/scannedText simply propagate subprocess stderr, both the ORE_OCR path and the default recognize branch will expose the same bare message.','If it is only a test-override issue, the default branch using swiftHelper will supply a better error.','If the CLI adds the recovery step, its JSON error will be more helpful than core’s exception.'],
 '`bun codex-out/office/ocr-probes.ts` → the production recognize branch, with only swiftHelper’s binary path replaced by the stand-in, returns the same message. An empty-recognition control does give a paste/add-screenshot next step. CLI --json also returns `{ "error": "can\'t open the image" }`. H1 confirmed; H2/H3 rejected. No Swift compilation or real Vision execution was used. [Probe log](logs/probes-ocr.log), [CLI log](logs/cli-ocr-failure.log).',
 '`packages/core/src/ingest/ocr.ts:19–23,65` propagates run() failures unchanged; only the successful-but-empty result at `:67–68` gets guidance. The native message is in `packages/core/src/ingest/swift/ocr.swift:89`; `swift.ts:51` constructs the Error from stderr.',
 'Image/screenshot × junk (`intake-grid.test.ts:81`) tests recognition returning no text, not a helper that exits nonzero.')

intro='''# Office reading scout — deep scan 5

Covered the document/slide/spreadsheet/notebook/RTF/Markdown import converters, their integration through addSource and CLI --json, saved doc.md, assets and kept originals, and OCR refusal paths with headless stand-ins. Read the project agreements, spec, relevant decisions (D96/D122/D199), findings registry, sweep history and the four prior scans’ reports; no known row is re-reported. Stayed off EPUB and highlight animations, earlier web/PDF/audio ground, app/browser/server/e2e/bench work, real AI, and native Swift/Vision execution. Unexercised boundaries are listed below. Only codex-out/office/ was written; no fixes or registry edits. Tested checkout: `05c68297d33d46d6b17b404c101543bc9dfd9557`, Bun 1.4.4, macOS arm64, 2026-11-24 local time.

15 findings: 2 S1, 10 S2, 3 S3. S1 marks wrong saved text/table meaning; S2 omissions remain recoverable from the kept original unless the external image was never copied. No original input was deleted by these probes. Both means the faulty source can be read on Mac and synced iPhone; these runs exercise core on the Mac, not a phone or native window.

## Reproduction contract

Run each command from the repository root. Each script imports the actual core code, creates/resets only its own `codex-out/office/libs/<case>/` scratch library, saves a generated input in `inputs/`, imports it, rereads doc.md from disk, and asserts the exact symptom. All use fake claude/codex executables first on PATH, ORE_NO_ENRICH=1, blocked fetch, and TMPDIR inside this folder. Verdicts do not depend on clock or random IDs; only generated item IDs/timestamps vary. Every red case below failed in **3/3 final runs**; complete logs record exit 1 and wall time. Processes ran sequentially, each well under a second; the repeat runner enforces a 25-second CPU/wall limit. The normal CLI was also run separately for DOCX, PPTX, XLSX, IPYNB, RTF, Markdown and CSV, with --json --no-enrich and a distinct scratch library per type; [CLI runner](cli-check.py) and logs hold commands, JSON, on-disk doc.md and original equality checks. OCR used explicit fault injection, described in its finding.

ZIP fixtures are derived from Ore-authored existing fixtures and changed only inside this folder. Small raw RTF, Markdown, SVG and notebook examples are authored here. The two intentionally damaged packages test refusal, not file-format fidelity. Kept originals matched the generated input bytes in all findings that save a source. The separate encoding controls show that text originals are transcoded; see Leads.

## Findings
'''
blocks=[intro]
repeat=json.loads((r/'logs/repetitions.json').read_text())
for i,f in enumerate(findings,1):
 id=f'office-{i:02d}'; case=f['case'];logfile=r/'logs'/f'{case}-run1.log'
 lines=logfile.read_text().splitlines()
 command=lines[0].removeprefix('$ ')
 output='\n'.join(lines[1:])
 times=[x['ms'] for x in repeat if x['case']==case]
 if not times:
  import re
  times=[int(re.search(r'elapsed_ms=(\d+)',(r/'logs'/f'{case}-run{k}.log').read_text())[1]) for k in (1,2,3)]
 b=f'\n### {id} — {f["title"]}\n\n**{f["severity"]} · '+('Mac (OCR helper handoff)' if case=='ocr-failure' else 'Both (Mac import; the saved source is shared)')+'**\n\n'
 b+='**Red command and output:**\n\n```sh\n'+command+'\n```\n\n```text\n'+output+'\n```\n\n'
 b+='**Minimized steps:**\n\n'+'\n'.join(f'{j}. {s}' for j,s in enumerate(f['steps'],1))+'\n\n'
 b+='**Expected vs actual:** '+f['expected']+'\n\n'
 b+='**Repetition:** 3/3 failures on the final case; '+', '.join(str(t)+' ms' for t in times)+'. [Run 1](logs/'+case+'-run1.log), [run 2](logs/'+case+'-run2.log), [run 3](logs/'+case+'-run3.log).\n\n'
 if f['extra']:
  e=f['extra']; extra=(r/'logs'/f'{e}-run1.log').read_text();b+='**Second red encoding:**\n\n```text\n'+extra.strip()+'\n```\n\nThe HTML variant also failed 3/3: [runs](logs/'+e+'-run1.log).\n\n'
 b+='**Ranked, falsifiable hypotheses:**\n\n'+'\n'.join(f'{j}. {h}' for j,h in enumerate(f['hypotheses'],1))+'\n\n'
 b+='**Measurements:** '+f['probes']+'\n\n**Cause:** '+f['cause']+'\n\n**Coverage gap:** '+f['grid']+'\n'
 blocks.append(b)
blocks.append('''
## Leads and explicit limits

- Office core properties hold dates, but coreProps only returns title/author (`office.ts:25–29`). No red assertion yet chooses the correct created/modified-to-published policy, so this is a lead rather than another finding.
- Text originals are decoded/transcoded on import (`index.ts:211–227`): UTF-16, CP1252 and BOM controls read correctly but source.txt is not byte-identical. No separate red loop asserts the intended original-byte contract; see [encoding controls](logs/controls-text.log).
- Notebook nbformat 3 is not converted (code reads only nb.cells); no minimized semantic/refusal assertion was run. The v3 branch in notebooks.ts is an unexecuted exploratory helper, not evidence.
- Notebook outputs beyond 2,000 characters are cut by an explicit implementation policy (`notebook.ts:16–17,50`). No learner-specific red case was built to distinguish intended log trimming from loss of instructional results.
- Word footnotes/endnotes, text boxes, floating/EMF/WMF images, duplicated Word images, custom-style inheritance and deeply nested numbered lists were not exhaustively exercised. The targeted tracked-change case passes; it does not claim every tracked-change shape works.
- Hidden-slide semantics, grouped graphics/charts, slide hyperlinks and more XML namespace/quoting variants remain untested; table-only slides and repeated pictures are covered above.
- Spreadsheet merged regions and malformed CSV quotes remain untested. The bounded 5,001-row CSV refusal passed; no large-memory or performance stress was attempted.
- OCR helper compilation/missing compiler, native HEIC/TIFF decoding, huge-image OCR and concurrent multi-image imports were not run. F188/F192 are already recorded; no new claim is made about those paths. Empty text, failed helper, malformed helper JSON and an off-Mac platform branch were exercised headlessly. Malformed JSON gives a raw TypeError but saves nothing; the real helper’s output-schema reliability was not challenged.
- tab.ts was read but its browser/AppleScript flow was not run under the scout restrictions. No screenshot/UI rendering claim rests on a real window.

## What passed

- `bun test packages/core/test/intake-grid.test.ts`: 2 pass, 0 fail, 118 ms in the recorded run. This checks that named tests exist, not that they cover the demonstrated variants. [Log](logs/intake-grid.log).
- Word inserted/deleted runs: only the inserted answer survives; the first exploratory assertion mistakenly looked for unescaped underscores, was corrected, and the final control passes. [Log](logs/word-tracked.log).
- Existing Word comment/code fixture: comment text and indented fenced code survive; existing inline Word image fixture produces an asset. [Log](logs/controls-office.log).
- RTF’s existing fixture retains title, author, created date, footnote marker and PNG asset. Windows-1252 literal bytes and Windows-1251 hex escapes decode correctly. [Controls](logs/controls-office.log), [encoding probes](logs/probes-rtf.log).
- Markdown frontmatter takes priority over filename and H1 for the title; author/date survive, frontmatter leaves the body, and wiki-link/code/math source text remains unchanged. This is textual retention, not a claim that wiki links resolve or math renders. [Log](logs/text-metadata.log).
- UTF-16LE BOM, Windows-1252 and UTF-8 BOM/CRLF text all preserve Café déjà vu and the H1-derived title; see the original-transcoding lead. [Log](logs/controls-text.log).
- CSV semicolons/BOM/CRLF, quoted delimiters, TSV embedded newlines and escaped quotes all preserve cell content. 5,001 nonempty rows are refused with the next step. [Log](logs/controls-text.log).
- Cached Excel formula results survive. A 0.5-day clock renders 12:00 and the elapsed-duration control renders 36:00 for 1.5 days. Restoring a missing worksheet adds its section. [Log](logs/probes-sheets.log).
- PowerPoint follows presentation relationship order rather than filename order and retains notes with their corresponding slides. [Log](logs/slides-order.log).
- Repeated images on two slides retain two references/one asset; identical bytes under three separate media paths retain three references/one deduplicated asset. [Log](logs/probes-slide-repeated.log).
- Notebook cell source as a string or array produces the same Markdown/code. PNG plot and SVG output decoding/save paths work; ordinary stream outputs survive. [Controls](logs/controls-office.log), [probes](logs/probes-notebooks.log).
- Pages, Keynote, Numbers and old Word .doc all refuse with actionable export/save guidance. Corrupt DOCX/PPTX/XLSX refuse with download/save guidance and leave no items. [Log](logs/controls-refusals.log).
- OCR empty recognition, helper failure and malformed helper output leave no saved source; off-Mac recognition refuses with a paste next step. Native decoding was not run. [Log](logs/controls-ocr.log).
- CLI success is not a converter-test artifact: seven type-specific adds completed with --json; the on-disk failures for DOCX/PPTX/XLSX/IPYNB/RTF/Markdown match core, while CSV is intact. Kept originals match those seven supplied inputs. [CLI runner](cli-check.py).

## Handoff

The report stops at diagnosis. No product code, tracked test, findings registry, decision, commit, or push was changed. All retained artifacts are under this folder. `repeat.py` runs 15 red cases for 14 findings (HTML/error variants count separately); `slide-repeated.ts` is the sixteenth case and fifteenth finding. Each listed red command can be run on its own. Do not run these scratch libraries against a real Ore library.
''')
(r/'report.md').write_text(''.join(blocks))
print('Wrote',r/'report.md','with',len(findings),'findings')
