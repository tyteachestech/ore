# Ore for iPhone (phase 0 feel test)

The iPhone app is the desktop app's UI (`apps/desktop/src`) built with `ORE_PHONE=1`: `src/phone/PhoneApp.tsx`
is the phone layout, and `src/phone/core.ts` runs the `ore` commands inside the app, since an iPhone has no
CLI to run (D30). This folder is only the Tauri shell around it. See D78 in `docs/DECISIONS.md`.

For the feel test the library is a snapshot: the text files of `ORE_PHONE_LIBRARY`, read at build time and
shipped in the app. Changes made on the phone stay on the phone (IndexedDB) and survive new builds: a new build brings in the files the Mac changed since the last one, and the phone keeps its own reviews and every other edit (D78). Nothing syncs yet, so phone reviews don't reach the Mac. AI (grading,
card drafts) doesn't work on the phone yet.

## Run it on an iPhone (Mac, Xcode, a free Apple account)

```bash
rustup target add aarch64-apple-ios aarch64-apple-ios-sim
cd apps/phone
bun run ios:init                                   # once, and again after the bundle id changes (D104: delete gen/apple first): writes the Xcode project
ORE_PHONE_LIBRARY=/tmp/ore-phone-lib bun run tauri ios build --debug
xcrun devicectl list devices                       # the iPhone's identifier
xcrun devicectl device install app --device <id> src-tauri/gen/apple/build/arm64/Ore.ipa
```
`tauri ios run` builds but didn't install on Xcode 27.1, hence `devicectl`. CocoaPods is needed (`brew install cocoapods`).

`/tmp/ore-phone-lib` is a copy of the library (`cp -R ~/Ore /tmp/ore-phone-lib`), so a build never reads
the live one while it changes. Signing uses Tyler's Personal Team (`bundle.iOS.developmentTeam` in tauri.conf.json), whose account is
already in Xcode. On the phone,
turn on Settings > Privacy & Security > Developer Mode, and after the first install trust the developer under
Settings > General > VPN & Device Management. A free account's install stops opening after 7 days; run again.

In a browser at iPhone size: `cd apps/desktop && ORE_PHONE=1 ORE_PHONE_LIBRARY=/tmp/ore-mock bunx vite`.
