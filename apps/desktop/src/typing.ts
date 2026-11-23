/** Typing goes only where the focus is. WebKit types into a selection left in a note even while the focus is on
 *  something else (Review, a right-click menu), so a key pressed there replaced his selected note and saved it
 *  (Codex UX sweeps 14 and 15). Text that would land on a field the focus is not in is refused, app-wide. */
export function typeWhereFocused(doc: Document) {
  doc.addEventListener(
    "beforeinput",
    (e) => {
      const at = doc.activeElement;
      const to = e.target instanceof Node ? e.target : null;
      if (!to || !at || at === doc.body) return;
      if (at === to || at.contains(to) || to.contains(at)) return;
      e.preventDefault();
    },
    true,
  );
}
