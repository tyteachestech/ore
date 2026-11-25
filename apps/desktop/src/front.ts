// A book's front matter (its title page, copyright, contents, dedication): the import marks where it ends
// (`FRONT_END` in core) and the reader folds what is above the mark, under one row, so a book opens on its
// text. Folded text stays on the page, hidden: a highlight, a quoted passage or a link in it opens it; Find looks
// only at what shows, as it does for a folded transcript.

/** Where a book's front matter ends in its text (`FRONT_END` in core). */
export const FRONT_END = "<!-- end of front matter -->";

/** Opens the folded front matter when `n` is in it, so a jump or a link lands on text he can see. */
export function unfold(n: Node | null | undefined): void {
  (n instanceof Element ? n : n?.parentElement)?.closest(".front-body[hidden]")?.dispatchEvent(new Event("unfold", { bubbles: true }));
}
