import { focusQuietly } from "./util";

/** Where focus goes when what held it goes away (Finder): an action picked from a row's menu (Rename…, Edit…,
 *  Archive, Delete) leaves focus on that row, or, once the row is gone, on the next one in its list (else the
 *  one before, else what holds the list), never on <body>, where ↑↓ and ⌘Z have nothing to act on. */

const LAYER = '[role="dialog"], [role="menu"], [role="listbox"], .popover';
const CONTROL = 'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';
/** A ⋯ or + shown only on hover: it can't hold focus, its row's own control does. */
const HOVER_ONLY = ".more, .side-more, .side-tool";
/** What a row's list is: the nearest of these around it that holds others of its kind. */
const LIST = 'section, nav, [role="grid"], [role="list"], [role="listbox"], [role="group"]';
/** An action that opens nothing has this long to remove its row; one that opened a field or a dialog, this long. */
let QUICK_MS = 8000;
let OPEN_MS = 120000;
/** Shorter limits, for tests. */
export const focusLimits = (quick: number, open: number) => void ((QUICK_MS = quick), (OPEN_MS = open));
/** A dialog counts as the action's own only if it opens this soon after the pick. */
const OPENS_MS = 1500;

const shown = (el: Element) => el.getClientRects().length > 0;

/** The control that stands for a row: the row itself when it takes focus, else its first visible button or link. */
export function rowControl(row: Element): HTMLElement | null {
  if (row instanceof HTMLElement && row.matches('[tabindex="0"]')) return row;
  return [...row.querySelectorAll<HTMLElement>(CONTROL)].find((el) => !el.matches(HOVER_ONLY) && shown(el)) ?? null;
}

export { focusQuietly };

/** Where focus goes for a row: its control, else the list around it that takes focus (a Feed post, which is
 *  only a line of the Feed's list). */
const homeOf = (row: Element) => rowControl(row) ?? row.parentElement?.closest<HTMLElement>('[tabindex="0"]') ?? null;

const sameKind = (a: Element, b: Element) => a.tagName === b.tagName && a.classList[0] === b.classList[0];

function ancestors(el: Element): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) out.push(a);
  return out;
}

let watching: (() => void) | null = null;
/** Whether a watch is running (for tests). */
export const keepingFocus = () => watching !== null;

/** Keeps focus near `row` for the one action just picked from its menu, then lets go for good:
 *  - the action opened a field in the row or a dialog: once that closes with focus nowhere, focus goes to the row;
 *  - the row went (archived, deleted): focus goes to the next row of its list, else the one before, else to what
 *    holds the list; a row drawn again in its place (a renamed collection) counts as the row;
 *  - the menu closed with focus nowhere and the row still there: it goes to the row while the action lands.
 *  It stops at the first of: focus placed after the field, dialog or removal; focus settling anywhere else; a
 *  press or a key outside the row and what the action opened; the screen going; a time limit. */
export function keepFocusNear(row: HTMLElement): void {
  watching?.();
  // An editor (the note, whose diagrams have a menu) is no row: it puts the caret back itself.
  if (!row.classList.length || row.querySelector('[contenteditable="true"]')) return;
  const holders = ancestors(row);
  const kin = (l: Element) => [...l.querySelectorAll<HTMLElement>("*")].filter((el) => sameKind(el, row));
  const lists = holders.filter((a) => a.matches(LIST));
  const list = lists.find((l) => kin(l).length > 1) ?? lists[0] ?? row.parentElement;
  if (!list) return;
  const before = kin(list);
  const at = before.indexOf(row);
  const after = before.slice(at + 1);
  const earlier = before.slice(0, at).reverse();
  // The screen it is on: what <main> or the window holds it in. Gone, he went somewhere else.
  const screen = holders.find((a) => a.parentElement?.matches("main") || a.parentElement === document.body) ?? row;
  // The menu the pick was made in, closing now.
  const menu = document.activeElement?.closest('[role="menu"]') ?? null;
  const armed = performance.now();
  /** The field or dialog the action opened, once focus is in it. */
  let opened: Element | null = null;
  let queued = false;

  const done = () => {
    seen.disconnect();
    layers.disconnect();
    clearTimeout(limit);
    removeEventListener("pointerdown", press, true);
    removeEventListener("keydown", key, true);
    removeEventListener("focusout", queue, true);
    removeEventListener("focusin", queue, true);
    if (watching === done) watching = null;
  };
  let limit = setTimeout(done, QUICK_MS);
  const own = (el: Element) => {
    opened = el;
    clearTimeout(limit);
    limit = setTimeout(done, OPEN_MS);
  };
  const inside = (el: Element | null) => !!el && el !== document.body && (row.contains(el) || !!opened?.contains(el) || !!menu?.contains(el));
  const place = (el: HTMLElement | null | undefined) => {
    done();
    if (el) focusQuietly(el);
  };
  /** The row in its place: one drawn again there, else the next, else the one before, else what holds the list. */
  const survivor = (): HTMLElement | null => {
    const redrawn = kin(list)[at];
    if (redrawn && !before.includes(redrawn)) return homeOf(redrawn);
    for (const el of [...after, ...earlier]) if (el.isConnected && rowControl(el)) return rowControl(el);
    for (const h of holders) {
      const c = h.isConnected && h !== document.body ? rowControl(h) : null;
      if (c) return c;
    }
    return null;
  };
  const check = () => {
    queued = false;
    if (!watching || watching !== done) return;
    if (!screen.isConnected) return done();
    const a = document.activeElement;
    if (a && a !== document.body) {
      if (opened && !opened.isConnected && row.contains(a)) return done(); // back on the row by itself
      if (inside(a)) return;
      const layer = a.closest(LAYER);
      // A dialog the action opened (Edit skill…): he has as long as he needs in it.
      if (!opened && layer && layer !== menu && performance.now() - armed < OPENS_MS) return own(layer);
      return done(); // he is somewhere else now
    }
    // A sheet still open over the page owns focus until it closes.
    if (document.querySelector('[aria-modal="true"]:not([hidden])')) return;
    if (!row.isConnected) return place(survivor());
    if (opened) return place(homeOf(row));
    // The menu closed with focus nowhere (WebKit): on the row while the action lands, still watching for it to go.
    const c = homeOf(row);
    if (c) focusQuietly(c);
  };
  // A couple of frames later, so the screen's own handler moves focus first when it has one.
  const queue = (e?: Event) => {
    const t = e?.type === "focusin" ? (e.target as Element) : null;
    if (t && !opened && row.contains(t) && t.matches("input, textarea")) own(t); // the rename field, typed in place
    if (!queued) (queued = true), requestAnimationFrame(() => setTimeout(check, 0));
  };
  const press = (e: Event) => void (inside(e.target as Element | null) || done());
  const key = () => void (inside(document.activeElement) || done());
  const seen = new MutationObserver(() => queue());
  const layers = new MutationObserver(() => queue());
  watching = done;
  seen.observe(screen, { childList: true, subtree: true });
  if (screen.parentElement) seen.observe(screen.parentElement, { childList: true }); // the screen itself going
  layers.observe(document.body, { childList: true });
  addEventListener("pointerdown", press, true);
  addEventListener("keydown", key, true);
  addEventListener("focusout", queue, true);
  addEventListener("focusin", queue, true);
}
