import { defaultValueCtx, Editor, editorViewCtx, remarkStringifyOptionsCtx, rootCtx, serializerCtx } from "@milkdown/kit/core";
import type { MilkdownPlugin } from "@milkdown/kit/ctx";
import { history } from "@milkdown/kit/plugin/history";
import { clipboard } from "@milkdown/kit/plugin/clipboard";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { bulletListSchema, commonmark, linkAttr, remarkPreserveEmptyLinePlugin } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";
import { InputRule } from "@milkdown/kit/prose/inputrules";
import { findWrapping } from "@milkdown/kit/prose/transform";
import { $inputRule } from "@milkdown/kit/utils";
import { calloutSchema, remarkBlocks, toggleSchema, toggleSummarySchema } from "./blocks";
import { highlightSchema, remarkColors, stringifyColor, textColorSchema, underlineSchema } from "./colors";
import { alonePlugin } from "./alone";
import { blockSelPlugin } from "./blocksel";
import { dragSelPlugin } from "./dragsel";
import { tablePlugin, tableView } from "./tables";
import { mathBlockSchema, mathInlineSchema, mathRule, remarkNoteMath } from "./math";
import { emptyHints, foldPlugin, notionKeys, notionRules, pasteLink, trapTab } from "./notion";

/** A Milkdown editor over one note. `onChange` gets the editor's own Markdown after each edit. */
export async function createEditor(root: HTMLElement, markdown: string, onChange: (md: string) => void, plugins: MilkdownPlugin[] = []): Promise<Editor> {
  return Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, root);
      ctx.set(defaultValueCtx, markdown);
      // The style of his existing notes and of the CLI's appends.
      ctx.update(remarkStringifyOptionsCtx, (o) => ({ ...o, bullet: "-" as const, rule: "-" as const, handlers: { ...o.handlers, oreColor: stringifyColor as never } }));
      ctx.set(linkAttr.key, (mark) => (String(mark.attrs.href).startsWith("ore:") ? { class: "ore-link" } : {}));
      ctx.get(listenerCtx).updated((c) => onChange(c.get(serializerCtx)(c.get(editorViewCtx).state.doc)));
    })
    .use(remarkBlocks)
    .use(remarkColors)
    .use(remarkNoteMath)
    // Before the keymaps, so selected blocks get their keys first.
    .use(blockSelPlugin)
    .use(dragSelPlugin)
    .use(tablePlugin)
    .use(foldPlugin)
    .use(notionKeys)
    // Before the presets' own rules, which would take a shortcut first and do it otherwise.
    .use(notionRules)
    // Without it an empty paragraph saves as nothing, not as a `<br />` line.
    .use(commonmark.filter((p) => !remarkPreserveEmptyLinePlugin.includes(p)))
    .use(gfm)
    .use(tableView)
    .use([toggleSummarySchema, toggleSchema, calloutSchema, highlightSchema, textColorSchema, underlineSchema, mathInlineSchema, mathBlockSchema].flat())
    .use(taskRule)
    .use(mathRule)
    .use(history)
    .use(listener)
    .use(alonePlugin)
    .use(emptyHints)
    .use(pasteLink)
    .use(clipboard)
    .use(plugins)
    .create()
    .then((e) => (trapTab(root), e));
}

/** Notion's to-do shortcut: `[]`, `[ ]` or `[x]` then a space at the start of a line makes a
 *  checkbox item, also outside a list (GFM's own rule only works inside one). Saves as `- [ ]`. */
const taskRule = $inputRule((ctx) =>
  new InputRule(/^\[([ xX]?)\]\s$/, (state, match, start, end) => {
    const checked = match[1]!.toLowerCase() === "x";
    const $start = state.doc.resolve(start);
    for (let d = $start.depth; d > 0; d--) {
      const node = $start.node(d);
      if (node.type.name !== "list_item") continue;
      if (node.attrs.checked != null) return null;
      return state.tr.delete(start, end).setNodeMarkup($start.before(d), undefined, { ...node.attrs, checked });
    }
    const tr = state.tr.delete(start, end);
    const range = tr.doc.resolve(start).blockRange();
    const wrap = range && findWrapping(range, bulletListSchema.type(ctx));
    if (!range || !wrap) return null;
    tr.wrap(range, wrap);
    const item = tr.doc.nodeAt(range.start + 1)!;
    return tr.setNodeMarkup(range.start + 1, undefined, { ...item.attrs, checked });
  }),
);

export type Trigger = { kind: "link" | "slash" | "date"; query: string; /** Characters typed for it, trigger included. */ typed: number };

/** The menu the text before the caret opens: `[[` for links, `/` for blocks, `@` for dates. `/` opens
 *  at a line start, after a space, or right after an inline node such as a diagram ("￼", the
 *  placeholder `textBetween` gives a leaf), which is where the caret lands after ⌃End. */
export function menuTrigger(before: string): Trigger | null {
  const link = before.match(/\[\[([^[\]\n]{0,40})$/);
  if (link) return { kind: "link", query: link[1]!, typed: link[0].length };
  const slash = before.match(/(?:^|[\s￼])\/([a-z0-9#]{0,16})$/i);
  if (slash) return { kind: "slash", query: slash[1]!, typed: slash[1]!.length + 1 };
  // @ at the start of a word: Notion's dates (an email address has a letter before it).
  const date = before.match(/(?:^|[\s([{])@([a-z0-9 -]{0,16})$/i);
  return date ? { kind: "date", query: date[1]!, typed: date[1]!.length + 1 } : null;
}

/** Whether a `/` menu row answers what was typed after the slash: a part of its label (letters and digits
 *  only, so "todo" finds "To-do list"), or the start of one of the names Notion takes (`/h1`, `/#`, `/hr`). */
export function slashMatch(label: string, names: readonly string[], query: string): boolean {
  const q = query.toLowerCase().replace(/[^a-z0-9#]/g, "");
  return !q || label.toLowerCase().replace(/[^a-z0-9]/g, "").includes(q) || names.some((n) => n.startsWith(q));
}

/** The editor's Markdown for its current document. */
export const markdownOf = (editor: Editor): string => editor.action((ctx) => ctx.get(serializerCtx)(ctx.get(editorViewCtx).state.doc));
