# Reader UX parity audit

**No new confirmed, in-scope findings.** 80 checklist rows were attempted twice in Chromium and twice in WebKit. After focused retests, 75 have repeatable outcomes: **67 works, 6 missing, 2 differs** against the literal reference checklist. **Seven mismatches are excluded by Ore decisions; one has an uncertain reference and is not a finding. Five rows remain untested.** Confirmed finding classes: **A 0 / B 0 / C 0**.

The raw mismatch totals describe parity, not proposed fixes. The decided differences below must not be reopened as bugs.

## Scope and evidence

- Repository commit: `29b12bc9aeb3acd603a2611e21b5336566a871a1`. Git status was clean before and after. No repo edits, commits, stashes, installations, or server changes.
- Browser mock: `http://localhost:1520/`, bridge `1521`, permitted scratch library `/tmp/ore-ux-reader`. Init scripts installed before navigation. The existing fake-player listener on `1522` was observed; it was not started or changed.
- **Audio was tested, video was not.** The seed’s playable source is **Lecture 4 the testing effect**, a 60-second WAV. Neither To read nor Done contained a video. Rows 64–80 report the shared reader/player behavior on this real audio element; they do not verify YouTube embedding, iframe focus, video picture behavior, captions, or video-specific failure/resume. Those video paths remain untested.
- Source fixtures were added through the app, including paragraphs, headings, lists, tables, code, links, footnotes, a no-heading source, and long documents. All task artifacts are in this directory. Test library state remains available for reproduction.
- Actual pointer drags, clicks, right-clicks, keyboard input, undo/redo, and native clipboard copy/paste were used. Multiline fixture setup used `keyboard.insertText` to avoid Enter submitting the add dialog mid-fixture. No synthetic DOM input events were dispatched. DOM reads measured outcomes; built-in mock failure/delay controls exercised error/loading states.
- Every screenshot uses `deviceScaleFactor: 2`. Standard viewport 1280×820; supported minimum 720×480. Width 480/660 and height 260 checks are explicitly stress cases below the app’s configured minimum, not evidence of a supported-size layout defect.
- [evidence.json](evidence.json) contains the selected four observations for each checklist row. Original run/retest JSON and scripts remain alongside it. Earlier harness problems—double-click timer shorter than 500 ms, collapsed groups, a “No outline…” fixture matching a partial title, missing clipboard permission, and timestamp seeking that already starts playback—were corrected or marked untested, not promoted to findings.
- [checklist-initial.md](checklist-initial.md) was written before opening Ore or reading its UI source. [checklist.md](checklist.md) preserves the same 80 behaviors with the documented certainty correction for item 12. Reading-page conventions, [excluded journey names](excluded-journeys.txt), and [matching decisions](decision-filter.txt) were reviewed before classification. Existing tests were used as navigation guidance, not as a substitute for live input.

## Every checklist item

C = Chromium; W = WebKit. “2/2” means two matching observations after correcting test setup. A native-menu/opening limitation is an attempted but **untested** outcome. The certainty column describes the reference, not confidence in observing Ore.

| # | Certainty | Reference behavior | Result | Engines | Observation / disposition |
|---|---|---|---|---|---|
| 1 | sure | Readwise Reader: Dragging within a paragraph selects exactly the text traversed and offers highlighting. | works | C 2/2, W 2/2 | One paragraph; exact phrase visibly highlighted. |
| 2 | sure | Readwise Reader: Dragging across paragraphs creates one contiguous text selection suitable for highlighting. | works | C 2/2, W 2/2 | One range spans the end of one paragraph and start of the next. |
| 3 | sure | Apple Books: Double-click selects a word and makes annotation available. | works | C 2/2, W 2/2 | Waited beyond the 500 ms double-click/third-click window; the word is highlighted. |
| 4 | sure | Apple Books: Triple-click selects a paragraph without including reader controls. | works | C 2/2, W 2/2 | The paragraph is selected as one passage. |
| 5 | unsure | Readwise Reader: Shift-click extends an existing text selection to the clicked location. | works | C 2/2, W 2/2 | Shift-click extended the range through “quiet rooms.” |
| 6 | sure | Apple Books: Shift+Arrow extends a text selection without activating unrelated commands. | works | C 2/2, W 2/2 | Shift+Right extended native selection “Violet” to “Violet ” before the highlight timer. |
| 7 | sure | Readwise Reader: Escape dismisses a selection toolbar without creating a highlight. | works | C 2/2, W 2/2 | Esc removed the untouched fresh highlight and closed its popup. |
| 8 | sure | Readwise Reader: A selection near the top of the viewport retains accessible highlight actions. | works | C 2/2, W 2/2 | Top-edge popup remained inside 1280×820. |
| 9 | sure | Readwise Reader: A selection near the bottom of the viewport retains accessible highlight actions. | works | C 2/2, W 2/2 | Bottom-edge popup remained inside 1280×820. |
| 10 | sure | Readwise Reader: A selection near either horizontal viewport edge retains accessible highlight actions. | works | C 2/2, W 2/2 | Both left and right edges exercised at 480×600; popup clamped to x=10 or x=110. Below-minimum-width stress test. |
| 11 | sure | Readwise Reader: A selection in a short window retains accessible highlight actions. | works | C 2/2, W 2/2 | 900×260 stress window; the 360×88 popup remained reachable. Below-minimum-height stress test. |
| 12 | unsure | Readwise Reader: Tab can reach the selection toolbar's available actions. | differs — unsure, not a finding | C 2/2, W 2/2 | Tab enters Note; further Tab and Shift+Tab remain in Note. Reference certainty downgraded; see U1. |
| 13 | sure | Readwise Reader: Selecting text in a heading can create a highlight on that heading. | works | C 2/2, W 2/2 | Heading passage highlighted. |
| 14 | sure | Readwise Reader: Selecting text in a list can create a highlight on that list text. | works | C 2/2, W 2/2 | List-item passage highlighted. |
| 15 | unsure | Readwise Reader: Selecting text across table cells can create a highlight retaining readable cell text. | works | C 2/2, W 2/2 | Saved/listed passage keeps “Cedar \| Sturdy shelter”; DOM Range.toString() alone misleadingly concatenates the cells. |
| 16 | unsure | Readwise Reader: Selecting code can create a highlight without losing the selected code characters. | works | C 2/2, W 2/2 | Selected code characters retained. |
| 17 | sure | Readwise Reader: Creating a highlight immediately marks the selected passage. | works | C 2/2, W 2/2 | Selected passage visibly marked after the drag. |
| 18 | unsure | Readwise Reader: Command+Z undoes a just-created highlight. | works | C 2/2, W 2/2 | Creation reversed. |
| 19 | unsure | Readwise Reader: Shift+Command+Z restores an undone highlight. | works | C 2/2, W 2/2 | Creation restored. |
| 20 | sure | Kindle: Changing an existing highlight's annotation style updates that highlight rather than creating a duplicate. | works | C 2/2, W 2/2 | The passage changed from plain highlight to Key point. |
| 21 | unsure | Readwise Reader: Undo reverses an annotation-style change. | works | C 2/2, W 2/2 | Type returned to plain highlight. |
| 22 | unsure | Readwise Reader: Redo reapplies an annotation-style change. | works | C 2/2, W 2/2 | Type returned to Key point. |
| 23 | sure | Kindle: Adding a note to a highlight keeps the note attached to that passage. | works | C 2/2, W 2/2 | Attached note retained its multiline text and URL; Shift+Enter inserted a line, Enter closed/saved. |
| 24 | unsure | Readwise Reader: Undo reverses a saved highlight-note edit. | works | C 2/2, W 2/2 | Saved note cleared by app undo. |
| 25 | unsure | Readwise Reader: Redo restores a saved highlight-note edit. | works | C 2/2, W 2/2 | Saved multiline note restored by redo. |
| 26 | sure | Apple Books: Adjusting a highlight boundary changes its extent without creating a second highlight. | works | C 2/2, W 2/2 | End handle extended the existing passage through “This paragraph”. |
| 27 | unsure | Readwise Reader: Undo restores the previous highlight boundary. | works | C 2/2, W 2/2 | Undo restored the original boundary. |
| 28 | unsure | Readwise Reader: Redo restores an adjusted highlight boundary. | works | C 2/2, W 2/2 | Redo restored the extension. |
| 29 | sure | Kindle: Deleting a highlight removes the visible annotation from its passage. | works | C 2/2, W 2/2 | Passage annotation removed. |
| 30 | unsure | Readwise Reader: Undo restores a deleted highlight. | works | C 2/2, W 2/2 | Deleted annotation restored. |
| 31 | unsure | Readwise Reader: Redo deletes the restored highlight again. | works | C 2/2, W 2/2 | Restored annotation removed again. |
| 32 | unsure | Readwise Reader: Highlighting an overlapping passage has a deterministic result without hidden or unreachable annotations. | works | C 2/2, W 2/2 | Overlapping selection produced the union passage; intentional D117 behavior. |
| 33 | unsure | Readwise Reader: Adjacent highlights remain individually reachable. | works | C 2/2, W 2/2 | Adjacent “Quartz lamps…” and “Indigo sails…” each reopened separately. |
| 34 | sure | Kindle: Selecting an entry in the highlights list jumps to the corresponding passage. | works | C 2/2, W 2/2 | Collected passage opened the matching source highlight. |
| 35 | sure | Readwise Reader: Clicking a passage's highlight exposes its annotation actions. | works | C 2/2, W 2/2 | Click opened the matching highlight popup. |
| 36 | sure | Readwise Reader: Copy on a highlight copies its passage text. | works | C 2/2, W 2/2 | Actual Copy with source → native paste retained passage and source title in both engines. |
| 37 | sure | Apple Books: Command+C copies selected reader text without toolbar labels. | works | C 2/2, W 2/2 | Native word selection from right-click → ⌘C → paste in Find copied only “Violet”. Ordinary completed highlight selections instead use D87 cited copy. |
| 38 | sure | Apple Books: Command+X in read-only source text cannot delete the source passage. | works | C 2/2, W 2/2 | ⌘X did not remove source words. |
| 39 | sure | Readwise Reader: Right-click on selected text offers text-relevant actions. | untested | C ×2, W ×2 attempted | Right-click performed twice/engine; native menu contents are outside headless Playwright DOM/screenshots. |
| 40 | sure | Kindle: Right-click on a highlight offers annotation-relevant actions. | untested | C ×2, W ×2 attempted | Right-click performed twice/engine; native menu contents cannot be certified. |
| 41 | sure | Readwise Reader: Right-click on a link offers link-relevant actions. | untested | C ×2, W ×2 attempted | Link right-click performed twice/engine; native browser link menu cannot be certified. |
| 42 | unsure | Readwise Reader: Right-click on an image offers image-relevant actions. | untested | C ×2, W ×2 attempted | Image right-click performed twice/engine; native image menu cannot be certified. |
| 43 | sure | Readwise Reader: Clicking a source image opens an enlarged view. | works | C 2/2, W 2/2 | Figure grew from column width to 1232 px at the 1280 px viewport. |
| 44 | unsure | Readwise Reader: An enlarged image can be zoomed beyond its initial fitted size. | missing — excluded | C 2/2, W 2/2 | No further + zoom after fitted enlargement. Excluded: D143 specifies fitted enlargement and click/scroll/Esc dismissal. |
| 45 | sure | Readwise Reader: An external article link opens its destination without replacing the reader's source. | untested | C ×2, W ×2 attempted | Clicked twice/engine; tauri.js intentionally makes the native opener a no-op. Staying in the reader does not prove the destination opened. |
| 46 | sure | Apple Books: A footnote reference reveals its target without losing the reader's place. | works | C 2/2, W 2/2 | Footnote click reached its note; internal Back retained the source context. |
| 47 | sure | Readwise Reader: An internal heading link scrolls to its corresponding section. | works | C 2/2, W 2/2 | Internal heading link reached the visible target section. |
| 48 | sure | Readwise Reader: Clicking an outline entry lands with the target heading visible below fixed controls. | works | C 2/2, W 2/2 | Hovered the outline before clicking; target heading landed visibly below the fixed toolbar. |
| 49 | sure | Readwise Reader: An empty outline does not offer meaningless navigation targets. | works | C 2/2, W 2/2 | No outline rendered for the source without section headings. |
| 50 | sure | Apple Books: Find exposes the current match and total match count. | works | C 2/2, W 2/2 | Current/total match count displayed. |
| 51 | sure | Apple Books: Enter and Shift+Enter in Find move forward and backward through matches, including wraparound. | works | C 2/2, W 2/2 | A full forward and backward cycle through all matches returned to the initial count in each engine. |
| 52 | sure | Readwise Reader: Escape closes Find and permits reader keyboard actions again. | works | C 2/2, W 2/2 | Esc removed Find; reader key input could resume. |
| 53 | sure | Apple Books: A query with no matches shows a clear no-results state. | works | C 2/2, W 2/2 | “Not found” appeared. |
| 54 | sure | Apple Books: A changed reading text size stays selected after closing and reopening its control. | works | C 2/2, W 2/2 | 17→18 px changed text size persisted after source navigation; restored afterward. |
| 55 | sure | Readwise Reader: Closing a reader side panel returns its space to the article. | works | C 2/2, W 2/2 | Closing the panel increased reader width from 684 to 1064 px. |
| 56 | unsure | Readwise Reader: A reader side panel can be resized without selecting article text. | works | C 2/2, W 2/2 | Divider drag moved it about 113 px without selecting source text. |
| 57 | sure | Readwise Reader: Going Back from a source and Forward into it restores its reading position. | works | C 2/2, W 2/2 | Back/Forward returned to the same recorded scroll offset. |
| 58 | sure | Readwise Reader: Long article content remains readable and navigable at a narrow window width. | works | C 2/2, W 2/2 | At supported 720×480, with the panel at its maximum 60vw, the final paragraph stayed inside the reader column. |
| 59 | sure | Readwise Reader: Loading a source shows progress rather than an unexplained empty reading surface. | works | C 2/2, W 2/2 | Mock-delayed show command displayed “Opening…”. |
| 60 | sure | Readwise Reader: A source load failure gives a visible error and recovery action. | works | C 2/2, W 2/2 | Mock show failure displayed its error and “Esc back to sources”; leaving and reopening recovered. |
| 61 | sure | Readwise Reader: A long highlights list can reach its last entry without losing access to its actions. | works | C 2/2, W 2/2 | 18–19 highlights; last list row reachable at 480 px height, with Open/Type/Copy/Remove actions reachable. |
| 62 | sure | Readwise Reader / Ore consistency: Toolbar actions expose hover hints, including their assigned shortcuts; Ore uses Hint, never native title. | works | C 2/2, W 2/2 | After clearing prior click/focus state, tested toolbar controls showed Hint text and assigned keys; no native title. Earlier focused-trigger probes were inconclusive, not misses. |
| 63 | sure | Readwise Reader / Ore consistency: Sibling menu actions use a consistent icon convention; Ore uses its dot icon set and no emoji or smooth substitute glyphs. | works | C 2/2, W 2/2 | Source menu siblings consistently text-only; inspected toolbar/popup SVGs use data-sprite dot icons. |
| 64 | sure | YouTube: Space toggles playback when playback controls have focus. | works | C 2/2, W 2/2; audio only | Space played and paused the seeded audio source. |
| 65 | sure | YouTube: K toggles playback when focus is outside an editable field. | missing — excluded | C 2/2, W 2/2; audio only | K did not toggle audio. Excluded: D50 chooses Space, not YouTube’s full key set. |
| 66 | sure | YouTube: J seeks backward ten seconds, clamping at the start. | missing — excluded | C 2/2, W 2/2; audio only | J did not seek audio. Excluded: D50 chooses Left/Right and different intervals. |
| 67 | sure | YouTube: L seeks forward ten seconds, clamping at the end. | missing — excluded | C 2/2, W 2/2; audio only | L did not seek audio. Excluded: D50. |
| 68 | sure | YouTube: Left and Right seek backward and forward five seconds when the player has focus. | differs — excluded | C 2/2, W 2/2; audio only | Left/Right seek −15/+30 seconds, not YouTube’s −5/+5. Excluded: D48–D50. |
| 69 | sure | YouTube: Up and Down adjust volume when the player has focus. | missing — excluded | C 2/2, W 2/2; audio only | Up/Down did not adjust audio volume. Excluded from findings under the requested D48–D50 player-controls boundary. |
| 70 | sure | YouTube: M toggles mute when focus is outside an editable field. | missing — excluded | C 2/2, W 2/2; audio only | M did not mute audio. Excluded from findings under the requested D48–D50 player-controls boundary. |
| 71 | sure | YouTube: A chosen playback speed remains selected when the speed menu is reopened. | works | C 2/2, W 2/2; audio only | 1.5x preset stayed selected when reopened; native audio playbackRate was 1.5. |
| 72 | sure | Snipd: Clicking a transcript segment seeks playback to its timestamp. | works | C 2/2, W 2/2; audio only | 00:30 sought to 30 s and started playback. |
| 73 | sure | Snipd: Transcript following keeps the currently playing segment visible. | works | C 2/2, W 2/2; audio only | Actual scrubber click at 27 s, 2x playback through 35 s: following crossed paragraphs and kept the final spoken-word rectangle below the player and within 480 px. |
| 74 | sure | Snipd: A highlight made from transcript text retains the passage's playback time. | works | C 2/2, W 2/2; audio only | Transcript highlight retained 41 s: tick at 68.3333% of 60 s, Play from here started at about 41.3 s. |
| 75 | sure | YouTube: Playback shortcuts typed into a focused text field do not control playback. | works | C 2/2, W 2/2; audio only | Find-field typing of kjlm and brackets/arrows left playback state/rate alone; typing remained in the field. |
| 76 | unsure | YouTube: An open settings menu consumes its navigation keys without also seeking the media. | works | C 2/2, W 2/2; audio only | Right arrow in speed popover changed rate without seeking. |
| 77 | sure | Snipd: Returning to a previously opened playable source resumes at its saved position. | works | C 2/2, W 2/2; audio only | Return reopened paused at saved ~30 s. |
| 78 | sure | YouTube: A stopped or ended player exposes a way to play again. | works | C 2/2, W 2/2; audio only | Ended/stopped audio could play again from the start. |
| 79 | sure | YouTube: A playback failure shows a useful error state rather than a permanently blank player. | works | C 2/2, W 2/2; audio only | Aborted audio-file request displayed “This recording won’t play here. Its transcript is below.” |
| 80 | sure | Snipd: An audio source supports play/pause and seeking from its transcript without requiring a video image. | works | C 2/2, W 2/2; audio only | Timestamp seek, pause and play worked with no video frame. |

## Findings

**None met all three requirements: repeated in the browser, sure reference behavior, and not already decided/covered.** No A, B, or C change is proposed.

## Uncertain observation — not a finding

### U1 — Item 12: Tab stays inside the highlight note

**Reference: unsure. Provisional class B only if the reference is confirmed and Tyler wants the change.** It changes the popup’s keyboard model, and D133 already establishes typing directly into the note and retaining Tab’s existing meaning.

1. Open one of the `Reader audit …` test articles.
2. Drag-select “Silver birds rest beside the lake.” and release.
3. Press Tab. Focus moves to the popup’s **Note** textarea.
4. Press Tab again, then Shift+Tab. Focus stays in **Note** in both cases; neither reaches a toolbar button.

**Ore:** both directions stay in the textarea, twice in each engine. Escape still closes the popup. Type-changing shortcuts remain available; the observation is specifically about Tab access.

**Reference expectation under test:** Tab would move among Readwise Reader’s annotation actions. Its official documentation confirms keyboard highlighting and note shortcuts, but does **not** establish this exact Tab behavior. The original `sure` label was therefore downgraded to `unsure`. This is not a claim that Readwise definitely behaves differently. [Readwise keyboard/highlight documentation](https://docs.readwise.io/reader/docs/faqs/highlights-tags-notes).

**Likely implementation:** [Reader.tsx:2063](apps/desktop/src/Reader.tsx:2063) explicitly prevents default for Tab in the note. Its popup buttons have `tabIndex={-1}`, including [Reader.tsx:2909](apps/desktop/src/Reader.tsx:2909). This is deliberate implementation, not a missing handler.

**2× screenshots:** [WebKit pass 1](shots/webkit-1-12.png), [WebKit pass 2](shots/webkit-2-12.png), [Chromium pass 1](shots/chromium-1-12.png), [Chromium pass 2](shots/chromium-2-12.png). The screenshot shows the focused note; the sequential focus readings proving the stationary Tab path are in `evidence.json`, item 12.

## Exclusions and limitations

The matrix records excluded results only so every original checklist row is accounted for. They are **not findings**, have no A/B/C assignment, and are not recommended fixes:

- **44:** arbitrary zoom beyond fitted enlargement — excluded by **D143**. Ore’s specified image behavior works in row 43.
- **65–70:** YouTube’s K/J/L, ±5-second arrows, Up/Down volume and M mute — excluded under the requested **D48–D50** boundary. Ore’s chosen Space, −15/+30-second seek, and speed behavior were exercised. YouTube’s alternative keys are documented in its [official shortcut list](https://support.google.com/youtube/answer/7631406). No request to add them is made here.
- No previously covered icon-only hover-hint, Esc-hint, floating-menu-window-edge, or menu-Esc-focus issue is re-reported. The final hover checks passed after clearing prior trigger focus.
- **39–42:** native right-click menu contents were not observable in the headless browser surface. The real clicks were performed, but no menu-option claim is made. A macOS WKWebView/native-menu check is still needed.
- **45:** `tauri.js` intentionally does not execute the native external opener. Clicking and retaining the source does not establish a successful external opening.
- **Video-only paths:** no seeded video source was available, so no YouTube-frame behavior is claimed. Audio checks do not substitute for video-frame tests.
- **Clipboard scope:** source text and cited highlight text were copied and pasted for real. Rich HTML transfer into a separate native destination was not verified. No AI/streaming feature parity was evaluated; reader loading and audio progress/error states were.
- Reference apps were not driven live. The checklist began from known behavior and explicit certainty labels; official documentation was used to challenge uncertain claims, not to invent unobserved Ore behavior. [Apple Books annotation instructions](https://support.apple.com/en-mide/guide/books/ibks3975f128/mac) and [Snipd’s feature description](https://www.snipd.com/all-features) provide additional reference context.

## Selected evidence of completed checks

- [Supported minimum window, WebKit](shots/verify-webkit-2-minimum.png): source remains readable with the side panel at its maximum width.
- [Left-edge popup, WebKit](shots/verified-webkit-2-left-edge.png) and [right-edge popup](shots/verified-webkit-2-right-edge.png): both remain within the stress viewport.
- [Long highlights list/menu, WebKit](shots/list-final-webkit-2-list-menu.png): last of 19 entries and its actions remain reachable in a 480 px tall window.
- [Table highlight, WebKit](shots/repair-webkit-2-15.png): saved passage retains its cell delimiter.
- [Following across transcript paragraphs, WebKit](shots/final-webkit-2-73.png): playback advanced from 27 to about 35 seconds; the current word stayed in view.
- [Transcript highlight time, WebKit](shots/audio-webkit-2-74.png): time retained at about 41 seconds.
- [Loading](shots/webkit-2-loading.png) and [source error](shots/webkit-2-error.png): visible states were injected through the supported mock hooks.

## Totals

| Measure | Count |
|---|---:|
| Checklist rows attempted | 80 |
| Completed with repeated outcomes | 75 |
| Works | 67 |
| Missing against literal reference checklist | 6 |
| Differs from literal reference checklist | 2 |
| Untested rows | 5 |
| Mismatches excluded by decisions | 7 |
| Uncertain mismatch, not a finding | 1 |
| New confirmed findings | 0 |
| Class A findings | 0 |
| Class B findings | 0 |
| Class C findings | 0 |

**Totals: 80 attempted; 75 checked; 67 works; 6 missing; 2 differs; 5 untested. Findings: A 0 / B 0 / C 0.**
