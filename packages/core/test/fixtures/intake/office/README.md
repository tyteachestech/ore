# Office regression fixtures (deep scan 5)

These examples were written for Ore. The Word, PowerPoint and Excel packages derive
from Ore's `files/notes.docx`, `files/deck.pptx` and `files/vocab.xlsx`; their changed
parts and raw notebook/RTF/Markdown examples were authored by the office scout.
No third-party document text was copied.

The original generators and assertions are preserved in
`docs/reviews/2026-11-25-codex-deep-scan-5/red/office/`:

- `word.ts`: merged table, equation, outline heading.
- `rtf.ts`: literal Windows-1251 bytes spelling Привет.
- `slides.ts`: native table and intentionally missing slide.
- `sheets.ts`: uncached formula, clock/duration and intentionally missing worksheet.
- `notebooks.ts`: SVG attachment, exception, HTML table and ordered plot/stdout.
- `text.ts`: Markdown and its adjacent `diagram.svg`.
- `ocr-failure.ts`: intentionally incomplete PNG; `ocr-failure.sh` reproduces the
  native helper's failure without calling Vision.

Additional Ore-authored variants:

- `word-outline-after-plain.docx`: `word-outline.docx` with an ordinary paragraph
  whose properties element is self-closing before the outlined paragraph.
- `notebook-cell-attachments.ipynb`: reference-style Markdown, a literal code
  example and two cells whose identically named attachments have different content.
- `text-reference.md`: a reference-style image with a title and literal examples
  in inline and fenced code.

Success cases are checked through `addSource` in `intake.test.ts` and as whole
`doc.md` files in `golden.test.ts`. Damaged/unsupported cases must leave no source.
