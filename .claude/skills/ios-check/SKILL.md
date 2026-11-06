---
name: ios-check
description: Run before calling any change to the iPhone app (apps/phone, apps/desktop/src/phone, or a screen the phone shows) done, and when asked to audit or debug the iPhone app. Uses every screen on a regular iPhone and checks it against Apple's HIG and the AGENTS.md iPhone rules.
---

# iOS check

The interaction check is for the Mac. This one checks that the phone app behaves like Apple's own
apps (Books, Notes, Mail), so Tyler never finds an "obvious" iOS bug. The rules are the "iPhone"
section of `AGENTS.md`; this file is how to run them and the detail behind them.

## Run it

1. **Where:** the iOS simulator (iPhone 18 Pro, a regular iPhone; never the foldable) for the real
   web view, keyboard and gestures (`idb ui tap/swipe/text`, `xcrun simctl io booted screenshot`).
   For quick loops, Chromium at 390×844 with `hasTouch` and the mock (`apps/phone/README.md`).
   Build from a copy of the library, never `~/Ore`. Don't install on Tyler's phone mid-audit.
2. **Data:** real-length and junk: an empty library, a 200-character title, a source with no
   text, 50 highlights, a long answer in Review.
3. **Walk every screen and flow:** launch, Today, Sources, a source (read, select, highlight each
   type, note, collected list, search it), Review (answer, rate, finish, go again), back from each.
4. **Check each row below** on every screen. Screenshot every failure; write it down as
   screen, what you did, what happened, what Apple's apps do.
5. **Fix the clear ones.** Bring the judgment calls to Tyler as a short list with a recommendation each.

## Checklist

**Navigation**
- Every pushed screen has a back button at the top left and a swipe from the left edge goes back, the screen underneath showing as it moves.
- Tabs keep their scroll and state when you switch away and back; reopening a source returns to where you were.
- Esc-only or keyboard-only ways out don't count: every layer has a visible close or a swipe down.

**Touch**
- Every tap target is at least 44×44 pt; neighbours don't steal taps.
- Nothing depends on hover: a ⋯ shown on hover must be always visible or replaced by long-press (iOS context menu).
- Pressed state on tap (`:active`), no sticky hover colours after a tap, no grey tap flash, no 300 ms delay.
- Long-press on UI chrome doesn't select its text or pop the link/image callout; long-press on reading text does select.
- Pinch doesn't zoom the UI.

**Layout**
- Nothing wider than the screen at 390 pt, popovers and menus included (they portal outside the phone screens: style them under `.phone`).
- Safe areas: nothing under the status bar / Dynamic Island or the home indicator; fixed bars pad with `env(safe-area-inset-*)`.
- Long text truncates or wraps; no element overlaps another (pills over body text, popups over bars).
- Body text 17 pt-ish and readable; nothing under 11 pt.

**Keyboard**
- Fields are 16 px or larger, so iOS never zooms.
- The focused field and its buttons stay above the keyboard (`--keyboard`); the page doesn't jump.
- Return does the expected thing (newline in a long answer, submit in search); tapping outside or swiping back dismisses the keyboard.

**Sheets, popovers, menus**
- Bottom sheets for lists and options, the iOS way: full width, above the keyboard, close on tap outside and swipe down.
- One layer at a time: opening one closes the other.

**Scroll**
- Momentum and rubber band on the content, not on the whole page (fixed bars never bounce away).
- No scroll trapped in a nested scroller; no horizontal page scroll.

**Text selection**
- Native handles work across lines; the highlight actions appear at once after a selection (one tap per action).
- The iOS Copy bar never covers our controls.

**State and interruptions**
- Background and return, lock and unlock, relaunch: you come back where you were, edits kept.
- Rotation: the layout holds or the app stays portrait (say which).
- Light and dark mode both work.

**Feedback**
- Every tap shows its result at once; errors say what to do next; empty states say how to fill them.
- Desktop-only hints (key hints, ⌘ shortcuts, "right-click") never show on the phone.
