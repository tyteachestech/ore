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
        if (!e.currentTarget.contains(at) || at.closest("[data-no-drag]")) return false;
        return PointerSensor.activators[0]!.handler(e, options);
      },
    },
  ];
}
