// The reading page's Auto on the iPhone (D311): Ore's window is held dark (tauri.conf.json
// "theme"), so the web view can't see the iPhone's Light or Dark mode; Appearance.swift reads it from the screen.
// Asked at launch, on each return to the app and once a minute (iOS switches at sunset with Ore open). And while a
// light page shows, the status bar's clock turns dark, to be read over it.
import { invoke, isTauri } from "@tauri-apps/api/core";
import { setSystemDark } from "../reading";

export function followAppearance(): void {
  if (!isTauri()) return;
  const ask = () => {
    void invoke<boolean>("system_dark").then(setSystemDark, () => {});
    // Bold Text (F409): the CSS weighs every weight one step heavier under --bold (dynamic-type.ts). It is set in
    // the Settings app, so a return to Ore is when it can have changed.
    void invoke<boolean>("bold_text").then((b) => document.documentElement.style.setProperty("--bold", b ? "1" : "0"), () => {});
  };
  ask();
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && ask());
  setInterval(ask, 60_000);
}

/** The status bar's text for what is under it: dark over a light page. */
export function lightBars(light: boolean): void {
  if (isTauri()) void invoke("light_bars", { light }).catch(() => {});
}
