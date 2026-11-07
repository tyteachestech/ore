/** Whether a right-click there gets the Mac's own menu: text being typed (Cut, Copy, Paste, spelling),
 *  selected text, and the reader's text, whose menu has Look Up and Speak (D83). Everywhere else the
 *  webview's page menu (Reload, AutoFill, Camera) means nothing in an app, so right-click shows our
 *  menu for the thing under it, or nothing, as in Finder and Linear. A link opens through our click
 *  handler, so its native "Open Link" (which would load the page in the window) stays hidden. */
export function nativeMenu(target: EventTarget | null, selection: Selection | null): boolean {
  const el = target && "closest" in (target as object) ? (target as Element) : (target as Node | null)?.parentElement ?? null;
  if (!el) return false;
  // A diagram's preview in a note is an object with its own menu, though the note around it is text.
  if (el.closest(".note-diagram")) return false;
  if (el.closest("input, textarea, [contenteditable]:not([contenteditable=false])")) return true;
  if (selection && !selection.isCollapsed && selection.rangeCount && selection.getRangeAt(0).intersectsNode(el)) return true;
  return !!el.closest(".doc") && !el.closest("a[href]");
}

/** Hides the webview's page menu wherever `nativeMenu` says no and nothing of ours opened. Listens
 *  on the document, after React's handlers, so a menu of ours (which prevents the default) still opens. */
export function suppressPageMenu(doc: Document) {
  doc.addEventListener("contextmenu", (e) => {
    if (!e.defaultPrevented && !nativeMenu(e.target, doc.getSelection())) e.preventDefault();
  });
}
