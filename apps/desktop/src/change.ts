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
   *  and an Undo pressed during its save, whose read would show the action still standing. */
  settled?: () => void;
  /** Changes with one key (a source's id) are written in the order he made them. */
  key?: string;
  /** Told of each write as it is asked for, before its turn comes (a list's `readGuard().writing`). */
  out?: (write: Promise<unknown>) => unknown;
  /** One toast at a time for it (util.ts `Notify`). */
  slot?: string;
};

let changes = 0;

/** Makes a change he can take back: shows it at once, puts its step on the history before its write starts (so a
 *  ⌘Z pressed meanwhile takes back this change, never the one before it: F146, F156, F459 to F487), and writes it
 *  and every Undo and Redo of it one after another. A first write that fails takes the change off the screen and
 *  the history and says why; resolves false then. An Undo or Redo that fails shows what stands again, and the
 *  history says why and keeps the step (history.ts). */
export function change(notify: Notify, c: Change): Promise<boolean> {
  const key = c.key ?? `change ${++changes}`;
  let asked = 0;
  let failed = false;
  const run = (on: boolean) => {
    const n = ++asked;
    c.show?.(on);
    // An Undo asked for before the first write failed has nothing to take back.
    const write = inOrder(key, () => (failed ? Promise.resolve() : c.write(on)));
    c.out?.(write);
    void write.then(() => true, () => false).then((ok) => {
      if (n !== asked) return;
      if (!ok) c.show?.(!on);
      c.settled?.();
    });
    return write;
  };
  const first = run(true);
  const forget = notify(c.message, c.kind ?? "info", () => run(false), () => run(true), undefined, undefined, c.slot);
  return first.then(() => true, (e) => {
    failed = true;
    forget();
    // In the slot of the toast that said it was done.
    notify(errorText(e), "error", undefined, undefined, undefined, undefined, c.slot);
    return false;
  });
}
