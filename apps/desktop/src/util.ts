import { listen } from "@tauri-apps/api/event";
import { useEffect, useLayoutEffect, useRef, useState, type FocusEvent, type RefObject } from "react";

/** A toast; `undo` adds an Undo button and puts the step on the app's history (⌘Z), and `redo`,
 *  the step again, lets ⇧⌘Z repeat it after an undo (AGENTS.md: delete acts at once, then offers Undo).
 *  Neither may notify an undo of its own. */
/** `show` adds a Show button that goes to what the toast is about (a source just added).
 *  `quiet`: a small, frequent step (a highlight, a type switch) goes on the history with no toast;
 *  ⌘Z still names it as it takes it back. Every change he makes is a step, toast or not.
 *  Returns `forget`, which takes the step off the history when what it did is gone another way
 *  (a selection he dropped with Esc). */
/** `show`: the toast's one action: Show on a result, Try again on an error. */
/** `stay`: an error toast that stays until its Try again is pressed or its × dismisses it, for a failure only that toast can recover. */
/** `slot`: one toast at a time for it; a new one takes the place of the one showing (a retry that failed again). */
export type Notify = (message: string, kind?: "info" | "error" | "progress" | "quiet", undo?: () => Promise<unknown>, redo?: () => Promise<unknown>, show?: () => void, stay?: boolean, slot?: string) => Forget;
/** What `notify` returns: call it to take the step off the history; `undo()` takes the step back as ⌘Z would
 *  (a screen's own Undo button), so it can be redone and a failure is reported the same way. */
export type Forget = (() => void) & { undo: () => void };

/** What went wrong, in words he can act on. A JS fault (usually an empty or malformed AI reply) never
 *  reaches the UI as "Cannot read properties of null". */
export const errorText = (e: unknown, action?: string) =>
  e instanceof TypeError || e instanceof SyntaxError
    ? `${action ? `Couldn’t ${action}: g` : "G"}ot an unexpected reply. Try again, or carry on without it.`
    : e instanceof Error
      ? e.message
      : String(e);

// localStorage holds only per-viewer conveniences (scroll positions, recent sources); it can throw or be empty.
export function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore: losing a scroll position is harmless
  }
}

/** A draft lasts a day: today's session is the slice it was typed in (D65); tomorrow it is asked anew. */
export const DRAFT_MS = 24 * 3600_000;

/** What he typed and hasn't sent, by id, kept in localStorage under `key`: an app quit, or iOS ending a web view left
 *  in the background, never loses it (daily-session.md: nothing is lost when a session is cut short; Notes). Each
 *  lasts DRAFT_MS from its last change (`at`). Written a moment after the last change, and at once (flushKept) as
 *  the page is hidden or goes, or the app quits (the shell's "quitting" event: ⌘Q sends the page neither). Each write
 *  puts only its own changes over what is stored, so another window (the quick quiz) keeps its own. */
export type Kept<V> = { get(id: string): V | undefined; at(id: string): number | undefined; set(id: string, v: V): void; delete(id: string): void };
type Stamped<V> = { v: V; at: number };
const flushers = new Set<() => void>();
/** Writes every kept draft now. */
export const flushKept = () => flushers.forEach((f) => f());
if (typeof window !== "undefined") {
  addEventListener("pagehide", flushKept);
  addEventListener("beforeunload", flushKept);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flushKept());
  if ("__TAURI_INTERNALS__" in window) void listen("quitting", flushKept).catch(() => {});
}
export function kept<V>(key: string): Kept<V> {
  const fresh = (e: Stamped<V>) => Date.now() - e.at <= DRAFT_MS;
  const read = (): Map<string, Stamped<V>> => {
    try {
      const rows = JSON.parse(load(key) ?? "[]") as [string, Record<string, unknown>][];
      const out = new Map<string, Stamped<V>>();
      for (const [id, e] of rows) {
        if (!e || typeof e.at !== "number") continue;
        if ("v" in e) out.set(id, e as unknown as Stamped<V>);
        else {
          // Written before rows were stamped: the draft with its own `at` beside its fields.
          const { at, ...v } = e;
          out.set(id, { v: v as V, at: at as number });
        }
      }
      return out;
    } catch {
      return new Map();
    }
  };
  let m = read();
  const mine = new Set<string>();
  let later = 0;
  const flush = () => {
    clearTimeout(later);
    if (!mine.size) return;
    const now = read();
    for (const id of mine) {
      const e = m.get(id);
      if (e) now.set(id, e);
      else now.delete(id);
    }
    mine.clear();
    for (const [id, e] of now) if (!fresh(e)) now.delete(id);
    save(key, JSON.stringify([...now]));
    m = now;
  };
  flushers.add(flush);
  const changed = (id: string) => {
    mine.add(id);
    clearTimeout(later);
    later = window.setTimeout(flush, 300);
  };
  // Another window wrote: take its drafts, keeping ours not yet written.
  addEventListener("storage", (e: StorageEvent) => {
    if (e.key !== key) return;
    const now = read();
    for (const id of mine) {
      const own = m.get(id);
      if (own) now.set(id, own);
      else now.delete(id);
    }
    m = now;
  });
  const live = (id: string) => {
    const e = m.get(id);
    return e && fresh(e) ? e : undefined;
  };
  return {
    get: (id) => live(id)?.v,
    at: (id) => live(id)?.at,
    set: (id, v) => (m.set(id, { v, at: Date.now() }), changed(id)),
    delete: (id) => void (m.delete(id) && changed(id)),
  };
}

/** How far each list was scrolled, by tab, skill page or "home": one map in localStorage for the app, as every
 *  remembered view is (the app opens one library; another is a developer's ORE_LIBRARY). */
export function keptScrolls(): Record<string, number> {
  try {
    const v = JSON.parse(load("ore.list-scroll") ?? "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}
export const keepScroll = (key: string, top: number) => save("ore.list-scroll", JSON.stringify({ ...keptScrolls(), [key]: Math.round(top) }));

/** Keeps where `ref` was scrolled, under `key` in `keptScrolls` (Finder, Linear): back on the screen, or after a
 *  relaunch, he is where he left it. What it holds may load or grow after it shows (rows, then their pictures),
 *  so the place is put back as the content grows, until it is reached or he scrolls himself (3 s at most); until
 *  then a scroll is ours and isn't kept. Written a moment after he stops scrolling, and as the screen closes. */
export function useKeptScroll(ref: RefObject<HTMLElement | null>, key: string): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const want = keptScrolls()[key] ?? 0;
    let pending = want > 0;
    const put = () => {
      if (!pending) return;
      el.scrollTop = want;
      if (el.scrollTop >= want - 1) stop();
    };
    // New rows (a mutation) and rows that grow (a picture loading, a ResizeObserver on each) both make room.
    const sized = new ResizeObserver(put);
    const watch = () => {
      for (const c of el.children) sized.observe(c);
    };
    const grows = new MutationObserver(() => (watch(), put()));
    const stop = () => {
      pending = false;
      grows.disconnect();
      sized.disconnect();
    };
    // No place kept: the top, not where the scroller was for another key (the phone's lists share one).
    if (!pending) el.scrollTop = 0;
    put();
    if (pending) (grows.observe(el, { childList: true, subtree: true }), watch());
    const giveUp = window.setTimeout(stop, 3000);
    let at: number | null = null;
    let later = 0;
    const write = () => (clearTimeout(later), at !== null && keepScroll(key, at), (at = null));
    const on = () => {
      if (pending) return;
      at = el.scrollTop;
      clearTimeout(later);
      later = window.setTimeout(write, 250);
    };
    const mine = { passive: true } as const;
    el.addEventListener("scroll", on, mine);
    for (const t of ["wheel", "pointerdown", "keydown", "touchstart"]) el.addEventListener(t, stop, mine);
    addEventListener("pagehide", write);
    return () => {
      write();
      stop();
      clearTimeout(giveUp);
      removeEventListener("pagehide", write);
      el.removeEventListener("scroll", on);
      for (const t of ["wheel", "pointerdown", "keydown", "touchstart"]) el.removeEventListener(t, stop);
    };
  }, [ref, key]);
}

/** Focuses `ref` while the component is mounted and hands focus back to whatever had it before
 *  (the sources list, the reader, a field), so closing a panel never strands focus on <body>. A field
 *  the panel's action just focused (Rename from ⌘K) keeps it. When what opened it is gone (a sheet that
 *  opened it has closed) or nothing had focus, `fallback` names the screen's own place for the keyboard (a
 *  layer with one says so in its markup, `data-gives-back`, for the e2e guard). `on` false: none of this (the phone). */
export function useFocusWhileMounted(ref: RefObject<HTMLElement | null>, fallback?: () => HTMLElement | null | undefined, on = true): void {
  // Read as it first renders: by its effect a field's autoFocus has already taken focus (the Add box's), and
  // the control that opened it was lost.
  const [prev] = useState(() => document.activeElement);
  const back = useRef(fallback);
  back.current = fallback;
  useEffect(() => {
    if (!on) return;
    const panel = ref.current;
    panel?.focus();
    return () => {
      const now = document.activeElement;
      const stranded = !now || now === document.body || !!panel?.contains(now);
      if (!stranded) return;
      const opener = prev instanceof HTMLElement && prev !== document.body && !panel?.contains(prev) ? prev : null;
      settleFocus(() => (opener && usable(opener) ? opener : back.current?.()));
    };
  }, [ref, prev, on]);
}

/** Can take focus and be seen: on the page, laid out, not disabled, hidden or inert. */
export const usable = (el: Element | null | undefined): el is HTMLElement =>
  el instanceof HTMLElement && el.isConnected && el.getClientRects().length > 0 && !el.matches(":disabled") && !el.closest("[hidden], [inert]");

/** Puts focus on what `pick` names, and again if that goes within `ms` with focus left on <body> (Home's Start
 *  review leaves when the review just done cleared what was due), each time on what `pick` names then. Ends at
 *  the first press, key or focus elsewhere, or after `ms`. */
export function settleFocus(pick: () => HTMLElement | null | undefined, ms = 2000): void {
  let placed: HTMLElement | null = null;
  const place = () => {
    const to = pick();
    if (!usable(to)) return;
    placed = to;
    focusQuietly(to);
  };
  place();
  if (typeof MutationObserver === "undefined") return;
  const seen = new MutationObserver(() => {
    if (placed && !placed.isConnected && (!document.activeElement || document.activeElement === document.body)) place();
  });
  const stop = () => {
    seen.disconnect();
    clearTimeout(limit);
    removeEventListener("pointerdown", stop, true);
    removeEventListener("keydown", stop, true);
    removeEventListener("focusin", away, true);
  };
  const away = (e: Event) => void (e.target !== placed && stop());
  const limit = setTimeout(stop, ms);
  seen.observe(document.body, { childList: true, subtree: true });
  addEventListener("pointerdown", stop, true);
  addEventListener("keydown", stop, true);
  addEventListener("focusin", away, true);
}

/** Focuses `el` without the keyboard ring unless the keyboard did what led here ("nothing highlighted until the
 *  keyboard moves"): a control focused after a click shows nothing. */
export function focusQuietly(el: HTMLElement): void {
  el.focus({ preventScroll: true, focusVisible: byKeys } as FocusOptions);
}

// Whether the last thing he did was a key, not a click: only then does a closing editor move focus.
let byKeys = false;
if (typeof window !== "undefined") {
  window.addEventListener("keydown", () => (byKeys = true), true);
  window.addEventListener("pointerdown", () => (byKeys = false), true);
}
/** Whether the last thing he did was a key, not a click or a tap. */
export const typedLast = () => byKeys;

/** When an in-place editor (the author, a skill's goal, a new question) closes from the keyboard,
 *  Enter or Esc, focus goes back to the button that opened it, so the next Tab carries on from there
 *  rather than from the top of the window. The button and the field often swap, so `ref` points at
 *  the button rendered after it closes; `fallback` takes it when that button is gone (an author just
 *  cleared). A click away leaves focus where the click put it. */
export function useFocusBack(editing: boolean, ref: RefObject<HTMLElement | null>, fallback?: RefObject<HTMLElement | null>): void {
  const was = useRef(editing);
  useEffect(() => {
    const closed = was.current && !editing && byKeys;
    was.current = editing;
    if (!closed) return;
    // After the key's own events: a button focused during Enter's keydown would take its keypress as a click and open the field again.
    const t = setTimeout(() => {
      if (!document.activeElement || document.activeElement === document.body) (ref.current ?? fallback?.current)?.focus({ preventScroll: true });
    });
    return () => clearTimeout(t);
  }, [editing, ref, fallback]);
}

const writing = new Map<string, Promise<unknown>>();
/** Runs `write` after the writes already started for `key` (a source's id), so quick edits and their
 *  ⌘Z and ⇧⌘Z land in the order he made them, each in its own `ore` process. A failed write doesn't
 *  stop the next one. */
export function inOrder<T>(key: string, write: () => Promise<T>): Promise<T> {
  const next = (writing.get(key) ?? Promise.resolve()).then(write, write);
  const done = next.catch(() => {});
  writing.set(key, done);
  void done.then(() => writing.get(key) === done && writing.delete(key));
  return next;
}

/** A radio row's onFocus (How sure): Tab or ⇧Tab into it lands on the one picked, as a Mac radio group's
 *  does, not on the last one the keys or a click passed over. With none picked it lands on the first if
 *  the row itself took focus: Radix leaves it there after a click on the one already focused (it reads
 *  that click as the row's own), and the row can't be seen focused or answer ← →. */
export const focusPicked = (e: FocusEvent<HTMLElement>) => {
  if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
  const row = e.currentTarget;
  const to = row.querySelector<HTMLElement>('[aria-checked="true"]') ?? (e.target === row ? row.querySelector<HTMLElement>('[role="radio"]') : null);
  if (to && to !== e.target) to.focus();
};

/** ⌘Z and ⇧⌘Z run a step made by whatever screen was open then. That screen updates what it shows itself,
 *  but it may since have closed and opened again as a new copy that never hears of it (Settings, a reader,
 *  Feed, a skill page). So a step that lands wakes the screens opened after it was made, and only those:
 *  each loads its own copy of the library's data again. The one that made the step is left alone, so a
 *  reload never lands over an edit he makes right after. */
let clock = 0;
const made = new WeakMap<object, number>();
const screens = new Map<() => void, number>();
export const stepMade = (step: object) => void made.set(step, ++clock);
export const stepLanded = (step: object) => {
  const at = made.get(step) ?? 0;
  for (const [wake, since] of screens) if (since > at) wake();
};
/** A write he starts now that lands later (a highlight, its type or note): call it at his action, before any wait,
 *  and pass it the write; screens opened from that moment read again once it lands, as after a step. */
export function wakeOnLanding(): (write: Promise<unknown>) => void {
  const token = {};
  stepMade(token);
  return (write) => void write.then(() => stepLanded(token), () => {});
}

/** `run` once at a time: a call while one is still going gets that one's promise and starts nothing, so a screen
 *  read again mid-way (a wake) never starts a second slow job (a feed refresh). */
export function singleFlight<T>(run: () => Promise<T>): () => Promise<T> {
  let going: Promise<T> | null = null;
  return () => (going ??= run().finally(() => (going = null)));
}

/** Changes when a step made before this screen opened lands: a dependency of the effect that loads its data. */
export function useLibraryChanges(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const wake = () => setN((x) => x + 1);
    screens.set(wake, ++clock);
    return () => void screens.delete(wake);
  }, []);
  return n;
}

/** A progress bar in words (the finish quiz's): the step he is on, never one past the last once every step is done. */
export const stepLabel = (segments: string[]) => `Step ${Math.min(segments.filter((s) => s === "done").length + 1, segments.length)} of ${segments.length}`;

/** A number with its thing, singular for one: "1 lesson", "1,200 words". */
export const count = (n: number, one: string) => `${n.toLocaleString()} ${one}${n === 1 ? "" : "s"}`;
