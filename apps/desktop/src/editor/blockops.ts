import { type Fragment, type Node as PMNode, type NodeType, type ResolvedPos, type Schema, Slice } from "@milkdown/kit/prose/model";
import { type EditorState, Selection, TextSelection, type Transaction } from "@milkdown/kit/prose/state";
import type { Mappable } from "@milkdown/kit/prose/transform";

// Notion's block actions on a note (move, duplicate, delete, turn into), as plain ProseMirror
// transactions, so the ⋮⋮ handle, its menu and the keys share them and ⌘Z takes each back.

/** What the handle acts on: a list item (each one gets its own handle, as in Notion), or a block at the
 *  top of the note. A list with one item is that whole list, so moving it never leaves an empty list.
 *  Selected blocks (a BlockSelection) are one Block too: side by side, `node` the first of them. */
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
  return b.from === $p.start() && b.to === $p.end() ? { from: $p.before(), to: $p.after() } : { from: b.from, to: b.to };
}

/** The blocks themselves, without the list around them. */
const contentOf = (doc: PMNode, b: Block) => doc.slice(b.from, b.to).content;

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
  const content = contentOf(state.doc, b);
  const node = gap.wrap ? state.schema.nodes[gap.wrap]!.create(null, content) : content;
  tr.insert(at, node);
  // What was dragged stays selected, as in Notion.
  const inner = gap.wrap ? at + 1 : at;
  return tr.setSelection(selectSpan(tr.doc, inner, inner + content.size) ?? TextSelection.near(tr.doc.resolve(at + 1))).scrollIntoView();
}

/** ⌘⇧↑ / ⌘⇧↓: past the sibling above or below, in the same list or at the top level. */
export function moveBy(state: EditorState, b: Block, dir: -1 | 1): Transaction | null {
  const $p = state.doc.resolve(b.from);
  const parent = $p.parent;
  const i = $p.index();
  const j = state.doc.resolve(b.to).index(); // the sibling after
  if (dir < 0 ? i === 0 : j === parent.childCount) return null;
  const pos = dir < 0 ? b.from - parent.child(i - 1).nodeSize : b.to + parent.child(j).nodeSize;
  const content = contentOf(state.doc, b);
  const tr = state.tr.delete(b.from, b.to);
  const at = tr.mapping.map(pos);
  tr.insert(at, content);
  if (state.selection instanceof BlockSelection) return tr.setSelection(selectSpan(tr.doc, at, at + content.size)!).scrollIntoView();
  // The caret stays where it was in the block.
  const offset = state.selection.from - b.from;
  const inside = offset > 0 && offset < b.to - b.from ? at + offset : at + 1;
  return tr.setSelection(TextSelection.near(tr.doc.resolve(inside))).scrollIntoView();
}

/** A copy right after; selected blocks leave the copy selected, as in Notion. */
export function duplicate(state: EditorState, b: Block): Transaction {
  const content = contentOf(state.doc, b);
  const tr = state.tr.insert(b.to, content);
  if (state.selection instanceof BlockSelection) return tr.setSelection(selectSpan(tr.doc, b.to, b.to + content.size)!).scrollIntoView();
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

/** The kind a block is now, so Turn into can mark it; of selected blocks, the kind they all are. */
export function kindOf(doc: PMNode, b: Block): Kind | null {
  const kinds = new Set(units(doc, b).map((u) => kindOfOne(doc, u)));
  return kinds.size === 1 ? [...kinds][0]! : null;
}

function kindOfOne(doc: PMNode, b: Block): Kind | null {
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

/** Turn into, on one block or on each selected one: lists made side by side join into one list. */
export function turnInto(state: EditorState, b: Block, kind: Kind): Transaction | null {
  const us = units(state.doc, b);
  if (us.length === 1) {
    const tr = turnOne(state, us[0]!, kind);
    if (!tr || !(state.selection instanceof BlockSelection)) return tr;
    const at = blockAt(tr.doc, tr.selection.from)!.from;
    return tr.setSelection(selectBlocks(tr.doc, at, at)!);
  }
  // Last first, so the blocks before each one keep their positions. Where each lands (its caret)
  // is kept, mapped through what follows, so the new blocks stay selected.
  const tr = state.tr;
  let s = state;
  const landed: { pos: number; at: number }[] = [];
  for (const u of us.reverse()) {
    const t = turnOne(s, { ...u, node: s.doc.nodeAt(u.from)! }, kind);
    if (!t) continue;
    for (const step of t.steps) tr.step(step);
    s = s.apply(t);
    landed.push({ pos: s.selection.from, at: tr.mapping.maps.length });
  }
  if (!landed.length) return null;
  // Only the lists it made, and the ones they touch, join.
  const from = tr.mapping.map(b.from, -1);
  const to = tr.mapping.map(b.to, 1);
  const $f = tr.doc.resolve(from);
  const joins: number[] = [];
  let prev: PMNode | null = null;
  $f.parent.forEach((c, off) => {
    const pos = $f.start() + off;
    if (prev && pos >= from && pos <= to && isList(c) && c.type === prev.type) joins.push(pos);
    prev = c;
  });
  for (const pos of joins.reverse()) tr.join(pos);
  const where = (l: { pos: number; at: number }) => blockAt(tr.doc, tr.mapping.slice(l.at).map(l.pos))!.from;
  const sel = selectBlocks(tr.doc, where(landed.at(-1)!), where(landed[0]!));
  return sel ? tr.setSelection(sel) : tr;
}

function turnOne(state: EditorState, b: Block, kind: Kind): Transaction | null {
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

/** Each block a Block covers: its items, for all of a list; each of them, for selected blocks. */
function units(doc: PMNode, b: Block): Block[] {
  const $p = doc.resolve(b.from);
  const out: Block[] = [];
  for (let i = $p.index(), pos = b.from; pos < b.to; i++) {
    const n = $p.parent.child(i);
    if (isList(n) && n.childCount > 1) n.forEach((c, off) => void out.push({ from: pos + 1 + off, to: pos + 1 + off + c.nodeSize, node: c, item: true }));
    else out.push({ from: pos, to: pos + n.nodeSize, node: n, item: n.type.name === "list_item" });
    pos += n.nodeSize;
  }
  return out;
}

/** Every block with a handle, in the order they read: what ↑ and ↓ step through. */
export function blocksOf(doc: PMNode): Block[] {
  const out: Block[] = [];
  doc.descendants((n, pos, parent) => {
    const at = { from: pos, to: pos + n.nodeSize, node: n };
    if (parent === doc) {
      if (!(isList(n) && n.childCount > 1)) out.push({ ...at, item: false });
    } else if (n.type.name === "list_item" && !(parent!.childCount === 1 && doc.resolve(pos).depth === 1)) out.push({ ...at, item: true });
    return !n.isTextblock;
  });
  return out;
}

/** Notion's block selection: whole blocks, tinted instead of a text selection. Esc makes one, ↑ ↓ move
 *  it, ⇧↑ ⇧↓ grow it. The blocks sit side by side, in one list or at the top of the note: taking in a
 *  block outside the list takes in the whole list. `a` and `h` are where its first and last picked
 *  blocks start (anchor and head); `from` and `to` span what is selected. */
export class BlockSelection extends Selection {
  constructor(
    readonly a: number,
    readonly h: number,
    $from: ResolvedPos,
    $to: ResolvedPos,
  ) {
    super($from, $to);
  }
  map(doc: PMNode, mapping: Mappable): Selection {
    const a = mapping.mapResult(this.a);
    const h = mapping.mapResult(this.h);
    const kept = !a.deleted && !h.deleted && selectBlocks(doc, a.pos, h.pos);
    return kept || TextSelection.near(doc.resolve(Math.min(mapping.map(this.from), doc.content.size)));
  }
  /** Backspace, Delete and cut take the blocks out whole (a whole list with its last item). */
  replace(tr: Transaction, content = Slice.empty) {
    if (content.size) return super.replace(tr, content);
    const rm = removal(tr.doc, blockOfSelection(this));
    tr.delete(rm.from, rm.to);
    tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(rm.from, tr.doc.content.size))));
  }
  /** ⌘Z brings the blocks back selected. */
  getBookmark() {
    return blockMark(this.a, this.h);
  }
  eq(other: Selection): boolean {
    return other instanceof BlockSelection && other.from === this.from && other.to === this.to && other.a === this.a && other.h === this.h;
  }
  toJSON() {
    return { type: "block", a: this.a, h: this.h };
  }
}
const blockMark = (a: number, h: number): ReturnType<Selection["getBookmark"]> => ({
  map: (m) => blockMark(m.map(a), m.map(h)),
  resolve: (doc) => selectBlocks(doc, a, h) ?? TextSelection.near(doc.resolve(Math.min(a, doc.content.size))),
});
// The tint shows it; the browser's own selection stays hidden.
(BlockSelection.prototype as { visible: boolean }).visible = false;

/** The blocks from the one starting at `a` to the one starting at `h`, as they would be picked. */
export function selectBlocks(doc: PMNode, a: number, h: number): BlockSelection | null {
  const A = blockAt(doc, a + 1);
  const H = blockAt(doc, h + 1);
  if (!A || !H) return null;
  const $a = doc.resolve(A.from);
  const $h = doc.resolve(H.from);
  // The list (or the note) both sit in.
  let d = Math.min($a.depth, $h.depth);
  while (d > 0 && !($a.start(d) === $h.start(d) && isList($a.node(d)))) d--;
  const lo = (x: Block, $x: ResolvedPos) => ($x.depth === d ? x.from : $x.before(d + 1));
  const hi = (x: Block, $x: ResolvedPos) => ($x.depth === d ? x.to : $x.after(d + 1));
  let from = Math.min(lo(A, $a), lo(H, $h));
  let to = Math.max(hi(A, $a), hi(H, $h));
  // All of a list at the top of the note is that list.
  if (d === 1 && from === $a.start(1) && to === $a.end(1)) [from, to] = [$a.before(1), $a.after(1)];
  return new BlockSelection(A.from, H.from, doc.resolve(from), doc.resolve(to));
}

/** The blocks side by side from `from` to `to`, selected; null unless those are block edges in one parent. */
function selectSpan(doc: PMNode, from: number, to: number): BlockSelection | null {
  if (from >= to) return null;
  const $f = doc.resolve(from);
  const $t = doc.resolve(to);
  if ($f.depth !== $t.depth || $f.start() !== $t.start() || !$t.nodeBefore || !$f.nodeAfter) return null;
  return selectBlocks(doc, from, to - $t.nodeBefore.nodeSize);
}

function blockOfSelection(s: BlockSelection): Block {
  const node = s.$from.doc.nodeAt(s.from)!;
  return { from: s.from, to: s.to, node, item: node.type.name === "list_item" };
}

/** What a block action works on: the selected blocks, or the caret's block. */
export const selectedBlock = (state: EditorState): Block | null =>
  state.selection instanceof BlockSelection ? blockOfSelection(state.selection) : blockAt(state.doc, state.selection.from);
