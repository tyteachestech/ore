Your name is `notes`. First read `codex-out/preamble.md` and follow it.

Your ports: Mac app page http://localhost:1747/ with `window.__ORE_BRIDGE = 1748` (library `/Users/tylerpoelking/Developer/ore-wt/sweep5/codex-out/libs/notes`); iPhone app http://localhost:1749/ (its seed is a copy at `/Users/tylerpoelking/Developer/ore-wt/sweep5/codex-out/libs/notes-phone`; the page's writes stay in IndexedDB). WebKit server: `ws://[::1]:1759/`. The `ore` CLI: `ORE_LIBRARY=/Users/tylerpoelking/Developer/ore-wt/sweep5/codex-out/libs/notes bun packages/cli/src/ore.ts`.
Your library is seeded with `seed.ts`.

## Your focus: notes as he writes them, and what reaches the disk
The note editor (D38, `apps/desktop/src/editor/`, `preserve.ts`) is where he thinks in his own words; the file on disk is canonical. Sweep UX parity (2026-11-10) checked its keys against Notion; this run checks what he writes survives.
1. **Real writing.** Write a 2,000-word note over twenty minutes in bursts, with headings, lists nested four deep, todos, callouts, toggles, a table, code, math, links to other notes (D39) and a diagram (D103). Close and reopen after each burst and diff the Markdown on disk against what you meant.
2. **Paste.** From a web page (rich HTML with styles), Google Docs, Notion, Word, Apple Notes, a Markdown file, a spreadsheet (TSV), a code editor, and plain text with tabs. Does each keep its structure and drop junk (inline styles, empty spans, `&nbsp;`)?
3. **Round-trips.** Edit the note's file outside the app (another editor, `ore`, Obsidian-style Markdown: wiki links, front matter, HTML comments, footnotes, a hard line break) while it is open and while it is closed. Do lines he did not touch stay byte for byte (`preserve.ts`), and does his next keystroke in the app keep the outside edit?
4. **Links and backlinks.** Rename and delete a linked note, link to a heading, a link with odd characters, a link to itself, a hundred links in one note. Does every backlink list stay right?
5. **Undo across all of it.** ⌘Z and ⇧⌘Z after a paste, a block move, a table edit, a diagram edit, an outside merge.
On the iPhone: write, paste and edit the same note, and check the file the Mac sees.
