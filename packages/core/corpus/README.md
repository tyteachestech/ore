# Import corpus

Many real files of every kind, imported the way Ore imports them and each held against its original, so a
change to any import shows up on files no fixture covers (D122). The fixtures in `test/fixtures/intake/` and
the goldens test one sample per hazard; this tests breadth: many publishers, many kinds of PDF.

```bash
bun run corpus                        # the open corpus (open.json), fetched once into .corpus/cache
bun run corpus ~/Calibre\ Library     # every file under his own folders, read only
bun run corpus --accept               # save this run as the one later runs compare against
bun run corpus --resume               # go on with a run that stopped
# --jobs 2  --only epub,pdf  --per 40 (a sample spread through each kind)  --timeout 600  --out <dir>
bun packages/core/corpus/lost.ts <original> <doc.md>   # what a doc.md dropped, longest runs first
```

Each file is imported in its own process into a scratch library under the temp folder, deleted after. Nothing
is written beside the files.

## Two corpora
- **Open** (`open.json`): openly licensed files by link and sha256 (IDPF samples, Standard Ebooks, arXiv,
  Apache POI's Office test files, notebooks). Its accepted run is `open-baseline/` in the repo, so a PR shows
  what an import change did to it. A link whose bytes changed fails with its new hash: check it and re-pin.
- **Private**: his own folders. Copyrighted, never committed: results, docs and the baseline stay in
  `.corpus/` (gitignored). Files whose path names them as his business (tax, bank, medical, résumé, lease…:
  `PERSONAL` in `run.ts`) are left out by name.

## What it reports
For each file, what changed since the accepted run (title, author, headings, code, tables, formulas, pictures,
first and last words) and its new flags (`audit.ts`): junk in the text (mojibake, HTML or entities left in,
words split at line ends, repeated lines), a broken outline, and, read against the original's own bytes
(`original.ts`, not through Ore's import): text lost, text added, order changed, headings, tables, formulas or
pictures lost. A flag is a lead, not a bug: read the doc.md (and `lost.ts`) first. Known false leads: long
chapter titles, a math paper's formulas counted as lost text, a figure's word labels read as cut paragraphs.

A bug it finds is fixed like any other: a small fixture and a failing test first, a `findings.md` row.
