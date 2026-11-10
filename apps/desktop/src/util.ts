import { useEffect, useRef, useState, type FocusEvent, type RefObject } from "react";

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

/** Focuses `ref` while the component is mounted and hands focus back to whatever had it before
 *  (the sources list, the reader, a field), so closing a panel never strands focus on <body>. A field
 *  the panel's action just focused (Rename from ⌘K) keeps it. */
export function useFocusWhileMounted(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const prev = document.activeElement;
    const panel = ref.current;
    panel?.focus();
    return () => {
      const now = document.activeElement;
      const stranded = !now || now === document.body || !!panel?.contains(now);
      if (stranded && prev instanceof HTMLElement && prev.isConnected) prev.focus({ preventScroll: true });
    };
  }, [ref]);
}

// Whether the last thing he did was a key, not a click: only then does a closing editor move focus.
let byKeys = false;
if (typeof window !== "undefined") {
  window.addEventListener("keydown", () => (byKeys = true), true);
  window.addEventListener("pointerdown", () => (byKeys = false), true);
}

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
