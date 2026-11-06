import { $markSchema, $remark } from "@milkdown/kit/utils";

// Text colours and highlights in a note (Tyler, 2026-11-06), stored as inline HTML that GitHub and
// Obsidian show and an AI reads as plain text: `<mark>` (or `<mark data-color="blue">`) for a
// highlight, `<span data-color="red">` for coloured text, `<u>` for underline (Markdown has none).
// Any other HTML stays a literal.

/** The colours, in the menu's order: the app's skill palette (DESIGN.md `--c-*`). */
export const COLORS = ["gray", "red", "orange", "yellow", "green", "teal", "blue", "purple", "pink"] as const;
export type Color = (typeof COLORS)[number];
const valid = (c: string | undefined): c is Color => !!c && (COLORS as readonly string[]).includes(c);

type Tag = "mark" | "span" | "u";
type MdNode = { type: string; value?: string; children?: MdNode[]; tag?: Tag; color?: string | null };

const OPEN = /^<(mark|span|u)(?:\s+data-color="([a-z]+)")?\s*>$/;
const CLOSE = /^<\/(mark|span|u)>$/;

/** Pairs `<mark …>` … `</mark>` and `<span data-color>` … `</span>` among a node's inline children. */
function pair(children: MdNode[]): MdNode[] {
  const out: MdNode[] = [];
  for (let i = 0; i < children.length; i++) {
    const n = children[i]!;
    const open = n.type === "html" ? n.value?.match(OPEN) : null;
    const tag = open?.[1] as Tag | undefined;
    const color = open?.[2];
    // A span is a colour only with a known colour; a mark is a highlight with one or none; u has none.
    if (open && (tag === "mark" ? !color || valid(color) : tag === "u" ? !color : valid(color))) {
      let depth = 1;
      let j = i + 1;
      for (; j < children.length; j++) {
        const m = children[j]!;
        if (m.type !== "html") continue;
        if (m.value?.match(OPEN)?.[1] === tag) depth++;
        else if (m.value?.match(CLOSE)?.[1] === tag && --depth === 0) break;
      }
      if (j < children.length) {
        out.push({ type: "oreColor", tag, color: color ?? null, children: pair(children.slice(i + 1, j)) });
        i = j;
        continue;
      }
    }
    if (n.children) n.children = pair(n.children);
    out.push(n);
  }
  return out;
}

export const remarkColors = $remark("oreColors", () => () => (tree: unknown) => {
  const root = tree as MdNode;
  root.children = pair(root.children ?? []);
});

/** Remark's writer for the marks below: the tags back around the text, as they were read. */
export function stringifyColor(node: MdNode, _: unknown, state: { containerPhrasing: (n: unknown, info: unknown) => string }, info: unknown) {
  const attr = node.color ? ` data-color="${node.color}"` : "";
  return `<${node.tag}${attr}>${state.containerPhrasing(node, info)}</${node.tag}>`;
}

/** A highlight: `<mark>` (yellow, as everywhere else) or `<mark data-color="…">`. */
export const highlightSchema = $markSchema("ore_highlight", () => ({
  attrs: { color: { default: null as Color | null } },
  parseDOM: [{ tag: "mark", getAttrs: (dom) => ({ color: (dom as HTMLElement).dataset.color ?? null }) }],
  toDOM: (mark) => ["mark", { "data-color": mark.attrs.color ?? "yellow" }, 0],
  parseMarkdown: {
    match: (n) => n.type === "oreColor" && (n as MdNode).tag === "mark",
    runner: (state, n, type) => {
      state.openMark(type, { color: (n as MdNode).color ?? null });
      state.next(n.children);
      state.closeMark(type);
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === "ore_highlight",
    runner: (state, mark) => void state.withMark(mark, "oreColor", undefined, { tag: "mark", color: mark.attrs.color }),
  },
}));

/** Coloured text: `<span data-color="…">`. */
export const textColorSchema = $markSchema("ore_text_color", () => ({
  attrs: { color: { default: "gray" as Color } },
  parseDOM: [{ tag: "span[data-color]", getAttrs: (dom) => ({ color: (dom as HTMLElement).dataset.color }) }],
  toDOM: (mark) => ["span", { class: "text-color", "data-color": mark.attrs.color }, 0],
  parseMarkdown: {
    match: (n) => n.type === "oreColor" && (n as MdNode).tag === "span",
    runner: (state, n, type) => {
      state.openMark(type, { color: (n as MdNode).color });
      state.next(n.children);
      state.closeMark(type);
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === "ore_text_color",
    runner: (state, mark) => void state.withMark(mark, "oreColor", undefined, { tag: "span", color: mark.attrs.color }),
  },
}));

/** Underline (⌘U, the format bar): `<u>`. */
export const underlineSchema = $markSchema("ore_underline", () => ({
  parseDOM: [{ tag: "u" }],
  toDOM: () => ["u", 0],
  parseMarkdown: {
    match: (n) => n.type === "oreColor" && (n as MdNode).tag === "u",
    runner: (state, n, type) => {
      state.openMark(type);
      state.next(n.children);
      state.closeMark(type);
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === "ore_underline",
    runner: (state, mark) => void state.withMark(mark, "oreColor", undefined, { tag: "u", color: null }),
  },
}));
