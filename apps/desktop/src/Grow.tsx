import { forwardRef, useLayoutEffect, useRef, useState, type Ref, type TextareaHTMLAttributes } from "react";

/** A text field for answers and notes that wraps and grows with what he types (ChatGPT, Notes), from one line or its
 *  CSS min-height up to its max-height, then scrolls. Callers keep their own keys: Enter submits, ⇧Enter is a new line.
 *  Emptied by the app (a send, a save), it starts over as a new field, focus kept, so ⌘Z and ⇧⌘Z never bring a sent
 *  message back (ChatGPT, Claude): WebKit keeps a cleared field's typing on its undo stack and redoes it into the next
 *  draft. Emptied by him, it stays, so ⌘Z brings back what he deleted. */
export const Grow = forwardRef(function Grow(p: TextareaHTMLAttributes<HTMLTextAreaElement>, ref: Ref<HTMLTextAreaElement>) {
  const own = useRef<HTMLTextAreaElement | null>(null);
  const refocus = useRef(false);
  /** What his own last input left in the field. */
  const typed = useRef(p.value);
  // The value going to "" while his last input left words is the app emptying it: a new field (React's derived state).
  const [fresh, setFresh] = useState(0);
  const [seen, setSeen] = useState(p.value);
  if (p.value !== seen) {
    setSeen(p.value);
    if (p.value === "" && seen && typed.current) setFresh((n) => n + 1);
  }
  useLayoutEffect(() => {
    const el = own.current;
    if (!el) return;
    const fit = () => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`; // border-box: add the borders
    };
    fit();
    // A narrower pane rewraps the text, so refit when the width changes.
    let width = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== width) (width = el.clientWidth), fit();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [p.value, fresh]);
  return (
    <textarea
      rows={1}
      {...p}
      key={fresh}
      className={`grow ${p.className ?? ""}`}
      onChange={(e) => {
        typed.current = e.target.value;
        p.onChange?.(e);
      }}
      ref={(el) => {
        // The field that goes for a new one hands its focus on.
        if (!el) refocus.current = !!own.current && own.current === document.activeElement;
        else if (refocus.current) (refocus.current = false), el !== document.activeElement && el.focus();
        own.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      }}
    />
  );
});
