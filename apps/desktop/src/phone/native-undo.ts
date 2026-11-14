// The iPhone's own ways to undo (F161, Tyler 2026-11-14: "for iOS use shake and 3 finger swipe"): shake for
// Undo and Redo, a three-finger swipe left to undo and right to redo, as in Notes and Mail. UIKit asks the
// first responder's undo manager; the shell (apps/phone/ios/Undo.swift) answers with one that mirrors this
// window's history, so the gestures name and take back the same steps ⌘Z does. Typing in a field keeps the
// field's own undo, as `ownsUndo` does for ⌘Z.
import { useEffect } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { History } from "../history";

const editing = (el: Element | null) => !!el && ((el as HTMLElement).isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA");

export function useNativeUndo(history: History, undo: () => void, redo: () => void): void {
  useEffect(() => {
    if (!isTauri()) return;
    const w = window as unknown as { __oreUndo?: () => void; __oreRedo?: () => void };
    w.__oreUndo = undo;
    w.__oreRedo = redo;
    let last = "";
    const report = () => {
      const state = { undo: history.undoName ?? null, redo: history.redoName ?? null, field: editing(document.activeElement) };
      const now = JSON.stringify(state);
      if (now === last) return;
      last = now;
      void invoke("undo_state", state).catch(() => {});
    };
    // Focus moves before the next one is in (focusout, then focusin): read it once it has settled.
    const later = () => void setTimeout(report, 0);
    history.onChange = report;
    document.addEventListener("focusin", report);
    document.addEventListener("focusout", later);
    report();
    return () => {
      if (history.onChange === report) history.onChange = undefined;
      document.removeEventListener("focusin", report);
      document.removeEventListener("focusout", later);
    };
  }, [history, undo, redo]);
}
