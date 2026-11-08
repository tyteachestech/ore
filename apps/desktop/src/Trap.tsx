import { FocusScope } from "@radix-ui/react-focus-scope";
import type { ReactElement } from "react";

/** Keeps Tab and ⇧Tab inside a modal panel, looping at its ends (a Mac sheet, Radix Dialog). Focus on
 *  open and close stays with the panel's own code (useFocusWhileMounted); a Radix popover opened from
 *  inside pauses the trap while it is up. `off` lets go while the panel is hidden (Review paused on a source). */
export const Trap = ({ children, off = false }: { children: ReactElement; off?: boolean }) => (
  <FocusScope asChild trapped={!off} loop={!off} onMountAutoFocus={(e) => e.preventDefault()} onUnmountAutoFocus={(e) => e.preventDefault()}>
    {children}
  </FocusScope>
);
