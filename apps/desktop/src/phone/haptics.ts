// The iPhone's ticks under a finger (D332). A web view can't make them, so each one asks the shell
// (Tauri's haptics plugin, iOS's own feedback generators), which follow the phone's System Haptics switch.
// Four moments and no others, each where Apple's apps tick: a tick on everything is a tick that means nothing.
// Nothing happens on the Mac or in a browser.
import { PHONE } from "../ore";

type Plugin = typeof import("@tauri-apps/plugin-haptics");
const ask = (run: (h: Plugin) => Promise<unknown>) => void (PHONE && import("@tauri-apps/plugin-haptics").then(run).catch(() => {}));

export const tick = {
  /** A long press opened its menu (iOS's context menu). */
  menu: () => ask((h) => h.impactFeedback("medium")),
  /** A swipe passed the point where letting go acts (Mail's row swipe, a pull to refresh). */
  mark: () => ask((h) => h.impactFeedback("light")),
  /** A rating was recorded in Review (a picker settling on a value). */
  rate: () => ask((h) => h.selectionFeedback()),
  /** A highlight was made (Books). */
  saved: () => ask((h) => h.impactFeedback("light")),
};
