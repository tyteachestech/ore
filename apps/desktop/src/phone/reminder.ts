// The review reminder on the iPhone (D67 on the phone): iOS runs nothing of Ore's while it is closed, so the
// reminder can't ask at 9:30 whether today's goal is still open, as the Mac's LaunchAgent does. Instead the
// next two weeks of reminders are handed to iOS ahead, and planned again whenever the app opens, leaves the
// screen or ends a review: today's goes once the goal is met, and weekends go with "Weekdays only".
import { invoke, isTauri } from "@tauri-apps/api/core";
import { ore, type Today } from "../ore";

const DAYS = 14;
/** iOS keeps a scheduled notification by its number: these are Ore's reminders, one per day ahead. */
const IDS = Array.from({ length: DAYS }, (_, i) => 6700 + i);

/** When to remind, from the day's numbers: at the set time on each of the next `days` days still to come,
 *  less today once its goal is met (or nothing is due), and less weekends when they don't count. */
export function reminderTimes(t: Pick<Today, "reminder" | "weekdays_only" | "counts" | "met" | "due">, now = new Date(), days = DAYS): Date[] {
  const m = /^(\d\d):(\d\d)$/.exec(t.reminder);
  if (!m) return [];
  const out: Date[] = [];
  for (let i = 0; i < days; i++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, Number(m[1]), Number(m[2]));
    if (at <= now) continue;
    if (i === 0 && (t.met || !t.counts || t.due === 0)) continue;
    if (t.weekdays_only && (at.getDay() === 0 || at.getDay() === 6)) continue;
    out.push(at);
  }
  return out;
}

/** What the notification says: his plan as its title, as on the Mac (core reminderNote). */
export function reminderText(t: Pick<Today, "plan" | "slice_ms" | "goal_minutes">, today: boolean): { title: string; body: string } {
  const min = today ? Math.max(1, Math.round(t.slice_ms / 60_000)) : t.goal_minutes;
  return { title: t.plan ? `After ${t.plan}, I review.` : "Time for today’s review", body: `About ${min} min of your most urgent exercises.` };
}

const plugin = () => import("@tauri-apps/plugin-notification");

/** Asks iOS once, from his tap on the switch; true when Ore may notify. */
export async function allowReminders(): Promise<boolean> {
  if (!isTauri()) return true;
  const n = await plugin();
  return (await n.isPermissionGranted()) || (await n.requestPermission()) === "granted";
}

let planning: Promise<void> = Promise.resolve();
/** Hands iOS the reminders from now on, replacing the ones it holds. Quiet: a phone that said no to
 *  notifications, or a browser, simply gets none. */
export function planReminders(): Promise<void> {
  planning = planning.then(async () => {
    if (!isTauri()) return;
    try {
      const n = await plugin();
      if (!(await n.isPermissionGranted())) return;
      const t = await ore<Today>("today");
      await n.cancel(IDS);
      const now = new Date();
      for (const [i, at] of reminderTimes(t, now).entries()) {
        const today = at.toDateString() === now.toDateString();
        // By the calendar's own fields, in local time: the plugin reads Schedule.at's UTC date as local on iOS (2.8.0).
        const when = { year: at.getFullYear(), month: at.getMonth() + 1, day: at.getDate(), hour: at.getHours(), minute: at.getMinutes() };
        // The plugin's own call, awaited, where sendNotification would drop a refusal.
        await invoke("plugin:notification|notify", { options: { id: IDS[i]!, ...reminderText(t, today), schedule: n.Schedule.interval(when) } });
      }
    } catch {
      // Next time: the app plans again each time it opens or leaves the screen.
    }
  });
  return planning;
}
