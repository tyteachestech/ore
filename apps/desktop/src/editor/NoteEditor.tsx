import type { Editor } from "@milkdown/kit/core";
import { editorViewCtx } from "@milkdown/kit/core";
import {
  createCodeBlockCommand, imageSchema, insertHrCommand, linkSchema, turnIntoTextCommand, wrapInBlockquoteCommand, wrapInBulletListCommand,
  wrapInHeadingCommand, wrapInOrderedListCommand,
} from "@milkdown/kit/preset/commonmark";
import { insertTableCommand } from "@milkdown/kit/preset/gfm";
import { toggleMark, wrapIn } from "@milkdown/kit/prose/commands";
import { NodeSelection, Plugin, PluginKey, TextSelection } from "@milkdown/kit/prose/state";
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
import { createEditor, markdownOf, menuTrigger } from "./editor";
import { dateRows } from "./dates";
import { findEmoji, loadEmoji, type EmojiEntry } from "./emoji";
import { keepUnedited } from "./preserve";
import { BlockHandle } from "./BlockHandle";
import { TableControls } from "./TableControls";
import { KeyboardBar } from "./KeyboardBar";
import { SelectionBar, type Sel } from "./SelectionBar";
import { blockAt, duplicate, moveBy, selectBlocks, selectedBlock, turnAtCaret, type Kind } from "./blockops";
import { is } from "../keys";

/** What a link can point at (D39): a source, or a skill (its note, D41). */
export type LinkTarget = { kind: "item" | "skill"; id: string; title: string };

export type NoteEditorHandle = {
  focus: () => void;
  /** Notion's +: a new line at the end with the / menu open; Esc takes the line back out. */
  addBlock: () => void;
  /** A chapter's block (D115): `## heading` at the end, then one empty line per prompt, shown as a
   *  placeholder until he writes on it. The caret goes to the first. Nothing of it is text. */
  scaffold: (heading: string, prompts: string[]) => void;
  /** Ends the block: lines still empty go, and the heading too when he wrote nothing under it.
   *  Resolves to what he wrote under the heading (Markdown), or null. */
  settle: () => string | null;
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
  /** Picks an image and copies it beside the note; resolves its relative path, or null. */
  onAttach: () => Promise<string | null>;
  /** The CLI arguments that name this note, for `ore diagram` (D40). */
  noteArgs: string[];
  notify: Notify;
  placeholder: string;
  /** Set to a reader of the editor's text as of now, for a save that can't wait for its next change
   *  report (those come 200 ms after typing stops, and never when the editor closes first). */
  pull?: { current: (() => string | null) | null };
};

// The diagram editor loads only when a diagram is shown or drawn (D40, D103).
const DiagramEditor = lazy(() => import("../Diagram"));
/** Fired after a diagram is saved, so its preview redraws; detail is `<note dir>/<name>`. */
const SAVED = "ore:diagram-saved";

type Menu = { kind: "slash" | "link" | "emoji" | "date"; query: string; from: number; to: number; x: number; y: number };
type Row = { label: string; sub?: string; emoji?: string; run: () => void };

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

/** The note editor (D38): Markdown shortcuts, a `/` menu, `[[` links, `:` emoji. No AI anywhere in it (D34.2). */
export const NoteEditor = forwardRef<NoteEditorHandle, Props>(function NoteEditor(p, ref) {
  const root = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<Editor | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [index, setIndex] = useState(0);
  const [sel, setSel] = useState<Sel | null>(null);
  const [emoji, setEmoji] = useState<EmojiEntry[] | null>(null);
  /** The diagram open in the overlay; `at` is where a new one goes once it has a drawing. */
  const [drawing, setDrawing] = useState<{ name: string; at?: number } | null>(null);
  // The editor's plugins live as long as it does; they read the latest props, rows and menu
  // through this. The menu here is set as the caret moves, ahead of React's render.
  const live = useRef<Live["current"]>({ p, menu, rowsFor: () => [], index, dismissed: -1, added: null, draw: (name) => setDrawing({ name }) });

  // Creation is async: a focus asked for before the editor exists (opening the source note) waits for it.
  const wantFocus = useRef(false);
  useImperativeHandle(ref, () => ({
    focus: () => (editor.current ? editor.current.action((ctx) => ctx.get(editorViewCtx).focus()) : void (wantFocus.current = true)),
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
        live.current.dismissed = -1;
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
        // The block's heading: the last top-level heading with its title (the heading-id plugin
        // replaces the node on every change, so it can't carry a decoration of its own).
        let head: { from: number; to: number } | null = null;
        v.state.doc.forEach((node, at) => {
          if (node.type.name === "heading" && node.textContent === title) head = { from: at, to: at + node.nodeSize };
        });
        const h = head as { from: number; to: number } | null;
        if (!h) return null;
        const written = v.state.doc.textBetween(h.to, v.state.doc.content.size, "\n").trim() !== "";
        const empty = (d: Decoration) => {
          const node = v.state.doc.nodeAt(d.from);
          return !!node && node.type.name === "paragraph" && node.content.size === 0;
        };
        const gone = [...lines.filter(empty), ...(written ? [] : [h])].sort((a, b) => b.from - a.from);
        let tr = v.state.tr;
        for (const d of gone) tr = tr.delete(d.from, d.to);
        v.dispatch(tr.setMeta(ghosts, DecorationSet.empty));
        if (!written) return null;
        const md = markdownOf(editor.current!);
        const i = md.lastIndexOf(`## ${title}`);
        return (i === -1 ? "" : md.slice(md.indexOf("\n", i) + 1).trim()) || null;
      });
    },
  }), []);
  const wantScaffold = useRef<{ heading: string; prompts: string[] } | null>(null);
  const scaffoldTitle = useRef<string | null>(null);
  const scaffoldNow = (heading: string, prompts: string[]) =>
    editor.current?.action((ctx) => {
      scaffoldTitle.current = heading;
      const v = ctx.get(editorViewCtx);
      const { doc, schema } = v.state;
      // Back to a block he left with Esc: his heading is already there, so only the prompts come back.
      let last: string | null = null;
      doc.forEach((node) => void (node.type.name === "heading" && (last = node.textContent)));
      const head = last === heading ? null : schema.nodes.heading!.create({ level: 2 }, schema.text(heading));
      const lines = prompts.map(() => schema.nodes.paragraph!.create());
      const at = doc.content.size;
      const tr = v.state.tr.insert(at, head ? [head, ...lines] : lines);
      const decos: Decoration[] = [];
      let pos = at + (head?.nodeSize ?? 0);
      for (const [i, line] of lines.entries()) {
        decos.push(Decoration.node(pos, pos + line.nodeSize, { class: "ghost", "data-ghost": prompts[i]! }, { "data-ghost": prompts[i]! }));
        pos += line.nodeSize;
      }
      tr.setMeta(ghosts, DecorationSet.create(tr.doc, decos));
      v.dispatch(tr.setSelection(TextSelection.create(tr.doc, at + (head?.nodeSize ?? 0) + 1)).scrollIntoView());
      v.focus();
    });

  useEffect(() => {
    let gone = false;
    let base: string | null = null;
    let read: (() => string) | null = null;
    const original = live.current.p.text;
    const caret = handoff && performance.now() - handoff.at < 500 ? handoff.pos : null;
    // Each editor gets its own element, removed at once on unmount: creation is async, so an
    // editor still being created must never share the DOM with the next one.
    const el = root.current!.appendChild(document.createElement("div"));
    void createEditor(
      el,
      original,
      // Also when the edit is taken back to the text as loaded, so the undone version is saved over.
      (md) => base !== null && live.current.p.onChange(keepUnedited(original, base, md)),
      [menuPlugin(live, setMenu, setIndex), ...(PHONE ? [] : [selBarPlugin(host, setSel)]), imageView(live), toggleView, ghostPlugin],
    ).then((e) => {
      if (gone) return void e.destroy();
      editor.current = e;
      base = markdownOf(e);
      const b = base;
      if (live.current.p.pull) live.current.p.pull.current = read = () => keepUnedited(original, b, markdownOf(e));
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
    if (menu.kind === "emoji") {
      if (!emoji) void loadEmoji().then(setEmoji, () => {});
      return findEmoji(emoji ?? [], q).map((e) => ({
        label: e.label,
        emoji: e.emoji,
        run: () => {
          const v = clear(menu);
          if (!v) return;
          v.dispatch(v.state.tr.insertText(e.emoji));
          v.focus();
        },
      }));
    }
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
      { label: "Text", run: turn("text", call(turnIntoTextCommand.key)) },
      { label: "Heading 1", sub: "#", run: turn("h1", call(wrapInHeadingCommand.key, 1)) },
      { label: "Heading 2", sub: "##", run: turn("h2", call(wrapInHeadingCommand.key, 2)) },
      { label: "Heading 3", sub: "###", run: turn("h3", call(wrapInHeadingCommand.key, 3)) },
      { label: "Bulleted list", sub: "-", run: turn("bullet", call(wrapInBulletListCommand.key)) },
      { label: "Numbered list", sub: "1.", run: turn("number", call(wrapInOrderedListCommand.key)) },
      {
        label: "To-do list",
        sub: "[ ]",
        run: turn("todo", () => {
          call(wrapInBulletListCommand.key)();
          const v = view();
          if (!v) return;
          const { $from } = v.state.selection;
          for (let d = $from.depth; d > 0; d--)
            if ($from.node(d).type.name === "list_item") return v.dispatch(v.state.tr.setNodeAttribute($from.before(d), "checked", false));
        }),
      },
      { label: "Quote", sub: ">", run: turn("quote", call(wrapInBlockquoteCommand.key)) },
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
        sub: level ? undefined : "<details>",
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
      { label: "Divider", sub: "---", run: cmd(insertHrCommand.key) },
      {
        label: "Image",
        run: () => {
          clear(menu);
          void live.current.p.onAttach().then((src) => {
            const v = view();
            if (!src || !v) return;
            v.dispatch(v.state.tr.replaceSelectionWith(imageSchema.type(ctxOf(editor.current!)).create({ src, alt: "" })));
            v.focus();
          });
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
    ];
    return all.filter((r) => !q || r.label.toLowerCase().replace(/[^a-z0-9]/g, "").includes(q.replace(/[^a-z0-9]/g, "")));
  };
  const rows = rowsFor(menu);
  /** Selects the row under a pointer that moved. A menu that opens under a resting pointer keeps
   *  its first row, as in Notion and Raycast; mouseenter would fire there and select another. */
  const hover = (i: number) => {
    if (!pointerMoved) return;
    live.current.index = i;
    setIndex(i);
  };

  /** Links a new diagram where /diagram was typed, once (on its first save or at Done). */
  const linkDiagram = (name: string) => {
    const d = drawing;
    const v = view();
    if (!d || d.at === undefined || !v) return;
    const at = d.at;
    d.at = undefined;
    const img = imageSchema.type(ctxOf(editor.current!)).create({ src: `diagrams/${name}.excalidraw`, alt: "Diagram" });
    const tr = v.state.tr.setSelection(TextSelection.create(v.state.doc, Math.min(at, v.state.doc.content.size)));
    v.dispatch(tr.replaceSelectionWith(img));
    // Reported now, not after the editor's pause: focus is in the drawing, so no blur saves it, and
    // switching the panel's tab next would drop the link.
    const now = p.pull?.current?.();
    if (now != null) p.onChange(now);
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
  /** A diagram renamed in its editor: the note's link follows, and saves with the note. */
  const renamedDiagram = (from: string, to: string) => {
    const v = view();
    if (!v) return;
    let tr = v.state.tr;
    v.state.doc.descendants((n, pos) => {
      if (n.type.name === "image" && n.attrs.src === `diagrams/${from}.excalidraw`) tr = tr.setNodeMarkup(pos, undefined, { ...n.attrs, src: `diagrams/${to}.excalidraw` });
    });
    if (tr.docChanged) v.dispatch(tr);
  };
  live.current.p = p;
  live.current.rowsFor = rowsFor;

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
      <div ref={root} />
      {!PHONE && <BlockHandle view={view} host={host} />}
      {!PHONE && <TableControls view={view} host={host} />}
      {PHONE && <KeyboardBar view={view} targets={p.targets} />}
      {sel && !menu && <SelectionBar key={`${sel.from}-${sel.to}`} view={view} sel={sel} targets={p.targets} onDone={() => setSel(null)} />}
      {menu && ((menu.kind !== "emoji" && menu.kind !== "date") || rows.length > 0) && (
        <div className="note-menu" role="listbox" style={{ left: menu.x, top: menu.y }} onMouseDown={(e) => e.preventDefault()}>
          {rows.length ? (
            rows.map((r, i) => (
              <div key={r.label + i} role="option" aria-selected={i === index} className={`note-menu-row${i === index ? " on" : ""}`} onMouseMove={() => hover(i)} onClick={r.run}>
                {r.emoji && <span className="emoji">{r.emoji}</span>}
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
          <DiagramEditor args={p.noteArgs} name={drawing.name} loaded={lastRead.get(`${p.dir}/${drawing.name}`)} dock={dockOf(root.current)} notify={p.notify} onClose={closeDiagram} onFirstSave={linkDiagram} onRenamed={renamedDiagram} onLink={(href) => {
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
    dismissed: number;
    /** The line the + just added (`made`) or reused, while its / menu is open. */
    added: { at: number; made: boolean } | null;
    draw: (name: string) => void;
  };
};

const ctxOf = (e: Editor) => e.ctx;

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
    const t = menuTrigger($from.parent.textBetween(0, $from.parentOffset, undefined, "￼"));
    if (!t) {
      live.current.added = null;
      return show(null);
    }
    const { kind, query, typed } = t;
    const from = $from.pos - typed;
    if (from === live.current.dismissed) return show(null);
    const c = view.coordsAtPos(from);
    show({ kind, query, from, to: $from.pos, x: c.left, y: c.bottom + 4 });
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
              const fmt = is(e, "note-bold") ? marks.strong : is(e, "note-italic") ? marks.emphasis : is(e, "note-strike") ? marks.strike_through : is(e, "note-code") ? marks.inlineCode : null;
              if (fmt) {
                toggleMark(fmt)(view.state, view.dispatch);
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
            // An emoji or date query with no match shows nothing, so its keys stay ordinary typing.
            if ((menu.kind === "emoji" || menu.kind === "date") && !rows.length) return false;
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
              live.current.dismissed = menu.from;
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
    const width = 340;
    const x = Math.max(-8, Math.min(a.left - h.left - 16, h.width - width));
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
  return $view(imageSchema.node, () => (node) => {
    const name = diagramName(String(node.attrs.src ?? ""));
    if (name) return diagramView(live, name);
    const img = document.createElement("img");
    const src = String(node.attrs.src ?? "");
    img.src = /^(https?:|data:)/i.test(src) ? src : convertFileSrc(`${live.current.p.dir}/${decodeURI(src)}`);
    img.alt = String(node.attrs.alt ?? "");
    img.className = "note-image";
    return { dom: img };
  });
}

/** The reader's side panel the note sits in, where its diagrams open beside the source (not on the phone,
 *  where the panel is a whole screen already). */
const dockOf = (el: HTMLElement | null) => (PHONE ? null : (el?.closest(".mynotes") as HTMLElement | null) ?? null);

/** The scene each preview last read, so opening it skips reading the file again. */
const lastRead = new Map<string, Diagram>();

function diagramView(live: Live, name: string) {
  const dom = document.createElement("div");
  dom.className = "note-diagram";
  dom.contentEditable = "false";
  dom.setAttribute("role", "button");
  dom.setAttribute("aria-label", `Diagram ${name}, click to edit`);
  dom.textContent = "…";
  dom.addEventListener("click", () => live.current.draw(name));
  const key = `${live.current.p.dir}/${name}`;
  let gone = false;
  const draw = () =>
    Promise.all([import("../Diagram"), ore<Diagram>("diagram", ...live.current.p.noteArgs, name)])
      .then(([m, d]) => {
        lastRead.set(key, d);
        return d.scene && d.scene.elements.length ? m.preview(d.scene) : null;
      })
      .then(
        (svg) => {
          if (gone) return;
          if (!svg) return void (dom.textContent = "Empty diagram: click to draw");
          // Markup the editor drew from the file, text escaped by React; inline so it uses the app's fonts.
          dom.innerHTML = svg;
        },
        (e) => !gone && (dom.textContent = `Diagram ${name}: ${errorText(e)}`),
      );
  const onSaved = (e: Event) => (e as CustomEvent<string>).detail === key && void draw();
  window.addEventListener(SAVED, onSaved);
  void draw();
  return {
    dom,
    ignoreMutation: () => true,
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
