import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Hint } from "./Hint";
import { MagnifyingGlass } from "./icons";
import { useFocusBack } from "./util";

/** A section's search (D203), Linear's: a magnifying glass in the header that becomes a field. What is
 *  typed narrows the section's rows, best match first. Esc clears it, then closes it; so does leaving it empty. */
export function HeadSearch({ label, value, onChange, open, setOpen, onKeys }: { label: string; value: string; onChange: (v: string) => void; open: boolean; setOpen: (o: boolean) => void; onKeys: (e: ReactKeyboardEvent<HTMLInputElement>) => void }) {
  const button = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const shown = open || !!value;
  useFocusBack(shown, button);
  useEffect(() => {
    if (open) field.current?.focus({ preventScroll: true });
  }, [open]);
  if (!shown)
    return (
      <Hint text={label}>
        <button className="icon-btn" ref={button} aria-label={label} onClick={() => setOpen(true)}>
          <MagnifyingGlass size={14} aria-hidden="true" />
        </button>
      </Hint>
    );
  return (
    <label className="filter head-search">
      <MagnifyingGlass size={13} aria-hidden="true" />
      <input
        ref={field}
        value={value}
        spellCheck={false}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        // Back in the field after ↓ took him to the rows: open again, so Esc clears before it closes.
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            if (value) onChange("");
            else setOpen(false);
          } else onKeys(e);
        }}
      />
    </label>
  );
}
