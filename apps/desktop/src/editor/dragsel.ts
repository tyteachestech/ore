import { Plugin, PluginKey, type EditorState } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import { blocksOf, BlockSelection, selectBlocks, type Block } from "./blockops";

// Notion's drag to select blocks (D187). A drag that starts beside the note (its gutter, the space
// around its blocks) draws a box and selects every block it passes; a drag that starts in a block's
// text selects text until it reaches another block, then selects whole blocks instead.

const mine = new PluginKey("drag-sel");
/** Beside the note: how far left or right of it a drag may start. */
const REACH = 40;
/** What a press on is never the start of a drag over blocks: controls, and a diagram (a drag pans it). */
const OWN = 'button, input, textarea, select, img, [contenteditable="false"], [role="button"], [role="menu"], [role="dialog"], .block-handle, .sel-bar';

type Span = { block: Block; top: number; bottom: number };

/** Each block and the height it takes on screen; a list item's own lines, not the items under it. */
function spans(view: EditorView): Span[] {
  return blocksOf(view.state.doc).flatMap((block) => {
    const el = view.nodeDOM(block.from) as HTMLElement | null;
    if (!el?.getBoundingClientRect) return [];
    const r = el.getBoundingClientRect();
    const under = block.item ? el.querySelector(":scope > ul, :scope > ol") : null;
    return [{ block, top: r.top, bottom: under ? under.getBoundingClientRect().top : r.bottom }];
  });
}

/** The blocks between two heights, selected from the one at `y0` to the one at `y1`; null when none are. */
export function between(state: EditorState, all: Span[], y0: number, y1: number): BlockSelection | null {
  const hit = all.filter((s) => s.bottom > Math.min(y0, y1) && s.top < Math.max(y0, y1));
  if (!hit.length) return null;
  const [a, h] = y0 <= y1 ? [hit[0]!, hit.at(-1)!] : [hit.at(-1)!, hit[0]!];
  return selectBlocks(state.doc, a.block.from, h.block.from);
}

export const dragSelPlugin = $prose(() => {
  /** A drag has selected blocks: the text selection the browser keeps dragging under it is not taken. */
  let held = false;
  return new Plugin({
    filterTransaction: (tr) => !held || !tr.selectionSet || tr.docChanged || tr.getMeta(mine) === true,
    view: (view) => {
      const host = () => (view.dom.closest(".note-editor") as HTMLElement | null) ?? (view.dom as HTMLElement);
      let drag: { x: number; y: number; from: number; text: boolean; on: boolean; box: HTMLElement | null } | null = null;

      const select = (y: number) => {
        if (!drag) return;
        const y0 = host().getBoundingClientRect().top + drag.from;
        // A few pixels into the next block before it counts, so a wobble along one line stays text.
        const sel = between(view.state, spans(view), y0, drag.text ? y - Math.sign(y - y0) * 4 : y);
        if (drag.text && !drag.on && (!sel || sel.a === sel.h)) return;
        if (!drag.on) {
          drag.on = held = true;
          host().classList.add("block-dragging");
          if (!view.hasFocus()) view.focus();
        }
        if (sel && !sel.eq(view.state.selection)) view.dispatch(view.state.tr.setSelection(sel).setMeta(mine, true));
      };

      const down = (e: MouseEvent) => {
        held = false;
        const t = e.target as HTMLElement | null;
        if (e.button !== 0 || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey || !t?.closest || t.closest(OWN) || !view.editable) return;
        const h = host();
        const r = h.getBoundingClientRect();
        const text = view.dom.contains(t) && t !== view.dom;
        // Beside the note: the note's own empty space, or the bare column around it (never another part of the page).
        const beside = !text && (h.contains(t) || t.contains(h)) && e.clientX >= r.left - REACH && e.clientX <= r.right + REACH;
        if (!text && !beside) return;
        drag = { x: e.clientX, y: e.clientY, from: e.clientY - r.top, text, on: false, box: null };
      };

      const move = (e: MouseEvent) => {
        if (!drag) return;
        if (!(e.buttons & 1)) return up();
        if (!drag.on && !drag.text && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 4) return;
        select(e.clientY);
        if (drag.text || !drag.on) return;
        // The box he is dragging, from where he pressed (it moves with the note when it scrolls).
        const h = host();
        const r = h.getBoundingClientRect();
        const box = (drag.box ??= h.appendChild(Object.assign(document.createElement("div"), { className: "block-marquee" })));
        const x0 = drag.x - r.left, y0 = drag.from, x1 = e.clientX - r.left, y1 = e.clientY - r.top;
        Object.assign(box.style, { left: `${Math.min(x0, x1)}px`, top: `${Math.min(y0, y1)}px`, width: `${Math.abs(x1 - x0)}px`, height: `${Math.abs(y1 - y0)}px` });
        window.getSelection()?.removeAllRanges(); // words of the page around the note don't select with it
      };

      const up = () => {
        drag?.box?.remove();
        host().classList.remove("block-dragging");
        drag = null;
      };
      // Any key or press after the drag lets the editor's own selection through again.
      const release = () => void (held = false);

      window.addEventListener("mousedown", down, true);
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
      window.addEventListener("keydown", release, true);
      window.addEventListener("pointerdown", release, true);
      return {
        destroy: () => {
          up();
          window.removeEventListener("mousedown", down, true);
          window.removeEventListener("mousemove", move);
          window.removeEventListener("mouseup", up);
          window.removeEventListener("keydown", release, true);
          window.removeEventListener("pointerdown", release, true);
        },
      };
    },
  });
});
