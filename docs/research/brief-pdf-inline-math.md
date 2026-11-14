# PDF inline math: does Granite-Docling read it?

A test of Granite-Docling (`ibm-granite/granite-docling-258M`) for the open gap "inline math stays plain text" (D125, F-new-pdf-inline-math). 2026-11-13, on Tyler's Mac (M4 Pro, 24 GB), Docling 2.142.0 (the version Ore pins), everything in a scratch folder.

## The short version

No. Its model card advertises inline equations, but on three test pages it never marked a single inline formula. Inside sentences it writes plain text, sprinkled with `$^{2}$` or `$_{b}$` scraps that are sometimes wrong (the fraction a/b came out as "a $_{b}$"), and those scraps carry no position on the page, so Ore couldn't place them over pdf.js's prose even if they were right. Nothing was built.

It did match the current pipeline on display formulas and tables, at about a fifth of the time, and its weights are Apache-2.0. That makes it a candidate for a separate change (option 3 below), not a fix for inline math.

## The pages

- `inline-math.pdf`: written for this test and typeset with Typst (Apache-2.0, the `typst` Python wheel). It has a heading, prose with eight inline formulas (`x`, `x^2`, `alpha + beta`, `a/b` set as a stacked fraction, `a <= b`, `2^(-n)`, `a x^2 + b x + c = 0`, `b^2 - 4ac`), one display formula (the quadratic formula) and a 3×4 table.
- `dense.pdf`: written for this test. A lemma and its proof, set like a math paper, with about thirty inline formulas (derivatives, `e^(-lambda t)`, limits, sums, integrals) and one numbered display formula.
- The intake fixtures `tables.pdf` (a table, a display formula, and the inline symbols `t` and `S`) and `paper.pdf`.

A first try that printed KaTeX through Chrome was dropped: Chrome writes the math glyphs after the page's other text, so pdf.js read the formulas out of order. That would have been a test of Chrome, not of the reader.

## What came out

| | Standard pipeline + CodeFormulaV2 (Ore today) | Granite-Docling, VLM pipeline (MLX) |
|---|---|---|
| Inline formulas tagged | none | none |
| Inline text, `x^2` | `𝑥2` | `x $^{2}$` |
| Inline text, `a/b` (stacked) | `𝑎𝑏` | `a $_{b}$` (wrong) |
| Inline text, `e^(-lambda t)` | `𝑒-𝜆𝑡` | `e - λ t` |
| Inline text, `t_(1/2)` | `𝑡1/2` | `t$_{1}$$_{/}$$_{2}$` |
| Display formula | `x = \frac { - b \pm \sqrt { b ^ { 2 } - 4 a c } } { 2 a }` | the same LaTeX |
| `tables.pdf` formula | `R ( t ) = e ^ { - t / S } , \quad S _ { n + 1 } = …` | the same |
| Tables (both pages) | right, cell for cell | right, cell for cell (`paper.pdf`'s small grid split into paragraphs in both) |
| Equation number `(1)` | kept | dropped |
| Time, warm, 2 pages | 63 s (about 30 s a page; the formula model runs on the CPU) | 13 s, with the model load included (about 4 to 6 s a page) |
| Peak memory | 1.7 GB | 1.75 GB |
| Download | layout 172 MB + TableFormer 358 MB + CodeFormulaV2 631 MB, plus Docling's Python (about 1 GB) | 631 MB MLX weights (or 515 MB for the transformers weights), with the same Python plus `mlx` and `mlx-vlm` (MIT) |

The full transformers weights, which aren't the MLX conversion, gave the same text, so this isn't an MLX conversion fault. They ran at 53 to 73 s a page, with a peak of 1.8 GB. Docling's DocTags have an `<inline>` group for formulas inside text, but the model never emitted one on these pages.

## Licences

| Part | Licence |
|---|---|
| Docling 2.142.0 | MIT |
| granite-docling-258M and its `-mlx` variant | Apache-2.0 |
| mlx, mlx-vlm | MIT |
| transformers | Apache-2.0 |
| docling-layout-heron | Apache-2.0 |
| CodeFormulaV2 (used today) | CDLA-Permissive-2.0 |
| docling-models, TableFormer (used today) | CDLA-Permissive-2.0 |
| Typst (only to make the test pages) | Apache-2.0 |

CDLA-Permissive-2.0 is a permissive data licence, but D120's list doesn't name it. So today's download already includes two sets of weights the rule doesn't cover (F-new-docling-model-license).

## Options

1. **Keep the gap open.** It costs nothing, and the intake grid stays honest.
2. **Read inline math from pdf.js's own glyphs.** pdf.js already knows the math fonts and the raised and lowered glyphs (it writes powers today). A run of math-font items inside a line would become `$$…$$` (the reader's inline math, since `singleDollarTextMath` is off), with `^{}` and `_{}` built from the glyphs' heights. It needs no model, and it works on the iPhone. Simple formulas would come out right. Stacked fractions, roots and integral limits would not without more work. It rewrites the prose itself, so a highlight across a formula has to be re-anchored, which D125 avoided for display formulas. It's a medium-sized change. Mock and score it on the D125 bake-off papers first.
3. **Granite-Docling in place of the standard pipeline**, for display formulas and tables only. It's about 5× faster and needs half the download, and all its weights are Apache-2.0, which settles F-new-docling-model-license. Before switching, it needs D125's bake-off rescored (formulas 95%, tables 81%). Its boxes sit on a 500-step grid, about 1.6 pt on a Letter page, coarse but enough for `swapRegions`. It doesn't help inline math.

## Found along the way

pdf.js drops some powers and indices from the prose. `a x^2 + b x` reads as `𝑎𝑥 + 𝑏𝑥` (its raised `2` is followed by a raised space), and `lambda_i` reads as `𝜆` in "the smallest 𝜆ᵢ". It's logged as F-new-pdf-script-dropped.

## Rescore before the switch (2026-11-14)

Tyler picked option 3 for its licences (D-new-granite-docling), on condition that it scores at least as well. The scorer behind D125 is `packages/core/eval/pdf-structure` (each key formula's best LaTeX match, each key table's best cell F1). The four arXiv papers it was run on weren't on this Mac, so it ran on five pages whose answers are known from their sources:

- `bench-a`, written for this test in Typst: a two-column page with 8 display formulas modelled on the bake-off papers' kinds (attention, a feed-forward layer, a positional wave, a learning-rate schedule, a residual block, a variational bound, a sampling step) and 2 tables, one with headers spanning two columns and powers in its cells, one with ± values and bold.
- `bench-b`, written for this test in Typst: 6 harder formulas (cases, a sum with limits, an integral, a matrix, a softmax fraction, a policy gradient) and 2 tables, one ruled with bold cells and a dash, one with cells spanning two rows.
- `tables.pdf`, `inline-math.pdf` and `dense.pdf`, as above.

17 formulas and 6 tables in all. "Ore" is Ore's own doc.md: pdf.js's text with the reader's tables and formulas swapped in, as the app saves it.

| | Formulas | Tables | Time, one page |
|---|---|---|---|
| pdf.js alone | 0 | 0 | instant |
| Standard pipeline, its own Markdown | 97 | 90 | 24 to 234 s |
| Standard pipeline, in Ore | 96 | 92 | |
| Granite-Docling, its own Markdown | 92 | 94 | 7 to 14 s, model load included |
| Granite-Docling, in Ore | 96 | 94 | |

Granite's own Markdown scores lower on formulas only because its stray inline `$` scraps on `dense.pdf` confuse the scorer's `$$` matching; Ore takes only its display formulas and scores 100 there.

What changed in Ore to get there: Granite boxes a table but not its cells, so each cell takes the first unused run of pdf.js items in the table that spells the same letters and digits (so `2.3·10¹⁹` and bold stay; the model alone writes `2.3 · 10 19` and drops bold), and the model's text where none does. It writes an equation's number after a space (`\quad ( 1 )`), which becomes `\tag{1}`. The prose was identical to the standard pipeline's on all five pages, so highlights don't move.

What is still worse: a header set over two rows stays two rows (the model marks no cell as a header, so the old join doesn't apply), and a cell holding only a dash takes the model's hyphen. Still to do: rescore on the bake-off papers when they are next on the Mac (fetch them as the scorer's README says).
