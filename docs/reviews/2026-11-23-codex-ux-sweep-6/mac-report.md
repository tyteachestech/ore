# Mac UX sweep — round 6

Tested the supplied release build at `http://localhost:1761/`, bridge `1762`, in the supplied WebKit browser at 1280×800 with 2× screenshots, against source revision `a47f392c679094e00268f7744fbb856867694999`. Completed two learner journeys, each starting on a fresh page: add three different source kinds, read and highlight, save a highlight note and source note, ask the tutor, create a skill and file all three sources, finish with recall, review due exercises, open Settings, navigate through ⌘K, and leave and return to saved work. Then checked the strongest observations against the app code and confirmed the one reportable finding in two further fresh-page runs. Read the working agreements, daily-session design, findings registry, sweep history, and earlier Mac reports. Skipped their detailed already-passed paths, the expressly excluded rows, pending-save Undo, iPhone, visual taste, real AI, and native OS integration. No artificial failures or slow responses were needed. Only `codex-out/mac/` contains tester-written artifacts; scratch-library changes went through the app. No repository source or documentation was changed.

A fresh page does **not** reset the scratch library. Each journey had new source text and a new skill; the second retained the first journey's saved library. One context and one page were open at a time.

## Findings

### MAC-1 — Slides, spreadsheets, notebooks and RTF documents are all labeled “Article”

**S2 · Mac · reproduced in both import journeys and 2/2 dedicated fresh-page confirmation runs.** The Kind filter also treats all four formats as articles, so it cannot help a learner find the slide deck or spreadsheet they just added.

1. From a fresh page, press ⌘O and select `packages/core/test/fixtures/intake/files/deck.pptx`. In this harness, set `window.__ORE_PICK` to that absolute path before pressing ⌘O. The app imports **How memory works**.
2. Repeat with `verbs.csv` in the same fixture folder. The app imports **verbs**. Both additions run through the real CLI.
3. Open **All sources** → **To read**. Look at each source's kind label.
4. Open **Filter** → **Kind**. Look for the kinds of files just imported, then select **Article**.
5. Open the deck and CSV to check that the former really contains slides and has `source.pptx`/an Original tab, and the latter contains its table and has `source.csv`.
6. Close the page and repeat steps 3–5 from a fresh page. The second learner journey also added `plot.ipynb` (**Plotting recall**) and `textedit.rtf` (**Notes on retrieval practice**); they behave identically.

**Expected:** User-facing kind labels identify the material accurately, and the Kind filter uses those same meaningful kinds. A PowerPoint deck should not be presented as an article.

**Actual:** All four imported files show **Article**, both in All sources and their skill's list. The confirmation library's Kind menu offers only **Article (5)** and **Text (3)** in To read. Selecting Article returns the four imported files together with the seeded lecture. There is no Slides, Spreadsheet or Notebook choice. Their contents and originals remain readable: this is misleading classification and impaired finding, not lost import content.

**Evidence:** [first kind menu](confirmed-kind-menu-1.png), [second kind menu](confirmed-kind-menu-2.png), [first Article results](confirmed-article-filter-1.png), [second Article results](confirmed-article-filter-2.png), [deck and Original tab](slides-original.png), [CSV reader](j1-csv-open.png), [notebook reader](j2-notebook.png), [saved library evidence](library-evidence.json), [bounded confirmation script](confirm-kinds.cjs), [run 1 state](confirmed-kind-1.json), [run 2 state](confirmed-kind-2.json).

**Code:** `packages/core/src/ingest/index.ts:188`, **192**, **197**, and **201** save PPTX, RTF, CSV and notebooks respectively with `type: "article"`. `apps/desktop/src/filters.ts:17–18` translates that directly to “Article”; **26–28** and **35–39** build filter choices from the same stored type. `apps/desktop/src/App.tsx:2234` and **2247** display it on rows. The retained original still identifies the actual file format, but these labels and filters do not use it. This is production import/display logic, not the mock's file-picker behavior. D286 gives Kind filtering the purpose of finding sources without remembering their titles; D122's common Markdown representation does not require calling every imported format an article.

## Known rows seen come back

None confirmed. MAC-1 is distinct from F217, which corrected “Document” versus “Text” for Markdown. No recurrence is claimed for that fix or the excluded findings.

## What passed

- Journey 1 added plain text, PowerPoint and CSV; journey 2 added plain text, RTF and a notebook. All six were saved and filed under the intended newly created skill.
- Both text sources accepted a sentence highlight, a highlight note and a source note; their saved text, annotations and filing survived navigation and reopening.
- Both Finish flows saved free recall into the source note and allowed Done despite unavailable AI feedback.
- Both tutor questions ended with a visible error and Try again, leaving the message field usable; no AI answer quality is claimed.
- The deck retained headings, nested bullets and speaker notes; Original rendered, advanced to slide 3 and returned to slide 2.
- The CSV rendered as a table; the notebook displayed code, an Output section and its saved plot.
- Each new skill's list immediately reflected all three filed sources; source rows opened on one click.
- The first review saved **one** rating, then left through the end screen; the second saved the **four** remaining due ratings, including an Explain with manual key-point marking after grading failed and a New exercise. Verified in the saved review log.
- Both review endings returned to Home, which reflected the saved minutes; the second session reached the no-more-due ending.
- Settings opened with ⌘, and closed with Esc in both journeys; ⌘K found and opened the newly imported sources.
- A source note was reopened, edited again, saved, and reopened with the new wording and its Recall section retained.
- A new skill's Start → Save as first draft kept its warm-up writing in the skill note.
- No page errors were recorded.

## Observations checked but not reported

- Recently imported sources said “Writing prequestions…” while background enrichment was disabled. The bridge intentionally sets `ORE_NO_ENRICH=1` (`apps/desktop/scripts/mock/bridge.ts:44`), and the reader has bounded waiting/recovery logic (`Reader.tsx:1158`, **1181** onward). This run does not establish a production indefinite wait.
- A rating key sent 150 ms after revealing an answer was ignored. `Review.tsx:1091` explicitly rejects keys during the first 300 ms after reveal. The script was corrected to wait; the saved counts above exclude that attempted rating. This is not reported as a dead control.
- File imports made while another source was open kept that source visible and offered **Show** in the success toast. The files were present in the list and opened normally; no missing import is claimed.
- Exact accessible-name selectors failed for some controls whose full names differ from their visible labels. The corrected selectors and pointer/keyboard actions worked. Those automation timeouts are not app findings.

## Artifacts and limits

[actions.log](actions.log) records both journeys and the confirmation work. [driver.cjs](driver.cjs) connects to the supplied browser, loads the bridge init script before `tauri.js`, and opens one context. Run it with `node codex-out/mac/driver.cjs` from the repository root in a terminal. The `.cjs` snippets run inside that driver's scope; their first lines explain invocation. `quit` closes the owned context and disconnects. The driver is bounded to 180 commands or 30 minutes.

The file picker was represented by `__ORE_PICK`; Finder's native UI was not tested. No server, watcher or browser process was launched or stopped. No real library, installed app, other tester's folder or port was used. Git status still contains only the pre-existing untracked `docs/reviews/2026-11-23-codex-ux-sweep-6/` folder; tester output is ignored by Git. No fix, commit or push was made, as this was findings-only work.
