import type { Editor } from "@milkdown/kit/core";
import { editorViewCtx, serializerCtx } from "@milkdown/kit/core";
import {
  createCodeBlockCommand, imageSchema, insertHrCommand, linkSchema, turnIntoTextCommand, wrapInBlockquoteCommand, wrapInBulletListCommand,
  wrapInHeadingCommand, wrapInOrderedListCommand,
} from "@milkdown/kit/preset/commonmark";
import { insertTableCommand } from "@milkdown/kit/preset/gfm";
import { toggleMark, wrapIn } from "@milkdown/kit/prose/commands";
import type { Node as PmNode } from "@milkdown/kit/prose/model";
import { closeHistory, isHistoryTransaction } from "@milkdown/kit/prose/history";
import { NodeSelection, Plugin, PluginKey, TextSelection, type EditorState } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet, type EditorView, type ViewMutationRecord } from "@milkdown/kit/prose/view";
import { $prose, $view, callCommand } from "@milkdown/kit/utils";
import { convertFileSrc } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { forwardRef, lazy, Suspense, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { Scene } from "../Diagram";
import { ore, PHONE, type Diagram } from "../ore";
import { usePeek } from "../Peek";
import { errorText, type Notify } from "../util";
import { calloutSchema, diagramName, toggleSchema, toggleSummarySchema } from "./blocks";
import { board, sizeOf, withSize, type Size } from "./board";
import { createEditor, markdownOf, menuTrigger, slashMatch } from "./editor";
import { lastPaint, paint } from "./colors";
import { mathBlockSchema, mathInlineSchema, mathViews } from "./math";
import * as Popover from "@radix-ui/react-popover";
import { dateRows } from "./dates";
import { keepUnedited } from "./preserve";
import { BlockHandle, nearest, spot, type Spot } from "./BlockHandle";
import { copiedFiles, pastesFiles } from "../copied";
import { imageExt, noteImage } from "../paste";
import { TableControls } from "./TableControls";
import { KeyboardBar } from "./KeyboardBar";
import { SelectionBar, type Sel } from "./SelectionBar";
import { WithMenu, type MenuAction } from "../Menu";
import { blockAt, duplicate, moveBy, selectBlocks, selectedBlock, topGaps, turnAtCaret, type Kind } from "./blockops";
import { is } from "../keys";
import { lineShown, menuPlace, type Side } from "../popup-place";

/** What a link can point at (D39): a source, or a skill (its note, D41). */
export type LinkTarget = { kind: "item" | "skill"; id: string; title: string };

export type NoteEditorHandle = {
  focus: () => void;
  /** Notion's click below the note: the caret at the end, on a new empty line when the note ends in a block that
   *  holds no text (a diagram, a table, a list). */
  focusEnd: () => void;
  /** Notion's +: a new line at the end with the / menu open; Esc takes the line back out. */
  addBlock: () => void;
  /** A chapter's block (D115): `## heading` at the end, then one empty line per prompt, shown as a
   *  placeholder until he writes on it. The caret goes to the first. Nothing of it is text. */
  scaffold: (heading: string, prompts: string[]) => void;
  /** Ends the block: lines still empty go, and the heading too when he wrote nothing under it.
   *  Resolves to what he wrote under the heading (Markdown), or null. */
  settle: () => string | null;
  /** Whether he has written anything in the open block yet (text, or a diagram or image). */
  written: () => boolean;
};

/** The scaffold's lines, as node decorations mapped through his edits: the heading first, then the
 *  prompt lines, each carrying its prompt. */
const ghosts = new PluginKey<DecorationSet>("ore-ghosts");
const ghostPlugin = $prose(
  () =>
    new Plugin<DecorationSet>({
      key: ghosts,
      state: {
        init: () => DecorationSet.empty,
        apply: (tr, set) => tr.getMeta(ghosts) ?? set.map(tr.mapping, tr.doc),
      },
      props: { decorations: (state) => ghosts.getState(state) ?? null },
    }),
);

/** Where the scaffold's block starts (its heading), mapped through his edits: renaming the heading
 *  or writing above it never loses the block. */
const blockStart = new PluginKey<number | null>("ore-block-start");
const blockStartPlugin = $prose(
  () =>
    new Plugin<number | null>({
      key: blockStart,
      state: {
        init: () => null,
        apply: (tr, at) => (tr.getMeta(blockStart) !== undefined ? tr.getMeta(blockStart) : at === null ? null : tr.mapping.map(at, 1)),
      },
    }),
);

/** The open block in this state: its heading, if still there, where his writing starts, and
 *  whether he has written anything (text counts, and so does a diagram or image with no words). */
function blockIn(state: EditorState) {
  const { doc } = state;
  const at = Math.min(blockStart.getState(state) ?? doc.content.size, doc.content.size);
  const first = doc.nodeAt(at);
  const h = first?.type.name === "heading" ? { from: at, to: at + first.nodeSize } : null;
  const from = h?.to ?? at;
  let written = false;
  doc.nodesBetween(from, doc.content.size, (n) => {
    if (n.isText ? !!n.text?.trim() : n.isLeaf && n.type.name !== "hardbreak") written = true;
    return !written;
  });
  return { h, from, written };
}

type Props = {
  /** The file as loaded. Remount (change `key`) to load other text. */
  text: string;
  /** The new file text after an edit: the editor's Markdown with untouched blocks as they were. */
  onChange: (text: string) => void;
  onBlur?: () => void;
  /** Absolute folder of the note; relative image paths resolve against it. */
  dir: string;
  targets: LinkTarget[];
  onOpen: (target: Omit<LinkTarget, "title">) => void;
  /** Copies an image beside the note (a file's path, a pasted one's bytes in base64, or, with none,
   *  one he picks); resolves its relative path, or null. */
  onAttach: (from?: string | { ext: string; data: string }) => Promise<string | null>;
  /** The CLI arguments that name this note, for `ore diagram` (D40). */
  noteArgs: string[];
  notify: Notify;
  placeholder: string;
  /** The editor's accessible name: its placeholder is drawn by CSS, so VoiceOver hears this instead. */
  label: string;
  /** Set to a reader of the editor's text as of now, for a save that can't wait for its next change
   *  report (those come 200 ms after typing stops, and never when the editor closes first). */
  pull?: { current: (() => string | null) | null };
  /** Names the note: its caret is kept when the editor closes and put back when it opens again. */
  place?: string;
};

// The diagram editor loads only when a diagram is shown or drawn (D40, D103).
const DiagramEditor = lazy(() => import("../Diagram"));
/** Fired after a diagram is saved, so its preview redraws; detail is `<note dir>/<name>`. */
const SAVED = "ore:diagram-saved";

type Menu = { kind: "slash" | "link" | "date"; query: string; from: number; to: number };
/** `names`: what Notion also takes after `/` for it (`/h1`, `/#`, `/hr`). */
type Row = { label: string; sub?: string; names?: string[]; run: () => void };

const LINK_URL = /^ore:(item|skill)\/(.+)$/;

/** Whether the last mousemove changed the pointer's position. WebKit also fires one when content
 *  moves under a resting pointer, which must not count as pointing at a menu row. */
let pointerMoved = false;
let pointerAt = "";
window.addEventListener(
  "mousemove",
  (e) => {
    const at = `${e.screenX},${e.screenY}`;
    pointerMoved = at !== pointerAt;
    pointerAt = at;
  },
  true,
);

/** The caret of an editor that had focus as it unmounted. A remount for outside text (a merged
 *  save) mounts the next one in the same commit, which takes it, so typing carries on there. */
let handoff: { pos: number; at: number } | null = null;
/** The selection each note (by `place`) had when its editor last closed. */
const places = new Map<string, { anchor: number; head: number }>();

/** The note editor (D38): Markdown shortcuts, a `/` menu, `[[` links, `@` dates. No AI anywhere in it (D34.2). */
export const NoteEditor = forwardRef<NoteEditorHandle, Props>(function NoteEditor(p, ref) {
  const root = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<Editor | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [index, setIndex] = useState(0);
  const [sel, setSel] = useState<Sel | null>(null);
  const [askLink, setAskLink] = useState(0);
  /** ⌘K came before the format bar was up (the selection made that same moment): it opens with its link field. */
  const [linkNow, setLinkNow] = useState(false);
  useEffect(() => void (linkNow && setLinkNow(false)), [linkNow]);
  /** The equation open for editing: where it is, and where its field goes. */
  const [math, setMath] = useState<{ pos: number; x: number; y: number; w: number; h: number } | null>(null);
  /** Where images dragged in from Finder will land: a gap between the note's blocks. */
  const [dropLine, setDropLine] = useState<{ x: number; y: number; w: number } | null>(null);
  /** The diagram open in the overlay; `at` is where a new one goes once it has a drawing. */
  const [drawing, setDrawing] = useState<{ name: string; at?: number } | null>(null);
  // The editor's plugins live as long as it does; they read the latest props, rows and menu
  // through this. The menu here is set as the caret moves, ahead of React's render.
  const live = useRef<Live["current"]>({ p, menu, rowsFor: () => [], index, dismissed: { at: -1, ch: "" }, added: null, draw: (name) => setDrawing({ name }), askLink: () => setAskLink((n) => n + 1), linkNow: () => setLinkNow(true), bar: false, putImages: async () => {}, editMath: () => {}, renames: new Set() });

  /** The format bar's selection; `live.current.bar` says whether it is up, for ⌘K. */
  const showSel = (s: Sel | null) => {
    live.current.bar = !!s;
    setSel(s);
  };

  // Creation is async: a focus asked for before the editor exists (opening the source note) waits for it.
  const wantFocus = useRef(false);
  useImperativeHandle(ref, () => ({
    focus: () => (editor.current ? editor.current.action((ctx) => ctx.get(editorViewCtx).focus()) : void (wantFocus.current = true)),
    focusEnd: () => {
      if (!editor.current) return void (wantFocus.current = true);
      editor.current.action((ctx) => {
        const v = ctx.get(editorViewCtx);
        const { doc, schema } = v.state;
        let tr = v.state.tr;
        if (doc.lastChild?.type !== schema.nodes.paragraph) tr = tr.insert(doc.content.size, schema.nodes.paragraph!.create());
        v.dispatch(tr.setSelection(TextSelection.atEnd(tr.doc)).scrollIntoView());
        v.focus();
      });
    },
    addBlock: () =>
      editor.current?.action((ctx) => {
        const v = ctx.get(editorViewCtx);
        const { doc, schema } = v.state;
        const last = doc.lastChild;
        // An empty last line is reused, as Notion does, so repeated clicks never stack blank lines.
        const reuse = !!last && last.type === schema.nodes.paragraph && last.content.size === 0;
        const at = reuse ? doc.content.size - last!.nodeSize : doc.content.size;
        let tr = v.state.tr;
        if (!reuse) tr = tr.insert(at, schema.nodes.paragraph!.create());
        tr = tr.insertText("/", at + 1);
        live.current.added = { at, made: !reuse };
        live.current.dismissed = { at: -1, ch: "" };
        v.dispatch(tr.setSelection(TextSelection.create(tr.doc, at + 2)).scrollIntoView());
        v.focus();
      }),
    scaffold: (heading, prompts) => (editor.current ? scaffoldNow(heading, prompts) : void (wantScaffold.current = { heading, prompts })),
    settle: () => {
      wantScaffold.current = null;
      const title = scaffoldTitle.current;
      scaffoldTitle.current = null;
      if (!editor.current || title === null) return null;
      return editor.current.action((ctx) => {
        const v = ctx.get(editorViewCtx);
        const lines = ghosts.getState(v.state)?.find() ?? [];
        const { doc } = v.state;
        const { h, from, written } = blockIn(v.state);
        const empty = (d: Decoration) => {
          const node = doc.nodeAt(d.from);
          return !!node && node.type.name === "paragraph" && node.content.size === 0;
        };
        const gone = [...lines.filter(empty), ...(written || !h ? [] : [h])].sort((a, b) => b.from - a.from);
        let tr = v.state.tr;
        for (const d of gone) tr = tr.delete(d.from, d.to);
        v.dispatch(tr.setMeta(ghosts, DecorationSet.empty).setMeta(blockStart, null));
        if (!written) return null;
        const after = tr.doc.slice(tr.mapping.map(from), tr.doc.content.size).content;
        return ctx.get(serializerCtx)(tr.doc.type.create(null, after)).trim() || null;
      });
    },
    written: () => !!editor.current && scaffoldTitle.current !== null && editor.current.action((ctx) => blockIn(ctx.get(editorViewCtx).state).written),
  }), []);
  const wantScaffold = useRef<{ heading: string; prompts: string[] } | null>(null);
  const scaffoldTitle = useRef<string | null>(null);
  const scaffoldNow = (heading: string, prompts: string[]) =>
    editor.current?.action((ctx) => {
      scaffoldTitle.current = heading;
      const v = ctx.get(editorViewCtx);
      const { doc, schema } = v.state;
      // Back to a block he left with Esc: his heading is already there, so only the prompts come back.
      const heads: { text: string; at: number }[] = [];
      doc.forEach((node, at) => void (node.type.name === "heading" && heads.push({ text: node.textContent, at })));
      const kept = heads.at(-1)?.text === heading ? heads.at(-1) : undefined;
      const head = kept ? null : schema.nodes.heading!.create({ level: 2 }, schema.text(heading));
      const lines = prompts.map(() => schema.nodes.paragraph!.create());
      const at = doc.content.size;
      const tr = v.state.tr.insert(at, head ? [head, ...lines] : lines);
      const decos: Decoration[] = [];
      let pos = at + (head?.nodeSize ?? 0);
      for (const [i, line] of lines.entries()) {
        decos.push(Decoration.node(pos, pos + line.nodeSize, { class: "ghost", "data-ghost": prompts[i]! }, { "data-ghost": prompts[i]! }));
        pos += line.nodeSize;
      }
      tr.setMeta(ghosts, DecorationSet.create(tr.doc, decos)).setMeta(blockStart, kept?.at ?? at);
      v.dispatch(tr.setSelection(TextSelection.create(tr.doc, at + (head?.nodeSize ?? 0) + 1)).scrollIntoView());
      v.focus();
    });

  useEffect(() => {
    let gone = false;
    let base: string | null = null;
    let read: (() => string) | null = null;
    const original = live.current.p.text;
    const caret = handoff && performance.now() - handoff.at < 500 ? handoff.pos : null;
    const kept = caret === null && live.current.p.place ? places.get(live.current.p.place) : undefined;
    // Each editor gets its own element, removed at once on unmount: creation is async, so an
    // editor still being created must never share the DOM with the next one.
    const el = root.current!.appendChild(document.createElement("div"));
    void createEditor(
      el,
      original,
      // Also when the edit is taken back to the text as loaded, so the undone version is saved over.
      (md) => base !== null && live.current.p.onChange(keepUnedited(original, base, md)),
      [menuPlugin(live, setMenu, setIndex), ...(PHONE ? [] : [selBarPlugin(host, showSel)]), imagePaste(live), imageView(live), ...mathViews((pos) => live.current.editMath(pos)), followRenames(live), toggleView, ghostPlugin, blockStartPlugin],
    ).then((e) => {
      if (gone) return void e.destroy();
      editor.current = e;
      e.action((ctx) => {
        const dom = ctx.get(editorViewCtx).dom;
        dom.setAttribute("aria-label", live.current.p.label);
        dom.setAttribute("aria-multiline", "true");
      });
      base = markdownOf(e);
      const b = base;
      if (live.current.p.pull) live.current.p.pull.current = read = () => keepUnedited(original, b, markdownOf(e));
      if (kept && !wantScaffold.current)
        e.action((ctx) => {
          const v = ctx.get(editorViewCtx);
          const at = (n: number) => v.state.doc.resolve(Math.min(n, v.state.doc.content.size));
          v.dispatch(v.state.tr.setSelection(TextSelection.between(at(kept.anchor), at(kept.head))));
        });
      if (wantScaffold.current) {
        const { heading, prompts } = wantScaffold.current;
        wantScaffold.current = null;
        scaffoldNow(heading, prompts);
      }
      if (caret !== null)
        e.action((ctx) => {
          const v = ctx.get(editorViewCtx);
          v.dispatch(v.state.tr.setSelection(TextSelection.near(v.state.doc.resolve(Math.min(caret, v.state.doc.content.size)))));
          v.focus();
        });
      else if (wantFocus.current) e.action((ctx) => ctx.get(editorViewCtx).focus());
    });
    return () => {
      gone = true;
      const pull = live.current.p.pull;
      if (pull && pull.current === read) pull.current = null;
      el.remove();
      editor.current?.destroy();
      editor.current = null;
    };
  }, []);

  // A layout cleanup runs before React removes the DOM, while the editor still has focus.
  useLayoutEffect(
    () => () => {
      const v = editor.current?.action((ctx) => ctx.get(editorViewCtx));
      if (v?.hasFocus()) handoff = { pos: v.state.selection.head, at: performance.now() };
      const place = live.current.p.place;
      if (v && place) places.set(place, { anchor: v.state.selection.anchor, head: v.state.selection.head });
    },
    [],
  );

  const view = () => editor.current?.action((ctx) => ctx.get(editorViewCtx));
  const peek = usePeek((t) => live.current.p.onOpen(t));
  /** The source or skill a `[[` link's anchor points at; its DOM href is sanitized, so read the mark. */
  const linkAt = (a: HTMLElement) => {
    const v = view();
    if (!v) return null;
    const pos = v.posAtDOM(a, 0);
    const link = [...(v.state.doc.nodeAt(pos)?.marks ?? []), ...v.state.doc.resolve(pos).marks()].find((m) => m.type.name === "link");
    const m = String(link?.attrs.href ?? "").match(LINK_URL);
    return m ? { kind: m[1] as LinkTarget["kind"], id: m[2]! } : null;
  };

  /** Removes the typed trigger ("/hea", "[[mak") before running a menu row. */
  const clear = (m: Menu) => {
    const v = view();
    if (v) v.dispatch(v.state.tr.delete(m.from, m.to));
    live.current.menu = null;
    setMenu(null);
    return v;
  };

  const rowsFor = (menu: Menu | null): Row[] => {
    if (!menu) return [];
    const q = menu.query.trim().toLowerCase();
    if (menu.kind === "date")
      return dateRows(menu.query).map((d) => ({
        label: d.label,
        sub: d.iso, // what it saves
        run: () => {
          const v = clear(menu);
          if (!v) return;
          v.dispatch(v.state.tr.insertText(d.iso));
          v.focus();
        },
      }));
    if (menu.kind === "link") {
      const hits = p.targets.filter((t) => t.title.toLowerCase().includes(q));
      hits.sort((a, b) => Number(!a.title.toLowerCase().startsWith(q)) - Number(!b.title.toLowerCase().startsWith(q)));
      return hits.slice(0, 8).map((t) => ({
        label: t.title,
        sub: t.kind === "skill" ? "Skill note" : undefined,
        run: () => {
          const v = clear(menu);
          if (!v) return;
          const mark = linkSchema.type(ctxOf(editor.current!)).create({ href: `ore:${t.kind}/${t.id}` });
          v.dispatch(v.state.tr.replaceSelectionWith(v.state.schema.text(t.title, [mark]), false).setStoredMarks([]));
          v.focus();
        },
      }));
    }
    const cmd = (key: Parameters<typeof callCommand>[0], payload?: unknown) => () => {
      clear(menu);
      editor.current?.action(callCommand(key, payload));
    };
    const call = (key: Parameters<typeof callCommand>[0], payload?: unknown) => () => editor.current?.action(callCommand(key, payload));
    /** Turns the caret's line, as Notion's / does, in a list item too; `there` where Turn into would take
     *  a whole toggle, quote or callout around it. */
    const turn = (kind: Kind, there: () => void) => () => {
      const v = clear(menu);
      const tr = v && turnAtCaret(v.state, kind);
      if (tr) v!.dispatch(tr.scrollIntoView());
      else there();
    };
    const all: Row[] = [
      { label: "Text", names: ["plain"], run: turn("text", call(turnIntoTextCommand.key)) },
      { label: "Heading 1", sub: "#", names: ["h1", "#"], run: turn("h1", call(wrapInHeadingCommand.key, 1)) },
      { label: "Heading 2", sub: "##", names: ["h2", "##"], run: turn("h2", call(wrapInHeadingCommand.key, 2)) },
      { label: "Heading 3", sub: "###", names: ["h3", "###"], run: turn("h3", call(wrapInHeadingCommand.key, 3)) },
      { label: "Bulleted list", sub: "-", names: ["ul"], run: turn("bullet", call(wrapInBulletListCommand.key)) },
      { label: "Numbered list", sub: "1.", names: ["ol"], run: turn("number", call(wrapInOrderedListCommand.key)) },
      {
        label: "To-do list",
        sub: "[ ]",
        names: ["check", "checkbox", "task"],
        run: turn("todo", () => {
          call(wrapInBulletListCommand.key)();
          const v = view();
          if (!v) return;
          const { $from } = v.state.selection;
          for (let d = $from.depth; d > 0; d--)
            if ($from.node(d).type.name === "list_item") return v.dispatch(v.state.tr.setNodeAttribute($from.before(d), "checked", false));
        }),
      },
      { label: "Quote", sub: '"', run: turn("quote", call(wrapInBlockquoteCommand.key)) },
      {
        label: "Callout",
        sub: "> [!note]",
        run: turn("callout", () => {
          const v = view();
          if (v) wrapIn(calloutSchema.type(ctxOf(editor.current!)), { kind: "note" })(v.state, v.dispatch);
        }),
      },
      ...[0, 1, 2, 3].map((level) => ({
        label: level ? `Toggle heading ${level}` : "Toggle",
        sub: level ? undefined : ">",
        run: turn(level ? (`th${level}` as Kind) : "toggle", () => {
          const v = view();
          if (!v) return;
          const ctx = ctxOf(editor.current!);
          const node = toggleSchema.type(ctx).create({ level }, [toggleSummarySchema.type(ctx).create(), v.state.schema.nodes.paragraph!.create()]);
          const { $from } = v.state.selection;
          const empty = $from.parent.type.name === "paragraph" && !$from.parent.content.size;
          const at = empty ? $from.before() : $from.after();
          const tr = empty ? v.state.tr.replaceWith(at, $from.after(), node) : v.state.tr.insert(at, node);
          v.dispatch(tr.setSelection(TextSelection.create(tr.doc, at + 2)));
        }),
      })),
      { label: "Table", sub: "| |", run: cmd(insertTableCommand.key, { row: 3, col: 3 }) },
      { label: "Code", sub: "```", run: turn("code", call(createCodeBlockCommand.key)) },
      {
        label: "Inline equation",
        sub: "$$",
        names: ["equation", "tex"],
        run: () => {
          const v = clear(menu);
          if (!v) return;
          const at = v.state.selection.from;
          v.dispatch(v.state.tr.replaceSelectionWith(mathInlineSchema.type(ctxOf(editor.current!)).create()));
          live.current.editMath(at);
        },
      },
      {
        label: "Block equation",
        names: ["math", "latex", "equation"],
        run: () => {
          const v = clear(menu);
          if (!v) return;
          const { $from } = v.state.selection;
          const node = mathBlockSchema.type(ctxOf(editor.current!)).create();
          // On an empty line of its own it takes the line; anywhere else (a list, a table) it goes below the block.
          const empty = $from.depth === 1 && $from.parent.type.name === "paragraph" && !$from.parent.content.size;
          const at = empty ? $from.before() : $from.after(1);
          v.dispatch(empty ? v.state.tr.replaceWith(at, $from.after(), node) : v.state.tr.insert(at, node));
          live.current.editMath(at);
        },
      },
      { label: "Divider", sub: "---", names: ["hr", "line"], run: cmd(insertHrCommand.key) },
      {
        label: "Image",
        names: ["img", "picture", "photo"],
        run: () => {
          clear(menu);
          void live.current.putImages([undefined]);
        },
      },
      {
        label: "Diagram",
        sub: "Map, sketch, matrix",
        run: () => {
          const at = clear(menu)?.state.selection.from;
          ore<Diagram>("diagram", ...p.noteArgs, "--new").then(
            (d) => setDrawing({ name: d.name, at }),
            (e) => p.notify(errorText(e), "error"),
          );
        },
      },
      {
        label: "Link",
        sub: "[[",
        run: () => {
          const v = clear(menu);
          if (v) v.dispatch(v.state.tr.insertText("[["));
        },
      },
      {
        label: "Date",
        sub: "@",
        run: () => {
          const v = clear(menu);
          if (v) v.dispatch(v.state.tr.insertText("@"));
        },
      },
    ];
    return all.filter((r) => slashMatch(r.label, r.names ?? [], q));
  };
  const rows = rowsFor(menu);
  const menuBox = useRef<HTMLDivElement>(null);
  useMenuPlace(menuBox, view, menu, rows.length, index);
  /** Selects the row under a pointer that moved. A menu that opens under a resting pointer keeps
   *  its first row, as in Notion and Raycast; mouseenter would fire there and select another. */
  const hover = (i: number) => {
    if (!pointerMoved) return;
    live.current.index = i;
    setIndex(i);
  };

  /** Links a new diagram where /diagram was typed, once (on its first save or at Done); false when this
   *  editor has closed meanwhile, so the diagram links it through the note's file instead. */
  const linkDiagram = (name: string): boolean => {
    const d = drawing;
    if (!d || d.at === undefined) return true;
    const v = view();
    if (!v) return false;
    const at = d.at;
    d.at = undefined;
    const img = imageSchema.type(ctxOf(editor.current!)).create({ src: `diagrams/${name}.excalidraw`, alt: "Diagram" });
    const tr = v.state.tr.setSelection(TextSelection.create(v.state.doc, Math.min(at, v.state.doc.content.size)));
    v.dispatch(tr.replaceSelectionWith(img));
    // Reported now, not after the editor's pause: focus is in the drawing, so no blur saves it, and
    // switching the panel's tab next would drop the link.
    const now = p.pull?.current?.();
    if (now != null) p.onChange(now);
    return true;
  };
  const closeDiagram = (scene: Scene | null, name: string) => {
    const d = drawing;
    setDrawing(null);
    lastRead.delete(`${p.dir}/${name}`);
    const v = view();
    // Closing the overlay returns focus to the note, where it came from.
    v?.focus();
    if (!d || !scene) return;
    window.dispatchEvent(new CustomEvent(SAVED, { detail: `${p.dir}/${name}` }));
    linkDiagram(name);
  };
  /** A diagram renamed in its editor: the note's link follows, and saves with the note. It is one step
   *  of the note's ⌘Z, which renames the file back with it (followRenames). */
  const renamedDiagram = (from: string, to: string) => {
    const v = view();
    if (!v) return;
    let tr = v.state.tr;
    v.state.doc.descendants((n, pos) => {
      if (n.type.name === "image" && n.attrs.src === `diagrams/${from}.excalidraw`) tr = tr.setNodeMarkup(pos, undefined, { ...n.attrs, src: `diagrams/${to}.excalidraw` });
    });
    if (!tr.docChanged) return;
    live.current.renames.add(`${from} ${to}`).add(`${to} ${from}`);
    v.dispatch(closeHistory(tr));
  };
  live.current.p = p;
  live.current.rowsFor = rowsFor;

  /** The diagram preview under the last right-click, and its menu: open it, or take it out of the
   *  note (⌘Z puts it back; the drawing's file stays beside the note). */
  const rightClicked = useRef<HTMLElement | null>(null);
  const diagramActions = (): MenuAction[] => {
    const v = view();
    const dom = rightClicked.current;
    if (!v || !dom) return [];
    let at = -1;
    let name: string | null = null;
    v.state.doc.descendants((n, pos) => {
      if (at < 0 && n.type.name === "image" && v.nodeDOM(pos) === dom) {
        at = pos;
        name = diagramName(String(n.attrs.src ?? ""));
      }
      return at < 0;
    });
    if (at < 0 || !name) return [];
    const drawn: string = name;
    return [
      { id: "open", label: "Open diagram", hint: "↵", run: () => live.current.draw(drawn) },
      {
        id: "remove",
        label: "Remove from note",
        danger: true,
        divider: true,
        run: () => {
          const node = v.state.doc.nodeAt(at);
          if (node) v.dispatch(v.state.tr.delete(at, at + node.nodeSize));
          v.focus();
        },
      },
    ];
  };

  live.current.editMath = (pos) => {
    const v = view();
    const dom = v?.nodeDOM(pos) as HTMLElement | null;
    const h = host.current?.getBoundingClientRect();
    if (!v || !dom?.getBoundingClientRect || !h) return;
    const r = dom.getBoundingClientRect();
    setMath({ pos, x: r.left - h.left, y: r.top - h.top, w: r.width, h: r.height });
  };

  /** Images pasted, dropped or picked, as in Notion: each is copied beside the note (`undefined`: he
   *  picks one), then put in at the caret, or, dropped, on a line of its own before the note's `before`th
   *  block (counted at the time, so typing during the copy never puts it inside a line). One editor
   *  step each, so ⌘Z takes it out again. */
  live.current.putImages = async (files, before) => {
    for (const f of files) {
      const src = await live.current.p.onAttach(f);
      const v = view();
      if (!src || !v) continue;
      const img = imageSchema.type(ctxOf(editor.current!)).create({ src, alt: "" });
      if (before === undefined) {
        v.dispatch(v.state.tr.replaceSelectionWith(img).scrollIntoView());
      } else {
        const doc = v.state.doc;
        let at = 0;
        for (let i = 0; i < Math.min(before, doc.childCount); i++) at += doc.child(i).nodeSize;
        const tr = v.state.tr.insert(at, v.state.schema.nodes.paragraph!.create(null, img));
        before++;
        v.dispatch(tr.setSelection(TextSelection.create(tr.doc, at + img.nodeSize + 1)).scrollIntoView());
      }
      v.focus();
    }
  };

  // Images dragged in from Finder: the webview gets no DOM drag events for files, so the app's drop
  // handler finds the note under the pointer and tells it (App.tsx). A line shows the gap they land
  // in; the gaps are measured once per drag, as a block's drag does.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let spots: Spot[] | null = null;
    const spotAt = (x: number, y: number) => {
      const v = view();
      if (!v) return null;
      spots ??= topGaps(v.state.doc).map((g) => spot(v, g));
      return nearest(spots, x, y);
    };
    const drag = (e: Event) => {
      const at = (e as CustomEvent<{ x: number; y: number } | null>).detail;
      if (!at) spots = null;
      const s = at && spotAt(at.x, at.y);
      const h = el.getBoundingClientRect();
      const line = s ? { x: s.left - h.left, y: s.y - h.top - 1, w: s.right - s.left } : null;
      setDropLine((was) => (was && line && was.x === line.x && was.y === line.y && was.w === line.w ? was : line));
    };
    const drop = (e: Event) => {
      const d = (e as CustomEvent<{ paths: string[]; x: number; y: number }>).detail;
      const s = spotAt(d.x, d.y);
      spots = null;
      setDropLine(null);
      const v = view();
      void live.current.putImages(d.paths, s && v ? topGaps(v.state.doc).findIndex((g) => g.pos === s.gap.pos) : undefined);
    };
    el.addEventListener("ore-image-drag", drag);
    el.addEventListener("ore-image-drop", drop);
    return () => {
      el.removeEventListener("ore-image-drag", drag);
      el.removeEventListener("ore-image-drop", drop);
    };
  }, []);

  return (
    <div
      ref={host}
      className="note-editor"
      style={{ "--placeholder": JSON.stringify(p.placeholder) } as CSSProperties}
      onBlur={p.onBlur}
      onMouseOver={(e) => {
        const a = (e.target as HTMLElement).closest?.("a");
        const t = a && linkAt(a);
        if (a && t) peek.hover(a, t);
      }}
      onMouseOut={(e) => {
        const a = (e.target as HTMLElement).closest?.("a");
        if (a && !a.contains(e.relatedTarget as Node | null)) peek.leave();
      }}
      // Typing puts the peek away.
      onKeyDown={peek.close}
    >
      {/* A diagram's preview has its own right-click menu (Excalidraw's embeds in Notion); the
          note's text keeps the Mac's (native-menu.ts). */}
      <WithMenu actions={diagramActions}>
        <div ref={root} onContextMenuCapture={(e) => (rightClicked.current = (e.target as HTMLElement).closest?.(".note-diagram") ?? null)} />
      </WithMenu>
      {math && <MathField key={math.pos} at={math} view={view} onClose={() => setMath(null)} />}
      {dropLine && <div className="block-drop" style={{ left: dropLine.x, top: dropLine.y, width: dropLine.w }} />}
      {!PHONE && <BlockHandle view={view} host={host} />}
      {!PHONE && <TableControls view={view} host={host} />}
      {PHONE && <KeyboardBar view={view} targets={p.targets} />}
      {sel && !menu && <SelectionBar key={`${sel.from}-${sel.to}`} view={view} sel={sel} targets={p.targets} onDone={() => showSel(null)} askLink={askLink} linkNow={linkNow} />}
      {menu && (menu.kind !== "date" || rows.length > 0) && (
        <div ref={menuBox} className="note-menu" role="listbox" onMouseDown={(e) => e.preventDefault()}>
          {rows.length ? (
            rows.map((r, i) => (
              <div key={r.label + i} role="option" aria-selected={i === index} className={`note-menu-row${i === index ? " on" : ""}`} onMouseMove={() => hover(i)} onClick={r.run}>
                <span className="label">{r.label}</span>
                {r.sub && <span className="sub">{r.sub}</span>}
              </div>
            ))
          ) : (
            <div className="note-menu-empty">{menu.kind === "link" ? "No source or skill by that name" : "No block by that name"}</div>
          )}
        </div>
      )}
      {peek.view}
      {drawing && (
        <Suspense fallback={null}>
          <DiagramEditor args={p.noteArgs} name={drawing.name} loaded={lastRead.get(`${p.dir}/${drawing.name}`)} notify={p.notify} onClose={closeDiagram} onFirstSave={linkDiagram} onRenamed={renamedDiagram} onLink={(href) => {
            const m = href.match(LINK_URL);
            if (m) p.onOpen({ kind: m[1] as LinkTarget["kind"], id: m[2]! });
            else void openUrl(href);
          }} />
        </Suspense>
      )}
    </div>
  );
});

type Live = {
  current: {
    p: Props;
    menu: Menu | null;
    rowsFor: (m: Menu | null) => Row[];
    index: number;
    /** Where the menu Esc closed starts, and the character there then. */
    dismissed: { at: number; ch: string };
    /** The line the + just added (`made`) or reused, while its / menu is open. */
    added: { at: number; made: boolean } | null;
    draw: (name: string) => void;
    /** Opens the format bar's web link field on the selected text (⌘K), while the bar is up (`bar`). */
    askLink: () => void;
    /** As `askLink`, when the bar comes up with this same key. */
    linkNow: () => void;
    bar: boolean;
    /** Opens the equation at `pos` for editing. */
    editMath: (pos: number) => void;
    /** Puts images in: see `putImages`. */
    putImages: (files: (string | { ext: string; data: string } | undefined)[], before?: number) => Promise<void>;
    /** Diagram renames made in this editor, as "from to", both ways, for ⌘Z and ⇧⌘Z to follow. */
    renames: Set<string>;
  };
};

const ctxOf = (e: Editor) => e.ctx;

/** A pasted screenshot or copied image goes into the note, as in Notion, not into the library as a
 *  source. A file copied in Finder pastes only its name, so its path comes from the Mac's pasteboard
 *  (another kind of file still pastes its name); copied HTML with a picture in it pastes as HTML. */
function imagePaste(live: Live) {
  const bytes = (f: File) =>
    new Promise<{ ext: string; data: string }>((ok, fail) => {
      const r = new FileReader();
      r.onload = () => ok({ ext: imageExt(f.type), data: String(r.result).replace(/^data:[^,]*,/, "") });
      r.onerror = () => fail(r.error);
      r.readAsDataURL(f);
    });
  return $prose(
    () =>
      new Plugin({
        props: {
          // Before the editor's own paste handling (Milkdown's would paste a copied file's name as text).
          handleDOMEvents: { paste: (view, e) => {
            const d = e.clipboardData;
            if (!d || !pastesFiles(d) || view.state.selection.$from.parent.type.spec.code) return false;
            const text = d.getData("text/plain").trim();
            const files = [...d.files].filter((f) => f.type.startsWith("image/") && f.size > 0);
            // Words copied with a picture paste as words; an image alone (a screenshot, Copy Image's
            // bare img tag, a Finder copy that names it) pastes as the image.
            const words = !!d.getData("text/html").replace(/<[^>]*>/g, "").trim() || (!!text && !text.split("\n").every((l) => /^[^/]+\.[a-z0-9]{1,5}$/i.test(l))); // not a copied file's names
            if (words) return false;
            e.preventDefault();
            if (files.length) {
              Promise.all(files.map(bytes)).then(
                (list) => live.current.putImages(list),
                (err) => live.current.p.notify(errorText(err), "error"),
              );
              return true;
            }
            void copiedFiles().then((list) => {
              const paths = list.flatMap((x) => (x.kind === "file" ? [x.path] : []));
              const images = paths.filter(noteImage);
              if (!images.length && text) return void view.dispatch(view.state.tr.insertText(text)); // another kind of file: its name, as before
              if (images.length) void live.current.putImages(images);
              if (images.length < paths.length) live.current.p.notify("Only images go in a note. To read a file, add it with ⌘O.", "error");
              else if (!paths.length) live.current.p.notify("Couldn't read the copied file. Drag it in instead.", "error");
            });
            return true;
          } },
        },
      }),
  );
}

/** Opens the `/` and `[[` menus from the text before the caret, drives them from the keyboard,
 *  and opens links on click. */
function menuPlugin(live: Live, setMenu: (m: Menu | null) => void, setIndex: (n: number) => void) {
  const show = (m: Menu | null) => {
    const was = live.current.menu;
    live.current.menu = m;
    if (m && (m.kind !== was?.kind || m.query !== was?.query)) {
      live.current.index = 0;
      setIndex(0);
    }
    setMenu(m);
  };
  const detect = (view: EditorView) => {
    const { $from, empty } = view.state.selection;
    if (!empty || !$from.parent.isTextblock || $from.parent.type.spec.code) return show(null);
    // A / closed with Esc stays closed while it is there; deleted and typed again, it opens (Notion).
    const d = live.current.dismissed;
    if (d.at >= 0 && (d.at >= view.state.doc.content.size || view.state.doc.textBetween(d.at, d.at + 1) !== d.ch)) live.current.dismissed = { at: -1, ch: "" };
    const t = menuTrigger($from.parent.textBetween(0, $from.parentOffset, undefined, "￼"));
    if (!t) {
      live.current.added = null;
      return show(null);
    }
    const { kind, query, typed } = t;
    const from = $from.pos - typed;
    if (from === live.current.dismissed.at) return show(null);
    show({ kind, query, from, to: $from.pos });
  };
  return $prose(
    () =>
      new Plugin({
        view: () => ({ update: detect }),
        props: {
          handleKeyDown: (view, e) => {
            const { menu, index } = live.current;
            const rows = live.current.rowsFor(menu);
            const { $from } = view.state.selection;
            if (!menu && e.key === "Enter" && $from.parent.type.name === "toggle_summary") {
              // Enter in a toggle's title goes to its first line.
              view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve($from.after() + 1))));
              return true;
            }
            const sel = view.state.selection;
            const drawn = sel instanceof NodeSelection && sel.node.type.name === "image" ? diagramName(String(sel.node.attrs.src)) : null;
            if (!menu && e.key === "Enter" && sel instanceof NodeSelection && sel.node.type.name.startsWith("math_")) {
              live.current.editMath(sel.from); // ↵ on a selected equation opens it, as a click does
              return true;
            }
            if (!menu && e.key === "Enter" && drawn) {
              live.current.draw(drawn); // ↵ on a selected diagram opens it (D40)
              return true;
            }
            if (!menu && drawn && !e.metaKey && !e.ctrlKey) {
              // A click selects the diagram while its editor loads; a key typed then must not
              // replace the link with text. It types after the diagram instead.
              const after = () => view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(sel.to)));
              // A dead key (⌥E then E), an input method or an ⌥ character composes its text in
              // the browser: move the caret after the diagram and let it type there.
              if (e.key === "Dead" || e.key === "Process" || e.keyCode === 229 || e.isComposing || (e.altKey && [...e.key].length === 1)) {
                view.dispatch(after());
                return false;
              }
              if ([...e.key].length === 1) {
                view.dispatch(after().insertText(e.key));
                return true;
              }
            }
            if (!menu) {
              // Notion's block keys, on the caret's block: one editor step each, so ⌘Z takes it back.
              const marks = view.state.schema.marks;
              const fmt = is(e, "note-bold") ? marks.strong : is(e, "note-italic") ? marks.emphasis : is(e, "note-underline") ? marks.ore_underline : is(e, "note-strike") ? marks.strike_through : is(e, "note-code") ? marks.inlineCode : null;
              if (fmt) {
                toggleMark(fmt)(view.state, view.dispatch);
                return true;
              }
              // With words selected, ⌘K links them and ⌘⇧H gives them the last colour, as in Notion;
              // with none, ⌘K stays the palette. The selection is read from the page as the key lands: the
              // editor takes a new one a moment later (selectionchange), and a quick ⌘K came before it.
              const synced = is(e, "palette") && takeDomSelection(view);
              const words = view.state.selection instanceof TextSelection && !view.state.selection.empty;
              if (words && live.current.bar && is(e, "palette")) {
                // Both: `linkNow` for a bar that comes up with this key, `askLink` for one that was up and stays.
                if (synced) live.current.linkNow();
                live.current.askLink();
                e.preventDefault();
                e.stopPropagation();
                return true;
              }
              const last = lastPaint();
              if (is(e, "note-last-color")) {
                if (words && last) view.dispatch(paint(view.state, view.state.selection.from, view.state.selection.to, last));
                return true;
              }
              const up = is(e, "block-up");
              if (up || is(e, "block-down") || is(e, "block-duplicate")) {
                const b = selectedBlock(view.state);
                const tr = b && (is(e, "block-duplicate") ? duplicate(view.state, b) : moveBy(view.state, b, up ? -1 : 1));
                if (tr) view.dispatch(tr);
                e.preventDefault();
                e.stopPropagation();
                return true;
              }
              // Esc selects the block (or the blocks the selected text runs over), as in Notion. Not
              // while a chapter's block is open (D115): its Esc ends the block.
              if (e.key === "Escape" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && !ghosts.getState(view.state)?.find().length) {
                const { from, to } = view.state.selection;
                const a = blockAt(view.state.doc, from);
                const h = blockAt(view.state.doc, to);
                const s = a && h && selectBlocks(view.state.doc, a.from, h.from);
                if (!s) return false;
                view.dispatch(view.state.tr.setSelection(s));
                e.stopPropagation();
                return true;
              }
              return false;
            }
            // A date query with no match shows nothing, so its keys stay ordinary typing.
            if (menu.kind === "date" && !rows.length) return false;
            // Keys the menu uses stop here, so the view around the editor (Esc: back) never sees them.
            const used = () => (e.stopPropagation(), true);
            if (e.key === "Escape") {
              const added = live.current.added;
              live.current.added = null;
              if (added && menu.from === added.at + 1 && menu.query === "") {
                // Esc on the +'s untouched "/" takes back what the + did.
                const tr = added.made ? view.state.tr.delete(added.at, added.at + 3) : view.state.tr.delete(menu.from, menu.to);
                view.dispatch(tr);
                show(null);
                return used();
              }
              live.current.dismissed = { at: menu.from, ch: view.state.doc.textBetween(menu.from, menu.from + 1) };
              show(null);
              return used();
            }
            if (!rows.length) return false;
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              const n = (index + (e.key === "ArrowDown" ? 1 : rows.length - 1)) % rows.length;
              live.current.index = n;
              setIndex(n);
              return used();
            }
            if (e.key === "Enter" || e.key === "Tab") {
              rows[index]?.run();
              return used();
            }
            return false;
          },
          handleDOMEvents: {
            // A to-do's checkbox is the list item's ::before, outside its text; a click there lands on the <li>.
            mousedown: (view, e) => {
              const li = e.target as HTMLElement;
              if (!li.matches?.('li[data-item-type="task"]')) return false;
              const $pos = view.state.doc.resolve(view.posAtDOM(li, 0));
              for (let d = $pos.depth; d > 0; d--)
                if ($pos.node(d).type.name === "list_item") {
                  e.preventDefault();
                  view.dispatch(view.state.tr.setNodeAttribute($pos.before(d), "checked", !$pos.node(d).attrs.checked));
                  return true;
                }
              return false;
            },
          },
          handleClick: (view, pos, e) => {
            // The anchor's href is sanitized (no ore: scheme), so read the link mark itself.
            if (!(e.target as HTMLElement).closest?.("a")) return false;
            const $pos = view.state.doc.resolve(pos);
            const link = [...(view.state.doc.nodeAt(pos)?.marks ?? []), ...$pos.marks()].find((m) => m.type.name === "link");
            const href = String(link?.attrs.href ?? "");
            const m = href.match(LINK_URL);
            if (m) live.current.p.onOpen({ kind: m[1] as LinkTarget["kind"], id: m[2]! });
            else if (/^https?:\/\//i.test(href)) void openUrl(href);
            else return false;
            return true;
          },
        },
      }),
  );
}

/** Shows Notion's format bar over selected text: once the mouse is up (not while he drags a
 *  selection), never for a click or while a `/`, `[[` or `:` menu is open. Esc selects the blocks instead. */
function selBarPlugin(host: { current: HTMLElement | null }, setSel: (s: Sel | null) => void) {
  let down = false;
  const at = (view: EditorView): Sel | null => {
    const s = view.state.selection;
    if (down || s.empty || !(s instanceof TextSelection) || !view.hasFocus() || !host.current) return null;
    if (!view.state.doc.textBetween(s.from, s.to, " ", " ").trim()) return null;
    const h = host.current.getBoundingClientRect();
    const a = view.coordsAtPos(s.from);
    const z = view.coordsAtPos(s.to);
    const x = a.left - h.left - 16; // where its left edge would go; SelectionBar keeps it inside the note and window
    // Above the first line; below the last when there is no room above: the top of the window, or of
    // the panel the note scrolls in (the source note's first line sits right under its tabs).
    let top = 0;
    for (let el = host.current.parentElement; el; el = el.parentElement)
      if (/auto|scroll|hidden/.test(getComputedStyle(el).overflowY)) {
        top = el.getBoundingClientRect().top;
        break;
      }
    const above = a.top - h.top - 42;
    return { from: s.from, to: s.to, x, y: a.top - 42 < top + 8 ? z.bottom - h.top + 8 : above };
  };
  return $prose(
    () =>
      new Plugin({
        view: (view) => {
          const up = () => {
            if (!down) return;
            down = false;
            setSel(at(view));
          };
          window.addEventListener("mouseup", up);
          return { update: (v) => setSel(at(v)), destroy: () => window.removeEventListener("mouseup", up) };
        },
        props: {
          handleDOMEvents: {
            mousedown: () => {
              down = true;
              setSel(null);
              return false;
            },
            blur: (view, e) => {
              // Focus moving into the bar's own popovers keeps it.
              if (!(e.relatedTarget as HTMLElement | null)?.closest?.(".sel-bar, .sel-pop")) setSel(null);
              return false;
            },
          },
        },
      }),
  );
}

/** Images by path relative to the note load from disk through the asset protocol. A diagram
 *  (D40) shows a picture drawn from its scene; click or ↵ opens the editor. */
function imageView(live: Live) {
  return $view(imageSchema.node, () => (node, view, getPos) => {
    const name = diagramName(String(node.attrs.src ?? ""));
    if (name) return diagramView(live, name, node, view, getPos);
    const img = document.createElement("img");
    const src = String(node.attrs.src ?? "");
    img.src = /^(https?:|data:)/i.test(src) ? src : convertFileSrc(`${live.current.p.dir}/${decodeURI(src)}`);
    img.alt = String(node.attrs.alt ?? "");
    img.className = "note-image";
    return { dom: img };
  });
}

/** The diagrams a note links, by name, once per link. */
function diagramsIn(doc: PmNode): string[] {
  const out: string[] = [];
  doc.descendants((n) => {
    const name = n.type.name === "image" ? diagramName(String(n.attrs.src ?? "")) : null;
    if (name) out.push(name);
  });
  return out;
}

/** What `a` has that `b` hasn't, counting repeats. */
const minus = (a: string[], b: string[]) => {
  const rest = [...b];
  return a.filter((x) => {
    const i = rest.indexOf(x);
    return i < 0 || (rest.splice(i, 1), false);
  });
};

/** ⌘Z or ⇧⌘Z on a diagram's rename moves its link back or on, and its file goes with it, so the link
 *  always opens the drawing; the preview redraws once the file is there. */
function followRenames(live: Live) {
  return $prose(
    () =>
      new Plugin({
        appendTransaction: (trs, old, now) => {
          if (!trs.some((tr) => tr.docChanged && isHistoryTransaction(tr))) return null;
          const before = diagramsIn(old.doc), after = diagramsIn(now.doc);
          const [from, ...more] = minus(before, after);
          const [to, ...also] = minus(after, before);
          if (!from || !to || more.length || also.length || !live.current.renames.has(`${from} ${to}`)) return null;
          const { noteArgs, dir, notify } = live.current.p;
          void ore<Diagram>("diagram", ...noteArgs, from, "--rename", to, "--follow-link").then(
            () => window.dispatchEvent(new CustomEvent(SAVED, { detail: `${dir}/${to}` })),
            (e) => notify(`Diagram “${to}” not renamed back: ${errorText(e)}`, "error"),
          );
          return null;
        },
      }),
  );
}

/** The scene each preview last read, so opening it skips reading the file again. */
const lastRead = new Map<string, Diagram>();

function diagramView(live: Live, name: string, node: PmNode, view: EditorView, getPos: () => number | undefined) {
  const dom = document.createElement("div");
  dom.className = "note-diagram";
  dom.contentEditable = "false";
  dom.setAttribute("role", "button");
  dom.setAttribute("aria-label", `Diagram ${name}, click to edit`);
  const inner = document.createElement("div");
  inner.className = "note-diagram-view";
  inner.textContent = "…";
  dom.append(inner);
  dom.addEventListener("click", () => live.current.draw(name));
  let alt = String(node.attrs.alt ?? "");
  const show = (s: Size | null) => {
    dom.classList.toggle("sized", !!s);
    dom.style.width = s ? `${s.w}px` : "";
    dom.style.height = s ? `${s.h}px` : "";
  };
  show(sizeOf(alt));
  const key = `${live.current.p.dir}/${name}`;
  let gone = false;
  let wired = false;
  const draw = () =>
    Promise.all([import("../Diagram"), ore<Diagram>("diagram", ...live.current.p.noteArgs, name)])
      .then(([m, d]) => {
        lastRead.set(key, d);
        // The phone's preview stays a picture: a drag there scrolls the note, a tap opens it.
        if (!wired && !PHONE) {
          wired = true;
          board(dom, inner, {
            size: () => sizeOf(alt),
            resize: show,
            // One editor step, so ⌘Z takes a resize back; the link keeps the size (Obsidian's `|WxH`).
            commit: (s) => {
              const pos = getPos();
              if (pos === undefined || gone) return;
              const n = view.state.doc.nodeAt(pos);
              if (!n) return;
              const tr = view.state.tr.setNodeMarkup(pos, undefined, { ...n.attrs, alt: withSize(String(n.attrs.alt ?? ""), s) });
              // It stays picked, with the note's keys, so ⌘Z is right there (Notion's image).
              view.dispatch(closeHistory(tr.setSelection(NodeSelection.create(tr.doc, pos))));
              view.focus();
            },
            fitIcon: m.FIT_ICON,
          });
        }
        return d.scene && d.scene.elements.length ? m.preview(d.scene) : null;
      })
      .then(
        (svg) => {
          if (gone) return;
          if (!svg) return void (inner.textContent = "Empty diagram: click to draw");
          // Markup the editor drew from the file, text escaped by React; inline so it uses the app's fonts.
          inner.innerHTML = svg;
        },
        (e) => !gone && (inner.textContent = `Diagram ${name}: ${errorText(e)}`),
      );
  const onSaved = (e: Event) => (e as CustomEvent<string>).detail === key && void draw();
  window.addEventListener(SAVED, onSaved);
  void draw();
  return {
    dom,
    ignoreMutation: () => true,
    // A new size (or an undone one) keeps the board and where it was panned to.
    update: (next: PmNode) => {
      if (next.type !== node.type || diagramName(String(next.attrs.src ?? "")) !== name) return false;
      alt = String(next.attrs.alt ?? "");
      show(sizeOf(alt));
      return true;
    },
    destroy: () => {
      gone = true;
      lastRead.delete(key);
      window.removeEventListener(SAVED, onSaved);
    },
  };
}

/** A toggle shows its caret outside the editable text; collapsing is view-only (Markdown keeps none). */
const toggleView = $view(toggleSchema.node, () => (node) => {
  const dom = document.createElement("div");
  dom.className = "toggle";
  dom.dataset.level = String(node.attrs.level); // a toggle heading's size
  const caret = document.createElement("button");
  caret.className = "toggle-caret";
  caret.contentEditable = "false";
  caret.tabIndex = -1;
  caret.setAttribute("aria-label", "Collapse or expand");
  caret.addEventListener("mousedown", (e) => {
    e.preventDefault();
    dom.classList.toggle("closed");
  });
  const content = document.createElement("div");
  content.className = "toggle-body";
  dom.append(caret, content);
  const ignoreMutation = (m: ViewMutationRecord) => (m.type === "attributes" && m.target === dom) || m.target === caret || caret.contains(m.target as Node);
  return { dom, contentDOM: content, ignoreMutation };
});

/** Keeps the / and [[ menu inside the window (menuPlace, Notion): placed by the caret when it opens and
 *  as typing narrows the list, again when the window resizes and (once a frame) when the page scrolls, with
 *  the highlighted row scrolled into view in a list capped to the room there is. Hidden while its line
 *  is scrolled out of view (lineShown); the keys still drive it. On the phone CSS docks it instead. */
function useMenuPlace(box: { current: HTMLDivElement | null }, view: () => EditorView | undefined, menu: Menu | null, count: number, index: number) {
  const side = useRef<Side | undefined>(undefined);
  const size = useRef({ width: 0, height: 0 });
  const place = useRef(() => {});
  const latest = useRef(menu);
  latest.current = menu;
  const opened = menu && `${menu.kind} ${menu.from}`;
  // Measured once per opening and each time the rows change, unsqueezed by the window's edges.
  useLayoutEffect(() => {
    side.current = undefined;
  }, [opened]);
  useLayoutEffect(() => {
    const el = box.current;
    const v = view();
    if (!opened || !el || !v || PHONE) return;
    Object.assign(el.style, { left: "0px", top: "0px", maxHeight: "none" });
    size.current = { width: el.offsetWidth, height: el.offsetHeight };
    place.current = () => {
      const m = latest.current;
      if (!m) return;
      const c = v.coordsAtPos(Math.min(m.from, v.state.doc.content.size));
      const shown = lineShown(c, clipOf(v.dom));
      el.style.visibility = shown ? "" : "hidden";
      if (!shown) return;
      const at = menuPlace(c, size.current, { width: innerWidth, height: innerHeight }, side.current);
      side.current = at.side;
      Object.assign(el.style, { left: `${at.left}px`, top: `${at.top}px`, maxHeight: `${at.maxHeight}px` });
      rowInView(el);
    };
    place.current();
    let frame = 0;
    const later = (e: Event) => {
      if (e.target === el || frame) return; // its own list scrolling, or a frame already asked for
      frame = requestAnimationFrame(() => {
        frame = 0;
        place.current();
      });
    };
    const resized = () => place.current(); // at once: anything that looks in the frame after a resize sees it placed
    addEventListener("resize", resized);
    document.addEventListener("scroll", later, { capture: true, passive: true });
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("resize", resized);
      document.removeEventListener("scroll", later, { capture: true });
    };
  }, [opened, menu?.query, count]);
  // Each editor update (the line can move as he types) places it again; an arrow keeps its row in view.
  useLayoutEffect(() => place.current(), [menu]);
  useLayoutEffect(() => rowInView(box.current), [index]);
}

/** Scrolls a capped menu's highlighted row into view, keeping the menu's padding round it. */
function rowInView(el: HTMLElement | null) {
  const row = el?.querySelector<HTMLElement>(".note-menu-row.on");
  if (!el || !row) return;
  const pad = 4;
  if (row.offsetTop - pad < el.scrollTop) el.scrollTop = row.offsetTop - pad;
  else if (row.offsetTop + row.offsetHeight + pad > el.scrollTop + el.clientHeight) el.scrollTop = row.offsetTop + row.offsetHeight + pad - el.clientHeight;
}

/** The part of the window an element's scrolling panels leave in view, top to bottom. */
function clipOf(el: Element) {
  let top = 0;
  let bottom = innerHeight;
  for (let a = el.parentElement; a; a = a.parentElement) {
    if (!/auto|scroll|hidden|clip/.test(getComputedStyle(a).overflowY)) continue;
    const r = a.getBoundingClientRect();
    top = Math.max(top, r.top);
    bottom = Math.min(bottom, r.bottom);
  }
  return { top, bottom };
}

/** Notion's equation field, under the equation it edits: the TeX, drawn live as he types (each change is
 *  an editor step, grouped by the editor's history). ↵ or a click away closes it (⇧↵ breaks the line
 *  in a block equation); one left empty is taken out. */
function MathField({ at, view, onClose }: { at: { pos: number; x: number; y: number; w: number; h: number }; view: () => EditorView | undefined; onClose: () => void }) {
  const node = () => {
    const v = view();
    const n = v?.state.doc.nodeAt(at.pos);
    return v && n?.type.name.startsWith("math_") ? { v, n } : null;
  };
  const [tex, setTex] = useState(() => String(node()?.n.attrs.value ?? ""));
  // The equation grows as it draws: the field stays under it.
  const [box, setBox] = useState(at);
  const done = useRef(false);
  const block = node()?.n.type.name === "math_block";
  const set = (t: string) => {
    setTex(t);
    const h = node();
    if (!h) return;
    h.v.dispatch(h.v.state.tr.setNodeMarkup(at.pos, undefined, { value: t }));
    const r = (h.v.nodeDOM(at.pos) as HTMLElement | null)?.getBoundingClientRect();
    if (r) setBox((b) => ({ ...b, w: r.width, h: r.height }));
  };
  const close = () => {
    if (done.current) return; // focusing the note below fires the popover's own dismiss again
    done.current = true;
    onClose();
    const h = node();
    if (!h) return;
    const { v, n } = h;
    const kept = !!n.attrs.value.trim();
    const { paragraph } = v.state.schema.nodes;
    // An empty equation goes; one that was the note's only block leaves an empty line, as a note always has one.
    const tr = kept ? v.state.tr : v.state.doc.childCount === 1 && n.isBlock ? v.state.tr.replaceWith(at.pos, at.pos + n.nodeSize, paragraph!.create()) : v.state.tr.delete(at.pos, at.pos + n.nodeSize);
    const after = kept ? at.pos + n.nodeSize : at.pos;
    // A block equation at the end of the note gets a line below it to go on writing (Notion).
    if (kept && n.isBlock && !tr.doc.resolve(after).nodeAfter) tr.insert(after, paragraph!.create());
    v.dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(after + (kept || !n.isBlock ? 0 : 1), tr.doc.content.size)))));
    v.focus();
  };
  return (
    <Popover.Root open onOpenChange={(o) => !o && close()}>
      <Popover.Anchor asChild>
        <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, pointerEvents: "none" }} />
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content className="popover sel-pop math-field" side="bottom" align="start" sideOffset={6} collisionPadding={8} onCloseAutoFocus={(e) => e.preventDefault()}>
          <textarea
            className="menu-input mono"
            aria-label="Equation (TeX)"
            placeholder="E = mc^2"
            rows={block ? 3 : 1}
            value={tex}
            autoFocus
            spellCheck={false}
            onChange={(e) => set(block ? e.target.value : e.target.value.replace(/\n/g, " "))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !(block && e.shiftKey)) {
                e.preventDefault();
                close();
              }
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** The page's selection, when it is words in this editor the editor hasn't taken yet: taken now. True if it moved. */
function takeDomSelection(view: EditorView): boolean {
  const d = view.dom.ownerDocument.getSelection();
  if (!(view.state.selection instanceof TextSelection)) return false; // cells or a block selected: theirs to keep
  if (!d || d.isCollapsed || !d.anchorNode || !d.focusNode || !view.dom.contains(d.anchorNode) || !view.dom.contains(d.focusNode)) return false;
  const anchor = view.posAtDOM(d.anchorNode, d.anchorOffset);
  const head = view.posAtDOM(d.focusNode, d.focusOffset);
  const s = view.state.selection;
  if (s.anchor === anchor && s.head === head) return false;
  view.dispatch(view.state.tr.setSelection(TextSelection.between(view.state.doc.resolve(anchor), view.state.doc.resolve(head))));
  return true;
}
