// Every CSS Custom Highlight the app paints goes through here (Reader, Find).
//
// WebKit, as Tyler's macOS webview ships it, repaints only the new ranges when a highlight is
// replaced or deleted: text a dropped range covered stayed tinted until something else repainted it,
// and clicking it cleared it in chunks (an undone highlight, 2026-11-11). So the blocks under every
// range that leaves are repainted here, by toggling a paint-only style for one frame.

/** Sets highlight `name` to `ranges` (none deletes it), repainting where a range left. */
export function paint(name: string, ranges: Range[], priority = 0) {
  const before = CSS.highlights.get(name);
  if (ranges.length) {
    const h = new Highlight(...ranges);
    h.priority = priority;
    CSS.highlights.set(name, h);
  } else CSS.highlights.delete(name);
  if (!before) return;
  const now = new Set<AbstractRange>(ranges);
  repaint([...before].filter((r) => !now.has(r)));
}

/** Removes highlight `name` and repaints what it covered. */
export const unpaint = (name: string) => paint(name, []);

/** Removes every highlight, repainting each (the reader closing). */
export function unpaintAll() {
  for (const name of [...CSS.highlights.keys()]) unpaint(name);
}

function repaint(gone: AbstractRange[]) {
  const blocks = new Set<Element>();
  for (const r of gone) {
    const n = r instanceof Range ? r.commonAncestorContainer : r.startContainer;
    let el = n instanceof Element ? n : n.parentElement;
    // The block, not an inline in it: a highlight's tint can reach past an inline's own box.
    while (el?.parentElement && /^(inline|contents|$)/.test(getComputedStyle(el).display)) el = el.parentElement;
    if (el?.isConnected) blocks.add(el);
  }
  for (const el of blocks) el.classList.add("repaint");
  if (blocks.size) requestAnimationFrame(() => requestAnimationFrame(() => blocks.forEach((el) => el.classList.remove("repaint"))));
}
