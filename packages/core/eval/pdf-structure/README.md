# PDF tables and formulas: the scorer behind D125

How well a PDF reader gets a paper's display formulas and tables, against the paper's own LaTeX as
ar5iv renders it. Used for the 2026-11-06 bake-off (Docling: formulas 95, tables 77; with pdf.js cell
text 81; plain pdf.js 0 and 0) and to score any new reader the same way. Run by hand; nothing here runs in CI.

Only the scripts live here. The papers and keys are fetched when it is run, so nothing of theirs is in the repo.

1. In a scratch folder, download each paper's PDF from arXiv and its ar5iv page
   (`https://ar5iv.labs.arxiv.org/html/<id>`) as `<name>.pdf` and `<name>.html`:
   `attention` 1706.03762, `bert` 1810.04805, `resnet` 1512.03385, `vae` 1312.6114.
2. `node keys.cjs` there (needs Playwright) writes `<name>.keys.json`: each display equation's LaTeX and
   each table's cells. Move them to `keys/`.
3. Have the reader under test write `out/<name>.<kind>.md`: tables as Markdown pipe tables or HTML,
   formulas as `$$…$$`.
4. `python3 score.py keys out <kind>[,<kind>]` prints, per paper and overall, the mean best match of each
   key formula (0 to 100, LaTeX spelling normalised) and the mean best cell F1 of each key table.

`pages/` holds five pages whose answers are known from their own sources, for when the papers aren't at hand
(the 2026-11-14 rescore, D-new-granite-docling): `bench-a`, `bench-b`, `inline-math` and `dense` as Typst
sources (compile with the `typst` Python wheel, Apache-2.0), plus the intake fixture `tables.pdf`, each with
its `.keys.json`. Score Ore's own doc.md for each (pdf.js text with the reader's regions swapped in) by running
`regionsFrom` and `pdfToDoc` on the reader's JSON.
