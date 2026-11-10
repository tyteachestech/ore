import { forwardRef, useLayoutEffect, useRef, type Ref, type TextareaHTMLAttributes } from "react";

/** A text field for answers and notes that wraps and grows with what he types (ChatGPT, Notes), from one line or its
 *  CSS min-height up to its max-height, then scrolls. Callers keep their own keys: Enter submits, ⇧Enter is a new line.
 *  `history`: a new value starts the field over with an empty undo history, focus kept. A field emptied by a send
 *  bumps it, so ⌘Z and ⇧⌘Z never bring a sent message back (ChatGPT, Claude): WebKit keeps a cleared field's
 *  typing on its undo stack, and redoing it there puts the sent text into the next draft. */
export const Grow = forwardRef(function Grow({ history, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement> & { history?: number }, ref: Ref<HTMLTextAreaElement>) {
  const own = useRef<HTMLTextAreaElement | null>(null);
  const refocus = useRef(false);
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
  }, [p.value, history]);
  return (
    <textarea
      rows={1}
      {...p}
      key={history}
      className={`grow ${p.className ?? ""}`}
      ref={(el) => {
        // The field that goes for a new one (a new `history`) hands its focus on.
        if (!el) refocus.current = !!own.current && own.current === document.activeElement;
        else if (refocus.current) (refocus.current = false), el !== document.activeElement && el.focus();
        own.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      }}
    />
  );
});
