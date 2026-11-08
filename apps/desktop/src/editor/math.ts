import { InputRule } from "@milkdown/kit/prose/inputrules";
import type { Node as PmNode } from "@milkdown/kit/prose/model";
import type { EditorView, NodeView } from "@milkdown/kit/prose/view";
import { $inputRule, $nodeSchema, $remark, $view } from "@milkdown/kit/utils";
import katex from "katex";
import "katex/dist/katex.min.css";
import remarkMath from "remark-math";

// Equations in a note (Notion's /equation and /math), stored as the reader reads them (D96): `$$…$$`
// inline, and a `$$` block on lines of their own. A single `$` stays a dollar, as in the reader, so
// "$5 or $10" never turns into math.

export const remarkNoteMath = $remark("oreMath", () => remarkMath, { singleDollarTextMath: false });

const value = (n: unknown) => String((n as { value?: string }).value ?? "");

/** An equation in a line of text: `$$E = mc^2$$`. */
export const mathInlineSchema = $nodeSchema("math_inline", () => ({
  group: "inline",
  inline: true,
  atom: true,
  attrs: { value: { default: "", validate: "string" } },
  parseDOM: [{ tag: "span[data-math]", getAttrs: (dom) => ({ value: (dom as HTMLElement).dataset.math ?? "" }) }],
  toDOM: (node) => ["span", { "data-math": node.attrs.value }, node.attrs.value],
  parseMarkdown: { match: (n) => n.type === "inlineMath", runner: (state, n, type) => void state.addNode(type, { value: value(n) }) },
  toMarkdown: { match: (node) => node.type.name === "math_inline", runner: (state, node) => void state.addNode("inlineMath", undefined, node.attrs.value) },
}));

/** An equation on its own lines, centred: `$$` / TeX / `$$`. */
export const mathBlockSchema = $nodeSchema("math_block", () => ({
  group: "block",
  atom: true,
  attrs: { value: { default: "", validate: "string" } },
  parseDOM: [{ tag: "div[data-math]", getAttrs: (dom) => ({ value: (dom as HTMLElement).dataset.math ?? "" }) }],
  toDOM: (node) => ["div", { "data-math": node.attrs.value }, node.attrs.value],
  parseMarkdown: { match: (n) => n.type === "math", runner: (state, n, type) => void state.addNode(type, { value: value(n) }) },
  toMarkdown: { match: (node) => node.type.name === "math_block", runner: (state, node) => void state.addNode("math", undefined, node.attrs.value) },
}));

/** Typing `$$x^2$$` makes an inline equation, as in Notion. */
export const mathRule = $inputRule(
  () =>
    new InputRule(/(?:^|[^$])\$\$([^$\n]*[^$\s][^$\n]*)\$\$$/, (state, m, start, end) => {
      const type = state.schema.nodes.math_inline;
      const from = start + m[0].length - m[1]!.length - 4;
      const code = state.schema.marks.inlineCode;
      // Not in code: a code block, or `inline code` (echo $$PID$$).
      if (!type || state.doc.resolve(start).parent.type.spec.code || (code && (state.doc.rangeHasMark(from, end, code) || code.isInSet(state.storedMarks ?? state.doc.resolve(end).marks())))) return null;
      return state.tr.replaceWith(from, end, type.create({ value: m[1]!.trim() }));
    }),
);

/** The equation as KaTeX draws it; an empty one says so, a broken one shows its TeX in red (KaTeX). */
export function drawMath(dom: HTMLElement, tex: string, display: boolean) {
  dom.classList.toggle("empty", !tex.trim());
  if (!tex.trim()) return void (dom.textContent = display ? "Empty equation: click to write it" : "Equation");
  dom.innerHTML = katex.renderToString(tex, { displayMode: display, throwOnError: false });
}

/** The views for both kinds of equation; a click opens one for editing (`edit`, with where it is). */
export const mathViews = (edit: (pos: number) => void) => [$view(mathInlineSchema.node, () => mathView(edit)), $view(mathBlockSchema.node, () => mathView(edit))];

function mathView(edit: (pos: number) => void) {
  return (node: PmNode, _view: EditorView, getPos: () => number | undefined): NodeView => {
    const display = node.type.name === "math_block";
    const dom = document.createElement(display ? "div" : "span");
    dom.className = display ? "note-math block" : "note-math";
    dom.contentEditable = "false";
    drawMath(dom, String(node.attrs.value), display);
    dom.addEventListener("click", () => {
      const pos = getPos();
      if (pos !== undefined) edit(pos);
    });
    return {
      dom,
      update: (n) => {
        if (n.type !== node.type) return false;
        if (n.attrs.value !== node.attrs.value) drawMath(dom, String(n.attrs.value), display);
        node = n;
        return true;
      },
      ignoreMutation: () => true,
    };
  };
}
