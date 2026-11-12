#!/usr/bin/env bun
// SPIKE: adds the Share Extension (apps/phone/share) to the Xcode project Tauri writes, and the App Group to
// the app's entitlements. Run after `tauri ios init`, which rewrites gen/apple (as ios:init copies entitlements).
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const gen = resolve(import.meta.dir, "../src-tauri/gen/apple");
const yml = join(gen, "project.yml");
let p = readFileSync(yml, "utf8");
if (!p.includes("OreShare:")) {
  p = p.replace(/(    dependencies:\n)(      - framework: libapp.a)/, "$1      - target: OreShare\n$2");
  p += `
  OreShare:
    type: app-extension
    platform: iOS
    deploymentTarget: "15.0"
    sources:
      - path: ../../../share
        excludes: ["*.entitlements"]
    info:
      path: OreShare/Info.plist
      properties:
        CFBundleDisplayName: Ore
        CFBundleShortVersionString: 0.1.0
        CFBundleVersion: "0.1.0"
        NSExtension:
          NSExtensionPointIdentifier: com.apple.share-services
          NSExtensionPrincipalClass: ShareViewController
          NSExtensionAttributes:
            NSExtensionActivationRule:
              NSExtensionActivationSupportsWebURLWithMaxCount: 1
              NSExtensionActivationSupportsText: true
    entitlements:
      path: ../../../share/OreShare.entitlements
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: com.tylerpoelking.ore.phone.share
        DEVELOPMENT_TEAM: 229SB9CKNF
        SWIFT_VERSION: "5.0"
        ARCHS: [arm64]
`;
  writeFileSync(yml, p);
}
const ent = join(gen, "ore-phone_iOS/ore-phone_iOS.entitlements");
let e = readFileSync(ent, "utf8");
if (!e.includes("application-groups")) {
  e = e.replace("</dict>", "  <key>com.apple.security.application-groups</key>\n  <array><string>group.com.tylerpoelking.ore</string></array>\n</dict>");
  writeFileSync(ent, e);
}
const r = spawnSync("xcodegen", ["generate", "--quiet"], { cwd: gen, stdio: "inherit" });
process.exit(r.status ?? 1);
