# Import coverage audit (2026-10-28)

Of 53 real links and files run through `ore add` on 2026-10-28, 18 imported fully, 10 lost something that matters, 10 were saved as junk without a warning, 14 failed with a message and 1 hung the app. Plain articles, docs, Substack, Wikipedia text, YouTube and EPUB text were solid; podcasts, slides, Office files, X, GitHub, scanned PDFs and other video sites were missing or broken. The plan that closes the gaps is D96; all three phases have shipped, and the table below is the state before them.

The three worst gaps:

1. **Junk saved as a source with no warning.** Bot checks ("Client Challenge", "Verify to continue"), login walls (X) and listing pages (a podcast's show page, a YouTube playlist) were saved as if they were the content.
2. **Whole types with no way in.** Audio and podcasts, slides, Word, PowerPoint, images, notebooks and subtitle files were refused. An mp3 link hung the app: it downloaded the whole file and parsed it as a web page (6 GB of memory before it was stopped).
3. **What we keep, the reader can't show.** Complex tables (kept as HTML) and math (kept as LaTeX) don't render; images are hot-linked, not saved, so they vanish offline or when the site changes; video embeds and YouTube chapters were dropped.

Tested from a cloud server. Medium, NYT, Reddit and Khan Academy block cloud servers, so those rows need a recheck from the Mac.

## Coverage before D96

| Type | Tested with | What we kept | What we missed | Result |
| --- | --- | --- | --- | --- |
| Essay | Paul Graham, Gwern, Andy Matuschak | All text (12k to 26k words), footnotes | Author on PG | Full |
| Blog with diagrams | Lilian Weng (agents) | Text, 13 of 13 images, 6 code blocks, headings | Images are links to her site, not saved | Full |
| Interactive essay | Nicky Case, How to Remember Anything | Text, 7 of 10 images | 7 interactive widgets; 2 videos become plain links | Partial |
| Docs site | React, Python, MDN, Claude docs, GitBook | Text, every code block, headings | React's 3 live sandboxes; GitBook date "1 month ago" | Full |
| Wikipedia | Spaced repetition, Bayes' theorem | Text, images, references | 155 formulas as raw LaTeX; 2 tables kept as HTML the reader hides | Partial for math |
| Newsletter | Astral Codex Ten, Pragmatic Engineer | Text, post images, author, date | Images not saved | Full |
| Tutorial | freeCodeCamp Git guide | Text, 10 images, code | Nothing notable | Full |
| Forum thread | Hacker News (OpenAI board thread) | Whole thread, 158k words | No structure | Full |
| JS-heavy page | Linear changelog | Text, 15 images | 6 videos; date "Elapsed00:00" | Partial |
| Medium, NYT | Karpathy "Software 2.0", NYT op-ed | Nothing | HTTP 403 with a "paste it" message | Refused |
| Notion page | Notion Help Center | Nothing | Built in the browser; "paste it" message | Refused |
| X post or thread | Karpathy post | "See what's happening… Log in" (16 words) | The post | Junk saved |
| Reddit | r/Anki thread | Nothing | Rate-limited from the cloud | Refused |
| GitHub repo or file | ts-fsrs, fsrs4anki README | Nothing | GitHub blocks the cloud server's page fetches | Refused here |
| PDF paper | Attention Is All You Need | All text by page (6k words) | Title ("1706"), authors, headings, figures, tables, math | Partial |
| arXiv abstract page | arxiv.org/abs/1706.03762 | Abstract only (308 words) | The paper | Junk saved |
| Scanned PDF | (by design) | Nothing | Refused with "use Live Text, then paste" | Refused |
| EPUB | Pride and Prejudice (Gutenberg) | All text, chapters, title, author | Illustrations (dropped on purpose) | Full |
| YouTube video | Karpathy "Let's build GPT" | Full transcript, channel, date, thumbnail | 30 chapters, description and its links | Full, chapters missing |
| YouTube playlist (plain add) | Neural Networks: Zero to Hero | 7 words | Every video; only `--course` reads it | Junk saved |
| Other video sites | Vimeo, TED | "Verify to continue", 31 words | Transcripts yt-dlp can fetch | Junk saved |
| Page with a video | Dwarkesh episode | Full transcript on the page | The video | Partial |
| Course lesson | Claude Academy "The 4D framework" | Lesson text | The video (fixed by D92); author "the end, you'll be able to" | Partial |
| Course page | Claude Academy, Coursera, MIT OCW | The landing page | Lessons; Coursera author "AK, AM, BH…" and 5 dates | Partial |
| Bot-checked sites | Khan Academy, SlideShare | "Client Challenge… couldn't load" | The page | Junk saved |
| Listing page | Every.to column, nbviewer notebook | Navigation text | The articles, the notebook | Junk saved |
| Podcast episode | Apple Podcasts episode link | The show page, 23 dates as the date | The episode | Junk saved |
| Podcast feed | Huberman Lab RSS | Nothing | "Couldn't find article text" | Refused |
| Audio link | Huberman mp3 | Nothing | Read the whole file as a page; 10 minutes, 6 GB | Hangs |
| Slides online | Speaker Deck | Slide text (1.2k words) | All 40 slide images | Partial |
| Saved web page (.html) | Local file | Text | Its local images | Partial |
| Pasted text, .md, .txt | Raw README | Everything | Nothing | Full |
| Word, PowerPoint | .docx, .pptx | Nothing | Text, slides, notes, tables | Refused |
| Image, screenshot | .png | Nothing | Its text and the image | Refused |
| Audio file | .mp3 | Nothing | A transcript | Refused |
| Notebook, subtitles | .ipynb, .srt | Nothing | Cells and code; the transcript | Refused |

## The plan (D96)

One pipeline in `packages/core/src/ingest` for every link, file and paste: look before downloading, read with the right reader, check what came back, save what the reader shows into the library, render everything kept.

| Type | How Ore reads it | Phase |
| --- | --- | --- |
| Web article, docs, newsletter | As before, plus images saved, tables and math rendered | 1 and 2 |
| YouTube video | Plus chapters as headings and the description with its links | 1 |
| Vimeo, TED, Loom and other video sites | The transcript through yt-dlp, as for YouTube | 1 |
| YouTube playlist as a plain link | Refused with "add it as a course" | 1 |
| Page with a video | Page text plus the video's transcript (D92) | done |
| PDF | Title from page 1 when the file has none, headings by font size | 1 |
| arXiv abstract link | arXiv's full HTML version, else the PDF | 1 |
| GitHub repo or file | The README or file, relative images and links fixed | 1 |
| Google Docs, Google Slides | Their .docx or .pptx export | 1 |
| Word, PowerPoint | Headings, lists, tables; slides with their speaker notes | 1 |
| Notebook, subtitles | Cells and code; a timed transcript | 1 |
| EPUB | Plus its illustrations | 2 |
| Signed-in, paywalled or browser-built pages (Medium, NYT, Notion, X, Reddit, Khan Academy) | Add from the open Safari or Chrome tab | 3 |
| Podcasts and audio | On-device transcription (Apple Podcasts, other players' pages, audio files and links) | 3 |
| Scanned PDF, screenshot | On-device text recognition | 3 |

## Keeping it passing

- `packages/core/test/intake.test.ts` runs every type against saved examples in `packages/core/test/fixtures/intake/` (real pages with scripts and styles stripped; small Office, PDF, notebook and subtitle files built for the test). It checks title, author, date, phrases from start to end, and counts of headings, images and code; junk pages must be refused with their message.
- `bun run intake:live` adds one real link of each type to a scratch library and prints what each kept. After phase 1, 24 of 24 matched (2026-10-28).
- A new content type, or a fix to one, lands with its fixture (AGENTS.md).
