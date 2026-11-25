import { useRef, useState } from "react";
import { keepKeysIn } from "./keys";

/** Sets a field to its text's width (its CSS min-width holds an empty one open for the placeholder); 1px more keeps the caret after the last letter in view. */
const fitted = (field: HTMLInputElement | null) => {
  if (!field) return;
  field.style.width = "0";
  field.style.width = `${field.scrollWidth + 1}px`;
};

/** A title edited in place (Finder's Rename, Notion's page title), one field for every list and the reader.
 *  (The author's byline too.) Enter or clicking away saves (D211), Esc keeps the old one. The field
 *  stays until the save lands: one that fails leaves what he typed in it, to try again. `onSave` resolves
 *  false when the write failed (and has said why). `onClose(byKey)`: true when Enter or Esc closed it, so
 *  focus goes back to the row; false when he clicked away, and focus stays where he put it. */
export function TitleField({ value, label = "Title", className = "row-rename", placeholder, fit, onSave, onClose }: {
  value: string;
  label?: string;
  className?: string;
  placeholder?: string;
  /** As wide as what it holds, so a name edited in a line of things moves nothing after it until he types. */
  fit?: boolean;
  onSave: (title: string) => Promise<boolean>;
  onClose: (byKey: boolean) => void;
}) {
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  /** He clicked away while it saved: it closes when the save is back, saved or not. */
  const left = useRef(false);
  /** Enter or Esc settled it: the blur their focus move causes (a list taking focus back) saves nothing. */
  const settled = useRef(false);
  /** Saves, then closes; a save that fails leaves what he typed in the field to try again. */
  const commit = (field: HTMLInputElement) => {
    setSaving((busy.current = true));
    void onSave(field.value).then((ok) => {
      // Gone meanwhile (another row is being renamed now): its close is not this one's to call.
      if (!field.isConnected) return;
      setSaving((busy.current = false));
      if (ok) onClose(!left.current);
      else settled.current = false;
    });
  };
  return (
    <input
      className={className}
      aria-label={label}
      placeholder={placeholder}
      ref={fit ? fitted : undefined}
      onInput={fit ? (e) => fitted(e.currentTarget) : undefined}
      autoFocus
      defaultValue={value}
      readOnly={saving}
      data-no-drag
      onFocus={(e) => (busy.current ? (left.current = false) : e.currentTarget.select())}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        keepKeysIn(e); // ⌘Z still reaches the app history
        if (busy.current || e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return;
        if (e.key === "Escape") {
          settled.current = true;
          return onClose(true);
        }
        if (e.key !== "Enter") return;
        // Its keypress would click the row the closed field hands focus back to, opening it (F47).
        e.preventDefault();
        settled.current = true;
        commit(e.currentTarget);
      }}
      // Clicking away saves what he typed (Finder, Notion, Linear); leaving the app doesn't count.
      onBlur={(e) => {
        if (busy.current) left.current = true;
        else if (settled.current || !document.hasFocus()) return;
        else if (e.currentTarget.value === value) onClose(false);
        else (left.current = true), commit(e.currentTarget);
      }}
    />
  );
}
