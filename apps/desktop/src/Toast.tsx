import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { PHONE } from "./ore";
import { History, ownsUndo, type Step } from "./history";
import { CHECK, CROSS, Matrix, Sprite } from "./Working";
import { Hint } from "./Hint";
import { is } from "./keys";
import { X } from "./icons";
import { errorText, stepLanded, stepMade, type Notify } from "./util";

/** `done`: how much of a long step is finished (0 to 1), drawn as a bar along the toast's foot.
 *  `settled`: a long step's toast that turned into its result, which shows a check or a cross where the
 *  spinner was. `step`: the step its Undo or Redo acts on. `cancel`: stops a long step (an add). */
type Toast = {
  id: number;
  message: string;
  kind: "info" | "error" | "progress";
  offer?: "undo" | "redo";
  step?: Step;
  show?: () => void;
  /** Stays until its Try again is pressed (the only way back to what failed) or its × lets it go. */
  stay?: boolean;
  done?: number;
  cancel?: () => void;
  settled?: "ok" | "bad";
  /** At most one toast per slot: a new one replaces it. */
  slot?: string;
};
type Shown = Omit<Toast, "id" | "settled">;

/** Most toasts stacked at once; an older one drops off the top. */
const MAX = 3;
const life = (t: Shown) => (t.kind === "error" ? 8000 : t.offer || t.show ? 6000 : 3500);

/** The toasts at the bottom of a window (RareUI's stacked toast, D113): `notify` adds one, `progress`
 *  a long step's (with a bar when its share done is known), `clear` drops a long step's, `view` renders
 *  them. Up to three stack, the newest in front with the older ones' edges above it; hovering fans
 *  them out in hard frames. A long step's toast turns into its result in place.
 *  A toast with an undo also goes on the window's history, so ⌘Z takes back a run of steps and
 *  ⇧⌘Z does them again, each naming what it did; each toast's own Undo takes back its own step.
 *  Shared by the app, the quick quiz and the phone. */
export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  /** A quiet step (a highlight saved, its note) shows no toast, but VoiceOver still hears it (Codex sweep 3, a11y).
   *  The same words twice in a row get a space more, or the live region wouldn't change and stays silent. */
  const [said, setSaid] = useState("");
  const list = useRef<Toast[]>([]);
  const timers = useRef(new Map<number, number>());
  const held = useRef(false);
  const next = useRef(0);
  /** An undo or redo whose write failed: its toast turns into why, and the step stays where it was. */
  const failed = useRef<(step: Step, e: unknown, what: "undo" | "redo") => void>(() => {});
  /** One step taken back out of order (a toast's Undo, a screen's own Undo button). */
  const takeBack = useRef<(step: Step) => void>(() => {});
  const history = useRef(new History((step, e, what) => failed.current(step, e, what), stepLanded));

  const commit = useCallback((ts: Toast[]) => {
    for (const id of timers.current.keys()) if (!ts.some((t) => t.id === id)) (clearTimeout(timers.current.get(id)), timers.current.delete(id));
    list.current = ts;
    setToasts(ts);
  }, []);
  const drop = useCallback((id: number) => commit(list.current.filter((t) => t.id !== id)), [commit]);
  const arm = useCallback(
    (t: Toast, ms = life(t)) => {
      clearTimeout(timers.current.get(t.id));
      timers.current.delete(t.id);
      if (t.kind !== "progress" && !t.stay && !held.current) timers.current.set(t.id, window.setTimeout(() => drop(t.id), ms));
    },
    [drop],
  );
  /** Puts a toast in place of the one `over` picks (by default a long step's still running), or on top. */
  const show = useCallback(
    (t: Shown, over: (x: Toast) => boolean = (x) => x.kind === "progress") => {
      const ts = list.current;
      const i = ts.findIndex(over);
      let item: Toast;
      if (i >= 0) {
        const was = ts[i]!;
        item = { ...t, id: was.id, settled: was.kind === "progress" && t.kind !== "progress" ? (t.kind === "error" ? "bad" : "ok") : was.settled };
        commit(ts.map((x, j) => (j === i ? item : x)));
      } else {
        item = { ...t, id: ++next.current };
        // The oldest drops off, but never one that stays.
        const all = [...ts, item];
        while (all.length > MAX) all.splice(Math.max(0, all.findIndex((x) => !x.stay)), 1);
        commit(all);
      }
      arm(item);
    },
    [commit, arm],
  );
  const notify: Notify = useCallback(
    (message, kind = "info", undo, redo, go, stay, slot) => {
      const step = undo && { message, undo, redo };
      if (step) {
        stepMade(step);
        history.current.push(step);
        // What was undone before it can no longer be redone, so a toast still up stops offering Redo.
        if (list.current.some((x) => x.offer === "redo")) commit(list.current.map((x) => (x.offer === "redo" ? { ...x, offer: undefined, step: undefined } : x)));
      }
      // A slot's new toast goes in front, in place of its last one.
      if (slot && kind !== "quiet") commit(list.current.filter((x) => x.slot !== slot));
      // A slot's toast never takes the place of another step's running one (rehearsal 2026-11-15).
      if (kind !== "quiet") show({ message, kind, offer: step ? "undo" : undefined, step, show: go, stay: stay && !!go, slot }, slot ? () => false : undefined);
      else setSaid((was) => (was === message ? `${message}\u00a0` : message));
      const forget = () => {
        if (!step) return;
        history.current.forget(step);
        const t = list.current.find((x) => x.step === step);
        if (t) commit(list.current.map((x) => (x === t ? { ...x, offer: undefined, step: undefined } : x)));
      };
      const hold = (write: Promise<unknown>) => {
        if (!step) return;
        history.current.hold(step, write);
        write.catch(forget);
      };
      return Object.assign(forget, { undo: () => void (step && takeBack.current(step)), hold });
    },
    [show, commit],
  );
  const progress = useCallback((message: string, done?: number, cancel?: () => void) => show({ message, kind: "progress", done, cancel }), [show]);
  const clear = useCallback(() => commit(list.current.filter((t) => t.kind !== "progress")), [commit]);
  /** The toasts stay while the pointer or focus is on them, then give him a few seconds more. */
  const hold = () => {
    held.current = true;
    for (const t of list.current) arm(t);
  };
  const release = () => {
    held.current = false;
    for (const t of list.current) arm(t, 3000);
  };
  /** A step's toast turns into what ⌘Z or ⇧⌘Z did, brought to the front: a run of ⌘Z otherwise
   *  rewrites a toast behind the front one, which still names the step before. */
  const again = useCallback(
    (t: Shown, step: Step) => {
      const ts = list.current;
      const i = ts.findIndex((x) => x.step === step);
      if (i >= 0 && i < ts.length - 1) commit([...ts.slice(0, i), ...ts.slice(i + 1), ts[i]!]);
      show(t, (x) => x.step === step);
    },
    [show, commit],
  );
  const undone = useCallback((step: Step) => again({ message: `Undone: ${step.message}`, kind: "info", offer: step.redo ? "redo" : undefined, step }, step), [again]);
  const redone = useCallback((step: Step) => again({ message: step.message, kind: "info", offer: "undo", step }, step), [again]);
  failed.current = (step, e, what) => again({ message: `Couldn’t ${what} “${step.message}”: ${errorText(e)}`, kind: "error" }, step);
  const undo = useCallback(() => {
    const step = history.current.undo();
    if (step) undone(step);
  }, [undone]);
  const redo = useCallback(() => {
    const step = history.current.redo();
    if (step) redone(step);
  }, [redone]);
  const undoOne = (step?: Step) => (step && history.current.take(step) ? undone(step) : undo());
  takeBack.current = (step) => void (history.current.take(step) && undone(step));
  const redoOne = (step?: Step) => (step && history.current.again(step) ? redone(step) : redo());

  // ⌘Z and ⇧⌘Z walk the history; the note editor, and a text field he has typed in since the newest
  // step, keep them for their own text (`ownsUndo`).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.isContentEditable || ownsUndo(t)) return;
      if (is(e, "undo") && history.current.canUndo) {
        e.preventDefault();
        undo();
      } else if (is(e, "redo") && history.current.canRedo) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  useEffect(() => () => timers.current.forEach((id) => clearTimeout(id)), []);

  // Collapsed, each older toast sits 6 px above the one in front; fanned, a full height and a gap.
  const box = useRef<HTMLDivElement>(null);
  const [fanned, setFanned] = useState(false);
  useLayoutEffect(() => {
    const els = [...(box.current?.querySelectorAll<HTMLElement>(":scope > .toast") ?? [])];
    const front = els.at(-1);
    if (!front) return;
    // Collapsed, an older toast takes the front one's height, so only its top edge shows.
    for (const el of els) el.style.height = fanned || el === front ? "" : `${front.offsetHeight}px`;
    let y = 0;
    for (let i = els.length - 1; i >= 0; i--) {
      const el = els[i]!;
      el.style.transform = el === front ? "" : `translateY(${-y}px)`;
      y += fanned ? el.offsetHeight + 8 : 6;
    }
  });

  // On the iPhone a toast is swiped away, down or to a side, as an iOS banner is (D-new-toast-swipe): one over the
  // row he wants need not be waited out or closed by its small ×. It follows the finger; let go past 48pt (or with
  // a flick) it leaves, otherwise it comes back. A wait's toast stays: swiping it away would hide work still going.
  useEffect(() => {
    const el = box.current;
    if (!PHONE || !el) return;
    let toast: HTMLElement | null = null, x0 = 0, y0 = 0, t0 = 0, dx = 0, dy = 0, axis: "x" | "y" | null = null;
    const start = (e: TouchEvent) => {
      toast = e.touches.length === 1 ? (e.target as HTMLElement).closest<HTMLElement>(".toast:not([data-kind='progress'])") : null;
      [x0, y0, t0, dx, dy, axis] = [e.touches[0]!.clientX, e.touches[0]!.clientY, e.timeStamp, 0, 0, null];
    };
    const move = (e: TouchEvent) => {
      if (!toast) return;
      [dx, dy] = [e.touches[0]!.clientX - x0, Math.max(0, e.touches[0]!.clientY - y0)];
      if (!axis) {
        if (Math.max(Math.abs(dx), dy) < 8) return;
        axis = Math.abs(dx) > dy ? "x" : "y";
        hold(); // it does not time out under the finger
      }
      // Taken from the page: no scroll under it, and no click on the lift (its own button, the row below).
      if (e.cancelable) e.preventDefault();
      toast.style.transition = "none";
      toast.style.translate = axis === "x" ? `${dx}px 0` : `0 ${dy}px`;
    };
    const end = (e: TouchEvent) => {
      const [it, d] = [toast, axis === "x" ? dx : dy];
      toast = null;
      if (!it || !axis) return;
      const go = e.type === "touchend" && (Math.abs(d) > 48 || Math.abs(d) / Math.max(1, e.timeStamp - t0) > 0.5);
      release();
      const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
      it.style.transition = still ? "none" : "translate var(--t-3) var(--ease-out), opacity var(--t-3) linear";
      it.style.translate = !go ? "" : axis === "x" ? `${Math.sign(d) * innerWidth}px 0` : "0 160px";
      if (go) it.style.opacity = "0";
      // What he swiped away, by its words: a toast is rewritten in place (an undo that failed), and that news stays.
      const said = it.textContent;
      setTimeout(() => {
        const gone = go && it.isConnected && it.textContent === said;
        Object.assign(it.style, { transition: "", translate: "", opacity: "" });
        if (gone) drop(Number(it.dataset.id));
      }, still ? 0 : 200);
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
    };
  }, [drop]); // eslint-disable-line react-hooks/exhaustive-deps

  // Always mounted, even empty, so VoiceOver reads each toast as it comes: a live region that appears with its words often
  // stays silent. An error is an alert: the nearest live region decides, so it is read once, at once.
  const view = (
    <div
      ref={box}
      aria-live="polite"
      className={`toasts${fanned ? " fan" : ""}`}
      onMouseEnter={PHONE ? undefined : () => (setFanned(true), hold())}
      onMouseLeave={PHONE ? undefined : () => (setFanned(false), release())}
      onFocus={PHONE ? undefined : hold}
      onBlur={PHONE ? undefined : release}
    >
      <span className="sr-only">{said}</span>
      {toasts.map((t) => (
        <div key={t.id} className="toast" data-id={t.id} data-kind={t.kind} role={t.kind === "error" ? "alert" : undefined}>
          {t.kind === "progress" ? <Matrix /> : t.settled && <Sprite rows={t.settled === "ok" ? CHECK : CROSS} className={`toast-mark ${t.settled}`} />}
          <span className={t.done === undefined ? "toast-msg" : "toast-text"}>{t.message}</span>
          {t.done !== undefined && (
            <span className="toast-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(t.done * 100)}>
              <span style={{ transform: `scaleX(${t.done})` }} />
            </span>
          )}
          {t.kind === "progress" && t.cancel && (
            <button
              className="toast-undo"
              onClick={() => {
                t.cancel?.();
                drop(t.id);
              }}
            >
              Cancel
            </button>
          )}
          {t.show && (
            <button
              className="toast-undo"
              onClick={() => {
                t.show?.();
                drop(t.id);
              }}
            >
              {t.kind === "error" ? "Try again" : "Show"}
            </button>
          )}
          {t.stay && (
            <Hint text="Dismiss">
              <button className="icon-btn toast-x" aria-label="Dismiss" onClick={() => drop(t.id)}>
                <X size={12} aria-hidden="true" />
              </button>
            </Hint>
          )}
          {t.offer === "undo" && (
            <Hint text="Undo" keys="undo">
              <button className="toast-undo" onClick={() => undoOne(t.step)}>
                Undo
              </button>
            </Hint>
          )}
          {t.offer === "redo" && (
            <Hint text="Redo" keys="redo">
              <button className="toast-undo" onClick={() => redoOne(t.step)}>
                Redo
              </button>
            </Hint>
          )}
        </div>
      ))}
    </div>
  );
  return { notify, progress, clear, view, history: history.current, undo, redo };
}
