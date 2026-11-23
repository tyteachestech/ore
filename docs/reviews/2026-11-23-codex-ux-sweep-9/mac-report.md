# Mac UX sweep — round 9

Tested the supplied Mac release app at `http://localhost:1761/`, bridge `1762`, in connected WebKit at 1280×800 and 2× screenshots; checkout revision `01bb4985019462bfc039fa0c024f48aa67cef1c8`. Ran two first-hour-style journeys from fresh pages on the same assigned scratch library, each adding three source types, highlighting and noting a source, asking the tutor, creating a skill and filing the sources, reviewing, opening Settings, using ⌘K, and leaving/reopening. Also checked chapter-recall completion and Undo, skill-note position, the Dig, twelve-turn chat persistence, Archive/Restore, library search, keyboard-only review, daily-plan/reminder settings, and links between source notes. Read the working agreements, daily-session design, findings registry, sweep history and previous reports' passed paths. Skipped the excluded issues, Claude Academy, pending-save Undo, iPhone, pure taste, native OS integration and real AI. Routine earlier coverage was used as a short smoke check rather than exhaustively repeated. **One new S2 finding; no S1 or confirmed normal-speed daily-loop failure.**

## Findings

### MAC-1 — A failed chat-list read says “No chats yet” and hides saved conversations

**S2 · Mac · reproduced 2/2 from fresh pages.** A learner trying to revisit an explanation is told they have no chats, when the library read actually failed. There is no error or retry action.

1. Have at least one saved tutor conversation. This run saved two ordinary questions and a twelve-turn conversation named **Long practice chat nine**. In this harness, even an unanswered question is saved; real AI is unnecessary for this reproduction.
2. Open a fresh app page. Open the tutor, then its **New chat** title/caret (accessible label **Chats**). Confirm the saved conversations appear.
3. Press Escape to dismiss the list. Set the supplied failure hook:
   ```js
   window.__ORE_FAIL = { chat: "The library is temporarily unavailable. Try again." };
   ```
4. Open **Chats** again.
5. Clear the hook, dismiss the list, and reopen it to check recovery. Repeat the sequence from another fresh page.

**Expected:** Explain that saved chats could not be loaded and offer a retry. A failed read must remain distinguishable from an empty library; previously loaded entries should not become evidence that no chats exist.

**Actual:** All three saved conversations disappear and the list says **No chats yet**. The supplied error is never shown, and there is no Retry/Try again button. Clearing the fault alone does not explain the state; closing and reopening the list retrieves the same saved conversations. The files remain intact: this is misleading unavailability, not deletion.

**Evidence:**

- First run: [saved chats before failure](chat-list-1-before.png), [false empty state](chat-list-1-failed.png), [recovered chats](chat-list-1-recovered.png).
- Second run: [saved chats before failure](chat-list-2-before.png), [false empty state](chat-list-2-failed.png), [recovered chats](chat-list-2-recovered.png).
- [Both confirmation results](chat-list-confirmations.json), [bounded reproduction snippet](confirm-chat-list.cjs), and [saved-library evidence](library-evidence.json).

**Confirmed code cause:** `apps/desktop/src/Tutor.tsx:1188` handles a rejected `ore("chat")` by setting `rows` to `[]`, discarding the error. Lines **1191–1192** therefore produce no results on a fresh chat; line **1229** renders **No chats yet**. The open handler at **1206** is the available way to repeat the read. This violates the interaction requirement to show errors and a next step.

**Why this is the app, not the mock:** The hook supplies an ordinary rejected CLI request. The production component itself maps every rejection to an empty list. No AI response, fabricated chat-list response, timeout, or modified source code is involved. Successful reads immediately before and after the fault, plus the actual saved chat files, establish that the conversations exist. This is separate from F469/F496, which concern failed chat **writes** while leaving a conversation.

## Known rows seen come back

None confirmed. Chapter-recall **Done**, **Back to the source**, and completed-write Undo worked on the long local chapter fixture (F511/F512). Undo removed its completion record and retained its writing. The Mac skill note retained its position and the Dig worked; F519/F520 concern phone behavior, which was not tested here. F510's video-specific import/recall path was not repeated. The listed open exclusions were not re-reported.

## What passed

- Journey 1 imported **Field practice nine A** as text, **A Small Book of Remembering** as EPUB, and **Retrieval practice notes** as Word; all three appeared under **Recall workshop nine** after bulk filing.
- Journey 2 imported **Field practice nine B** as text, **How Plants Make Food** as PDF, and **Spanish vocabulary** as XLSX; all three appeared under **Transfer workshop nine** after bulk filing.
- Both text sources retained their sentence highlight, highlight note, source note and skill after leaving and reopening; saved Markdown and annotations are in [library-evidence.json](library-evidence.json).
- Both ordinary tutor questions ended with a visible unavailable-response error and Try again, leaving the message field usable.
- Chapter recall offered working Back and Done controls; Undo after completion restored eligibility without deleting the answer ([reopened state](chapter-undone.png)).
- The Dig kept its explanation under a dated heading in the skill note and allowed dismissal ([saved Dig](dig-saved.png)).
- A 35-section skill note reopened at exactly `scrollTop: 1750`, its previous position ([skill note](skill-note-place.png)).
- A twelve-turn tutor chat scrolled to its beginning, reopened from Chats, survived deletion/Undo, and reopened from a fresh page with all twelve replies and focus in the composer ([fresh-page reopen](long-chat-fresh-page.png)); the saved file also has twelve turns and replies.
- Two source Archive → Archived → open → Restore journeys retained writing, highlights, filing and links; each source reopened after restoration ([second restore](archive-restore-2.png)).
- A refused archive displayed the refusal and left the source available in All sources; retry after clearing the fault succeeded.
- Archived source text disappeared from ⌘K search, and restoration made it findable again.
- ⌘K found separated words in source text, source-note text, and highlight-note text, opening the matching passage, note, or annotation ([search script](search-links.cjs)).
- All sources search found a source-note phrase, opened that note, and Back restored the exact query and matching result ([list search](list-note-search.png)).
- A `[[` source link saved as an ID-based Markdown link, opened its target on one click, appeared in the target's Linked from section, and the backlink opened the original source ([link](note-link-opened.png), [backlink](backlink-opened.png)).
- Five ratings saved across the two journeys, entirely by keyboard: one in the first and four in the second, including Explain and New. Confidence keys, reveal, rating keys, ⌘Enter and Escape worked; Explain's unavailable grading still allowed a manual rating.
- Review displayed its prior-review line and next-review estimate after reveal; no comprehensive source-wide exercise-history browser was tested. Once the queue was complete, Review this source explained that nothing was due.
- Review endings returned to Home, which reflected saved time and the no-more-due state ([second ending](j2-review-end.png)).
- Settings saved **After my morning walk, I review** and **8:30 AM**, and both survived a fresh page. Escape discarded a later plan draft; Undo after a completed plan change restored the previous plan ([plan Undo](settings-plan-undo.png)).
- No page errors were recorded, and the final page had zero outstanding bridge calls.

## Observations and limits

- Fresh pages reused the assigned seeded scratch library. These were two new-source journeys, not two empty-library resets. The seed supplied the due exercises because enrichment was disabled.
- Three points needed checking rather than immediate reporting: Escape in a populated palette clears its query before closing it; an Explain answer with no confidence selected moves focus to that choice; opening a skill can retain the selected Archived tab. None established an app defect. Only one candidate survived triage, and that one received two dedicated confirmations.
- The long conversation used `__ORE_REPLY` with canned text to exercise layout and persistence. AI quality, long-chat model memory and real streaming were not tested. The ordinary tutor and grading fallback checks used the supplied null AI behavior.
- Native reminder firing, notifications, global shortcuts, Finder's picker, clipboard delivery and installed-app behavior were not tested. File selection used `__ORE_PICK`; imports and saved changes went through the app and real CLI. The long skill-note paste used a synthetic clipboard event; reader highlighting used a pointer drag.
- Review timing was inspected in `Review.tsx`: elapsed time is capped at three minutes per exercise (`ACTIVE_CAP_MS` at line 53; accumulation at 747/753). No accelerated-clock or bonus-lap test was run.
- Exploratory selector mistakes, submitting before a menu's results loaded, and the palette's two-stage Escape behavior caused automation timeouts. They were corrected and are not findings. The initial non-TTY driver immediately reached stdin EOF and closed its context; the interactive driver then used one context and one page at a time.
- [driver.cjs](driver.cjs) connects to the supplied WebKit server and accepts snippets such as `return await runfile('confirm-chat-list.cjs');`; `quit` closes its context and disconnects. Its command loop is capped at 180, and all journey loops have fixed counts. [actions.log](actions.log) retains the exploratory commands.
- No source files, findings-register rows, other testers' resources, real library, installed app, servers or watchers were changed. No commits or pushes were made under the findings-only instruction. Git status retained only the pre-existing untracked round-9 prompt directory; all tester-authored output is inside `codex-out/mac/`.
