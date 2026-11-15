// Every CSS Custom Highlight the app paints goes through here (Reader, Find).
//
// WebKit, as Tyler's macOS webview ships it, repaints only the new ranges when a highlight is
// replaced or deleted: text a dropped range covered stayed tinted until something else repainted it,
// and clicking it cleared it in chunks (an undone highlight, 2026-11-11). So the blocks under every
// range that leaves are repainted here, by toggling a paint-only style for one frame.

//
// Highlights paint in three layers. WebKit's page crashes when a highlight is set that overlaps one under it and one
// over it at a priority strictly between theirs (a plain page shows it: the same three set in another order paint
// fine): a saved highlight over a code block crashed as it opened, its underline (then 0) between the code's colours
// (-1) and the tint (1); with Find open on a word in the code, a highlight made over it came in between Find (2) and
// the code (Codex sweep 6, review of #440). So a highlight is only ever set as the top layer: what lies over its layer
// is taken off first and set again after it, lowest first.
/** The code's colours, and what his highlights' colours win over: the spoken words, a quiz's evidence. */
export const UNDER = -1;
/** His highlights' tints and the underlines that go with them (the open one, a looked-up word, Listen's sentence),
 *  which set no colour of their own, so the order among them is never seen. */
export const MARKS = 1;
/** Find's matches, over everything, as Safari's are. */
export const OVER = 2;
export type Layer = typeof UNDER | typeof MARKS | typeof OVER;

/** Sets highlight `name` to `ranges` (none deletes it) in `layer`, repainting where a range left. */
export function paint(name: string, ranges: Range[], layer: Layer) {
  const before = CSS.highlights.get(name);
  if (ranges.length) {
    const h = new Highlight(...ranges);
    h.priority = layer;
    const others = [...CSS.highlights].filter(([n]) => n !== name);
    // Only a layer with something both under and over it can crash; the code's colours (the lowest) never do.
    const over = others.some(([, o]) => o.priority < layer) ? others.filter(([, o]) => o.priority > layer).sort(([, a], [, b]) => a.priority - b.priority) : [];
    for (const [n] of over) CSS.highlights.delete(n);
    CSS.highlights.set(name, h);
    for (const [n, o] of over) CSS.highlights.set(n, o);
  } else CSS.highlights.delete(name);
  if (!before) return;
  const now = new Set<AbstractRange>(ranges);
  repaint([...before].filter((r) => !now.has(r)));
}

/** Removes highlight `name` and repaints what it covered. */
export const unpaint = (name: string) => paint(name, [], UNDER);

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
    // In the note editor, the editor's own root: ProseMirror redraws any node inside it whose class
    // changes, so toggling each paragraph Find let go redrew the whole note, seconds per key in a long
    // one (Codex sweep 3). A change on its root it ignores, and the root's repaint covers them.
    el = el?.closest(".ProseMirror") ?? el;
    if (el?.isConnected) blocks.add(el);
  }
  for (const el of blocks) el.classList.add("repaint");
  if (blocks.size) requestAnimationFrame(() => requestAnimationFrame(() => blocks.forEach((el) => el.classList.remove("repaint"))));
}
