import { invoke } from "@tauri-apps/api/core";
import { label, type Combo } from "./keys";
import { load, save } from "./util";

// The quick quiz's system-wide shortcut and menu bar item (D76), set up by the main window. The
// shortcut is the `quick-quiz` binding in keys.ts; the menu bar item is off unless he turns it on.

const TRAY = "ore.tray";
export const trayOn = () => load(TRAY) === "on";

/** Registers the shortcut with macOS; rejects with a line he can act on when another app holds it. */
export async function setQuizShortcut(combo: Combo): Promise<void> {
  try {
    await invoke("set_quiz_shortcut", { combo: combo || null });
  } catch {
    throw new Error(`${label(combo)} is taken by another app. Pick another quick quiz shortcut in Settings.`);
  }
}

export async function setTray(on: boolean, combo: Combo): Promise<void> {
  await invoke("set_tray", { on, tip: combo ? `Quick quiz (${label(combo)})` : "Quick quiz" });
  // Only once macOS took it: a failed switch must not come back on at the next launch.
  save(TRAY, on ? "on" : "off");
}
