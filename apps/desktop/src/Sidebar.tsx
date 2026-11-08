import { CaretRight, House, Plus, Rss, Stack } from "./icons";
import {
  closestCenter, defaultDropAnimationSideEffects, DndContext, DragOverlay, PointerSensor, pointerWithin, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DragOverEvent, type DragStartEvent, type DropAnimation, type UniqueIdentifier,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Fragment, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Hint } from "./Hint";
import { MoreButton, WithMenu, type MenuAction } from "./Menu";
import { isOther, tidyCollection } from "../../../packages/core/src/collection-name";
import { SkillIcon } from "./IconPicker";
import { useSideCursor } from "./SideCursor";
import { ore, opt, type Skill } from "./ore";
import { layoutOf, skillGroups, UNGROUPED, type SkillLayout } from "./Skills";
import { errorText, load, save } from "./util";

const CLOSED = "ore.side-closed";
function closedGroups(): string[] {
  try {
    const v: unknown = JSON.parse(load(CLOSED) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** A collection's group id for dnd-kit; skill ids are plain skill ids. */
const GROUP = "group:";
const groupId = (collection: string) => GROUP + collection;
const isGroup = (id: UniqueIdentifier) => String(id).startsWith(GROUP);

type Group = ReturnType<typeof skillGroups>[number];

/** Rows slide out of the way and the lifted row settles into its slot, as tabs do in Dia and Arc. */
const SETTLE: DropAnimation = { duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)", sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0" } } }) };

/** Skills by collection, Notion-style: a header collapses its group, and its + (on hover) names a new
 *  skill in place. Skills and collections move by drag, Dia-style: the row lifts at once, a slot opens
 *  where it will land and the other rows slide aside; a skill drops into, out of and within any
 *  collection. Icons sit bare (Dia, Notion); the open skill's row takes its color, as Dia tints a space,
 *  and holds a fainter tint while one of its sources is open. */
export function Sidebar({ skills, skill, within, home, onHome, feed, onFeed, hidden, peek, drop, onPointer, onOpen, menu, onCreated, onArrange, onDeleteCollection }: {
  skills: Skill[];
  skill: string | null;
  /** A source is open: the selected row is where it sits, so it takes a quieter tint than its own page. */
  within: boolean;
  home: boolean;
  onHome: () => void;
  /** The Feed is open (posts from the blogs and newsletters he follows). */
  feed: boolean;
  onFeed: () => void;
  hidden: boolean;
  /** Floating over the content while the sidebar is collapsed; reports the pointer entering and leaving. */
  peek: boolean;
  /** While files are dragged in: the skill they would go to ("" for no skill), ringed. */
  drop?: string;
  onPointer: (over: boolean) => void;
  onOpen: (id: string | null) => void;
  /** A skill's actions, on right-click and its ⋯. */
  menu: (s: Skill) => MenuAction[];
  onCreated: (s: Skill) => void;
  /** A new sidebar layout: a skill or collection moved, or a collection renamed. `step` names a step
   *  taken from a menu or a name field, which gets a toast with Undo (a drag shows its result in place). */
  onArrange: (layout: SkillLayout, step?: string) => void;
  /** Removes a collection; its skills move to the ungrouped ones. */
  onDeleteCollection: (collection: string) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const groups = useMemo(() => skillGroups(skills), [skills]);
  // While dragging: the layout as it would be if dropped now.
  const [draft, setDraft] = useState<Group[] | null>(null);
  const [active, setActive] = useState<UniqueIdentifier | null>(null);
  const [closed, setClosed] = useState(closedGroups);
  const [adding, setAdding] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  // A group that exists only while its first skill is named: a new collection, or "Other" when
  // every skill is in one ("" names it). It is saved with that skill, so Esc leaves nothing behind.
  const [fresh, setFresh] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);
  const marked = skills.some((s) => s.icon || s.color);
  const base = draft ?? groups;
  const freshGroup = fresh !== null && !base.some((g) => g.collection === fresh) ? { name: fresh || UNGROUPED, collection: fresh, skills: [] } : null;
  const last = base.length - (base.at(-1)?.collection ? 0 : 1);
  const shown = freshGroup ? (fresh ? [...base.slice(0, last), freshGroup, ...base.slice(last)] : [...base, freshGroup]) : base;
  const named = groups.filter((g) => g.collection);

  const setClosedSaved = (next: string[]) => {
    setClosed(next);
    save(CLOSED, JSON.stringify(next));
  };
  const toggle = (name: string) => setClosedSaved(closed.includes(name) ? closed.filter((n) => n !== name) : [...closed, name]);
  const isOpen = (g: Group) => !closed.includes(g.name) || adding === g.name;

  const groupOf = (list: Group[], id: UniqueIdentifier) =>
    isGroup(id) ? list.findIndex((g) => groupId(g.collection) === id) : list.findIndex((g) => g.skills.some((s) => s.id === id));

  // A dragged collection only meets other collections. A dragged skill meets the row under the
  // pointer, or the group (header, collapsed or empty) when no row is.
  const collide: CollisionDetection = (args) => {
    if (active !== null && isGroup(active)) return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => isGroup(c.id)) });
    const hits = pointerWithin(args);
    const row = hits.find((h) => !isGroup(h.id));
    if (row) return [row];
    if (hits.length) return [hits[0]!];
    return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => !isGroup(c.id)) });
  };

  const onDragStart = ({ active: a }: DragStartEvent) => {
    setActive(a.id);
    setDraft(groups);
  };
  // A skill crossing into another group joins it at the row it is over (or the end), so the slot
  // opens there while the drag is still going.
  const onDragOver = ({ active: a, over }: DragOverEvent) => {
    if (!over || isGroup(a.id) || !draft) return;
    const from = groupOf(draft, a.id);
    const to = groupOf(draft, over.id);
    if (from < 0 || to < 0 || from === to) return;
    const moving = draft[from]!.skills.find((s) => s.id === a.id)!;
    const target = draft[to]!.skills;
    const at = isGroup(over.id) || !isOpen(draft[to]!) ? target.length : Math.max(0, target.findIndex((s) => s.id === over.id));
    setDraft(draft.map((g, i) =>
      i === from ? { ...g, skills: g.skills.filter((s) => s.id !== a.id) } : i === to ? { ...g, skills: [...target.slice(0, at), moving, ...target.slice(at)] } : g));
  };
  const onDragEnd = ({ active: a, over }: DragEndEvent) => {
    let next = draft ?? groups;
    if (over && isGroup(a.id)) {
      const from = groupOf(next, a.id);
      const to = groupOf(next, over.id);
      // The ungrouped skills always come last.
      if (from >= 0 && to >= 0 && next[to]!.collection) next = arrayMove(next, from, to);
    } else if (over && !isGroup(over.id)) {
      const g = groupOf(next, a.id);
      if (g >= 0 && g === groupOf(next, over.id)) {
        const list = next[g]!.skills;
        next = next.map((x, i) => (i === g ? { ...x, skills: arrayMove(list, list.findIndex((s) => s.id === a.id), list.findIndex((s) => s.id === over.id)) } : x));
      }
    }
    setActive(null);
    setDraft(null);
    const layout = layoutOf(next.filter((g) => g.collection || g.skills.length));
    if (JSON.stringify(layout) !== JSON.stringify(layoutOf(groups.filter((g) => g.collection || g.skills.length)))) onArrange(layout);
  };
  const onDragCancel = () => {
    setActive(null);
    setDraft(null);
  };

  const rename = (g: Group, name: string) => {
    setRenaming(null);
    const v = tidyCollection(name);
    if (!v || v === g.collection) return;
    if (closed.includes(g.name)) setClosedSaved(closed.map((n) => (n === g.name ? v : n)));
    onArrange(layoutOf(groups.map((x) => (x === g ? { ...x, collection: v } : x))), `Renamed collection “${g.collection}” to “${v}”`);
  };
  // Finder's New Folder: the name field opens where collections end, Enter makes it and names its
  // first skill (a collection is the skills in it), Esc or clicking away drops it.
  const nameCollection = (name: string) => {
    setNaming(false);
    const v = tidyCollection(name);
    if (!v) return;
    // "Other" is where skills in no collection already go.
    if (isOther(v)) return newSkill();
    const existing = groups.find((g) => g.collection.toLowerCase() === v.toLowerCase());
    if (!existing) setFresh(v);
    setAdding(existing?.name ?? v);
  };
  const newSkill = () => {
    const rest = groups.find((g) => !g.collection);
    if (!rest) setFresh("");
    setAdding(rest?.name ?? UNGROUPED);
  };
  // Right-click on the sidebar around the rows, as on Finder's or Notion's sidebar.
  const spaceMenu: MenuAction[] = [
    { id: "new-skill", label: "New skill", run: newSkill },
    { id: "new-collection", label: "New collection", run: () => setNaming(true) },
  ];
  const nudge = (g: Group, by: number) => {
    const i = groups.indexOf(g);
    onArrange(layoutOf(arrayMove(groups, i, i + by)), `Moved “${g.name}” ${by < 0 ? "up" : "down"}`);
  };
  const groupMenu = (g: Group): MenuAction[] => {
    const i = named.indexOf(g);
    return [
      { id: "new", label: "New skill", run: () => setAdding(g.name) },
      ...(g.collection
        ? [
            { id: "rename", label: "Rename…", run: () => setRenaming(g.collection) },
            ...(i > 0 ? [{ id: "up", label: "Move up", run: () => nudge(g, -1) }] : []),
            ...(i < named.length - 1 ? [{ id: "down", label: "Move down", run: () => nudge(g, 1) }] : []),
            { id: "delete", label: "Delete collection", danger: true, divider: true, run: () => onDeleteCollection(g.collection) },
          ]
        : []),
    ];
  };

  const lifted = active === null ? null : isGroup(active) ? shown.find((g) => groupId(g.collection) === active) : skills.find((s) => s.id === active);

  const namingField = (
    <div className="side-section" key="naming">
      <div className="side-head">
        <RenameField value="" label="New collection name" placeholder="Collection name" onSave={nameCollection} onCancel={() => setNaming(false)} />
      </div>
    </div>
  );

  const nav = useRef<HTMLElement>(null);
  const cursor = useSideCursor(nav, home ? "home" : feed ? "feed" : skill ?? "all");

  return (
    <WithMenu actions={spaceMenu}>
    <nav
      ref={nav}
      onPointerDown={cursor.onPointerDown}
      className={`sidebar${peek ? " peek" : ""}${within ? " within" : ""}${active !== null ? " sorting" : ""}`}
      aria-label="Skills"
      hidden={hidden}
      onMouseEnter={peek ? () => onPointer(true) : undefined}
      onMouseLeave={peek ? () => onPointer(false) : undefined}
    >
      {cursor.arrow}
      <Hint text="Home" keys="home" side="right">
        <button className={`side-item side-main${home ? " on" : ""}`} aria-pressed={home} onClick={onHome}>
          {marked && (
            <span className="mark" aria-hidden="true">
              <House size={15} weight={home ? "fill" : "regular"} />
            </span>
          )}
          <span className="label">Home</span>
        </button>
      </Hint>
      <Hint text="Feed" keys="go-feed" side="right">
        <button className={`side-item side-main${feed ? " on" : ""}`} aria-pressed={feed} onClick={onFeed}>
          {marked && (
            <span className="mark" aria-hidden="true">
              <Rss size={15} weight={feed ? "fill" : "regular"} />
            </span>
          )}
          <span className="label">Feed</span>
        </button>
      </Hint>
      <button className={`side-item side-main${skill || home || feed ? "" : " on"}${drop === "" ? " drop-on" : ""}`} data-drop-skill="" aria-pressed={!skill && !home && !feed} onClick={() => onOpen(null)}>
        {marked && (
          <span className="mark" aria-hidden="true">
            <Stack size={15} weight={!skill && !home && !feed ? "fill" : "regular"} />
          </span>
        )}
        <span className="label">All sources</span>
      </button>
      <DndContext sensors={sensors} collisionDetection={collide} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
        <SortableContext items={shown.map((g) => groupId(g.collection))} strategy={verticalListSortingStrategy}>
          {shown.map((g) => (
            <Fragment key={g.collection}>
            {naming && !g.collection && namingField}
            <Section
              group={g}
              open={isOpen(g)}
              target={active !== null && !isGroup(active) && groupOf(shown, active) === shown.indexOf(g) && groupOf(groups, active) !== groups.findIndex((x) => x.collection === g.collection)}
              renaming={renaming === g.collection && !!g.collection}
              menu={g === freshGroup ? [] : groupMenu(g)}
              onToggle={() => toggle(g.name)}
              onAdd={() => setAdding(g.name)}
              taken={(name) => isOther(name) || groups.some((x) => x !== g && !!x.collection && x.collection.toLowerCase() === name.toLowerCase())}
              onRename={(name) => rename(g, name)}
              onCancelRename={() => setRenaming(null)}
            >
              <SortableContext items={g.skills.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                {isOpen(g) &&
                  g.skills.map((s) => (
                    <SkillRow key={s.id} s={s} on={skill === s.id} drop={drop === s.id} marked={marked} onOpen={onOpen} menu={menu(s)} />
                  ))}
              </SortableContext>
              {adding === g.name && (
                <NewSkill
                  skills={skills}
                  collection={g.collection}
                  marked={marked}
                  onDone={(s) => {
                    setAdding(null);
                    setFresh(null);
                    if (s) onCreated(s);
                  }}
                />
              )}
            </Section>
            </Fragment>
          ))}
          {naming && !shown.some((g) => !g.collection) && namingField}
        </SortableContext>
        {createPortal(
          <DragOverlay dropAnimation={SETTLE}>
            {lifted && "skills" in lifted ? (
              <div className="side-lifted">
                <div className="side-head">
                  <span className="side-label"><span className="side-label-text">{lifted.name}</span></span>
                </div>
                {isOpen(lifted) &&
                  lifted.skills.map((s) => <SkillFace key={s.id} s={s} marked={marked} />)}
              </div>
            ) : lifted ? (
              <div className="side-item on side-lifted" data-color={lifted.color}>
                <SkillFace s={lifted} marked={marked} />
              </div>
            ) : null}
          </DragOverlay>,
          document.body,
        )}
      </DndContext>
    </nav>
    </WithMenu>
  );
}

/** A sidebar section: a collection, or the skills in none. The whole section drags by its header to
 *  reorder collections; while a skill from elsewhere hovers it, it lights up (Notion). */
function Section({ group, open, target, renaming, menu, onToggle, onAdd, taken, onRename, onCancelRename, children }: {
  group: Group;
  open: boolean;
  target: boolean;
  renaming: boolean;
  menu: MenuAction[];
  onToggle: () => void;
  onAdd: () => void;
  /** Another collection already has this name. */
  taken: (name: string) => boolean;
  onRename: (name: string) => void;
  onCancelRename: () => void;
  children: ReactNode;
}) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: groupId(group.collection),
    disabled: { draggable: !group.collection, droppable: false },
  });
  // The header holds buttons, so it is no control itself: the group with no collection can't be dragged,
  // and dnd-kit's aria-disabled on it would read its New skill and toggle as dimmed.
  const { role: _role, tabIndex: _tab, "aria-disabled": _off, ...drag } = attributes;
  const a11y = group.collection ? drag : {};
  const label = group.collection ? `New skill in ${group.name}` : "New skill";
  return (
    <div
      ref={setNodeRef}
      role="group"
      aria-label={group.name}
      className={`side-section${target ? " drop-on" : ""}${isDragging ? " slot" : ""}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <WithMenu actions={menu}>
        <div className="side-head" ref={setActivatorNodeRef} {...a11y} {...listeners}>
          {renaming ? (
            <RenameField value={group.collection} taken={taken} onSave={onRename} onCancel={onCancelRename} />
          ) : (
            <button className="side-label" aria-expanded={open} onClick={onToggle}>
              <span className="side-label-text">{group.name}</span>
              <CaretRight className="caret" size={10} weight="bold" aria-hidden="true" />
            </button>
          )}
          {!renaming && (
            <span className="side-head-tools" onPointerDown={(e) => e.stopPropagation()}>
              {group.collection && <MoreButton className="side-tool" label={`Actions for ${group.name}`} actions={menu} />}
              <Hint text={label}>
                <button className="side-tool" aria-label={label} onClick={onAdd}>
                  <Plus size={13} weight="bold" aria-hidden="true" />
                </button>
              </Hint>
            </span>
          )}
        </div>
      </WithMenu>
      {children}
    </div>
  );
}

/** A collection's name, edited in place like a Finder folder: Enter saves, Esc or clicking away keeps the old one. */
/** A collection's name field. A name another collection has is refused in place, as Finder refuses
 *  a folder name that is taken: the field stays open and says so (Tyler, 2026-11-07). */
function RenameField({ value, label = "Collection name", placeholder, taken, onSave, onCancel }: { value: string; label?: string; placeholder?: string; taken?: (v: string) => boolean; onSave: (v: string) => void; onCancel: () => void }) {
  const [v, setV] = useState(value);
  const [refused, setRefused] = useState<string | null>(null);
  return (
    <>
    <input
      autoFocus
      className="side-input side-rename"
      aria-label={label}
      placeholder={placeholder}
      value={v}
      autoComplete="off"
      onFocus={(e) => e.currentTarget.select()}
      aria-invalid={refused ? true : undefined}
      onChange={(e) => (setV(e.target.value), setRefused(null))}
      onBlur={onCancel}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          const name = v.trim().replace(/\s+/g, " ");
          if (taken?.(name)) setRefused(name);
          else onSave(v);
        } else if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
    />
    {refused && (
      <span className="side-taken" role="alert">
        “{refused}” is taken
      </span>
    )}
    </>
  );
}

function SkillFace({ s, marked }: { s: Skill; marked: boolean }) {
  return (
    <span className="side-main">
      {marked && (
        <span className="mark" aria-hidden="true">
          <SkillIcon icon={s.icon} color={s.color} dot />
        </span>
      )}
      <span className="label">{s.name}</span>
    </span>
  );
}

/** One skill: a click opens its page; a drag (past 4 px) lifts it, leaving a slot where it will land. */
function SkillRow({ s, on, drop, marked, onOpen, menu }: {
  s: Skill;
  on: boolean;
  drop: boolean;
  marked: boolean;
  onOpen: (id: string) => void;
  menu: MenuAction[];
}) {
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({ id: s.id });
  return (
    <WithMenu actions={menu}>
      <div
        ref={setNodeRef}
        className={`side-item${on ? " on" : ""}${drop ? " drop-on" : ""}${isDragging ? " slot" : ""}`}
        data-drop-skill={s.id}
        data-color={s.color}
        style={{ transform: CSS.Translate.toString(transform), transition }}
      >
        <button className="side-main" aria-pressed={on} {...listeners} onClick={() => onOpen(s.id)}>
          {marked && (
            <span className="mark" aria-hidden="true">
              <SkillIcon icon={s.icon} color={s.color} dot />
            </span>
          )}
          <span className="label">{s.name}</span>
        </button>
        <MoreButton className="side-more" label={`Actions for ${s.name}`} actions={menu} />
      </div>
    </WithMenu>
  );
}

/** Names a new skill in place, like a new page in Notion's sidebar: Enter creates it through
 *  `ore skills add`, Esc or clicking away drops the name (never saved on blur). */
function NewSkill({ skills, collection, marked, onDone }: { skills: Skill[]; collection: string; marked: boolean; onDone: (s: Skill | null) => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (!name.trim() || busy) return;
    // A name he has is refused in place, as a taken collection name is, before the CLI's own refusal.
    const n = name.trim().replace(/\s+/g, " ").toLowerCase();
    const other = skills.find((s) => s.name.toLowerCase() === n);
    if (other) return setError(`“${other.name}” is taken`);
    setBusy(true);
    try {
      onDone(await ore<Skill>("skills", "add", name, opt("collection", collection)));
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <div className="side-new">
      <div className="side-item on">
        <span className="side-main">
          {marked && (
            <span className="mark" aria-hidden="true">
              <SkillIcon dot />
            </span>
          )}
          <input
            autoFocus
            className="side-input"
            aria-label="New skill name"
            placeholder="Skill name"
            value={name}
            readOnly={busy}
            autoComplete="off"
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            onBlur={() => !busy && onDone(null)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void create();
              } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                onDone(null);
              }
            }}
          />
        </span>
      </div>
      <div className={`side-new-foot${error ? " err" : ""}`}>{error ?? "↵ to add · Esc to cancel"}</div>
    </div>
  );
}
