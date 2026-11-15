Your name is `reimport`.

Your ports: Mac app page http://localhost:{{mac}}/ with `window.__ORE_BRIDGE = {{bridge}}` (library `{{library}}`); iPhone app http://localhost:{{phone}}/ (its seed is a copy at `{{phoneLibrary}}`; the page's writes stay in IndexedDB). WebKit server: `{{webkit}}`. The `ore` CLI: `ORE_LIBRARY={{library}} bun packages/cli/src/ore.ts`. Write everything to `{{out}}/` and the report to `{{out}}/report.md`.
Your library is seeded with `seed.ts`.

Read `docs/reviews/sweeps.md` first: it lists every earlier tester's angle. Yours is new ground.

## Your focus: reimport, and the kept original
Ore keeps every source's original so a better reader can import it again (D122, D96). When it does, his highlights, Key points, notes, questions and exercises must stay on the same words, or say plainly which could not. Read `CLAUDE.md`'s core promise, `docs/SPEC.md` (sources, anchoring, reimport), grep `docs/DECISIONS.md` for reimport, original, anchor; read `packages/core/src/anchor*`, the reimport code in `packages/core/src` and the CLI's reimport command, `apps/desktop/src/OriginalPage.tsx` and `OriginalSlides.tsx`.
1. **Reimport with his work on it.** Take sources of each kind you can make offline (Markdown, HTML page saved to a file, PDF, EPUB, DOCX, PPTX, a notebook, a transcript; reuse `packages/core/test/fixtures/intake/`), add them through the app, then highlight (incl. Key points, a highlight with a note, one over a table, one over code, one over a formula), write a source note, a question, and an exercise from a Key point. Reimport each from the app (and `ore reimport` if it exists). Then: is every highlight on the same words (read the files on disk before and after), its note and exercise still tied to it, and is anything that moved or was lost shown to him, not silently dropped or moved to other words?
2. **The original changed.** Edit the kept original before reimport: a paragraph inserted above a highlight, the highlighted sentence reworded, deleted, moved, duplicated; a heading renamed; a table row added. What does each highlight do, and does the screen tell him which ones it couldn't place?
3. **Reimport refused or failing.** The original deleted (F5 is known: skip that message only), unreadable, a different file type, `__ORE_FAIL` on the reimport, a reimport while the source is open and he is typing a note, a reimport then ⌘Z.
4. **The original view.** Open the original page and slides views for a PDF, a deck and a web page: do they match doc.md, can he find his highlight's place in them, and switch back to the same place?
5. **iPhone.** Open the reimported sources on the phone copy (reload from the library only if the phone supports that): highlights in place, nothing doubled.
Report lost or moved work first (S1).
