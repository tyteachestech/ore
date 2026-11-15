/** The pill of a segmented control glides from the old choice to the new one when he clicks (D-new-pill-glide),
 *  as Linear's and Raycast's segmented controls do. Only for a click: a key press, or a change made elsewhere,
 *  lands at once (keys never animate, D185). A ghost of the pill moves; the real one shows once it lands. */
const GROUP = ".seg, .side-tabs";
const ITEM = ":is(.seg-item, .side-tabs button)";
const ON = `${ITEM}:is([data-state="on"], [aria-selected="true"])`;

let from: { group: Element; on: Element; rect: DOMRect } | null = null;

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function glide(group: Element, was: { on: Element; rect: DOMRect }) {
  const now = group.querySelector(ON);
  if (!now || now === was.on || !(group instanceof HTMLElement) || !(now instanceof HTMLElement)) return;
  const box = group.getBoundingClientRect();
  const end = now.getBoundingClientRect();
  const look = getComputedStyle(now);
  const ghost = document.createElement("span");
  ghost.className = "seg-ghost";
  ghost.setAttribute("aria-hidden", "true");
  Object.assign(ghost.style, {
    top: `${end.top - box.top - group.clientTop}px`,
    height: `${end.height}px`,
    background: look.backgroundColor,
    boxShadow: look.boxShadow,
    borderRadius: look.borderRadius,
  });
  group.append(ghost);
  now.classList.add("seg-landing");
  const left = (r: DOMRect) => `${r.left - box.left - group.clientLeft}px`;
  const run = ghost.animate(
    [
      { left: left(was.rect), width: `${was.rect.width}px` },
      { left: left(end), width: `${end.width}px` },
    ],
    { duration: parseFloat(css("--t-2")) || 150, easing: css("--ease-in-out") || "ease-in-out" },
  );
  const done = () => {
    ghost.remove();
    now.classList.remove("seg-landing");
  };
  run.onfinish = done;
  run.oncancel = done;
}

/** Listens once for the whole app: a press on an item notes where the pill was; after the click it glides. */
export function installGlide() {
  document.addEventListener(
    "pointerdown",
    (e) => {
      const item = (e.target as Element).closest?.(ITEM);
      const group = item?.closest(GROUP);
      const on = group?.querySelector(ON);
      from = group && on && on !== item ? { group, on, rect: on.getBoundingClientRect() } : null;
    },
    true,
  );
  document.addEventListener("click", (e) => {
    const was = from;
    from = null;
    // detail 0 is a click made by Enter or Space: those land at once.
    if (!was || e.detail === 0 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!(e.target as Element).closest?.(GROUP)) return;
    requestAnimationFrame(() => glide(was.group, was));
  });
}
