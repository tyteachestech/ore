import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { CaretRight, Plus, Target } from "./icons";
import { Grow } from "./Grow";
import { Hint } from "./Hint";
import { SkillIcon } from "./IconPicker";
import { keepKeysIn } from "./keys";
import { MoreButton, WithMenu, type MenuAction } from "./Menu";
import { Mole } from "./Mole";
import { change } from "./change";
import { ore, opt, PHONE, type CardFull, type Skill, type Try } from "./ore";
import { passageText } from "./text";
import { errorText, useFocusWhileMounted, useLibraryChanges, type Notify } from "./util";

// The apply half of a skill (D322). An idea he marked to try is a stone: it waits, then it is the one
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

/** Where a struck stone's sparks land, in its own cells from its centre. */
const SPARKS = [[-5, -4], [0, -5.5], [5, -4], [6.5, 0.5]] as const;

/** A try's stone. Waiting it is grey; the one in use is green and its dots swell with each use until they touch.
 *  A use that lands while it is on screen strikes it (the moment of the apply half): it jolts and throws sparks. */
export function Stone({ uses = 0, waiting = false, size = 14 }: { uses?: number; waiting?: boolean; size?: number }) {
  const swell = Math.min(uses, MINE_FROM) / MINE_FROM;
  const [hits, setHits] = useState(0);
  const before = useRef(uses);
  useEffect(() => {
    if (uses > before.current) setHits((h) => h + 1);
    before.current = uses;
  }, [uses]);
  return (
    <svg className="stone" data-waiting={waiting || undefined} width={size * 1.25} height={size} viewBox="0 0 10 8" fill="currentColor" aria-hidden="true">
      <g key={hits} className={hits ? "struck" : undefined}>
        {ROCK.flatMap((row, y) => [...row].map((t, x) => (t === "." ? null : <circle key={`${x},${y}`} cx={x + 0.5} cy={y + 0.5} r={DOT[t]! + (0.5 - DOT[t]!) * swell} />)))}
      </g>
      {hits > 0 && SPARKS.map(([dx, dy], i) => <circle key={`${hits}-${i}`} className="spark" cx={5} cy={4} r={0.4} style={{ "--dx": `${dx}px`, "--dy": `${dy}px` } as CSSProperties} />)}
    </svg>
  );
}

/** A try that is his: a tool. */
export const Pick = ({ fresh = false }: { fresh?: boolean }) => <SkillIcon icon="mc:pickax" className={`tool${fresh ? " forged" : ""}`} />;

/** The ids that joined a list while it was on screen (not the ones it opened with): what just became his. */
function useFresh(ids: string[] | null): Set<string> {
  const seen = useRef<Set<string> | null>(null);
  const fresh = useRef(new Set<string>());
  if (ids && !seen.current) seen.current = new Set(ids);
  else if (ids && seen.current) for (const id of ids) if (!seen.current.has(id)) (seen.current.add(id), fresh.current.add(id));
  return fresh.current;
}

/** How far an idea is from being his: a stone for each of the three uses, struck ones green, then the tool. */
function Path({ t, fresh }: { t: Try; fresh: boolean }) {
  const mine = t.status === "done";
  const n = Math.min(usesOf(t), MINE_FROM + 1);
  const says = mine ? "Yours" : usedHint(t);
  return (
    <Hint text={says}>
      <div className="try-path" role="img" aria-label={says}>
        {[0, 1, 2].map((i) => <Stone key={i} size={16} uses={i < n ? MINE_FROM : 0} waiting={i >= n} />)}
        <span className="try-path-rule" />
        <span className="try-path-end" data-reached={mine || undefined}><Pick fresh={fresh} /></span>
      </div>
    </Hint>
  );
}

/** Tries the mole is writing a line for, so their page shows him thinking. */
const thinking = new Set<string>();
const watching = new Set<() => void>();
let thinkingNow: readonly string[] = [];
const think = (id: string, on: boolean) => {
  if (on) thinking.add(id);
  else thinking.delete(id);
  thinkingNow = [...thinking];
  for (const f of watching) f();
};
const useThinking = (id: string) =>
  useSyncExternalStore(
    (f) => (watching.add(f), () => void watching.delete(f)),
    () => thinkingNow,
  ).includes(id);

/** The mole's one line on the use he just wrote up (D324), asked for in the background: it lands on the
 *  try's page when it is ready. The Mac's AI writes it, so the phone asks for none; a line that fails is left out. */
export function askMole(id: string, then?: () => void) {
  if (PHONE || thinking.has(id)) return;
  moleSaid.delete(id); // the last use's line is not this one's
  think(id, true);
  void ore<{ line: { text: string } } | null>("tried", id, "--line")
    .then((r) => r?.line && moleSaid.set(id, r.line.text))
    .catch(() => {})
    .finally(() => (think(id, false), then?.()));
}
/** What he just said back, by try, until the library's own copy is read (the last use's line). */
const moleSaid = new Map<string, string>();

/** Writes a use of a try: how it went, and whether it is his now or stays in the works. With its way back. */
export const useOf = (t: Pick<Try, "id">, text: string, mine: boolean) => ({
  msg: `${mine ? "Yours now" : "Used"}${text ? " · an exercise comes from how it went" : ""}`,
  run: () => ore("tried", t.id, ...(text ? [opt("text", text)] : []), ...(mine ? [] : ["--again"])),
  undo: async () => {
    await ore("tried", t.id, "--undo");
    if (!mine) await ore("tried", t.id, "--undo");
  },
});

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
    let read: Promise<unknown> | undefined;
    // The write stands even if the re-read fails: he can undo it, and a second Enter must not write it twice.
    const ok = await change(notify, { message: msg, kind, write: (on) => (on ? run() : undo()), settled: () => void (read = reload().catch((e) => notify(errorText(e), "error"))) });
    await read;
    return ok;
  };
  const active = ts?.find((t) => t.active);
  return {
    ts,
    pick: (t: Try) => step("Trying this now", () => ore("try", t.id, "--pick"), () => (active && active.id !== t.id ? ore("try", active.id, "--pick") : Promise.resolve())),
    /** He used it: how it went, and whether it is his now or stays in the works. */
    did: async (t: Try, text: string, mine: boolean) => {
      const use = useOf(t, text, mine);
      const ok = await step(use.msg, use.run, use.undo, mine ? "info" : "quiet");
      if (ok && text) askMole(t.id, () => void reload().catch(() => {}));
      return ok;
    },
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
export function Did({ t, onSave, onClose, skip }: { t: Try; onSave: (text: string, mine: boolean) => Promise<boolean>; onClose: () => void; /** The check-in: a way on without answering, with its words ("Not yet"); the use is saved with Save. */ skip?: string }) {
  const [v, setV] = useState(() => drafts.get(t.id) ?? "");
  const field = useRef<HTMLTextAreaElement>(null);
  const home = useRef<HTMLElement | null>(null);
  useEffect(() => void (home.current = field.current?.closest<HTMLElement>("[data-try]") ?? null), []);
  useFocusWhileMounted(field, () => (home.current?.isConnected ? home.current.querySelector<HTMLElement>("button") : null));
  // A save that fails leaves the box open with every word.
  // One save at a time: a second press while the first is out would write the same use twice. Its toast shows at
  // once; the buttons stay enabled so focus stays on the one he pressed if the save fails.
  const saving = useRef(false);
  const save = (mine: boolean) => {
    if (saving.current) return;
    saving.current = true;
    void onSave(v.trim(), mine).then((ok) => (ok ? (drafts.delete(t.id), onClose()) : (saving.current = false)));
  };
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
          <button className="settings-btn" onClick={() => save(false)}>{skip ? "Save" : "Again"}</button>
        </Hint>
        {canMine && (
          <Hint text="You can do this now: it becomes a tool beside your goal">
            <button className="settings-btn" onClick={() => save(true)}>It’s mine</button>
          </Hint>
        )}
        {skip && (
          <Hint text={<>{skip} <kbd>Esc</kbd></>}>
            <button className="settings-btn" onClick={onClose}>{skip}</button>
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
        <p className="quiet">{ts.length ? "Nothing in the works. Pick the next one in the Forge." : "Mark a technique with Try it while you read, or add one in the Forge."}</p>
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
  const fresh = useFresh(tries.ts && mine.map((t) => t.id));
  if (!mine.length) return null;
  return (
    <span className="tools">
      {mine.slice(0, 8).map((t) => (
        <Hint key={t.id} text={`Yours: ${tryLabel(t)}`}>
          <button className="tool-btn" aria-label={`Yours: ${tryLabel(t)}`} onClick={() => onSub(`try:${t.id}`)}><Pick fresh={fresh.has(t.id)} /></button>
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
      {skill.goal && (
        <p className="forge-goal">
          <Target size={15} weight="bold" aria-hidden="true" />
          <span>{skill.goal}</span>
        </p>
      )}
      {tries.ts && !ts.length && !adding && <p className="quiet">Nothing here yet. Mark a technique with Try it while you read, or add one with +.</p>}
      {band("Trying now", now)}
      {band("Waiting", waiting, adding ? <AddTry skill={skill.id} onAdd={(plan, when) => tries.add(plan, when)} onClose={() => setAdding(false)} /> : undefined)}
      {band("Yours", mine)}
    </div>
  );
}

/** A try typed here, with no passage behind it: what he'll do, and when. Enter or Add adds it, Esc closes. */
/** A try being typed and left (Back, Esc, or another screen), by skill: the form opens on it again, as the Add box
 *  keeps his words (D342; Codex UX sweep 5). */
const addDrafts = new Map<string, { plan: string; when: string }>();

function AddTry({ skill, onAdd, onClose }: { skill: string; onAdd: (plan: string, when: string) => Promise<boolean>; onClose: () => void }) {
  const [plan, setPlanState] = useState(() => addDrafts.get(skill)?.plan ?? "");
  const [when, setWhenState] = useState(() => addDrafts.get(skill)?.when ?? "");
  const keep = (p: string, w: string) => (p.trim() || w.trim() ? addDrafts.set(skill, { plan: p, when: w }) : addDrafts.delete(skill));
  const setPlan = (p: string) => (setPlanState(p), keep(p, when));
  const setWhen = (w: string) => (setWhenState(w), keep(plan, w));
  const first = useRef<HTMLTextAreaElement>(null);
  useFocusWhileMounted(first, () => document.querySelector<HTMLElement>(".forge-head .icon-btn"));
  // One add at a time: a double-click or a second Enter while it is out would make the try twice.
  const adding = useRef(false);
  const add = () => {
    if (!plan.trim() || adding.current) return;
    adding.current = true;
    // Out of the drafts while it is being added, so a + opened meanwhile can't add it twice; back if it fails.
    const draft = addDrafts.get(skill);
    addDrafts.delete(skill);
    void onAdd(plan.trim(), when.trim()).then((ok) => (ok ? onClose() : ((adding.current = false), draft && addDrafts.set(skill, draft))));
  };
  const keys = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    keepKeysIn(e);
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      add();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };
  return (
    <div className="forge-add">
      <Grow ref={first} className="field" aria-label="I’ll…" placeholder="I’ll…" value={plan} onChange={(e) => setPlan(e.target.value)} onKeyDown={keys} />
      <Grow className="field" aria-label="When…" placeholder="when…" value={when} onChange={(e) => setWhen(e.target.value)} onKeyDown={keys} />
      {/* The pointer's way to add it, as the Add box's ↵ Add is (F306). */}
      <Hint text={<>Add <kbd>↵</kbd></>}>
        <button className="settings-btn" disabled={!plan.trim()} onClick={add}>Add</button>
      </Hint>
    </div>
  );
}

/** One line of the plan, edited in place: Enter or a click away saves, Esc puts back what was there (D211). */
/** A plan line whose save failed, by try and line: it opens on his words again (Codex UX sweep 5: Back dropped them). */
const planDrafts = new Map<string, { from: string; to: string }>();

function PlanField({ label, hint, value, draftKey, onSave }: { label: string; hint: string; value: string; draftKey: string; onSave: (v: string) => Promise<boolean> }) {
  const [v, setV] = useState(() => planDrafts.get(draftKey)?.to ?? value);
  // A change from elsewhere (the phone, ⌘Z, a re-read) since the failed save wins: the kept words go.
  useEffect(() => {
    const d = planDrafts.get(draftKey);
    if (d && d.from === value) return setV(d.to);
    planDrafts.delete(draftKey);
    setV(value);
  }, [value, draftKey]);
  const save = () => {
    const to = v.trim();
    if (to === value) return;
    planDrafts.set(draftKey, { from: value, to });
    void onSave(to).then((ok) => ok && planDrafts.delete(draftKey));
  };
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
            e.currentTarget.blur(); // the blur saves, once
          } else if (e.key === "Escape") {
            e.preventDefault();
            planDrafts.delete(draftKey);
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
  // It became his while this page was open: the tool lands with a pop.
  const was = useRef(mine);
  const forged = mine && !was.current;
  useEffect(() => void (mine || (was.current = false)), [mine]);
  const actions: MenuAction[] = [
    ...(mine ? [{ id: "reopen", label: "Try it again", run: () => void tries.reopen(t) }] : t.active ? [] : [{ id: "pick", label: "Try this now", run: () => void tries.pick(t) }]),
    ...(t.point ? [] : [{ id: "passage", label: "Open passage", run: () => onPassage(t) }]),
    { id: "delete", label: "Remove", danger: true, divider: true, run: () => void tries.remove(t).then((ok) => ok && onSub("forge")) },
  ];
  const rounds = [...(t.uses ?? []), ...(mine ? [{ ts: t.done_at ?? t.ts, plan: t.note, reflection: t.reflection, when: t.when, line: t.line }] : [])];
  const moleThinks = useThinking(t.id);
  const lineOf = (u: (typeof rounds)[number], i: number) => u.line?.text ?? (i === rounds.length - 1 && u.reflection && !moleThinks ? moleSaid.get(t.id) : undefined);
  // He nods as a line lands while this page is open; the ones already there stand still.
  const thought = useRef(false);
  thought.current ||= moleThinks;
  const moleSpoke = thought.current && !moleThinks;
  // After a use he keeps going with, the keys land in When with its words selected: the next use somewhere new
  // makes it stick wider (varied practice), and typing nothing keeps the cue as it was.
  const main = useRef<HTMLDivElement>(null);
  const used = useRef(rounds.length);
  useEffect(() => {
    const when = rounds.length > used.current && !mine && !PHONE ? main.current?.querySelector<HTMLTextAreaElement>(".plan-line textarea") : null;
    when?.focus();
    when?.select();
    used.current = rounds.length;
  }, [rounds.length, mine]);
  // The exercise review brings back from how it went (D127.3), once it is drafted.
  const [card, setCard] = useState<CardFull | null>(null);
  const said = rounds.some((u) => u.reflection);
  useEffect(() => {
    let live = true;
    if (!said) return void setCard(null);
    ore<CardFull[]>("cards", opt("item", t.item)).then(
      (cs) => live && setCard(cs.find((c) => c.state !== "retired" && (c.annotation === t.id || c.also?.includes(t.id))) ?? null),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [t.item, t.id, said, t.rev]);
  return (
    <div className="forge try-page" data-color={skill.color} data-try={t.id}>
      <div className="forge-head">
        <Crumbs skill={skill} here={mine ? "Yours" : t.active ? "Trying now" : "Waiting"} onSub={onSub} />
        <MoreButton label="Try actions" actions={actions} />
      </div>
      <div className="try-cols">
        <div className="try-main" ref={main}>
          <h1 className="try-title">{tryLabel(t)}</h1>
          <Path t={t} fresh={forged} />
          <div className="plan">
            <PlanField label="When" hint="the moment that cues it" value={t.when ?? ""} draftKey={`${t.id} when`} onSave={(when) => tries.plan(t, { when })} />
            <PlanField label="I’ll" hint="what you’ll do then" value={t.note ?? ""} draftKey={`${t.id} plan`} onSave={(plan) => tries.plan(t, { plan })} />
            <PlanField label="If" hint="what might get in the way, then what you’ll do" value={t.obstacle ?? ""} draftKey={`${t.id} if`} onSave={(obstacle) => tries.plan(t, { obstacle })} />
          </div>
          {rounds.length > 0 && (
            <section className="forge-band" aria-label="Uses">
              <h2>Uses</h2>
              {rounds.map((u, i) => (
                <div key={i} className="try-use">
                  <p className="try-round">
                    <span>{u.reflection || "Used it"}</span>
                    <small>{u.when ? `${u.when} · ` : ""}{day(u.ts)}</small>
                  </p>
                  {lineOf(u, i) ? (
                    <p className="try-mole">
                      <Mole bare size={24} mood={moleSpoke && i === rounds.length - 1 ? "nod" : "idle"} />
                      <span>{lineOf(u, i)}</span>
                    </p>
                  ) : (
                    moleThinks && i === rounds.length - 1 && (
                      <p className="try-mole" role="status" aria-label="The mole is thinking">
                        <Mole bare size={24} mood="thinking" />
                      </p>
                    )
                  )}
                </div>
              ))}
            </section>
          )}
          {card && (
            <section className="forge-band" aria-label="Exercise">
              <h2>Exercise</h2>
              <Hint text={card.state === "draft" ? "Drafted from how it went: review brings it in as new" : "From how it went: review brings it back"}>
                <p className="try-round try-card" tabIndex={0}>
                  <span>{card.question}</span>
                </p>
              </Hint>
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
