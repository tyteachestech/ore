import type { TutorTurn } from "./Tutor";

/** What the mole says for a reply that landed while the tutor was closed (D159): the reply as plain text, its
 *  citation markers and Markdown dropped (the bubble shows its first lines), or the error. */
export function firstWords(t: Pick<TutorTurn, "reply" | "error">): string {
  if (t.error) return t.error;
  return (t.reply ?? "")
    .replace(/\s?\[\d+\](?!\()/g, "") // citation markers
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links keep their words
    .replace(/^[ \t]*(#{1,6}|>|[-*+]|\d+\.)[ \t]+/gm, "") // headings, quotes, list markers
    .replace(/\*\*|__|`/g, "") // bold, code
    .replace(/(^|[^\w*])\*(?=\S)([^*\n]*?\S)\*(?!\w)/g, "$1$2") // *emphasis*, not a*b
    .replace(/\s+/g, " ")
    .trim();
}

/** The turn whose reply has just landed while the tutor is closed, if any (D159). `asked` keeps the turns still
 *  waiting between calls; a turn that lands while the tutor is open is heard where it lands. */
export function landedClosed(turns: TutorTurn[], asked: Set<string>, open: boolean): TutorTurn | null {
  // A turn no longer in the thread (New chat set it aside) is forgotten: if Undo brings it back landed, he
  // sees it there, not from the mole.
  const ids = new Set(turns.map((t) => t.id));
  for (const id of asked) if (!ids.has(id)) asked.delete(id);
  let landed: TutorTurn | null = null;
  for (const t of turns) {
    if (t.reply === undefined && t.error === undefined) asked.add(t.id);
    else if (asked.delete(t.id) && !open) landed = t;
  }
  return landed;
}
