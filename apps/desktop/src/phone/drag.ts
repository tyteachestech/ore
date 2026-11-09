// One touch on the phone is a tap, a hold or a swipe: decided here, once, so the three never overlap.

export type Drag = {
  accept: (t: { clientX: number; clientY: number }) => boolean;
  begin?: (dx: number) => boolean | void;
  move: (dx: number) => void;
  end: (dx: number, flick: number, cancelled: boolean) => void;
  /** A still touch for HOLD_MS (iOS's context menu): the touch is spent, so it can't also swipe. */
  hold?: (x: number, y: number) => void;
};

export const HOLD_MS = 500;

/** A one-finger horizontal drag on `el`. `accept` decides at touch down; a touch that turns vertical first is left
 *  to scrolling. `begin` runs when it locks horizontal, and can refuse it. A cancelled touch (a notification, the
 *  app switcher) calls `end` with `cancelled`: springs back, never commits. Returns the cleanup. */
export function trackDrag(el: EventTarget, drag: () => Drag): () => void {
  let x0 = 0, y0 = 0, t0 = 0, dx = 0, state: "idle" | "maybe" | "drag" = "idle";
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stopHold = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  const start = (e: TouchEvent) => {
    stopHold();
    if (e.touches.length !== 1) {
      // A second finger: not a hold or a swipe that hasn't started.
      if (state === "maybe") state = "idle";
      return;
    }
    const t = e.touches[0]!;
    if (!drag().accept(t)) return;
    [x0, y0, t0, dx, state] = [t.clientX, t.clientY, e.timeStamp, 0, "maybe"];
    if (drag().hold)
      timer = setTimeout(() => {
        timer = undefined;
        state = "idle";
        drag().hold?.(x0, y0);
      }, HOLD_MS);
  };
  const move = (e: TouchEvent) => {
    const t = e.touches[0];
    if (state === "idle" || !t) return;
    dx = t.clientX - x0;
    const dy = t.clientY - y0;
    if (Math.hypot(dx, dy) >= 10) stopHold();
    if (state === "maybe") {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) return void (state = "idle");
      if (Math.abs(dx) < 10) return;
      if (drag().begin?.(dx) === false) return void (state = "idle");
      state = "drag";
    }
    e.preventDefault();
    drag().move(dx);
  };
  const end = (e: TouchEvent) => {
    // One of two fingers lifting: the touch still going decides.
    if (e.type === "touchend" && e.touches.length) return;
    stopHold();
    if (state !== "drag") return void (state = "idle");
    state = "idle";
    drag().end(dx, dx / Math.max(1, e.timeStamp - t0), e.type === "touchcancel");
  };
  const on = (type: string, fn: (e: TouchEvent) => void, passive: boolean) => {
    el.addEventListener(type, fn as EventListener, { passive });
    return () => el.removeEventListener(type, fn as EventListener);
  };
  const off = [on("touchstart", start, true), on("touchmove", move, false), on("touchend", end, true), on("touchcancel", end, true)];
  return () => {
    stopHold();
    off.forEach((f) => f());
  };
}
