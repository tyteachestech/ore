Your name is `languages`. First read `codex-out/preamble.md` and follow it.

Your ports: Mac app page http://localhost:1733/ with `window.__ORE_BRIDGE = 1734` (library `/Users/tylerpoelking/Developer/ore-wt/sweep4/codex-out/libs/languages`); iPhone app http://localhost:1735/ (its seed is a copy at `/Users/tylerpoelking/Developer/ore-wt/sweep4/codex-out/libs/languages-phone`; the page's writes stay in IndexedDB). WebKit server: `ws://[::1]:1739/`. The `ore` CLI: `ORE_LIBRARY=/Users/tylerpoelking/Developer/ore-wt/sweep4/codex-out/libs/languages bun packages/cli/src/ore.ts`.
Your library is seeded with `seed.ts`.

## Your focus: learning in other languages and scripts
Ore is for anyone learning anything, including a language. Sweep 3 tried odd names; no one has read, highlighted and reviewed sources in other scripts. Make fixtures in `codex-out/languages/fixtures/` (write the text yourself or use openly licensed text, such as Wikipedia): Japanese (kanji, kana, ruby), Chinese, Korean, Arabic and Hebrew (right to left, mixed with English and numbers), Hindi (Devanagari), Thai (no spaces between words), Vietnamese and Greek with combining accents, and a page with emoji and math.
1. **Import.** Add each as a web page, an `.md`, a `.pdf` and an `.epub`. Title, author, headings and every phrase from start to end come in whole (D122), with the page's language and direction kept?
2. **Reading.** Is each laid out right: line breaks, RTL paragraphs and lists, punctuation at the line ends, the font chosen for the script, no boxes for missing glyphs?
3. **Highlighting.** Drag-select, double-click a word (Thai and Japanese have no spaces), highlight across a line break and across an RTL/LTR boundary. Reopen and edit the source: does each highlight stay on its text (anchoring)?
4. **Search and Find.** Search the library and ⌘F inside a source for a word in each script, with and without accents and in hiragana vs katakana. What is found and what is missed?
5. **Exercises and review.** Write an exercise in each language by hand (question and answer), review it, and type an answer with an input method (Japanese IME composing: Enter must confirm the word, not submit the answer). Sorting and names of skills in each script.
On the iPhone too: reading, highlighting by long-press, and typing an answer with a non-English keyboard.
