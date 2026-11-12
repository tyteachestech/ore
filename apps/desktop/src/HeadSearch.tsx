import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react";
import { Hint } from "./Hint";
import { MagnifyingGlass } from "./icons";
import { useFocusBack } from "./util";

type Search = { label: string; value: string; onChange: (v: string) => void; open: boolean; setOpen: (o: boolean) => void; onKeys: (e: ReactKeyboardEvent<HTMLInputElement>) => void };

/** A section's search (D203), Linear's: a magnifying glass in the header that becomes a field. What is
 *  typed narrows the section's rows, best match first. Esc clears it, then closes it; so does leaving it empty. */
export function HeadSearch(s: Search) {
  const button = useRef<HTMLButtonElement>(null);
  const shown = s.open || !!s.value;
  useFocusBack(shown, button);
  if (!shown) return <SearchButton label={s.label} button={button} onClick={() => s.setOpen(true)} />;
  return <SearchField {...s} className="head-search" />;
}

/** The magnifying glass that opens a search; `pressed` while its field shows elsewhere (Collected's row, D219). */
export function SearchButton({ label, button, onClick, pressed }: { label: string; button?: RefObject<HTMLButtonElement | null>; onClick: () => void; pressed?: boolean }) {
  return (
    <Hint text={label}>
      <button className="icon-btn" ref={button} aria-label={label} aria-pressed={pressed} onClick={onClick}>
        <MagnifyingGlass size={14} aria-hidden="true" />
      </button>
    </Hint>
  );
}

/** The search's field, focused when it opens. */
export function SearchField({ label, value, onChange, open, setOpen, onKeys, className }: Search & { className: string }) {
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) field.current?.focus({ preventScroll: true });
  }, [open]);
  return (
    <label className={`filter ${className}`}>
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
