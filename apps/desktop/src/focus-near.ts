import { typedLast } from "./util";

/** Where focus goes when what held it goes away (Finder): an action picked from a row's menu (Rename…, Edit…,
 *  Archive, Delete) leaves focus on that row, or, once the row is gone, on the one that took its place (the
 *  next, else the one before), never on <body>, where ↑↓ and ⌘Z have nothing to act on. */

const LAYER = '[role="dialog"], [role="menu"], [role="listbox"], .popover';
const CONTROL = 'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';
/** A ⋯ or + shown only on hover: it can't hold focus, its row's own control does. */
const HOVER_ONLY = ".more, .side-more, .side-tool";

/** The control that stands for a row: the row itself when it takes focus, else its first visible button or link. */
export function rowControl(row: Element): HTMLElement | null {
  if (row instanceof HTMLElement && row.matches('[tabindex="0"]')) return row;
  return [...row.querySelectorAll<HTMLElement>(CONTROL)].find((el) => !el.matches(HOVER_ONLY) && el.getClientRects().length > 0) ?? null;
}

/** Focuses `el` without the keyboard ring unless the keyboard did what led here ("nothing highlighted until the
 *  keyboard moves"): a row focused after a mouse pick shows nothing. */
export function focusQuietly(el: HTMLElement): void {
  el.focus({ preventScroll: true, focusVisible: typedLast() } as FocusOptions);
}

let watching: (() => void) | null = null;

/** Keeps focus near `start` after an action on it: whenever focus falls to <body> (the rename field or dialog the
 *  action opened has closed, the row was archived), it goes to the row's control; with the row gone, to the row
 *  now in its place among its kind (a renamed collection comes back as a new element there), else the last.
 *  It lets go once focus settles somewhere else, on a press outside the row and its layers (a click away puts
 *  focus where it lands), or when no row of its kind is left (he went to another screen). One at a time. */
export function keepFocusNear(start: HTMLElement): void {
  let row = start;
  watching?.();
  // An editor (the note, whose diagrams have a menu) is no row: it puts the caret back itself.
  if (row.querySelector('[contenteditable="true"]')) return;
  const kind = `${row.tagName.toLowerCase()}.${CSS.escape(row.classList[0] ?? "")}`;
  const peers = () => [...document.querySelectorAll<HTMLElement>(kind)];
  let at = peers().indexOf(row);
  if (at < 0 || !row.classList.length) return;
  let queued = false;
  const check = () => {
    queued = false;
    const a = document.activeElement;
    if (a && a !== document.body) {
      if (!row.contains(a) && !a.closest(LAYER)) stop();
      return;
    }
    // A sheet open over the page (the action opened it) owns focus until it closes.
    if (document.querySelector('[aria-modal="true"]:not([hidden])')) return;
    const now = peers();
    const to = (row.isConnected ? row : null) ?? now[Math.min(at, now.length - 1)];
    const control = to && rowControl(to);
    if (!control) return void (now.length || stop());
    // From here it keeps focus near the row that took it, which a reload of the list may draw again.
    row = to;
    at = now.indexOf(to);
    focusQuietly(control);
  };
  // A couple of frames later, so the screen's own handler moves focus first when it has one.
  const queue = () => void (queued || ((queued = true), requestAnimationFrame(() => setTimeout(check, 0))));
  const press = (e: PointerEvent) => {
    const t = e.target as Element | null;
    if (!t || (!row.contains(t) && !t.closest?.(LAYER))) stop();
  };
  const seen = new MutationObserver(queue);
  const stop = () => {
    seen.disconnect();
    removeEventListener("pointerdown", press, true);
    removeEventListener("focusout", queue, true);
    if (watching === stop) watching = null;
  };
  watching = stop;
  seen.observe(document.body, { childList: true, subtree: true });
  addEventListener("pointerdown", press, true);
  addEventListener("focusout", queue, true);
}
