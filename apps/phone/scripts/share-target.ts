#!/usr/bin/env bun
// SPIKE: adds the Share Extension (apps/phone/share) to the Xcode project Tauri writes, with the App Group and
// iCloud entitlements on both targets. Run after `tauri ios init` (ios:init does). The entitlements are written
// as properties in project.yml, because xcodegen rewrites every entitlements file it lists from them: a path
// alone leaves the file empty, which drops the app's iCloud folder too.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const gen = resolve(import.meta.dir, "../src-tauri/gen/apple");
const yml = join(gen, "project.yml");
const ent = (indent: string) =>
  [
    "properties:",
    "  com.apple.security.application-groups: [group.com.tylerpoelking.ore]",
    "  com.apple.developer.icloud-container-identifiers: [iCloud.com.tylerpoelking.ore]",
    "  com.apple.developer.ubiquity-container-identifiers: [iCloud.com.tylerpoelking.ore]",
    "  com.apple.developer.icloud-services: [CloudDocuments]",
  ].map((l) => indent + l).join("\n");
let p = readFileSync(yml, "utf8");
if (!p.includes("OreShare:")) {
  p = p.replace(/(    dependencies:\n)(      - framework: libapp.a)/, "$1      - target: OreShare\n$2");
  p = p.replace(/(    entitlements:\n      path: ore-phone_iOS\/ore-phone_iOS.entitlements\n)/, `$1${ent("      ")}\n`);
  p += `
  OreShare:
    type: app-extension
    platform: iOS
    deploymentTarget: "15.0"
    sources:
      - path: ../../../share
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
      path: OreShare/OreShare.entitlements
${ent("      ")}
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: com.tylerpoelking.ore.phone.share
        DEVELOPMENT_TEAM: 229SB9CKNF
        CODE_SIGN_STYLE: Automatic
        SWIFT_VERSION: "5.0"
        ARCHS: [arm64]
`;
  writeFileSync(yml, p);
}
const r = spawnSync("xcodegen", ["generate", "--quiet"], { cwd: gen, stdio: "inherit" });
process.exit(r.status ?? 1);
