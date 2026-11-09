import { useEffect, useRef } from "react";

/** His answer with the words that earned the key point under the pointer underlined (D141, and Practice feedback, D162): the grader's
 *  quote, found as he wrote it. A quote that isn't there (an edited answer) marks nothing. */
export function Evidence({ answer, quote }: { answer: string; quote: string }) {
  const ref = useRef<HTMLElement>(null);
  const at = quote ? answer.indexOf(quote) : -1;
  // The answer box scrolls past nine lines: bring the words into it, scrolling only that box, so the
  // page never moves the key point out from under the pointer.
  useEffect(() => {
    const m = ref.current, box = m?.parentElement;
    if (!m || !box) return;
    const top = m.offsetTop - box.offsetTop, bottom = top + m.offsetHeight;
    if (top < box.scrollTop) box.scrollTop = top;
    else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = bottom - box.clientHeight;
  }, [quote]);
  if (at < 0) return <>{answer}</>;
  return (
    <>
      {answer.slice(0, at)}
      <mark ref={ref} className="quiz-evidence">{quote}</mark>
      {answer.slice(at + quote.length)}
    </>
  );
}
