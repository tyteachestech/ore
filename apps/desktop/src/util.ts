import { useEffect, type RefObject } from "react";

/** A toast; `undo` adds an Undo button and puts the step on the app's history (⌘Z), and `redo`,
 *  the step again, lets ⇧⌘Z repeat it after an undo (AGENTS.md: delete acts at once, then offers Undo).
 *  Neither may notify an undo of its own. */
/** `show` adds a Show button that goes to what the toast is about (a source just added).
 *  `quiet`: a small, frequent step (a highlight, a type switch) goes on the history with no toast;
 *  ⌘Z still names it as it takes it back. Every change he makes is a step, toast or not.
 *  Returns `forget`, which takes the step off the history when what it did is gone another way
 *  (a selection he dropped with Esc). */
/** `show`: the toast's one action: Show on a result, Try again on an error. */
export type Notify = (message: string, kind?: "info" | "error" | "progress" | "quiet", undo?: () => void, redo?: () => void, show?: () => void) => () => void;

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
