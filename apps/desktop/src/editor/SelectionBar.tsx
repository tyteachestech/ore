import type { MarkType } from "@milkdown/kit/prose/model";
import type { EditorView } from "@milkdown/kit/prose/view";
import * as Popover from "@radix-ui/react-popover";
import { Command } from "cmdk";
import { useState, type ReactNode } from "react";
import { Hint } from "../Hint";
import { CaretDown, LinkSimple } from "../icons";
import type { LinkTarget } from "./NoteEditor";
import { MoreButton } from "../Menu";
import { blockAt, kindOf, KINDS, turnInto } from "./blockops";
import { COLORS, type Color } from "./colors";

/** Where the selection is, relative to the note: the bar sits above its first line. */
export type Sel = { from: number; to: number; x: number; y: number };

const NAMES: Record<Color, string> = { gray: "Gray", red: "Red", orange: "Orange", yellow: "Yellow", green: "Green", teal: "Teal", blue: "Blue", purple: "Purple", pink: "Pink" };

/** Notion's bar over selected text: Turn into, bold, italic, strikethrough, code, a web link, a
 *  link to a source or skill note ([[ ]], D39), and colour. Each is one editor step (⌘Z). */
export function SelectionBar({ view, sel, targets, onDone, docked }: { view: () => EditorView | undefined; sel: Sel; targets: LinkTarget[]; onDone: () => void; /** In the iPhone's keyboard bar, not over the text: iOS puts its Copy bar there. */ docked?: boolean }) {
  const v = view();
  if (!v) return null;
  const { schema, doc } = v.state;
  const has = (t: MarkType | undefined) => !!t && doc.rangeHasMark(sel.from, sel.to, t);
  const toggle = (t: MarkType | undefined, attrs?: Record<string, unknown>) => {
    if (!t) return;
    const tr = v.state.tr;
    if (has(t) && !attrs) tr.removeMark(sel.from, sel.to, t);
    else tr.addMark(sel.from, sel.to, t.create(attrs));
    v.focus();
    v.dispatch(tr);
  };
  const b = blockAt(doc, sel.from);
  const kind = b && kindOf(doc, b);
  const keep = (e: React.MouseEvent) => e.preventDefault(); // the selection stays while a button is pressed

  const mark = (label: string, t: MarkType | undefined, face: ReactNode) => (
    <button className={has(t) ? "on" : ""} aria-label={label} aria-pressed={has(t)} onMouseDown={keep} onClick={() => toggle(t)}>
      {face}
    </button>
  );

  return (
    <div className={`sel-bar${docked ? " docked" : ""}`} style={docked ? undefined : { left: sel.x, top: sel.y }} onMouseDown={keep} role="toolbar" aria-label="Format">
      <MoreButton
        label="Turn into"
        hint="Turn into"
        className="sel-kind"
        align="start"
        keepFocus
        icon={<>{KINDS.find((k) => k.kind === kind)?.label ?? "Text"}<CaretDown size={12} aria-hidden="true" /></>}
        actions={() =>
          KINDS.map((k) => ({
            id: k.kind,
            label: k.label,
            run: () => {
              const now = blockAt(v.state.doc, sel.from);
              const tr = now && turnInto(v.state, now, k.kind);
              if (tr) v.dispatch(tr);
              v.focus();
              onDone();
            },
          }))
        }
      />
      <span className="sel-sep" />
      <Hint text="Bold" keys="note-bold">{mark("Bold", schema.marks.strong, <b>B</b>)}</Hint>
      <Hint text="Italic" keys="note-italic">{mark("Italic", schema.marks.emphasis, <i>I</i>)}</Hint>
      <Hint text="Strikethrough" keys="note-strike">{mark("Strikethrough", schema.marks.strike_through, <s>S</s>)}</Hint>
      <Hint text="Code" keys="note-code">{mark("Code", schema.marks.inlineCode, <span className="mono">{"</>"}</span>)}</Hint>
      <span className="sel-sep" />
      <WebLink v={v} sel={sel} />
      <PageLink v={v} sel={sel} targets={targets} />
      <span className="sel-sep" />
      <Colors v={v} sel={sel} />
    </div>
  );
}

/** A web link on the selection: paste or type the address, Enter applies it, Esc cancels. */
function WebLink({ v, sel }: { v: EditorView; sel: Sel }) {
  const t = v.state.schema.marks.link!;
  const now = (() => {
    let href = "";
    v.state.doc.nodesBetween(sel.from, sel.to, (n) => void (href ||= String(n.marks.find((m) => m.type === t)?.attrs.href ?? "")));
    return /^https?:/i.test(href) ? href : "";
  })();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(now);
  const ok = /^https?:\/\/\S+\.\S+/i.test(url.trim()) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(url.trim());
  const apply = () => {
    if (!ok) return;
    const href = /^https?:/i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
    setOpen(false);
    v.focus();
    v.dispatch(v.state.tr.removeMark(sel.from, sel.to, t).addMark(sel.from, sel.to, t.create({ href })));
  };
  return (
    <Popover.Root open={open} onOpenChange={(o) => (setOpen(o), o && setUrl(now))}>
      <Hint text="Link">
        <Popover.Trigger asChild>
          <button className={now ? "on" : ""} aria-label="Link" onMouseDown={(e) => e.preventDefault()}>
            <LinkSimple size={16} aria-hidden="true" />
          </button>
        </Popover.Trigger>
      </Hint>
      <Popover.Portal>
        <Popover.Content className="popover sel-pop" side="bottom" align="start" sideOffset={6} collisionPadding={8} onCloseAutoFocus={(e) => e.preventDefault()}>
          <input
            className="menu-input"
            placeholder="Paste a link"
            value={url}
            autoFocus
            spellCheck={false}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.preventDefault(), apply());
            }}
          />
          {now && (
            <button className="menu-item danger" onClick={() => (setOpen(false), v.focus(), v.dispatch(v.state.tr.removeMark(sel.from, sel.to, t)))}>
              Remove link
            </button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Links the selected words to a source or skill note (D39): the link keeps his words as its text. */
function PageLink({ v, sel, targets }: { v: EditorView; sel: Sel; targets: LinkTarget[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const hits = targets.filter((t) => t.title.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8);
  const link = (t: LinkTarget) => {
    const m = v.state.schema.marks.link!;
    setOpen(false);
    v.focus();
    v.dispatch(v.state.tr.removeMark(sel.from, sel.to, m).addMark(sel.from, sel.to, m.create({ href: `ore:${t.kind}/${t.id}` })));
  };
  return (
    <Popover.Root open={open} onOpenChange={(o) => (setOpen(o), setQ(""))}>
      <Hint text="Link to a source or skill note">
        <Popover.Trigger asChild>
          <button aria-label="Link to a source or skill note" onMouseDown={(e) => e.preventDefault()}>
            <span className="mono">[[ ]]</span>
          </button>
        </Popover.Trigger>
      </Hint>
      <Popover.Portal>
        <Popover.Content className="popover menu sel-pop" side="bottom" align="start" sideOffset={6} collisionPadding={8} onCloseAutoFocus={(e) => e.preventDefault()}>
          <Command label="Link to" loop shouldFilter={false}>
            <Command.Input className="menu-input" placeholder="Find a source or skill…" value={q} onValueChange={setQ} autoFocus />
            <Command.List>
              {hits.map((t) => (
                <Command.Item key={`${t.kind}/${t.id}`} value={`${t.kind}/${t.id}`} onSelect={() => link(t)}>
                  <span className="label">{t.title}</span>
                  {t.kind === "skill" && <span className="sub">Skill note</span>}
                </Command.Item>
              ))}
              {!hits.length && <div className="note-menu-empty">No source or skill by that name</div>}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Notion's colour menu: a text colour and a highlight, each with Default to take it off. */
function Colors({ v, sel }: { v: EditorView; sel: Sel }) {
  const { ore_text_color: text, ore_highlight: back } = v.state.schema.marks;
  const [open, setOpen] = useState(false);
  const set = (t: MarkType, color: Color | null) => {
    const tr = v.state.tr.removeMark(sel.from, sel.to, t);
    if (color) tr.addMark(sel.from, sel.to, t.create({ color: t === back && color === "yellow" ? null : color }));
    setOpen(false);
    v.focus();
    v.dispatch(tr);
  };
  const row = (t: MarkType, name: string) => (
    <div className="sel-swatches" role="group" aria-label={name}>
      <Hint text="Default">
        <button className="note-swatch none" aria-label={`${name}: default`} onClick={() => set(t, null)} />
      </Hint>
      {COLORS.map((c) => (
        <Hint key={c} text={NAMES[c]}>
          <button className={`note-swatch ${t === text ? "fg" : "bg"}`} data-color={c} aria-label={`${name}: ${NAMES[c]}`} onClick={() => set(t, c)}>
            {t === text ? "A" : ""}
          </button>
        </Hint>
      ))}
    </div>
  );
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Hint text="Colour">
        <Popover.Trigger asChild>
          <button aria-label="Colour" onMouseDown={(e) => e.preventDefault()}>
            <span className="sel-a">A</span>
            <CaretDown size={12} aria-hidden="true" />
          </button>
        </Popover.Trigger>
      </Hint>
      <Popover.Portal>
        <Popover.Content className="popover sel-pop sel-colors" side="bottom" align="end" sideOffset={6} collisionPadding={8} onCloseAutoFocus={(e) => e.preventDefault()} onMouseDown={(e) => e.preventDefault()}>
          <div className="sel-label">Text</div>
          {row(text!, "Text colour")}
          <div className="sel-label">Highlight</div>
          {row(back!, "Highlight")}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
