# Architecture review, 2026-11-13

Codex (Matt Pocock's improve-codebase-architecture skill), report only: no code changed. Four deepening opportunities ranked by leverage, for Tyler to pick from or leave. Decisions in docs/DECISIONS.md stand; each proposal names the ones it keeps.


2026-11-13 · report only · checkout `00ac41434056ba196ceb7bdcf013a7f9af151edb`

**Start with Review's session lifecycle.** Its caller must coordinate persistence, queue changes, undo, and closing in the right order. Put that knowledge behind one interface before moving presentation code around.

## Scope and method

Read `AGENTS.md`, `CLAUDE.md`, `GLOSSARY.md`, the relevant settled decisions in `docs/DECISIONS.md`, `docs/SPEC.md`, `docs/WORKFLOW.md`, `docs/design/daily-session.md`, and the outcome section of `docs/research/reward-loop-audit.md`. Used the mattpocock-skills `improve-codebase-architecture` workflow and its `codebase-design` vocabulary, including an independent fresh-context code walk. The task prompt overrides the skill's temporary-directory destination, deferred interface design, and follow-up grilling: both reports live here, proposals include interfaces, and this review ends at delivery.

The Git window is the fourteen days ending at this checkout's last commit: **2026-10-30 19:09:05 UTC through 2026-11-13 19:09:05 UTC**. Counts below are non-merge commits reachable from HEAD touching each path, not lines changed or distinct fixes. There are **480 non-merge commits** in that window. Branch history can count separate commits implementing related work; these numbers identify attention, not quality.

| Path | Touching commits |
|---|---:|
| `apps/desktop/src/styles.css` | 174 |
| `apps/desktop/src/App.tsx` | 89 |
| `apps/desktop/src/Reader.tsx` | 86 |
| `apps/desktop/src/Review.tsx` | 65 |
| `apps/desktop/src/ore.ts` | 40 |
| `packages/core/src/ingest/index.ts` | 27 |
| `apps/desktop/src/phone/core.ts` | 24 |
| `packages/core/src/study.ts` | 11 |
| `packages/core/src/ingest/pdf.ts` | 11 |
| `apps/desktop/src/Mole.tsx` | 9 |
| `packages/core/src/sessions.ts` | 8 |
| `apps/desktop/src/end-says.ts` | 6 |
| `apps/desktop/src/CartTip.tsx` | 4 |
| `apps/desktop/src/mole-fine.ts` | 4 |

Reviewed the requested Review, App, ending, Mole, and core paths first; followed their actual callers and tests. Reader and stylesheet churn did not expand this into a whole-interface redesign. Evidence is source inspection and existing test inspection. **No tests, benchmarks, or app sessions were run.** Proposed verification below is future work, not a claim of passing checks. No implementation, decision, glossary, or findings files were edited; no commits were made.

A **deep module** hides substantial behavior behind a small **interface**: everything callers must know, including ordering and failures. A **seam** is where behavior can be substituted; an **adapter** supplies an implementation there. **Leverage** means callers learn less to do more; **locality** means changes and their verification concentrate in one place. These rankings weigh those gains against migration cost, not file size.

## Ranked findings

| Rank | Opportunity | Strength | Main payoff |
|---|---|---|---|
| 1 | Own Review's session lifecycle | Strong | Save, undo, queue, and close obey one contract |
| 2 | Return exact changes from source capture | Strong | Undo uses changes core actually made |
| 3 | Give the end screen ownership of its whole sequence | Strong | Cart, ring, gems, and Mole share one implementation |
| 4 | Own list-write ordering and refresh together | Worth exploring | Remove repeated asynchronous ordering protocols |

### 1. Own Review's session lifecycle

**Modules involved.** `apps/desktop/src/Review.tsx`, `ore.ts`, `history.ts`; existing persistence in `packages/core/src/study.ts`, `sessions.ts`, and `reviews.ts`. The core modules keep ownership of library writes and FSRS. The proposed module belongs with the shared desktop/phone Review implementation, not inside the renderer or FSRS.

**Friction encountered.** To establish when one rating becomes the next exercise, I had to trace session startup (`Review.tsx:244–283`), finish (`400–428`), queued undo presses (`437–458`), rating and goal behavior (`583–640`), save/history registration (`644–678`), undo/reopen (`682–719`), and Later (`737–794`). `sessionReady`, `busyNow`, queue snapshots, retired/put-off sets, and mounted-state fallbacks form an interface carried by convention inside closures. `submit` moves the queue, while `rate` subsequently decides whether the goal notification or an extra likely recall is due. Undo restores those choices separately. This is coordination knowledge, not just a long JSX file.

**Proposed deeper interface.** One Review-session module exposes a current snapshot and explicit actions: start, record the learner's rating, put the current exercise off, undo/redo a session step, and close. An illustrative shape is `session.rate(answer)` / `session.later(shownAnswer)` / `session.close(reason)`, with history callbacks supplied by the module. The snapshot gives the current exercise, pending/error state, goal notice, and ending data; it does not expose setters for each internal flag. Keep grading, text editing, focus, and keyboard-to-action mapping in Review.

The implementation owns session IDs, active-time bookkeeping, queue advancement, prefetch invalidation, and action ordering. A failed save leaves the exercise and time unchanged. A duplicate press cannot create another write. Closing during startup closes that exact session after it starts. Undo after the ending reopens the same session; a history action after unmount changes the log without resurrecting the screen. Partial success, such as an undo saved before reopen fails, must remain represented so a retry resumes the unfinished operation rather than assuming rollback. Preserve existing transport/storage behavior; this proposal does not promise a new cross-command transaction.

**What it deletes.** Remove Review's orchestration versions of `sessionReady`, `whenIdle`, `undoNow`/`redoNow`, `undoLaterNow`/`redoLaterNow`, and the save/advance/finish/restore protocol spread through the handlers. State still needed by the behavior moves into the implementation; it is not claimed as deleted functionality. Keep the app's existing history module. Do not replace this with a hook returning the same dozens of setters: that fails the deletion test.

**Seam, adapters, and depth.** Local-substitutable coordination over the existing `ore` command seam. The desktop Tauri command adapter and phone in-process adapter already exist (`ore.ts:25–42`); a controlled command adapter can hold and reject writes in tests. Do not introduce a general command bus. Depth comes from hiding operation order, not hiding the name of `ore`.

**Tests.** Exercise the same session interface with delayed start, failed rating, two same-turn ratings, close while saving, undo while closing, reopen failure, redo after unmount, Later on the last eligible exercise, and retiring an exercise before undoing an older rating. Assert visible snapshots and recorded commands/results. Preserve the core replay/two-window tests in `packages/core/test/study.test.ts:68–236` and browser journeys at `apps/desktop/e2e/journeys.ts:7038`, `7066`, `7112`, `7166`, `7266`, `8554`, `8572`, and `10589`. Retain browser coverage for focus, key ownership, and phone timing; do not delete it because a session test passes. Replace only orchestration assertions fully covered through the new interface.

**Leverage and locality.** One implementation serves full Review, quick quiz, and phone Review. A change to goal continuation or undo has one place to implement and verify. Preserve D21/D22, D59, D76, D177 as amended by D246, D192, and D235: user-selected ratings, immediate log writes, unchanged FSRS, full Review continuing after the goal, quick quiz stopping, and Later recording nothing. No new screen element.

### 2. Return exact changes from source capture

**Modules involved.** `packages/core/src/ingest/index.ts`, `ingest/course.ts`, `courses.ts`; `packages/cli/src/cmd-items.ts`; `apps/desktop/src/App.tsx`, `ore.ts`, and the phone command adapter where needed.

**Friction encountered.** Core knows which sources it changes, but App reconstructs their inverses. `App.tsx:447–455` builds undo/redo closures from filed skills and a restored flag; `480–507` separately interprets course and single-source results; `544–551` combines those with newly added IDs. For courses, `ingest/course.ts:188–194` changes each existing lesson's skills and restores only archived lessons. Its result retains only aggregate `filed` and `restored` information (`161–172`, `221`); the CLI passes those aggregates through (`cmd-items.ts:82`). App's inverse uses whole-course setters (`App.tsx:493`), and those setters touch every lesson (`courses.ts:26–35`).

This is a concrete information loss: a count of restored lessons cannot identify them. The dedicated course actions already preserve per-lesson differences (`App.tsx:1606–1617`; browser journey `9448`). Mixed lesson states on re-add therefore deserve a failing regression test before any fix. This review identifies the static mismatch; it did not reproduce its UI outcome.

**Proposed deeper interface.** Keep existing import entry points. Add an ephemeral, serializable capture-change receipt to their result, plus a narrow core operation such as `applyCaptureChanges(lib, receipt, "undo" | "redo")`. The receipt records exact source IDs and before/after values for fields actually changed, distinguishes newly created sources from existing ones, and records skill revival when the operation owns it. Core validates and applies it through its existing write functions. The CLI transports it; App registers it with history and supplies toast wording, progress, navigation, and the skill picker.

Undo of new sources still archives them; redo restores them without downloading again. Existing sources regain only the metadata this capture changed. A course's failed lessons remain retryable, and successes remain usable. This is **not** a persistent journal, a new course file, a generic arbitrary-patch language, or a new promise to undo page-text backfills. Preserve current backfill semantics unless separately approved. For intervening edits/sync, validate the affected field against the expected side of the receipt and report a conflict instead of overwriting newer content. Partial application must identify remaining work; do not claim atomic multi-file undo without implementing it.

**What it deletes.** Delete App's `again` function's inverse construction, `setSkills`/`setArchived` callback parameters, course-wide inverse guessing, and separate `revert`/`redo` closure arrays for capture changes. Keep the human-readable messages and batch progress loop. A receipt that merely wraps those same guessed commands adds indirection and fails the deletion test.

**Seam, adapters, and depth.** Local-substitutable core module with real temporary libraries in tests. Actual library files are canonical; no filesystem abstraction is needed just for this proposal. The existing CLI and phone command adapters carry the result. Remote page acquisition stays in the current importers; saved fixtures or the existing local fixture server keep tests deterministic.

**Tests.** Through capture and its inverse interface, re-add a course with one archived and one active lesson and different skill sets; verify exact per-lesson restoration. Cover a mixed batch of new and existing sources, a course with one failed lesson, redo without refetch, duplicate input, and metadata edited after capture. Verify source IDs, source content, exercise filing, and archive/skill state on disk. Extend the existing intake/course fixture cases and grid where the import contract changes, preserving golden `doc.md` output. Retain journey `9448` and add a re-add/Undo journey through Add; the dedicated course-menu journey does not prove that path.

**Leverage and locality.** Core writes and describes each capture change once; desktop history stops reverse-engineering it. Preserve D79 (a course is its lessons), D96/D122 (whole-source import), D109 (when a source opens), D173 (skill revival), and D227 (phone import and owed transcripts). The latter is an explicit amendment: this report does not reinterpret D122 to remove supported owed transcripts. No new learning-screen UI.

### 3. Give the end screen ownership of its whole sequence

**Modules involved.** The ending inside `Review.tsx:1515–1755`, `CartTip.tsx`, `Ring.tsx`, `Gem.tsx`, `Mole.tsx`, `MoleSays.tsx`, `EndMark.tsx`, and `end-says.ts`.

**Friction encountered.** The end screen owns `stage`, `landed`, `settled`, `fell`, and `tallied`, and translates five CartTip callbacks into timing decisions (`Review.tsx:1607–1627`, `1662–1705`). CartTip's declared interface omits essential knowledge: it queries the parent's `.ring .dot-ring`, `.review-body`, `.review-cut > span .gem`, and `.review-mole` (`CartTip.tsx:62`, `141`, `156`), then directly marks ring dots as on (`133`). Understanding a markup change requires reading the cart's physics and fallback callback order. The shallow seam is between the end screen and cart, not the Mole drawing interface.

**Proposed deeper interface.** Make a dedicated ending module own the entire scene. Review supplies the existing ending data, skills, full/quick mode, and Done/Keep going/Try actions. Keep that already-small outer interface. Place cart coordination and its ring/gem/Mole targets inside the implementation, with explicit private refs instead of undocumented queries into another module's markup. The ring, gems, marks, and Mole remain reusable drawing modules. `endSays`, `endTiles`, and `endMood` remain pure internal collaborators; do not merge their deliberately different rare-result orders.

A scene starts once for the ending receipt. Random entrance/copy choices are sampled once, not on rerender. Missing geometry settles to a usable ending; reduced motion uses the existing settled presentation. Unmount cancels animation/timers. Five private arrival events may still be necessary: replacing them with a generic event bus is not a gain. What disappears is the requirement for Review and CartTip callers to coordinate them. No new timing, animation, or visual design is proposed.

**What it deletes.** Delete the standalone cross-module cart choreography contract and its parent-markup selector dependency; remove ending choreography from the Review module. Keep necessary physics, rendering, and callbacks private to the scene. Merely extracting `EndScreen.tsx` while leaving the same cross-module selector/callback contract intact would improve file navigation but would not deliver the proposed depth.

**Seam, adapters, and depth.** In-process scene with a private browser animation seam. Real DOM/Web Animations and the deterministic test clock are two justified adapters. Avoid an application-wide animation framework. Dependency tests can control time and randomness within the scene; callers only provide the session outcome.

**Tests.** Preserve the existing mounted tests in `apps/desktop/test/end-screen.test.tsx`; they already test real ending behavior and cleanup, not only helper arithmetic. Test through the scene interface for both cart entrances, ring-only/gem-only/no-pour outcomes, capped gems plus polished gems, three-result ordering, then-and-now, quick mode, reduced motion, missing targets, and unmount mid-flight. Keep motion geometry/browser checks: the current test setup stubs `Element.animate` (`end-screen.test.tsx:18`), so it cannot prove actual trajectories. When implemented, use the required 2× screenshots, 4× crops, interaction check, and motion review. That is a verification need, not a claim that the visuals are broken.

**Leverage and locality.** Recent changes to ending layout, entrance, speech, and marks stop sharing Review's learning-session implementation. Preserve D190, D239, D242 as amended by D252, D245, D248, D255, D257–D261. Keep the settled single line, result row, existing animations, and one traced Mole. Add no controls or decoration.

### 4. Own list-write ordering and refresh together

**Modules involved.** `apps/desktop/src/App.tsx`, `reads.ts`, `history.ts`, and the existing `util.ts` write-order helper.

**Friction encountered.** App's local `inOrder` (`316–329`) combines a promise queue, `readGuard.writing`, and refresh after the newest queued write. Sidebar `arrange` implements a second queue and refresh protocol (`1495–1514`). Pin (`1731–1747`) and filing (`1774–1805`) separately coordinate optimistic state, undo registration before completion, failed-step removal, and refreshing. Meanwhile `util.ts:292–301` has a keyed queue that deliberately does less. These are not interchangeable implementations merely because two share the name `inOrder`.

**Proposed deeper interface.** A narrow list-edit module owns write ordering, read freshness, and publish-after-settle for a list. Expose `refresh()` and submitting a reversible edit with its affected IDs, before/after values, and existing persistence function. Its implementation registers history, schedules the forward/inverse write, publishes the optimistic result, and reconciles the newest authoritative read. The screen chooses the edit and selection/focus outcome; it must not manually pair `writing`, `begin`, `lands`, and refresh.

Start with source archive/restore and sidebar arrangement as the two actual protocols to validate. Preserve their distinct serialization scopes: same action/object order where needed, complete sidebar layout order for arrangement. A hung unrelated write must not freeze every list. A failure reports through history and permits the next operation. Do not roll pinning, filing, every editor, and navigation into the first migration.

**What it deletes.** Replace App's local queue bookkeeping and `layoutWrites` queue with ownership inside the new module, plus their caller-managed refresh sequencing. Keep `readGuard` private if it remains useful. Keep the smaller keyed `util.inOrder` for unrelated text edits until a concrete migration removes its callers. Reject this candidate if the resulting interface needs callers to supply lifecycle callbacks for every phase: that would move complexity without reducing it.

**Seam, adapters, and depth.** Local-substitutable coordination over the existing command adapter. A delayed/rejecting test adapter verifies completion order without real UI sleeps. No generic repository, event bus, or second history stack.

**Tests.** Assert the list-edit interface's published list and history outcomes when undo arrives before the forward write finishes, reads resolve out of order, the inverse fails, redo follows undo, and one write hangs. Preserve `reads.test.ts` semantics, including allowing a later read while a write remains pending. Once covered through the owning interface, replace duplicative scheduling-only assertions; retain `history.test.ts` for the shared history implementation. Keep browser journeys such as sidebar undo while rename saves (`journeys.ts:3896`) and list selection/focus after mutations. These verify what a pure queue cannot.

**Leverage and locality.** The gain is removing an asynchronous protocol from callers, not shrinking App by moving JSX. It has lower priority because selection, per-object ordering, and global history make an overly general solution easy to build. Preserve optimistic behavior, undo, and D211 edit semantics; add no interface elements.

## Deliberately not recommended

- **Split Mole into a framework.** `Mole.tsx:197` already accepts size, mood, cue, look, and bare mode while hiding spring motion, idle behavior, and drawing. `mole.test.ts` checks frames and eye glints. D261 has already deleted the duplicate small drawing. More adapters or one module per mood would add knowledge without deleting any.
- **Flatten core scheduling/replay into Review.** `study.ts`, `sessions.ts`, and `reviews.ts` own different canonical operations with actual replay tests. Preserve the single ts-fsrs implementation and files/index distinction. Review coordination is the proposed change, not relocating those rules.
- **Replace the import dispatcher with a plugin registry.** The inspected friction is capture change reporting, not evidence that format registration is the wrong interface. A registry adds a new concept without deleting the import hazards or fixtures.
- **Unify all end-screen priorities.** The spoken rare line and third result tile intentionally use different ordering (`end-says.ts:20–76`, D248/D252). Deduplicating them could change settled behavior.
- **Redesign rewards or reopen the backlog debate.** D246 and subsequent decisions settle the goal notice, continuation, memory cap, and ending. Earlier proposals in the reward audit do not override Tyler's recorded choices.

## Top recommendation

**Own Review's session lifecycle first.** It offers the most leverage across full Review, quick quiz, and phone, and concentrates ordering tests where their behavior is implemented. Before migrating a handler, prove its current outcome through the proposed session interface. Stop the refactor if it merely relocates the same setters and sequencing obligations. The capture receipt comes next because its current result omits information needed for an exact inverse.
