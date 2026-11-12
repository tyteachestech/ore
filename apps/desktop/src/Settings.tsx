import { CaretUpDown, GearSix, Tick, Keyboard, Minus, Plus, Target, X } from "./icons";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { invoke } from "@tauri-apps/api/core";
import * as Switch from "@radix-ui/react-switch";
import * as Tabs from "@radix-ui/react-tabs";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { openPath } from "@tauri-apps/plugin-opener";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { escTaken, Hint } from "./Hint";
import { Trap } from "./Trap";
import { comboOf, label, rebind, useKeymap } from "./keys";
import { ore, opt, PHONE } from "./ore";
import { TablesSetting } from "./Tables";
import { setTray, trayOn } from "./quick";
import { ShortcutEditor } from "./Shortcuts";
import { setStyleControls, STYLE_CONTROLS, useStyleControls, type StyleControls } from "./draw/quick";
import { CHIP_LOOKS, chipLook, setChipLook, type ChipLook } from "./Skills";
import { errorText, load, save, useFocusWhileMounted, useLibraryChanges, type Notify } from "./util";
import { bigger, DEFAULT_SIZE, FONTS, PAGES, setFont, setPage, setSize, setWidth, SIZES, smaller, useReading, WIDTHS, type Font, type Page, type Width } from "./reading";
import * as RadioGroup from "@radix-ui/react-radio-group";

type Vendor = "claude" | "codex";
type Review = { goal_minutes: number; weekdays_only: boolean; new_per_day: number; remix: boolean; plan: string; reminder: string };
type Data = { library: string; ai: Vendor; ai_env: string | null; model: string; model_env: string | null; review: Review };
type Model = { id: string; label: string; description?: string };

const SECTIONS = [
  { id: "general", label: "General", icon: GearSix },
  { id: "review", label: "Review", icon: Target },
  { id: "shortcuts", label: "Keyboard shortcuts", icon: Keyboard },
] as const;
type Section = (typeof SECTIONS)[number]["id"];

export const GOALS = [5, 10, 15, 20, 30];
export const NEW = [0, 5, 10, 20];
const VENDORS: { id: Vendor; label: string }[] = [
  { id: "claude", label: "Claude" },
  { id: "codex", label: "ChatGPT" },
];

/** Reminder times, every half hour from 6:00 to 22:00. */
const TIMES = Array.from({ length: 33 }, (_, i) => `${String(6 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
const clock = (t: string) => new Date(`2000-01-01T${t}:00`).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

const LAST = "ore.settings";
const home = (p: string) => p.replace(/^\/Users\/[^/]+/, "~");

const AGENT_AT = "ore.reminder-agent";
/** The reminder's time is in skills.yaml, which the iPhone's Settings can change through iCloud (D227): the Mac's
 *  LaunchAgent follows it whenever the library changes. Only the installed app, so a dev build never takes it over. */
export function useReminderAgent() {
  const changes = useLibraryChanges();
  useEffect(() => {
    if (PHONE || import.meta.env.DEV) return;
    ore<Data>("settings")
      .then(({ review: { reminder: t } }) => (load(AGENT_AT) === t ? undefined : invoke("set_reminder", { time: t || null }).then(() => save(AGENT_AT, t))))
      .catch(() => {});
  }, [changes]);
}

/** ⌘, (Codex, Linear): sections on the left, each a page of grouped rows with a title, one line on
 *  what it does and its control. Every change saves at once; Esc goes back to where he was. */
export type { Section as SettingsSection };

export function Settings({ section: initial, onClose, notify }: { section?: Section; onClose: () => void; notify: Notify }) {
  const [section, setSection] = useState<Section>(() => initial ?? (SECTIONS.some((s) => s.id === load(LAST)) ? (load(LAST) as Section) : "general"));
  const [data, setData] = useState<Data | null>(null);
  const styleCtl = useStyleControls();
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useFocusWhileMounted(ref);

  const changes = useLibraryChanges();
  useEffect(() => {
    ore<Data>("settings").then(setData, (e) => setError(errorText(e)));
  }, [changes]);

  // The models to pick from, asked of the provider's own CLI each time Settings opens or the provider
  // changes, so a new model shows up by itself. Until it answers, the menu shows only the saved pick.
  const vendor = data?.ai;
  const [models, setModels] = useState<{ vendor: Vendor; list: Model[] } | null>(null);
  useEffect(() => {
    if (!vendor) return;
    let live = true;
    ore<Model[]>("models", vendor).then((list) => live && setModels({ vendor, list }), () => live && setModels({ vendor, list: [] }));
    return () => { live = false; };
  }, [vendor]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || escTaken(e)) return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pick = (s: string) => {
    setSection(s as Section);
    save(LAST, s);
  };

  /** The settings as now shown, for an undo that runs after Settings has moved on. */
  const dataRef = useRef(data);
  dataRef.current = data;
  /** Shows the change at once and rolls it back if the CLI refuses it. Once it lands it goes on the
   *  app history, so ⌘Z takes it back (and ⇧⌘Z gives it again) like any other change he makes;
   *  those replays pass no `step`. */
  const change = async (next: Data, run: () => Promise<unknown>, step?: { message: string; undo: () => Promise<unknown>; redo: () => Promise<unknown> }) => {
    const prev = dataRef.current;
    setData(next);
    dataRef.current = next;
    try {
      await run();
    } catch (e) {
      setData(prev);
      dataRef.current = prev;
      // From ⌘Z or ⇧⌘Z (no step of its own): the history says why and keeps the step.
      if (!step) throw e;
      notify(errorText(e), "error");
      return;
    }
    if (step) notify(step.message, "quiet", step.undo, step.redo);
  };
  /** What each goal setting is called in an Undone toast. */
  const NAMES: Record<string, string> = { minutes: "Minutes a day", "weekdays-only": "Weekdays only", "new-per-day": "New exercises a day", plan: "When you review", remix: "Remix exercises" };
  const setGoal = async <K extends keyof Review>(key: K, flag: string, value: Review[K], record = true): Promise<void> => {
    const d = dataRef.current;
    if (!d) return;
    const was = d.review[key];
    return change({ ...d, review: { ...d.review, [key]: value } }, () => ore("goal", opt(flag, String(value))), record ? { message: `Changed “${NAMES[flag] ?? flag}”`, undo: () => setGoal(key, flag, was, false), redo: () => setGoal(key, flag, value, false) } : undefined);
  };

  /** The reminder lives in skills.yaml and in a LaunchAgent that fires with the app closed (D67). */
  const setReminder = async (t: string, record = true): Promise<void> => {
    const d = dataRef.current;
    if (!d) return;
    const was = d.review.reminder;
    return change(
      { ...d, review: { ...d.review, reminder: t } },
      async () => {
        await ore("goal", opt("reminder", t || "off"));
        // macOS refused it: put skills.yaml back, or a relaunch shows a time that never fires.
        await invoke("set_reminder", { time: t || null }).catch(async (e) => {
          await ore("goal", opt("reminder", was || "off")).catch(() => {});
          throw new Error(`macOS didn’t take the reminder (${errorText(e)}). Pick the time again to retry.`);
        });
        save(AGENT_AT, t);
      },
      record ? { message: "Changed the reminder", undo: () => setReminder(was, false), redo: () => setReminder(t, false) } : undefined,
    );
  };
  const setVendor = async (v: Vendor, record = true): Promise<void> => {
    const d = dataRef.current;
    if (!d) return;
    const was = { ai: d.ai, model: d.model };
    return change({ ...d, ai: v, model: v === "claude" ? "sonnet" : "" }, async () => {
      const r = await ore<Data>("settings", opt("ai", v));
      setData(r);
      dataRef.current = r;
    }, record ? { message: "Changed the AI provider", undo: () => setVendor(was.ai, false).then(() => setModel(was.model, false)), redo: () => setVendor(v, false) } : undefined);
  };
  const setModel = async (m: string, record = true): Promise<void> => {
    const d = dataRef.current;
    if (!d) return;
    const was = d.model;
    return change({ ...d, model: m }, () => ore("settings", opt("model", m)), record ? { message: "Changed the model", undo: () => setModel(was, false), redo: () => setModel(m, false) } : undefined);
  };

  const { width, size, page, font } = useReading();
  const keys = useKeymap();
  const [tray, setTrayState] = useState(trayOn);
  const [chips, setChips] = useState(chipLook);
  const [login, setLogin] = useState(false);
  useEffect(() => {
    invoke<boolean>("login_item", { on: null }).then((v) => setLogin(!!v), () => {});
  }, []);
  const title = SECTIONS.find((s) => s.id === section)!.label;

  return (
    // A large sheet over the app (ChatGPT's settings): the app shows in the margin around it, and a click there closes it.
    <div className="settings" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="titlebar" data-tauri-drag-region />
      <Trap>
      <div className="settings-sheet" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Settings">
      <Tabs.Root className="settings-tabs" orientation="vertical" value={section} onValueChange={pick}>
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

        <div className="settings-main">
          <div className="settings-page">
            <div className="settings-title">
              <h1>{title}</h1>
            </div>
            {error && <p className="err">{error}</p>}

            <Tabs.Content value="general" tabIndex={-1}>
              <Group title="Reading">
                <Row title="Reading width" text="How wide the text column is in the reader.">
                  <Seg label="Reading width" value={width} options={WIDTHS} onChange={(v) => setWidth(v as Width)} />
                </Row>
                <Row title="Text size" text="How big the text is in the reader.">
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
                <Row title="Reading page" text="A light page for reading by day. The rest of the app stays dark.">
                  <Previews label="Reading page" value={page} options={PAGES} onChange={(v) => setPage(v as Page)} render={(o) => <span className="preview-page" data-page={o.id}><i /><i /><i /></span>} />
                </Row>
                <Row title="Reading font" text="The face a source's text reads in.">
                  <Previews label="Reading font" value={font} options={FONTS} onChange={(v) => setFont(v as Font)} render={(o) => <span className="preview-font" data-font={o.id}>Aa</span>} />
                </Row>
              </Group>
              <Group title="Skills">
                <Row title="Skill tags" text="How a source's skills show in lists. Icon only leaves more room for titles.">
                  <Seg label="Skill tags" value={chips} options={CHIP_LOOKS} onChange={(v) => { setChipLook(v as ChipLook); setChips(v as ChipLook); }} />
                </Row>
              </Group>
              <Group title="Diagrams">
                <Row title="Style controls" text="Colours and widths in a picker by the pointer (S), or a panel at the canvas's edge whenever something is picked.">
                  <Seg label="Style controls" value={styleCtl} options={STYLE_CONTROLS} onChange={(v) => setStyleControls(v as StyleControls)} />
                </Row>
              </Group>
              {data && (
                <>
                  <Group title="AI">
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
                      text={data.model_env ? `Set to ${data.model_env} by ORE_AI_MODEL in the app's environment.` : "The model that drafts exercises, writes questions and checks answers."}
                    >
                      <SelectMenu
                        label="Model"
                        value={data.model}
                        options={modelOptions(data, models?.vendor === data.ai ? models.list : null)}
                        disabled={!!data.model_env}
                        onChange={(v) => void setModel(v)}
                      />
                    </Row>
                  </Group>
                  {!PHONE && (
                    <Group title="Import">
                      <TablesSetting notify={notify} Row={Row} />
                    </Group>
                  )}
                  <Group title="Library">
                    <Row title="Library folder" text="Your sources, notes and exercises, kept as plain files.">
                      <Hint text={data.library}>
                        <span className="settings-path">{home(data.library)}</span>
                      </Hint>
                      <button className="settings-btn" onClick={() => openPath(data.library).catch((e) => notify(errorText(e), "error"))}>
                        Show in Finder
                      </button>
                    </Row>
                  </Group>
                </>
              )}
            </Tabs.Content>

            <Tabs.Content value="review" tabIndex={-1}>
              {data && (
                <Group title="Daily goal">
                  <Row title="Minutes a day" text="Review time that fills the ring on Home.">
                    <Seg
                      label="Minutes a day"
                      value={String(data.review.goal_minutes)}
                      options={GOALS.map((m) => ({ id: String(m), label: String(m) }))}
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
                      options={NEW.map((m) => ({ id: String(m), label: String(m) }))}
                      onChange={(v) => void setGoal("new_per_day", "new-per-day", Number(v))}
                    />
                  </Row>
                </Group>
              )}
              {data && (
                <Group title="Daily plan">
                  <Row title="When you review" text="Tie review to something you already do every day.">
                    <PlanField plan={data.review.plan} onSave={(v) => void setGoal("plan", "plan", v)} />
                  </Row>
                  <Row title="Reminder" text="One notification at this time, only while today’s goal is still open.">
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
        onClick={() => {
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

export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="settings-group">
      <h2>{title}</h2>
      <div className="settings-card">{children}</div>
    </section>
  );
}

export function Row({ title, text, htmlFor, children }: { title: string; text: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="settings-row">
      <div className="settings-row-text">
        {htmlFor ? <label htmlFor={htmlFor}>{title}</label> : <span>{title}</span>}
        <p>{text}</p>
      </div>
      <div className="settings-row-control">{children}</div>
    </div>
  );
}

/** "After ___, I review." Enter or clicking away saves, Esc keeps what was there (D211). */
export function PlanField({ plan, onSave }: { plan: string; onSave: (v: string) => void }) {
  const [text, setText] = useState(plan);
  useEffect(() => setText(plan), [plan]);
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
        onChange={(e) => setText(e.target.value)}
        // Clicking away saves it, as Enter does (D211).
        onFocus={() => (settled.current = false)}
        onBlur={() => {
          if (settled.current) return;
          if (!document.hasFocus()) return;
          const v = text.trim().replace(/[.,;]+$/, "");
          setText(v);
          if (v !== plan) onSave(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const v = text.trim().replace(/[.,;]+$/, "");
            setText(v);
            if (v !== plan) onSave(v);
            settled.current = true;
            done(e.currentTarget);
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
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

/** A pop-up menu like macOS's and Calendar's time menu: the current pick ticked and in view; an
 *  option's description shows on hover. */
function SelectMenu({ label, value, options, disabled, onChange }: { label: string; value: string; options: readonly Model[]; disabled?: boolean; onChange: (v: string) => void }) {
  const list = useRef<HTMLDivElement>(null);
  const open = (o: boolean) => {
    if (!o) return;
    requestAnimationFrame(() => {
      const el = list.current?.querySelector<HTMLElement>('[data-state="checked"]');
      el?.scrollIntoView({ block: "center" });
      el?.focus();
    });
  };
  const current = options.find((o) => o.id === value)?.label ?? value;
  return (
    <DropdownMenu.Root onOpenChange={open}>
      <DropdownMenu.Trigger className="settings-btn settings-select" aria-label={label} disabled={disabled}>
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
            {options.map((o) => {
              const item = (
                <DropdownMenu.RadioItem key={o.id || "default"} value={o.id} className="menu-item check">
                  <span className="menu-tick">
                    <DropdownMenu.ItemIndicator>
                      <Tick />
                    </DropdownMenu.ItemIndicator>
                  </span>
                  <span className="menu-label">{o.label}</span>
                </DropdownMenu.RadioItem>
              );
              return o.description ? <Hint key={o.id || "default"} text={o.description} side="left">{item}</Hint> : item;
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
