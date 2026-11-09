import { useRef, useState } from "react";

/** A title edited in place (Finder's Rename, Notion's page title), one field for every list and the reader.
 *  Enter saves and Esc or clicking away keeps the old one (half-typed text is never saved on blur). The field
 *  stays until the save lands: one that fails leaves what he typed in it, to try again. `onSave` resolves
 *  false when the write failed (and has said why); `onClose` puts focus back where it belongs. */
export function TitleField({ value, label = "Title", className = "row-rename", onSave, onClose }: {
  value: string;
  label?: string;
  className?: string;
  onSave: (title: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  return (
    <input
      className={className}
      aria-label={label}
      autoFocus
      defaultValue={value}
      readOnly={saving}
      data-no-drag
      onFocus={(e) => e.currentTarget.select()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (busy.current) return;
        if (e.key === "Escape") onClose();
        if (e.key !== "Enter") return;
        setSaving((busy.current = true));
        void onSave(e.currentTarget.value).then((ok) => (ok ? onClose() : setSaving((busy.current = false))));
      }}
      onBlur={() => busy.current || onClose()}
    />
  );
}
