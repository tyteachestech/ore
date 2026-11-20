// Settings on the iPhone: what the daily session needs on the phone, as iOS's own Settings lays it out (grouped
// rows, a switch, the system's time wheel). The Mac's other settings (AI, shortcuts, the menu bar) have no
// phone twin; reading looks are set in the reader's Aa. Every change saves at once, with Undo.
import * as Switch from "@radix-ui/react-switch";
import { useEffect, useRef, useState } from "react";
import { goalOptions, Group, newOptions, PlanField, REMINDER_TEXT, Row, Seg, VOICE_TEXT } from "../Settings";
import { setSounds, setVoice, useSounds, useVoice } from "../sfx";
import { ore, opt, pullFromMac } from "../ore";
import { errorText, type Notify } from "../util";
import { syncState } from "./fs";
import { allowReminders, planReminders } from "./reminder";

type Review = { goal_minutes: number; weekdays_only: boolean; new_per_day: number; plan: string; reminder: string };
type Key = keyof Review;
const FLAG: Record<Key, string> = { goal_minutes: "minutes", weekdays_only: "weekdays-only", new_per_day: "new-per-day", plan: "plan", reminder: "reminder" };
const NAME: Record<Key, string> = { goal_minutes: "Minutes a day", weekdays_only: "Weekdays only", new_per_day: "New exercises a day", plan: "When you review", reminder: "the reminder" };
/** A reminder turned on starts here; the wheel changes it. */
const FIRST_TIME = "09:00";

/** A switch as iOS's: a tap flips it, and so does sliding the knob, which follows the finger past the track's
 *  ends (Radix's switch only takes a click, so a slide that ended off the track did nothing). */
function PhoneSwitch({ id, checked, onCheckedChange }: { id: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  const on = useRef(checked);
  on.current = checked;
  return (
    <Switch.Root
      id={id}
      className="switch"
      checked={checked}
      onCheckedChange={onCheckedChange}
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, moved: false };
        // Its lift comes back here when the finger ends off the track (a made-up pointer has nothing to capture).
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {}
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x;
        if (Math.abs(dx) < 8) return;
        d.moved = true;
        // The knob goes where the finger goes, at once, as iOS's does.
        if (dx > 0 !== on.current) onCheckedChange((on.current = dx > 0));
      }}
      onPointerUp={() => void setTimeout(() => (drag.current = null), 400)}
      onPointerCancel={() => (drag.current = null)}
      // A slide already set it: the click its lift sends doesn't flip it back.
      onClick={(e) => drag.current?.moved && e.preventDefault()}
    >
      <Switch.Thumb className="switch-thumb" />
    </Switch.Root>
  );
}

/** `reload`: the Mac's changes came in, read again; `onPulled`: Check now brought some. */
export function PhoneSettings({ reload, onPulled, notify }: { reload: number; onPulled: () => void; notify: Notify }) {
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sounds = useSounds(), voice = useVoice();
  useEffect(() => {
    ore<{ review: Review }>("settings").then((d) => setReview(d.review), (e) => setError(errorText(e)));
  }, [reload]);
  const now = useRef(review);
  now.current = review;

  /** At once, put back if the write fails; on the history so Undo takes it back. */
  const set = async <K extends Key>(key: K, value: Review[K], record = true): Promise<boolean> => {
    const r = now.current;
    if (!r) return false;
    const was = r[key];
    setReview({ ...r, [key]: value });
    try {
      await ore("goal", opt(FLAG[key], key === "reminder" ? String(value) || "off" : String(value)));
      void planReminders();
      if (record) notify(`Changed “${NAME[key]}”`, "quiet", () => set(key, was, false), () => set(key, value, false));
      return true;
    } catch (e) {
      setReview((x) => x && { ...x, [key]: was });
      if (!record) throw e;
      notify(errorText(e), "error");
      return false;
    }
  };
  /** On asks iOS first, from his tap; refused, the switch stays off and says where to allow it. */
  const remind = async (on: boolean) => {
    if (on && !(await allowReminders().catch(() => false))) return notify("Notifications are off for Ore. Turn them on in Settings › Notifications › Ore.", "error");
    void set("reminder", on ? FIRST_TIME : "");
  };

  return (
    <div className="phone-page phone-settings">
      <h1>Settings</h1>
      {error && <p className="phone-error">{error}</p>}
      {review && (
        <>
          <Group title="Daily goal">
            <Row title="Minutes a day" text="Review time that fills the ring on Today.">
              <Seg label="Minutes a day" value={String(review.goal_minutes)} options={goalOptions(review.goal_minutes).map((m) => ({ id: String(m), label: String(m) }))} onChange={(v) => void set("goal_minutes", Number(v))} />
            </Row>
            <Row title="Weekdays only" text="Weekends never count against your week." htmlFor="weekdays">
              <PhoneSwitch id="weekdays" checked={review.weekdays_only} onCheckedChange={(v) => void set("weekdays_only", v)} />
            </Row>
            <Row title="New exercises a day" text="Exercises seen for the first time each day. Reviews are never capped.">
              <Seg label="New exercises a day" value={String(review.new_per_day)} options={newOptions(review.new_per_day).map((m) => ({ id: String(m), label: String(m) }))} onChange={(v) => void set("new_per_day", Number(v))} />
            </Row>
          </Group>
          <Group title="Daily plan">
            <Row title="When you review" text="Tie review to something you already do every day.">
              <PlanField plan={review.plan} onSave={(v) => set("plan", v)} />
            </Row>
            <Row title="Reminder" text={REMINDER_TEXT} htmlFor="reminder">
              <PhoneSwitch id="reminder" checked={!!review.reminder} onCheckedChange={(v) => void remind(v)} />
            </Row>
            {review.reminder && <ReminderTime value={review.reminder} onSave={(t) => void set("reminder", t)} />}
          </Group>
        </>
      )}
      <Group title="Sound">
        <Row title="Sound effects" text="A short sound when you show an answer, rate it, reach your goal and finish." htmlFor="sounds">
          <PhoneSwitch id="sounds" checked={sounds} onCheckedChange={setSounds} />
        </Row>
        <Row title="Mole’s voice" text={VOICE_TEXT} htmlFor="voice">
          <PhoneSwitch id="voice" checked={voice} onCheckedChange={setVoice} />
        </Row>
      </Group>
      <Group title="iCloud">
        <Sync onPulled={onPulled} />
      </Group>
    </div>
  );
}

/** The time, on iOS's own wheel; saved when the wheel is put away, as Clock's alarms are. */
function ReminderTime({ value, onSave }: { value: string; onSave: (t: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const save = () => /^\d\d:\d\d$/.test(draft) && draft !== value && onSave(draft);
  return (
    <Row title="Time" text="Also the Mac’s reminder: one time for both." htmlFor="reminder-time">
      <input id="reminder-time" className="field phone-time" type="time" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={save} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
    </Row>
  );
}

/** Whether the library on this phone is the one in iCloud: what is still on its way, or why it isn't. */
function Sync({ onPulled }: { onPulled: () => void }) {
  const [s, setS] = useState(syncState);
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setS(syncState()), 2000);
    return () => clearInterval(t);
  }, []);
  const check = async () => {
    setChecking(true);
    if (await pullFromMac().catch(() => false)) onPulled();
    setS(syncState());
    setChecking(false);
  };
  const line = !s.icloud
    ? "This copy of the library isn’t in iCloud."
    : s.error
      ? `Couldn’t save to iCloud: ${s.error}`
      : s.downloading
        ? `${s.downloading} ${s.downloading === 1 ? "file" : "files"} still coming from iCloud.`
        : s.unsent
          ? `Sending ${s.unsent} ${s.unsent === 1 ? "change" : "changes"} to iCloud.`
          : `Up to date${s.at ? `, checked ${ago(s.at)}` : ""}.`;
  return (
    <Row title="Library" text={line}>
      {s.icloud && (
        <button className="settings-btn" disabled={checking} onClick={() => void check()}>
          {checking ? "Checking…" : "Check now"}
        </button>
      )}
    </Row>
  );
}

function ago(at: number): string {
  const min = Math.round((Date.now() - at) / 60_000);
  return min < 1 ? "just now" : min < 60 ? `${min} min ago` : new Date(at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
