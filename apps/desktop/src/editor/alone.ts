import type { Node as PMNode } from "@milkdown/kit/prose/model";
import { type EditorState, Plugin, TextSelection, type Transaction } from "@milkdown/kit/prose/state";
import { canSplit } from "@milkdown/kit/prose/transform";
import { $prose } from "@milkdown/kit/utils";

// A diagram or image is a block of its own, as in Notion (D187). Markdown lets one share a line with
// words, and the caret can sit beside one, so text typed there (or a diagram made on a line with words)
// used to join it in one block: one handle for both, and no way to move or delete either alone.

/** The next change that puts an image alone on its line: a split beside it, or the line break or spaces beside it taken out. */
function next(doc: PMNode): ((tr: Transaction) => void) | null {
  let fix: ((tr: Transaction) => void) | null = null;
  doc.descendants((p, pos) => {
    if (fix) return false;
    if (p.type.name !== "paragraph") return true;
    if (p.childCount < 2) return false;
    let at = pos + 1;
    for (let i = 0; i < p.childCount; at += p.child(i++).nodeSize) {
      if (p.child(i).type.name !== "image") continue;
      // What is beside it: the words before, or (for an image that leads the line) what comes after.
      const side = i > 0 ? p.child(i - 1) : p.child(1);
      const cut = i > 0 ? at : at + 1;
      // The line break or spaces that kept it apart from the words go, not onto a line of their own.
      const gap = side.type.name === "hardbreak" ? side.nodeSize : side.isText ? side.text!.match(i > 0 ? /\s+$/ : /^\s+/)?.[0].length ?? 0 : 0;
      if (gap) {
        const from = i > 0 ? at - gap : cut;
        fix = (tr) => void tr.delete(from, from + gap);
      } else if (canSplit(doc, cut)) fix = (tr) => void tr.split(cut);
      else continue;
      break;
    }
    return false;
  });
  return fix;
}

/** Every image and diagram that shares a line with something moves to a line of its own; null when all do. */
export function imagesAlone(state: EditorState): Transaction | null {
  const tr = state.tr;
  for (let fix = next(tr.doc), n = 0; fix && n < 1000; fix = next(tr.doc), n++) fix(tr);
  if (!tr.docChanged) return null;
  // The caret stays with the words he is typing, not on the image's line after them.
  const s = state.selection;
  if (s instanceof TextSelection) tr.setSelection(TextSelection.create(tr.doc, tr.mapping.map(s.anchor, -1), tr.mapping.map(s.head, -1)));
  return tr;
}

export const alonePlugin = $prose(
  () =>
    new Plugin({
      appendTransaction: (trs, _, state) => (trs.some((tr) => tr.docChanged) ? imagesAlone(state) : null),
    }),
);
