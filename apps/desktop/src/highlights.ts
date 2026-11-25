import { opt, whileOut, type Annotation, type Intent } from "./ore";
import { errorText, inOrder, wakeOnLanding, type Notify } from "./util";

/** A source's highlights read again from the library (a wake after a write elsewhere), merged with what is on
 *  screen: the library's list, but for what he did here that it doesn't know yet.
 *  - A highlight still being made (a `pending-` stand-in) stays; `saved` maps a stand-in whose save has landed to
 *    its id, so it isn't listed twice.
 *  - A highlight with a write of his in flight (`busy`) is as he has it: his copy wins over the library's older
 *    one, one he removed stays gone, one he brought back with ⌘Z stays.
 *  - A highlight whose save landed after this read was asked for (`recent`) is as he has it: the read is older
 *    than the highlight, so it doesn't have it, or has the passage it held before it grew. */
export function mergeAnns(server: Annotation[], local: Annotation[], busy: ReadonlySet<string>, saved: ReadonlyMap<string, string> = new Map(), recent: ReadonlySet<string> = new Set()): Annotation[] {
  const mine = new Map(local.map((a) => [a.id, a]));
  const his = (id: string) => busy.has(id) || recent.has(id);
  const out = server.flatMap((a) => (!his(a.id) ? [a] : mine.has(a.id) ? [mine.get(a.id)!] : busy.has(a.id) ? [] : [a]));
  const have = new Set(server.map((a) => a.id));
  for (const a of local) if (a.id.startsWith("pending-") ? !have.has(saved.get(a.id) ?? "") : !have.has(a.id) && his(a.id)) out.push(a);
  return out;
}

export type Highlights = ReturnType<typeof highlights>;

/** One source's highlights as the Reader holds them: the list on screen, which of them are still being written,
 *  and every change he makes to one (made, typed, noted, removed, brought back), each shown at once, on the history
 *  before its write, written in his order and put back if the write fails. A new highlight shows under a stand-in
 *  id (`pending-…`) and takes the library's id when its save lands, so until the page has drawn that swap either
 *  id may name it: every lookup here answers to both. The Reader keeps only what is the page's (where each
 *  highlight sits, its popup), and is told when one leaves or returns (`page`). */
export function highlights(io: {
  /** An `ore` command. */
  run: <T>(...args: string[]) => Promise<T>;
  /** The list changed: draw it. */
  show: (list: Annotation[]) => void;
  /** A write to a highlight has settled, saved or not. */
  landed: () => void;
  notify: Notify;
  /** A type's name, for the history ("Changed to Key point"). */
  label: (intent: Intent) => string;
  /** Where highlight `id` sits on the page, the Reader's: `off` as it leaves the list (its place is kept aside and
   *  its popup closes), `on` as it comes back. */
  page: (id: string) => { off: () => void; on: () => void };
  /** A note he typed whose save failed, kept for the next time its highlight opens. */
  unsaved: { set: (id: string, v: { note: string; was: string }) => void; delete: (id: string) => void };
}) {
  let list: Annotation[] = [];
  /** A stand-in → the save that will give its id. */
  const making = new Map<string, Promise<Annotation>>();
  /** A stand-in → the id its save came back with, from the moment it lands. */
  const saved = new Map<string, string>();
  /** Highlights with a write of his still saving: a read again keeps his copy of them. */
  const busy = new Map<string, number>();
  /** His changes still saving, from his action (a type or note waits for its highlight's save first). */
  const writing = new Set<Promise<unknown>>();
  /** Each new highlight's step on the history, to take off when he drops a fresh one before it counts. */
  const steps = new Map<string, () => void>();
  /** Saves of new highlights that have landed, counted, and each one's number: a read of the library asked for
   *  before a save landed is older than that highlight. */
  let landings = 0;
  const landedAt = new Map<string, number>();

  const idOf = (id: string) => saved.get(id) ?? id;
  const same = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && idOf(a) === idOf(b);
  const find = (id: string | null | undefined) => (id ? list.find((a) => same(a.id, id)) : undefined);
  const set = (next: Annotation[] | ((list: Annotation[]) => Annotation[])) => {
    list = typeof next === "function" ? next(list) : next;
    io.show(list);
  };
  const realId = async (id: string) => {
    const wait = making.get(id);
    return wait ? (await wait).id : id;
  };
  const track = <T,>(p: Promise<T>) => {
    const settled = p.then(() => {}, () => {});
    writing.add(settled);
    void settled.then(() => writing.delete(settled));
    return p;
  };
  /** `ore annotate`, one write at a time per highlight: quick changes and their ⌘Z land in the order he made
   *  them, never an older one last. A screen opened while it saves (he closes the popup and goes to the skill page
   *  at once) has read the library without it: once it lands, those screens read again (`wake`, taken at his
   *  action, before any wait). */
  const annotateWaking = <T = unknown,>(wake: (write: Promise<unknown>) => void, id: string, ...args: string[]) => {
    busy.set(id, (busy.get(id) ?? 0) + 1);
    const write = inOrder(`annotate ${id}`, () => io.run<T>("annotate", id, ...args));
    const landed = () => {
      const n = (busy.get(id) ?? 1) - 1;
      if (n) busy.set(id, n);
      else busy.delete(id);
      io.landed();
    };
    write.then(landed, landed);
    wake(write);
    return write;
  };
  const annotate = <T = unknown,>(id: string, ...args: string[]) => annotateWaking<T>(wakeOnLanding(), id, ...args);

  /** Takes a saved highlight away and brings it back, as one step of the history (⌘Z, ⇧⌘Z); what comes back is the
   *  highlight as it was when it went, its type and note included. */
  function step(rid: string, seed?: Annotation) {
    let ann: Annotation | undefined = seed;
    const page = io.page(rid);
    const drop = () => {
      ann = list.find((a) => a.id === rid) ?? ann;
      page.off();
      set((l) => l.filter((a) => a.id !== rid));
    };
    const restore = () => {
      page.on();
      if (ann) set((l) => (l.some((a) => a.id === rid) ? l : [...l, ann!]));
    };
    // Brought back whole, type and note too: a note changed while it was gone (an older step of the history
    // run meanwhile) comes back as it was when it went.
    const whole = () => (ann ? ["--status", ann.status, "--intent", ann.intent, opt("note", ann.note ?? "")] : ["--status", "open"]);
    return {
      drop,
      restore,
      // Both return the write: one that fails rolls back here, and the history says why (history.ts).
      remove: () => {
        drop();
        return annotate(rid, "--status", "deleted").catch((e) => {
          restore();
          throw e;
        });
      },
      bring: () => {
        restore();
        return annotate(rid, ...whole()).catch((e) => {
          drop();
          throw e;
        });
      },
    };
  }

  function setIntent(id: string, intent: Intent, undoable = true, taken?: (back: () => void) => void): Promise<void> {
    return track((async () => {
      const wake = wakeOnLanding();
      const was = find(id)?.intent;
      set((l) => l.map((a) => (same(a.id, id) ? { ...a, intent } : a)));
      const rid = realId(id);
      // On the history at once, so a ⌘Z right after the click takes this change back, not the step before it.
      const to = (i: Intent) => () => rid.then((r) => setIntent(r, i, false));
      const forget = undoable && was && was !== intent ? io.notify(`Changed to ${io.label(intent)}`, "quiet", to(was), to(intent)) : undefined;
      if (undoable) taken?.(() => {
        forget?.();
        if (was && was !== intent) void to(was)();
      });
      try {
        await annotateWaking(wake, await rid, "--intent", intent);
      } catch (e) {
        forget?.();
        set((l) => l.map((a) => (same(a.id, id) && was ? { ...a, intent: was } : a)));
        // From the history (undo or redo): it puts the step back and says why.
        if (!undoable) throw e;
        io.notify(errorText(e), "error");
      }
    })());
  }

  function setNote(id: string, note: string, undoable = true): Promise<void> {
    return track((async () => {
      const wake = wakeOnLanding();
      const was = find(id)?.note ?? "";
      set((l) => l.map((a) => (same(a.id, id) ? { ...a, note } : a)));
      let rid = id;
      try {
        // Its step goes on the history once it has landed, so ⌘Z waits for it (`whileOut`): counted from the
        // highlight's own save (realId waits for it) to the note's.
        await whileOut((async () => {
          rid = await realId(id);
          await annotateWaking(wake, rid, opt("note", note));
        })());
        io.unsaved.delete(rid);
        if (undoable) io.notify(note ? "Highlight note saved" : "Removed the highlight note", "quiet", () => setNote(rid, was, false), () => setNote(rid, note, false));
      } catch (e) {
        set((l) => l.map((a) => (same(a.id, id) ? { ...a, note: was } : a)));
        // From the history (undo or redo): it puts the step back and says why.
        if (!undoable) throw e;
        io.unsaved.set(rid, { note, was });
        io.notify(`${errorText(e)} Your note is kept: open the highlight to save it again.`, "error");
      }
    })());
  }

  return {
    /** The highlights on screen. */
    list: () => list,
    set,
    /** A highlight's id as the library knows it: a stand-in whose save has landed is its saved id. */
    idOf,
    /** Whether two ids name one highlight. */
    same,
    /** The highlight on screen under either of its ids. */
    find,
    /** The library's id for a highlight, once its save has landed; rejects when the save failed. */
    realId,
    /** Once every change of his has been written, the ones started meanwhile too. */
    async allSaved() {
      while (writing.size) await Promise.all([...writing]);
    },
    annotate,
    step,
    /** A stand-in id for a highlight about to be made. */
    standIn: () => `pending-${Date.now()}`,
    /** A new highlight (D15): `draft` shows at once under its stand-in id while `args` (`ore highlight …`) saves
     *  it, and its step is on the history from the start, so a ⌘Z right after the drag takes this highlight back,
     *  not the step before it; the step acts on the saved highlight once the write is back. The core gives back
     *  the highlight already on that passage when there is one (`was`): then nothing new was made, and that one
     *  takes the passage it now has. `saved` runs before the list takes the saved highlight (the page moves its
     *  place to the new id), `shown` after; `failed` once the draft is off the list. */
    create(args: string[], draft: Annotation, on: { saved: (ann: Annotation, was: Annotation | undefined) => void; shown: (ann: Annotation, existing: boolean) => void; failed: (e: unknown) => void }) {
      const tmp = draft.id;
      const save = track(io.run<Annotation>(...args));
      wakeOnLanding()(save); // a skill page opened while it is made (4 on the focus is a try) reads it once it lands
      making.set(tmp, save);
      set((l) => [...l, draft]);
      let s: ReturnType<typeof step> | undefined;
      const act = (f: "remove" | "bring") => () => save.then((ann) => (s ??= step(ann.id, ann))[f](), () => {});
      const forget = io.notify("Highlighted", "quiet", act("remove"), act("bring"));
      save.then(
        (ann) => {
          saved.set(tmp, ann.id);
          landedAt.set(ann.id, ++landings);
          const was = list.find((a) => a.id === ann.id);
          on.saved(ann, was);
          if (was) forget(); // no new highlight: nothing of this one to take back
          set((l) => (was ? l.filter((a) => a.id !== tmp).map((a) => (a.id === ann.id ? { ...a, exact: ann.exact, prefix: ann.prefix, suffix: ann.suffix, start: ann.start, end: ann.end, rev: ann.rev } : a)) : l.map((a) => (a.id === tmp ? { ...ann, intent: a.intent, note: a.note } : a))));
          if (!was) steps.set(ann.id, forget);
          on.shown(ann, !!was);
        },
        (e) => {
          forget();
          set((l) => l.filter((a) => a.id !== tmp));
          on.failed(e);
        },
      );
    },
    /** A key point typed with nothing selected: `draft` shows at once and `args` saves it. Resolves with the saved
     *  highlight, its step on the history; a save that fails takes the draft off and rejects. */
    async point(args: string[], draft: Annotation): Promise<Annotation> {
      set((l) => [...l, draft]);
      const wake = wakeOnLanding();
      try {
        const save = io.run<Annotation>(...args);
        wake(save);
        const ann = await whileOut(save); // ⌘Z meanwhile waits for its step (F481)
        landedAt.set(ann.id, ++landings);
        saved.set(draft.id, ann.id); // so a read again landing before the swap doesn't list it twice
        set((l) => l.map((a) => (a.id === draft.id ? ann : a)));
        const s = step(ann.id);
        io.notify("Key point added", "quiet", s.remove, s.bring);
        return ann;
      } catch (e) {
        set((l) => l.filter((a) => a.id !== draft.id));
        throw e;
      }
    },
    /** The popup's marks are switches on one highlight (D118). `taken` is handed how to take this change back
     *  without a step left behind (a digit that turned out to start "1." in the note, D133). */
    setIntent,
    setNote,
    /** Takes a saved highlight away as one step of the history, put on it at once, as the highlight goes: a ⌘Z
     *  while the write is out takes back this step, not the one before it (a note, which it then cleared). The
     *  history holds its Undo and Redo until the removal has landed (history.ts `hold`), so they never land first.
     *  `undoable` false: a selection he dropped (Esc, or one made only to point) leaves no step behind. */
    async remove(rid: string, undoable = true) {
      if (!undoable) steps.get(rid)?.();
      const s = step(rid);
      s.drop();
      const write = annotate(rid, "--status", "deleted");
      if (undoable) io.notify("Highlight removed", "info", s.bring, s.remove).hold(write);
      try {
        await write;
      } catch (e) {
        io.notify(errorText(e), "error");
        s.restore();
      }
    },
    /** Takes a fresh highlight's step off the history: it goes with something else (the text it marked is cut). */
    forget: (rid: string) => steps.get(rid)?.(),
    /** Marks a highlight looked up; quiet, since the Explain popover is what he is looking at. */
    async lookedUp(id: string) {
      set((l) => l.map((a) => (same(a.id, id) ? { ...a, looked_up: true } : a)));
      try {
        await annotate(id, "--looked-up");
      } catch {
        // Not saved: the highlight is still his, only the plan won't know he looked it up.
      }
    },
    /** Taken as a read of the library is asked for, and handed to `read` with its answer. */
    reading: () => landings,
    /** The library's highlights, read as the source opens (`again` false) or again while it is open: then what he
     *  made or changed here that the read doesn't know yet stays as he has it (`mergeAnns`). */
    read(server: Annotation[], again: boolean, since = landings) {
      const recent = new Set([...landedAt].filter(([, n]) => n > since).map(([id]) => id));
      set(again ? (l) => mergeAnns(server, l, new Set(busy.keys()), saved, recent) : server);
    },
  };
}
