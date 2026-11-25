# Retained-original regressions (deep scan 5)

All new text is written for Ore, except the public-domain Japanese sentence already used by the F38 test.

- `deck-root-notes.pptx`: Ore's existing `deck.pptx`, with slide 1's notes relationship changed from `../notesSlides/notesSlide1.xml` to `/ppt/notesSlides/notesSlide1.xml`. All ZIP member contents except that relationship are unchanged.
- `deck-root-pictures.pptx`: Ore's existing `deck-pictures.pptx`, with slide image relationships made package-root paths. Pictures, words and positions are unchanged.
- `shift-jis.html`: the F38 Japanese title and public-domain sentence, encoded as Shift_JIS with a matching meta declaration. No images or code; the body repeats the sentence so the page reader has enough text.
- `utf16.csv` and `utf16.md`: short original study notes, encoded as UTF-16LE with a byte-order mark.
- `bom-notebook.ipynb`: the existing Ore `numpy.ipynb` fixture with a UTF-8 byte-order mark prepended.

The notes relationship variant must read identically to `deck.pptx`, whose full document is already guarded by `golden/powerpoint.md`. Encoding variants change only the kept bytes, not the normalized document contract.
