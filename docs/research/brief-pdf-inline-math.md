# PDF inline math: does Granite-Docling read it?

A test of Granite-Docling (`ibm-granite/granite-docling-258M`) for the open gap "inline math stays plain text" (D125, F148). 2026-11-13, on Tyler's Mac (M4 Pro, 24 GB), Docling 2.142.0 (the version Ore pins), everything in a scratch folder.

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

CDLA-Permissive-2.0 is a permissive data licence, but D120's list doesn't name it. So today's download already includes two sets of weights the rule doesn't cover (F149).

## Options

1. **Keep the gap open.** It costs nothing, and the intake grid stays honest.
2. **Read inline math from pdf.js's own glyphs.** pdf.js already knows the math fonts and the raised and lowered glyphs (it writes powers today). A run of math-font items inside a line would become `$$…$$` (the reader's inline math, since `singleDollarTextMath` is off), with `^{}` and `_{}` built from the glyphs' heights. It needs no model, and it works on the iPhone. Simple formulas would come out right. Stacked fractions, roots and integral limits would not without more work. It rewrites the prose itself, so a highlight across a formula has to be re-anchored, which D125 avoided for display formulas. It's a medium-sized change. Mock and score it on the D125 bake-off papers first.
3. **Granite-Docling in place of the standard pipeline**, for display formulas and tables only. It's about 5× faster and needs half the download, and all its weights are Apache-2.0, which settles F149. Before switching, it needs D125's bake-off rescored (formulas 95%, tables 81%). Its boxes sit on a 500-step grid, about 1.6 pt on a Letter page, coarse but enough for `swapRegions`. It doesn't help inline math.

## Found along the way

pdf.js drops some powers and indices from the prose. `a x^2 + b x` reads as `𝑎𝑥 + 𝑏𝑥` (its raised `2` is followed by a raised space), and `lambda_i` reads as `𝜆` in "the smallest 𝜆ᵢ". It's logged as F150.
