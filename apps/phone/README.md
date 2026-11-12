# Ore for iPhone (phase 0 feel test)

The iPhone app is the desktop app's UI (`apps/desktop/src`) built with `ORE_PHONE=1`: `src/phone/PhoneApp.tsx`
is the phone layout, and `src/phone/core.ts` runs the `ore` commands inside the app, since an iPhone has no
CLI to run (D30). This folder is only the Tauri shell around it. See D78 in `docs/DECISIONS.md`.

The library is Ore's iCloud Drive folder (D222), which is the Mac's library too: `~/Ore` on the Mac links to
`~/Library/Mobile Documents/iCloud~com~tylerpoelking~ore/Documents`. The phone reads its text files at launch,
writes back as it goes, and reads the Mac's changes in when it comes back to the screen. AI (grading, exercise drafts)
runs on the Mac (D78.3).

## Run it on an iPhone (Mac, Xcode, the paid Apple team)

```bash
rustup target add aarch64-apple-ios aarch64-apple-ios-sim
cd apps/phone
bun run ios:init                                   # once, and again after the bundle id changes (D104: delete gen/apple first): writes the Xcode project and its iCloud entitlements
bun run tauri ios build --debug
xcrun devicectl list devices                       # the iPhone's identifier
xcrun devicectl device install app --device <id> src-tauri/gen/apple/build/arm64/Ore.ipa
```
`tauri ios run` builds but didn't install on Xcode 27.1, hence `devicectl`. CocoaPods is needed (`brew install cocoapods`).

Signing needs the paid Apple team (`bundle.iOS.developmentTeam` in tauri.conf.json), since iCloud is a paid
capability. On the phone, turn on Settings > Privacy & Security > Developer Mode, and iCloud Drive.

## Moving the Mac's library into iCloud (once)

Open the phone app once first, so the folder exists; it appears on the Mac within a minute. Then, with Ore quit:

```bash
D=~/Library/Mobile\ Documents/iCloud~com~tylerpoelking~ore/Documents
cp -R ~/Ore ~/Ore-before-icloud                    # a copy to fall back on
mkdir -p "$D/.index" "$D/.ore" "$D/.git"
for d in .index .ore .git; do xattr -w 'com.apple.fileprovider.ignore#P' 1 "$D/$d"; done   # iCloud skips them: per device
rsync -a ~/Ore/ "$D/" && mv ~/Ore ~/Ore-moved && ln -s "$D" ~/Ore
```

On 2026-11-11 iCloud uploaded the copied folders at about one file a minute until each was renamed and renamed
back (`mv cards cards-x && mv cards-x cards`), then took about 40 minutes for 340 files. Until it finishes the phone
opens empty.

In a browser at iPhone size: `cd apps/desktop && ORE_PHONE=1 ORE_PHONE_LIBRARY=/tmp/ore-mock bunx vite`.
