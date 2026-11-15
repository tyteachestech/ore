import remend from "remend";

const RULE = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const cells = (row: string) => row.trim().replace(/^\||\|$/g, "").split("|").length;

/** The Markdown of a reply still being written, made whole enough to draw (D-new-mended-stream): open
 *  bold, italic, code and strike marks are closed and a half-written link shows as its words (remend,
 *  Apache-2.0), and a table waits until its header and rule are both in, since until then its pipes and
 *  dashes would show as text. */
export function mend(partial: string): string {
  const lines = partial.split("\n");
  let from = lines.length;
  while (from > 0 && lines[from - 1]!.trimStart().startsWith("|")) from--;
  const table = lines.slice(from);
  const started = table.length > 1 && RULE.test(table[1]!) && cells(table[1]!) === cells(table[0]!);
  const text = table.length && !started ? lines.slice(0, from).concat("").join("\n") : partial;
  return remend(text, { linkMode: "text-only" });
}
