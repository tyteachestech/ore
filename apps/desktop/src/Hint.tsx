import * as Tooltip from "@radix-ui/react-tooltip";
import type { ReactElement, ReactNode } from "react";
import { label, useKeymap, type KeyId } from "./keys";
import { useLite } from "./Lite";

let tabbed = false;
if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => (tabbed = e.key === "Tab"), true);
  window.addEventListener("pointerdown", () => (tabbed = false), true);
}

/** Escapes that only closed a hint: Radix marks them handled, but a hint is not a layer he sees, so the
 *  sheet under it closes on that same Esc (one press, as on a Mac). */
const hintEscapes = new WeakSet<Event>();
/** Whether something on screen already took this Esc (a menu, a field), so a sheet should not close. */
export const escTaken = (e: Event) => e.defaultPrevented && !hintEscapes.has(e);

/** Hover hint for a control, Linear-style: what it does and its shortcut, read from the keymap so a
 *  rebinding shows at once. Every control whose action has a binding uses this (AGENTS.md, UI quality
 *  bar); test/hints.test.ts fails when a binding is neither hinted nor listed as having no control. */
export function Hint({ text, keys, side = "bottom", children }: { text: ReactNode; keys?: KeyId | KeyId[]; side?: "top" | "bottom" | "left" | "right"; children: ReactElement }) {
  const map = useKeymap();
  const combos = (Array.isArray(keys) ? keys : keys ? [keys] : []).map((k) => label(map[k])).filter(Boolean);
  // A row not on screen yet can't be hovered.
  if (useLite()) return children;
  return (
    <Tooltip.Root>
      {/* Opens on hover, and on focus only when Tab moved it there: focus set by code (a field
          autofocused, a panel opening) must not drop a hint over the label beside it. */}
      <Tooltip.Trigger asChild onFocus={(e) => !tabbed && e.preventDefault()}>
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="hint" onEscapeKeyDown={(e) => hintEscapes.add(e)} side={side} sideOffset={6} collisionPadding={8}>
          {text}
          {combos.map((c) => (
            <kbd key={c}>{c}</kbd>
          ))}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export const HintProvider = ({ children }: { children: ReactNode }) => (
  <Tooltip.Provider delayDuration={400} skipDelayDuration={250}>
    {children}
  </Tooltip.Provider>
);
