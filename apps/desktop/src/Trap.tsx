import { FocusScope } from "@radix-ui/react-focus-scope";
import { useEffect, useRef, type ReactElement } from "react";

/** Keeps Tab and ⇧Tab inside a modal panel, looping at its ends (a Mac sheet, Radix Dialog). Focus on
 *  open and close stays with the panel's own code (useFocusWhileMounted); a Radix popover opened from
 *  inside pauses the trap while it is up. `off` lets go while the panel is hidden (Review paused on a source). */
export function Trap({ children, off = false }: { children: ReactElement; off?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const panel = ref.current;
    if (off || !panel) return;
    const onKey = (e: KeyboardEvent) => wrap(e, panel);
    panel.addEventListener("keydown", onKey);
    return () => panel.removeEventListener("keydown", onKey);
  }, [off]);
  return (
    <FocusScope asChild ref={ref} data-trap="" trapped={!off} loop={!off} onMountAutoFocus={(e) => e.preventDefault()} onUnmountAutoFocus={(e) => e.preventDefault()}>
      {children}
    </FocusScope>
  );
}

const CONTROLS = "a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1']), [contenteditable=true]";

/** Radix loops only at the controls it counts as ends, on a plain Tab. WebKit's plain Tab skips buttons and its ⌥Tab
 *  reaches them, so either one could step off the last control onto the page (Codex sweep 3, a11y). Once the browser
 *  has moved focus, if it fell off onto the page it comes back at the far end. */
function wrap(e: KeyboardEvent, panel: HTMLElement) {
  if (e.key !== "Tab" || e.metaKey || e.ctrlKey) return;
  const back = e.shiftKey;
  setTimeout(() => {
    if (!panel.isConnected || (document.activeElement && document.activeElement !== document.body)) return;
    const all = [...panel.querySelectorAll<HTMLElement>(CONTROLS)].filter((el) => el.getClientRects().length > 0);
    (back ? all.at(-1) : all[0])?.focus();
  });
}
