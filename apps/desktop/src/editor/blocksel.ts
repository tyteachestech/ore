import { Plugin, TextSelection, type EditorState } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet, type EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import { blockAt, blocksOf, BlockSelection, selectBlocks } from "./blockops";

// Notion's block selection on a note: Esc on a line selects its block (NoteEditor), then ↑ ↓ move to
// the block above or below, ⇧↑ ⇧↓ and ⇧-click take in more, Enter goes back to typing at its end,
// Esc lets go. Backspace, cut, copy, ⌘D, ⌘⇧↑ ↓ and Turn into act on all of them.

/** The blocks from `a` to `h`, or the selection as it was when that can't be made. */
const pick = (state: EditorState, a: number, h: number) => selectBlocks(state.doc, a, h) ?? state.selection;

/** ↑ or ↓: the block above or below (into a list item's children going down); with ⇧, the head moves. */
export function step(state: EditorState, dir: -1 | 1, extend: boolean) {
  const s = state.selection as BlockSelection;
  const all = blocksOf(state.doc);
  const i = all.findIndex((b) => b.from === s.h);
  if (extend) {
    // A block under one already taken in changes nothing: the head goes on to one that does.
    for (let k = i + dir; k >= 0 && k < all.length; k += dir) {
      const next = pick(state, s.a, all[k]!.from);
      if (next.from !== s.from || next.to !== s.to) return next;
    }
    return s;
  }
  const single = s.a === s.h;
  const next = dir > 0 ? (single ? all[i + 1] : all.find((b) => b.from >= s.to)) : all.findLast((b) => b.from < s.from);
  return next ? pick(state, next.from, next.from) : s;
}

/** Enter: the caret at the end of the head block's first line. */
function edit(state: EditorState) {
  const s = state.selection as BlockSelection;
  const $in = TextSelection.near(state.doc.resolve(s.h + 1)).$head;
  return TextSelection.create(state.doc, $in.end());
}

export const blockSelPlugin = $prose(
  () =>
    new Plugin({
      props: {
        decorations: (state) => {
          const s = state.selection;
          if (!(s instanceof BlockSelection)) return null;
          const out: Decoration[] = [];
          for (let pos = s.from; pos < s.to; ) {
            const n = state.doc.nodeAt(pos)!;
            out.push(Decoration.node(pos, pos + n.nodeSize, { class: "block-sel" }));
            pos += n.nodeSize;
          }
          return DecorationSet.create(state.doc, out);
        },
        handleKeyDown: (view, e) => {
          const { state } = view;
          const go = (sel: EditorState["selection"]) => (view.dispatch(state.tr.setSelection(sel).scrollIntoView()), true);
          const mod = e.metaKey || e.ctrlKey;
          if (mod && !e.shiftKey && !e.altKey && e.code === "KeyA") {
            // ⌘A: the line's text first, then every block (Notion).
            const s = state.selection;
            const all = blocksOf(state.doc);
            const whole = s instanceof BlockSelection || (s.$from.sameParent(s.$to) && s.from === s.$from.start() && s.to === s.$from.end());
            if (!whole) return go(TextSelection.create(state.doc, s.$from.start(), s.$from.end()));
            return go(pick(state, all[0]!.from, all.at(-1)!.from));
          }
          if (!(state.selection instanceof BlockSelection)) return false;
          if (e.key === "Escape" && !mod && !e.shiftKey) {
            // Lets go and leaves the note, so Tab and the page's keys work again (the reader also moves
            // focus to its text); a click or Enter on a block goes back in.
            view.dispatch(state.tr.setSelection(edit(state)));
            (view.dom as HTMLElement).blur();
            return true;
          }
          if ((e.key === "ArrowUp" || e.key === "ArrowDown") && !mod && !e.altKey) return go(step(state, e.key === "ArrowUp" ? -1 : 1, e.shiftKey));
          if (e.key === "Enter" && !mod && !e.shiftKey) return go(edit(state));
          // Typing over selected blocks does nothing, as in Notion: it never half-replaces them.
          return !mod && [...e.key].length === 1;
        },
        handleTextInput: (view) => view.state.selection instanceof BlockSelection,
        handleDOMEvents: {
          // ⇧-click takes the blocks up to the one clicked.
          mousedown: (view: EditorView, e: MouseEvent) => {
            const s = view.state.selection;
            if (!e.shiftKey || !(s instanceof BlockSelection)) return false;
            const hit = view.posAtCoords({ left: e.clientX, top: e.clientY });
            const b = hit && blockAt(view.state.doc, hit.pos);
            if (!b) return false;
            e.preventDefault();
            view.dispatch(view.state.tr.setSelection(pick(view.state, s.a, b.from)));
            return true;
          },
        },
      },
    }),
);
