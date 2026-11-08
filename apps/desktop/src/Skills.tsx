import * as Popover from "@radix-ui/react-popover";
import { Command } from "cmdk";
import { CaretDown, Check as CheckIcon, Plus } from "./icons";
import { useEffect, useRef, useState, type ElementType, type ReactNode, type RefObject, type KeyboardEvent as ReactKeyboardEvent, type SyntheticEvent } from "react";
import { Hint } from "./Hint";
import { useLite } from "./Lite";
import { Trap } from "./Trap";
import { IconPicker, SkillIcon } from "./IconPicker";
import { ore, opt, SKILL_COLORS, type Skill, type SkillColor } from "./ore";
import { errorText, load, save, useFocusWhileMounted, type Notify } from "./util";

/** How skill tags show in lists (Settings → General): icon and name, or the icon alone for a small
 *  screen or less to read; the name is then said on hover and to VoiceOver. */
export const CHIP_LOOKS = [
  { id: "name", label: "Icon and name" },
  { id: "icon", label: "Icon only" },
] as const;
export type ChipLook = (typeof CHIP_LOOKS)[number]["id"];
export const chipLook = (): ChipLook => (load("ore.chips") === "icon" ? "icon" : "name");
export function setChipLook(look: ChipLook) {
  document.documentElement.dataset.chips = look;
  save("ore.chips", look);
}
if (typeof document !== "undefined") document.documentElement.dataset.chips = chipLook();

export function SkillChip({ skill }: { skill: Skill }) {
  const chip = (
    <span className="chip" data-color={skill.color}>
      <SkillIcon icon={skill.icon} color={skill.color} className="icon" />
      <span className="chip-name">{skill.name}</span>
    </span>
  );
  return chipLook() === "icon" || skill.name.length > 24 ? <Hint text={skill.name}>{chip}</Hint> : chip;
}

/** A source's skill pills, and the picker they open on click: Linear's label picker (Notion's
 *  multi-select). Type to filter, click or Enter ticks or unticks a skill and the list stays open, a
 *  name no skill has creates one. With no skills, a quiet + on hover stands where the pills would be.
 *  The caller writes `next` and offers Undo back to `before`. */
export function SkillPicker({ skills, value, title, onChange, onCreate, startOpen = false, onClosed, returnFocus, children }: {
  skills: Skill[];
  value: string[];
  /** The source's title, for the button's label. */
  title: string;
  /** `changed` is the skill just ticked or unticked, for the toast. */
  onChange: (next: string[], before: string[], changed: Skill) => void;
  /** Makes a skill (`ore skills add`); undefined if that failed and the caller said why. */
  onCreate: (name: string) => Promise<Skill | undefined>;
  /** Opens as it appears: on a source just added with no skill, so filing it is the next keystroke. */
  startOpen?: boolean;
  onClosed?: () => void;
  /** Where focus goes when it closes, instead of back to the pills (the add box's text field, so ↵ adds). */
  returnFocus?: RefObject<HTMLElement | null>;
  /** The pills (or their names); none (on a skill page, the page's own is left out) shows the +. */
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(startOpen);
  const lite = useLite();
  const [query, setQuery] = useState("");
  // Ticks made while open show at once and build on each other; whenever the skills it is given change
  // (a save landing, or one that failed and was taken back), it shows those, open or not.
  const [sel, setSel] = useState(value);
  const given = value.join(",");
  useEffect(() => {
    setSel(given ? given.split(",") : []);
  }, [open, given]);
  // The skills it had when it opened come first (Linear's labels), so they are seen at once; the order
  // holds while it is open, so a row never jumps out from under the pointer, and re-sorts next time.
  const [first, setFirst] = useState(value);
  const typed = query.trim().replace(/\s+/g, " ");
  // Matched by name, in sidebar order, with Create last (Linear): no fuzzy matches to skim past.
  const shown = skillsFirst(skills, first).filter((k) => k.name.toLowerCase().includes(typed.toLowerCase()));
  const toggle = (k: Skill) => {
    const next = sel.includes(k.id) ? sel.filter((s) => s !== k.id) : [...sel, k.id];
    onChange(next, sel, k);
    setSel(next);
  };
  const create = async () => {
    const made = await onCreate(typed);
    if (!made) return;
    setQuery("");
    toggle(made);
  };
  // A row opens on click and a list takes arrow keys: what happens in here stays in here (the
  // portal still bubbles React events up to the row).
  const stop = (e: SyntheticEvent) => e.stopPropagation();
  // Off screen in a long list (Lite.tsx): the pills as the trigger renders them, the picker once the row scrolls in.
  const bare = lite && !open;
  const button = (
    <button
      {...(bare && { type: "button", "aria-haspopup": "dialog", "aria-expanded": false })}
      className={children ? "chips-button" : "chips-add"}
      aria-label={`Skills for ${title}`}
      onClick={stop}
      onPointerDown={stop}
      onKeyDown={(e) => e.key === "Enter" && stop(e)}
    >
      {children || <Plus size={11} weight="bold" aria-hidden="true" />}
    </button>
  );
  if (bare) return button;
  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setFirst(sel);
        else {
          setQuery("");
          onClosed?.();
        }
      }}
    >
      <Hint text={children ? "Change skills" : "Add to a skill"}>
        <Popover.Trigger asChild>{button}</Popover.Trigger>
      </Hint>
      <Popover.Portal>
        <Popover.Content className="popover menu skill-picker" side="bottom" align="start" sideOffset={4} collisionPadding={8} onCloseAutoFocus={(e) => {
            if (!returnFocus?.current) return;
            e.preventDefault();
            returnFocus.current.focus();
          }} onClick={stop} onPointerDown={stop} onKeyDown={stop} onContextMenu={stop}>
          <Command label="Skills" loop shouldFilter={false}>
            <Command.Input className="menu-input" placeholder="Find or create a skill…" value={query} onValueChange={setQuery} autoFocus />
            <Command.List>
              {shown.map((k) => (
                <Command.Item key={k.id} value={k.id} onSelect={() => toggle(k)}>
                  <SkillIcon icon={k.icon} color={k.color} dot className="palette-icon" />
                  <span className="menu-label">{k.name}</span>
                  {sel.includes(k.id) && <Check />}
                </Command.Item>
              ))}
              {typed && !skills.some((k) => k.name.toLowerCase() === typed.toLowerCase()) && (
                <Command.Item value={`create ${typed}`} onSelect={() => void create()}>
                  <span className="sub">Create</span> <span className="menu-label">{typed}</span>
                </Command.Item>
              )}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** `now` with the one change from `before` to `next` taken back, keeping any made since (a failed save's rollback). */
export const unfile = (now: string[], next: string[], before: string[]) => [
  ...now.filter((s) => before.includes(s) || !next.includes(s)),
  ...before.filter((s) => !next.includes(s) && !now.includes(s)),
];

/** `skills` with the `first` ids ahead of the rest, each part keeping its sidebar order. */
export const skillsFirst = (skills: Skill[], first: string[]): Skill[] => [
  ...skills.filter((k) => first.includes(k.id)),
  ...skills.filter((k) => !first.includes(k.id)),
];

/** The header over the skills in no collection, once there are collections. No collection takes its name. */
export const UNGROUPED = "Other";
/** Whether a collection name is the ungrouped skills' header, any case. */
export const isUngroupedName = (name: string) => name.trim().toLowerCase() === UNGROUPED.toLowerCase();

/** Sidebar groups: each collection in the order it first appears in skills.yaml, then the rest
 *  (`collection` is "" for those). */
export function skillGroups(skills: Skill[]): { name: string; collection: string; skills: Skill[] }[] {
  const names = [...new Set(skills.flatMap((s) => (s.collection ? [s.collection] : [])))];
  const groups = names.map((name) => ({ name, collection: name, skills: skills.filter((s) => s.collection === name) }));
  const rest = skills.filter((s) => !s.collection);
  if (rest.length || !names.length) groups.push({ name: names.length ? UNGROUPED : "Skills", collection: "", skills: rest });
  return groups;
}

/** The sidebar layout `ore skills arrange` takes: collections in order with their skill ids. */
export type SkillLayout = { collection: string; skills: string[] }[];
export const layoutOf = (groups: ReturnType<typeof skillGroups>): SkillLayout => groups.map((g) => ({ collection: g.collection, skills: g.skills.map((s) => s.id) }));

/** A skill's name, renamed in place like a Notion page title: click it (or open with `editing`),
 *  Enter saves through `ore skills set --name`, Esc or clicking away keeps the old name. */
export function SkillName({ skill, as: Tag = "h1", editing = false, inputRef, onRenamed, onEnter, notify }: {
  skill: Skill;
  as?: ElementType;
  /** Starts in edit; the caller focuses `inputRef` (so it can hand focus back on close). */
  editing?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  onRenamed: () => void;
  /** Enter saved the name: a dialog around it closes, as a Mac dialog's default button does. */
  onEnter?: () => void;
  notify: Notify;
}) {
  const [draft, setDraft] = useState<string | null>(editing ? skill.name : null);
  const [clicked, setClicked] = useState(false);
  // Enter or Esc puts focus back on the name, so the next Esc reaches the dialog around it.
  const button = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);
  useEffect(() => {
    if (draft === null && refocus.current) button.current?.focus();
    refocus.current = false;
  }, [draft]);
  const [saving, setSaving] = useState(false);
  /** `saving` for the blur's timeout, which runs after the render it was made in. */
  const busy = useRef(false);
  /** True once the name is saved (or unchanged); a failed save keeps his draft in the field. */
  const save = async () => {
    const v = (draft ?? "").trim().replace(/\s+/g, " ");
    if (!v) return false;
    const close = () => ((refocus.current = true), setDraft(null), true);
    if (v === skill.name) return close();
    const to = (name: string) => () =>
      void ore("skills", "set", skill.id, opt("name", name)).then(onRenamed, (e) => notify(errorText(e), "error"));
    setSaving((busy.current = true));
    try {
      await ore("skills", "set", skill.id, opt("name", v));
      onRenamed();
      notify(`Renamed “${skill.name}” to “${v}”`, "info", to(skill.name), to(v));
      return close();
    } catch (e) {
      notify(errorText(e), "error");
      return false;
    } finally {
      setSaving((busy.current = false));
    }
  };
  if (draft === null)
    return (
      <Tag className="skill-name">
        <Hint text="Rename">
          <button
            ref={button}
            onClick={() => {
              setClicked(true);
              setDraft(skill.name);
            }}
          >
            {skill.name}
          </button>
        </Hint>
      </Tag>
    );
  return (
    <Tag className="skill-name">
      <input
        ref={inputRef}
        autoFocus={clicked}
        onFocus={(e) => e.currentTarget.select()}
        value={draft}
        readOnly={saving}
        aria-label={`Rename ${skill.name}`}
        autoComplete="off"
        onChange={(e) => setDraft(e.target.value)}
        // Clicking away keeps the old name; a focus that comes straight back (a dialog opening) does not count.
        onBlur={(e) => {
          const input = e.currentTarget;
          setTimeout(() => !busy.current && document.activeElement !== input && setDraft(null), 0);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key !== "Enter" && e.key !== "Escape") return;
          e.preventDefault(); // or the Enter would also click the name button that takes focus
          if (e.key === "Enter" && !saving) void save().then((ok) => ok && onEnter?.());
          if (e.key === "Escape" && !saving) {
            refocus.current = true;
            setDraft(null);
          }
        }}
      />
    </Tag>
  );
}

type Look = { icon: string; color: SkillColor | ""; collection: string };

/** Name, icon, color and collection of one skill. Each pick saves at once to skills.yaml through `ore skills set`. */
export function SkillEditor({ skill, rename, collections, onSaved, onClose, onDelete, notify }: {
  skill: Skill;
  /** Opened from Rename…: the name starts in edit. */
  rename?: boolean;
  collections: string[];
  onSaved: () => void;
  onClose: () => void;
  onDelete: () => void;
  notify: Notify;
}) {
  const [look, setLook] = useState<Look>({ icon: skill.icon ?? "", color: skill.color ?? "", collection: skill.collection ?? "" });
  const [picking, setPicking] = useState(false);
  const iconRef = useRef<HTMLButtonElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  useFocusWhileMounted(rename ? nameRef : iconRef);

  const set = async <K extends keyof Look>(key: K, value: Look[K], undoable = true) => {
    const before = look;
    setLook((l) => ({ ...l, [key]: value }));
    try {
      await ore("skills", "set", skill.id, opt(key, value));
      onSaved();
      const what = { icon: "icon", color: "colour", collection: "collection" }[key];
      if (undoable && before[key] !== value) notify(`Changed the ${what} of ${skill.name}`, "quiet", () => void set(key, before[key], false), () => void set(key, value, false));
    } catch (e) {
      setLook(before);
      notify(errorText(e), "error");
    }
  };

  // Keys from a popover bubble here through its portal; Radix closes the popover on Esc, so only
  // an Esc from inside the panel itself closes the editor.
  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === "Escape" && e.currentTarget.contains(e.target as Node)) {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <Trap>
      <div className="panel skill-edit" role="dialog" aria-modal="true" aria-label={`Edit skill ${skill.name}`} onKeyDown={onKey}>
        <div className="skill-edit-head">
          <Popover.Root open={picking} onOpenChange={setPicking}>
            <Hint text={look.icon ? "Change icon" : "Add icon"}>
              <Popover.Trigger asChild>
                <button ref={iconRef} className="icon-button" aria-label={look.icon ? "Change icon" : "Add icon"}>
                  <SkillIcon icon={look.icon} color={look.color} dot />
                </button>
              </Popover.Trigger>
            </Hint>
            <Popover.Portal>
              <Popover.Content className="popover" side="bottom" align="start" sideOffset={6} collisionPadding={12}>
                <IconPicker
                  value={look.icon}
                  color={look.color}
                  onPick={(icon) => {
                    void set("icon", icon);
                    setPicking(false);
                  }}
                  onColor={(c) => void set("color", c)}
                  onRemove={() => {
                    void set("icon", "");
                    setPicking(false);
                  }}
                />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
          <SkillName skill={skill} as="h2" editing={rename} inputRef={nameRef} onRenamed={onSaved} onEnter={onClose} notify={notify} />
        </div>
        <div className="look-row" role="radiogroup" aria-label="Color">
          <span>Color</span>
          <span className="swatches">
            {(["", ...SKILL_COLORS] as const).map((c) => (
              <Hint key={c || "none"} text={c ? c[0]!.toUpperCase() + c.slice(1) : "No color"}>
                <button
                  className="swatch"
                  data-color={c || undefined}
                  role="radio"
                  aria-checked={look.color === c}
                  aria-label={c || "No color"}
                  onClick={() => void set("color", c)}
                />
              </Hint>
            ))}
          </span>
        </div>
        <div className="look-row">
          <span>Collection</span>
          <CollectionPicker value={look.collection} collections={collections} onPick={(c) => void set("collection", c)} />
        </div>
        <div className="skill-edit-foot">
          <button className="foot-danger" onClick={onDelete}>
            Delete skill…
          </button>
          <span className="right">
            <kbd>Esc</kbd> close
          </span>
        </div>
      </div>
      </Trap>
    </div>
  );
}

/** Pick an existing collection, type a new one, or clear it: a combobox, never free text saved on blur. */
function CollectionPicker({ value, collections, onPick }: { value: string; collections: string[]; onPick: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const typed = query.trim();
  const choose = (c: string) => {
    onPick(c);
    setOpen(false);
    setQuery("");
  };
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="select-button">
          <span className={value ? "" : "placeholder"}>{value || "None"}</span>
          <CaretDown size={12} aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="popover menu" side="bottom" align="start" sideOffset={4}>
          <Command label="Collection">
            <Command.Input className="menu-input" placeholder="Find or create a collection…" value={query} onValueChange={setQuery} autoFocus />
            <Command.List>
              {collections.map((c) => (
                <Command.Item key={c} value={c} onSelect={() => choose(c)}>
                  <span className="menu-label">{c}</span>
                  {c === value && <Check />}
                </Command.Item>
              ))}
              {typed && !isUngroupedName(typed) && !collections.some((c) => c.toLowerCase() === typed.toLowerCase()) && (
                <Command.Item value={`create ${typed}`} onSelect={() => choose(typed)}>
                  <span className="sub">Create</span> {typed}
                </Command.Item>
              )}
              {value && (
                <Command.Item value="remove from collection" onSelect={() => choose("")} className="danger">
                  Remove from collection
                </Command.Item>
              )}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** A skill he just made goes on the history: undo deletes it (taking it off anything filed under it
 *  since), redo puts it back with all of that. `onGone` leaves its page if he is on it. */
export function skillMade(skill: Skill, notify: Notify, onChanged: () => void, onGone?: (id: string) => void) {
  let removed: unknown = null;
  const fail = (e: unknown) => (notify(errorText(e), "error"), onChanged());
  notify(
    `Created skill ${skill.name}`,
    "quiet",
    () =>
      void ore<{ removed: unknown }>("skills", "rm", skill.id).then((r) => ((removed = r.removed), onGone?.(skill.id), onChanged()), fail),
    () => void (removed ? ore("skills", "restore", JSON.stringify(removed)) : Promise.resolve()).then(onChanged, fail),
  );
}

const Check = () => <CheckIcon className="check" size={12} aria-hidden="true" />;

/** Deleting a skill asks what happens to its sources (Tyler's call): kept by default, untagged, or
 *  archived when filed nowhere else. Cards always stay and keep reviewing. Enter deletes, Esc cancels. */
export function DeleteSkill({ skill, sources, onDone, onChanged, notify }: {
  skill: Skill;
  /** Its sources, how many are filed under no other skill, and its archived ones (the delete takes it off them too). */
  sources: { all: number; only: number; archived: number };
  onDone: (deleted: boolean) => void;
  /** Undo or redo changed the library after the dialog closed. */
  onChanged: () => void;
  notify: Notify;
}) {
  const [archive, setArchive] = useState(false);
  const [busy, setBusy] = useState(false);
  const keepRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const choice = sources.all > 0 && sources.only > 0;
  useFocusWhileMounted(choice ? keepRef : panelRef);
  const n = (k: number) => `${k} source${k === 1 ? "" : "s"}`;
  const alsoArchived = sources.archived ? ` (and ${sources.archived} archived)` : "";

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const rm = () => ore<{ removed: unknown }>("skills", "rm", skill.id, ...(archive ? ["--archive"] : []));
      let { removed } = await rm();
      const fail = (e: unknown) => (notify(errorText(e), "error"), onChanged());
      notify(
        `Deleted ${skill.name}`,
        "info",
        () => void ore("skills", "restore", JSON.stringify(removed)).then(onChanged, fail),
        () => void rm().then((r) => ((removed = r.removed), onChanged()), fail),
      );
      onDone(true);
    } catch (e) {
      notify(errorText(e), "error");
      setBusy(false);
    }
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onDone(false)}>
      <div
        ref={panelRef}
        tabIndex={-1}
        className="panel skill-edit skill-delete"
        role="alertdialog"
        aria-modal="true"
        aria-label={`Delete ${skill.name}`}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onDone(false);
          } else if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) {
            e.preventDefault();
            void remove();
          }
        }}
      >
        <h2>Delete {skill.name}?</h2>
        {choice ? (
          <fieldset className="delete-choice">
            <legend>Its {n(sources.all)}{alsoArchived}</legend>
            <label>
              <input ref={keepRef} type="radio" name="sources" checked={!archive} onChange={() => setArchive(false)} />
              <span>
                Keep them
                <small>They stay in All sources, without this skill.</small>
              </span>
            </label>
            <label>
              <input type="radio" name="sources" checked={archive} onChange={() => setArchive(true)} />
              <span>
                Archive them
                <small>{sources.only === sources.all ? "Hidden from lists and search." : `The ${n(sources.only)} in no other skill. Hidden from lists and search.`}</small>
              </span>
            </label>
          </fieldset>
        ) : (
          <p className="quiet">{sources.all ? `Its ${n(sources.all)}${alsoArchived} stay under their other skills.` : sources.archived ? `Only ${n(sources.archived)} in Archived are filed under it.` : "No sources are filed under it."}</p>
        )}
        <p className="quiet">Its cards stay and keep coming up in review.</p>
        <div className="skill-edit-foot">
          <span className="right">
            <button className="quiz-ghost small" onClick={() => onDone(false)}>
              Cancel <kbd>Esc</kbd>
            </button>
            <button className="danger-btn" onClick={() => void remove()} disabled={busy}>
              Delete skill <kbd>↵</kbd>
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
