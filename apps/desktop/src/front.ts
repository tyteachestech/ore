// A book's front matter (its title page, copyright, contents, dedication): the import marks where it ends
// (`FRONT_END` in core) and the reader folds what is above the mark, under one row, so a book opens on its
// text. Folded text stays on the page, hidden: a highlight, a quoted passage or a link in it opens it; Find looks
// only at what shows, as it does for a folded transcript.

/** Where a book's front matter ends in its text (`FRONT_END` in core). */
export const FRONT_END = "<!-- end of front matter -->";

/** Where the front matter ends in a book's text: the mark on a line of its own, as the import writes it, never the
 *  words quoted in an article or a note about Ore's format. -1 for none. */
export function frontEnd(md: string, book: boolean): number {
  return book ? (md.match(/^<!-- end of front matter -->$/m)?.index ?? -1) : -1;
}

/** Opens the folded front matter under `root` when it holds every word of `query`: Find looks only at what shows,
 *  so a search result whose words are there would open the book on nothing. */
export function unfoldFor(root: Element | null | undefined, query: string): void {
  const box = root?.querySelector(".front-body[hidden]");
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const text = box?.textContent?.toLowerCase() ?? "";
  if (box && words.length && words.every((w) => text.includes(w))) unfold(box);
}

/** Opens the folded front matter when `n` is in it, so a jump or a link lands on text he can see. */
export function unfold(n: Node | null | undefined): void {
  (n instanceof Element ? n : n?.parentElement)?.closest(".front-body[hidden]")?.dispatchEvent(new Event("unfold", { bubbles: true }));
}
