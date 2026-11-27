import { popUpShift } from "./pop-up";
import { BookOpen, CaretUpDown, GearSix, Tick, Keyboard, Minus, Plus, Sparkle, Target, X } from "./icons";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { invoke } from "@tauri-apps/api/core";
import * as Switch from "@radix-ui/react-switch";
import * as Tabs from "@radix-ui/react-tabs";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { openPath } from "@tauri-apps/plugin-opener";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { escTaken, Hint } from "./Hint";
import { onBackdrop, Trap } from "./Trap";
import { comboOf, label, rebind, useKeymap } from "./keys";
import { change, valueChange } from "./change";
import { ore, opt, PHONE } from "./ore";
import { setSounds, setVoice, useSounds, useVoice } from "./sfx";
import { TablesSetting } from "./Tables";
import { setTray, trayOn } from "./quick";
import { ShortcutEditor } from "./Shortcuts";
import { setStyleControls, STYLE_CONTROLS, useStyleControls, type StyleControls } from "./draw/quick";
import { CHIP_LOOKS, chipLook, setChipLook, type ChipLook } from "./Skills";
import { errorText, inOrder, load, save, useFocusWhileMounted, useLibraryChanges, useNarrow, type Notify } from "./util";
import { bigger, DEFAULT_SIZE, FONTS, PAGES, setFont, setPage, setSize, setSpacing, setWidth, SIZES, smaller, SPACINGS, useReading, WIDTHS, type Font, type Page, type Spacing, type Width } from "./reading";
import * as RadioGroup from "@radix-ui/react-radio-group";

type Vendor = "claude" | "codex";
type Review = { goal_minutes: number; weekdays_only: boolean; new_per_day: number; remix: boolean; plan: string; reminder: string };
/** `problems`: values in skills.yaml Ore left out for their defaults (a hand edit it can't use). */
type Job = "tutor" | "grade" | "write" | "ask";
type JobAi = { ai: Vendor; model: string } | null;
type Data = { library: string; ai: Vendor; ai_env: string | null; model: string; model_env: string | null; jobs: Record<Job, JobAi>; review: Review; problems?: string[] };
/** `group`: the heading it sits under in a menu. */
type Model = { id: string; label: string; description?: string; group?: string };

const SECTIONS = [
  { id: "general", label: "General", icon: GearSix },
  { id: "reading", label: "Reading", icon: BookOpen },
  { id: "review", label: "Review", icon: Target },
  { id: "ai", label: "AI", icon: Sparkle },
  { id: "shortcuts", label: "Keyboard shortcuts", icon: Keyboard },
] as const;
type Section = (typeof SECTIONS)[number]["id"];

/** Up to an hour: the daily session runs from 10 minutes to 1 hour (docs/design/daily-session.md). */
const GOALS = [5, 10, 15, 20, 30, 45, 60];
/** The choices for Minutes a day: the list, plus the library's own goal when `ore goal` or a hand edit set one off it, so one is always shown picked. */
export const goalOptions = (now: number) => [...new Set([...GOALS, now])].sort((a, b) => a - b);
const NEW = [0, 5, 10, 20];
/** One line for the Mac and the iPhone. */
export const REMINDER_TEXT = "One notification at this time, only while today’s goal is still open.";
/** The choices for New exercises a day: the list, plus the library's own value when `ore goal` or a hand edit set one off it, so one is always shown picked. */
export const newOptions = (now: number) => [...new Set([...NEW, now])].sort((a, b) => a - b);
const VENDORS: { id: Vendor; label: string }[] = [
  { id: "claude", label: "Claude" },
  { id: "codex", label: "ChatGPT" },
];

/** The AI's jobs, each of which can run on its own AI (D356). */
const JOBS: { id: Job; label: string }[] = [
  { id: "tutor", label: "Tutor" },
  { id: "grade", label: "Checking answers" },
  { id: "write", label: "Writing exercises" },
  { id: "ask", label: "Ask your library" },
];

/** Reminder times, every half hour from 6:00 to 22:00. */
const TIMES = Array.from({ length: 33 }, (_, i) => `${String(6 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
const clock = (t: string) => new Date(`2000-01-01T${t}:00`).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

// Settings share one file and native side effects: their writes, and the form's read, go one after another
// (util.ts `inOrder`), also when the panel closes and opens again.
const SETTINGS = "settings";

const LAST = "ore.settings";
const home = (p: string) => p.replace(/^\/Users\/[^/]+/, "~");

const AGENT_AT = "ore.reminder-agent";
/** The reminder's time is in skills.yaml, which the iPhone's Settings can change through iCloud (D228): the Mac's
 *  LaunchAgent follows it when Ore opens or comes to the front. Only the installed app, so a dev build never takes it over. */
export function useReminderAgent() {
  useEffect(() => {
    if (PHONE || import.meta.env.DEV) return;
    const follow = () =>
      void ore<Data>("settings")
        .then(({ review: { reminder: t } }) => (load(AGENT_AT) === t ? undefined : invoke("set_reminder", { time: t || null }).then(() => save(AGENT_AT, t))))
        .catch(() => {});
    // Not at launch itself: every `ore` call then is a process competing with the ones that draw Home.
    const first = setTimeout(follow, 3000);
    addEventListener("focus", follow);
    return () => (clearTimeout(first), removeEventListener("focus", follow));
  }, []);
}

/** ⌘, (Codex, Linear): sections on the left, each a page of grouped rows with a title, one line on
 *  what it does and its control. Every change saves at once; Esc goes back to where he was. */
export type { Section as SettingsSection };
/** The iPhone's Settings says the same (phone/Settings.tsx). */
export const VOICE_TEXT = "A word from the mole when a session ends on a new level, a met goal or a rare recall.";

export function Settings({ section: initial, onClose, notify }: { section?: Section; onClose: () => void; notify: Notify }) {
  const [section, setSection] = useState<Section>(() => initial ?? (SECTIONS.some((s) => s.id === load(LAST)) ? (load(LAST) as Section) : SECTIONS[0].id));
  const [data, setData] = useState<Data | null>(null);
  const styleCtl = useStyleControls();
  const sounds = useSounds();
  const voice = useVoice();
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useFocusWhileMounted(ref);

  const changes = useLibraryChanges();
  useEffect(() => {
    let live = true;
    const before = dataRef.current;
    inOrder(SETTINGS, () => ore<Data>("settings")).then(
      (r) => { if (live && dataRef.current === before) { dataRef.current = r; setData(r); } },
      (e) => live && setError(errorText(e)),
    );
    return () => { live = false; };
  }, [changes]);

  // The models to pick from, asked of each provider's own CLI each time Settings opens, so a new model
  // shows up by itself. Until one answers, its menus show only the saved pick.
  const [models, setModels] = useState<Partial<Record<Vendor, Model[]>>>({});
  useEffect(() => {
    let live = true;
    for (const v of VENDORS) ore<Model[]>("models", v.id).then((list) => live && setModels((m) => ({ ...m, [v.id]: list })), () => live && setModels((m) => ({ ...m, [v.id]: [] })));
    return () => { live = false; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || escTaken(e)) return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /** Each section opens at its top, as System Settings and Linear do: one scroller holds them all, so
   *  without this Review opened as far down as General had been scrolled (F296). */
  const main = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => void (main.current && (main.current.scrollTop = 0)), [section]);
  const pick = (s: string) => {
    setSection(s as Section);
    save(LAST, s);
  };

  /** The settings as now shown, for an undo that runs after Settings has moved on. */
  const dataRef = useRef(data);
  dataRef.current = data;
  /** A setting he changed (change.ts): shown at once, ⌘Z takes it back, and it goes back if the CLI refuses it.
   *  Resolves false then, so a field can keep what he typed. `put` gives the form with this one field changed
   *  (true) or as it was (false), so a failure never rolls back a newer choice in another field. */
  const setting = async (message: string, put: (d: Data, on: boolean) => Data, write: (on: boolean) => Promise<unknown>): Promise<boolean> => {
    const ok = await change(notify, {
      message,
      kind: "quiet",
      key: SETTINGS,
      show: (on) => {
        const d = dataRef.current;
        if (d) setData((dataRef.current = put(d, on)));
      },
      write,
    });
    // Two choices for one field that both failed each go back to what stood before them, the second to the first's
    // value, which was never saved. So a failed one reads the form as saved, behind the writes still queued, and
    // never over a choice made since.
    const shown = dataRef.current;
    if (!ok) void inOrder(SETTINGS, () => ore<Data>("settings")).then((saved) => dataRef.current === shown && setData((dataRef.current = saved)), () => {});
    return ok;
  };
  /** What each goal setting is called in an Undone toast. */
  const NAMES: Record<string, string> = { minutes: "Minutes a day", "weekdays-only": "Weekdays only", "new-per-day": "New exercises a day", plan: "When you review", remix: "Remix exercises" };
  const setGoal = async <K extends keyof Review>(key: K, flag: string, value: Review[K]): Promise<boolean> => {
    const d = dataRef.current;
    if (!d) return false;
    const was = d.review[key];
    return change(notify, valueChange({
      message: `Changed “${NAMES[flag] ?? flag}”`, kind: "quiet", key: SETTINGS,
      field: `goal ${key}`, before: was, after: value,
      show: (v) => {
        const now = dataRef.current;
        if (now) setData((dataRef.current = { ...now, review: { ...now.review, [key]: v } }));
      },
      write: (v) => ore("goal", opt(flag, String(v))),
    }));
  };

  /** The reminder lives in skills.yaml and in a LaunchAgent that fires with the app closed (D67). */
  const setReminder = async (t: string): Promise<boolean> => {
    const d = dataRef.current;
    if (!d) return false;
    const was = d.review.reminder;
    return setting("Changed the reminder", (now, on) => ({ ...now, review: { ...now.review, reminder: on ? t : was } }), async (on) => {
      const [to, from] = on ? [t, was] : [was, t];
      await ore("goal", opt("reminder", to || "off"));
      // macOS refused it: put skills.yaml back, or a relaunch shows a time that never fires.
      await invoke("set_reminder", { time: to || null }).catch(async (e) => {
        await ore("goal", opt("reminder", from || "off")).catch(() => {});
        throw new Error(`macOS didn’t take the reminder (${errorText(e)}). Pick the time again to retry.`);
      });
      save(AGENT_AT, to);
    });
  };
  const setVendor = async (v: Vendor): Promise<boolean> => {
    const d = dataRef.current;
    if (!d) return false;
    const was = { ai: d.ai, model: d.model };
    const first = v === "claude" ? "sonnet" : "";
    return setting("Changed the AI provider", (now, on) => ({ ...now, ai: on ? v : was.ai, model: on ? first : was.model }), async (on) => {
      if (!on) return ore("settings", opt("ai", was.ai)).then(() => ore("settings", opt("model", was.model)));
      // The provider's own model, unless he has picked another since.
      const r = await ore<Data>("settings", opt("ai", v));
      const now = dataRef.current;
      if (now && now.ai === v && now.model === first) setData((dataRef.current = { ...now, model: r.model }));
    });
  };
  /** One job's own AI and model, or "" for the default above. */
  const setJob = async (job: Job, value: string): Promise<boolean> => {
    const d = dataRef.current;
    if (!d) return false;
    const was = d.jobs[job];
    const to = jobOf(value);
    return setting(`Changed the AI for “${JOBS.find((j) => j.id === job)!.label}”`, (now, on) => ({ ...now, jobs: { ...now.jobs, [job]: on ? to : was } }), (on) => {
      const own = on ? to : was;
      return ore("settings", opt("job", job), opt("ai", own?.ai ?? "default"), ...(own ? [opt("model", own.model)] : []));
    });
  };
  const setModel = async (m: string): Promise<boolean> => {
    const d = dataRef.current;
    if (!d) return false;
    const was = d.model;
    return setting("Changed the model", (now, on) => ({ ...now, model: on ? m : was }), (on) => ore("settings", opt("model", on ? m : was)));
  };

  const { width, size, page, font, spacing } = useReading();
  const keys = useKeymap();
  const [tray, setTrayState] = useState(trayOn);
  const [chips, setChips] = useState(chipLook);
  const [login, setLogin] = useState(false);
  useEffect(() => {
    invoke<boolean>("login_item", { on: null }).then((v) => setLogin(!!v), () => {});
  }, []);
  const title = SECTIONS.find((s) => s.id === section)!.label;
  // Enlarged or in a small window the section list runs across the top (F259): the same width as styles.css.
  const across = useNarrow(780);

  return (
    // A large sheet over the app (ChatGPT's settings): the app shows in the margin around it, and a click there closes it.
    <div className="settings" onMouseDown={onBackdrop(onClose)}>
      <div className="titlebar" data-tauri-drag-region />
      <Trap>
      <div className="settings-sheet" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Settings">
      <Tabs.Root className="settings-tabs" orientation={across ? "horizontal" : "vertical"} value={section} onValueChange={pick}>
        <nav className="settings-side">
          <div className="settings-head">
            <Hint text={<>Close <kbd>Esc</kbd></>}>
              <button className="settings-back" aria-label="Close settings" onClick={onClose}>
                <X size={15} aria-hidden="true" />
              </button>
            </Hint>
            <h2>Settings</h2>
          </div>
          <Tabs.List className="settings-list" aria-label="Settings sections">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <Tabs.Trigger key={id} value={id} className="settings-tab">
                <Icon size={16} weight={id === section ? "fill" : "regular"} aria-hidden="true" />
                {label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </nav>

        <div className="settings-main" ref={main}>
          <div className="settings-page">
            <div className="settings-title">
              <h1>{title}</h1>
            </div>
            {error && <p className="err">{error}</p>}
            {data?.problems?.map((p) => <p key={p} className="err">skills.yaml in your library: {p}. Fix it in a text editor.</p>)}

            <Tabs.Content value="reading" tabIndex={-1}>
              {/* The reader's own text, so each choice below shows as it is made (Books' and Kindle's Aa do this over the page). */}
              <div className="settings-sample" aria-hidden="true">
                <p className="doc">Pulling an idea out of memory changes the memory itself. Each recall makes the next one easier, most of all when it takes some effort.</p>
              </div>
              <Group>
                <Row title="Reading width">
                  <Seg label="Reading width" value={width} options={WIDTHS} onChange={(v) => setWidth(v as Width)} />
                </Row>
                <Row title="Text size">
                  {size !== DEFAULT_SIZE && (
                    <button className="settings-link" onClick={() => setSize(DEFAULT_SIZE)}>
                      Default
                    </button>
                  )}
                  <div className="seg" role="group" aria-label="Text size">
                    <Hint text="Smaller text" keys="smaller">
                      <button className="seg-item" aria-label="Smaller text" disabled={size === SIZES[0]} onClick={smaller}>
                        <Minus size={12} weight="bold" aria-hidden="true" />
                      </button>
                    </Hint>
                    <span className="seg-value" aria-live="polite">{size}</span>
                    <Hint text="Bigger text" keys="bigger">
                      <button className="seg-item" aria-label="Bigger text" disabled={size === SIZES[SIZES.length - 1]} onClick={bigger}>
                        <Plus size={12} weight="bold" aria-hidden="true" />
                      </button>
                    </Hint>
                  </div>
                </Row>
                <Row title="Line spacing">
                  <Seg label="Line spacing" value={spacing} options={SPACINGS} onChange={(v) => setSpacing(v as Spacing)} />
                </Row>
                <Row title="Reading page" text="The rest of the app stays dark.">
                  <Previews label="Reading page" value={page} options={PAGES} onChange={(v) => setPage(v as Page)} render={(o) => <span className="preview-page" data-page={o.id}><i /><i /><i /></span>} />
                </Row>
                <Row title="Reading font">
                  <Previews label="Reading font" value={font} options={FONTS} onChange={(v) => setFont(v as Font)} render={(o) => <span className="preview-font" data-font={o.id}>Aa</span>} />
                </Row>
              </Group>
            </Tabs.Content>

            <Tabs.Content value="ai" tabIndex={-1}>
              {data && (
                  <Group>
                    <Row
                      title="AI provider"
                      text={data.ai_env ? `Set to ${data.ai_env} by ORE_AI in the app's environment.` : "Drafts exercises and checks answers, using the Claude Code or Codex CLI on this Mac."}
                    >
                      <Seg
                        label="AI provider"
                        value={data.ai}
                        options={VENDORS}
                        disabled={!!data.ai_env}
                        onChange={(v) => void setVendor(v as Vendor)}
                      />
                    </Row>
                    <Row
                      title="Model"
                      text={data.model_env ? `Set to ${data.model_env} by ORE_AI_MODEL in the app's environment.` : undefined}
                    >
                      <SelectMenu
                        label="Model"
                        value={data.model}
                        options={modelOptions(data, models[data.ai] ?? null)}
                        disabled={!!data.model_env}
                        onChange={(v) => void setModel(v)}
                      />
                    </Row>
                    {!PHONE && <TablesSetting notify={notify} Row={Row} />}
                  </Group>
              )}
              {data && (
                  <Group title="By job">
                    {JOBS.map((j) => (
                      <Row key={j.id} title={j.label}>
                        <SelectMenu
                          label={j.label}
                          value={jobValue(data.jobs[j.id])}
                          options={jobOptions(data.jobs[j.id], models)}
                          disabled={!!data.ai_env}
                          onChange={(v) => void setJob(j.id, v)}
                        />
                      </Row>
                    ))}
                  </Group>
              )}
            </Tabs.Content>

            <Tabs.Content value="general" tabIndex={-1}>
              <Group>
                <Row title="Skill tags" text="How a source's skills show in lists. Icon only leaves more room for titles.">
                  <Seg label="Skill tags" value={chips} options={CHIP_LOOKS} onChange={(v) => { setChipLook(v as ChipLook); setChips(v as ChipLook); }} />
                </Row>
                <Row title="Diagram style controls" text="A diagram's colours and widths in a picker by the pointer (S), or a panel at the canvas's edge whenever something is picked.">
                  <Seg label="Diagram style controls" value={styleCtl} options={STYLE_CONTROLS} onChange={(v) => setStyleControls(v as StyleControls)} />
                </Row>
                {data && (
                    <Row title="Library folder" text="Your sources, notes and exercises, kept as plain files.">
                      <Hint text={data.library}>
                        <span className="settings-path">{home(data.library)}</span>
                      </Hint>
                      <button className="settings-btn" onClick={() => openPath(data.library).catch((e) => notify(errorText(e), "error"))}>
                        Show in Finder
                      </button>
                    </Row>
                )}
              </Group>
              <Group title="Sound">
                <Row title="Sound effects" text="A short sound when you show an answer, rate it, reach your goal and finish." htmlFor="sounds">
                  <Switch.Root id="sounds" className="switch" checked={sounds} onCheckedChange={setSounds}>
                    <Switch.Thumb className="switch-thumb" />
                  </Switch.Root>
                </Row>
                <Row title="Mole’s voice" text={VOICE_TEXT} htmlFor="voice">
                  <Switch.Root id="voice" className="switch" checked={voice} onCheckedChange={setVoice}>
                    <Switch.Thumb className="switch-thumb" />
                  </Switch.Root>
                </Row>
              </Group>
            </Tabs.Content>

            <Tabs.Content value="review" tabIndex={-1}>
              {data && (
                <Group title="Daily goal">
                  <Row title="Minutes a day" text="Review time that fills the ring on Home.">
                    <Seg
                      label="Minutes a day"
                      value={String(data.review.goal_minutes)}
                      options={goalOptions(data.review.goal_minutes).map((m) => ({ id: String(m), label: String(m) }))}
                      onChange={(v) => void setGoal("goal_minutes", "minutes", Number(v))}
                    />
                  </Row>
                  <Row title="Weekdays only" text="Weekends never count against your week." htmlFor="weekdays">
                    <Switch.Root
                      id="weekdays"
                      className="switch"
                      checked={data.review.weekdays_only}
                      onCheckedChange={(v) => void setGoal("weekdays_only", "weekdays-only", v)}
                    >
                      <Switch.Thumb className="switch-thumb" />
                    </Switch.Root>
                  </Row>
                  <Row title="New exercises a day" text="Exercises seen for the first time each day. Reviews are never capped.">
                    <Seg
                      label="New exercises a day"
                      value={String(data.review.new_per_day)}
                      options={newOptions(data.review.new_per_day).map((m) => ({ id: String(m), label: String(m) }))}
                      onChange={(v) => void setGoal("new_per_day", "new-per-day", Number(v))}
                    />
                  </Row>
                </Group>
              )}
              {data && (
                <Group title="Daily plan">
                  <Row title="When you review" text="Tie review to something you already do every day.">
                    <PlanField plan={data.review.plan} onSave={(v) => setGoal("plan", "plan", v)} />
                  </Row>
                  <Row title="Reminder" text={REMINDER_TEXT}>
                    <SelectMenu label="Reminder time" value={data.review.reminder} options={REMINDERS} onChange={(t) => void setReminder(t)} />
                  </Row>
                </Group>
              )}
              <Group title="Quick quiz">
                <Row title="Shortcut" text="Press it in any app for an exercise or two while you wait. It counts toward today’s goal; Esc puts it away.">
                  <QuizShortcut notify={notify} />
                </Row>
                <Row title="Show in menu bar" text="A click on the icon opens the quick quiz." htmlFor="tray">
                  <Switch.Root id="tray" className="switch" checked={tray} onCheckedChange={(v) => {
                    setTrayState(v);
                    setTray(v, keys["quick-quiz"]).catch((e) => {
                      setTrayState(!v);
                      notify(errorText(e), "error");
                    });
                  }}>
                    <Switch.Thumb className="switch-thumb" />
                  </Switch.Root>
                </Row>
                <Row title="Open at login" text="So the shortcut and menu bar icon still work after your Mac restarts." htmlFor="login">
                  <Switch.Root id="login" className="switch" checked={login} onCheckedChange={(v) => {
                    setLogin(v);
                    invoke<boolean>("login_item", { on: v }).then((now) => setLogin(!!now), (e) => {
                      setLogin(!v);
                      notify(`Open at login couldn’t be turned ${v ? "on" : "off"}: ${errorText(e)}`, "error");
                    });
                  }}>
                    <Switch.Thumb className="switch-thumb" />
                  </Switch.Root>
                </Row>
              </Group>
              {data && (
                <Group title="Exercises">
                  <Row title="Remix exercises" text="Exercises you know come back as new questions on the same idea, so you apply it instead of reciting it." htmlFor="remix">
                    <Switch.Root id="remix" className="switch" checked={data.review.remix} onCheckedChange={(v) => void setGoal("remix", "remix", v)}>
                      <Switch.Thumb className="switch-thumb" />
                    </Switch.Root>
                  </Row>
                </Group>
              )}
            </Tabs.Content>

            <Tabs.Content value="shortcuts" tabIndex={-1}>
              <ShortcutEditor notify={notify} inPage />
            </Tabs.Content>
          </div>
        </div>
      </Tabs.Root>
      </div>
      </Trap>
    </div>
  );
}

/** The quick quiz's system-wide shortcut, recorded like Raycast's hotkey field: click, type the keys;
 *  × turns it off. */
function QuizShortcut({ notify }: { notify: Notify }) {
  const keys = useKeymap();
  const combo = keys["quick-quiz"];
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (c: string) => {
    const why = rebind("quick-quiz", c);
    setError(why);
    setRecording(false);
  };
  return (
    <span className="settings-hotkey">
      {error && <span className="err">{error}</span>}
      <button
        className={`settings-btn${recording ? " rec" : ""}`}
        aria-label={combo ? `Quick quiz shortcut: ${label(combo)}. Press to change` : "Record quick quiz shortcut"}
        onClick={(e) => {
          // WebKit does not focus buttons on a mouse click; the recorder receives keys here.
          e.currentTarget.focus();
          setError(null);
          setRecording((r) => !r);
        }}
        onBlur={() => setRecording(false)}
        onKeyDown={(e) => {
          if (!recording) return;
          // Swallow everything while recording so no other shortcut fires, Esc included.
          e.preventDefault();
          e.stopPropagation();
          if (e.key === "Escape") return setRecording(false);
          const c = comboOf(e.nativeEvent);
          if (c) set(c);
        }}
      >
        {recording ? "Type keys…" : combo ? <kbd>{label(combo)}</kbd> : "Record shortcut"}
      </button>
      {combo && !recording && (
        <Hint text="Turn off">
          <button
            className="settings-clear"
            aria-label="Turn off the quick quiz shortcut"
            onClick={() => {
              const was = combo;
              set("");
              const to = (c: string) => async () => {
                const why = rebind("quick-quiz", c);
                if (why) throw new Error(why);
              };
              notify("Turned off the quick quiz shortcut", "info", to(was), to(""));
            }}
          >
            <X size={12} weight="bold" aria-hidden="true" />
          </button>
        </Hint>
      )}
    </span>
  );
}

/** `title`: only where a section holds more than one group. */
export function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="settings-group">
      {title && <h2>{title}</h2>}
      <div className="settings-card">{children}</div>
    </section>
  );
}

/** `text`: one line the title can't say, or none. */
export function Row({ title, text, htmlFor, children }: { title: string; text?: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="settings-row">
      <div className="settings-row-text">
        {htmlFor ? <label htmlFor={htmlFor}>{title}</label> : <span>{title}</span>}
        {text && <p>{text}</p>}
      </div>
      <div className="settings-row-control">{children}</div>
    </div>
  );
}

/** "After ___, I review." Enter or clicking away saves, Esc keeps what was there (D211). */
export function PlanField({ plan, onSave }: { plan: string; onSave: (v: string) => Promise<boolean> }) {
  const [text, setText] = useState(plan);
  // While his words save, the saved cue moving under them (shown at once, put back on a failure) leaves them be;
  // a save that failed (and said why) keeps them, to try again (D211).
  const kept = useRef<string | null>(null);
  const latest = useRef(plan);
  latest.current = plan;
  useEffect(() => void (kept.current === null && setText(plan)), [plan]);
  const save = (v: string) => {
    kept.current = v;
    void onSave(v).then((ok) => {
      // A failure keeps his words until he types again; the saved plan put back arrives after this.
      if (!ok) return setText(v);
      kept.current = null;
      setText(latest.current);
    });
  };
  /** Enter or Esc already settled it: the blur their focus move causes saves nothing more. */
  const settled = useRef(false);
  // Leaving the field hands focus to the sheet, not the page under it, so the next Esc closes Settings.
  // On the iPhone there is no sheet: the keyboard goes, as Return does in iOS Settings.
  const done = (field: HTMLElement) => {
    const sheet = field.closest<HTMLElement>(".settings-sheet");
    if (sheet) sheet.focus();
    else field.blur();
  };
  return (
    <span className="settings-plan">
      After
      <input
        className="field"
        aria-label="After what do you review?"
        placeholder="my morning coffee"
        maxLength={80}
        value={text}
        onChange={(e) => ((kept.current = null), setText(e.target.value))}
        // Clicking away saves it, as Enter does (D211).
        onFocus={() => (settled.current = false)}
        onBlur={() => {
          if (settled.current) return;
          if (!document.hasFocus()) return;
          const v = text.trim().replace(/[.,;]+$/, "");
          setText(v);
          if (v !== plan) save(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const v = text.trim().replace(/[.,;]+$/, "");
            setText(v);
            if (v !== plan) save(v);
            settled.current = true;
            done(e.currentTarget);
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            kept.current = null;
            setText(plan);
            settled.current = true;
            done(e.currentTarget);
          }
        }}
      />
      , I review.
    </span>
  );
}

const REMINDERS = ["", ...TIMES].map((t) => ({ id: t, label: t ? clock(t) : "Off" }));

/** The saved model always shows, by its name once the list has come back. "" with no name is Codex's default. */
function modelOptions(data: Data, list: Model[] | null): Model[] {
  if (list?.some((m) => m.id === data.model)) return list;
  const saved = { id: data.model, label: data.model || (data.ai === "codex" ? "Codex default" : "Sonnet") };
  return [saved, ...(list ?? [])];
}

/** A job's pick as one menu value: "" is the default AI, else `vendor:model`. */
const jobValue = (own: JobAi) => (own ? `${own.ai}:${own.model}` : "");
const jobOf = (value: string): JobAi => {
  const at = value.indexOf(":");
  return at < 0 ? null : { ai: value.slice(0, at) as Vendor, model: value.slice(at + 1) };
};
/** One menu for a job (Raycast's model menu per AI feature): the default, then each provider's models under its name.
 *  The saved pick always shows, also before its provider's list has come back. */
function jobOptions(own: JobAi, lists: Partial<Record<Vendor, Model[]>>): Model[] {
  const all: Model[] = [{ id: "", label: "Default", description: "The provider and model above" }];
  for (const v of VENDORS) {
    const list = lists[v.id] ?? [];
    const mine = own?.ai === v.id && !list.some((m) => m.id === own.model) ? [{ id: own.model, label: own.model || "Codex default" }] : [];
    all.push(...[...mine, ...list].map((m) => ({ ...m, id: `${v.id}:${m.id}`, group: v.label })));
  }
  return all;
}

/** A pop-up menu like macOS's and Calendar's time menu: the current pick ticked and over the button; an
 *  option's description shows on hover. */
function SelectMenu({ label, value, options, disabled, onChange }: { label: string; value: string; options: readonly Model[]; disabled?: boolean; onChange: (v: string) => void }) {
  const list = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  /** When it opened: the pointer-up of the click that opened it lands on the row moved under the pointer,
   *  and Radix picks a row on a pointer-up it never saw go down, so a quick click would pick the current choice. */
  const opened = useRef(0);
  const open = (o: boolean) => {
    if (!o) return;
    opened.current = performance.now();
    requestAnimationFrame(() => {
      const el = list.current?.querySelector<HTMLElement>('[data-state="checked"]');
      el?.scrollIntoView({ block: "center" });
      el?.focus();
      const trigger = button.current?.getBoundingClientRect();
      const box = list.current?.getBoundingClientRect();
      const row = el?.getBoundingClientRect();
      if (!trigger || !box || !row || !list.current) return;
      // Measured while the list grows in (D280): its scale undone, so the row lands on the button.
      const scale = box.height / list.current.offsetHeight || 1;
      const rowTop = box.top + (row.top - box.top) / scale;
      list.current.style.translate = `0 ${popUpShift({ triggerTop: trigger.top, triggerHeight: trigger.height, listTop: box.top, rowTop, rowHeight: row.height / scale, listHeight: list.current.offsetHeight, viewport: innerHeight })}px`;
    });
  };
  const current = options.find((o) => o.id === value)?.label ?? value;
  return (
    <DropdownMenu.Root onOpenChange={open}>
      <DropdownMenu.Trigger ref={button} className="settings-btn settings-select" aria-label={label} disabled={disabled}>
        <span className="settings-select-label">{current}</span>
        <CaretUpDown size={12} aria-hidden="true" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          ref={list}
          className="popover menu-list settings-times"
          align="end"
          sideOffset={4}
          collisionPadding={8}
          onKeyDown={(e) => e.key === "Escape" && e.stopPropagation()}
        >
          <DropdownMenu.RadioGroup value={value} onValueChange={(v) => v !== value && onChange(v)}>
            {options.map((o, i) => {
              const head = o.group && o.group !== options[i - 1]?.group ? <DropdownMenu.Label key={`in ${o.group}`} className="note-menu-head">{o.group}</DropdownMenu.Label> : null;
              const item = (
                <DropdownMenu.RadioItem key={o.id || "default"} value={o.id} className="menu-item check" onPointerUp={(e) => performance.now() - opened.current < 300 && e.preventDefault()}>
                  <span className="menu-tick">
                    <DropdownMenu.ItemIndicator>
                      <Tick />
                    </DropdownMenu.ItemIndicator>
                  </span>
                  <span className="menu-label">{o.label}</span>
                </DropdownMenu.RadioItem>
              );
              const row = o.description ? <Hint key={o.id || "default"} text={o.description} side="left">{item}</Hint> : item;
              return head ? [head, row] : row;
            })}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** A choice picked from small previews of itself (D151; Rare UI's theme selector): a radio group of cards, the
 *  picked one ringed, arrows move and pick. */
function Previews<T extends { id: string; label: string }>({ label, value, options, onChange, render }: { label: string; value: string; options: readonly T[]; onChange: (v: string) => void; render: (o: T) => ReactNode }) {
  return (
    <RadioGroup.Root className="previews" orientation="horizontal" loop aria-label={label} value={value} onValueChange={(v) => v && v !== value && onChange(v)}>
      {options.map((o) => (
        <RadioGroup.Item key={o.id} value={o.id} className="preview">
          {render(o)}
          <span className="preview-label">{o.label}</span>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}

export function Seg({ label, value, options, disabled, onChange }: { label: string; value: string; options: readonly { id: string; label: string }[]; disabled?: boolean; onChange: (v: string) => void }) {
  return (
    <ToggleGroup.Root className="seg" type="single" value={value} disabled={disabled} onValueChange={(v) => v && v !== value && onChange(v)} aria-label={label}>
      {options.map((o) => (
        <ToggleGroup.Item key={o.id} value={o.id} className="seg-item">
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
