# Codex loop on the release build, 2026-11-11 (PRs #256, #258, #266, #274)

Aimed at the biggest gap found that day: features merged but never checked as the installed app runs them, and the daily Review Tyler had used only once. Codex (`gpt-6-astra`) swept four times, Mac and iPhone side by side; each finding was verified, fixed with a test that failed first, and the class guarded. Sweep 3 came back clean on the Mac; sweep 4 left one item on the iPhone.

## How it ran
- **As the installed app runs, not the dev server.** The built `dist`, served with the exact CSP from `tauri.conf.json`, in WebKit, with the installed app's own compiled `ore` (`ORE_BRIDGE_BIN`) and real grading (`ORE_MOCK_REAL_AI=1`) on a copy of ~/Ore. Tyler declined screen access to a renamed copy of the app, so the real Tauri window (menu bar, quick quiz shortcut, ⌘Q) was not driven.
- **Codex in its sandbox can't launch WebKit** (`-s workspace-write`; Abort trap 6). A `playwright run-server` outside it, and `webkit.connect(...)` inside.
- **iPhone:** the `ORE_PHONE=1` build in WebKit at 390×844 with real taps, and the app in the iOS simulator by hand for what a browser can't show (it confirmed the dead ⋯ menu and the toolbar over sheets).

## Rehearsal: Tyler's 10-minute Review
All 11 due exercises on his library went through to the end screen with no blocker. Grading took 7 to 16 s an answer. It showed four bugs: a math font the release CSP refused, "cards ready" in the picker, picker rows that added up to 7 against a session of 11, and "Exercise 6 of 11" shown twice.

## What each sweep found
| Sweep | Mac | iPhone | What |
|---|---|---|---|
| Rehearsal | 4 | | CSP-blocked KaTeX font; "cards"; exercises filed under no skill in no row (D204); a miss didn't count as a step |
| 1 | 1 | 11 | A publisher's podcast page imported without its audio (D213). Phone: ⋯ and the note keyboard bar dead on a tap; review stuck on "Wrapping up…"; toolbar over the Sections pill and over sheets; toast over the toolbar; drafts and Collected lost on relaunch; list scroll shared; targets under 44 pt |
| 2 | 2 | 5 | A half-typed answer lost on quitting the Mac app; the screen-reader count kept the AI's marks. Phone: Finish drafts never expired; a reload in "Source finished" reopened Finish; key-point draft lost; fields under 44 pt; Reimport blamed the connection |
| 3 | 0 | 3 | Phone: a key-point draft path; a pre-reading answer lost on reload; two fields under 44 pt |
| 4 | | 1 | Phone: a note's to-do box under 44 pt |

## Root causes, and the guard for each
| Class | Guard |
|---|---|
| The release build under its CSP was never tested (journeys run vite in Chromium with no CSP) | `bun run release:check` in CI: the built app under the real CSP in WebKit, every font loaded, fails on any refusal, 4xx or page error |
| Nothing could reach the phone screens | A `phone` engine in the journeys: the phone build in WebKit at 390×844 with real touches, on its own seeded library |
| `preventDefault()` on pointer-down: WebKit sends no click after such a touch | Prevent the mouse-down instead; a phone journey taps each control |
| A phone sheet drawn inside the layer of the button that opened it | `sheetLayer()` renders phone sheets on the body, above the toolbar, pill and toasts; a journey hit-tests every row |
| Drafts in module memory | `kept()` in `util.ts`: localStorage on Mac and phone, tied to what they answered, one day, flushed on pause, `pagehide` and the app's new "quitting" event (⌘Q) |
| `ore` in the page on the phone settles inside the tap, so an effect saw Review still busy | The empty-queue effect re-runs when busy clears |
| Text lists "card" a lone-word check skipped | `names.test.ts` also catches a lone "card" in JSX |

## Left open
- A skill row's number is counted after the day's new-exercise cap over the whole queue, so a row started alone can serve more new exercises than it showed.
- YouTube and audio sources on the phone show the transcript as plain text: the snapshot leaves out `.vtt` and audio, and the phone shell has no player relay page.
- After a checked Explain exercise, the rating buttons can sit below the fold at 1180×800 (the key bar now names the suggested rating).
- Not driven in the real Tauri window: whether ⌘Q's 150 ms gives WebKit time to write localStorage, drafts shared between the quick quiz and the main window.
