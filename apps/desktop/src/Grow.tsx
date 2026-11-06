import { forwardRef, useLayoutEffect, useRef, type Ref, type TextareaHTMLAttributes } from "react";

/** A text field for answers and notes that wraps and grows with what he types (ChatGPT, Notes), from one line or its
 *  CSS min-height up to its max-height, then scrolls. Callers keep their own keys: Enter submits, ⇧Enter is a new line. */
export const Grow = forwardRef(function Grow(p: TextareaHTMLAttributes<HTMLTextAreaElement>, ref: Ref<HTMLTextAreaElement>) {
  const own = useRef<HTMLTextAreaElement | null>(null);
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
  }, [p.value]);
  return (
    <textarea
      rows={1}
      {...p}
      className={`grow ${p.className ?? ""}`}
      ref={(el) => {
        own.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      }}
    />
  );
});
