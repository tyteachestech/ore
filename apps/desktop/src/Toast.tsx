import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { PHONE } from "./ore";
import { History, type Step } from "./history";
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
      if (step) (stepMade(step), history.current.push(step));
      // A slot's new toast goes in front, in place of its last one.
      if (slot && kind !== "quiet") commit(list.current.filter((x) => x.slot !== slot));
      if (kind !== "quiet") show({ message, kind, offer: step ? "undo" : undefined, step, show: go, stay: stay && !!go, slot });
      const forget = () => {
        if (!step) return;
        history.current.forget(step);
        const t = list.current.find((x) => x.step === step);
        if (t) commit(list.current.map((x) => (x === t ? { ...x, offer: undefined, step: undefined } : x)));
      };
      return Object.assign(forget, { undo: () => void (step && takeBack.current(step)) });
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

  // ⌘Z and ⇧⌘Z walk the history; a text field or the note editor keeps them for its own text.
  // A field marked data-app-undo (Review's empty answer) has nothing of its own to undo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if ((t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA") && !t.hasAttribute("data-app-undo")) return;
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
    const els = [...(box.current?.children ?? [])] as HTMLElement[];
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
      {toasts.map((t) => (
        <div key={t.id} className="toast" data-kind={t.kind} role={t.kind === "error" ? "alert" : undefined}>
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
            <button className="icon-btn toast-x" aria-label="Dismiss" onClick={() => drop(t.id)}>
              <X size={12} aria-hidden="true" />
            </button>
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
  return { notify, progress, clear, view };
}
