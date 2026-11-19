# Scout: where Ore's iPhone app doesn't feel like an iPhone app

Your name is `native`. First read `docs/reviews/2026-11-13-codex-phone-edges/common.md` and follow it (how you touch the phone with `sim.ts`, your own simulator, scratch libraries, the report). Your sweep folder is `codex-out/native/`. Use an ordinary seed library: `bun apps/desktop/scripts/mock/seed.ts codex-out/native/libs/seed`, then `bun apps/phone/scripts/sim.ts start --fresh --lib codex-out/native/libs/seed`.

**Report only.** Change no file in the repo.

## The question
The owner says the iPhone app "doesn't feel very native". It is a Tauri iOS app: React in a WKWebView. Find every place where it behaves unlike Apple's own apps (Books, Notes, Mail, Podcasts, Settings, Files), the small physical things a person feels in the first minute without being able to name them. Not bugs in what it does: how it feels to touch.

## Already being fixed, or already judged not worth it: skip
- Rubber-band bounce past the top and bottom of lists and the reader (`overscroll-behavior: none`).
- Pushed screens (a source, Review) sliding in; bottom sheets sliding up; the long-press menu growing from its row; haptics.
- Apple's blurred UIMenu, native sheet detents, iOS 26 glass bars.
- F75 (a tap on the status bar doesn't scroll to the top) is known: confirm it on every list in one line, no more.
- Every row in `docs/reviews/findings.md`.

## Look at, at least (each: try it, then try the same thing in Apple's app on the same simulator)
1. **Touch response.** Tap delay; the grey tap flash (`-webkit-tap-highlight-color`); whether a row, button and icon darken while the finger is down, and un-darken when the finger slides off to cancel; double-tap zoom anywhere; pinch zoom of the whole page.
2. **Scrolling.** Momentum and flick speed in each list and the reader; scroll stopping dead at the end; whether a fixed bar or header jitters during a fast flick; whether the page under an open sheet scrolls.
3. **Text selection.** The loupe, handles, word snap, the iOS Copy / Look Up / Share callout (and whether Ore's own highlight bar fights it); long-press on a link or an image (system preview or nothing); selecting UI text that shouldn't be selectable (labels, buttons, titles).
4. **Keyboard.** Does the right keyboard come up (search has a Search key, URL field a URL keyboard, autocapitalize and autocorrect where Notes would)? Does Return do the expected thing? Does the view keep the caret in sight; is there a jump when the keyboard opens or closes; does dragging the list down dismiss the keyboard (Mail, Notes do); the grey accessory bar above it.
5. **Safe areas and edges.** Notch / Dynamic Island, home indicator, landscape (rotate), content under the status bar while scrolling (does it show through or blur like iOS?).
6. **Navigation gestures.** Swipe-back from the left edge on every pushed screen: does it follow the finger and can it be cancelled halfway? Does the drawer's edge swipe fight it? Large titles that shrink into the bar as you scroll (Mail, Notes) vs a fixed title.
7. **Type and system settings.** Font (SF Pro / New York vs a web font), sizes against the HIG, Dynamic Type: set Larger Text with `xcrun simctl ui "$ORE_SIM_DEVICE" content_size extra-extra-large` (and back to `large`) and see whether the app follows; Bold Text; Reduce Motion; dark mode with `xcrun simctl ui "$ORE_SIM_DEVICE" appearance dark|light`, including switching while the app is open.
8. **Controls.** Switches, segmented controls, pickers, steppers, sliders, search fields, alerts and confirmations: do they look and act like UIKit's (thumb drag on a switch, the clear button in a search field, Cancel beside it)?
9. **Loading and launch.** Launch screen to first frame (a white flash? a blank page?), spinners vs iOS's activity indicator, skeletons, a page that appears in pieces.
10. **Anything else** you notice: focus rings showing on touch, hover states stuck after a tap (`:hover` sticking on touch), context menus, share sheet, pull gestures, sounds, app switcher snapshot.

## Report
`codex-out/native/report.md`, as `common.md` says, but each finding also gets:
- **Why it matters:** what a person feels, and what Apple's app does instead.
- **Where it can be fixed:** *web view* (CSS / JS in `apps/desktop/src`, name the file or selector if you found it) or *needs native* (Swift / a Tauri plugin / WKWebView settings in `apps/phone/src-tauri`).
- **Size:** S (a line or two of CSS), M (a component), L (native work or a new plugin).

Rank by how much each one breaks the native feel in the first minute of use. End by printing the ranked list, one line each: gap, fix place, size.
