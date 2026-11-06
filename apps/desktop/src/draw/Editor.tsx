// The diagram editor (D103): a keyboard-first canvas over Excalidraw's file format. Tools take
// Excalidraw's keys; Tab grows a concept map one labelled link at a time, M types one as text, ⇧M lays
// out a compare matrix, so the learning activities need no dragging (brief-diagram-editor.md).
import {
  ArrowCounterClockwise, ArrowClockwise, ArrowRight, Circle, CursorClick, Diamond, Eraser, Hand, LineSegment, LockSimple, LockSimpleOpen, Minus,
  PencilSimple, Plus, Question, Square, Table, TextT, TreeStructure, CornersOut,
} from "../icons";
import { Command } from "cmdk";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Hint } from "../Hint";
import { is, label, useKeymap, type KeyId } from "../keys";
import { WithMenu, type MenuAction } from "../Menu";
import { ShortcutEditor } from "../Shortcuts";
import type { Notify } from "../util";
import {
  absPoints, addChild, addMap, addMatrix, align, connect, tidy, bindTarget, bounds, boundsOf, byId, cellOf, centre, clone, DEFAULT_STYLE, distribute, duplicate, FILLS,
  fitLink, flip, flowDir, FONT_SIZES, frame, GAP, GRID, group, growMatrix, isLabel, isLinear, isNode, isShape, labelOf, labelWidth, layoutMatrix, linear, lineHeightOf,
  measureText, MONO, move, nearestIn, nextCell, pickSet, remove, reorder, reroute, resize, resizeMany, rot, rotate, route, SANS, setLabel, setMeasure,
  setText, shape, snapBox, snapPoint, STROKES, syncAll, text, topAt, ungroup, uid, union, withLabels, withPoints, wrap, describe,
  type Box, type Dir, type El, type Guide, type Handle, type Pt, type Shape, type Style, type Tool,
} from "./model";
import { dark, Defs, Element, fontOf } from "./render";
import { copyPng, svgMarkup } from "./export";

type View = { x: number; y: number; zoom: number };
type Editing = { id: string; kind: "label" | "text"; then?: string; fresh?: boolean };
type Files = Record<string, { dataURL?: string; mimeType?: string; id?: string; created?: number }>;
type Gesture =
  | { kind: "move"; start: Pt; before: El[]; ids: Set<string>; box: Box; others: Box[]; dx: number; dy: number; pick?: string[] }
  | { kind: "marquee"; start: Pt; end: Pt; add: string[] }
  | { kind: "resize"; handle: Handle; before: El[]; starts: El[]; box: Box; others: Box[] }
  | { kind: "rotate"; before: El[]; starts: El[]; about: Pt; a0: number }
  | { kind: "create"; before: El[]; id: string; start: Pt; type: Shape }
  | { kind: "line"; before: El[]; id: string; start: Pt; startOn: string | null }
  | { kind: "point"; before: El[]; id: string; index: number }
  | { kind: "draw"; before: El[]; id: string; pts: Pt[] }
  | { kind: "erase"; ids: Set<string> }
  | { kind: "pan"; start: [number, number]; view: View };

const TOOLS: { tool: Tool; key: KeyId; label: string; icon: ReactNode }[] = [
  { tool: "select", key: "d-select", label: "Select", icon: <CursorClick size={16} /> },
  { tool: "hand", key: "d-hand", label: "Hand", icon: <Hand size={16} /> },
  { tool: "rectangle", key: "d-rectangle", label: "Box", icon: <Square size={16} /> },
  { tool: "diamond", key: "d-diamond", label: "Diamond", icon: <Diamond size={16} /> },
  { tool: "ellipse", key: "d-ellipse", label: "Ellipse", icon: <Circle size={16} /> },
  { tool: "arrow", key: "d-arrow", label: "Arrow", icon: <ArrowRight size={16} /> },
  { tool: "line", key: "d-line", label: "Line", icon: <LineSegment size={16} /> },
  { tool: "freedraw", key: "d-freedraw", label: "Pen", icon: <PencilSimple size={16} /> },
  { tool: "text", key: "d-text", label: "Text", icon: <TextT size={16} /> },
  { tool: "eraser", key: "d-eraser", label: "Eraser", icon: <Eraser size={16} /> },
];
// Excalidraw's number keys for the same tools.
const DIGITS: Record<string, Tool> = { Digit1: "select", Digit2: "rectangle", Digit3: "diamond", Digit4: "ellipse", Digit5: "arrow", Digit6: "line", Digit7: "freedraw", Digit8: "text", Digit0: "eraser" };
const CURSOR: Partial<Record<Tool, string>> = { hand: "grab", text: "text", eraser: "cell" };
const HANDLE_CURSOR: Record<Handle, string> = { nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize", n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize" };

let ctx: CanvasRenderingContext2D | null = null;
setMeasure((line, size, family) => {
  ctx ??= document.createElement("canvas").getContext("2d");
  if (!ctx) return line.length * size * 0.55;
  ctx.font = `${size}px ${fontOf(family)}`;
  return ctx.measureText(line).width;
});

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Handles for the selection: one rotated frame for a single shape, the union box for several. */
function handlesOf(sel: El[], zoom: number): { box: Box; angle: number; at: { h: Handle | "rotate"; p: Pt }[] } | null {
  if (!sel.length) return null;
  const single = sel.length === 1 ? sel[0]! : null;
  if (single && isLinear(single)) return null;
  const box = single ? frame(single) : union(sel.map(bounds))!;
  const angle = single?.angle ?? 0;
  const c: Pt = [box.x + box.w / 2, box.y + box.h / 2];
  const pad = 4 / zoom;
  const [x0, y0, x1, y1] = [box.x - pad, box.y - pad, box.x + box.w + pad, box.y + box.h + pad];
  const all: { h: Handle | "rotate"; p: Pt }[] = [
    { h: "nw", p: [x0, y0] }, { h: "ne", p: [x1, y0] }, { h: "se", p: [x1, y1] }, { h: "sw", p: [x0, y1] },
    { h: "n", p: [c[0], y0] }, { h: "e", p: [x1, c[1]] }, { h: "s", p: [c[0], y1] }, { h: "w", p: [x0, c[1]] },
    { h: "rotate", p: [c[0], y0 - 22 / zoom] },
  ];
  const small = box.w * zoom < 28 || box.h * zoom < 28;
  const textOnly = single?.type === "text";
  return {
    box,
    angle,
    at: all.filter((x) => !((small || textOnly) && x.h.length === 1)).map((x) => ({ h: x.h, p: rot(x.p, c, angle) })),
  };
}

export default function Editor({ initial, files: initialFiles, name, notify, onChange, onDone, onLink, expand }: {
  onLink: (href: string) => void;
  initial: El[];
  files: Files;
  name: string;
  notify: Notify;
  onChange: (els: El[], files: Files) => void;
  onDone: () => void;
  /** Beside the source in the side panel: `toggle` goes full window and back (⇧⌘↵). */
  expand?: { full: boolean; toggle: () => void };
}) {
  const keys = useKeymap();
  const [els, setElsState] = useState<El[]>(() => syncAll(initial));
  const [files, setFiles] = useState<Files>(initialFiles);
  const [sel, setSelState] = useState<string[]>([]);
  const [tool, setTool] = useState<Tool>("select");
  const [toolLock, setToolLock] = useState(false);
  const [style, setStyle] = useState<Style>(DEFAULT_STYLE);
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 });
  const [editing, setEditing] = useState<Editing | null>(null);
  const [draft, setDraft] = useState("");
  const [guides, setGuides] = useState<Guide[]>([]);
  const [hot, setHot] = useState<string | null>(null); // the shape an arrow end would bind to
  const [entered, setEntered] = useState<string | null>(null); // the group double-click went into
  const [multi, setMulti] = useState<string | null>(null); // a line being drawn point by point
  const [grid, setGrid] = useState(false);
  const [snap, setSnap] = useState(true);
  const [panel, setPanel] = useState<null | "commands" | "map" | "help" | "find" | "link" | "url">(null);
  const [space, setSpace] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>();
  const [, force] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const g = useRef<Gesture | null>(null);
  const hist = useRef<{ past: El[][]; future: El[][] }>({ past: [], future: [] });
  const live = useRef({ els, sel, view, files, editing, draft, style });
  live.current = { els, sel, view, files, editing, draft, style };
  const styleClip = useRef<Partial<El> | null>(null);
  const changed = useRef(onChange);
  changed.current = onChange;

  const setEls = useCallback((next: El[], nextFiles?: Files) => {
    live.current.els = next;
    setElsState(next);
    if (nextFiles) {
      live.current.files = nextFiles;
      setFiles(nextFiles);
    }
    changed.current(next, nextFiles ?? live.current.files);
  }, []);
  const setSel = useCallback((ids: string[]) => {
    live.current.sel = ids;
    setSelState(ids);
  }, []);
  /** Applies an edit as one undo step. */
  const apply = useCallback((next: El[], ids?: string[], nextFiles?: Files) => {
    const h = hist.current;
    h.past.push(live.current.els);
    if (h.past.length > 300) h.past.shift();
    h.future = [];
    setEls(next, nextFiles);
    if (ids) setSel(ids);
  }, [setEls, setSel]);
  /** Records `before` as an undo step for a change to `next` (the scene now, unless given). */
  const recordFrom = (before: El[], next: El[] = live.current.els) => {
    if (before === next || (before.length === next.length && JSON.stringify(before) === JSON.stringify(next))) return;
    hist.current.past.push(before);
    hist.current.future = [];
  };
  const undo = () => {
    const h = hist.current;
    const p = h.past.pop();
    if (!p) return;
    h.future.push(live.current.els);
    setEls(p);
    setSel(live.current.sel.filter((id) => p.some((e) => e.id === id)));
  };
  const redo = () => {
    const h = hist.current;
    const n = h.future.pop();
    if (!n) return;
    h.past.push(live.current.els);
    setEls(n);
    setSel(live.current.sel.filter((id) => n.some((e) => e.id === id)));
  };

  const map = useMemo(() => byId(els), [els]);
  const selected = useMemo(() => sel.map((id) => map.get(id)).filter((e): e is El => !!e), [sel, map]);
  const selSet = useMemo(() => new Set(sel), [sel]);

  // ---------- coordinates ----------
  const toScene = (cx: number, cy: number): Pt => {
    const r = svg.current!.getBoundingClientRect();
    const v = live.current.view;
    return [(cx - r.left) / v.zoom + v.x, (cy - r.top) / v.zoom + v.y];
  };
  const size = () => {
    const r = svg.current?.getBoundingClientRect();
    return { w: r?.width ?? 800, h: r?.height ?? 600 };
  };
  const tol = () => 6 / live.current.view.zoom;

  /** Zooms to `z` keeping the scene point under screen point (sx, sy) still. */
  const zoomTo = (z: number, sx?: number, sy?: number) => {
    const v = live.current.view;
    const { w, h } = size();
    const ax = sx ?? w / 2;
    const ay = sy ?? h / 2;
    const nz = clamp(z, 0.1, 8);
    const px = ax / v.zoom + v.x;
    const py = ay / v.zoom + v.y;
    const next = { zoom: nz, x: px - ax / nz, y: py - ay / nz };
    live.current.view = next;
    setView(next);
  };
  const fit = (target: Box | null, max = 1) => {
    if (!target) return setView((v) => ({ ...v, x: -size().w / 2 / v.zoom, y: -size().h / 2 / v.zoom }));
    const { w, h } = size();
    const z = clamp(Math.min((w - 120) / Math.max(target.w, 1), (h - 160) / Math.max(target.h, 1), max), 0.1, 8);
    const next = { zoom: z, x: target.x + target.w / 2 - w / 2 / z, y: target.y + target.h / 2 - h / 2 / z };
    live.current.view = next;
    setView(next);
  };
  /** Pans just enough to show a box (keyboard navigation and new nodes stay on screen). */
  const reveal = (b: Box) => {
    const v = live.current.view;
    const { w, h } = size();
    const m = 60 / v.zoom;
    // the style panel covers the canvas's left edge while something is selected
    const panel = root.current?.querySelector(".draw-style")?.getBoundingClientRect();
    const left = panel && svg.current ? Math.max(0, panel.right - svg.current.getBoundingClientRect().left) / v.zoom : 0;
    let { x, y } = v;
    if (b.x - m - left < x) x = b.x - m - left;
    if (b.x + b.w + m > x + w / v.zoom) x = b.x + b.w + m - w / v.zoom;
    if (b.y - m < y) y = b.y - m;
    if (b.y + b.h + m > y + h / v.zoom) y = b.y + b.h + m - h / v.zoom;
    if (x !== v.x || y !== v.y) {
      live.current.view = { ...v, x, y };
      setView(live.current.view);
    }
  };

  useLayoutEffect(() => {
    const b = boundsOf(live.current.els);
    fit(b, 1);
    root.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fonts change text widths: re-measure once Geist has loaded.
  useEffect(() => {
    void document.fonts?.ready.then(() => {
      setEls(syncAll(live.current.els.map((e) => (e.type === "text" && !e.containerId ? { ...e, ...measureText(e.text ?? "", e.fontSize ?? 20, e.fontFamily ?? SANS, lineHeightOf(e)) } : e))));
      force((n) => n + 1);
    });
  }, [setEls]);

  // ---------- text editing ----------
  const startEdit = (id: string, kind: Editing["kind"], extra: Partial<Editing> = {}) => {
    const els = live.current.els;
    const e = els.find((x) => x.id === id);
    if (!e) return;
    const value = kind === "label" ? (labelOf(els, id)?.originalText ?? "") : (e.originalText ?? e.text ?? "");
    setDraft(value);
    live.current.draft = value;
    const ed = { id, kind, ...extra };
    live.current.editing = ed;
    setEditing(ed);
    setSel(kind === "label" || !isLabel(e) ? [id] : []);
    reveal(bounds(e));
  };
  /** Writes the text being edited into the scene; returns the scene after it. */
  const writeEdit = (): El[] => {
    const ed = live.current.editing;
    let els = live.current.els;
    if (!ed) return els;
    const value = live.current.draft;
    if (ed.kind === "label") {
      els = setLabel(els, ed.id, value, live.current.style);
      const c = els.find((e) => e.id === ed.id);
      const cell = c && cellOf(c);
      if (cell) els = layoutMatrix(els, cell.matrix);
      els = reroute(els, new Set([ed.id]));
    } else els = setText(els, ed.id, value);
    live.current.editing = null;
    setEditing(null);
    return els;
  };
  const endEdit = (how: "done" | "tab" | "back-tab" | "dir", dir?: Dir) => {
    const ed = live.current.editing;
    if (!ed) return;
    const before = live.current.els;
    let els = writeEdit();
    const self = els.find((e) => e.id === ed.id);
    if (!self) {
      recordFrom(before, els);
      setEls(els);
      setSel([]);
      return root.current?.focus();
    }
    // A link label typed first hands over to the node it leads to.
    if (ed.then && (how === "tab" || how === "done")) {
      els = fitLink(els, ed.id);
      recordFrom(before, els);
      setEls(els);
      if (how === "tab" || ed.fresh) return startEdit(ed.then, "label", { fresh: true });
    }
    const cell = cellOf(self);
    if (cell && (how === "tab" || how === "back-tab")) {
      let next = nextCell(els, self.id, how === "back-tab");
      if (!next && how === "tab") {
        els = growMatrix(els, cell.matrix, "row");
        next = nextCell(els, self.id, false);
      }
      recordFrom(before, els);
      setEls(els);
      if (next) return startEdit(next.id, "label");
    } else if ((how === "tab" || how === "dir") && isNode(self) && !isLinear(self)) {
      const made = addChild(els, self, dir ?? flowDir(els, self), live.current.style);
      recordFrom(before, made.els);
      setEls(made.els);
      reveal(bounds(made.node));
      return how === "dir" ? startEdit(made.node.id, "label", { fresh: true }) : startEdit(made.arrow.id, "label", { then: made.node.id, fresh: true });
    } else {
      recordFrom(before, els);
      setEls(els);
    }
    setSel([self.id]);
    root.current?.focus({ preventScroll: true });
  };

  // ---------- making things ----------
  const toolDone = () => !toolLock && setTool("select");
  const newText = (p: Pt) => {
    const t = text(p, "", live.current.style);
    const els = [...live.current.els, { ...t, y: p[1] - (t.height / 2) }];
    apply(els, [t.id]);
    startEdit(t.id, "text", { fresh: true });
  };
  const addNodeAtCentre = (type: Shape) => {
    const v = live.current.view;
    const { w, h } = size();
    const c: Pt = [v.x + w / 2 / v.zoom, v.y + h / 2 / v.zoom];
    const el = shape(type, { x: c[0] - 80, y: c[1] - 32, w: 160, h: 64 }, live.current.style);
    apply([...live.current.els, el], [el.id]);
    startEdit(el.id, "label", { fresh: true });
  };
  const viewCentre = (): Pt => {
    const v = live.current.view;
    const { w, h } = size();
    return [v.x + w / 2 / v.zoom, v.y + h / 2 / v.zoom];
  };
  /** A matrix goes under what is already drawn, or in the middle of an empty canvas. */
  const insertMatrix = () => {
    const c = viewCentre();
    const all = boundsOf(live.current.els);
    const m = addMatrix(live.current.els, all ? [all.x, all.y + all.h + 80] : [c[0] - 270, c[1] - 84], 3, 3, live.current.style);
    apply(m.els, []);
    reveal(boundsOf(m.els.filter((e) => cellOf(e)?.matrix === cellOf(m.els.find((x) => x.id === m.first)!)!.matrix))!);
    startEdit(m.first, "label");
  };

  // ---------- commands ----------
  const units = (): string[][] => {
    const els = live.current.els;
    const seen = new Set<string>();
    const out: string[][] = [];
    for (const id of live.current.sel) {
      if (seen.has(id)) continue;
      const e = els.find((x) => x.id === id);
      if (!e) continue;
      const u = pickSet(els, e, entered).filter((x) => live.current.sel.includes(x));
      u.forEach((x) => seen.add(x));
      out.push(u.length ? u : [id]);
    }
    return out;
  };
  const selIds = () => new Set(live.current.sel);
  const nonEmpty = () => live.current.sel.length > 0;
  const copyData = () => {
    const ids = withLabels(live.current.els, live.current.sel);
    const elements = live.current.els.filter((e) => ids.has(e.id));
    const used = new Set(elements.map((e) => e.fileId).filter(Boolean) as string[]);
    return JSON.stringify({ type: "excalidraw/clipboard", elements, files: Object.fromEntries(Object.entries(live.current.files).filter(([k]) => used.has(k))) });
  };
  const pasteData = (txt: string, at?: Pt) => {
    let parsed: { type?: string; elements?: El[]; files?: Files } | null = null;
    try {
      parsed = JSON.parse(txt);
    } catch {
      parsed = null;
    }
    const p = at ?? viewCentre();
    if (parsed?.type === "excalidraw/clipboard" && Array.isArray(parsed.elements)) {
      const src = parsed.elements.filter((e) => e && typeof e.id === "string" && !e.isDeleted);
      const b = boundsOf(src.filter((e) => !isLabel(e)));
      const copies = clone(src, b ? p[0] - b.x - b.w / 2 : 0, b ? p[1] - b.y - b.h / 2 : 0);
      apply(syncAll([...live.current.els, ...copies]), copies.filter((e) => !isLabel(e)).map((e) => e.id), parsed.files ? { ...live.current.files, ...parsed.files } : undefined);
      return;
    }
    if (!txt.trim()) return;
    // A pasted list of links ("A -> B") becomes a map; anything else, a text box.
    if (/\s-(?:[^>]+?-)?>\s|->/.test(txt)) {
      const r = addMap(live.current.els, txt, live.current.style, p);
      if (r.ids.length) return apply(r.els, r.ids);
    }
    const t = text(p, txt.trim(), live.current.style);
    apply([...live.current.els, { ...t, x: p[0] - t.width / 2, y: p[1] - t.height / 2 }], [t.id]);
  };
  const pasteImage = (file: File, at?: Pt) => {
    const r = new FileReader();
    r.onload = () => {
      const dataURL = String(r.result);
      const img = new Image();
      img.onload = () => {
        const id = uid();
        const scale = Math.min(1, 480 / Math.max(img.width, img.height));
        const [w, h] = [img.width * scale, img.height * scale];
        const p = at ?? viewCentre();
        const el: El = { ...shape("rectangle", { x: p[0] - w / 2, y: p[1] - h / 2, w, h }, live.current.style), type: "image", fileId: id, status: "saved", scale: [1, 1], strokeColor: "transparent" };
        apply([...live.current.els, el], [el.id], { ...live.current.files, [id]: { id, dataURL, mimeType: file.type, created: Date.now() } });
      };
      img.src = dataURL;
    };
    r.readAsDataURL(file);
  };
  const lockToggle = () => {
    const els = live.current.els;
    const ids = withLabels(els, live.current.sel);
    if (!ids.size) {
      const locked = els.filter((e) => e.locked);
      if (locked.length) apply(els.map((e) => (e.locked ? { ...e, locked: false } : e)), locked.map((e) => e.id));
      return;
    }
    const to = !els.find((e) => ids.has(e.id))?.locked;
    apply(els.map((e) => (ids.has(e.id) ? { ...e, locked: to } : e)), to ? [] : [...ids]);
  };
  const copyStyle = () => {
    const e = selected[0];
    if (!e) return;
    styleClip.current = { strokeColor: e.strokeColor, backgroundColor: e.backgroundColor, fillStyle: e.fillStyle, strokeWidth: e.strokeWidth, strokeStyle: e.strokeStyle, opacity: e.opacity, roundness: e.roundness };
    notify("Style copied", "info");
  };
  const pasteStyle = () => {
    const s = styleClip.current;
    if (!s) return;
    const ids = selIds();
    apply(live.current.els.map((e) => (ids.has(e.id) ? { ...e, ...s, ...(e.type === "text" ? { backgroundColor: "transparent" } : {}) } : e)));
  };
  const exportPng = () =>
    void copyPng(live.current.sel.length ? live.current.els.filter((e) => withLabels(live.current.els, live.current.sel).has(e.id)) : live.current.els, live.current.files).then(
      () => notify("Copied as PNG", "info"),
      (e) => notify(`Couldn't copy the PNG: ${(e as Error).message}. Try again, or copy it as SVG.`, "error"),
    );
  const exportSvg = () =>
    void navigator.clipboard.writeText(svgMarkup(live.current.els, live.current.files)).then(
      () => notify("Copied as SVG", "info"),
      () => notify("Couldn't reach the clipboard. Try again.", "error"),
    );
  const exportText = () =>
    void navigator.clipboard.writeText(describe(live.current.els)).then(
      () => notify("Copied as text", "info"),
      () => notify("Couldn't reach the clipboard. Try again.", "error"),
    );

  type Cmd = { id: string; label: string; key?: KeyId; run: () => void; when?: () => boolean; group: string };
  const cmds: Cmd[] = [
    { id: "map", label: "Type a map", key: "d-map", group: "Learn", run: () => setPanel("map") },
    { id: "matrix", label: "Compare matrix", key: "d-matrix", group: "Learn", run: insertMatrix },
    { id: "add-row", label: "Add a row to the matrix", group: "Learn", when: () => !!selected.some(cellOf), run: () => { const c = selected.map(cellOf).find(Boolean)!; apply(growMatrix(live.current.els, c.matrix, "row")); } },
    { id: "add-col", label: "Add a column to the matrix", group: "Learn", when: () => !!selected.some(cellOf), run: () => { const c = selected.map(cellOf).find(Boolean)!; apply(growMatrix(live.current.els, c.matrix, "col")); } },
    { id: "edit", label: "Edit text", key: "d-edit", group: "Edit", when: () => live.current.sel.length === 1, run: () => editSelected() },
    { id: "child", label: "New linked node", key: "d-child", group: "Edit", when: () => selected.length === 1 && isNode(selected[0]!), run: () => child() },
    { id: "sibling", label: "New node beside this one", key: "d-sibling", group: "Edit", when: () => selected.length === 1 && isNode(selected[0]!), run: () => sibling() },
    { id: "link", label: "Link to a node…", key: "d-link", group: "Edit", when: () => selected.length === 1 && isNode(selected[0]!), run: () => setPanel("link") },
    { id: "url", label: "Add or edit link…", key: "d-url", group: "Edit", when: () => selected.length === 1, run: () => setPanel("url") },
    { id: "shape", label: "Change shape (box, ellipse, diamond)", key: "d-shape", group: "Edit", when: () => selected.some((e) => e.type === "rectangle" || e.type === "ellipse" || e.type === "diamond"), run: () => cycleShape() },
    { id: "tidy", label: "Tidy up the map", key: "d-tidy", group: "Arrange", when: () => live.current.els.some((e) => e.type === "arrow" && e.startBinding && e.endBinding), run: () => { apply(tidy(live.current.els, live.current.sel.length > 1 ? selIds() : new Set())); } },
    { id: "duplicate", label: "Duplicate", key: "d-duplicate", group: "Edit", when: nonEmpty, run: () => { const d = duplicate(live.current.els, selIds()); apply(d.els, d.ids); } },
    { id: "copy-style", label: "Copy style", key: "d-copy-style", group: "Edit", when: () => selected.length === 1, run: copyStyle },
    { id: "paste-style", label: "Paste style", key: "d-paste-style", group: "Edit", when: () => nonEmpty() && !!styleClip.current, run: pasteStyle },
    { id: "group", label: "Group", key: "d-group", group: "Arrange", when: () => units().length > 1, run: () => apply(group(live.current.els, selIds())) },
    { id: "ungroup", label: "Ungroup", key: "d-ungroup", group: "Arrange", when: () => selected.some((e) => e.groupIds.length), run: () => apply(ungroup(live.current.els, selIds())) },
    { id: "forward", label: "Bring forward", key: "d-forward", group: "Arrange", when: nonEmpty, run: () => apply(reorder(live.current.els, selIds(), "forward")) },
    { id: "backward", label: "Send backward", key: "d-backward", group: "Arrange", when: nonEmpty, run: () => apply(reorder(live.current.els, selIds(), "backward")) },
    { id: "front", label: "Bring to front", key: "d-front", group: "Arrange", when: nonEmpty, run: () => apply(reorder(live.current.els, selIds(), "front")) },
    { id: "back", label: "Send to back", key: "d-back", group: "Arrange", when: nonEmpty, run: () => apply(reorder(live.current.els, selIds(), "back")) },
    { id: "align-left", label: "Align left", key: "d-align-left", group: "Arrange", when: () => units().length > 1, run: () => apply(align(live.current.els, units(), "left")) },
    { id: "align-hcenter", label: "Align centres horizontally", group: "Arrange", when: () => units().length > 1, run: () => apply(align(live.current.els, units(), "hcenter")) },
    { id: "align-right", label: "Align right", key: "d-align-right", group: "Arrange", when: () => units().length > 1, run: () => apply(align(live.current.els, units(), "right")) },
    { id: "align-top", label: "Align top", key: "d-align-top", group: "Arrange", when: () => units().length > 1, run: () => apply(align(live.current.els, units(), "top")) },
    { id: "align-vcenter", label: "Align centres vertically", group: "Arrange", when: () => units().length > 1, run: () => apply(align(live.current.els, units(), "vcenter")) },
    { id: "align-bottom", label: "Align bottom", key: "d-align-bottom", group: "Arrange", when: () => units().length > 1, run: () => apply(align(live.current.els, units(), "bottom")) },
    { id: "dist-h", label: "Space evenly across", group: "Arrange", when: () => units().length > 2, run: () => apply(distribute(live.current.els, units(), "x")) },
    { id: "dist-v", label: "Space evenly down", group: "Arrange", when: () => units().length > 2, run: () => apply(distribute(live.current.els, units(), "y")) },
    { id: "flip-h", label: "Flip horizontal", key: "d-flip-h", group: "Arrange", when: nonEmpty, run: () => apply(flip(live.current.els, selIds(), "x")) },
    { id: "flip-v", label: "Flip vertical", key: "d-flip-v", group: "Arrange", when: nonEmpty, run: () => apply(flip(live.current.els, selIds(), "y")) },
    { id: "lock", label: "Lock or unlock", key: "d-lock-el", group: "Arrange", run: lockToggle },
    { id: "all", label: "Select all", key: "d-all", group: "Select", run: () => setSel(live.current.els.filter((e) => !isLabel(e) && !e.locked).map((e) => e.id)) },
    { id: "done", label: "Done", key: "d-done", group: "View", run: () => onDone() },
    { id: "expand", label: expand?.full ? "Back beside the source" : "Full window", key: "d-expand", group: "View", when: () => !!expand, run: () => expand?.toggle() },
    { id: "find", label: "Find text", key: "d-find", group: "Select", run: () => setPanel("find") },
    { id: "png", label: "Copy as PNG", key: "d-png", group: "Export", run: exportPng },
    { id: "svg", label: "Copy as SVG", group: "Export", run: exportSvg },
    { id: "txt", label: "Copy as text (nodes and links)", group: "Export", run: exportText },
    { id: "zoom-in", label: "Zoom in", key: "d-zoom-in", group: "View", run: () => zoomTo(live.current.view.zoom * 1.25) },
    { id: "zoom-out", label: "Zoom out", key: "d-zoom-out", group: "View", run: () => zoomTo(live.current.view.zoom / 1.25) },
    { id: "zoom-reset", label: "Zoom to 100%", key: "d-zoom-reset", group: "View", run: () => zoomTo(1) },
    { id: "fit", label: "Zoom to fit everything", key: "d-fit", group: "View", run: () => fit(boundsOf(live.current.els), 2) },
    { id: "fit-sel", label: "Zoom to the selection", key: "d-fit-sel", group: "View", when: nonEmpty, run: () => fit(boundsOf(selected), 3) },
    { id: "grid", label: grid ? "Turn off snap to grid" : "Snap to grid", key: "d-grid", group: "View", run: () => setGrid((x) => !x) },
    { id: "snap", label: snap ? "Turn off snap to shapes" : "Snap to shapes", key: "d-snap", group: "View", run: () => setSnap((x) => !x) },
    { id: "help", label: "Keyboard shortcuts", key: "d-help", group: "View", run: () => setPanel("help") },
    { id: "delete", label: "Delete", key: "d-delete", group: "Edit", when: nonEmpty, run: () => del() },
  ];
  const del = () => {
    const ids = selIds();
    if (!ids.size) return;
    apply(remove(live.current.els, ids), []);
  };
  const editSelected = () => {
    const e = selected[0];
    if (!e || selected.length !== 1) return;
    if (e.type === "text" && !e.containerId) startEdit(e.id, "text");
    else if (isShape(e) && e.type !== "image") startEdit(e.id, "label");
    else if (isLinear(e)) startEdit(e.id, "label");
  };
  const child = (dir?: Dir) => {
    const e = selected[0];
    if (!e || selected.length !== 1 || !isNode(e) || isLinear(e)) return;
    const made = addChild(live.current.els, e, dir ?? flowDir(live.current.els, e), live.current.style);
    apply(made.els, [made.node.id]);
    reveal(bounds(made.node));
    if (dir) startEdit(made.node.id, "label", { fresh: true });
    else startEdit(made.arrow.id, "label", { then: made.node.id, fresh: true });
  };

  /** ⇧↵: another child of this node's parent, beside it (Whimsical's sibling). */
  const sibling = () => {
    const e = selected[0];
    if (!e || selected.length !== 1) return;
    const into = live.current.els.find((a) => a.type === "arrow" && a.endBinding?.elementId === e.id && a.startBinding);
    const parent = into && live.current.els.find((x) => x.id === into.startBinding!.elementId);
    if (!parent) return child();
    // the new node goes the way this one went from the parent, so siblings line up in one row
    const made = addChild(live.current.els, parent, flowDir(live.current.els, e), live.current.style);
    apply(made.els, [made.node.id]);
    reveal(bounds(made.node));
    startEdit(made.arrow.id, "label", { then: made.node.id, fresh: true });
  };
  /** Links the selected node to one already drawn, picked by name; the link's label is typed next. */
  const linkTo = (target: El) => {
    const from = selected[0];
    if (!from) return;
    const arrow = connect(live.current.els, from, target, live.current.style);
    apply([...live.current.els, arrow], [arrow.id]);
    startEdit(arrow.id, "label", { fresh: true });
  };

  /** Box → ellipse → diamond → box, so a node's kind changes without redrawing it or its links. */
  const cycleShape = () => {
    const order = ["rectangle", "ellipse", "diamond"];
    const ids = selIds();
    const next = live.current.els.map((e) => (ids.has(e.id) && order.includes(e.type) ? { ...e, type: order[(order.indexOf(e.type) + 1) % 3]!, roundness: e.roundness && (order[(order.indexOf(e.type) + 1) % 3] === "rectangle" ? { type: 3 } : { type: 2 }) } : e));
    apply(syncAll(reroute(next, ids)));
  };
  const setLink = (href: string) => {
    const id = live.current.sel[0];
    if (!id) return;
    const v = href.trim();
    apply(live.current.els.map((e) => (e.id === id ? { ...e, link: v || null } : e)));
  };

  // ---------- keyboard ----------
  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.target !== root.current) return; // the text box, find field and panels handle their own keys
    const k = e.nativeEvent;
    const plain = !e.metaKey && !e.ctrlKey && !e.altKey;
    if (e.key === " " && !space) {
      setSpace(true);
      e.preventDefault();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      // Done unmounts the editor before this event reaches the window, where the reader's Esc
      // (back to sources) and ⌘↵ (finish) listen: stop it here, not in Diagram.tsx's document listener.
      e.stopPropagation();
      if (multi) return finishMulti();
      if (g.current) return cancelGesture();
      if (entered) {
        setEntered(null);
        return setSel([]);
      }
      if (live.current.sel.length) return setSel([]);
      if (tool !== "select") return setTool("select");
      return onDone();
    }
    if (e.key === "Enter" && multi) {
      e.preventDefault();
      return finishMulti();
    }
    if (is(k, "undo")) {
      e.preventDefault();
      return undo();
    }
    if (is(k, "redo") || (e.metaKey && e.code === "KeyY")) {
      e.preventDefault();
      return redo();
    }
    if (e.key === "Delete") {
      e.preventDefault();
      return del();
    }
    // Arrows: ⌘ grows a linked node that way, ⌥ moves to the nearest node that way, plain nudges.
    const dirs: Record<string, Dir> = { ArrowRight: "right", ArrowLeft: "left", ArrowDown: "down", ArrowUp: "up" };
    const dir = dirs[e.key];
    if (dir && !e.shiftKey && e.metaKey && !e.altKey && selected.length === 1) {
      e.preventDefault();
      return child(dir);
    }
    if (dir && e.altKey && !e.metaKey) {
      e.preventDefault();
      const from = selected[0] ?? live.current.els.find(isNode);
      const to = from && (selected[0] ? nearestIn(live.current.els, from, dir) : from);
      if (to) {
        setSel(pickSet(live.current.els, to, entered));
        reveal(bounds(to));
      }
      return;
    }
    if (dir && !e.metaKey && !e.altKey && live.current.sel.length) {
      e.preventDefault();
      const d = e.shiftKey ? GRID : 1;
      const [dx, dy] = dir === "right" ? [d, 0] : dir === "left" ? [-d, 0] : dir === "down" ? [0, d] : [0, -d];
      return apply(move(live.current.els, selIds(), dx, dy));
    }
    // Tab on a node grows the map; with nothing picked it moves focus to the toolbars, and ⌥+arrow picks a node.
    if (e.key === "Tab" && !e.metaKey && selected.length === 1) {
      e.preventDefault();
      if (cellOf(selected[0]!)) {
        const n = nextCell(live.current.els, selected[0]!.id, e.shiftKey);
        if (n) setSel([n.id]);
        return;
      }
      return child();
    }
    for (const c of cmds) {
      if (c.key && is(k, c.key) && (!c.when || c.when())) {
        e.preventDefault();
        e.stopPropagation();
        return c.run();
      }
    }
    if (is(k, "d-commands") || is(k, "palette")) {
      e.preventDefault();
      return setPanel("commands");
    }
    if (is(k, "d-lock")) return setToolLock((x) => !x);
    if (plain && !e.shiftKey) {
      const t = TOOLS.find((x) => is(k, x.key))?.tool ?? DIGITS[e.code];
      if (t) {
        e.preventDefault();
        setTool(t);
        if (t !== "select") setSel([]);
        return;
      }
    }
  };
  const onKeyUp = (e: ReactKeyboardEvent) => {
    if (e.key === " ") setSpace(false);
  };
  // Space held when focus leaves (the name field, another app) never gets its key-up here.
  const onBlur = () => setSpace(false);

  // ---------- clipboard ----------
  useEffect(() => {
    const busy = () => document.activeElement !== root.current;
    const onCopy = (e: ClipboardEvent) => {
      if (busy() || !live.current.sel.length) return;
      e.preventDefault();
      e.clipboardData?.setData("text/plain", copyData());
    };
    const onCut = (e: ClipboardEvent) => {
      if (busy() || !live.current.sel.length) return;
      e.preventDefault();
      e.clipboardData?.setData("text/plain", copyData());
      apply(remove(live.current.els, new Set(live.current.sel)), []);
    };
    const onPaste = (e: ClipboardEvent) => {
      if (busy()) return;
      e.preventDefault();
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (file) return pasteImage(file);
      pasteData(e.clipboardData?.getData("text/plain") ?? "");
    };
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);
    document.addEventListener("paste", onPaste);
    return () => {
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("paste", onPaste);
    };
  });

  // ---------- wheel and pinch ----------
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) return zoomTo(live.current.view.zoom * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002)), e.clientX - r.left, e.clientY - r.top);
      const v = live.current.view;
      const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
      const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
      live.current.view = { ...v, x: v.x + dx / v.zoom, y: v.y + dy / v.zoom };
      setView(live.current.view);
    };
    // WebKit sends trackpad pinches as gesture events, not ctrl+wheel.
    let z0 = 1;
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      z0 = live.current.view.zoom;
    };
    const onGesture = (e: Event) => {
      e.preventDefault();
      const ge = e as Event & { scale: number; clientX: number; clientY: number };
      const r = el.getBoundingClientRect();
      zoomTo(z0 * ge.scale, ge.clientX - r.left, ge.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("gesturestart", onGestureStart);
    el.addEventListener("gesturechange", onGesture);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", onGestureStart);
      el.removeEventListener("gesturechange", onGesture);
    };
  });

  // ---------- pointer ----------
  const others = (skip: Set<string>) => {
    const v = live.current.view;
    const { w, h } = size();
    const screen = { x: v.x, y: v.y, w: w / v.zoom, h: h / v.zoom };
    return live.current.els.filter((e) => !skip.has(e.id) && !isLabel(e) && !isLinear(e)).map(bounds).filter((b) => b.x < screen.x + screen.w && b.x + b.w > screen.x && b.y < screen.y + screen.h && b.y + b.h > screen.y);
  };
  const snapTol = () => 7 / live.current.view.zoom;
  const snapP = (p: Pt, skip: Set<string>, off: boolean) => {
    if (off || (!snap && !grid)) return { p, guides: [] as Guide[] };
    return snapPoint(p, snap ? others(skip) : [], snapTol(), grid ? GRID : null);
  };
  const handleAt = (p: Pt): Handle | "rotate" | null => {
    const h = handlesOf(selected.filter((e) => !e.locked), live.current.view.zoom);
    if (!h || selected.some((e) => e.locked)) return null;
    for (const x of h.at) if (dist(x.p, p) <= 7 / live.current.view.zoom) return x.h;
    return null;
  };
  const pointAt = (p: Pt): { index: number; mid: boolean } | null => {
    const e = selected.length === 1 ? selected[0]! : null;
    if (!e || !isLinear(e) || e.locked) return null;
    const pts = absPoints(e);
    const r = 7 / live.current.view.zoom;
    for (let i = 0; i < pts.length; i++) if (dist(pts[i]!, p) <= r) return { index: i, mid: false };
    if (!e.elbowed) for (let i = 1; i < pts.length; i++) if (dist(midOf(pts[i - 1]!, pts[i]!), p) <= r) return { index: i, mid: true };
    return null;
  };

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button === 2) {
      const p = toScene(e.clientX, e.clientY);
      const hit = topAt(live.current.els, p, tol(), true);
      if (hit && !selSet.has(hit.id) && !(isLabel(hit) && hit.containerId && selSet.has(hit.containerId))) setSel(hit.locked ? [hit.id] : pickSet(live.current.els, hit, entered));
      if (!hit) setSel([]);
      return;
    }
    // The canvas keeps focus itself: a mousedown's default focus change would pull it out of a text box just opened.
    e.preventDefault();
    if (live.current.editing) endEdit("done");
    root.current?.focus({ preventScroll: true });
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = toScene(e.clientX, e.clientY);
    const els = live.current.els;
    if (e.button === 1 || space || tool === "hand") {
      g.current = { kind: "pan", start: [e.clientX, e.clientY], view: live.current.view };
      return setCursor("grabbing");
    }
    if (multi) {
      const m = els.find((x) => x.id === multi);
      if (!m) return setMulti(null);
      const pts = absPoints(m);
      // Clicking the first point closes a line into a shape.
      if (pts.length > 2 && dist(pts[0]!, p) < 10 / live.current.view.zoom) {
        pts[pts.length - 1] = pts[0]!;
        setEls(els.map((x) => (x.id === multi ? withPoints(x, pts) : x)));
        return finishMulti(true);
      }
      const at = snapP(p, new Set([multi]), e.metaKey).p;
      pts[pts.length - 1] = at;
      pts.push(at);
      setEls(els.map((x) => (x.id === multi ? withPoints(x, pts) : x)));
      return;
    }
    const s = live.current.style;
    if (tool === "rectangle" || tool === "ellipse" || tool === "diamond") {
      const at = snapP(p, new Set(), e.metaKey).p;
      const el = shape(tool, { x: at[0], y: at[1], w: 0, h: 0 }, s);
      g.current = { kind: "create", before: els, id: el.id, start: at, type: tool };
      setEls([...els, el]);
      return setSel([el.id]);
    }
    if (tool === "arrow" || tool === "line") {
      const on = tool === "arrow" ? bindTarget(els, p, 8 / live.current.view.zoom) : null;
      const at = on ? p : snapP(p, new Set(), e.metaKey).p;
      const el = { ...linear(tool, [at, at], s), startBinding: on ? { elementId: on.id, focus: 0, gap: GAP } : null };
      g.current = { kind: "line", before: els, id: el.id, start: at, startOn: on?.id ?? null };
      setEls([...els, el]);
      return setSel([el.id]);
    }
    if (tool === "freedraw") {
      const el: El = { ...linear("line", [p], s), type: "freedraw", pressures: [], simulatePressure: true, roundness: null, startArrowhead: null, endArrowhead: null };
      g.current = { kind: "draw", before: els, id: el.id, pts: [p] };
      return setEls([...els, el]);
    }
    if (tool === "eraser") {
      const hit = topAt(els, p, tol());
      g.current = { kind: "erase", ids: new Set(hit ? pickSet(els, hit, entered) : []) };
      return force((n) => n + 1);
    }
    if (tool === "text") {
      const hit = topAt(els, p, tol());
      const target = hit && isLabel(hit) ? els.find((x) => x.id === hit.containerId) : hit;
      if (target && (isShape(target) || isLinear(target)) && target.type !== "image") startEdit(target.id, "label");
      else if (target?.type === "text") startEdit(target.id, "text");
      else newText(p);
      return toolDone();
    }
    // select
    const pt = pointAt(p);
    if (pt) {
      const line = selected[0]!;
      let next = line;
      let index = pt.index;
      if (pt.mid) {
        const pts = absPoints(line);
        pts.splice(pt.index, 0, midOf(pts[pt.index - 1]!, pts[pt.index]!));
        next = withPoints(line, pts);
        setEls(els.map((x) => (x.id === line.id ? next : x)));
      }
      g.current = { kind: "point", before: els, id: line.id, index };
      return;
    }
    const h = handleAt(p);
    if (h) {
      const starts = selected;
      const box = starts.length === 1 ? frame(starts[0]!) : union(starts.map(bounds))!;
      if (h === "rotate") {
        const about = starts.length === 1 ? centre(starts[0]!) : ([box.x + box.w / 2, box.y + box.h / 2] as Pt);
        g.current = { kind: "rotate", before: els, starts, about, a0: Math.atan2(p[1] - about[1], p[0] - about[0]) };
      } else g.current = { kind: "resize", handle: h, before: els, starts, box, others: snap ? others(selSet) : [] };
      return;
    }
    const hit = topAt(els, p, tol());
    if (!hit) {
      if (!e.shiftKey) setSel([]);
      if (entered) setEntered(null);
      g.current = { kind: "marquee", start: p, end: p, add: e.shiftKey ? live.current.sel : [] };
      return;
    }
    const pick = pickSet(els, hit, entered);
    let ids: string[];
    if (e.shiftKey) {
      const has = pick.every((id) => live.current.sel.includes(id));
      ids = has ? live.current.sel.filter((id) => !pick.includes(id)) : [...live.current.sel, ...pick];
      setSel(ids);
      if (has) return;
    } else {
      ids = pick.some((id) => live.current.sel.includes(id)) ? live.current.sel : pick;
      setSel(ids);
    }
    let before = els;
    let moving = new Set(ids);
    if (e.altKey) {
      // ⌥-drag leaves a copy behind and moves the original's twin, as in Figma.
      const d = duplicate(els, moving, 0, 0);
      setEls(d.els);
      moving = new Set(d.ids);
      setSel(d.ids);
      before = els;
    }
    const all = withLabels(live.current.els, moving);
    const box = boundsOf(live.current.els.filter((x) => all.has(x.id)))!;
    // A click (no drag) on one of several selected shapes picks just that one (Figma, Excalidraw).
    g.current = { kind: "move", start: p, before, ids: moving, box, others: snap ? others(all) : [], dx: 0, dy: 0, pick: !e.shiftKey && !e.altKey && ids.length > pick.length ? pick : undefined };
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const p = toScene(e.clientX, e.clientY);
    const cur = g.current;
    const els = live.current.els;
    if (!cur) {
      if (multi) {
        const m = els.find((x) => x.id === multi);
        if (!m) return;
        const pts = absPoints(m);
        pts[pts.length - 1] = snapP(p, new Set([multi]), e.metaKey).p;
        setEls(els.map((x) => (x.id === multi ? withPoints(x, pts) : x)));
        setHot(m.type === "arrow" ? (bindTarget(els, p, 8 / live.current.view.zoom, new Set([multi]))?.id ?? null) : null);
        return;
      }
      if (space || tool === "hand") return setCursor("grab");
      if (tool !== "select") return setCursor(CURSOR[tool] ?? "crosshair");
      const h = pointAt(p) ? "move" : handleAt(p);
      if (h) return setCursor(h === "move" ? "pointer" : h === "rotate" ? "grab" : HANDLE_CURSOR[rotHandle(h, selected.length === 1 ? selected[0]!.angle : 0)]);
      const hit = topAt(els, p, tol());
      setCursor(hit ? "move" : undefined);
      return;
    }
    const off = e.metaKey;
    if (cur.kind === "pan") {
      const v = cur.view;
      live.current.view = { ...v, x: v.x - (e.clientX - cur.start[0]) / v.zoom, y: v.y - (e.clientY - cur.start[1]) / v.zoom };
      return setView(live.current.view);
    }
    if (cur.kind === "move") {
      let dx = p[0] - cur.start[0];
      let dy = p[1] - cur.start[1];
      if (e.shiftKey) Math.abs(dx) > Math.abs(dy) ? (dy = 0) : (dx = 0);
      let gs: Guide[] = [];
      if (!off && (snap || grid)) {
        const s = snapBox({ ...cur.box, x: cur.box.x + dx, y: cur.box.y + dy }, cur.others, snapTol(), grid ? GRID : null);
        dx += s.dx;
        dy += s.dy;
        gs = s.guides;
      }
      cur.dx = dx;
      cur.dy = dy;
      setGuides(gs);
      // Moved elements draw at an offset until the drag ends; only arrows bound to them re-route live.
      return force((n) => n + 1);
    }
    if (cur.kind === "marquee") {
      cur.end = p;
      const box = rectOf(cur.start, p);
      const inBox = els.filter((x) => !isLabel(x) && !x.locked && containsBox(box, bounds(x)));
      const ids = new Set(cur.add);
      for (const x of inBox) for (const id of pickSet(els, x, entered)) ids.add(id);
      return setSel([...ids]);
    }
    if (cur.kind === "resize") {
      const sp = off ? { p, guides: [] } : snapP(p, selSet, false);
      setGuides(sp.guides);
      const single = cur.starts.length === 1 ? cur.starts[0]! : null;
      const keep = e.shiftKey || (single?.type === "text") || (single?.type === "image" && !e.shiftKey ? true : e.shiftKey);
      let next: El[];
      if (single) next = [resize(single, single, cur.handle, sp.p, keep && !(single.type === "image" && e.shiftKey) ? true : keep, e.altKey)];
      else {
        const pseudo = { ...single ?? cur.starts[0]!, type: "rectangle", x: cur.box.x, y: cur.box.y, width: cur.box.w, height: cur.box.h, angle: 0, points: undefined } as El;
        const r = resize(pseudo, pseudo, cur.handle, sp.p, e.shiftKey, e.altKey);
        next = resizeMany(cur.starts, cur.box, { x: r.x, y: r.y, w: r.width, h: r.height });
      }
      const nm = new Map(next.map((x) => [x.id, x]));
      const out = cur.before.map((x) => nm.get(x.id) ?? x);
      return setEls(syncAll(reroute(out, new Set(nm.keys()))));
    }
    if (cur.kind === "rotate") {
      let da = Math.atan2(p[1] - cur.about[1], p[0] - cur.about[0]) - cur.a0;
      if (e.shiftKey) {
        const base = cur.starts.length === 1 ? cur.starts[0]!.angle : 0;
        const step = Math.PI / 12;
        da = Math.round((base + da) / step) * step - base;
      }
      const next = rotate(cur.starts, cur.about, da);
      const nm = new Map(next.map((x) => [x.id, x]));
      return setEls(syncAll(reroute(cur.before.map((x) => nm.get(x.id) ?? x), new Set(nm.keys()))));
    }
    if (cur.kind === "create") {
      const sp = off ? { p, guides: [] } : snapP(p, new Set([cur.id]), false);
      setGuides(sp.guides);
      let [x0, y0] = cur.start;
      let [x1, y1] = sp.p;
      if (e.shiftKey) {
        const d = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
        x1 = x0 + d * Math.sign(x1 - x0 || 1);
        y1 = y0 + d * Math.sign(y1 - y0 || 1);
      }
      if (e.altKey) {
        x0 = 2 * cur.start[0] - x1;
        y0 = 2 * cur.start[1] - y1;
      }
      const b = rectOf([x0, y0], [x1, y1]);
      return setEls(els.map((x) => (x.id === cur.id ? { ...x, x: b.x, y: b.y, width: b.w, height: b.h } : x)));
    }
    if (cur.kind === "line") {
      const target = els.find((x) => x.id === cur.id)?.type === "arrow" ? bindTarget(els, p, 8 / live.current.view.zoom, new Set([cur.id, ...(cur.startOn ? [cur.startOn] : [])])) : null;
      setHot(target?.id ?? null);
      let end = target ? p : snapP(p, new Set([cur.id]), off).p;
      if (e.shiftKey && !target) end = angleSnap(cur.start, end);
      return setEls(syncAll(els.map((x) => {
        if (x.id !== cur.id) return x;
        const line = withPoints(x, [cur.start, end]);
        return route({ ...line, endBinding: target ? { elementId: target.id, focus: 0, gap: GAP } : null }, byId(els));
      })));
    }
    if (cur.kind === "point") {
      const line = els.find((x) => x.id === cur.id);
      if (!line) return;
      const pts = absPoints(line);
      const ends = cur.index === 0 || cur.index === pts.length - 1;
      const target = ends && line.type === "arrow" ? bindTarget(els, p, 8 / live.current.view.zoom, new Set([line.id])) : null;
      setHot(target?.id ?? null);
      pts[cur.index] = target ? p : snapP(p, new Set([line.id]), off).p;
      let next = withPoints(line, pts);
      if (ends && line.type === "arrow") next = { ...next, [cur.index === 0 ? "startBinding" : "endBinding"]: target ? { elementId: target.id, focus: 0, gap: GAP } : null };
      return setEls(syncAll(els.map((x) => (x.id === line.id ? route(next, byId(els)) : x))));
    }
    if (cur.kind === "draw") {
      cur.pts.push(p);
      return setEls(els.map((x) => (x.id === cur.id ? withPoints(x, cur.pts) : x)));
    }
    if (cur.kind === "erase") {
      const hit = topAt(els, p, tol());
      if (hit) for (const id of pickSet(els, hit, entered)) cur.ids.add(id);
      return force((n) => n + 1);
    }
  };

  const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    const cur = g.current;
    g.current = null;
    setGuides([]);
    setHot(null);
    if (!cur) return;
    const els = live.current.els;
    if (cur.kind === "pan") return setCursor(space || tool === "hand" ? "grab" : undefined);
    if (cur.kind === "move") {
      if (!cur.dx && !cur.dy) {
        if (cur.before !== els) setEls(cur.before); // an ⌥-click that never moved leaves no copy
        if (cur.before !== els) setSel(live.current.sel.length ? [...cur.ids].filter((id) => cur.before.some((x) => x.id === id)) : []);
        else if (cur.pick) setSel(cur.pick);
        return;
      }
      const next = move(els, cur.ids, cur.dx, cur.dy);
      recordFrom(cur.before, next);
      return setEls(next);
    }
    if (cur.kind === "marquee") return force((n) => n + 1);
    if (cur.kind === "erase") {
      if (cur.ids.size) apply(remove(els, cur.ids), []);
      return force((n) => n + 1);
    }
    if (cur.kind === "create") {
      const el = els.find((x) => x.id === cur.id)!;
      let next = els;
      if (el.width < 4 && el.height < 4) {
        const at = cur.start;
        next = els.map((x) => (x.id === cur.id ? { ...x, x: at[0] - 80, y: at[1] - 32, width: 160, height: 64 } : x));
        setEls(next);
      }
      recordFrom(cur.before);
      toolDone();
      startEdit(cur.id, "label", { fresh: true });
      return;
    }
    if (cur.kind === "line") {
      const el = els.find((x) => x.id === cur.id)!;
      if (dist(cur.start, absPoints(el).at(-1)!) < 4 / live.current.view.zoom) {
        // A click, not a drag: draw point by point; Enter, Esc or double-click finishes.
        setEls(els.map((x) => (x.id === cur.id ? withPoints(x, [cur.start, toScene(e.clientX, e.clientY)]) : x)));
        hist.current.past.push(cur.before);
        hist.current.future = [];
        return setMulti(cur.id);
      }
      recordFrom(cur.before);
      setSel([cur.id]);
      return toolDone();
    }
    if (cur.kind === "draw") {
      const span = boundsOf([els.find((x) => x.id === cur.id)!]);
      // A tap with the pen draws no dot: it picks what is under it, so a double-click still edits text.
      if (span && span.w * live.current.view.zoom < 3 && span.h * live.current.view.zoom < 3) {
        setEls(cur.before);
        const hit = topAt(cur.before, toScene(e.clientX, e.clientY), tol());
        setSel(hit ? pickSet(cur.before, hit, entered) : []);
        return;
      }
      recordFrom(cur.before);
      return;
    }
    recordFrom(cur.before);
  };
  const cancelGesture = () => {
    const cur = g.current;
    g.current = null;
    setGuides([]);
    setHot(null);
    if (cur && "before" in cur) setEls(cur.before);
    force((n) => n + 1);
  };
  const finishMulti = (closed = false) => {
    const id = multi;
    setMulti(null);
    setHot(null);
    if (!id) return;
    const els = live.current.els;
    const m = els.find((x) => x.id === id);
    if (!m) return;
    const pts = absPoints(m);
    if (!closed) pts.pop();
    if (pts.length < 2) {
      setEls(els.filter((x) => x.id !== id));
      hist.current.past.pop();
      return;
    }
    let next = withPoints(m, pts);
    if (m.type === "arrow") {
      const end = bindTarget(els, pts[pts.length - 1]!, 8 / live.current.view.zoom, new Set([id]));
      if (end) next = route({ ...next, endBinding: { elementId: end.id, focus: 0, gap: GAP } }, byId(els));
    }
    setEls(els.map((x) => (x.id === id ? next : x)));
    setSel([id]);
    toolDone();
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (multi) return finishMulti();
    if (tool !== "select" && tool !== "freedraw") return;
    const p = toScene(e.clientX, e.clientY);
    const els = live.current.els;
    const pt = pointAt(p);
    if (pt && !pt.mid) {
      const line = selected[0]!;
      const pts = absPoints(line);
      if (pts.length > 2) {
        pts.splice(pt.index, 1);
        apply(els.map((x) => (x.id === line.id ? route(withPoints(line, pts), byId(els)) : x)));
      }
      return;
    }
    const hit = topAt(els, p, tol());
    if (!hit) return newText(p);
    const target = isLabel(hit) ? els.find((x) => x.id === hit.containerId) ?? hit : hit;
    // In a group, double-click goes in and picks the one under the pointer (Figma, Excalidraw).
    const gid = target.groupIds.length && !cellOf(target) ? (entered ? target.groupIds[target.groupIds.indexOf(entered) - 1] : target.groupIds.at(-1)) : undefined;
    if (gid && !live.current.sel.every((id) => id === target.id) && target.groupIds.length > (entered ? target.groupIds.indexOf(entered) : 0) && !cellOf(target)) {
      setEntered(gid);
      return setSel([target.id]);
    }
    if (target.type === "text") return startEdit(target.id, "text");
    if (target.type !== "image" && target.type !== "freedraw") startEdit(target.id, "label");
  };

  // ---------- drop images ----------
  const onDrop = (e: React.DragEvent) => {
    const f = [...e.dataTransfer.files].find((x) => x.type.startsWith("image/"));
    if (!f) return;
    e.preventDefault();
    e.stopPropagation();
    pasteImage(f, toScene(e.clientX, e.clientY));
  };

  // ---------- style ----------
  const kinds = new Set(selected.map((e) => e.type));
  const showStyle = selected.length > 0 || (tool !== "select" && tool !== "hand" && tool !== "eraser");
  const current = selected[0];
  const value = <K extends keyof Style>(k: K): Style[K] => (current && k in current ? (current[k as keyof El] as Style[K]) : style[k]);
  const setProp = (patch: Partial<Style>) => {
    setStyle((s) => ({ ...s, ...patch }));
    if (!selected.length) return;
    const ids = withLabels(live.current.els, live.current.sel);
    let next = live.current.els.map((e) => {
      if (!ids.has(e.id)) return e;
      const p: Partial<El> = {};
      for (const [k, v] of Object.entries(patch)) {
        if (k === "fontSize" || k === "fontFamily" || k === "textAlign") { if (e.type === "text") (p as Record<string, unknown>)[k] = v; }
        else if (k === "startArrowhead" || k === "endArrowhead" || k === "elbowed") { if (e.type === "arrow") (p as Record<string, unknown>)[k] = v; }
        else if (k === "backgroundColor" || k === "fillStyle") { if (e.type !== "text" && !isLinear(e)) (p as Record<string, unknown>)[k] = v; }
        else if (k === "roundness") { if (e.type !== "text") p.roundness = v ? (e.type === "rectangle" ? { type: 3 } : { type: 2 }) : null; }
        else (p as Record<string, unknown>)[k] = v;
      }
      return { ...e, ...p };
    });
    next = next.map((e) => (e.type === "text" && !e.containerId && ids.has(e.id) ? { ...e, ...measureText(e.text ?? "", e.fontSize ?? 20, e.fontFamily ?? SANS, lineHeightOf(e)) } : e));
    apply(syncAll(reroute(next, ids)));
  };

  // ---------- render ----------
  const cur = g.current;
  const moving = cur?.kind === "move" && (cur.dx || cur.dy) ? cur : null;
  const movingAll = moving ? withLabels(els, moving.ids) : null;
  const shown = useMemo(() => {
    if (!moving || !movingAll) return els;
    // Only arrows bound to what moves, and not moving themselves, re-route while dragging.
    const affected = new Set(els.filter((e) => e.type === "arrow" && !movingAll.has(e.id) && ((e.startBinding && movingAll.has(e.startBinding.elementId)) || (e.endBinding && movingAll.has(e.endBinding.elementId)))).map((e) => e.id));
    if (!affected.size) return els;
    const shifted = byId(els);
    for (const id of movingAll) {
      const x = shifted.get(id);
      if (x) shifted.set(id, { ...x, x: x.x + moving.dx, y: x.y + moving.dy });
    }
    const labels = new Set(els.filter((e) => e.containerId && affected.has(e.containerId)).map((e) => e.id));
    return syncAll(els.map((e) => (affected.has(e.id) ? route(e, shifted) : e))).map((e) => (affected.has(e.id) || labels.has(e.id) ? e : (els.find((x) => x.id === e.id) ?? e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [els, moving?.dx, moving?.dy]);
  const erasing = cur?.kind === "erase" ? withLabels(els, cur.ids) : null;
  const editingLabel = editing?.kind === "label" ? labelOf(els, editing.id)?.id : editing?.id;
  const handles = !editing && !multi && (!cur || cur.kind === "marquee") ? handlesOf(selected.filter((e) => !isLabel(e)), view.zoom) : null;
  const z = view.zoom;
  const containers = byId(shown);

  const editBox = (() => {
    if (!editing) return null;
    const e = map.get(editing.id);
    if (!e) return null;
    const isLbl = editing.kind === "label";
    const lbl = isLbl ? labelOf(els, e.id) : e;
    const fs = lbl?.fontSize ?? (isLinear(e) ? Math.min(style.fontSize, 16) : style.fontSize);
    const fam = lbl?.fontFamily ?? style.fontFamily;
    const lh = fs * 1.25;
    if (isLbl) {
      const w = labelWidth(e);
      const wrapped = wrap(draft || " ", w, fs, fam);
      const lines = wrapped.split("\n").length;
      const c = isLinear(e) ? midOfPts(absPoints(e)) : centre(e);
      const width = isLinear(e) ? Math.max(60, measureText(wrapped, fs, fam).width + 12) : w;
      return { left: (c[0] - width / 2 - view.x) * z, top: (c[1] - (lines * lh) / 2 - view.y) * z, width: width * z, height: lines * lh * z, font: fs * z, fam, align: "center" as const, angle: isLinear(e) ? 0 : e.angle, colour: dark(e.strokeColor), wrap: true };
    }
    const m = measureText(draft || " ", fs, fam);
    return { left: (e.x - view.x) * z, top: (e.y - view.y) * z, width: (m.width + fs) * z, height: m.height * z, font: fs * z, fam, align: (e.textAlign ?? "left") as "left" | "center" | "right", angle: e.angle, colour: dark(e.strokeColor), wrap: false };
  })();

  useLayoutEffect(() => {
    if (editing) area.current?.focus({ preventScroll: true });
  }, [editing]);

  const onAreaKey = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    const ed = live.current.editing;
    if (!ed) return;
    if (e.key === "Escape") {
      e.preventDefault();
      return endEdit("done");
    }
    if (e.key === "Tab") {
      e.preventDefault();
      return endEdit(e.shiftKey ? "back-tab" : "tab");
    }
    if (e.key === "Enter" && e.metaKey) {
      e.preventDefault();
      return endEdit("done");
    }
    const dirs: Record<string, Dir> = { ArrowRight: "right", ArrowLeft: "left", ArrowDown: "down", ArrowUp: "up" };
    if (e.metaKey && e.altKey && dirs[e.key] && ed.kind === "label") {
      e.preventDefault();
      return endEdit("dir", dirs[e.key]);
    }
    // In a box or on an arrow, Enter finishes (⇧↵ for a new line); free text takes Enter as a new line.
    if (e.key === "Enter" && !e.shiftKey && ed.kind === "label") {
      e.preventDefault();
      return endEdit("done");
    }
  };

  const empty = !els.length && !editing;
  const hintKeys = (k: KeyId) => label(keys[k]);
  const menu = (): MenuAction[] => {
    const pick = (ids: string[]) => cmds.filter((c) => ids.includes(c.id) && (!c.when || c.when()));
    const rows = live.current.sel.length
      ? pick(["edit", "child", "sibling", "link", "url", "shape", "duplicate", "copy-style", "paste-style", "add-row", "add-col", "tidy", "group", "ungroup", "forward", "backward", "front", "back", "align-left", "align-hcenter", "align-right", "align-top", "align-vcenter", "align-bottom", "dist-h", "dist-v", "flip-h", "flip-v", "lock", "fit-sel", "png", "svg", "txt", "delete"])
      : pick(["map", "matrix", "all", "lock", "tidy", "fit", "grid", "snap", "png", "svg", "txt"]);
    const groupOf = (c: Cmd) => c.group;
    return rows.map((c, i) => ({ id: c.id, label: c.label, hint: c.key ? hintKeys(c.key) : undefined, danger: c.id === "delete", divider: i > 0 && groupOf(rows[i - 1]!) !== groupOf(c), run: c.run }));
  };

  const arrowHeads = ["arrow", "triangle", "dot", "bar", null] as const;
  const summary = useMemo(() => describe(els), [els]);

  return (
    <div
      ref={root}
      className={`draw${space ? " panning" : ""}`}
      tabIndex={0}
      role="application"
      aria-label={`Diagram ${name}`}
      aria-roledescription="diagram editor"
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={onBlur}
      onDragOver={(e) => e.dataTransfer.types.includes("Files") && e.preventDefault()}
      onDrop={onDrop}
      style={{ "--draw-ground": "var(--bg)" } as CSSProperties}
    >
      <WithMenu actions={menu}>
        <svg
          ref={svg}
          className="draw-canvas"
          style={{ cursor: cursor ?? (space ? "grab" : CURSOR[tool] ?? (tool === "select" ? undefined : "crosshair")), backgroundSize: grid ? `${GRID * z}px ${GRID * z}px` : undefined, backgroundPosition: grid ? `${-view.x * z}px ${-view.y * z}px` : undefined }}
          data-grid={grid || undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={cancelGesture}
          onDoubleClick={onDoubleClick}
          aria-hidden="true"
        >
          <Defs els={els} />
          <g transform={`scale(${z}) translate(${-view.x} ${-view.y})`}>
            {shown.map((e) => {
              if (editingLabel === e.id || (moving && movingAll?.has(e.id))) return null;
              const el = <Element key={e.id} e={e} container={e.containerId ? containers.get(e.containerId) : undefined} files={files} />;
              return erasing?.has(e.id) ? <g key={e.id} opacity={0.25}>{el}</g> : el;
            })}
          </g>
        </svg>
      </WithMenu>
      <svg className="draw-lift draw-over" aria-hidden="true">
        <g transform={`scale(${z}) translate(${-view.x} ${-view.y})`}>
          <Overlay
              selected={moving ? [] : selected.filter((e) => !isLabel(e))}
              handles={handles}
              z={z}
              hot={hot ? map.get(hot) : undefined}
              guides={guides}
              marquee={cur?.kind === "marquee" ? rectOf(cur.start, cur.end) : null}
              moveBox={moving ? { ...moving.box, x: moving.box.x + moving.dx, y: moving.box.y + moving.dy } : null}
              showPoints={!multi && !editing && selected.length === 1 && isLinear(selected[0]!) && !selected[0]!.locked}
            />
        </g>
      </svg>
      {moving && movingAll && (
        // What moves is lifted onto its own layer and slid by the compositor: no repaint per frame,
        // however many elements are picked up (Figma lifts a drag the same way).
        <svg className="draw-lift" aria-hidden="true" style={{ transform: `translate(${moving.dx * z}px, ${moving.dy * z}px)` }}>
          <Defs els={els} />
          <g transform={`scale(${z}) translate(${-view.x} ${-view.y})`}>
            {els.map((e) => (movingAll.has(e.id) ? <Element key={e.id} e={e} container={e.containerId ? containers.get(e.containerId) : undefined} files={files} /> : null))}
          </g>
        </svg>
      )}

      {editBox && (
        <textarea
          ref={area}
          className="draw-text"
          value={draft}
          placeholder={editing?.then ? "Link label (Tab to skip)" : editing?.fresh ? "Type a label" : undefined}
          aria-label={editing?.then ? "Link label" : "Text"}
          onChange={(e) => {
            setDraft(e.target.value);
            live.current.draft = e.target.value;
          }}
          onKeyDown={onAreaKey}
          onBlur={() => live.current.editing && !panel && endEdit("done")}
          style={{
            left: editBox.left, top: editBox.top, width: editBox.width, height: editBox.height, fontSize: editBox.font, lineHeight: 1.25, fontFamily: fontOf(editBox.fam),
            textAlign: editBox.align, color: editBox.colour, transform: editBox.angle ? `rotate(${editBox.angle}rad)` : undefined, whiteSpace: editBox.wrap ? "pre-wrap" : "pre",
          }}
        />
      )}

      {/* The bars never take focus on a click, so Backspace, ⌘Z and the rest keep working after a swatch or
          a zoom button (Excalidraw); Tab still reaches them. */}
      <div className="draw-tools" role="toolbar" aria-label="Tools" onMouseDown={keepFocus}>
        {TOOLS.map((t) => (
          <Hint key={t.tool} text={t.label} keys={t.key}>
            <button className="draw-tool" aria-pressed={tool === t.tool} aria-label={t.label} onClick={() => { setTool(t.tool); if (t.tool !== "select") setSel([]); root.current?.focus(); }}>
              {t.icon}
            </button>
          </Hint>
        ))}
        <Hint text={toolLock ? "Tool stays after drawing" : "Keep the tool after drawing"} keys="d-lock">
          <button className="draw-tool" aria-pressed={toolLock} aria-label="Keep the tool" onClick={() => setToolLock((x) => !x)}>
            {toolLock ? <LockSimple size={16} /> : <LockSimpleOpen size={16} />}
          </button>
        </Hint>
        <span className="draw-sep" />
        <Hint text="Type a map: one link per line" keys="d-map">
          <button className="draw-tool wide" aria-label="Type a map" onClick={() => setPanel("map")}>
            <TreeStructure size={16} /> Map
          </button>
        </Hint>
        <Hint text="Compare matrix" keys="d-matrix">
          <button className="draw-tool wide" aria-label="Compare matrix" onClick={insertMatrix}>
            <Table size={16} /> Matrix
          </button>
        </Hint>
      </div>

      {showStyle && (
        <div className="draw-style" aria-label="Style" onMouseDown={keepFocus}>
          <Row label="Stroke">
            {STROKES.map((c) => <Swatch key={c} colour={c} on={value("strokeColor") === c} onPick={() => setProp({ strokeColor: c })} />)}
          </Row>
          {(!selected.length ? isShapeTool(tool) : [...kinds].some((k) => k === "rectangle" || k === "ellipse" || k === "diamond")) && (
            <>
              <Row label="Fill">
                {FILLS.map((c) => <Swatch key={c} colour={c} on={value("backgroundColor") === c} onPick={() => setProp({ backgroundColor: c })} />)}
              </Row>
              {value("backgroundColor") !== "transparent" && (
                <Row label="Fill style">
                  <Seg on={value("fillStyle") === "solid"} onPick={() => setProp({ fillStyle: "solid" })} label="Solid"><span className="fill-solid" /></Seg>
                  <Seg on={value("fillStyle") !== "solid"} onPick={() => setProp({ fillStyle: "hachure" })} label="Dither"><span className="fill-dither" /></Seg>
                </Row>
              )}
            </>
          )}
          {!(kinds.size === 1 && kinds.has("text")) && tool !== "text" && (
            <>
              <Row label="Width">
                {[1, 2, 4].map((w) => (
                  <Seg key={w} on={value("strokeWidth") === w} onPick={() => setProp({ strokeWidth: w })} label={["Thin", "Bold", "Extra bold"][[1, 2, 4].indexOf(w)]!}>
                    <span className="stroke-w" style={{ height: w }} />
                  </Seg>
                ))}
              </Row>
              <Row label="Line">
                {(["solid", "dashed", "dotted"] as const).map((s) => (
                  <Seg key={s} on={value("strokeStyle") === s} onPick={() => setProp({ strokeStyle: s })} label={s[0]!.toUpperCase() + s.slice(1)}>
                    <span className={`stroke-s ${s}`} />
                  </Seg>
                ))}
              </Row>
              <Row label="Corners">
                <Seg on={!value("roundness")} onPick={() => setProp({ roundness: null })} label="Sharp"><span className="corner sharp" /></Seg>
                <Seg on={!!value("roundness")} onPick={() => setProp({ roundness: { type: 3 } })} label="Round"><span className="corner round" /></Seg>
              </Row>
            </>
          )}
          {(kinds.has("arrow") || tool === "arrow") && (
            <>
              <Row label="Ends">
                {arrowHeads.map((h) => (
                  <Seg key={String(h)} on={value("endArrowhead") === h} onPick={() => setProp({ endArrowhead: h })} label={h ? `End: ${h}` : "No end"}>
                    <Head kind={h} />
                  </Seg>
                ))}
              </Row>
              <Row label="Start">
                {arrowHeads.map((h) => (
                  <Seg key={String(h)} on={value("startArrowhead") === h} onPick={() => setProp({ startArrowhead: h })} label={h ? `Start: ${h}` : "No start"}>
                    <Head kind={h} flip />
                  </Seg>
                ))}
              </Row>
              <Row label="Route">
                <Seg on={!value("elbowed")} onPick={() => setProp({ elbowed: false })} label="Straight"><span className="route straight" /></Seg>
                <Seg on={!!value("elbowed")} onPick={() => setProp({ elbowed: true })} label="Elbow"><span className="route elbow" /></Seg>
              </Row>
            </>
          )}
          {(kinds.has("text") || tool === "text" || selected.some((e) => labelOf(els, e.id))) && (
            <>
              <Row label="Size">
                {FONT_SIZES.map((s, i) => (
                  <Seg key={s} on={(labelOf(els, current?.id ?? "")?.fontSize ?? value("fontSize")) === s} onPick={() => setProp({ fontSize: s })} label={["Small", "Medium", "Large", "Extra large"][i]!}>
                    {["S", "M", "L", "XL"][i]}
                  </Seg>
                ))}
              </Row>
              <Row label="Font">
                <Seg on={(labelOf(els, current?.id ?? "")?.fontFamily ?? value("fontFamily")) !== MONO} onPick={() => setProp({ fontFamily: SANS })} label="Sans">Aa</Seg>
                <Seg on={(labelOf(els, current?.id ?? "")?.fontFamily ?? value("fontFamily")) === MONO} onPick={() => setProp({ fontFamily: MONO })} label="Mono"><span className="mono">Aa</span></Seg>
              </Row>
            </>
          )}
          <Row label="Opacity">
            {[100, 60, 30].map((o) => (
              <Seg key={o} on={value("opacity") === o} onPick={() => setProp({ opacity: o })} label={`${o}%`}>{o}</Seg>
            ))}
          </Row>
        </div>
      )}

      <div className="draw-zoom" role="group" aria-label="Zoom and history" onMouseDown={keepFocus}>
        <Hint text="Undo" keys="undo"><button className="draw-tool" aria-label="Undo" onClick={undo} disabled={!hist.current.past.length}><ArrowCounterClockwise size={15} /></button></Hint>
        <Hint text="Redo" keys="redo"><button className="draw-tool" aria-label="Redo" onClick={redo} disabled={!hist.current.future.length}><ArrowClockwise size={15} /></button></Hint>
        <span className="draw-sep" />
        <Hint text="Zoom out" keys="d-zoom-out"><button className="draw-tool" aria-label="Zoom out" onClick={() => zoomTo(z / 1.25)}><Minus size={15} /></button></Hint>
        <Hint text="Zoom to 100%" keys="d-zoom-reset"><button className="draw-tool zoom-pct" aria-label="Zoom to 100%" onClick={() => zoomTo(1)}>{Math.round(z * 100)}%</button></Hint>
        <Hint text="Zoom in" keys="d-zoom-in"><button className="draw-tool" aria-label="Zoom in" onClick={() => zoomTo(z * 1.25)}><Plus size={15} /></button></Hint>
        <Hint text="Zoom to fit everything" keys="d-fit"><button className="draw-tool" aria-label="Zoom to fit" onClick={() => fit(boundsOf(els), 2)}><CornersOut size={15} /></button></Hint>
      </div>
      <div className="draw-help" onMouseDown={keepFocus}>
        <Hint text="All diagram commands" keys="d-commands" side="top">
          <button className="draw-tool wide" aria-label="All diagram commands" onClick={() => setPanel("commands")}>/</button>
        </Hint>
        <Hint text="Diagram shortcuts" keys="d-help" side="top">
          <button className="draw-tool" aria-label="Diagram shortcuts" onClick={() => setPanel("help")}><Question size={15} /></button>
        </Hint>
      </div>

      {empty && (
        <div className="draw-empty" aria-hidden="true">
          <p>Draw from memory: a box per idea, an arrow per link.</p>
          <p className="keys-line"><kbd>{hintKeys("d-map")}</kbd> type a map <kbd>{hintKeys("d-rectangle")}</kbd> box, then <kbd>Tab</kbd> for the next idea <kbd>{hintKeys("d-matrix")}</kbd> compare matrix</p>
        </div>
      )}
      <div className="sr-only" aria-live="polite">{selected.length ? `Selected: ${selected.map((e) => (labelOf(els, e.id)?.originalText ?? e.text ?? e.type)).join(", ")}` : ""}</div>
      <div className="sr-only" id="draw-summary">{summary}</div>

      {panel === "commands" && <Commands cmds={cmds} hint={hintKeys} onClose={() => { setPanel(null); root.current?.focus(); }} />}
      {panel === "map" && (
        <TypeMap
          onClose={() => { setPanel(null); root.current?.focus(); }}
          onAdd={(src) => {
            const r = addMap(live.current.els, src, live.current.style, viewCentre());
            if (!r.ids.length) return;
            apply(r.els, r.ids.filter((id) => r.els.find((e) => e.id === id && !isLinear(e))));
            fit(boundsOf(r.els), 1);
          }}
        />
      )}
      {panel === "url" && selected[0] && (
        <UrlPanel
          initial={selected[0].link ?? ""}
          onClose={() => { setPanel(null); root.current?.focus(); }}
          onSave={(v) => { setPanel(null); setLink(v); root.current?.focus(); }}
        />
      )}
      {/* A linked element shows a small ↗ at its corner; one click opens the link (Excalidraw, Freeform). */}
      {!moving && els.filter((e) => e.link && !isLabel(e)).map((e) => {
        const b = bounds(e);
        const left = (b.x + b.w - view.x) * z - 2;
        const top = (b.y - view.y) * z - 18;
        return (
          <Hint key={e.id} text={e.link!}>
            <button className="draw-link" style={{ left, top }} aria-label={`Open link ${e.link}`} onClick={() => onLink(e.link!)}>↗</button>
          </Hint>
        );
      })}
      {panel === "link" && selected[0] && (
        <LinkPicker
          els={els}
          from={selected[0]}
          onClose={() => { setPanel(null); root.current?.focus(); }}
          onPick={(t) => { setPanel(null); linkTo(t); }}
        />
      )}
      {panel === "find" && (
        <Find
          els={els}
          onClose={() => { setPanel(null); root.current?.focus(); }}
          onPick={(e) => {
            const target = e.containerId ? (map.get(e.containerId) ?? e) : e;
            setSel([target.id]);
            reveal(bounds(target));
          }}
        />
      )}
      {panel === "help" && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && (setPanel(null), root.current?.focus())}>
          <div className="panel keys" role="dialog" aria-modal="true" aria-label="Diagram shortcuts" onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape") { setPanel(null); root.current?.focus(); } }} tabIndex={-1} ref={(n) => n?.focus()}>
            <ShortcutEditor notify={notify} query="diagram" />
          </div>
        </div>
      )}
    </div>
  );
}

const isShapeTool = (t: Tool) => t === "rectangle" || t === "ellipse" || t === "diamond";
const keepFocus = (e: React.MouseEvent) => e.preventDefault();
const midOf = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const midOfPts = (pts: Pt[]) => {
  let best = pts[0]!;
  const total = pts.slice(1).reduce((s, p, i) => s + dist(p, pts[i]!), 0);
  let half = total / 2;
  for (let i = 1; i < pts.length; i++) {
    const l = dist(pts[i - 1]!, pts[i]!);
    if (half <= l) {
      const t = l ? half / l : 0;
      return [pts[i - 1]![0] + (pts[i]![0] - pts[i - 1]![0]) * t, pts[i - 1]![1] + (pts[i]![1] - pts[i - 1]![1]) * t] as Pt;
    }
    half -= l;
    best = pts[i]!;
  }
  return best;
};
const rectOf = (a: Pt, b: Pt): Box => ({ x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(a[0] - b[0]), h: Math.abs(a[1] - b[1]) });
const containsBox = (o: Box, b: Box) => b.x >= o.x && b.y >= o.y && b.x + b.w <= o.x + o.w && b.y + b.h <= o.y + o.h;
const angleSnap = (s: Pt, p: Pt): Pt => {
  const a = Math.round(Math.atan2(p[1] - s[1], p[0] - s[0]) / (Math.PI / 12)) * (Math.PI / 12);
  const d = dist(s, p);
  return [s[0] + d * Math.cos(a), s[1] + d * Math.sin(a)];
};
/** The cursor for a handle on a rotated box: the handle the rotation brings nearest. */
const ORDER: Handle[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
const rotHandle = (h: Handle, angle: number): Handle => ORDER[(ORDER.indexOf(h) + Math.round(angle / (Math.PI / 4)) + 8) % 8]!;

function Overlay({ selected, handles, z, hot, guides, marquee, moveBox, showPoints }: {
  selected: El[]; handles: ReturnType<typeof handlesOf>; z: number; hot?: El; guides: Guide[]; marquee: Box | null; moveBox: Box | null; showPoints: boolean;
}) {
  const sw = 1 / z;
  const hs = 8 / z;
  return (
    <g className="draw-overlay">
      {hot && <path d={`M${outlineOf(hot)} Z`} fill="none" stroke="var(--accent)" strokeWidth={3 / z} opacity={0.8} />}
      {selected.length > 1 && selected.map((e) => {
        const b = bounds(e);
        return <rect key={e.id} x={b.x - 2 / z} y={b.y - 2 / z} width={b.w + 4 / z} height={b.h + 4 / z} fill="none" stroke="var(--paper)" strokeWidth={sw} strokeDasharray={`${3 / z} ${3 / z}`} opacity={0.6} />;
      })}
      {handles && (() => {
        const { box, angle } = handles;
        const c: Pt = [box.x + box.w / 2, box.y + box.h / 2];
        const pad = 4 / z;
        return (
          <g transform={angle ? `rotate(${(angle * 180) / Math.PI} ${c[0]} ${c[1]})` : undefined}>
            <rect x={box.x - pad} y={box.y - pad} width={box.w + pad * 2} height={box.h + pad * 2} fill="none" stroke="var(--paper)" strokeWidth={sw} />
          </g>
        );
      })()}
      {handles?.at.map((h) =>
        h.h === "rotate" ? (
          <circle key={h.h} cx={h.p[0]} cy={h.p[1]} r={4 / z} fill="var(--bg)" stroke="var(--paper)" strokeWidth={sw * 1.5} />
        ) : (
          // Square pixel handles, the Terminal look's one flourish on the canvas.
          <rect key={h.h} x={h.p[0] - hs / 2} y={h.p[1] - hs / 2} width={hs} height={hs} fill="var(--bg)" stroke="var(--paper)" strokeWidth={sw * 1.5} transform={handles.angle ? `rotate(${(handles.angle * 180) / Math.PI} ${h.p[0]} ${h.p[1]})` : undefined} />
        ),
      )}
      {showPoints && selected[0] && (() => {
        const pts = absPoints(selected[0]);
        return (
          <>
            <path d={`M${pts.map((p) => p.join(" ")).join(" L")}`} fill="none" stroke="var(--paper)" strokeWidth={sw} strokeDasharray={`${2 / z} ${3 / z}`} opacity={0.5} />
            {!selected[0].elbowed && pts.slice(1).map((p, i) => {
              const m = midOf(pts[i]!, p);
              return <rect key={`m${i}`} x={m[0] - hs / 3} y={m[1] - hs / 3} width={(hs * 2) / 3} height={(hs * 2) / 3} fill="var(--paper)" opacity={0.45} />;
            })}
            {pts.map((p, i) => <rect key={i} x={p[0] - hs / 2} y={p[1] - hs / 2} width={hs} height={hs} fill="var(--bg)" stroke="var(--paper)" strokeWidth={sw * 1.5} />)}
          </>
        );
      })()}
      {moveBox && <rect x={moveBox.x} y={moveBox.y} width={moveBox.w} height={moveBox.h} fill="none" stroke="var(--paper)" strokeWidth={sw} strokeDasharray={`${3 / z} ${3 / z}`} opacity={0.5} />}
      {guides.map((gd, i) => (gd.axis === "x" ? <line key={i} x1={gd.at} x2={gd.at} y1={gd.from - 8 / z} y2={gd.to + 8 / z} stroke="var(--accent)" strokeWidth={sw} /> : <line key={i} y1={gd.at} y2={gd.at} x1={gd.from - 8 / z} x2={gd.to + 8 / z} stroke="var(--accent)" strokeWidth={sw} />))}
      {marquee && <rect x={marquee.x} y={marquee.y} width={marquee.w} height={marquee.h} fill="rgba(242, 241, 236, 0.06)" stroke="var(--paper)" strokeWidth={sw} strokeDasharray={`${4 / z} ${3 / z}`} />}
    </g>
  );
}

function outlineOf(e: El): string {
  if (isLinear(e)) return absPoints(e).map((p) => p.join(" ")).join(" L");
  const b = frame(e);
  const c: Pt = [b.x + b.w / 2, b.y + b.h / 2];
  const pts: Pt[] =
    e.type === "ellipse"
      ? Array.from({ length: 40 }, (_, i) => [c[0] + (b.w / 2 + 4) * Math.cos((i / 40) * Math.PI * 2), c[1] + (b.h / 2 + 4) * Math.sin((i / 40) * Math.PI * 2)] as Pt)
      : e.type === "diamond"
        ? [[c[0], b.y - 5], [b.x + b.w + 5, c[1]], [c[0], b.y + b.h + 5], [b.x - 5, c[1]]]
        : [[b.x - 4, b.y - 4], [b.x + b.w + 4, b.y - 4], [b.x + b.w + 4, b.y + b.h + 4], [b.x - 4, b.y + b.h + 4]];
  return pts.map((p) => rot(p, c, e.angle).join(" ")).join(" L");
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="draw-row" role="group" aria-label={label}>
      <span className="draw-label">{label}</span>
      <div className="draw-opts">{children}</div>
    </div>
  );
}

function Swatch({ colour, on, onPick }: { colour: string; on: boolean; onPick: () => void }) {
  const name = colour === "transparent" ? "None" : colour;
  return (
    <Hint text={name === "None" ? "No fill" : name}>
      <button className="draw-swatch" aria-pressed={on} aria-label={name} onClick={onPick} style={{ "--swatch": dark(colour) } as CSSProperties} data-none={colour === "transparent" || undefined} />
    </Hint>
  );
}

function Seg({ on, onPick, label, children }: { on: boolean; onPick: () => void; label: string; children: ReactNode }) {
  return (
    <Hint text={label}>
      <button className="draw-seg" aria-pressed={on} aria-label={label} onClick={onPick}>
        {children}
      </button>
    </Hint>
  );
}

function Head({ kind, flip: f }: { kind: string | null; flip?: boolean }) {
  return (
    <svg width="22" height="12" viewBox="0 0 22 12" aria-hidden="true" style={f ? { transform: "scaleX(-1)" } : undefined}>
      <line x1="2" y1="6" x2={kind ? 17 : 20} y2="6" stroke="currentColor" strokeWidth="1.5" />
      {kind === "arrow" && <path d="M14 2 L19 6 L14 10" fill="none" stroke="currentColor" strokeWidth="1.5" />}
      {kind === "triangle" && <path d="M14 2 L20 6 L14 10 Z" fill="currentColor" />}
      {kind === "dot" && <circle cx="18" cy="6" r="2.6" fill="currentColor" />}
      {kind === "bar" && <line x1="19" y1="1.5" x2="19" y2="10.5" stroke="currentColor" strokeWidth="1.5" />}
    </svg>
  );
}

function Commands({ cmds, hint, onClose }: { cmds: { id: string; label: string; key?: KeyId; run: () => void; when?: () => boolean; group: string }[]; hint: (k: KeyId) => string; onClose: () => void }) {
  const shown = cmds.filter((c) => !c.when || c.when());
  const groups = [...new Set(shown.map((c) => c.group))];
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Diagram commands" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <Command className="panel" loop onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape") { e.preventDefault(); onClose(); } }}>
        <Command.Input autoFocus className="panel-input" placeholder="Diagram commands" />
        <Command.List>
          <Command.Empty>No matches</Command.Empty>
          {groups.map((gname) => (
            <Command.Group key={gname} heading={gname}>
              {shown.filter((c) => c.group === gname).map((c) => (
                <Command.Item key={c.id} value={`${c.label} ${c.group}`} onSelect={() => { onClose(); c.run(); }}>
                  {c.label}
                  {c.key && <kbd>{hint(c.key)}</kbd>}
                </Command.Item>
              ))}
            </Command.Group>
          ))}
        </Command.List>
      </Command>
    </div>
  );
}

/** M: a concept map as text, one link per line, or an indented outline (D103). */
// What he typed into M and closed without adding (Esc, a click outside): back when M opens again.
let mapDraft = "";
function TypeMap({ onAdd, onClose }: { onAdd: (src: string) => void; onClose: () => void }) {
  const [src, setSrc] = useState(mapDraft);
  const go = () => {
    if (src.trim()) onAdd(src);
    mapDraft = "";
    onClose();
  };
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Type a map" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel draw-map" onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape") { e.preventDefault(); onClose(); } if (e.key === "Enter" && e.metaKey) { e.preventDefault(); go(); } }}>
        <textarea
          autoFocus
          className="draw-map-input"
          value={src}
          onChange={(e) => setSrc((mapDraft = e.target.value))}
          aria-label="Links, one per line"
          placeholder={"Spaced practice -strengthens-> Long-term memory\nLong-term memory -supports-> Transfer\nRetrieval\n  Free recall\n  Concept map"}
        />
        <div className="panel-foot">
          <span>One link per line: <code>A -label-&gt; B</code>, or indent to nest; <code>(A)</code> ellipse, <code>{"{A}"}</code> diamond</span>
          <span className="right">
            <span><kbd>⌘↵</kbd> Add to diagram</span>
            <span><kbd>Esc</kbd> Close</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function Find({ els, onPick, onClose }: { els: El[]; onPick: (e: El) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const hits = q.trim() ? els.filter((e) => e.type === "text" && (e.originalText ?? e.text ?? "").toLowerCase().includes(q.trim().toLowerCase())) : [];
  const go = (n: number) => {
    if (!hits.length) return;
    const k = ((n % hits.length) + hits.length) % hits.length;
    setI(k);
    onPick(hits[k]!);
  };
  return (
    <div className="find draw-find" role="search" onKeyDown={(e) => {
      e.stopPropagation();
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      if (e.key === "Enter") { e.preventDefault(); go(e.shiftKey ? i - 1 : i + 1); }
    }}>
      <input autoFocus className="field" value={q} onChange={(e) => { setQ(e.target.value); setI(-1); }} placeholder="Find in diagram" aria-label="Find in diagram" spellCheck={false} />
      <span className="find-count">{q.trim() ? (hits.length ? `${Math.max(0, i) + 1}/${hits.length}` : "Not found") : ""}</span>
    </div>
  );
}

/** ⇧L: the nodes already drawn, by name (cmdk), to link the selected one to. */
function LinkPicker({ els, from, onPick, onClose }: { els: El[]; from: El; onPick: (e: El) => void; onClose: () => void }) {
  const named = els.filter((e) => isShape(e) && e.id !== from.id).map((e) => ({ e, name: (labelOf(els, e.id)?.originalText ?? "").trim() })).filter((x) => x.name);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Link to a node" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <Command className="panel" loop onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape") { e.preventDefault(); onClose(); } }}>
        <Command.Input autoFocus className="panel-input" placeholder="Link to…" />
        <Command.List>
          <Command.Empty>No node by that name. Esc, then Tab makes a new one.</Command.Empty>
          {named.map(({ e, name }) => (
            <Command.Item key={e.id} value={`${name} ${e.id}`} onSelect={() => onPick(e)}>
              {name}
            </Command.Item>
          ))}
        </Command.List>
      </Command>
    </div>
  );
}

/** Link on an element: a web address, or an Ore link copied from a source or skill. */
function UrlPanel({ initial, onSave, onClose }: { initial: string; onSave: (v: string) => void; onClose: () => void }) {
  const [v, setV] = useState(initial);
  const ok = !v.trim() || /^(https?:\/\/\S+|ore:(item|skill)\/\S+)$/i.test(v.trim());
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Link" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel" onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") { e.preventDefault(); onClose(); }
        if (e.key === "Enter" && ok) { e.preventDefault(); onSave(v); }
      }}>
        <input autoFocus className="panel-input" value={v} onChange={(e) => setV(e.target.value)} placeholder="https://… or an ore: link" aria-label="Link" spellCheck={false} />
        <div className="panel-foot">
          {!ok && <span className="err">A link starts with https:// or ore:</span>}
          <span className="right">
            <span><kbd>↵</kbd> {v.trim() ? "Save" : "Remove link"}</span>
            <span><kbd>Esc</kbd> Close</span>
          </span>
        </div>
      </div>
    </div>
  );
}
