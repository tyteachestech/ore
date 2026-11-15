// `bun run phone:install` (apps/phone/scripts/install.ts). Retro 2026-11-15: a stale Xcode project broke a phone
// build, and version 0.1.0 never said which build the phone ran.
import { expect, test } from "bun:test";
import { describe as say, inputsStamp, pickIphone } from "../../phone/scripts/install";

test("the Xcode project is rewritten when a Swift file is added or what ios:init reads changes", () => {
  const files: Record<string, string> = { "scripts/share-target.ts": "a", "src-tauri/Entitlements.ios.plist": "b", "src-tauri/tauri.conf.json": "c", "src-tauri/Cargo.toml": "d", "package.json": "e" };
  const dirs: Record<string, string[]> = { ios: ["Hear.swift"], share: ["ShareViewController.swift"] };
  const stamp = () => inputsStamp((f) => files[f]!, (d) => dirs[d]!);
  const first = stamp();
  expect(stamp()).toBe(first);
  dirs.ios = ["Hear.swift", "Undo.swift"];
  const second = stamp();
  expect(second).not.toBe(first);
  files["scripts/share-target.ts"] = "a2";
  expect(stamp()).not.toBe(second);
});

test("installs to the paired iPhone, not a watch or a simulator", () => {
  const dev = (type: string, reality: string, udid: string, pairingState = "paired") => ({
    identifier: udid, hardwareProperties: { reality, platform: type === "iPhone" ? "iOS" : "watchOS", deviceType: type, udid },
    deviceProperties: { name: udid }, connectionProperties: { pairingState },
  });
  const json = { result: { devices: [dev("appleWatch", "physical", "w"), dev("iPhone", "simulated", "s"), dev("iPhone", "physical", "old", "unpaired"), dev("iPhone", "physical", "p")] } };
  expect(pickIphone(json)?.udid).toBe("p");
  expect(pickIphone({ result: { devices: [] } })).toBeUndefined();
});

test("says which build the phone runs and how far behind it is", () => {
  expect(say("2500", 2510)).toContain("10 commits behind");
  expect(say("2510", 2510)).toContain("this checkout's");
  expect(say("0.1.0", 2510)).toContain("assume it's old");
  expect(say(undefined, 2510)).toContain("isn't on the phone");
});
