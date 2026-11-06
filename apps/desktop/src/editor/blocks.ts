import { paragraphSchema } from "@milkdown/kit/preset/commonmark";
import { $nodeSchema, $remark } from "@milkdown/kit/utils";

// Blocks Markdown can store, beyond CommonMark and GFM (D38): toggles as
// `<details><summary>…</summary>` … `</details>`, callouts as `> [!note]` quotes.
// Other raw HTML stays a literal, never rendered.

type MdNode = { type: string; value?: string; children?: MdNode[]; summary?: string; kind?: string };

const decode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const encode = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The HTML of a block-level html node, also when Milkdown has already wrapped it in a paragraph. */
function htmlOf(n: MdNode | undefined): string | null {
  if (!n) return null;
  if (n.type === "html") return n.value?.trim() ?? null;
  const only = n.type === "paragraph" && n.children?.length === 1 ? n.children[0] : undefined;
  return only?.type === "html" ? (only.value?.trim() ?? null) : null;
}

const OPEN = /^<details>\s*<summary>([\s\S]*?)<\/summary>$/;
const MARKER = /^\[!(\w+)\][ \t]*(?:\n|$)/;

/** A quote whose first line is exactly `[!kind]` becomes a callout; anything else stays a quote. */
function callout(n: MdNode): MdNode | null {
  const para = n.children?.[0];
  const text = para?.type === "paragraph" ? para.children?.[0] : undefined;
  const m = text?.type === "text" ? text.value!.match(MARKER) : null;
  if (!m || !para || !text) return null;
  text.value = text.value!.slice(m[0].length);
  if (!text.value) para.children!.shift();
  const children = para.children!.length ? n.children! : n.children!.slice(1);
  return { type: "callout", kind: m[1]!.toLowerCase(), children: group(children) };
}

function group(children: MdNode[]): MdNode[] {
  const out: MdNode[] = [];
  for (let i = 0; i < children.length; i++) {
    const n = children[i]!;
    const open = htmlOf(n)?.match(OPEN);
    if (open) {
      let depth = 1;
      let j = i + 1;
      for (; j < children.length; j++) {
        const h = htmlOf(children[j]);
        if (h && OPEN.test(h)) depth++;
        else if (h === "</details>" && --depth === 0) break;
      }
      if (j < children.length) {
        out.push({ type: "details", summary: decode(open[1]!.trim()), children: group(children.slice(i + 1, j)) });
        i = j;
        continue;
      }
    }
    const c = n.type === "blockquote" ? callout(n) : null;
    if (c) out.push(c);
    else {
      if (n.children) n.children = group(n.children);
      out.push(n);
    }
  }
  return out;
}

/** The diagram a note image points at (D40): `diagrams/<name>.excalidraw` beside the note, or null. */
export const diagramName = (src: string): string | null => src.match(/^diagrams\/([a-z0-9]+(?:-[a-z0-9]+)*)\.excalidraw$/)?.[1] ?? null;

export const remarkBlocks = $remark("oreBlocks", () => () => (tree: unknown) => {
  const root = tree as MdNode;
  root.children = group(root.children ?? []);
});

export const toggleSummarySchema = $nodeSchema("toggle_summary", () => ({
  content: "text*",
  marks: "",
  defining: true,
  parseDOM: [{ tag: "div.toggle-summary" }],
  toDOM: () => ["div", { class: "toggle-summary" }, 0],
  parseMarkdown: { match: () => false, runner: () => {} },
  toMarkdown: { match: (node) => node.type.name === "toggle_summary", runner: () => {} },
}));

export const toggleSchema = $nodeSchema("toggle", (ctx) => ({
  content: "toggle_summary block+",
  group: "block",
  defining: true,
  parseDOM: [{ tag: "div.toggle" }],
  toDOM: () => ["div", { class: "toggle" }, 0],
  parseMarkdown: {
    match: (n) => n.type === "details",
    runner: (state, n, type) => {
      state.openNode(type).openNode(toggleSummarySchema.type(ctx));
      if ((n as MdNode).summary) state.addText((n as MdNode).summary!);
      state.closeNode();
      if (n.children?.length) state.next(n.children);
      else state.openNode(paragraphSchema.type(ctx)).closeNode();
      state.closeNode();
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === "toggle",
    runner: (state, node) => {
      state.addNode("html", undefined, `<details><summary>${encode(node.firstChild?.textContent.trim() ?? "")}</summary>`);
      node.forEach((child, _, i) => i > 0 && void state.next(child));
      state.addNode("html", undefined, "</details>");
    },
  },
}));

export const calloutSchema = $nodeSchema("callout", () => ({
  content: "block+",
  group: "block",
  defining: true,
  attrs: { kind: { default: "note", validate: "string" } },
  parseDOM: [{ tag: "div.callout", getAttrs: (dom) => ({ kind: (dom as HTMLElement).dataset.kind ?? "note" }) }],
  toDOM: (node) => ["div", { class: "callout", "data-kind": node.attrs.kind }, 0],
  parseMarkdown: {
    match: (n) => n.type === "callout",
    runner: (state, n, type) => {
      state.openNode(type, { kind: (n as MdNode).kind });
      state.next(n.children);
      state.closeNode();
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === "callout",
    // `> [!note]` then the first paragraph on the next line, as Obsidian and GitHub write it.
    runner: (state, node) => {
      state.openNode("blockquote").openNode("paragraph");
      state.addNode("html", undefined, `[!${node.attrs.kind}]`);
      const first = node.firstChild;
      if (first?.type.name === "paragraph" && first.childCount) {
        state.addNode("text", undefined, "\n");
        state.next(first.content);
        state.closeNode();
        node.forEach((child, _, i) => i > 0 && void state.next(child));
      } else {
        state.closeNode();
        state.next(node.content);
      }
      state.closeNode();
    },
  },
}));
