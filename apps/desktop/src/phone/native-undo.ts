// The iPhone's own ways to undo (F161, Tyler 2026-11-14: "for iOS use shake and 3 finger swipe"): shake for
// Undo and Redo, a three-finger swipe left to undo and right to redo, as in Notes and Mail. UIKit asks the
// first responder's undo manager; the shell (apps/phone/ios/Undo.swift) answers with one that mirrors this
// window's history, so the gestures name and take back the same steps ⌘Z does. In a text field or the note,
// the field's own undo answers.
import { useEffect } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { History } from "../history";
import { callsOut, outChanged } from "../ore";

// Where he types: a checkbox, a radio or a slider has no typing to undo, so the app's steps stay in reach there.
const editing = (el: Element | null) =>
  !!el && ((el as HTMLElement).isContentEditable || el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && !/^(checkbox|radio|range|button|submit|reset|color|file)$/.test((el as HTMLInputElement).type)));

export function useNativeUndo(history: History, undo: () => void, redo: () => void): void {
  useEffect(() => {
    if (!isTauri()) return;
    const w = window as unknown as { __oreUndo?: () => void; __oreRedo?: () => void };
    // As the keys: Review holds a ⌘Z while a rating or a retire is still being written, and takes it once it lands
    // (Codex UX sweep 3: the shake skipped that and took back the step before).
    const key = (shiftKey: boolean, run: () => void) => () => {
      const e = new KeyboardEvent("keydown", { key: "z", code: "KeyZ", metaKey: true, shiftKey, bubbles: true, cancelable: true });
      (document.activeElement ?? document.body).dispatchEvent(e);
      if (!e.defaultPrevented) run();
    };
    w.__oreUndo = key(false, undo);
    w.__oreRedo = key(true, redo);
    let last = "";
    const report = () => {
      // A change still being written is what the shake would take back (it waits for it): it has no name yet.
      const state = { undo: callsOut() ? "Last Change" : (history.undoName ?? null), redo: history.redoName ?? null, field: editing(document.activeElement) };
      const now = JSON.stringify(state);
      if (now === last) return;
      last = now;
      void invoke("undo_state", state).catch(() => {});
    };
    // Focus moves before the next one is in (focusout, then focusin): read it once it has settled.
    const later = () => void setTimeout(report, 0);
    history.onChange = report;
    outChanged.add(report);
    document.addEventListener("focusin", report);
    document.addEventListener("focusout", later);
    report();
    return () => {
      if (history.onChange === report) history.onChange = undefined;
      outChanged.delete(report);
      document.removeEventListener("focusin", report);
      document.removeEventListener("focusout", later);
    };
  }, [history, undo, redo]);
}
