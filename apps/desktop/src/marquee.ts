// The box dragged from blank space to select several things at once, as in Finder: the note's blocks
// (D188, editor/dragsel.ts) and the rows of a list of sources (D194). Both take what the box crosses by
// height only, so it need not touch a row's text, and draw the same box (`.marquee`).

export type Band = { top: number; bottom: number };

/** What a box from height `y0` to `y1` crosses, in the order given. */
export function crossing<T extends Band>(all: T[], y0: number, y1: number): T[] {
  return all.filter((s) => s.bottom > Math.min(y0, y1) && s.top < Math.max(y0, y1));
}

/** Draws the box (or makes it, the first time) from (x0, y0) to (x1, y1): `fixed`, in the window's
 *  coordinates; else in `parent`'s, so it moves with what it is drawn over when that scrolls. */
export function drawBox(box: HTMLElement | null, parent: HTMLElement, x0: number, y0: number, x1: number, y1: number, fixed = false): HTMLElement {
  const el = box ?? parent.appendChild(Object.assign(document.createElement("div"), { className: fixed ? "marquee fixed" : "marquee" }));
  el.setAttribute("aria-hidden", "true");
  Object.assign(el.style, { left: `${Math.min(x0, x1)}px`, top: `${Math.min(y0, y1)}px`, width: `${Math.abs(x1 - x0)}px`, height: `${Math.abs(y1 - y0)}px` });
  return el;
}

/** How a drag over rows meets the selection already there: none held replaces it, ⇧ adds to it, ⌘ toggles. */
export type Mode = "set" | "add" | "toggle";

/** The rows picked once the box crosses `crossed`, in list order (`ids`); `held` is the selection when it began. */
export function combine(ids: string[], held: string[], crossed: string[], mode: Mode): string[] {
  const hit = new Set(crossed);
  const had = new Set(held);
  return ids.filter((id) => (mode === "set" ? hit.has(id) : mode === "add" ? hit.has(id) || had.has(id) : hit.has(id) !== had.has(id)));
}

/** Beside a note or a list: how far left or right of it a drag may start (the note's gutter, D188). */
const REACH = 40;

/** A press on the bare page around `el` (on something that holds it), level with it and at most 40px to
 *  its side. Level with it only, so where the note sits above the sources (a narrow skill page) a press
 *  beside one is never also beside the other, and only one box starts. */
export function besideAt(e: MouseEvent, t: Element, el: Element): boolean {
  const r = el.getBoundingClientRect();
  return t.contains(el) && e.clientX >= r.left - REACH && e.clientX <= r.right + REACH && e.clientY >= r.top && e.clientY <= r.bottom;
}
/** Where a Mac's overlay scrollbar sits, at a scrolling list's right edge. */
const BAR = 12;
/** What a press on is never the start of a box: a row (it drags to file, and opens on a click), a control, a header. */
const OWN = 'button, input, textarea, select, a, [contenteditable], [role="row"], [role="button"], [role="menu"], [role="dialog"], [data-no-drag], .list-group, .empty-state';

const scroller = (el: HTMLElement): HTMLElement => {
  for (let a: HTMLElement | null = el; a; a = a.parentElement) if (/auto|scroll/.test(getComputedStyle(a).overflowY)) return a;
  return document.documentElement;
};

/** A press on blank space by the list's rows: its own space (padding, below the last row) or the bare
 *  column beside it, never a row, a control, the bar above it, the sidebar or a scrollbar. */
export function blankStart(e: MouseEvent, list: HTMLElement): boolean {
  const t = e.target;
  if (e.button !== 0 || e.ctrlKey || e.altKey || !(t instanceof Element) || t.closest(OWN)) return false;
  if (!(list.contains(t) || besideAt(e, t, list)) || !t.closest(".main") || !list.querySelector('[role="row"]')) return false;
  const s = scroller(list);
  const sr = s.getBoundingClientRect();
  const edge = sr.left + s.clientLeft + s.clientWidth - (s.scrollHeight > s.clientHeight ? BAR : 0);
  return e.clientX < edge || e.clientX > sr.right;
}

export type RowPick = {
  /** The rows that can be picked, in list order. */
  ids: string[];
  /** The selection ⇧ adds to and ⌘ toggles. */
  held: string[];
  /** The box now covers these: picked in list order, `from` the row it began by and `to` the one it reached. */
  pick: (ids: string[], from: string | null, to: string | null) => void;
  /** Esc mid-drag: the selection as it was. */
  cancel: () => void;
  /** A press with no drag and no ⇧ or ⌘: clears the selection, as Finder does. */
  click: () => void;
};

/** Follows a press `blankStart` took: past a few pixels it draws the box and picks the rows (`[role=row]`,
 *  id `row-<id>`) it crosses as it goes; Esc puts the selection back, release keeps it. No autoscroll near
 *  the edges (D188 left it out; the wheel scrolls and the box follows). Returns what ends it where it is,
 *  with no more picks, for when the list goes (another view); the window losing focus ends it too. */
export function dragRows(e: MouseEvent, list: HTMLElement, on: RowPick): () => void {
  e.preventDefault(); // no text selected under the box; focus goes to the list instead, so its keys work after
  // A click lets go of words selected anywhere; the press it stopped would have, so it does it here.
  window.getSelection()?.removeAllRanges();
  list.focus({ preventScroll: true });
  const mode: Mode = e.metaKey ? "toggle" : e.shiftKey ? "add" : "set";
  const ok = new Set(on.ids);
  const r0 = list.getBoundingClientRect();
  // Where he pressed, in the list's own content, so it stays put as the list scrolls.
  const sx = e.clientX - r0.left + list.scrollLeft, sy = e.clientY - r0.top + list.scrollTop;
  let at = { x: e.clientX, y: e.clientY };
  let box: HTMLElement | null = null;
  let last: string | null = null;

  const update = () => {
    if (!list.isConnected) return end();
    const r = list.getBoundingClientRect();
    const v = scroller(list).getBoundingClientRect();
    const clamp = (y: number) => Math.max(Math.max(v.top, 0), Math.min(Math.min(v.bottom, innerHeight), y));
    const x0 = r.left + sx - list.scrollLeft, y0 = r.top + sy - list.scrollTop;
    const y1 = clamp(at.y);
    const rows = [...list.querySelectorAll<HTMLElement>('[role="row"]')].flatMap((el) => {
      const id = el.id.slice(4);
      if (!ok.has(id)) return [];
      const b = el.getBoundingClientRect();
      return [{ id, top: b.top, bottom: b.bottom }];
    });
    const hit = crossing(rows, y0, y1);
    const ids = combine(on.ids, on.held, hit.map((h) => h.id), mode);
    const key = ids.join("\n");
    if (key !== last) {
      last = key;
      const [first, end] = [hit[0]?.id ?? null, hit.at(-1)?.id ?? null];
      on.pick(ids, y0 <= y1 ? first : end, y0 <= y1 ? end : first);
    }
    box = drawBox(box, document.body, x0, clamp(y0), at.x, y1, true);
  };
  const move = (ev: MouseEvent) => {
    if (!(ev.buttons & 1)) return stop(false);
    at = { x: ev.clientX, y: ev.clientY };
    if (!box && Math.hypot(at.x - e.clientX, at.y - e.clientY) < 4) return;
    update();
  };
  const scrolled = () => box && update();
  const key = (ev: KeyboardEvent) => {
    if (ev.key !== "Escape") return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    stop(true);
  };
  const up = () => stop(false);
  const end = () => {
    window.removeEventListener("mousemove", move, true);
    window.removeEventListener("mouseup", up, true);
    window.removeEventListener("keydown", key, true);
    window.removeEventListener("scroll", scrolled, true);
    window.removeEventListener("blur", end);
    box?.remove();
  };
  function stop(cancel: boolean) {
    end();
    if (cancel) on.cancel();
    else if (!box && mode === "set") on.click();
  }
  window.addEventListener("mousemove", move, true);
  window.addEventListener("mouseup", up, true);
  window.addEventListener("keydown", key, true);
  window.addEventListener("scroll", scrolled, true);
  window.addEventListener("blur", end);
  return end;
}
