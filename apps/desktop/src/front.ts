// A book's front matter (its title page, copyright, contents, dedication): the import marks where it ends
// (`FRONT_END` in core) and the reader folds what is above the mark, under one row, so a book opens on its
// text. Its back matter (also by, about the author, a newsletter page) folds the same way, below `BACK_START`. Folded text stays on the page, hidden: a highlight, a quoted passage or a link in it opens it; Find looks
// only at what shows, as it does for a folded transcript.

/** Where a book's front matter ends in its text (`FRONT_END` in core). */
export const FRONT_END = "<!-- end of front matter -->";

/** Where the front matter ends in a book's text: the mark on a line of its own, as the import writes it, never the
 *  words quoted in an article or a note about Ore's format. -1 for none. */
export function frontEnd(md: string, book: boolean): number {
  return book ? (md.match(/^<!-- end of front matter -->$/m)?.index ?? -1) : -1;
}

/** Where a book's back matter starts (`BACK_START` in core: also by, about the author, the publisher's last pages),
 *  found the same way. -1 for none. */
export function backStart(md: string, book: boolean): number {
  return book ? (md.match(/^<!-- back matter -->$/m)?.index ?? -1) : -1;
}

/** Opens the folded front or back matter under `root` that holds every word of `query`, when the text that shows
 *  does not: Find looks only at what shows, so a search result whose words are only there would open the book on
 *  nothing. A hit in the chapters leaves them shut, though the publisher's pages name the author too. */
export function unfoldFor(root: Element | null | undefined, query: string): void {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const boxes = [...(root?.querySelectorAll(".front-body[hidden]") ?? [])];
  if (!root || !words.length || !boxes.length) return;
  const holds = (text: string) => words.every((w) => text.includes(w));
  if (holds([...root.children].filter((c) => !c.matches(".front-matter")).map((c) => c.textContent ?? "").join(" ").toLowerCase())) return;
  for (const box of boxes) if (holds(box.textContent?.toLowerCase() ?? "")) unfold(box);
}

/** Opens the folded front matter when `n` is in it, so a jump or a link lands on text he can see. */
export function unfold(n: Node | null | undefined): void {
  (n instanceof Element ? n : n?.parentElement)?.closest(".front-body[hidden]")?.dispatchEvent(new Event("unfold", { bubbles: true }));
}
