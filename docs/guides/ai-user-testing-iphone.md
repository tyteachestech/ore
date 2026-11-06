# AI user testing for Ore on iPhone: ChatGPT (GPT-6 Astra) prompt

The Mac version is `ai-user-testing.md`. This one tests the iPhone build (phase 0 feel test, branch
`claude/project-thread-e6001o`) in the **iPhone Simulator on the Mac**, never on Tyler's real phone.

Two parts: a 5-minute setup you run yourself in Terminal, then the prompt to paste into ChatGPT with computer use on.

---

## Part 1. Setup (you, before pasting)

The phone app has no live library: the build bundles the text files of `ORE_PHONE_LIBRARY`, and edits made in
the app stay in the app (IndexedDB). So nothing the tester does can reach `~/Ore`, as long as the build
reads a test library. Build in the phone worktree only, never in `~/Developer/ore` (it stays on master).

```bash
# 1. Pause app reinstalls while the test runs (tell Claude in the project chat).
# 2. Latest phone build and a fresh seeded test library:
cd ~/Developer/ore-phone && git pull origin claude/project-thread-e6001o
rm -rf /tmp/ore-phone-lib && bun apps/desktop/scripts/mock/seed.ts /tmp/ore-phone-lib
#    (Or your real data instead: cp -R ~/Ore /tmp/ore-phone-lib. Then skip the canary check below.)
# 3. Build for the simulator:
cd apps/phone && ORE_PHONE_LIBRARY=/tmp/ore-phone-lib bun run tauri ios build --debug --target aarch64-sim
APP=$(find src-tauri/gen/apple/build -name 'Ore.app' -type d -print0 | xargs -0 ls -dt | head -1); echo "$APP"
# 4. Boot the iPhone 18 Pro simulator (not "iPhone Duo"), install, launch:
xcrun simctl boot "iPhone 18 Pro"; open -a Simulator
xcrun simctl install booted "$APP" && xcrun simctl launch booted com.tylerpoelking.ore.phone
```

Check: on the **Today** tab, the skills include "Distributed Systems and Consensus Protocols for Very Large
Clusters". It exists only in the seed, so it proves the build has the test library.

Clean slate between personas (uninstalling wipes the app's saved edits):

```bash
xcrun simctl uninstall booted com.tylerpoelking.ore.phone
xcrun simctl install booted "$APP" && xcrun simctl launch booted com.tylerpoelking.ore.phone
```

Grant ChatGPT computer-use access to **Simulator only**. Not Terminal, not Finder, not Xcode. In Simulator, turn
the hardware keyboard **off** (I/O > Keyboard > uncheck "Connect Hardware Keyboard", ⇧⌘K) so the on-screen
keyboard shows, as on a real phone. When done, tell Claude reinstalls can resume.

Paste-ready parts for ChatGPT (it turns one long paste into an attachment it can't read): see
`/mnt/project-files/ai-user-testing/iphone-paste/part-N-of-4.txt` (regenerate them if this file changes).

---

## Part 2. The prompt (copy everything below the line)

---

You are running a usability and bug-hunting study of **Ore for iPhone**, using computer use on a Mac. The app runs in the **iPhone Simulator** window (an iPhone 18 Pro). You will play three realistic users one after another, try to get real things done the way each would on a phone, and then write one structured report. The app is already open, on a disposable test library.

### Safety rules (non-negotiable)

1. Only operate the **Simulator** window. Do not open Terminal, Xcode, Finder, System Settings or any other Mac app.
2. Before starting, confirm the **Today** tab lists a skill named **"Distributed Systems and Consensus Protocols for Very Large Clusters"**. If it does not, **stop** and tell me.
3. Inside the simulated iPhone, stay in Ore. Don't change the simulator's iOS settings, don't erase or reset the device, don't use the Simulator menus except the ones named below.
4. If the app crashes or closes, reopen it once from the simulated home screen (tap the Ore icon), report it as S1, and carry on. If it won't open, stop and report.
5. Don't send anything anywhere (no share sheet, no email, no posting).

### Driving the simulator

- A click is a **tap**. Click and hold about 1 second is a **long-press** (iOS selects a word and shows handles). Drag the round handles to extend a selection.
- Scroll by dragging the content up or down (a flick is a fast drag). Trackpad scrolling also works but feels less like a finger; use both.
- **Swipe back**: drag from the very left edge of the phone screen (start within the first few pixels) to the right.
- Type with the on-screen keyboard or the Mac keyboard into a focused field. Home: Device > Home (⇧⌘H). Screenshot freely.
- Computer use can miss small targets and fumble long-presses and edge swipes. Retry a gesture once, slowly, before calling it a bug, and say "may be a tooling limitation" if unsure.

### What the app is

Ore turns reading into lasting memory: read → highlight → answer questions → spaced review. On iPhone it is an early build of the Mac app's screens in a phone layout, modelled on Apple Books (reading) and Apple's own apps for gestures. It should behave like a native iOS app.

What's in this build:
- A **tab bar** with **Today** and **Sources**.
- **Today**: today's goal ring (minutes of review), what's due, **Start review**, skill chips, skills grouped by collection, tapping a skill shows its sources.
- **Sources**: To read and Done lists; "All sources" clears a skill filter. One tap opens a source.
- **Reader** (full screen, **Back** at top left or swipe back): one column of text. Select text and a bar appears at the bottom with **Keep**, **Card** and **Question**: one tap makes that highlight and opens its popup, where you can write a note or remove it. A **collected** pill opens a bottom sheet listing the highlights, with a search box. **Finish** opens the end-of-source quiz.
- **Review** (full screen, swipe back to leave): one card at a time. **Fact** cards: recall, pick confidence (Guess, Think so, Sure), see the answer, rate. **Explain** cards: type an answer with the on-screen keyboard.
- Toasts with **Undo** after destructive steps.

### Not in this build (do NOT report)

Search across the library. All AI: prequestions ("Couldn't write prequestions"), answer checking, grading, card drafts, Ask. Notes ("Notes come to the phone in phase 1"). Adding sources on the phone. Sync with the Mac. Settings. Any tab beyond Today and Sources. Raw markdown symbols in the source quote shown in Review. The collected pill overlapping body text. Also deliberate on every platform: no streaks, XP, badges, points, leaderboards or percent-correct scores; dark mode only; no "Are you sure?" when Undo exists. You may give an opinion on any of these once, under "Opinions".

### What matters most

The question this test answers: **does reading, highlighting and reviewing feel right on a phone?** Look hardest at:
- Selecting text (one line, across two lines, across a paragraph), then one tap on a type. Does the highlight match the selection? Does the iOS Copy/Look Up bar cover anything you need?
- Scroll feel in a long source: smooth, no jumps, position kept when you go back and reopen.
- Swipe back from a source and from Review: follows the finger, a short swipe springs back, a long one goes back, nothing selected or typed is lost unexpectedly.
- The on-screen keyboard: never covers the field you type in or the buttons you need next; the screen never zooms in when you tap a field.
- Fit: nothing wider than the screen, nothing under the notch, Dynamic Island or home indicator, every tap target easy to hit (about 44 pt), long titles truncated with an ellipsis.
- Anything that behaves unlike Apple Books, Notes or Mail.

### How to work

- Play each persona **in order**, about 15–20 minutes or ~50 actions each. Stay in character.
- Before each action, form an expectation; after it, screenshot and compare. A mismatch is a finding.
- Toasts with Undo last a few seconds and some feedback is brief: screenshot right after a delete or rating. If something "didn't happen", screenshot again after 1–2 seconds before concluding.
- **Reproduce every bug a second time** before reporting it. If it doesn't reproduce, put it under "Unconfirmed".
- Report what you saw on screen; don't guess internal causes. Don't try to fix anything.

### Personas and missions

**1. Maya, first-time iPhone user (uses Apple Books and Duolingo, never seen this app).**
Goal: understand what the app is for and study one article on the train.
- From Today, work out what to do first. Note anything unclear within 10 seconds.
- Open a source from Sources. Read and scroll for a few minutes. Highlight 4 passages, one of each type, including one across two lines. Write a note on one. Open the collected sheet, search it, jump to a highlight.
- Swipe back, reopen the source: is your place kept?
- Finish the source. Then start a review from Today and do a few cards.
- Was each highlight type clear? Did anything feel intimidating or rewarding?

**2. Priya, busy daily reviewer (10 minutes a day, one hand, on her commute).**
Goal: do today's review and decide whether she'd come back tomorrow.
- Toggle skill chips on Today, then start review. Do a whole session, holding "the phone" one-handed: are the buttons in thumb reach?
- Get some wrong on purpose, including one marked Sure. Does the missed card come back?
- On an Explain card, type an answer with the on-screen keyboard: can you still see the question and the next button?
- Leave mid-session with a swipe back, then start again. Watch the goal ring.
- Rate honestly: would Priya return tomorrow, and why?

**3. Rex, chaos tester (tries to break things).**
Goal: find crashes, lost work and broken layouts.
- Rapid fire: double- and triple-tap buttons, swipe back mid-animation, open and close a source quickly ten times, tap a type twice, Undo twice.
- Selection edge cases: select a heading, a list item, a whole paragraph, text that crosses a section break; long-press then scroll; select then swipe back.
- Type junk into every field: 300 characters, emoji only, `<script>`, empty, leading and trailing spaces.
- Rotate the device (Device > Rotate Left, ⌘←) on Today, a source and Review, and back. Lock and unlock (Device > Lock, ⌘L), go to the home screen (⇧⌘H) and return to the app: is everything where you left it?

### Severity scale

- **S1 Blocker**: crash, freeze, work lost, can't complete a core flow (open, read, highlight, finish, review).
- **S2 Major**: a feature is broken or gives a wrong result, with no reasonable workaround.
- **S3 Friction**: works but confusing, slow, unlike iOS, hard to tap, or covered by the keyboard.
- **S4 Polish**: visual glitch, alignment, truncation, copy.

### Report format (one Markdown document at the end)

```
# Ore iPhone AI test report — <date>

## Summary
- Top 5 issues in priority order (one line each, with IDs)
- Overall: <3 sentences: does reading, highlighting and reviewing feel right on a phone?>

## Persona sessions
### <Persona name>
- Missions: <each: ✅ done / ⚠️ done with trouble / ❌ couldn't>, approx actions taken
- Most confusing moment: ...
- Most satisfying moment: ...
- Ratings (1–5): Feels native ___ · Ease ___ · Responsiveness ___ · Felt encouraging ___ · Would return ___
- One quote in the persona's voice

## Findings
### F-01 <short title>
- Severity: S1–S4 · Type: bug / friction / confusion / visual / not-iOS-like
- Persona: ... · Screen: Today / Sources / Reader / Highlight bar / Collected sheet / Finish / Review
- Steps to reproduce:
  1. ...
- Expected (and which Apple app does it that way, if any): ...
- Actual: ...
- Reproduced: 2/2
- Evidence: <screenshot description or name>
- Note: "may be a computer-use limitation" if relevant

(sort by severity, then by how many personas hit it; merge duplicates)

## Gesture checklist
Rows: tap, long-press select, drag handles, two-line select, scroll, flick, swipe back (source), swipe back (Review), on-screen keyboard, rotate, background and return.
Cell: ✅ felt native · ⚠️ works but off (F-ID) · ❌ broken (F-ID) · — not tried.

## Unconfirmed
Seen once, didn't reproduce.

## Opinions
Design opinions per persona, clearly marked as opinion.
```

Be concrete and terse. Prefer 15 well-reproduced findings over 50 vague ones. If you run out of time, deliver the report with what you have and say which missions were skipped.
