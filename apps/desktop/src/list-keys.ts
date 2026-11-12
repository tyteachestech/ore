/** A Markdown list typed in a plain text field (a highlight's note), kept going as in Claude's and ChatGPT's chat
 *  boxes: on a line that starts "- ", "* " or "1. ", a new line starts the next item ("2. " after "1. "); on an
 *  item with nothing after its marker it ends the list instead, leaving the line empty. The marker stays as typed,
 *  so the note is plain Markdown. Returns the edit to make, or null where a new line is just a new line. */
export function listBreak(value: string, start: number, end = start): { from: number; to: number; text: string } | null {
  if (start !== end) return null;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const nl = value.indexOf("\n", start);
  const line = value.slice(lineStart, nl < 0 ? value.length : nl);
  const m = /^(\s*)(?:([-*])|(\d{1,9})([.)]))( +)/.exec(line);
  if (!m || start < lineStart + m[0].length) return null;
  if (!line.slice(m[0].length).trim()) return { from: lineStart, to: lineStart + line.length, text: "" };
  const marker = m[2] ?? `${Number(m[3]) + 1}${m[4]}`;
  return { from: start, to: start, text: `\n${m[1]}${marker}${m[5]}` };
}

/** Makes `listBreak`'s edit in the field as typing would, so ⌘Z takes it back, or returns false when there is none. */
export function breakList(el: HTMLTextAreaElement) {
  const edit = listBreak(el.value, el.selectionStart, el.selectionEnd);
  if (!edit) return false;
  el.setSelectionRange(edit.from, edit.to);
  // execCommand keeps WebKit's undo stack and fires the input event React listens for.
  if (!document.execCommand(edit.text ? "insertText" : "delete", false, edit.text)) {
    el.setRangeText(edit.text, edit.from, edit.to, "end");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  return true;
}
