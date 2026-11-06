import type { Fragment, Node as PMNode, NodeType, Schema } from "@milkdown/kit/prose/model";
import { type EditorState, TextSelection, type Transaction } from "@milkdown/kit/prose/state";

// Notion's block actions on a note (move, duplicate, delete, turn into), as plain ProseMirror
// transactions, so the ⋮⋮ handle, its menu and the keys share them and ⌘Z takes each back.

/** What the handle acts on: a list item (each one gets its own handle, as in Notion), or a block at the
 *  top of the note. A list with one item is that whole list, so moving it never leaves an empty list. */
export type Block = { from: number; to: number; node: PMNode; item: boolean };

const isList = (n: PMNode) => n.type.name === "bullet_list" || n.type.name === "ordered_list";

export function blockAt(doc: PMNode, pos: number): Block | null {
  if (!doc.childCount) return null;
  const $p = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
  for (let d = $p.depth; d > 0; d--) {
    if ($p.node(d).type.name !== "list_item") continue;
    const list = $p.node(d - 1);
    if (list.childCount === 1 && d - 1 === 1) return { from: $p.before(1), to: $p.after(1), node: list, item: false };
    return { from: $p.before(d), to: $p.after(d), node: $p.node(d), item: true };
  }
  if ($p.depth === 0) {
    // Between top-level blocks: the one after, or the last.
    const i = Math.min($p.index(0), doc.childCount - 1);
    let at = 0;
    for (let k = 0; k < i; k++) at += doc.child(k).nodeSize;
    return { from: at, to: at + doc.child(i).nodeSize, node: doc.child(i), item: false };
  }
  return { from: $p.before(1), to: $p.after(1), node: $p.node(1), item: false };
}

/** The range taking the block out removes: an item that is its list's only one takes the list with it. */
function removal(doc: PMNode, b: Block) {
  if (!b.item) return { from: b.from, to: b.to };
  const $p = doc.resolve(b.from);
  const list = $p.parent;
  return list.childCount === 1 ? { from: $p.before(), to: $p.after() } : { from: b.from, to: b.to };
}

/** Where a block can go: a gap between top-level blocks, or (for a list item) between items of any
 *  list. An item dropped at the top level comes wrapped in a list like the one it left. */
export type Gap = { pos: number; wrap?: string };

export function gaps(doc: PMNode, b: Block): Gap[] {
  const out: Gap[] = [];
  const rm = removal(doc, b);
  const wrap = b.item ? doc.resolve(b.from).parent.type.name : undefined;
  const ok = (pos: number) => pos <= rm.from || pos >= rm.to;
  const still = (pos: number) => pos === rm.from || pos === rm.to; // where it already is
  let at = 0;
  for (let i = 0; i <= doc.childCount; i++) {
    if (ok(at) && !still(at)) out.push({ pos: at, wrap });
    if (i < doc.childCount) at += doc.child(i).nodeSize;
  }
  if (b.item)
    doc.descendants((n, pos) => {
      if (!isList(n)) return true;
      let p = pos + 1;
      for (let i = 0; i <= n.childCount; i++) {
        if (p > rm.from && p < rm.to) break; // inside the item itself
        if (!still(p) && ok(p)) out.push({ pos: p });
        if (i < n.childCount) p += n.child(i).nodeSize;
      }
      return true;
    });
  return out;
}

/** Moves the block to a gap (from `gaps`). */
export function moveTo(state: EditorState, b: Block, gap: Gap): Transaction {
  const rm = removal(state.doc, b);
  const tr = state.tr.delete(rm.from, rm.to);
  const at = tr.mapping.map(gap.pos);
  const node = gap.wrap ? state.schema.nodes[gap.wrap]!.create(null, b.node) : b.node;
  tr.insert(at, node);
  return tr.setSelection(TextSelection.near(tr.doc.resolve(at + 1))).scrollIntoView();
}

/** ⌘⇧↑ / ⌘⇧↓: past the sibling above or below, in the same list or at the top level. */
export function moveBy(state: EditorState, b: Block, dir: -1 | 1): Transaction | null {
  const $p = state.doc.resolve(b.from);
  const parent = $p.parent;
  const i = $p.index();
  if (dir < 0 ? i === 0 : i === parent.childCount - 1) return null;
  const pos = dir < 0 ? b.from - parent.child(i - 1).nodeSize : b.to + parent.child(i + 1).nodeSize;
  const tr = state.tr.delete(b.from, b.to);
  const at = tr.mapping.map(pos);
  tr.insert(at, b.node);
  // The caret stays where it was in the block.
  const offset = state.selection.from - b.from;
  const inside = offset > 0 && offset < b.node.nodeSize ? at + offset : at + 1;
  return tr.setSelection(TextSelection.near(tr.doc.resolve(inside))).scrollIntoView();
}

export function duplicate(state: EditorState, b: Block): Transaction {
  const tr = state.tr.insert(b.to, b.node.copy(b.node.content));
  return tr.setSelection(TextSelection.near(tr.doc.resolve(b.to + 1))).scrollIntoView();
}

export function remove(state: EditorState, b: Block): Transaction {
  const rm = removal(state.doc, b);
  const tr = state.tr.delete(rm.from, rm.to);
  return tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(rm.from, tr.doc.content.size)))).scrollIntoView();
}

export type Kind = "text" | "h1" | "h2" | "h3" | "bullet" | "number" | "todo" | "quote" | "callout" | "toggle";

/** Turn into, in Notion's order; the same blocks as the / menu. */
export const KINDS: { kind: Kind; label: string }[] = [
  { kind: "text", label: "Text" },
  { kind: "h1", label: "Heading 1" },
  { kind: "h2", label: "Heading 2" },
  { kind: "h3", label: "Heading 3" },
  { kind: "bullet", label: "Bulleted list" },
  { kind: "number", label: "Numbered list" },
  { kind: "todo", label: "To-do list" },
  { kind: "toggle", label: "Toggle" },
  { kind: "callout", label: "Callout" },
  { kind: "quote", label: "Quote" },
];

/** The kind a block is now, so Turn into can mark it. */
export function kindOf(doc: PMNode, b: Block): Kind | null {
  const list = b.item ? doc.resolve(b.from).parent : isList(b.node) ? b.node : null;
  const n = b.item ? b.node : list ? list.firstChild! : b.node;
  if (list) return n.attrs.checked != null ? "todo" : list.type.name === "ordered_list" ? "number" : "bullet";
  if (n.type.name === "paragraph") return "text";
  if (n.type.name === "heading") return `h${Math.min(3, Number(n.attrs.level))}` as Kind;
  return ({ blockquote: "quote", callout: "callout", toggle: "toggle" } as Record<string, Kind>)[n.type.name] ?? null;
}

/** The text a block leads with, and the blocks under it, which carry over into what it becomes. */
function parts(b: Block, schema: Schema): { lead: Fragment; rest: PMNode[] } | null {
  const n = b.item ? b.node : isList(b.node) ? b.node.firstChild! : b.node;
  const kids: PMNode[] = [];
  n.forEach((c) => void kids.push(c));
  if (n.isTextblock) return { lead: n.content, rest: [] };
  if (n.type.name === "toggle") {
    const body = kids.slice(1).filter((c) => !(c.type.name === "paragraph" && !c.content.size));
    return { lead: kids[0]!.content, rest: body };
  }
  if (["list_item", "blockquote", "callout"].includes(n.type.name)) {
    const first = kids[0];
    if (first?.isTextblock) return { lead: first.content, rest: kids.slice(1) };
    return { lead: schema.nodes.paragraph!.create().content, rest: kids };
  }
  return null;
}

export function turnInto(state: EditorState, b: Block, kind: Kind): Transaction | null {
  const { schema } = state;
  const s = schema.nodes;
  const p = parts(b, schema);
  if (!p) return null;
  const { lead } = p;
  let rest = p.rest;
  const listKind = kind === "bullet" || kind === "number" || kind === "todo";
  // An item turned into a plain block hands its nested items on to the list after it.
  const handed: PMNode[] = [];
  if (b.item && !listKind) {
    for (const c of rest) if (isList(c)) c.forEach((x) => void handed.push(x));
    rest = rest.filter((c) => !isList(c));
  }
  const para = () => s.paragraph!.create(null, lead);
  const item = () => s.list_item!.create({ ...(b.item ? b.node.attrs : {}), checked: kind === "todo" ? false : null }, [para(), ...rest]);
  const listType = (k: Kind): NodeType => (k === "number" ? s.ordered_list! : s.bullet_list!);

  // An item that stays in its kind of list changes in place (bullet ↔ to-do).
  if (b.item && listKind && state.doc.resolve(b.from).parent.type === listType(kind)) {
    const tr = state.tr.replaceWith(b.from, b.to, item());
    return tr.setSelection(TextSelection.near(tr.doc.resolve(b.from + 2)));
  }

  let made: PMNode[];
  if (listKind) made = [listType(kind).create(null, item())];
  else if (kind === "text") made = [para(), ...rest];
  else if (kind === "h1" || kind === "h2" || kind === "h3") made = [s.heading!.create({ level: Number(kind[1]) }, lead), ...rest];
  else if (kind === "quote") made = [s.blockquote!.create(null, [para(), ...rest])];
  else if (kind === "callout") made = [s.callout!.create({ kind: "note" }, [para(), ...rest])];
  else {
    const title = lead.textBetween(0, lead.size, " ", " ").trim();
    made = [s.toggle!.create(null, [s.toggle_summary!.create(null, title ? schema.text(title) : null), ...(rest.length ? rest : [s.paragraph!.create()])])];
  }

  if (!b.item) {
    const tr = state.tr.replaceWith(b.from, b.to, made);
    return tr.setSelection(TextSelection.near(tr.doc.resolve(b.from + 1)));
  }
  // An item leaving its list splits the list around it.
  const $p = state.doc.resolve(b.from);
  const list = $p.parent;
  const i = $p.index();
  const before: PMNode[] = [];
  const after: PMNode[] = [...handed];
  list.forEach((c, _, k) => void (k < i ? before.push(c) : k > i && after.push(c)));
  const seq = [...(before.length ? [list.type.create(list.attrs, before)] : []), ...made, ...(after.length ? [list.type.create(list.attrs, after)] : [])];
  const from = $p.before();
  const tr = state.tr.replaceWith(from, $p.after(), seq);
  const start = from + (before.length ? seq[0]!.nodeSize : 0);
  return tr.setSelection(TextSelection.near(tr.doc.resolve(start + 1)));
}
