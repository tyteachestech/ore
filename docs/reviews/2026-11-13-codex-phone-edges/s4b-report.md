# iPhone interruptions — sweep 4b

1. **Major — Highlight-note writing disappears when Ore quits with the editor open (2/2).**
2. **Major — An interrupted podcast keeps promising a transcript without explaining the missing speech model (2/2).**
3. **Major — Renaming a lower Today row puts the entire input behind the keyboard (2/2).**
4. **Minor — HTTP 500 recovery still tells phone users to paste page text into an unsupported flow; F32 recurrence (2/2).**
5. **Minor — Removing a pending import gives no immediate acknowledgement; confirmation arrives after navigating away (2/2).**

## Run and evidence

Tested installed app from commit `765c0fbf024a1bbebbf2b5c545fc51aa57f8a742`, November 12, 2026, approximately 20:44–21:25 America/Los_Angeles. Device: `iPhone 18 Pro s4b`; driver directory `/tmp/ore-sim-s4b`; ordinary scratch seed `codex-out/s4b/libs/ordinary`. One scratch reset between import rounds. No production library, source changes, fixes, commits, or edits to the central findings ledger.

Commands below use this prefix; coordinates are simulator points (402 × 874):

```sh
ORE_SIM_DEVICE='iPhone 18 Pro s4b' ORE_SIM_DIR=/tmp/ore-sim-s4b bun apps/phone/scripts/sim.ts
```

Each command array below supplies arguments after that prefix. `launch` quits and relaunches without resetting. Original 3× screenshots are in [shots/](shots/s4b/); inspected 4× crops are linked where relevant. [actions.jsonl](actions.jsonl) records timestamped command arguments and screenshot sequence numbers from action 32 onward. Earlier actions are documented in [progress.md](progress.md) and their screenshots. Screenshot timestamps bound observations; they are not exact network-completion measurements.

CoreSimulator-only operations used the authorized [ask/](ask/) JSON handoff: requests 1–6 opened malformed links, request 7 reset the scratch library. All returned code 0. Apple app comparisons below describe the reference interaction, not a side-by-side Apple app test performed in this run.

## 1. Highlight-note writing disappears on quit

**Severity:** major. **Screen:** Forgetting curve → selected highlight → Note.

**Expected:** retain writing through interruption, as Notes retains an in-progress note. There is no explicit Save/Done in this field. The project already distinguishes highlight-note writing from disposable inline edits in F28. This is a quit-while-open case, not a reproduction of the failed-save trigger in F23.

**First reproduction:** with the imported Wikipedia article positioned at “decline of memory retention”:

```json
[["longpress",142,446],["tap",65,739],["tap",140,540],["type","Highlight note draft one survives interruption."],["home"],["activate"],["launch"],["tap",155,446]]
```

**Actual:** Home/back kept the text. After quit/relaunch the same highlight remained, but its note showed the empty `Note...` placeholder. No error appeared. [Typed](shots/s4b/156.png), [after Home/back](shots/s4b/158.png), [empty after quit](shots/s4b/160.png).

**Second try:** focus the same note and run:

```json
[["tap",140,540],["type","Second highlight note draft. This should remain after quitting. Another line to check typing stays visible."],["home"],["activate"],["launch"],["tap",155,153]]
```

Again the writing survived Home/back and disappeared on quit: [typed](shots/s4b/162.png), [retained in background](shots/s4b/164.png), [empty](shots/s4b/166.png), [4× empty-note crop](shots/s4b/highlight-empty-crop.png). **Reproduced 2/2.** This does not establish loss of a note already saved by closing its popup.

## 2. Podcast transcript remains promised without an actionable explanation

**Severity:** major. **Screen:** imported podcast reader / Today.

**Expected:** explain that transcription cannot run without the required speech model, with a real next step. Podcasts makes download availability/status explicit; the analogous Ore requirement is to distinguish waiting from an unmet prerequisite. The sweep prompt explicitly states that this simulator has no speech model. F60 addressed episode visibility/progress; visibility works here, but the missing-model/interruption state remains unclear.

**Link used twice:**

```text
https://podcasts.apple.com/us/podcast/thu-09-19-quiet-rooms/id1355212895?i=1000670069360
```

It resolves to **Thu, 09/19 – Pokémon: No!**, Tech Brew Ride Home, September 19, 2024.

**First reproduction:** open +; `type` the link; then:

```json
[["tap",200,460],["home"],["activate"],["launch"],["launch"],["tap",170,525]]
```

**Actual:** one source appeared, but its body said “This episode’s transcript is on its way: its audio is downloaded, then heard.” The same message remained about **18 minutes 6 seconds after Add**, through multiple relaunches and unrelated work. No transcript, progress amount, missing-model message, or repair action appeared. [Initial reader](shots/s4b/98.png), [later observation](shots/s4b/240.png).

**Second try:** after scratch reset, open +, type the same link, then:

```json
[["tap",200,460],["launch"],["launch"],["home"],["activate"],["tap",160,383]]
```

The same placeholder appeared [initially](shots/s4b/277.png). Return to Today and reopen the podcast with `["tap",180,382]`: [still unchanged](shots/s4b/308.png) **7 minutes 31 seconds after Add**. **Reproduced 2/2.** These are finite observed waits, not proof that a background job could never finish. No underlying cause was inferred from source code.

## 3. Today source rename is hidden by the keyboard

**Severity:** major. **Screen:** Today → third Continue reading row → Rename; failed podcast import visible above the list.

**Expected:** the focused input and caret remain visible, as in Files' rename interaction. Typing should not require dismissing the keyboard to inspect the result. This is a different field from the New skill field fixed under F29.

**First reproduction:** Forgetting curve was the third row; exact commands:

```json
[["longpress",160,637],["rotate","landscape"],["rotate","portrait"],["tap",100,566],["type","Renamed interruption one"],["home"],["activate"],["launch"]]
```

**Actual:** the input stayed at the lower row's original position, entirely behind the keyboard. The typed name could not be seen while editing. [Input focused](shots/s4b/117.png), [after typing](shots/s4b/118.png). Quit restored the original title; the rename had not been submitted.

**Second try:** same commands, with `Renamed interruption two`: [focused](shots/s4b/125.png), [typing hidden](shots/s4b/126.png), [still hidden after Home/back](shots/s4b/128.png), [4× keyboard-boundary crop](shots/s4b/rename-keyboard-crop.png). **Reproduced 2/2.** Skill-name editing near the top of its own screen stayed visible; this is dependent on row position.

## 4. HTTP 500 advice offers unsupported text paste — F32 recurrence

**Severity:** minor. **Screen:** Today/Sources → Coming in → failed link.

**Expected:** a recovery action available on this phone. Safari-style recovery directs the user to something usable in the current app/context. The phone + sheet offers link/file/photo intake, not the suggested page-text intake. F32 is marked fixed in the ledger but this wording returned.

**Reproduction:** open +, then:

```json
[["type","https://httpbin.org/status/500"],["tap",200,460]]
```

**Actual:** “Check the link, or copy the page’s text and paste it here instead. Your Mac will try it.” [First failure](shots/s4b/46.png). Re-add after removing the first failure: [second failure](shots/s4b/234.png), [4× message crop](shots/s4b/http500-crop.png). **Reproduced 2/2.** The HTTP error itself was correctly refused; it did not become readable source content.

## 5. Remove has no immediate acknowledgement during a pending import

**Severity:** minor. **Screen:** Today/Sources → Coming in.

**Expected:** immediately remove the row or show cancellation in progress, as a Podcasts download cancellation changes its visible state. The user should be able to tell the tap registered.

**First reproduction:** add `https://httpbin.org/delay/60`, relaunch, then `["tap",357,496]` on its Remove. [After tap](shots/s4b/50.png), the same row still said Reading, with the same Remove control and no acknowledgement. Open drawer and rotate landscape/back: [removal toast](shots/s4b/53.png) was first observed **14.0 seconds after the tap observation**.

**Second try:** add `http://10.255.255.1/` in Sources, then `["doubletap",357,567]`. [After double tap](shots/s4b/238.png), the row still said Reading with no response. Open the podcast with `["tap",150,667]` and take a shot: [Removed the link toast](shots/s4b/240.png) was observed **15.7 seconds after the double-tap observation**, on the reader.

**Reproduced 2/2** for absent immediate feedback and later confirmation. These intervals are observation bounds, not measured cancellation latency; intervening navigation/driver time is included. Both eventually removed the requested link. No claim of wrong-row deletion or double deletion.

## Coverage and outcomes

### Network substitutes — two submissions each

| Link | First trial | Second trial |
|---|---|---|
| `http://10.255.255.1/` | Reading, then reachable-host error visible within 32 seconds of Add; survived leaving the app. | Reading; Remove eventually confirmed. Cancelled before observing a timeout. |
| `https://ore-test.invalid/page` | Queued behind IP import; error visible within 28 seconds of Add. | Clear error visible within 21 seconds of Add. |
| `https://httpbin.org/status/500` | HTTP 500 refusal visible within 21 seconds. | Same refusal visible within 21 seconds; F32 wording above. |
| `https://httpbin.org/delay/60` | Still Reading after relaunch; removed instead of waiting out the request. | HTTP 400 refusal visible within 12 seconds. This run did not produce a 60-second delay. |

Times are from sampled screenshots, rounded up. No dead-link content appeared in the readable-source list. Failed entries persisted through navigation/relaunch and could eventually be removed. Re-adding after removal exercised retry; no dedicated Retry control was visible. Actual Mac networking was left alone.

### Imports — two rounds

| Source | Home/back and repeated relaunch | Evidence |
|---|---|---|
| Wikipedia Forgetting curve | One source each round; readable article, headings and image. | [round one](shots/s4b/76.png), [round two](shots/s4b/262.png), [reader](shots/s4b/145.png) |
| arXiv `1706.03762` PDF | One source each round; opened readable paper. | [round one](shots/s4b/83.png), [round two](shots/s4b/269.png), [reader](shots/s4b/279.png) |
| Tech Brew podcast | One source each round; unresolved transcript message, finding 2. | [round one](shots/s4b/240.png), [round two](shots/s4b/308.png) |

The first article/PDF imports finished quickly enough that quitting may have occurred after completion. The second round launched immediately after the Reading screenshot, but UI evidence cannot prove the network job was still running at process termination. No duplicate rows were observed.

An earlier Apple Podcasts link for Master Your Sleep could not resolve episode audio and was clearly refused. It was replaced with the working Tech Brew link for both interruption trials; it is not counted as a broken valid import.

### Leaving mid-task — two trials each

| Task | Home/back | Quit/relaunch | Evidence |
|---|---|---|---|
| Explain answer | Retained | Retained both times. First restart showed another exercise; returning to Explain proved its draft remained. | [first draft recovered](shots/s4b/184.png), [second](shots/s4b/192.png) |
| Source rename | Retained, although keyboard hides it | Unsubmitted edit discarded; original title intact | [first restored title](shots/s4b/121.png), [second](shots/s4b/130.png) |
| New skill name | Retained | Unsubmitted name discarded; no completed skill lost | [first reopened empty](shots/s4b/60.png), [second draft](shots/s4b/61.png), [after quit](shots/s4b/64.png) |
| Source note | Retained | Retained both additions | [first](shots/s4b/106.png), [second](shots/s4b/111.png) |
| Highlight note | Retained | Lost; finding 1 | [first](shots/s4b/160.png), [second](shots/s4b/166.png) |
| Find in source | Retained | Query cleared both times | [first](shots/s4b/138.png), [second](shots/s4b/144.png) |
| + pasted link | Retained | Unsubmitted link discarded both times | [first reopened empty](shots/s4b/31.png), [second](shots/s4b/229.png) |

Unsubmitted names, search and intake drafts are recorded as restoration gaps, not ranked as completed-data loss under the prompt's “or at least nothing he finished is lost” allowance.

### Rotation and keyboard

The app stayed **portrait** after landscape and portrait requests. Each requested surface was exercised twice: Today (194–197), scrolled reader (145–146 and 285–286), Review with keyboard (21–22 and 187–188), drawer (52–53 and 199–200), menu (115–116 and 123–124), full-screen picture (148–151). No rotation-induced text loss or reading-place jump was visible. This tests response to rotation requests, not landscape layout.

Fields inspected with keyboard: Review answer, source rename, new skill, source note, highlight note, find, + link, Finish recall, Finish optional answer, source author, global search, skill name and skill intent. Only the lower-row rename field was fully hidden. Finish's Continue needed a short scroll in both runs, then worked ([first](shots/s4b/219.png), [second](shots/s4b/291.png)); it was not trapped. Author and skill edits saved on click away / return where exercised. [Skill name](shots/s4b/300.png), [intent](shots/s4b/305.png). This is not an exhaustive inventory of every possible editor state.

### Fast and malformed actions

- Start review, rating, Finish, Archive, + and Done were double-tapped at least twice each. Observed one screen transition or intended mutation per attempt; no duplicated sessions/sources were visible. Finish sequences: 216–223 and 289–294. Archive: 242 and 245. Remove's delayed acknowledgement is finding 5.
- Two successive row-swiping pairs: 202–203 and 206–207. Swipe → Undo → swipe again succeeded in 203–205 and 210–212. Because every screenshot was inspected, separate swipes were roughly five seconds apart, not simultaneous.
- Some other Undo attempts did not visibly restore the item, but toast expiry/timing could not be ruled out. Existing F16 is not claimed as a confirmed recurrence.
- Each malformed URL was opened twice through the handoff: `ore://open?id=nope`, `ore://open`, `ore://garbage`. Accepted the iOS Open prompt each time. Current reader remained usable, with no crash or blank screen; no in-app explanation appeared. Evidence: screenshots 167–179, [handoff requests](ask/).

## Limits and inconclusive observations

- Only this simulator, ordinary seed, dark appearance and installed build were checked. No physical device, share extension, sync, real speech transcription, large library or system-wide offline mode was tested.
- HTTP responses differed from the intended network simulation, especially delay/60 returning HTTP 400. Cancellation prevented a second IP timeout and a first delay timeout measurement.
- No source-code investigation, automated regression test, fix, or PR was part of this read-only sweep. Findings are screenshot-backed reproduction reports for follow-up.
- A few initial header + taps did not open the sheet; later taps at the same location worked. The timing/cause was not reproducible enough to rank. One uppercase `key Return` was rejected by the driver; the supported lowercase command was used afterward.
- Landscape remained locked; rapid multi-action races faster than the mandatory screenshot/inspection cycle could not be fully exercised. Double taps themselves used the driver's native `doubletap` command.
- Apple reference behavior was not re-tested in Apple apps during this sweep. No assertion about an exact Apple timeout or universal restoration of temporary form fields is intended.
