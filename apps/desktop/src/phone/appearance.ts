// The reading page's Auto on the iPhone (D311): Ore's window is held dark (tauri.conf.json
// "theme"), so the web view can't see the iPhone's Light or Dark mode; Appearance.swift reads it from the screen.
// Asked at launch, on each return to the app and once a minute (iOS switches at sunset with Ore open). And while a
// light page shows, the status bar's clock turns dark, to be read over it.
import { invoke, isTauri } from "@tauri-apps/api/core";
import { setSystemDark } from "../reading";

/** `call`: the app's commands (a test passes its own). */
export function followAppearance(call: typeof invoke = invoke, inApp = isTauri()): void {
  if (!inApp) return;
  const ask = () => {
    void call<boolean>("system_dark").then(setSystemDark, () => {});
    // Bold Text (F409): the CSS weighs every weight one step heavier under --bold (dynamic-type.ts). It is set in
    // the Settings app, so a return to Ore is when it can have changed.
    void call<boolean>("bold_text").then((b) => document.documentElement.style.setProperty("--bold", b ? "1" : "0"), () => {});
  };
  ask();
  // Back from the Settings app, iOS's first answer is still the old Bold Text (Codex verify 2026-11-20): ask again a moment later.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    ask();
    setTimeout(ask, 1000);
  });
  setInterval(ask, 60_000);
}

/** The status bar's text for what is under it: dark over a light page. */
export function lightBars(light: boolean): void {
  if (isTauri()) void invoke("light_bars", { light }).catch(() => {});
}
