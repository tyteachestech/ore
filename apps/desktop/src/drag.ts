import { PointerSensor, type PointerSensorOptions } from "@dnd-kit/core";
import type { PointerEvent } from "react";

/** A row that drags, except from what sits on it: a press on a `data-no-drag` control, or in a popover
 *  opened from the row (a portal, but its presses still bubble up the React tree to the row). The press must
 *  still reach the document, so a control never stops it to keep the row still: that leaves popovers open. */
export class RowSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: (e: PointerEvent, options: PointerSensorOptions) => {
        const at = e.target as Element;
        const control = at.closest("[data-no-drag]");
        if (!e.currentTarget.contains(at) || (control && e.currentTarget.contains(control))) return false;
        return PointerSensor.activators[0]!.handler(e, options);
      },
    },
  ];
}

/** A resize drag from a handle's pointer-down (the video's edges, a side panel's divider, a note diagram's
 *  grips): `move` while the button is down, then `end` once, with the pointer-up, or with null when Esc or the
 *  system cancels it (put the size back). Esc is taken here, so it never also closes the page under the drag.
 *  It listens on the window, so the drag ends cleanly even if its handle leaves the page first. */
export function resizeDrag(e: { pointerId: number; currentTarget: Element }, on: { move: (ev: globalThis.PointerEvent) => void; end: (ev: globalThis.PointerEvent | null) => void }) {
  const handle = e.currentTarget;
  handle.setPointerCapture(e.pointerId);
  const stop = (ev: globalThis.PointerEvent | null) => {
    window.removeEventListener("pointermove", on.move, true);
    window.removeEventListener("pointerup", up, true);
    window.removeEventListener("pointercancel", cancel, true);
    window.removeEventListener("keydown", key, true);
    if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
    on.end(ev);
  };
  const up = (ev: globalThis.PointerEvent) => stop(ev);
  const cancel = () => stop(null);
  const key = (ev: KeyboardEvent) => {
    if (ev.key !== "Escape") return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    stop(null);
  };
  window.addEventListener("pointermove", on.move, true);
  window.addEventListener("pointerup", up, true);
  window.addEventListener("pointercancel", cancel, true);
  window.addEventListener("keydown", key, true);
}
