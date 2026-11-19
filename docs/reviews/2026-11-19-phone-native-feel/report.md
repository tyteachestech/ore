# iPhone native-feel scout: report (2026-11-19)

One Codex tester (`prompt.md`), iOS Simulator iPhone 18 Pro (402 pt), ordinary seed, master at 8ac246d. Findings only. Every gap seen twice. Compared live against Settings, Files and Safari (Books, Notes, Mail, Podcasts aren't on the simulator image). Full report and 184 screenshots: `~/Developer/ore-native-scout/codex-out/native/` on Tyler's Mac.

## Ranked gaps
1. **Search has no clear button and no Search key** (minor). The only × closes search; the keyboard shows plain Return. Settings and Files: a clear × inside the field plus a Search key. Web view: `Palette.tsx` Command.Input, `.palette-field` (mind D145 for what Return does). M.
2. **Dark strip behind the clock above a light reader page** (minor). Light/Auto page, iOS light; persists after scroll and foreground. Settings/Files carry their background through the status area. Web view: `.phone-app::before`, `.phone-full`, `data-page="light"` rules, ReadingLooks/appearance.ts status hook; if it's the native host, `apps/phone/ios/Appearance.swift`. M.
3. **Switch thumb dragged off its track doesn't flip** (minor). Settings › Weekdays only; a drag ending inside the track works. Apple's switch flips on release beyond the track. Web view: `phone/Settings.tsx` Switch.Root, `.switch`. M.
4. **Daily plan field hides behind the keyboard** (major). Settings › Daily plan › When you review: the caret goes under the keyboard on focus. Web view: `Settings.tsx` PlanField, phone focus scrolling in `PhoneApp.tsx`/styles.css. M.
5. **Large title scrolls away with no small title in the bar** (polish). Settings scrolled: only Back remains. Apple keeps a compact centered title. Web view: `PhoneApp.tsx` header, `.phone-bar`, `.phone-settings h1`. M.
6. **Holding the source's website link opens Safari on release** (minor). Safari shows a preview with Open choices. Web view: `Reader.tsx` `.source` (a button calling openOriginal), `original.ts`: M; a real system link preview is native, L.
7. **Bold Text doesn't reach Ore's text** (minor). Only the clock gets bolder. Native: a legibility-weight observer in `apps/phone/ios/` through `src-tauri/src/lib.rs`, mapped to CSS weights (`dynamic-type.ts` only follows size). L.
8. **Auto page appearance lags a light/dark switch by seconds to a minute** (minor). `appearance.ts` asks at launch/foreground and every 60 s. Native: send the trait change from `Appearance.swift` over the bridge. L.

## Leads, not ranked
- Launch goes white → dark → Today. `gen/apple/LaunchScreen.storyboard` uses systemBackgroundColor while the window is forced dark. Not ranked: Files also launched blank under the harness; recheck on a release build.
- Ore stays portrait on rotation; Files rotates (a difference, not called a bug).
- F75 (status-bar tap to top) confirmed on Today, drawer, Settings, search, reader.

## Passed
No whole-page zoom; reader figure zoom works. Text selection: native handles and Copy/Look Up/Translate callout, no clash with Ore's bar. Add field: URL keyboard, Go key, no autocap. Swipe-back cancels short and returns long on every pushed screen; the drawer doesn't steal it. Larger Text follows live. Sheet background doesn't scroll. No notch/home-bar collisions.

## Not covered
Tap latency in ms, press/slide-off cancel, momentum curves, mid-flick jitter, loupe, reminder wheel, alerts, share sheet, app switcher card, a 390 pt device, a real iPhone.
