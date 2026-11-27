/** Whether his last input was a key. A menu or popup opened with the pointer grows from what he pressed; one
 *  opened or closed from the keyboard appears and goes at once (DESIGN.md "Motion": nothing moves for a
 *  keyboard-driven action). A modifier held for a click (⌘-click, ⇧-click) is not a key press. */
const MODIFIERS = new Set(["Meta", "Control", "Alt", "Shift", "CapsLock", "Fn"]);
export function keyInput(was: boolean, e: { type: string; key?: string }): boolean {
  if (e.type === "keydown") return was || !MODIFIERS.has(e.key ?? "");
  if (e.type === "pointerdown") return false;
  return was;
}

let last: string | null = null;
/** The last key he pressed, or null since a pointer press: a list lights a row when Tab brings focus in (F547),
 *  not when a menu he worked by keys hands focus back to it. */
export const lastKey = () => last;

/** Keeps `data-keys` on the root while `keyInput` says so; the stylesheet reads it (`.popover` in styles.css). */
export function trackInput(doc: Document) {
  const root = doc.documentElement;
  const on = (e: Event) => {
    if (e.type === "pointerdown") last = null;
    else if (!MODIFIERS.has((e as KeyboardEvent).key)) last = (e as KeyboardEvent).key;
    root.toggleAttribute("data-keys", keyInput(root.hasAttribute("data-keys"), e as KeyboardEvent));
  };
  doc.addEventListener("keydown", on, true);
  doc.addEventListener("pointerdown", on, true);
}
