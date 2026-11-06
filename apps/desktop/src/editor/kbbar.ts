import { liftListItem, sinkListItem, splitListItem } from "@milkdown/kit/prose/schema-list";
import { chainCommands, splitBlock } from "@milkdown/kit/prose/commands";
import { TextSelection, type EditorState, type Transaction } from "@milkdown/kit/prose/state";
import { kindOf, selectedBlock, turnInto, type Kind } from "./blockops";

// The iPhone's bar over the keyboard (Notion, Bear): what a Mac does with / and keys, one tap each.

export type BarAction = "block" | "todo" | "bullet" | "heading" | "link" | "indent" | "outdent";

/** A block kind the bar toggles: a tap turns the caret's block into it, a second tap back into text. */
const TOGGLES: Partial<Record<BarAction, Kind>> = { todo: "todo", bullet: "bullet", heading: "h2" };

/** Which toggles are on for the caret's block, and whether it is in a list (for indent). */
export function barState(state: EditorState): { on: Kind | null; inList: boolean } {
  const b = selectedBlock(state);
  const { $from } = state.selection;
  let inList = false;
  for (let d = $from.depth; d > 0; d--) if ($from.node(d).type.name === "list_item") inList = true;
  return { on: b ? kindOf(state.doc, b) : null, inList };
}

/** The step a tap makes, or null when it does nothing there (indent outside a list). */
export function barAction(state: EditorState, a: BarAction): Transaction | null {
  const kind = TOGGLES[a];
  if (kind) {
    const b = selectedBlock(state);
    if (!b) return null;
    const tr = turnInto(state, b, kindOf(state.doc, b) === kind ? "text" : kind);
    // The caret stays where it was in the line, so he types on.
    const $c = tr?.selection.$from;
    return tr && $c?.parent.isTextblock ? tr.setSelection(TextSelection.create(tr.doc, Math.min($c.start() + state.selection.$from.parentOffset, $c.end()))) : tr;
  }
  if (a === "link") return state.tr.insertText("[[");
  let out: Transaction | null = null;
  const take = (tr: Transaction) => void (out = tr);
  const item = state.schema.nodes.list_item!;
  if (a === "indent") sinkListItem(item)(state, take);
  else if (a === "outdent") liftListItem(item)(state, take);
  else {
    // A new block below the caret's, with the / menu open on it; an empty line takes the / itself.
    const { $from, empty } = state.selection;
    if (empty && $from.parent.isTextblock && !$from.parent.content.size) return state.tr.insertText("/");
    const at = state.apply(state.tr.setSelection(TextSelection.create(state.doc, $from.end())));
    chainCommands(splitListItem(item), splitBlock)(at, take);
    return out ? (out as Transaction).insertText("/") : null;
  }
  return out;
}
