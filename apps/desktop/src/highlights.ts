import type { Annotation } from "./ore";
import { inOrder } from "./util";

/** A source's highlights read again from the library (a wake after a write elsewhere), merged with what is on
 *  screen. It keeps two things: a highlight still being made (a `pending-` stand-in the library doesn't have
 *  yet; `saved` maps a stand-in whose save has landed to its id, so it isn't listed twice), and a highlight still on
 *  screen with a write of his in flight (`busy`), whose copy wins over the library's older one. It does not
 *  cover two cases: a highlight whose save landed after this read began can still be dropped by the older read, and
 *  one he just removed or brought back with ⌘Z can flip back until its write lands. */
export function mergeAnns(server: Annotation[], local: Annotation[], busy: ReadonlySet<string>, saved: ReadonlyMap<string, string> = new Map()): Annotation[] {
  const mine = new Map(local.map((a) => [a.id, a]));
  const out = server.map((a) => (busy.has(a.id) && mine.get(a.id)) || a);
  const have = new Set(server.map((a) => a.id));
  for (const a of local) if (a.id.startsWith("pending-") && !have.has(saved.get(a.id) ?? "")) out.push(a);
  return out;
}

export type Highlights = ReturnType<typeof highlights>;

/** One source's highlights as the Reader holds them: the list on screen, and which of them are still being
 *  written. A new highlight shows at once under a stand-in id (`pending-…`) and takes the library's id when its
 *  save lands, so until the page has drawn that swap either id may name it: every lookup here answers to both.
 *  The Reader keeps only what is the page's (where each highlight sits, its popup), and asks here for the rest. */
export function highlights(io: {
  /** `ore annotate <id> …`. */
  annotate: <T>(id: string, ...args: string[]) => Promise<T>;
  /** The list changed: draw it. */
  show: (list: Annotation[]) => void;
  /** A write to a highlight has settled, saved or not. */
  landed: () => void;
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

  const idOf = (id: string) => saved.get(id) ?? id;
  const same = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && idOf(a) === idOf(b);
  const set = (next: Annotation[] | ((list: Annotation[]) => Annotation[])) => {
    list = typeof next === "function" ? next(list) : next;
    io.show(list);
  };

  return {
    /** The highlights on screen. */
    list: () => list,
    set,
    /** A highlight's id as the library knows it: a stand-in whose save has landed is its saved id. */
    idOf,
    /** Whether two ids name one highlight. */
    same,
    /** The highlight on screen under either of its ids. */
    find: (id: string | null | undefined) => (id ? list.find((a) => same(a.id, id)) : undefined),
    /** A new highlight shown under `standIn` while `save` is out. */
    make(standIn: string, save: Promise<Annotation>) {
      making.set(standIn, save);
    },
    /** `standIn`'s save came back with `id`. */
    made(standIn: string, id: string) {
      saved.set(standIn, id);
    },
    /** The library's id for a highlight, once its save has landed; rejects when the save failed. */
    async realId(id: string) {
      const wait = making.get(id);
      return wait ? (await wait).id : id;
    },
    /** Counts a change of his as saving until it settles. */
    track<T>(p: Promise<T>) {
      const settled = p.then(() => {}, () => {});
      writing.add(settled);
      void settled.then(() => writing.delete(settled));
      return p;
    },
    /** Once every change of his has been written, the ones started meanwhile too. */
    async allSaved() {
      while (writing.size) await Promise.all([...writing]);
    },
    /** `ore annotate`, one write at a time per highlight: quick changes and their ⌘Z land in the order he made
     *  them, never an older one last. `wake` is told of the write as it is asked for, before its turn comes. */
    annotate<T = unknown>(wake: (write: Promise<unknown>) => void, id: string, ...args: string[]) {
      busy.set(id, (busy.get(id) ?? 0) + 1);
      const write = inOrder(`annotate ${id}`, () => io.annotate<T>(id, ...args));
      const landed = () => {
        const n = (busy.get(id) ?? 1) - 1;
        if (n) busy.set(id, n);
        else busy.delete(id);
        io.landed();
      };
      write.then(landed, landed);
      wake(write);
      return write;
    },
    /** The library's highlights, read as the source opens (`again` false) or again while it is open: then what he
     *  made or changed here that is still saving stays as he has it (`mergeAnns`). */
    read(server: Annotation[], again: boolean) {
      set(again ? (l) => mergeAnns(server, l, new Set(busy.keys()), saved) : server);
    },
  };
}
