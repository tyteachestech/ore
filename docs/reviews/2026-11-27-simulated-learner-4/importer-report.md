# Importer — three days learning linear algebra

I used the Mac release build at port 1764 with its real CLI/real Codex AI, starting from an empty scratch library. Day 1 (Nov 27): imported course notes, textbook, video, a paper in HTML/PDF, a Jupyter Book lesson, a long interactive article, public Google Slides and a commented/tracked-change Word handout; read MIT's eigenvalue notes, saved a formula Key point and notes, and completed all four finish questions. Day 2 (Nov 28): reviewed one Fact and one Explain exercise, interrupted/resumed an answer, checked Ask persistence, and worked OpenStax's equipment-cost example. Day 3 (Nov 29): reimported two local originals plus the MIT URL source and found the Day 1 formula again. Four new **S2** findings and one **F769 recurrence** are supported below. No S1 loss/crash observed. I skipped iPhone, scan-only PDF decoding, bonus laps, a missed day, paid access, and exhaustive equation/transcript scoring. A true consent wall and paywall-specific refusal remain unverified: those candidate fetches encountered bot protection first. The Word handout is explicitly synthetic CC0, not an actual university download. Only `codex-out/importer/` was written directly; library changes were through the app. No repo changes or commits.

## Findings, ordered by cost to this learner

### 1. A PDF display equation changes meaning; another becomes raw TeX

**S2 · Mac · 2/2 reader opens, still present after Day 3 reimport.** The main lesson required checking the original to trust its derivation. This is separate from the already-open inline-math limitations F148/F150.

1. From a fresh Mac page, add the [MIT lecture PDF](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/1999c9f4accdbef05571a1014438f8dd_MIT18_06SCF11_Ses2.8sum.pdf).
2. Open it and wait for “Reading the pages for headings, tables and formulas…” to finish.
3. Read “Calculating eigenvalues and eigenvectors,” then “Triangular matrices and repeated eigenvalues.” Compare Original pages 2–3.
4. Leave and reopen. The errors persist.

**Expected:** preserve the display equations, including the equals sign in the parenthesized explanation. **Actual:** `(3−λ)(3−λ) (= (a11−λ)(a22−λ))` loses that inner `=` and looks like multiplication by a second quadratic. The earlier aligned derivation contains invalid TeX and renders its source instead. No incomplete-math notice accompanies either. The extra `det I` and the claim about the zero vector are already in MIT's original: they are **not** attributed to Ore.

Evidence: [wrong displayed product](d1-mit-wrong-product.png), [raw TeX](d1-mit-raw-tex.png), [original page 3](mit-eigenvalues-page3.png), [original page 2](mit-eigenvalues-page2.png). Saved `layout.json` and `doc.md` are in the day snapshots. Suspect `packages/core/src/ingest/pdf.ts:620`, which inserts the page reader's `r.latex` unchanged. The incorrect recognition precedes rendering; this is not an established root-cause diagnosis.

### 2. OpenStax turns a 3-by-2 matrix into one column

**S2 · Mac · 2/2 opens, confirmed again on Day 3.** I could recover the worked example only by using its intact tables and ignoring the displayed equipment matrix.

1. Add [OpenStax College Algebra 2e, 7.5](https://openstax.org/books/college-algebra-2e/pages/7-5-matrices-and-matrix-operations).
2. Open Example 10, “Using Matrices in Real-World Problems.”
3. Read the equipment matrix just after Tables 3 and 4; compare the original.
4. Reopen the lesson and return to the same example.

**Expected:** `E = [[6,10],[30,24],[14,20]]`. **Actual:** `E` is drawn as one column containing `6, 30, 1410, 24, 20`. The saved TeX is `\begin{bmatrix} 6 \\ 30 \\ 14 10 \\ 24 \\ 20 \end{bmatrix}`. Multiplying the displayed cost row by that column is incompatible with the stated operation. The later multiplication and totals are correct: Wildcats 2520, Mud Cats 3840. This is **not F794's duplicate-formula bug**; each formula appears once.

Evidence: [confirmed wrong matrix](d3-openstax-matrix-confirmed.png), [original](original-openstax-equipment-clean.png), [original with consent overlay](original-openstax-equipment.png). Some earlier screenshots named `d2-openstax-matrix-repeat` caught restored reading position rather than the target; use the confirmed screenshot. Suspect MathML conversion after `packages/core/src/ingest/web.ts:479–491`: the original encodes the two columns as adjacent `<mtable>` elements inside one pair of brackets, and conversion concatenates their rows.

### 3. The arXiv HTML import silently removes Related Work

**S2 · Mac · 2/2 opens plus a fresh-page evidence check.** A scholarly section disappears without a warning; the same paper's PDF retains it.

1. Add [arXiv HTML 2506.16663v1](https://arxiv.org/html/2506.16663v1).
2. Read past Introduction into Image Representation, or inspect the outline.
3. Compare [the same paper's PDF](https://arxiv.org/pdf/2506.16663v1) and the original HTML.
4. Reopen the HTML source. It still jumps directly from 1 Introduction to 1.2.

**Expected:** heading 1.1 Related Work and its historical-methods paragraph remain in the learning document. **Actual:** both are absent from `doc.md` and the outline, although `source.html` keeps them. It appears to be a complete successful import. The PDF version retains 1.1 and its paragraph.

Evidence: [missing section boundary](arxiv-missing-section-confirmed.png), [original section](original-arxiv-related.png), [content audit](content-audit.json). Suspect article extraction at `packages/core/src/ingest/web.ts:491`. The existing heading/id protection at line 96 does not protect this section; the precise extractor heuristic was not isolated. Do not merge this mechanically with F769 without checking the extractor: the arXiv section has a generated id, not a `more-*` id.

### 4. Embedded demonstrations become an unhelpful browser-error message

**S2 · Mac · 2/2 opens, with a third targeted screenshot.** The article's central growth/instability demonstrations are unavailable where the text says to watch them.

1. Add [Growing Neural Cellular Automata](https://distill.pub/2020/growing-ca/).
2. Read Experiment 1 to the paragraph introducing the animation, then through the experiments that follow.
3. Compare the original embedded videos. Leave and reopen Ore's source.

**Expected:** playable demonstrations, or explicit video links/placeholders explaining how to open them. **Actual:** seven `<video>` blocks survive in saved Markdown but produce zero video elements or replacement links in the reader. The original fallback text, “Your browser does not support the video tag,” appears instead. It blames browser support and gives no direct way to watch that demonstration; this is a conversion/rendering mismatch, not established lack of WebKit video support. Original HTML is kept, but video files are not stored locally.

Evidence: [missing animation and caption](blog-missing-video-confirmed.png), [original video](original-blog-video.png), [repeat reader view](d3-blog-video-repeat.png). Likely boundary: `packages/core/src/ingest/web.ts:34` converts **iframes** to links, while raw `<video>` survives extraction; `apps/desktop/src/Reader.tsx:541` intentionally skips raw HTML. The safety rule should remain; the importer needs a safe representation.

Additional friction from this same article: five of seven custom block-code examples become widely spaced prose; only two remain fenced code. [Original code](original-blog-code.png), [Ore code](d1-blog-flattened-code.png), [repeat](d1-blog-code-repeat.png). The original pseudocode is itself unindented, so I withdraw the log's initial implication that Ore lost indentation. This is lost grouping/readability, not demonstrated code-semantic corruption. Footnote text remains, but is inserted into running prose rather than clearly separated notes.

## Known rows seen again

**F769 — S2, Mac: numbered course headings still lose `more-*` sections.** QuantEcon's [Linear Algebra](https://python.quantecon.org/linear_algebra.html) silently drops **2.4.2 More rows than columns** and **2.4.3 More columns than rows**, including their explanations. Reproduced on two opens. From a fresh page, add that URL, open “Solving systems of equations,” and compare the transition after Determinants with the original. Expected both rectangular-system sections; actual jumps from 2.4.1.2 to 2.4.4. [Reader boundary](d3-jupyter-missing-sections.png), [repeat](d3-jupyter-missing-repeat.png), [original](original-jupyter-more-rows.png). Likely `packages/core/src/ingest/web.ts:104–111`: the derived heading slug includes `2-4-2` while the section id is `more-rows-than-columns`, so the existing `endsWith` protection misses it. This is a recurrence of a known fixed row, not an additional new finding.

F148/F150's open inline-PDF limitations were also visible. They were not reported anew. F734's explicit Home decision was encountered while drafts were pending; it is not labeled a regression. No other known row was established as recurrent.

## What passed

- Day 1 formula selection saved the whole equation; Key point intent, annotation note and source note survived leaving, reloading and reimport.
- All four finish questions concerned the lecture and accepted the supplied correct answers; recall feedback was saved with vendor/model/prompt provenance.
- Six exercises were eventually drafted from the completed MIT source; one Fact and one Explain were reviewed on Day 2. No unrelated imported source entered that review.
- A partial Explain answer survived Esc and reload with 8062 ms already saved, supporting F796/#562; its eventual log retained time across the interruptions.
- AI suggested Easy; choosing Good recorded `rating:3` and retained `ai_rating:4`. AI did not choose the recorded rating.
- Ask's explanation survived leaving/reloading/reopening the same exercise, supporting F807/#582.
- OpenStax formulas were not duplicated (F794/#562 held for this different chapter). The shape error above is separate.
- MIT Original rendered, but this is not a scan/JPEG2000 test of F795, nor a mixed-scan test of F790/#582.
- No unrequested page reload or bridge failure occurred in this release build. This does not test #559's cold Vite development-server fix.
- The YouTube transcript retained all five supplied chapters, timed text from 00:07 through the closing at 50:48, byline/date and description. Auto-captions were available, but a manual English track was also available; automatic-track selection was not forced.
- The Jupyter lesson retained 42 fenced code/output blocks and five saved figures. The two missing sections are documented separately.
- The Slides export retained 64 slide sections and 44 image references; original PPTX was kept. This is structural coverage, not pixel-equivalence for all slides.
- Word accepted the insertion, omitted the tracked deletion, retained the instructor comment and kept a byte-identical original. Its title became the first heading; its original document title remained in the body.
- Reimport of the local Word file and local arXiv PDF used kept originals and preserved their added highlights. MIT URL reimport also preserved the Day 1 Key point and notes. All three returned `changed:false`, zero moved/removed/unplaced highlights. The local PDF preservation check was repeated without canceling the selection: [before/after data](d3-local-paper-confirm.json), [before](d3-paper-highlight-before.png), [after](d3-paper-highlight-after.png). Its open highlight and annotation log were unchanged; this valid check took 0.966 s. The earlier 0.859 s trial had canceled the highlight with Esc before reimport and is excluded from preservation claims.
- Searching `Ax` found the Day 1 formula Key point and opened its source; `Ax=λx` found the related exercise first.
- Medium, Springer and Stack Exchange bot responses were refused with browser/paste recovery steps; no wall content was saved as a lesson.
- OpenStax's real browser showed cookie/onboarding overlays, but Ore imported lesson content, not those overlays. This covers a consent-banner page only.

## Import coverage and time to readable

Tested checkout: `f0d9a8717dcb20d7e4b29880b51f25470eac1885`. App view 1280×800, screenshots at 2×, existing WebKit only; all test contexts closed.

The add measurements below are **Enter to Add-sheet completion**, except MIT's explicitly timed first reader. Screenshots/1-second polling make most outcome times upper bounds. Adding from an already-open reader leaves that reader in place; actual newly opened reader measurements were 131–165 ms after selecting its row. They are not proof that all lazy images or background enrichment had completed. `requests.jsonl` contains the finer bridge timings; `content-audit.json` preserves metadata, full saved text and original hashes.

| Source / format | Add outcome | Whole-content comparison and original |
|---|---:|---|
| MIT OCW lecture, math PDF | 1.317 s to reader | Title/author, eight headings, whole four-page text; display errors above and known inline limits. `source.pdf` kept. Fall 2011 is in body, no date metadata. Background page reader visibly worked; first observed completion about 26 s after add. |
| OpenStax chapter, HTML | 2.256 s | Title/Jay Abramson; examples 1–11, section exercises through Extensions, tables and three images. Math shape error above; date not shown. `source.html` kept. |
| QuantEcon Jupyter Book | 2.237 s | Title and Sargent/Stachurski; code/output, figures, formulas and ending exercises retained; two sections missing. `source.html` kept. |
| arXiv HTML | 1.208 s | Title/byline/June 20 2025, math and main headings; Related Work omitted. `source.html` kept. |
| Same paper, URL PDF | 1.248 s | Title/byline, Abstract through References, including Related Work; formulas received background page reading. `source.pdf` kept. |
| Same paper, local PDF copy | 1.240 s | Additional verification duplicate, not an app-created duplicate; used for kept-original reimport. Same 355353-byte original hash as URL PDF. |
| Distill long article | 1.303 s | Title/first author, main article through references; no published date in metadata; five figures, footnote text, 38 reference entries. Missing demos and code grouping above. `source.html` kept. |
| MIT YouTube lecture | 4.253 s | Five chapters, timestamped transcript and description, title/channel/date; `source.vtt` kept. Player startup failed in this web harness and offered YouTube. No native playback conclusion: relay/native player was not supplied. |
| Public Google Slides | 2.259 s | Fitting a line by least squares regression; 64 sections, 44 image refs, original `source.pptx`. Byline/date absent. |
| CC0 Word handout | 1.241 s | Whole short handout, accepted changes and comment. `source.docx`, byte-identical. |
| Medium / Springer / Stack Exchange | 1.232 / 2.227 / 1.227 s | Actionable bot refusals, no saved article. Subscription-specific and hard consent-wall behavior not reached. |

The public Slides URL is `https://docs.google.com/presentation/d/1ABWqpgPhn3kphZ0iMPAIskb4JOrZnFJPhyPHctT-ptI`. The YouTube URL is `https://www.youtube.com/watch?v=cdZnhQjJu4I`. The other original links appear in findings above. Open licenses were checked on the source pages/export providers: MIT OCW, OpenStax, QuantEcon, arXiv and Distill; the synthetic Word declares CC0. Distill is an advanced supplementary application, not an introductory lecture. Public Slides are OpenIntro course materials.

## Day and schedule audit

Dates moved forward only, using `setSystemTime` before reload. No timer-freezing `clock.install` was used. Snapshots: [Day 1 end](day1-end.json), [Day 2 ready](day2-ready.json), [Day 2 final](day2-final.json), [Day 3 final](day3-final.json).

| Day | What files and CLI responses show | What the screen showed |
|---|---|---|
| 1, Nov 27 | MIT `status:done`, finished 16:13:03Z; six exercises created 16:14:26Z. No review log yet. | Finished source; drafting continued asynchronously. |
| 2, Nov 28 | Two Good reviews: 25759 + 86146 = **111905 ms**. Two new exercises used; four remain. Both reviewed exercises due Dec 6. | Final ring **2 min**; final session **1 memory kept**, consistent with that session's one rating. Earlier session also had one. |
| 3, Nov 29 | `active_ms:0`, `new_today:0`, four unrated drafts due; reviewed two still scheduled Dec 6. | Day reset correctly; Start review remained available. No review ratings were made this day. |

The first Day 2 reload briefly saw zero exercises because Day 1's real AI process was still completing. Advancing the simulated clock did not make that process finish faster. A later reload showed six. This is **not** evidence that a real overnight wait would remain empty. The pending-draft Home wording is already the decision documented in F734.

Review time is accumulated per rated exercise and capped at three minutes (`apps/desktop/src/review-session.ts:362–381,547`, `packages/core/src/study.ts:137–140`). Reading is not goal credit. I checked the two review records, three session records (1, 0, 1 ratings), the day's response and the end screenshot; no duplicate count or AI-selected recorded rating appeared.

## Where the minutes went

These are honest measured components, **not a fabricated stopwatch total**. The runner timed actions/requests, not every reading interval. Source comparison, script maintenance and report writing are excluded from learner-time claims. Waiting overlaps reading/review and must not be added again.

| Day | Review | Reading | Adding / maintenance | Waiting | Lost to friction |
|---|---|---|---|---|---|
| 1 | 0 rated minutes; four finish checks | MIT lecture + recall/quiz completed; active reading minutes not recorded | 0.408 min summed Add outcomes, including refused/invalid attempts | 2.396 min summed bridge requests over 1 s, including overlapping background work | Returned to original for formulas; compared missing paper section and demos. Recovery minutes not separately recorded. |
| 2 | **1.865 min recorded** | Worked Example 10 and saved calculation; active reading minutes not recorded | 0 new imports | 0.452 min across two grade calls and one Ask; some included in review time | Reconstructed malformed matrix from intact tables; one interrupted answer restored successfully. |
| 3 | 0 rated minutes | Reopened sources, compared missing sections, found old formula; active minutes not recorded | **0.049 min** for the three valid preservation checks | Reimports 0.782–1.195 s, plus normal reader opens | Had to read code to distinguish URL reimport from kept-copy reimport: the menu just says Reimport. No separate issue claimed. |

## Felt slow

The following table contains every measured action timer (including fast ones for context) and every bridge request above one second, slowest first. Bridge and UI entries can describe the same wait and are **not additive**. The erroneous 36 ms “quiz answer 3 to feedback” wait is excluded: it checked for a loading label before the label appeared. Background enrichment completed after its requesting page was reloaded, so its full request duration was not captured. No missing 100-ms feedback claim is inferred from a 120/150-ms screenshot sample.

| Seconds | Day | Measure | Action |
|---:|---:|---|---|
| 79.368 | 1 | bridge | key-points 01M8EVTD7ATFFVQJF9W1V8PSNX |
| 19.627 | 1 | bridge | recall 01M8EVTD7ATFFVQJF9W1V8PSNX |
| 9.847 | 2 | bridge | grade 01M8EWJR2PQM7TH6A979FKEAG8 |
| 8.804 | 2 | bridge | ask 01M8EWJR2PQM7TH6A979FKEAG8 |
| 8.628 | 1 | bridge | check 01M8EVTD7ATFFVQJF9W1V8PSNX question 3 |
| 8.487 | 2 | bridge | grade 01M8EWJR2PQM7TH6A979FKEAG8 |
| 7.901 | 1 | UI observation | quiz answer 2 to feedback |
| 7.690 | 1 | bridge | check 01M8EVTD7ATFFVQJF9W1V8PSNX question 2 |
| 6.382 | 1 | bridge | check 01M8EVTD7ATFFVQJF9W1V8PSNX question 1 |
| 6.164 | 1 | bridge | check 01M8EVTD7ATFFVQJF9W1V8PSNX question 4 |
| 4.253 | 1 | UI observation | d1-video |
| 3.744 | 1 | bridge | add https://www.youtube.com/watch?v=cdZnhQjJu4I |
| 2.259 | 1 | UI observation | d1-slides |
| 2.256 | 1 | UI observation | d1-openstax |
| 2.237 | 1 | UI observation | d1-jupyter |
| 2.227 | 1 | UI observation | d1-springer-paywall |
| 1.689 | 1 | bridge | add https://openstax.org/books/college-algebra-2e/pages/7-5-matrices-and-matrix-operations |
| 1.650 | 1 | bridge | add https://docs.google.com/presentation/d/1ABWqpgPhn3kphZ0iMPAIskb4JOrZnFJPhyPHctT-ptI |
| 1.568 | 1 | bridge | feed find |
| 1.386 | 1 | bridge | feed find |
| 1.379 | 1 | bridge | add https://python.quantecon.org/linear_algebra.html |
| 1.317 | 1 | UI observation | MIT PDF add to reader |
| 1.303 | 1 | UI observation | d1-blog |
| 1.248 | 1 | UI observation | d1-arxiv-pdf |
| 1.241 | 1 | bridge | feed find |
| 1.241 | 1 | UI observation | d1-docx |
| 1.240 | 1 | UI observation | d1-paper-file |
| 1.237 | 1 | UI observation | d1-consent |
| 1.232 | 1 | UI observation | d1-paywall |
| 1.227 | 1 | UI observation | d1-cookie-page |
| 1.208 | 1 | UI observation | d1-arxiv-html |
| 1.195 | 3 | UI observation | d3-mit-reimport |
| 1.114 | 1 | bridge | add https://arxiv.org/pdf/2506.16663v1 |
| 1.089 | 1 | bridge | add https://arxiv.org/html/2506.16663v1 |
| 1.037 | 1 | bridge | add https://distill.pub/2020/growing-ca/ |
| 0.966 | 3 | UI observation | local PDF reimport, valid preservation confirmation |
| 0.859 | 3 | UI observation | d3-local-paper-reimport, canceled-highlight trial |
| 0.782 | 3 | UI observation | d3-word-reimport |
| 0.204 | 2 | UI observation | Fact Good to next exercise |
| 0.165 | 3 | UI observation | open 7.5 Matrices and Matrix Operations |
| 0.161 | 2 | UI observation | Day 2 Start review to selection |
| 0.161 | 2 | UI observation | open 7.5 Matrices and Matrix Operations |
| 0.160 | 3 | UI observation | open Fitting a line by least squares regression |
| 0.160 | 1 | UI observation | open Growing Neural Cellular Automata |
| 0.155 | 3 | UI observation | open Linear Algebra |
| 0.154 | 3 | UI observation | open 21. Eigenvalues and Eigenvectors |
| 0.151 | 3 | UI observation | open A Comparative Analysis of Principal Component Analysis (PCA) and Singular Value Decomposition (SVD) as Dimensionality Reduction Techniques |
| 0.150 | 3 | UI observation | open Growing Neural Cellular Automata |
| 0.149 | 3 | UI observation | open Linear Algebra |
| 0.147 | 1 | UI observation | open Growing Neural Cellular Automata |
| 0.139 | 2 | UI observation | open 7.5 Matrices and Matrix Operations |
| 0.139 | 1 | UI observation | open Lecture 21: Eigenvalues and eigenvectors |
| 0.135 | 1 | UI observation | open A Comparative Analysis of Principal Component Analysis (PCA) and Singular Value Decomposition (SVD) as Dimensionality Reduction Techniques |
| 0.134 | 3 | UI observation | open A nonzero direction |
| 0.131 | 1 | UI observation | open Lecture 21: Eigenvalues and eigenvectors |

Add showed Adding; PDF page reading had a background status. Quiz/grade checks displayed checking feedback, and the review grade added a longer-wait message. Reimports showed progress then “already up to date.” Ask showed its in-progress reply area and eventually the answer. See the `*-waiting.png`, `d1-quiz-checking.png`, `d2-grade-wait.png` and `d2-ask-wait.png` evidence. No claim is made that every one of these notices appeared within 100 ms.
