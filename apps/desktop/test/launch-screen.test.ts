import { expect, test } from "bun:test";
import { DARK, darkLaunch } from "../../phone/scripts/launch-screen";

// Tauri's generated LaunchScreen.storyboard, as `tauri ios init` writes its view.
const TAURI = `<view key="view" contentMode="scaleToFill" id="Ze5-6b-2t3">
  <rect key="frame" x="0.0" y="0.0" width="375" height="667"/>
  <color key="backgroundColor" systemColor="systemBackgroundColor"/>
</view>
<resources><systemColor name="systemBackgroundColor"><color white="1" alpha="1" colorSpace="custom" customColorSpace="genericGamma22GrayColorSpace"/></systemColor></resources>`;

test("the iPhone's launch screen is the window's dark, not iOS's white system background (Codex native scout)", () => {
  const out = darkLaunch(TAURI);
  expect(out).toContain(DARK);
  expect(out).not.toContain('key="backgroundColor" systemColor');
  // An older template's literal white too.
  expect(darkLaunch('<color key="backgroundColor" white="1" alpha="1" colorSpace="custom" customColorSpace="genericGamma22GrayColorSpace"/>')).toBe(DARK);
  // Run again on its own output, as ios:init can be: unchanged.
  expect(darkLaunch(out)).toBe(out);
});
