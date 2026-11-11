import * as Popover from "@radix-ui/react-popover";
import { Command } from "cmdk";
import { CaretDown, Check as CheckIcon, Plus } from "./icons";
import { useEffect, useRef, useState, type ElementType, type ReactNode, type RefObject, type SyntheticEvent } from "react";
import { Hint } from "./Hint";
import { isOther } from "../../../packages/core/src/collection-name";
import { useLite } from "./Lite";
import { Trap } from "./Trap";
import { focusFilter, IconPicker, SkillIcon, Swatches } from "./IconPicker";
import { ore, opt, type Skill, type SkillColor } from "./ore";
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

/** A source's skills on a row (D198, Linear's labels): the first two by name, whole, then +N with the
 *  rest named on hover, so a source under six skills never squeezes them to "L." and "Story…". Icon
 *  only shows them all, since an icon is narrower than the count. */
export function SkillChips({ ids, skills }: { ids: string[]; skills: Skill[] }) {
  const all = ids.map((id) => skills.find((s) => s.id === id) ?? { id, name: id });
  const first = chipLook() === "icon" ? all : all.slice(0, 2);
  const rest = all.slice(first.length).map((s) => s.name).join(", ");
  return (
    <span className="chips">
      {first.map((s) => <SkillChip key={s.id} skill={s} />)}
      {rest && (
        <Hint text={rest}>
          <span className="chip chip-more" aria-label={rest}>+{all.length - first.length}</span>
        </Hint>
      )}
    </span>
  );
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
      data-no-drag
      onClick={stop}
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
          }} onClick={stop} onKeyDown={stop} onContextMenu={stop}>
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

/** Filed only under archived skills (D173), as core's `archivedOnly`: it waits out of Home. */
export const archivedOnly = (ids: string[], skills: Skill[]) => {
  const own = skills.filter((s) => ids.includes(s.id));
  return own.length > 0 && own.every((s) => s.archived);
};

/** The header over the skills in no collection, once there are collections. No collection takes its name. */
export const UNGROUPED = "Other";

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
    const to = (name: string) => () => ore("skills", "set", skill.id, opt("name", name)).then(onRenamed);
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
  // An icon from before D157 (an emoji, "ph:") draws nothing and core refuses it, so it reads as none: Undo clears it.
  const [look, setLook] = useState<Look>({ icon: skill.icon?.startsWith("mc:") ? skill.icon : "", color: skill.color ?? "", collection: skill.collection ?? "" });
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
      if (undoable && before[key] !== value) notify(`Changed the ${what} of ${skill.name}`, "quiet", () => set(key, before[key], false), () => set(key, value, false));
    } catch (e) {
      setLook(before);
      // From the history (undo or redo): it puts the step back and says why.
      if (!undoable) throw e;
      notify(errorText(e), "error");
    }
  };

  // Esc closes the editor from inside the panel, and from the body: Radix hands focus back to the
  // icon button a tick after the picker unmounts, so an Esc in that tick lands on the body. One from
  // inside a popover (its portal sits outside the panel) is Radix's, which closes the popover.
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const panel = panelRef.current;
      const t = e.target as Node | null;
      if (e.key !== "Escape" || e.defaultPrevented || !panel || !(t === document.body || panel.contains(t))) return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <Trap>
      <div ref={panelRef} className="panel skill-edit" role="dialog" aria-modal="true" aria-label={`Edit skill ${skill.name}`}>
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
              <Popover.Content className="popover" side="bottom" align="start" sideOffset={6} collisionPadding={12} onOpenAutoFocus={focusFilter}>
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
        <div className="look-row">
          <span>Color</span>
          <Swatches className="swatches" value={look.color} onPick={(c) => void set("color", c)} />
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
              {typed && !isOther(typed) && !collections.some((c) => c.toLowerCase() === typed.toLowerCase()) && (
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
  // The history puts a failed step back and says why; the screens reload either way.
  const fail = (e: unknown) => {
    onChanged();
    throw e;
  };
  notify(
    `Created skill ${skill.name}`,
    "quiet",
    () => ore<{ removed: unknown }>("skills", "rm", skill.id).then((r) => ((removed = r.removed), onGone?.(skill.id), onChanged()), fail),
    () => (removed ? ore("skills", "restore", JSON.stringify(removed)) : Promise.resolve()).then(onChanged, fail),
  );
}

const Check = () => <CheckIcon className="check" size={12} aria-hidden="true" />;

/** Deleting a skill whose sources are filed nowhere else asks what happens to them (Tyler's call):
 *  kept by default, untagged, or archived. With nothing to ask it deletes at once, with Undo. Cards always stay and keep reviewing. Enter deletes, Esc cancels. */
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
  useFocusWhileMounted(keepRef);
  const n = (k: number) => `${k} source${k === 1 ? "" : "s"}`;
  const alsoArchived = sources.archived ? ` (and ${sources.archived} archived)` : "";

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const rm = () => ore<{ removed: unknown }>("skills", "rm", skill.id, ...(archive ? ["--archive"] : []));
      let { removed } = await rm();
      // The history puts a failed step back and says why; the screens reload either way.
      const fail = (e: unknown) => {
        onChanged();
        throw e;
      };
      notify(
        `Deleted ${skill.name}`,
        "info",
        () => ore("skills", "restore", JSON.stringify(removed)).then(onChanged, fail),
        () => rm().then((r) => ((removed = r.removed), onChanged()), fail),
      );
      onDone(true);
    } catch (e) {
      notify(errorText(e), "error");
      setBusy(false);
      // With no dialog to try again from, it lets go: Delete skill… starts it over.
      if (!choice) onDone(false);
    }
  };

  // Nothing to decide (no source would be left in no skill): it goes at once, with Undo, as every
  // other delete does. The dialog is only for the Keep or Archive choice.
  const once = useRef(false);
  useEffect(() => {
    if (choice || once.current) return;
    once.current = true;
    void remove();
  }, []);
  if (!choice) return null;

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onDone(false)}>
      <Trap>
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
        ) : null}
        <p className="quiet">Its exercises stay and keep coming up in review.</p>
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
      </Trap>
    </div>
  );
}
