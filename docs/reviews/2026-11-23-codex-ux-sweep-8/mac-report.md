# Mac UX sweep — round 8

Tested source revision `526311dd4ae5c5e0c67678b373275ee286f7806e` through the supplied release app at `http://localhost:1761/`, bridge `1762`, in connected WebKit. Completed two journeys starting from fresh pages: each added three kinds of source, read and highlighted text, wrote a source note, asked the tutor, created a skill and filed its sources, recorded a review, opened Settings, used ⌘K, and left and returned. Followed those with Feed subscriptions and filing, a live Claude Academy course, Ask your library, Dig, Forge tools, exercise editing and history display, Explain on an audio transcript, a long note with a table/formula/diagram, and the quick quiz. Main viewport was 1280×800; quick-quiz checks used its configured 640×460 after an initial larger view; screenshots are 2×. Read the working agreements, daily-session design, findings registry, sweep history and earlier reports' passed paths. Skipped the excluded known issues, pending-save Undo, detailed paths already certified by earlier rounds, iPhone, pure taste, real AI, native OS integration, and a separate YouTube-playlist import. No artificial slow responses or failures were needed. All tester-written files are inside `codex-out/mac/`; scratch-library writes came through the app.

A fresh page retained the assigned scratch library. The two journeys used new sources and different skills; this was not an empty-library reset.

## Findings

### MAC-1 — Course lessons import without their videos or full transcripts

**S2 · Mac · reproduced on the first two lessons, then 2/2 dedicated fresh-page confirmations of lesson 1.** The learner gets a success message and a readable summary, with no indication that the main lesson content is missing.

1. From a fresh Mac app page, press **⌘N** and paste `https://academy.claude.com/courses/ai-fluency-framework-foundations`.
2. Wait for **Course · 14 lessons · AI Fluency: Framework and foundations**, then press Enter.
3. After **Added 14 lessons**, open **No skill** and click the course row once.
4. Read **Introduction to AI Fluency**, then use the course menu to open **Why do we need AI Fluency?**.
5. Compare the first lesson with its [original page](https://academy.claude.com/courses/ai-fluency-framework-foundations/introduction-to-ai-fluency), selecting **Transcript** there.
6. Close the app page. From another fresh page, use ⌘K to reopen **Introduction to AI Fluency**. Repeat once more.

**Expected:** The course retains each lesson's video and transcript alongside its page material, as D79, D92 and the whole-source promise D122 require. If it cannot obtain the lesson, it should explain that limitation instead of declaring the source fully added.

**Actual:** Ore saves these lessons as articles containing the summary and other page material. Neither tested lesson has a player or the full transcript. The original first lesson has a 643-word transcript and video `JpGtOfSgR-c`; its opening, “I'm Joe Feller”, is absent from Ore's entire saved document. The source displays **Summary Transcript** as plain text, but no switch reaches the transcript. Reopening preserves the incomplete source. The original page remains accessible, so this is incomplete capture and misleading success, not deletion of the external original.

**Evidence:**

- [First fresh-page confirmation](confirm-course-repeat-1.png) and [second confirmation](confirm-course-repeat-2.png).
- [Second lesson](confirmed-course-missing-2.png), showing the same summary-only result.
- [Original page with Transcript selected](course-original-transcript.png).
- [Structured confirmation results](confirmed-course.json), [saved source files and Markdown](course-library-evidence.json), [course plan](course-plan.json), and [cause measurements](course-cause.json).
- [Bounded UI confirmation snippet](confirm-course.cjs), run through `driver.cjs`; [read-only production-planner probe](course-probe.cjs).

**Code cause:** `packages/core/src/ingest/course.ts:74–88` (`academyVideos`) fetches one course bundle and searches it for lesson-script paths at **79–81**. The current bundle `page-courses-ai-fluency-framework-foundations-lx3rm7fl.js` contains no paths matching that expression. The lesson's own HTML does reference its script, and that script contains both `youtubeId` and the complete transcript. Consequently, `planCourse` at **118–124** returns all 14 entries without any `video` property. `lessonDraft` at **132–137** passes that missing video into `pageDraft`, so it saves the static summary page. `addCourse` at **209–214** accepts the nonempty page and reports the lesson added. The downloaded evidence is in `course-original.html`, `course-router.js` and `course-lesson.js`.

**Why this is the app, not the mock:** The bridge runs course import through the real CLI; these are deterministic imports, not mocked AI commands. The saved first two source folders contain `source.html` and no transcript file or video metadata. A separate read-only call to the production `planCourse` function returned zero video references, independent of Playwright and the bridge. No fake course response, route interception or failure hook was used. The player-port limitation is irrelevant here: the imported source never contains a video to try playing.

## Known rows seen come back

None confirmed. MAC-1 does not duplicate F510–F512, which concern chapter recall after a video transcript has already imported. No recurrence is claimed for the excluded rows.

## What passed

- Journey 1 imported **Field observations eight** as text, **Spanish vocabulary** from XLSX, and **Office Learning** from DOCX, then filed all three under **Practical recall eight**.
- Journey 2 imported **Second field notebook** as text, **Closures** from HTML, and **How Plants Make Food** from PDF, then filed all three under **Transfer experiments eight**.
- Both new text sources kept their highlights and source notes after navigation and reopening; the first highlight became a Key point.
- The second note kept 18 sections, a table, a rendered formula and a diagram after leaving and reopening; `/diagram` → **Type a map** → **Done** created the saved drawing.
- Each source-context tutor question ended in a visible error and retry action without trapping the field; Ask your library did the same from Home.
- Both new skills appeared immediately, and their source lists reflected bulk filing without a reload.
- A skill goal saved, and Dig kept the written explanation under a dated heading in the skill note.
- The Forge recorded three uses, made the try **Yours**, reopened it through **Try it again**, and restored the tool and its three uses with Undo after the write completed.
- A Fact exercise edit saved its new question while retaining its answer, visible history and next-review estimate; Ask about the exercise showed an error and retry when AI was unavailable.
- Each main-window journey recorded one Fact rating and returned through the end screen; the quick quiz recorded the other three available ratings, including Explain and New.
- Explain grading failure allowed manual key-point marking and a rating in the quick quiz.
- The quick quiz preserved the exact multiline answer through Escape/reopen and simulated blur/reopen; Done and Escape removed its review view, including when nothing remained due.
- Settings opened with ⌘, and dismissed with Escape in both broad journeys; ⌘K found the newly added sources and created both skills.
- Feed Follow read Simon Willison's live feed; **By feed** and its skill picker assigned the subscription, and an opened post inherited that skill.
- Writing a note kept a Feed preview and made it appear on Home with its assigned skill.
- The course preview counted 14 lessons; its grouped row, lesson menu, previous/next shortcuts and **Next lesson** after finishing worked despite the missing content reported above.
- The seeded recording's transcript remained readable; keyboard play/seek/speed controls reached 0:30 at 1.25×, and navigation/reopening retained those values.
- **Explain** on the transcript word “fluent” offered Retry; **Learn this** saved **What is fluent?**, which remained visible in Collected after closing the popup.
- No page errors were recorded in either driver; the main page had zero outstanding bridge calls before closure.

## Observations checked and limits

- The punctuation-only PDF fixture was refused with an explanation and a next step; it was not counted as an imported source. The glossary PDF supplied the third successful source in journey 2.
- A fenced Mermaid block stayed a code block. Ore's native note-diagram workflow was then tested separately and worked; no Mermaid-rendering promise was found or failure claimed.
- The quick quiz initially opened the main app because the label init script ran after the shim. The dedicated `quick.cjs` places the label with the bridge in the first init script and reached the real `QuickQuiz` component. The earlier `quick-open.png` is not quick-quiz evidence.
- Selector mistakes, a terminal input-length limit, and Python's local certificate configuration were corrected; none is reported as an app defect. `actions.log` and `quick-actions.log` retain these exploratory steps.
- Background enrichment and all AI replies were disabled. The waiting prequestions label, the mock dictionary's sample definition, missing AI content, and native YouTube playback are not findings. This run verifies the UI's fallback paths, not AI quality.
- File selection used `__ORE_PICK`; text selection used a DOM Range; the note paste dispatched a clipboard event. Native Finder selection, clipboard delivery, selection gestures, global quiz shortcuts, window placement, actual app focus return, audible output and media keys remain unverified.
- One browser context was open at a time. One page was normally open; a temporary second page inspected the original course and was closed immediately. Both owned contexts and both driver processes were closed at completion. No server, watcher, additional browser process, real library, installed app or other tester's resources were touched.
- Git status remained unchanged: only the pre-existing untracked `docs/reviews/2026-11-23-codex-ux-sweep-8/` directory. No fixes, registry edits, commits or pushes were made, per findings-only scope.

`driver.cjs` and `quick.cjs` connect to the supplied browser, never launch one. Start either with Node from the repo root. The main driver accepts `return await runfile('confirm-course.cjs');` after the course has been imported; `quit` closes its context. Both drivers have command/time bounds. `library-evidence.json` preserves the tested notes and review log as a read-only copy.
