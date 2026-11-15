/** Whether a scroll area hides rows below its foot. A pixel of slack: fractional sizes never read as more. */
export const moreBelow = (top: number, height: number, full: number): boolean => full - top - height > 1;

/** Keeps `data-more` on a scroll area while rows wait below its foot, so the stylesheet can fade its last row
 *  (`.fade-more`, D281): he sees there is more without a scrollbar. Watches scrolling, the area's
 *  size and its rows coming and going. Returns the cleanup. */
export function watchMore(el: HTMLElement): () => void {
  const set = () => el.toggleAttribute("data-more", moreBelow(el.scrollTop, el.clientHeight, el.scrollHeight));
  // Headless tests run without the observers; scrolling still keeps it right there.
  const size = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(set);
  const rows = typeof MutationObserver === "undefined" ? null : new MutationObserver(set);
  el.classList.add("fade-more");
  el.addEventListener("scroll", set, { passive: true });
  size?.observe(el);
  rows?.observe(el, { childList: true, subtree: true });
  set();
  return () => (el.removeEventListener("scroll", set), size?.disconnect(), rows?.disconnect());
}

/** `watchMore` as a ref: `<div ref={more}>`. */
export const more = (el: HTMLElement | null) => (el ? watchMore(el) : undefined);
