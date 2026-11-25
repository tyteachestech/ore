import { errorText, inOrder, type Notify } from "./util";

/** One change he can take back. The screen says what changed; `change` owns the rest. */
export type Change = {
  /** What the toast, ⌘Z and VoiceOver call it. */
  message: string;
  /** "quiet": a small, frequent step, on the history with no toast. */
  kind?: "info" | "quiet";
  /** Puts the change on the screen (true) or takes it off (false), at once, before anything is written. Called
   *  again with the other value when a write fails, so calling it twice with the same value must be harmless. */
  show?: (on: boolean) => void;
  /** Writes the change (true) or its inverse (false). */
  write: (on: boolean) => Promise<unknown>;
  /** Once the newest write of this change has settled: read the screen's data again. Never between an action
   *  and an Undo pressed during its save, whose read would show the action still standing; and not after a first
   *  write that failed, which changed nothing (`show(false)` has put the screen back). */
  settled?: () => void;
  /** Changes sharing any key (a source's id, or every source in a batch) are written in order. */
  key?: string | readonly string[];
  /** Told of each write as it is asked for, before its turn comes (a list's `readGuard().writing`). */
  out?: (write: Promise<unknown>) => unknown;
  /** One toast at a time for it (util.ts `Notify`). Its own by default, so a failed save's reason takes the
   *  place of the toast that said it was done. */
  slot?: string;
  /** Supplied by valueChange: a field whose inverse follows successful preceding writes. */
  value?: { field: string; before: unknown; after: unknown; rebase?: (saved: unknown) => unknown };
};

/** A field edit: its initial inverse is the displayed value, rebased to the last successful value
 *  when its write reaches the queue. Callers share the field name even across different controls. */
export function valueChange<T>(c: Omit<Change, "show" | "write" | "value"> & {
  field: string; before: T; after: T;
  /** A patch to several fields keeps untouched fields from the committed predecessor. */
  rebase?: (saved: T) => T;
  show?: (value: T) => void;
  write: (value: T, inverse: T) => Promise<unknown>;
}): Change {
  const { field, before, after, rebase, show, write, ...rest } = c;
  const value = { field, before, after, rebase: rebase ? (saved: unknown) => rebase(saved as T) : undefined };
  return { ...rest, value, show: (on) => show?.(on ? value.after : value.before), write: (on) => write(on ? value.after : value.before, on ? value.before : value.after) };
}

type Field = { saved: unknown; pending: number; owner: symbol };
// Only outstanding writes, scoped to the window's history. No cache survives an idle field:
// the next action starts from its fresh screen value, including changes from another device.
const fields = new WeakMap<Notify, Map<string, Field>>();

let changes = 0;

/** A change made of several writes, as one: each step in turn, and if one fails the ones already written are
 *  written back before it says so. So a `change` whose write fails has changed nothing, as it tells him. */
export async function allOrNone(steps: ((on: boolean) => Promise<unknown>)[], on: boolean): Promise<void> {
  const done: typeof steps = [];
  try {
    for (const step of steps) {
      await step(on);
      done.push(step);
    }
  } catch (e) {
    for (const step of done.reverse()) await step(!on).catch(() => {});
    throw e;
  }
}

/** Makes a change he can take back: shows it at once, puts its step on the history before its write starts (so a
 *  ⌘Z pressed meanwhile takes back this change, never the one before it: F146, F156, F459 to F487), and writes it
 *  and every Undo and Redo of it one after another. A first write that fails takes the change off the screen and
 *  the history and says why; resolves false then. An Undo or Redo that fails shows what stands again, and the
 *  history says why and keeps the step (history.ts). */
export function change(notify: Notify, c: Change): Promise<boolean> {
  const id = `change ${++changes}`;
  const key = c.key ?? id;
  const slot = c.slot ?? id;
  const values = fields.get(notify) ?? new Map<string, Field>();
  fields.set(notify, values);
  let asked = 0;
  let failed = false;
  const run = (on: boolean) => {
    // A Redo whose turn comes after the first write failed: there is nothing to do again.
    if (failed) return Promise.resolve();
    const n = ++asked;
    const value = c.value;
    const owner = Symbol();
    const field = value ? values.get(value.field) ?? { saved: on ? value.before : value.after, pending: 0, owner } : undefined;
    if (field && value) {
      field.pending++;
      field.owner = owner;
      values.set(value.field, field);
    }
    c.show?.(on);
    // An Undo asked for before the first write failed has nothing to take back.
    const write = inOrder(key, async () => {
      if (field?.owner === owner && n > 1) c.show?.(failed ? false : on);
      if (failed) return;
      try {
        if (n === 1 && value && field) {
          value.before = field.saved;
          if (value.rebase) value.after = value.rebase(field.saved);
          // Rebase the inverse before writing, and repair an Undo shown while this waited.
          if (field.owner === owner) c.show?.(on);
        }
        await c.write(on);
        if (field && value) field.saved = on ? value.after : value.before;
      } catch (e) {
        if (n === 1) failed = true;
        throw e;
      }
    });
    c.out?.(write);
    void write.then(() => true, () => false).then((ok) => {
      if (n === asked) {
        if (!ok && (!field || field.owner === owner)) c.show?.(!on);
        if (!failed) c.settled?.();
      }
      if (field && value && --field.pending === 0 && values.get(value.field) === field) values.delete(value.field);
    });
    return write;
  };
  const first = run(true);
  const forget = notify(c.message, c.kind ?? "info", () => run(false), () => run(true), undefined, undefined, slot);
  return first.then(() => true, (e) => {
    forget();
    // Whatever was pressed meanwhile (an Undo, then a Redo): it was never written, so it is off the screen.
    if (asked > 1 && !c.value) c.show?.(false);
    // In the slot of the toast that said it was done.
    notify(errorText(e), "error", undefined, undefined, undefined, undefined, slot);
    return false;
  });
}
