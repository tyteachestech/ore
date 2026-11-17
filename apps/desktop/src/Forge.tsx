import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { CaretRight, Plus } from "./icons";
import { Grow } from "./Grow";
import { Hint } from "./Hint";
import { SkillIcon } from "./IconPicker";
import { keepKeysIn } from "./keys";
import { MoreButton, WithMenu, type MenuAction } from "./Menu";
import { ore, opt, type Skill, type Try } from "./ore";
import { passageText } from "./text";
import { errorText, useFocusWhileMounted, useLibraryChanges, type Notify } from "./util";

// The apply half of a skill (D-new-forge). An idea he marked to try is a stone: it waits, then it is the one
// he is trying now, and each use swells its dots; once it is his it is a tool, a pickaxe beside the skill's
// goal. One try at a time per skill, picked by him; nothing is dated, counted or owed (D23).

/** Where the skill page is: itself, its Forge, or one try's page. */
export type Sub = null | "forge" | `try:${string}`;

/** A try in a line: what he'll do, else the passage he marked. */
export const tryLabel = (t: Try): string => t.note || passageText(t.exact);
/** Times he has used it: the rounds he closed, and the last one once it is his. */
export const usesOf = (t: Try): number => (t.uses?.length ?? 0) + (t.status === "done" ? 1 : 0);
/** Uses before "It's mine" is offered: this one would be the third. */
const MINE_FROM = 2;

/** The rock an idea is until it is his, drawn in the gem's loose dots (Gem.tsx, 10×8). */
const ROCK = ["..........", "...HHH....", "..HWHHM...", ".HHHHMMMD.", "HHHMMMMDD.", ".MMMMMDDD.", "..MMDDDD..", "....DD...."];
const DOT: Record<string, number> = { W: 0.5, H: 0.44, M: 0.36, D: 0.25 };

/** A try's stone. Waiting it is grey; the one in use is green and its dots swell with each use until they touch. */
export function Stone({ uses = 0, waiting = false, size = 14 }: { uses?: number; waiting?: boolean; size?: number }) {
  const swell = Math.min(uses, MINE_FROM) / MINE_FROM;
  return (
    <svg className="stone" data-waiting={waiting || undefined} width={size * 1.25} height={size} viewBox="0 0 10 8" fill="currentColor" aria-hidden="true">
      {ROCK.flatMap((row, y) => [...row].map((t, x) => (t === "." ? null : <circle key={`${x},${y}`} cx={x + 0.5} cy={y + 0.5} r={DOT[t]! + (0.5 - DOT[t]!) * swell} />)))}
    </svg>
  );
}

/** A try that is his: a tool. */
export const Pick = () => <SkillIcon icon="mc:pickax" className="tool" />;

const flags = (p: { plan?: string; when?: string; obstacle?: string }) => [...(p.plan !== undefined ? [opt("plan", p.plan)] : []), ...(p.when !== undefined ? [opt("when", p.when)] : []), ...(p.obstacle !== undefined ? [opt("if", p.obstacle)] : [])];

/** A skill's tries, read again when the library changes, and every change to one: written, read back, and on
 *  the history with its way back (⌘Z). */
export function useTries(skill: string, notify: Notify) {
  const [ts, setTs] = useState<Try[] | null>(null);
  const changes = useLibraryChanges();
  const reload = useCallback(() => ore<Try[]>("tries", opt("skill", skill)).then(setTs), [skill]);
  useEffect(() => {
    let live = true;
    ore<Try[]>("tries", opt("skill", skill)).then(
      (r) => live && setTs(r),
      (e) => live && notify(errorText(e), "error"),
    );
    return () => {
      live = false;
    };
  }, [skill, notify, changes]);

  const step = async (msg: string, run: () => Promise<unknown>, undo: () => Promise<unknown>, kind: "quiet" | "info" = "quiet") => {
    try {
      await run();
      await reload();
    } catch (e) {
      notify(errorText(e), "error");
      return false;
    }
    notify(msg, kind, () => undo().then(reload), () => run().then(reload));
    return true;
  };
  const active = ts?.find((t) => t.active);
  return {
    ts,
    pick: (t: Try) => step("Trying this now", () => ore("try", t.id, "--pick"), () => (active && active.id !== t.id ? ore("try", active.id, "--pick") : Promise.resolve())),
    /** He used it: how it went, and whether it is his now or stays in the works. */
    did: (t: Try, text: string, mine: boolean) =>
      mine
        ? step(`Yours now${text ? " · an exercise comes from how it went" : ""}`, () => ore("tried", t.id, ...(text ? [opt("text", text)] : [])), () => ore("tried", t.id, "--undo"), "info")
        : step(`Used${text ? " · an exercise comes from how it went" : ""}`, () => ore("tried", t.id, ...(text ? [opt("text", text)] : []), "--again"), async () => {
            await ore("tried", t.id, "--undo");
            await ore("tried", t.id, "--undo");
          }),
    plan: (t: Try, p: { plan?: string; when?: string; obstacle?: string }) =>
      step("Plan saved", () => ore("try", t.id, ...flags(p)), () => ore("try", t.id, ...flags({ ...(p.plan !== undefined ? { plan: t.note ?? "" } : {}), ...(p.when !== undefined ? { when: t.when ?? "" } : {}), ...(p.obstacle !== undefined ? { obstacle: t.obstacle ?? "" } : {}) }))),
    /** A tool goes back to being tried. */
    reopen: (t: Try) => step("Back in the Forge", () => ore("tried", t.id, "--undo"), () => ore("tried", t.id, ...(t.reflection ? [opt("text", t.reflection)] : []))),
    remove: (t: Try) => step("Removed", () => ore("annotate", t.id, "--status", "deleted"), () => ore("annotate", t.id, "--status", t.status), "info"),
    add: async (plan: string, when: string) => {
      let id = "";
      return step(
        "Added to the Forge",
        async () => {
          if (id) return ore("annotate", id, "--status", "open");
          id = (await ore<Try>("try", opt("skill", skill), opt("plan", plan), ...(when ? [opt("when", when)] : []))).id;
        },
        () => ore("annotate", id, "--status", "deleted"),
      );
    },
  };
}
export type Tries = ReturnType<typeof useTries>;

/** Unsent "How did it go?" boxes, per try, kept when the box closes. */
const drafts = new Map<string, string>();

/** "How did it go?" after a use (Linear's inline edit): Enter keeps it in the works, and from the third use
 *  "It's mine" makes it a tool. Esc closes and keeps the draft. */
function Did({ t, onSave, onClose }: { t: Try; onSave: (text: string, mine: boolean) => Promise<boolean>; onClose: () => void }) {
  const [v, setV] = useState(() => drafts.get(t.id) ?? "");
  const field = useRef<HTMLTextAreaElement>(null);
  const home = useRef<HTMLElement | null>(null);
  useEffect(() => void (home.current = field.current?.closest<HTMLElement>("[data-try]") ?? null), []);
  useFocusWhileMounted(field, () => (home.current?.isConnected ? home.current.querySelector<HTMLElement>("button") : null));
  // A save that fails leaves the box open with every word.
  const save = (mine: boolean) => void onSave(v.trim(), mine).then((ok) => ok && (drafts.delete(t.id), onClose()));
  const canMine = usesOf(t) >= MINE_FROM;
  return (
    <div className="try-did">
      <Grow
        ref={field}
        className="field"
        aria-label="How did it go?"
        placeholder="How did it go?"
        value={v}
        onChange={(e) => {
          setV(e.target.value);
          drafts.set(t.id, e.target.value);
        }}
        onKeyDown={(e) => {
          keepKeysIn(e); // ⌘Z still reaches the app history
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            save(false);
          } else if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
      />
      <div className="try-did-actions">
        <Hint text="Keep using it: it stays the one you’re trying">
          <button className="settings-btn" onClick={() => save(false)}>Again</button>
        </Hint>
        {canMine && (
          <Hint text="You can do this now: it becomes a tool beside your goal">
            <button className="settings-btn" onClick={() => save(true)}>It’s mine</button>
          </Hint>
        )}
      </div>
    </div>
  );
}

const usedHint = (t: Try) => (usesOf(t) ? `Used ${usesOf(t)} of ${MINE_FROM + 1}` : "Not used yet");

/** The skill page's own piece of it: the one try he is on, in one line, the waiting ones as stones, and the door to the Forge. */
export function TryingNow({ tries, onSub, head }: { tries: Tries; onSub: (s: Sub) => void; head: (action: ReactNode, actions: MenuAction[], body: ReactNode) => ReactNode }) {
  const [did, setDid] = useState(false);
  const ts = tries.ts ?? [];
  const now = ts.find((t) => t.active);
  const waiting = ts.filter((t) => t.status === "open" && !t.active);
  const door = (
    <Hint text="Everything you marked to try, and your tools">
      <button className="forge-door" onClick={() => onSub("forge")}>
        Forge <CaretRight size={10} weight="bold" aria-hidden="true" />
      </button>
    </Hint>
  );
  return head(
    door,
    [{ id: "forge", label: "Open the Forge", run: () => onSub("forge") }],
    <>
      {now ? (
        <div className="try-now" data-try={now.id}>
          <Hint text="I did it">
            <button className="try-check" role="checkbox" aria-checked={false} aria-label="I did it" onClick={() => setDid(true)} />
          </Hint>
          <Hint text="Open its plan">
            <button className="try-line" data-find="" onClick={() => onSub(`try:${now.id}`)}>
              <span className="try-do">{tryLabel(now)}</span>
              {now.when && <span className="try-when">{now.when}</span>}
            </button>
          </Hint>
          <Hint text={usedHint(now)}>
            <span className="try-stone" role="img" aria-label={usedHint(now)}><Stone uses={usesOf(now)} /></span>
          </Hint>
          {did && <Did t={now} onClose={() => setDid(false)} onSave={(text, mine) => tries.did(now, text, mine)} />}
        </div>
      ) : (
        <p className="quiet">{ts.length ? "Nothing in the works. Pick the next one in the Forge." : "Mark a technique with Try it (4) while you read, or add one in the Forge."}</p>
      )}
      {waiting.length > 0 && (
        <div className="try-stones">
          {waiting.slice(0, 8).map((t) => (
            <Hint key={t.id} text={`Waiting: ${tryLabel(t)}`}>
              <button className="try-stone" aria-label={`Waiting: ${tryLabel(t)}`} onClick={() => onSub(`try:${t.id}`)}><Stone waiting /></button>
            </Hint>
          ))}
        </div>
      )}
    </>,
  );
}

/** His tools, beside the skill's goal: the ideas he made his. */
export function Tools({ tries, onSub }: { tries: Tries; onSub: (s: Sub) => void }) {
  const mine = (tries.ts ?? []).filter((t) => t.status === "done");
  if (!mine.length) return null;
  return (
    <span className="tools">
      {mine.slice(0, 8).map((t) => (
        <Hint key={t.id} text={`Yours: ${tryLabel(t)}`}>
          <button className="tool-btn" aria-label={`Yours: ${tryLabel(t)}`} onClick={() => onSub(`try:${t.id}`)}><Pick /></button>
        </Hint>
      ))}
    </span>
  );
}

/** The way back up: the skill, then the Forge on a try's page. */
function Crumbs({ skill, here, onSub }: { skill: Skill; here: string; onSub: (s: Sub) => void }) {
  return (
    <nav className="crumbs" aria-label="Where you are">
      <button onClick={() => onSub(null)}>{skill.name}</button>
      <CaretRight size={10} weight="bold" aria-hidden="true" />
      {here === "Forge" ? <span aria-current="page">Forge</span> : (
        <>
          <button onClick={() => onSub("forge")}>Forge</button>
          <CaretRight size={10} weight="bold" aria-hidden="true" />
          <span aria-current="page">{here}</span>
        </>
      )}
    </nav>
  );
}

/** ↑ ↓ move between the Forge's rows, as in any list here; Enter or a click opens one. */
function moveRow(e: ReactKeyboardEvent<HTMLElement>) {
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  const rows = [...(e.currentTarget.closest(".forge")?.querySelectorAll<HTMLElement>(".forge-open") ?? [])];
  const to = rows[rows.indexOf(e.currentTarget as HTMLElement) + (e.key === "ArrowDown" ? 1 : -1)];
  if (!to) return;
  e.preventDefault();
  to.focus();
}

/** The Forge: every idea of a skill he marked to try. The one he is trying now, the ones waiting (he picks
 *  which is next), and the ones that are his. */
export function Forge({ skill, tries, onSub }: { skill: Skill; tries: Tries; onSub: (s: Sub) => void }) {
  const [adding, setAdding] = useState(false);
  const ts = tries.ts ?? [];
  const now = ts.filter((t) => t.active);
  const waiting = ts.filter((t) => t.status === "open" && !t.active);
  const mine = ts.filter((t) => t.status === "done");
  const row = (t: Try) => {
    const open = () => onSub(`try:${t.id}`);
    const actions: MenuAction[] = [
      { id: "open", label: "Open", run: open },
      ...(t.status === "done" ? [{ id: "reopen", label: "Try it again", run: () => void tries.reopen(t) }] : t.active ? [] : [{ id: "pick", label: "Try this now", run: () => void tries.pick(t) }]),
      { id: "delete", label: "Remove", danger: true, divider: true, run: () => void tries.remove(t) },
    ];
    return (
      <WithMenu key={t.id} actions={actions} hold>
        <div className="forge-row" data-state={t.status === "done" ? "mine" : t.active ? "now" : "waiting"}>
          <button className="forge-open" data-find="" onClick={open} onKeyDown={moveRow}>
            {t.status === "done" ? <Pick /> : <Stone uses={usesOf(t)} waiting={!t.active} />}
            <span className="try-do">{tryLabel(t)}</span>
            {t.when && <span className="try-when">{t.when}</span>}
          </button>
          {t.status === "open" && !t.active && <button className="settings-btn forge-pick" onClick={() => void tries.pick(t)}>Try this now</button>}
          <MoreButton label="Try actions" actions={actions} />
        </div>
      </WithMenu>
    );
  };
  const band = (title: string, list: Try[], extra?: ReactNode) =>
    (list.length > 0 || extra) && (
      <section className="forge-band" aria-label={title}>
        <h2>{title}</h2>
        {extra}
        {list.map(row)}
      </section>
    );
  return (
    <div className="forge" data-color={skill.color}>
      <div className="forge-head">
        <Crumbs skill={skill} here="Forge" onSub={onSub} />
        <Hint text="Add something to try">
          <button className="icon-btn" aria-label="Add something to try" onClick={() => setAdding(true)}>
            <Plus size={14} weight="bold" aria-hidden="true" />
          </button>
        </Hint>
      </div>
      {tries.ts && !ts.length && !adding && <p className="quiet">Nothing here yet. Mark a technique with Try it (4) while you read, or add one with +.</p>}
      {band("Trying now", now)}
      {band("Waiting", waiting, adding ? <AddTry onAdd={(plan, when) => tries.add(plan, when)} onClose={() => setAdding(false)} /> : undefined)}
      {band("Yours", mine)}
    </div>
  );
}

/** A try typed here, with no passage behind it: what he'll do, and when. Enter adds it, Esc closes. */
function AddTry({ onAdd, onClose }: { onAdd: (plan: string, when: string) => Promise<boolean>; onClose: () => void }) {
  const [plan, setPlan] = useState("");
  const [when, setWhen] = useState("");
  const first = useRef<HTMLTextAreaElement>(null);
  useFocusWhileMounted(first, () => document.querySelector<HTMLElement>(".forge-head .icon-btn"));
  const keys = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    keepKeysIn(e);
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!plan.trim()) return;
      void onAdd(plan.trim(), when.trim()).then((ok) => ok && onClose());
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };
  return (
    <div className="forge-add">
      <Grow ref={first} className="field" aria-label="I’ll…" placeholder="I’ll…" value={plan} onChange={(e) => setPlan(e.target.value)} onKeyDown={keys} />
      <Grow className="field" aria-label="When…" placeholder="when…" value={when} onChange={(e) => setWhen(e.target.value)} onKeyDown={keys} />
    </div>
  );
}

/** One line of the plan, edited in place: Enter or a click away saves, Esc puts back what was there (D211). */
function PlanField({ label, hint, value, onSave }: { label: string; hint: string; value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const save = () => v.trim() !== value && onSave(v.trim());
  return (
    <label className="plan-line">
      <span>{label}</span>
      <Grow
        className="field"
        placeholder={hint}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => document.hasFocus() && save()}
        onKeyDown={(e) => {
          keepKeysIn(e);
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            save();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setV(value);
          }
        }}
      />
    </label>
  );
}

const day = (ts: string) => new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** One try's page: its plan (when, what, and what might get in the way), where it came from, and each time he used it. */
export function TryPage({ skill, t, tries, onSub, onPassage }: { skill: Skill; t: Try; tries: Tries; onSub: (s: Sub) => void; onPassage: (t: Pick<Try, "item" | "id">) => void }) {
  const [did, setDid] = useState(false);
  const mine = t.status === "done";
  const actions: MenuAction[] = [
    ...(mine ? [{ id: "reopen", label: "Try it again", run: () => void tries.reopen(t) }] : t.active ? [] : [{ id: "pick", label: "Try this now", run: () => void tries.pick(t) }]),
    ...(t.point ? [] : [{ id: "passage", label: "Open passage", run: () => onPassage(t) }]),
    { id: "delete", label: "Remove", danger: true, divider: true, run: () => void tries.remove(t).then((ok) => ok && onSub("forge")) },
  ];
  const rounds = [...(t.uses ?? []), ...(mine ? [{ ts: t.ts, plan: t.note, reflection: t.reflection }] : [])];
  return (
    <div className="forge try-page" data-color={skill.color} data-try={t.id}>
      <div className="forge-head">
        <Crumbs skill={skill} here={mine ? "Yours" : t.active ? "Trying now" : "Waiting"} onSub={onSub} />
        <MoreButton label="Try actions" actions={actions} />
      </div>
      <div className="try-cols">
        <div className="try-main">
          <h1 className="try-title">
            <Hint text={mine ? "Yours" : usedHint(t)}>
              <span role="img" aria-label={mine ? "Yours" : usedHint(t)}>{mine ? <Pick /> : <Stone uses={usesOf(t)} waiting={!t.active} size={20} />}</span>
            </Hint>
            {tryLabel(t)}
          </h1>
          <div className="plan">
            <PlanField label="When" hint="the moment that cues it" value={t.when ?? ""} onSave={(when) => void tries.plan(t, { when })} />
            <PlanField label="I’ll" hint="what you’ll do then" value={t.note ?? ""} onSave={(plan) => void tries.plan(t, { plan })} />
            <PlanField label="If" hint="what might get in the way, then what you’ll do" value={t.obstacle ?? ""} onSave={(obstacle) => void tries.plan(t, { obstacle })} />
          </div>
          {rounds.length > 0 && (
            <section className="forge-band" aria-label="Uses">
              <h2>Uses</h2>
              {rounds.map((u, i) => (
                <p key={i} className="try-round">
                  <span>{u.reflection || "Used it"}</span>
                  <small>{day(u.ts)}</small>
                </p>
              ))}
            </section>
          )}
          {!mine &&
            (did ? (
              <Did t={t} onClose={() => setDid(false)} onSave={(text, isMine) => tries.did(t, text, isMine)} />
            ) : t.active ? (
              <button className="pill-btn small try-go" onClick={() => setDid(true)}>I did it</button>
            ) : (
              <button className="pill-btn small try-go" onClick={() => void tries.pick(t)}>Try this now</button>
            ))}
        </div>
        {!t.point && (
          <section className="forge-band try-from" aria-label="From">
            <h2>From</h2>
            <Hint text="Open this passage">
              <button className="try-passage" data-find="" onClick={() => onPassage(t)}>
                <span className="exact">“{passageText(t.exact)}”</span>
                <small>{t.item_title}{t.section && t.section !== t.item_title ? ` › ${t.section}` : ""}</small>
              </button>
            </Hint>
          </section>
        )}
      </div>
    </div>
  );
}
