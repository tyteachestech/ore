import { useRef, useState } from "react";

/** A title edited in place (Finder's Rename, Notion's page title), one field for every list and the reader.
 *  Enter saves and Esc or clicking away keeps the old one (half-typed text is never saved on blur). The field
 *  stays until the save lands: one that fails leaves what he typed in it, to try again. `onSave` resolves
 *  false when the write failed (and has said why). `onClose(byKey)`: true when Enter or Esc closed it, so
 *  focus goes back to the row; false when he clicked away, and focus stays where he put it. */
export function TitleField({ value, label = "Title", className = "row-rename", onSave, onClose }: {
  value: string;
  label?: string;
  className?: string;
  onSave: (title: string) => Promise<boolean>;
  onClose: (byKey: boolean) => void;
}) {
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  /** He clicked away while it saved: it closes when the save is back, saved or not. */
  const left = useRef(false);
  return (
    <input
      className={className}
      aria-label={label}
      autoFocus
      defaultValue={value}
      readOnly={saving}
      data-no-drag
      onFocus={(e) => (busy.current ? (left.current = false) : e.currentTarget.select())}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (busy.current) return;
        if (e.key === "Escape") onClose(true);
        if (e.key !== "Enter") return;
        setSaving((busy.current = true));
        void onSave(e.currentTarget.value).then((ok) => {
          setSaving((busy.current = false));
          if (ok || left.current) onClose(!left.current);
        });
      }}
      onBlur={() => (busy.current ? (left.current = true) : onClose(false))}
    />
  );
}
