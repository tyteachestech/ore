import { InputRule, undoInputRule } from "@milkdown/kit/prose/inputrules";
import { keymap } from "@milkdown/kit/prose/keymap";
import { setBlockType, toggleMark } from "@milkdown/kit/prose/commands";
import type { ResolvedPos } from "@milkdown/kit/prose/model";
import { splitListItem } from "@milkdown/kit/prose/schema-list";
import { type Command, type EditorState, Plugin, TextSelection } from "@milkdown/kit/prose/state";
import { $inputRule, $prose } from "@milkdown/kit/utils";
import { blockAt, kindOf, turnAtCaret, type Kind } from "./blockops";

// Notion's editing behaviours that Milkdown's presets lack or do otherwise, each one checked in
// test/notion-parity.test.ts (the checklist: docs/reviews/2026-11-06-notion-parity.md).

const inItem = ($p: ResolvedPos) => $p.depth > 1 && $p.node(-1).type.name === "list_item" && $p.index(-1) === 0;

/** A shortcut typed at the start of a list item's line turns the item, as Notion does: Milkdown's own
 *  rules only work on a line that is not in a list. Typed into the same kind it stays text. */
function turnTyped(state: EditorState, start: number, end: number, typed: string, kind: Kind, attrs?: Record<string, unknown>) {
  const tr = state.tr.delete(start, end);
  const next = state.apply(tr);
  const b = blockAt(next.doc, start);
  if (b && kindOf(next.doc, b) === kind) return state.tr.insertText(typed, end);
  const t = turnAtCaret(next, kind);
  if (!t) return null;
  for (const step of t.steps) tr.step(step);
  tr.setSelection(TextSelection.create(tr.doc, t.selection.from));
  if (attrs) tr.setNodeMarkup(tr.selection.$from.before(), undefined, attrs);
  return tr;
}

const listRule = (re: RegExp, kind: (m: RegExpMatchArray) => Kind, attrs?: (m: RegExpMatchArray) => Record<string, unknown>) =>
  $inputRule(
    () =>
      new InputRule(re, (state, m, start, end) =>
        inItem(state.doc.resolve(start)) ? turnTyped(state, start, end, m[0].slice(-1), kind(m), attrs?.(m)) : null,
      ),
  );

/** `#` to `###` in a list item turn it into a heading; typed in a heading they set its level (Milkdown
 *  adds the hashes to the level it has). */
const headingRule = $inputRule(
  () =>
    new InputRule(/^(#{1,6})\s$/, (state, m, start, end) => {
      const $s = state.doc.resolve(start);
      const level = m[1]!.length;
      if ($s.parent.type.name === "heading") return state.tr.delete(start, end).setNodeMarkup($s.before(), undefined, { ...$s.parent.attrs, level });
      return inItem($s) ? turnTyped(state, start, end, m[0].slice(-1), `h${Math.min(level, 3)}` as Kind) : null;
    }),
);

/** `"` then a space makes a quote (Notion), on a line of its own or a list item's. */
const quoteRule = $inputRule(
  () =>
    new InputRule(/^"\s$/, (state, m, start, end) => {
      const $s = state.doc.resolve(start);
      return $s.parent.type.name === "paragraph" && ($s.depth === 1 || inItem($s)) ? turnTyped(state, start, end, m[0].slice(-1), "quote") : null;
    }),
);

/** A web address typed then a space (or a stop) becomes a link, as Notion and every Mac text field do. */
const autolinkRule = $inputRule(
  () =>
    new InputRule(/(?:^|\s)(https?:\/\/[^\s<>]*[^\s<>.,;:!?)\]'"])([.,;:!?)]*\s)$/, (state, m, start, end) => {
      const $s = state.doc.resolve(start);
      const link = state.schema.marks.link;
      if (!link || $s.parent.type.spec.code) return null;
      // A stop or bracket after the address stays out of the link.
      const to = end - (m[2]!.length - 1);
      const from = to - m[1]!.length;
      if (state.doc.rangeHasMark(from, to, link)) return null;
      return state.tr.addMark(from, to, link.create({ href: m[1] })).insertText(m[2]!.slice(-1), end).removeStoredMark(link);
    }),
);

export const notionRules = [
  headingRule,
  listRule(/^\s*([-+*])\s$/, () => "bullet"),
  listRule(/^(\d+)\.\s$/, () => "number"),
  listRule(/^>\s$/, () => "quote"),
  listRule(/^```([a-z]*)\s$/, () => "code", (m) => ({ language: m[1] ?? "" })),
  quoteRule,
  autolinkRule,
].flat();

/** The caret at the start of its line, nothing selected. */
const atStart = (state: EditorState) => {
  const { selection: s } = state;
  return s instanceof TextSelection && s.empty && s.$from.parentOffset === 0 ? s.$from : null;
};

const run = (state: EditorState, dispatch: Parameters<Command>[1], kind: Kind) => {
  const tr = turnAtCaret(state, kind);
  if (tr && dispatch) dispatch(tr.scrollIntoView());
  return !!tr;
};

/** Backspace at the start of a heading, list item, to-do, quote, callout or toggle makes it text, as
 *  in Notion; a second one joins it to the block above. */
const backspace: Command = (state, dispatch) => {
  const $c = atStart(state);
  if (!$c) return false;
  if ($c.parent.type.name === "heading") return setBlockType(state.schema.nodes.paragraph!)(state, dispatch);
  return $c.depth > 1 && run(state, dispatch, "text");
};

/** Enter in a quote starts a line of text below it (Shift-Enter breaks the line inside), as in Notion. */
const enterInQuote: Command = (state, dispatch) => {
  const { selection: s } = state;
  const $c = s.$from;
  if (!s.empty || $c.depth !== 2 || $c.node(1).type.name !== "blockquote" || !$c.parent.content.size || $c.index(1) !== $c.node(1).childCount - 1) return false;
  if (!dispatch) return true;
  const rest = $c.parent.content.cut($c.parentOffset);
  const tr = state.tr.delete($c.pos, $c.end());
  const at = tr.mapping.map($c.after(1));
  tr.insert(at, state.schema.nodes.paragraph!.create(null, rest));
  dispatch(tr.setSelection(TextSelection.create(tr.doc, at + 1)).scrollIntoView());
  return true;
};

/** The list item the caret is in, and where it starts. */
function itemAt($p: ResolvedPos) {
  for (let d = $p.depth; d > 0; d--) if ($p.node(d).type.name === "list_item") return { node: $p.node(d), pos: $p.before(d) };
  return null;
}

/** Enter in a to-do starts an unticked one, however ticked the one above is. */
const enterInTodo: Command = (state, dispatch) => {
  const item = itemAt(state.selection.$from);
  if (item?.node.attrs.checked == null) return false;
  return splitListItem(state.schema.nodes.list_item!)(state, (tr) => {
    const next = itemAt(tr.selection.$from);
    if (next && next.pos !== item.pos && next.node.attrs.checked) tr.setNodeAttribute(next.pos, "checked", false);
    dispatch?.(tr.scrollIntoView());
  });
};

/** ⌘Enter ticks or unticks the caret's to-do. */
const tick: Command = (state, dispatch) => {
  const item = itemAt(state.selection.$from);
  if (item?.node.attrs.checked == null) return false;
  dispatch?.(state.tr.setNodeAttribute(item.pos, "checked", !item.node.attrs.checked));
  return true;
};

/** Tab in a code block indents the line. */
const tabInCode: Command = (state, dispatch) => {
  if (!state.selection.$from.parent.type.spec.code) return false;
  dispatch?.(state.tr.insertText("  "));
  return true;
};

/** Notion's ⌘⌥ keys: 0 text, 1 to 3 headings, 4 to-do, 5 bullet, 6 numbered, 7 toggle, 8 code. Inside a
 *  toggle, quote or callout the headings fall to Milkdown's own keys, which turn just the line. */
const KEYS: Kind[] = ["text", "h1", "h2", "h3", "todo", "bullet", "number", "toggle", "code"];
const turnKeys = Object.fromEntries(
  KEYS.map((kind, i): [string, Command] => [`Mod-Alt-${i}`, (state, dispatch) => run(state, dispatch, kind) || i > 3]),
);

/** Before Milkdown's keymaps, so these keys come first. */
export const notionKeys = $prose(() =>
  keymap({
    Backspace: backspace,
    Enter: (state, dispatch) => enterInQuote(state, dispatch) || enterInTodo(state, dispatch),
    "Mod-Enter": tick,
    Tab: tabInCode,
    "Mod-z": undoInputRule,
    "Mod-Shift-s": (state, dispatch) => toggleMark(state.schema.marks.strike_through!)(state, dispatch),
    ...turnKeys,
  }),
);

/** Tab that no key handler used stays in the note, as in Notion, instead of moving focus out to the
 *  next control: on the editor's box, which hears the key after the editor itself. */
export function trapTab(root: HTMLElement) {
  root.addEventListener("keydown", (e) => {
    if (e.key === "Tab" && !e.defaultPrevented && !e.metaKey && !e.ctrlKey && !e.altKey) e.preventDefault();
  });
}

/** A web address pasted over selected text links it; pasted on its own it comes in as a link. */
export const pasteLink = $prose(
  () =>
    new Plugin({
      props: {
        handlePaste: (view, e) => {
          const text = e.clipboardData?.getData("text/plain").trim() ?? "";
          const link = view.state.schema.marks.link;
          const { selection: s } = view.state;
          if (!link || !/^https?:\/\/\S+$/.test(text) || s.$from.parent.type.spec.code) return false;
          const mark = link.create({ href: text });
          if (!s.empty && s.$from.sameParent(s.$to)) view.dispatch(view.state.tr.addMark(s.from, s.to, mark));
          else view.dispatch(view.state.tr.replaceSelectionWith(view.state.schema.text(text, [mark]), false).removeStoredMark(link));
          return true;
        },
      },
    }),
);
