# Courses (multi-lesson sources) and live links: design options (2026-10-28)

**Decided 2026-10-28: Tyler picked B; built as D79.**

Tyler asked whether [AI Fluency: Framework and foundations](https://academy.claude.com/courses/ai-fluency-framework-foundations) (Claude Academy) can be imported, how a 14-lesson course should live in the app, and whether "live links" that flag doc updates are worth it. Nothing here is built; pick an option first.

## Can this course be imported?

Yes. Checked 2026-10-28 from a clean browser, no sign-in:

- **Open, not gated.** "Sign in to save progress" only. Every lesson page loads without an account.
- **Licence:** CC BY-NC-SA 4.0 (Dakan, Feller, Anthropic). A personal copy for study is fine.
- **Shape:** 14 lessons (~4 h), 1 quiz. 11 lessons are one YouTube video each (`youtube-nocookie` embed, e.g. lesson 3 is `W4Ua6XFfX9w`); lessons 7, 11 and 14 are text only. Each lesson page also has a summary, key takeaways, exercises and a full transcript.
- **What pasting a link does today:** the course URL gives only the overview page. A lesson URL gives an article with the summary, takeaways and exercises, but **no video and no transcript** (both load by script after the page opens), a junk author ("the end, you'll be able to") and a stray "Summary Transcript" line. So today you'd get 14 loose, half-empty text sources, newest first. See `0-today-14-loose-sources.png` for what 14 lessons look like dumped in a skill's To read.
- **What a proper import needs:** list the lessons in order from the course page, then per lesson either the YouTube video (our existing video ingest, D48 to D50, gets the captions and the player) or the lesson text. Claude Academy needs a small site reader for the lesson list and video IDs; YouTube playlists come almost free (the YouTube ingest calls `yt-dlp --no-playlist` today; drop the flag and read the entries). Playlists are the general case: most courses Tyler would want are a playlist or a page of ordered lesson links.

## The two shapes

Mockups are in `docs/images/course-import/` (also in the project's `course-import/` folder), drawn over the real app with the course's real lesson titles and transcript.

### A. One source, lessons inside (the book pattern)
`A1-skill-page-one-source.png`, `A2-reader-lessons-outline.png`

The whole course is one source, like an EPUB. Lessons are chapters: the D45 outline lists them, click jumps, each lesson has a chapter recall (as EPUB chapters do), and each lesson's video sits at its heading.

- Lists: one row. Nothing else changes in the sidebar, skill page, Home or search.
- Reader: one long document; the pinned player has to swap videos as you scroll into each lesson (D48 assumes one video per source, so that is new work).
- **Learning cost.** Prequestions (D18) are 2 to 4 for the whole 4 hours, so they're too broad to steer attention in any one lesson. Cards are drafted when the source closes (D71), so nothing from lesson 1 reaches review until all 14 are done, maybe weeks later. Spacing starts late and the finish quiz has to cover 4 hours. Done, To read and resume work at the level of the whole course, not the lesson.

### B. A course is an ordered set of lesson sources (recommended)
`B1-skill-page-course.png`, `B2-reader-lesson-nav.png`

Each lesson is a normal source (a video source for the 11 video lessons, text for the other 3). The sources carry `course: {id, title, part}` in their frontmatter; the course itself is not a new page.

- **Skill page and All sources:** the course shows as one row with a caret (collapsed by default, remembered). Expanded, its lessons are listed in course order with their number, a check when done, the filled dot on the one you're on, and their kind. A course leaves To read when its last lesson is done.
- **Reader:** one line above the title, "AI Fluency: Framework and foundations · Lesson 3 of 14", with ‹ › for the previous and next lesson (⌥⌘← / ⌥⌘→, shown on hover). Clicking the course name opens a lesson list popover (cmdk) for a jump.
- **Finishing a lesson:** the closing card (D71) adds one button, **Next lesson**, which opens it. Cards from the lesson are drafted as usual and reach review tomorrow.
- **Home:** Continue reading shows the next lesson, with the course name muted.
- **Review:** no change. Cards belong to their lesson, so the source shown after an answer is the exact lesson.
- **Sidebar:** no change. Courses live under the skill they're filed in, like any source. No new sidebar item.
- **Lifecycle:** rename the course (⋯ / right-click / ⌘K, inline), file it under a skill (all lessons follow), archive or delete it (all lessons, with Undo), drag a lesson out of the course or reorder lessons. Adding one source to a course by hand: "Move to course…". Opening a course row opens its next lesson.

Why B wins on learning: each lesson gets its own prequestions, closed-book finish and cards the next day, so retrieval happens after every 10 to 20 minutes of content instead of once after 4 hours, and spacing starts with lesson 1. It also reuses the video reader unchanged. The cost is one grouping concept (a frontmatter field, a collapsible row, the reader line) rather than a new kind of document.

What stays out (purpose rule): no course page, no course progress bar or percent, no "3 of 14 done" count in lists (the checks show it when expanded), no course thumbnail grid, no certificate or completion badge (D23).

### Importing a course
Paste the course URL (or a YouTube playlist) into ⌘N. The add box recognises it and offers **Add course · 14 lessons** under the skill you're on, with each lesson's title listed. One click adds all of them; the lessons' AI work (prequestions, enrich) runs as each is opened rather than 14 at once, so nothing waits on the AI and a failure says which lesson and retries just that one. Pasting a single lesson URL from a known course offers to add the whole course or just that lesson.

## Live links (watching a page for changes)

**Feasible and cheap to detect; hard only if the app tries to judge what matters.** Straight take: don't build it now, and if we do, don't build "watch and notify".

- Detecting a change costs almost nothing: re-fetch the page (daily while the app is open), extract the text the same way as at capture, compare against `text_sha256`, which every source already stores. Claude Code's docs also publish Markdown versions and a changelog, which makes this easier for that site in particular.
- The hard part is the one Tyler named: most edits are noise (typos, reordering, a new example). An AI that ranks "meaningful" changes would be wrong often enough to train him to ignore it, and every new flag is a nag (D23).
- **The rule that makes it tractable:** a change matters only if it touches something he has learned. The app can compute that with no AI judgment: a new version matters when a passage behind one of his highlights or cards changed or vanished (the anchoring code already detects this, `ore doctor`). Those cards are the risk, since spaced repetition would keep drilling an outdated fact. Everything else is a new version he can read if he wants.
- **If we ever build it:** a manual **Check for updates** on a source (⋯ and ⌘K), not a background watch. It shows what changed (added and removed paragraphs), keeps the old text as a revision, re-anchors highlights, and lists the cards whose passages changed so he can edit or retire each. No badges, no notifications.
- For "keep up with Claude Code docs" today, the honest path is adding the changelog (or a release post) as a new source when he wants to catch up. That keeps the library files canonical and immutable (D5) and needs no new feature.

## Recommendation
**B**, with import from Claude Academy courses and YouTube playlists. Skip live links for now; revisit as a manual "Check for updates" only once a source he has cards on actually goes stale.
