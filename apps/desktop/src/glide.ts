import { useLayoutEffect, useRef, type RefObject } from "react";

/** What changed between two layouts of a list's rows (row id → its top): the rows that moved and by how much,
 *  the rows that arrived, and how many left. A glide only when a few rows left or a few arrived, not both:
 *  a refilter, a sort or a new tab re-lays the list and must not slide. */
export function glidePlan(before: Map<string, number>, after: Map<string, number>) {
  let removed = 0;
  for (const id of before.keys()) if (!after.has(id)) removed++;
  const added = [...after.keys()].filter((id) => !before.has(id));
  if ((removed === 0) === (added.length === 0) || removed + added.length > 20) return null;
  const moved: [string, number][] = [];
  for (const [id, top] of after) {
    const was = before.get(id);
    if (was !== undefined && was !== top) moved.push([id, was - top]);
  }
  return { moved, added, removed };
}

/** A source that leaves a list closes its gap, and one that comes back (Undo) opens one (D284;
 *  Keyframery's list-cut, Things): the rows below glide to their new places over --t-4, an arriving row rises
 *  8px into view. Only rows in view move; not from the keyboard (data-keys), nor under Reduce Motion, nor
 *  when the view changed (`view`: the tab, skill and filter). */
/** A motion token in ms, and the curve every everyday move uses (DESIGN.md "Motion"). */
const token = (name: string, fallback: number) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || fallback;
const ease = () => getComputedStyle(document.documentElement).getPropertyValue("--ease-out").trim() || "ease-out";

export function useGlide(list: RefObject<HTMLElement | null>, lines: unknown, view: string) {
  const last = useRef<{ view: string; at: Map<string, number> } | null>(null);
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    const rows = el.querySelectorAll<HTMLElement>("[id^='row-']");
    const at = new Map<string, number>();
    for (const r of rows) at.set(r.id, r.offsetTop);
    const prev = last.current;
    last.current = { view, at };
    if (!prev || prev.view !== view || document.documentElement.hasAttribute("data-keys") || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const plan = glidePlan(prev.at, at);
    if (!plan || !rows.length) return;
    // One measure: every row shares an offset parent, so a row's place on screen is its offsetTop plus this.
    const shift = rows[0]!.getBoundingClientRect().top - rows[0]!.offsetTop;
    const box = el.getBoundingClientRect();
    const seen = (id: string) => {
      const top = at.get(id)! + shift;
      return top < box.bottom && top + 120 > box.top;
    };
    for (const [id, dy] of plan.moved) {
      if (!seen(id)) continue;
      document.getElementById(id)?.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: token("--t-4", 300), delay: plan.removed ? 60 : 0, easing: ease(), fill: "backwards" });
    }
    const arriving = plan.added.filter(seen);
    if (!arriving.length) return;
    // A row mounts light first (Lite.tsx) and is redrawn whole a moment later as a new element, so the rise
    // follows it there, carrying on from where it had got to.
    const start = performance.now();
    const rise = (r: Element | null) => {
      if (!r) return;
      const a = r.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: token("--t-3", 200), easing: ease() });
      a.currentTime = performance.now() - start;
    };
    arriving.forEach((id) => rise(document.getElementById(id)));
    const swapped = new MutationObserver(() => arriving.forEach((id) => { const r = document.getElementById(id); if (r && !r.getAnimations().length) rise(r); }));
    swapped.observe(el, { childList: true, subtree: true });
    setTimeout(() => swapped.disconnect(), 200);
  }, [lines, view]);
}
