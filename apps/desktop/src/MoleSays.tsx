import { useEffect, useState } from "react";
import { Hint } from "./Hint";
import { still } from "./SideCursor";

/** One letter of the mole's speech, and how long a full line holds before the next. */
export const TYPE_MS = 28, HOLD_MS = 2600;

/** The mole's speech box (D245): a hairline outlined box (D266). His lines, one at a time, typed out letter by
 *  letter in the mono with his block cursor (D186) at the words' end; a full line holds, then the next is typed.
 *  The pointer or the keyboard on the box holds the line. The whole line is in the page from its first letter
 *  (the letters to come are only unseen), so it never rewraps and a reader hears it whole. Under Reduce Motion
 *  a line stands at once and the block doesn't blink. Words only: no icon leads a line (Tyler, 2026-11-14). Children: a small action. */
export function MoleSays({ lines, run = true, className = "", children }: { lines: { text: string; hint?: string }[]; run?: boolean; className?: string; children?: React.ReactNode }) {
  const [at, setAt] = useState(0);
  const [typed, setTyped] = useState(0);
  // The pointer and the keyboard each hold it on their own: leaving with one never lets go for the other.
  const [over, setOver] = useState(false);
  const [within, setWithin] = useState(false);
  const line = lines[at % lines.length];
  const text = line?.text ?? "";
  const n = still() ? text.length : Math.min(typed, text.length);
  const done = n >= text.length;
  useEffect(() => {
    if (!run || done) return;
    // A breath after a sentence's end or a comma, as a game's text box takes.
    const id = setTimeout(() => setTyped(n + 1), /[.,!?]/.test(text[n - 1] ?? "") ? TYPE_MS * 8 : TYPE_MS);
    return () => clearTimeout(id);
  }, [run, done, n, text]);
  useEffect(() => {
    if (!run || !done || over || within || lines.length < 2) return;
    const id = setTimeout(() => (setAt((i) => i + 1), setTyped(0)), HOLD_MS);
    return () => clearTimeout(id);
  // `at`: under Reduce Motion every line is whole at once, so only the turn itself starts the next hold.
  }, [run, done, over, within, lines.length, at]);
  if (!line) return null;
  const words = (
    <p className="says-line" tabIndex={line.hint ? 0 : undefined}>
      {text.slice(0, n)}<i className="says-block" aria-hidden="true" /><span className="says-rest">{text.slice(n)}</span>
    </p>
  );
  return (
    <div className={`says ${className}`} data-typing={done ? undefined : ""} onMouseEnter={() => setOver(true)} onMouseLeave={() => setOver(false)} onFocus={() => setWithin(true)} onBlur={() => setWithin(false)}>
      {line.hint ? <Hint text={line.hint}>{words}</Hint> : words}
      {children}
    </div>
  );
}
