# Import promise: where Ore stands (2026-11-06)

The promise (D122): everything people learn from comes in whole, as one `doc.md` built for learning. This checks it against today's code and the intake grid (`packages/core/test/intake-grid.test.ts`, 34 types × 11 hazards), after D96 (the 53-type audit, `2026-10-28-import-coverage.md`), D119 and D121 (PDF layout).

**Where it holds.** Web articles, blogs, docs sites, Wikipedia, newsletters, tutorials, YouTube (transcript, chapters, description), playlists and course pages, Apple Podcasts and other episode pages, audio files, EPUB (chapters, images), Word, PowerPoint text, notebooks, subtitles, Markdown, screenshots and scanned PDFs (Vision), arXiv, GitHub, Google Docs and Slides, and signed-in pages through the browser tab. Junk (bot checks, sign-in walls, feeds, empty pages) is refused with the next step.

**Being fixed in another thread:** PDF tables, formulas, bold and footnotes. Not repeated here.

## Gaps, ranked

Ranked by how much of what people learn from each one blocks, then by cost.

1. **Video with no captions, and video files.** A YouTube video without English captions is refused ("no English captions"), and an `.mp4` or `.mov` (lecture recordings, Zoom, downloaded courses) is refused as "a video file". Ore already transcribes podcasts on the Mac (SpeechAnalyzer); the fix runs a video's audio through the same path (yt-dlp's audio for sites, the file's own audio track locally), keeping the player for links. Medium. Unblocks the biggest share: lectures are the most common learning video without good captions.
2. **Figures and slide pictures are dropped.** PDF figures, PowerPoint slide images, notebook plots, Speaker Deck slides and a saved `.html` page's local images never reach the reader. Diagrams carry half of what textbooks and slides teach (dual coding). PowerPoint, notebooks and saved pages are small; PDF figures (finding and cropping each one) are the large part.
3. **Spotify episode links are refused.** Spotify is the most used podcast app, and most of its shows also publish a public feed. The fix finds the same episode by show and title through Apple's podcast search and transcribes that, refusing only Spotify-only shows. Small.
4. **Other languages.** Transcription always uses the Mac's own language, so a Spanish podcast is heard as English; YouTube takes English captions only; text recognition and PDFs in other scripts are unchecked. Matters only if you learn in another language. Small to medium.
5. **Online course platforms.** Only Claude Academy and YouTube playlists are tested as courses. Coursera, Udemy, Khan Academy and LinkedIn Learning are unchecked: their lesson text likely comes in through the browser tab, their lesson videos' transcripts likely don't. Needs a live check on your Mac first (they need your sign-in). Medium.
6. **Notion and other browser-built pages lose structure.** They come in as the tab's visible text, with no headings or images, so no outline to chunk or recall by. The fix reads headings and images from the rendered page. Small to medium.
7. **Threads and discussions.** X threads and Reddit keep site chrome when captured from the tab; forum threads (Hacker News) are only checked live. Medium.
8. **File types not read at all.** Keynote (`.key`), Pages, `.rtf`, `.mobi`, spreadsheets. Each is small; together they're rare. Kindle and Apple Books are locked (DRM), and D13 rules out a Kindle importer, so they stay out unless you reopen D13.
9. **Small grid holes.** A PDF's author, arXiv authors, TED's title and date, a damaged EPUB, a private Google Doc's sign-in page. One cleanup batch; each closes a `gap:` cell.

Suggested order: 1, then 2, then 3; 4 and 5 when you hit them.

**Picked (2026-11-06):** 1, 2 and 3, in order. 1 is built (D122): caption-less videos and video files are heard; a video's own-language captions are read, and its speech is heard in its language, which also closes part of 4.
