# PDF page reader: boxes first

The comparison behind D-new-boxes-first (2026-11-27): the reading model on every block (D346 as built) against the reading model only on tables, formulas, scanned pages and captions with no text of their own. The driver that shipped (`DRIVER` in `packages/core/src/ingest/paddle.ts`) decides per block: plain text is read only where the PDF has no words in its box.

- `boxes_first.py` reads PDFs page by page in either mode (`all`, `boxes`) and writes the driver's pages JSON with seconds and model calls per page.
- `layout_only.py` times PP-DocLayoutV3 alone on a CPU.
- `compare.py` compares two folders of pages JSON.

Run on Tyler's M4 Pro on the 20 bake-off PDFs (99 pages), one mode after the other, nothing else running. Scored through `regionsFrom` and `pdfToDoc` with the bake-off's `score.py` (`/mnt/project-files/pdf-race/`).

| | Every block | Boxes first |
|---|---|---|
| Words found / clean / headings / tables / math | 96 / 92 / 87 / 77 / 38 | 96 / 92 / 87 / 77 / 38 |
| Boxes the same | | 1,200 of 1,200 |
| Sources the same to the letter | | 17 of 20 |
| Model calls, 16 PDFs with text | 924 | 15 |
| Seconds a page, 16 PDFs with text | 6.27 | 1.63 |
| Seconds, all 99 pages with the model's load | 622 | 267 |
| The 4 scans | the same calls and time | |

The three sources that differ do so by a few lines of spacing: the reading model returned nothing for 20 paragraphs, whose boxes were then dropped, and boxes first keeps them. The layout model alone took 3.1 s a page on a 4 vCPU Linux box, where reading every block took 46.7 s (`docs/research/ore-cloud-spike.md`, on its branch).

The pages from both runs: `/mnt/project-files/pdf-race/layout-only/mac-run/`.
