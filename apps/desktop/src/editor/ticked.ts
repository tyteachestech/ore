import { Plugin, PluginKey, type Transaction } from "@milkdown/kit/prose/state";
import { AttrStep } from "@milkdown/kit/prose/transform";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";

// A to-do he ticks glows once (the reward glow, DESIGN.md "Motion"): the box lights in place and settles, so ticking feels like
// something done. Only a tick: a box he unticks, or a note opening on ticked boxes, stays still.

const key = new PluginKey<DecorationSet>("ticked");
/** How long the glow's class stays on the item: its animation's length (styles.css `ticked`). */
export const TICK_MS = 900;

/** Where `tr` turned a to-do from unticked to ticked (positions in its new doc). */
export function ticks(tr: Transaction): number[] {
  const out: number[] = [];
  tr.steps.forEach((s, i) => {
    if (!(s instanceof AttrStep) || s.attr !== "checked" || s.value !== true) return;
    if (tr.docs[i]!.nodeAt(s.pos)?.attrs.checked !== false) return;
    out.push(tr.mapping.slice(i + 1).map(s.pos));
  });
  return out;
}

export const tickedPlugin = $prose(
  () =>
    new Plugin<DecorationSet>({
      key,
      state: {
        init: () => DecorationSet.empty,
        apply(tr, set) {
          if (tr.getMeta(key) === "clear") return DecorationSet.empty;
          set = set.map(tr.mapping, tr.doc);
          const at = ticks(tr).flatMap((pos) => {
            const n = tr.doc.nodeAt(pos);
            return n ? [Decoration.node(pos, pos + n.nodeSize, { class: "ticked" })] : [];
          });
          return at.length ? set.add(tr.doc, at) : set;
        },
      },
      props: { decorations: (state) => key.getState(state) },
      view: () => {
        let timer = 0;
        return {
          update(view, prev) {
            if (key.getState(view.state) === key.getState(prev) || key.getState(view.state) === DecorationSet.empty) return;
            clearTimeout(timer);
            timer = window.setTimeout(() => !view.isDestroyed && view.dispatch(view.state.tr.setMeta(key, "clear").setMeta("addToHistory", false)), TICK_MS);
          },
          destroy: () => clearTimeout(timer),
        };
      },
    }),
);
