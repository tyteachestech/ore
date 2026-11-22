# Mac UX sweep — round 2

Tested the supplied release build at `http://localhost:1761/`, bridge `1762`, in the supplied WebKit browser, at 1280×800 with 2× screenshots. Repository revision: `c839b84fdf8b18666ffba4301d517a0be11181bd`. Used only the assigned `codex-out/libs/mac` library, with every library write made through the app. Covered source and skill notes, tutor failure/retry and saved history, Add, finding and organizing sources, collection rename/reorder/collapse, skill goals and badges, Importance, Dig, and keyboard dispatch. Skipped iPhone, pure visual taste, the specified known issues, native OS effects, live AI, and round 1's already-covered collection creation/deletion and Forge mutation paths. Three new findings below were each reproduced twice and checked against the application code. No repository source or documentation was edited; all tester-written artifacts are in `codex-out/mac/`.

## Findings

### 1. New chat discards a conversation after its save fails

**S1 — data loss. Mac.**

1. From a fresh page, open the tutor on Home.
2. Inject a chat-write failure: `window.__ORE_FAIL = { chat: "Test: chat write refused" }`. Use the supplied `__ORE_REPLY.tutor` hook for a normal-shaped answer; `tutor-save-fail.cjs` contains the exact fixture and never runs AI.
3. Send a new question. Wait for the reply and the write-error toast.
4. Clear the failure (`window.__ORE_FAIL = {}`), then click **New chat**.
5. Open **Chats** and look for the conversation just left.

**Expected:** Retain the unsaved conversation and offer to retry saving it, or successfully save it before replacing it. A failed disk write should not make changing chats destroy the only remaining copy.

**Actual:** The question and reply are replaced by an empty chat. The old conversation is absent from Chats and from the library's chat files. The error toast offers no save retry. Clearing the fault before pressing New chat does not recover it.

**Reproduced:** 2/2 fresh-page journeys. The write failure is injected; the clearing and loss are application behavior, not an empty AI response.

**Evidence:** [failed save 1](chat-save-refused-1.png), [missing chat 1](chat-lost-1.png), [failed save 2](chat-save-refused-2.png), [missing chat 2](chat-lost-2.png), [script](tutor-save-fail.cjs), [saved library evidence](library-evidence-before-remaining.json).

**Code:** `apps/desktop/src/Tutor.tsx:139` catches a save failure by showing a toast, without retaining a retryable pending save. `save` at line 140 snapshots the chat only for that write. `fresh` at line 313 then clears the turns, context and chat identity unconditionally (lines 315–317). A successful saved-chat reopen worked in separate journeys, so this is specifically the failed-save path.

### 2. Undo during a goal save removes the previous goal instead

**S2 — wrong everyday Undo behavior. Mac.**

1. From a fresh page, open **Learning** in the sidebar.
2. Set its goal to **Explain retrieval practice baseline** and press Enter. Let the save finish.
3. Edit the goal to **Apply retrieval in a workshop**.
4. Set `window.__ORE_SLOW = { skills: 1800 }`, press Enter, then immediately press ⌘Z.
5. Wait for the writes, clear the delay, go Home, and reopen Learning.

**Expected:** Undo the second edit and restore **Explain retrieval practice baseline**.

**Actual:** Undo takes the first edit off history. In both runs, the skill began without a goal and ended without one: **What could you show you can do?** The baseline goal is lost instead of restored, and reopening confirms that result. The new edit joins history only after the wrong Undo has already started.

**Reproduced:** 2/2 fresh-page journeys with the response delayed by 1.8 seconds.

**Evidence:** [first result](goal-pending-undo-1.png), [first reopen](goal-reopened-1.png), [second result](goal-pending-undo-2.png), [second reopen](goal-reopened-2.png), [script](goal.cjs), [saved skills evidence](library-evidence-before-remaining.json).

**Code:** `apps/desktop/src/SkillPage.tsx:413` closes the goal editor immediately; line 420 awaits the write, and lines 423–424 register Undo only afterward. The mock delays the reply after a real CLI write; it does not implement Undo or choose which history entry is undone.

### 3. Icon and colour Undo also skip the change still saving

**S2 — wrong everyday Undo behavior. Mac.**

1. From a fresh page, open Learning and its icon picker.
2. Choose **brain**, let it save, then choose **bulb** and let it save.
3. Set `window.__ORE_SLOW = { skills: 1600 }`.
4. Choose **book**, then immediately press ⌘Z. Wait and clear the delay.
5. The same sequence works with colours: save **red**, save **blue**, delay the **green** write by 1.2 seconds, dismiss the picker with Esc, and press ⌘Z.

**Expected:** The last icon change undoes to **bulb**; the last colour change undoes to **blue**.

**Actual:** The icon returns to **brain**, and the colour returns to **red**. Undo skipped the pending change and reversed the preceding completed change.

**Reproduced:** Icon 2/2; colour 2/2, each from a fresh page.

**Evidence:** [icon 1](badge-undo-1.png), [icon 2](badge-undo-2.png), [colour 1](colour-undo-1.png), [colour 2](colour-undo-2.png), [icon script](badge.cjs), [colour script](skill-remaining.cjs).

**Code:** `apps/desktop/src/SkillPage.tsx:289` handles both icon and colour. It awaits `ore skills set` at line 292 and adds the Undo entry at line 294. This is a separate handler from the goal's save, with the same late-history registration.

## Known rows seen again

None confirmed as regressions. Findings 2 and 3 are additional save handlers with the same general failure pattern as F146, F156 and F459; they do not re-report those fixed skill-name, source-title or Forge paths. The explicitly excluded open rows were not re-reported.

## What passed

- Source notes: typing, bold, `[[` links, table cells and Tab, `/to-do`, rich paste, ⌘Z/⇧⌘Z, navigation/reopening, and failed-save recovery; checked twice and inspected the [saved Markdown](notes-evidence.json).
- Skill notes: the same editing journey, a write still pending during navigation, and a failed save followed by reopening; both drafts survived and later saved, twice.
- Linked from: source → skill and skill → source links appeared in the destination's backlinks.
- Tutor: source and @Learning chips, an injected response failure, Try again, a 24-section fixture reply, New chat after a successful save, and reopening the long saved chat; twice. Real AI quality was not tested.
- Add: a refused link retained its input and gave an error; replacing it with text succeeded; repeat submit during a delayed add produced one source; a Markdown file selected through the mocked native picker imported, twice.
- Add link: a live Anthropic article imported with its text and outline; adding the same link again reopened it with “already here”.
- All sources: search, Article filtering and clearing it, right-click and ⋯ menus, pinning, Rename Esc cancellation, Rename Enter with a delayed write, multi-selection, archive during a delay and immediate Undo; twice.
- Find: matching text, Enter/Shift+Enter and ⌘G/⇧⌘G navigation, and Close; outline hover and section jump; twice.
- Sidebar: collection rename with immediate Undo during a delayed save, Move up with Undo, collapse and expansion; twice.
- Importance: Light changed during a delayed write and immediately undone returned to Normal; twice, with P2 verified in the saved skills file.
- Dig: an unfinished draft survived Esc/reopening, Done kept the writing in the skill note, and the dialog remained closable; twice. Forge navigation opened the expected view; its mutation paths were left to round 1.

## Coverage details and limits

- `run.cjs` opens one page in one context and closes both on success or error. `keyboard.cjs` uses one context and one fresh page at a time; every loop is bounded. No server or browser was launched or stopped.
- Synthetic rich-paste events test Ore's paste handling, not macOS's system clipboard. The file picker is the supplied `__ORE_PICK` hook.
- `__ORE_SLOW` delays a command's response after the real CLI operation. The reported Undo failures therefore prove history ordering without relying on reordered or fabricated library writes.
- Exploratory timeout screenshots are not findings: the row ⋯ needs a row hover, colour swatches have radio roles, and the collapsed outline must be hovered before its concealed labels are clicked. Those harness mistakes were corrected before completed journeys.
- The shortcuts sheet was inspected from Home and a source. [Final inventory totals](keyboard-coverage.json) show no remaining harness errors. The keyboard sweep invokes all 135 configurable bindings plus 20 fixed-key combinations once in each context (310 invocations total). Results include the resulting text, dialogs, focus and CLI calls in `keyboard-*.json`. Diagram, review, media, highlight and note bindings were also invoked in these two contexts; a no-op outside their relevant surface is expected, not a missing shortcut. This is not a full diagram or review shortcut audit. Native clipboard/Finder/speech/global-shortcut effects cannot be verified by the bridge.
- The Home paste shortcut created a second source with the copied source’s title. Later keyboard setup was changed to identify the seeded source by its stable row ID; selector failures from the duplicate title were harness errors, not app findings.
- No separate arbitrary sort chooser was present. Ordering coverage was pin-to-top and collection Move up/Undo; round 1 already covered source organization more broadly.
