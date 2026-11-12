// The diagram editor's scene (D103): elements in Excalidraw's open JSON format, so every diagram drawn
// before keeps opening, an agent that knows the format can write one, and a file still opens on
// excalidraw.com. Pure functions only: geometry, hit tests, arrow binding, snapping and the edits the
// editor makes. Editor.tsx holds the pointer and keyboard state; render.tsx draws.

export type Pt = [number, number];
export type Box = { x: number; y: number; w: number; h: number };
/** `fixedPoint` pins the end to a spot on the shape (0–1 of its box), as Excalidraw's elbow arrows do;
 *  a tree's links use it to leave from the side the children grow on. */
export type Binding = { elementId: string; focus: number; gap: number; fixedPoint?: [number, number] | null };
export type Shape = "rectangle" | "ellipse" | "diamond";
export type Linear = "arrow" | "line";
export type Tool = "select" | "hand" | Shape | Linear | "freedraw" | "text" | "eraser";

export interface El {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: string;
  strokeWidth: number;
  strokeStyle: string;
  roughness: number;
  opacity: number;
  groupIds: string[];
  roundness: { type: number; value?: number } | null;
  boundElements: { id: string; type: "text" | "arrow" }[] | null;
  locked: boolean;
  isDeleted?: boolean;
  link?: string | null;
  text?: string;
  originalText?: string;
  fontSize?: number;
  fontFamily?: number;
  textAlign?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  containerId?: string | null;
  lineHeight?: number;
  autoResize?: boolean;
  points?: Pt[];
  pressures?: number[];
  startBinding?: Binding | null;
  endBinding?: Binding | null;
  startArrowhead?: string | null;
  endArrowhead?: string | null;
  elbowed?: boolean;
  fileId?: string | null;
  customData?: Record<string, unknown>;
  [k: string]: unknown;
}

export type Scene = { type: "excalidraw"; elements: unknown[]; [k: string]: unknown };
export type Style = Pick<El, "strokeColor" | "backgroundColor" | "fillStyle" | "strokeWidth" | "strokeStyle" | "roundness" | "opacity"> & {
  fontSize: number;
  fontFamily: number;
  textAlign: "left" | "center" | "right";
  startArrowhead: string | null;
  endArrowhead: string | null;
  elbowed: boolean;
};

// Excalidraw's light palette, so a file looks the same there; render.tsx maps it to the dark page.
export const STROKES = ["#1e1e1e", "#e03131", "#2f9e44", "#1971c2", "#f08c00"];
export const FILLS = ["transparent", "#ffc9c9", "#b2f2bb", "#a5d8ff", "#ffec99"];
export const FONT_SIZES = [16, 20, 28, 36];
export const SANS = 2;
export const MONO = 3;
export const GRID = 20;
const PAD = 5; // Excalidraw's padding around a shape's label
export const GAP = 6; // between a bound arrow's tip and the shape
const NODE: [number, number] = [160, 64];
const SPACE = 110; // between a node and the next one made from the keyboard

export const DEFAULT_STYLE: Style = {
  strokeColor: STROKES[0]!,
  backgroundColor: "transparent",
  fillStyle: "solid",
  strokeWidth: 2,
  strokeStyle: "solid",
  roundness: null,
  opacity: 100,
  fontSize: 20,
  fontFamily: SANS,
  textAlign: "center",
  startArrowhead: null,
  endArrowhead: "arrow",
  elbowed: false,
};

export const uid = () => {
  const a = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < 20; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
};

export const isShape = (e: El) => e.type === "rectangle" || e.type === "ellipse" || e.type === "diamond" || e.type === "image";
export const isLinear = (e: El) => e.type === "arrow" || e.type === "line";
export const isLabel = (e: El) => e.type === "text" && !!e.containerId;
/** What a click picks: a shape's or arrow's label stands for its container. */
export const isNode = (e: El) => isShape(e) || (e.type === "text" && !e.containerId);

// ---------- Text measuring ----------

type Measure = (line: string, fontSize: number, family: number) => number;
let measureLine: Measure = (line, size) => line.length * size * 0.55;
/** The editor installs a canvas measurer; tests keep the estimate. */
export const setMeasure = (m: Measure) => void (measureLine = m);
export const lineHeightOf = (e: Pick<El, "lineHeight">) => e.lineHeight ?? 1.25;

export function measureText(text: string, fontSize: number, family: number, lineHeight = 1.25): { width: number; height: number } {
  const lines = text.split("\n");
  return { width: Math.ceil(Math.max(1, ...lines.map((l) => measureLine(l, fontSize, family)))), height: Math.ceil(lines.length * fontSize * lineHeight) };
}

/** Wraps text to a width, breaking at spaces, and inside a word only when the word alone is too wide. */
export function wrap(text: string, width: number, fontSize: number, family: number): string {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/(\s+)/)) {
      const next = line + word;
      if (!line || measureLine(next.trimEnd(), fontSize, family) <= width) {
        line = next;
        continue;
      }
      out.push(line.trimEnd());
      line = word.trimStart();
      while (line.length > 1 && measureLine(line, fontSize, family) > width) {
        let cut = line.length - 1;
        while (cut > 1 && measureLine(line.slice(0, cut), fontSize, family) > width) cut--;
        out.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    out.push(line.trimEnd());
  }
  return out.join("\n");
}

/** The width a label may use inside its container. */
export function labelWidth(c: El): number {
  if (c.type === "ellipse") return Math.max(20, c.width / Math.SQRT2 - PAD * 2);
  if (c.type === "diamond") return Math.max(20, c.width / 2 - PAD * 2);
  if (isLinear(c)) return 240;
  return Math.max(20, c.width - PAD * 4);
}

// ---------- Geometry ----------

export const rot = ([x, y]: Pt, [cx, cy]: Pt, a: number): Pt => {
  if (!a) return [x, y];
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c];
};

/** A linear element's points in scene coordinates. */
export const absPoints = (e: El): Pt[] => {
  const c = centre(e);
  return (e.points ?? [[0, 0]]).map(([px, py]) => rot([e.x + px, e.y + py], c, e.angle));
};

function pointsBox(pts: Pt[]): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** The unrotated frame of an element: x, y, width, height for shapes; the points' box for lines. */
export function frame(e: El): Box {
  if (e.points && (isLinear(e) || e.type === "freedraw")) {
    const b = pointsBox(e.points);
    return { x: e.x + b.x, y: e.y + b.y, w: b.w, h: b.h };
  }
  return { x: e.x, y: e.y, w: e.width, h: e.height };
}

export const centre = (e: El): Pt => {
  const f = frame(e);
  return [f.x + f.w / 2, f.y + f.h / 2];
};

const corners = (b: Box): Pt[] => [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]];

/** The axis-aligned box an element covers, rotation included. */
export function bounds(e: El): Box {
  const f = frame(e);
  if (!e.angle) return f;
  const c: Pt = [f.x + f.w / 2, f.y + f.h / 2];
  return pointsBox(corners(f).map((p) => rot(p, c, e.angle)));
}

export function union(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  return pointsBox(boxes.flatMap(corners));
}

export const boundsOf = (els: readonly El[]) => union(els.map(bounds));
export const inside = (b: Box, [x, y]: Pt) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
export const contains = (outer: Box, b: Box) => b.x >= outer.x && b.y >= outer.y && b.x + b.w <= outer.x + outer.w && b.y + b.h <= outer.y + outer.h;
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function segDist([px, py]: Pt, [ax, ay]: Pt, [bx, by]: Pt): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

function polyDist(p: Pt, pts: Pt[]): number {
  if (pts.length === 1) return Math.hypot(p[0] - pts[0]![0], p[1] - pts[0]![1]);
  let d = Infinity;
  for (let i = 1; i < pts.length; i++) d = Math.min(d, segDist(p, pts[i - 1]!, pts[i]!));
  return d;
}

/** A shape's outline as a closed polygon in scene coordinates (ellipses as 48 sides). */
export function outline(e: El): Pt[] {
  const f = frame(e);
  const c: Pt = [f.x + f.w / 2, f.y + f.h / 2];
  let pts: Pt[];
  if (e.type === "ellipse") pts = Array.from({ length: 48 }, (_, i) => [c[0] + (f.w / 2) * Math.cos((i / 48) * Math.PI * 2), c[1] + (f.h / 2) * Math.sin((i / 48) * Math.PI * 2)] as Pt);
  else if (e.type === "diamond") pts = [[c[0], f.y], [f.x + f.w, c[1]], [c[0], f.y + f.h], [f.x, c[1]]];
  else pts = corners(f);
  return pts.map((p) => rot(p, c, e.angle));
}

function inPolygon([x, y]: Pt, poly: Pt[]): boolean {
  let on = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) on = !on;
  }
  return on;
}

/** Whether a scene point touches an element. Closed shapes count their inside, filled or not, so a
 *  hollow box picks with one click anywhere in it (tldraw, Freeform); `tol` is in scene units. */
function hits(e: El, p: Pt, tol: number): boolean {
  if (isShape(e)) {
    const poly = outline(e);
    return inPolygon(p, poly) || polyDist(p, [...poly, poly[0]!]) <= tol;
  }
  if (e.type === "text") {
    const c = centre(e);
    return inside(frame(e), rot(p, c, -e.angle));
  }
  if (isLinear(e) || e.type === "freedraw") return polyDist(p, absPoints(e)) <= tol + e.strokeWidth;
  return inside(bounds(e), p);
}

/** Where the segment from `from` towards the shape's centre first crosses its outline. */
export function edgePoint(e: El, from: Pt): Pt {
  const c = centre(e);
  const poly = outline(e);
  let best: Pt = c;
  let bestT = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const r: Pt = [c[0] - from[0], c[1] - from[1]];
    const s: Pt = [b[0] - a[0], b[1] - a[1]];
    const den = r[0] * s[1] - r[1] * s[0];
    if (!den) continue;
    const t = ((a[0] - from[0]) * s[1] - (a[1] - from[1]) * s[0]) / den;
    const u = ((a[0] - from[0]) * r[1] - (a[1] - from[1]) * r[0]) / den;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1 && t < bestT) {
      bestT = t;
      best = [from[0] + t * r[0], from[1] + t * r[1]];
    }
  }
  return best;
}

const toward = (p: Pt, q: Pt, d: number): Pt => {
  const l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
  return [p[0] + ((q[0] - p[0]) / l) * d, p[1] + ((q[1] - p[1]) / l) * d];
};

/** The middle of a polyline by length, where its label sits. */
function midpoint(pts: Pt[]): Pt {
  if (pts.length < 2) return pts[0] ?? [0, 0];
  const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1]));
  let half = lens.reduce((a, b) => a + b, 0) / 2;
  for (let i = 0; i < lens.length; i++) {
    if (half <= lens[i]! || i === lens.length - 1) {
      const t = lens[i] ? Math.min(1, half / lens[i]!) : 0;
      const a = pts[i]!;
      const b = pts[i + 1]!;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    half -= lens[i]!;
  }
  return pts[0]!;
}

// ---------- Scene helpers ----------

export type Els = readonly El[];
export const byId = (els: Els) => new Map(els.map((e) => [e.id, e]));

/** Reads a saved scene: drops deleted elements, fills fields older files left out. */
export function fromScene(scene: Scene | null): El[] {
  const raw = (scene?.elements ?? []) as Partial<El>[];
  return raw
    .filter((e): e is Partial<El> & { id: string; type: string } => !!e && typeof e.id === "string" && typeof e.type === "string" && !e.isDeleted)
    .map((e) => ({
      x: 0, y: 0, width: 0, height: 0, angle: 0, strokeColor: STROKES[0]!, backgroundColor: "transparent", fillStyle: "solid", strokeWidth: 2,
      strokeStyle: "solid", roughness: 0, opacity: 100, groupIds: [], roundness: null, boundElements: null, locked: false, ...e,
      // Written without it when it equals the text (compact), as Excalidraw reads it; the editor edits originalText.
      ...(e.type === "text" && e.originalText == null ? { originalText: e.text ?? "" } : {}),
    }));
}

/** The scene to save: elements plus whatever else the file held (files, appState), with each
 *  element's bound text placed and its `boundElements` recomputed, so Excalidraw reads it as drawn. */
export function toScene(els: Els, prev: Scene | null): Scene {
  const synced = syncAll(els);
  const bound = new Map<string, { id: string; type: "text" | "arrow" }[]>();
  const add = (on: string | null | undefined, id: string, type: "text" | "arrow") => on && bound.set(on, [...(bound.get(on) ?? []), { id, type }]);
  for (const e of synced) {
    if (e.type === "text") add(e.containerId, e.id, "text");
    if (e.type === "arrow") {
      add(e.startBinding?.elementId, e.id, "arrow");
      if (e.endBinding?.elementId !== e.startBinding?.elementId) add(e.endBinding?.elementId, e.id, "arrow");
    }
  }
  const files = prev?.files && typeof prev.files === "object" ? (prev.files as Record<string, unknown>) : {};
  const used = new Set(synced.map((e) => e.fileId).filter(Boolean));
  return {
    ...(prev ?? {}),
    type: "excalidraw",
    version: 2,
    source: "ore",
    elements: synced.map((e) => compact({ ...e, boundElements: bound.get(e.id) ?? null })),
    appState: { ...((prev?.appState as object) ?? {}), viewBackgroundColor: "#ffffff" },
    files: Object.fromEntries(Object.entries(files).filter(([k]) => used.has(k))),
  };
}

// Values Excalidraw fills in when a field is missing, so a saved element can leave them out. Roughness
// is kept: Excalidraw's own default is hand-drawn, ours is a crisp line.
const DEFAULTS: Record<string, unknown> = {
  angle: 0, strokeColor: "#1e1e1e", backgroundColor: "transparent", fillStyle: "solid", strokeWidth: 2, strokeStyle: "solid",
  opacity: 100, groupIds: [], frameId: null, roundness: null, boundElements: null, link: null, locked: false, isDeleted: false,
  version: undefined, versionNonce: undefined, updated: undefined, seed: undefined, index: undefined, lastCommittedPoint: null,
  startBinding: null, endBinding: null, startArrowhead: null, containerId: null, autoResize: true,
  lineHeight: 1.25, verticalAlign: "top", elbowed: false, pressures: [], simulatePressure: true,
};
const round = (v: number) => Math.round(v * 100) / 100;

/** An element as written to the file: defaults left out, coordinates to 0.01, about 150 bytes per box. */
function compact(e: El): El {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(e)) {
    if (v === undefined) continue;
    // A label's place is always written: Excalidraw reads a missing one as the top, Ore as the middle.
    if (k === "verticalAlign" && e.containerId) { out[k] = v; continue; }
    if (k in DEFAULTS && (DEFAULTS[k] === undefined || JSON.stringify(DEFAULTS[k]) === JSON.stringify(v))) continue;
    if (k === "originalText" && v === e.text) continue; // Excalidraw copies text into it when missing
    out[k] = typeof v === "number" ? round(v) : k === "points" ? (v as Pt[]).map(([x, y]) => [round(x), round(y)]) : v;
  }
  return out as El;
}

export const labelOf = (els: Els, id: string) => els.find((e) => e.type === "text" && e.containerId === id);

/** Places a container's label at its centre (an arrow's at its midpoint, a box's at its top when set so) and grows the container to fit. */
export function syncAll(els: Els): El[] {
  const map = byId(els);
  const out = els.map((e) => e);
  const at = new Map(out.map((e, i) => [e.id, i]));
  for (let i = 0; i < out.length; i++) {
    const t = out[i]!;
    if (t.type !== "text" || !t.containerId) continue;
    const c = map.get(t.containerId);
    if (!c) {
      out[i] = { ...t, containerId: null };
      continue;
    }
    const size = t.fontSize ?? 20;
    const fam = t.fontFamily ?? SANS;
    const text = wrap(t.originalText ?? t.text ?? "", labelWidth(c), size, fam);
    const m = measureText(text, size, fam, lineHeightOf(t));
    let container = c;
    if (isShape(c)) {
      const need = c.type === "rectangle" ? m.height + PAD * 4 : c.type === "ellipse" ? m.height * Math.SQRT2 + PAD * 4 : m.height * 2 + PAD * 4;
      if (need > c.height + 0.5) {
        // grows from its centre, so a label that wraps doesn't push the node down into the next one
        const h = Math.ceil(need);
        container = { ...c, y: Math.round(c.y - (h - c.height) / 2), height: h };
        out[at.get(c.id)!] = container;
        map.set(c.id, container);
      }
    }
    const [cx, cy] = isLinear(container) ? midpoint(absPoints(container)) : centre(container);
    // A box's label set to the top (a section's title, Excalidraw's vertical align) sits under its top edge.
    const top = container.type === "rectangle" && t.verticalAlign === "top" ? container.y + PAD * 2 : null;
    // Left or right in a box (Excalidraw's text align); arrows and the round shapes keep it centred.
    const side = container.type === "rectangle" ? t.textAlign : "center";
    const x = side === "left" ? container.x + PAD * 2 : side === "right" ? container.x + container.width - PAD * 2 - m.width : cx - m.width / 2;
    out[i] = { ...t, text, x, y: top ?? cy - m.height / 2, width: m.width, height: m.height, angle: isLinear(container) ? 0 : container.angle };
  }
  return out;
}

// ---------- Arrow binding ----------

/** The shape an arrow end would bind to at `p`: the topmost shape under it or within `near` of its edge. */
export function bindTarget(els: Els, p: Pt, near: number, skip: Set<string> = new Set()): El | null {
  for (let i = els.length - 1; i >= 0; i--) {
    const e = els[i]!;
    if (!isShape(e) || skip.has(e.id) || e.locked) continue;
    if (hits(e, p, near)) return e;
  }
  return null;
}

/** Recomputes a bound arrow's ends so each touches its shape's edge on the line toward its neighbour
 *  point; elbow arrows route as two right angles between the facing sides. */
export function route(a: El, map: Map<string, El>): El {
  const pts = absPoints({ ...a, angle: 0 });
  if (pts.length < 2) return a;
  const s = a.startBinding ? map.get(a.startBinding.elementId) : undefined;
  const t = a.endBinding ? map.get(a.endBinding.elementId) : undefined;
  if (!s && !t) return a;
  let next: Pt[];
  if (a.elbowed) {
    const from = s ? centre(s) : pts[0]!;
    const to = t ? centre(t) : pts[pts.length - 1]!;
    next = elbow(from, to, s ? bounds(s) : null, t ? bounds(t) : null, elbowMid(a));
  } else {
    next = pts.map((p) => [...p] as Pt);
    const n = next.length;
    const pin = (e: El | undefined, b: Binding | null | undefined): Pt | null => {
      if (!e || !b?.fixedPoint || e.angle) return null;
      const f = bounds(e);
      return [f.x + f.w * b.fixedPoint[0], f.y + f.h * b.fixedPoint[1]];
    };
    const ps = pin(s, a.startBinding);
    const pt = pin(t, a.endBinding);
    if (n === 2 && s && t && (ps || pt)) {
      const from = ps ?? edgePoint(s, pt!);
      const to = pt ?? edgePoint(t, ps!);
      return withPoints(a, [toward(from, to, GAP), toward(to, from, GAP)]);
    }
    if (s) {
      const ref = n > 2 ? next[1]! : t ? centre(t) : next[n - 1]!;
      next[0] = toward(edgePoint(s, ref), ref, GAP);
    }
    if (t) {
      const ref = n > 2 ? next[n - 2]! : s ? centre(s) : next[0]!;
      next[n - 1] = toward(edgePoint(t, ref), ref, GAP);
    }
  }
  return withPoints(a, next);
}

/** Where he dragged an elbow arrow's middle segment to (its x when the arrow runs across, y when down). */
export const elbowMid = (a: El): number | undefined => {
  const m = (a.customData?.oreElbow as { mid?: unknown } | undefined)?.mid;
  return typeof m === "number" ? m : undefined;
};

function elbow(from: Pt, to: Pt, sb: Box | null, tb: Box | null, mid?: number): Pt[] {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  if (Math.abs(dx) >= Math.abs(dy)) {
    const sx = sb ? (dx > 0 ? sb.x + sb.w : sb.x) + Math.sign(dx) * GAP : from[0];
    const tx = tb ? (dx > 0 ? tb.x : tb.x + tb.w) - Math.sign(dx) * GAP : to[0];
    const mx = mid ?? (sx + tx) / 2;
    return [[sx, from[1]], [mx, from[1]], [mx, to[1]], [tx, to[1]]];
  }
  const sy = sb ? (dy > 0 ? sb.y + sb.h : sb.y) + Math.sign(dy) * GAP : from[1];
  const ty = tb ? (dy > 0 ? tb.y : tb.y + tb.h) - Math.sign(dy) * GAP : to[1];
  const my = mid ?? (sy + ty) / 2;
  return [[from[0], sy], [from[0], my], [to[0], my], [to[0], ty]];
}

/** Sets a linear element's absolute points: x, y become the first point, as Excalidraw stores them. */
export function withPoints(e: El, abs: Pt[]): El {
  const [x0, y0] = abs[0]!;
  const points = abs.map(([x, y]) => [x - x0, y - y0] as Pt);
  const b = pointsBox(points);
  return { ...e, x: x0, y: y0, angle: 0, points, width: b.w, height: b.h };
}

/** Re-routes every arrow bound to one of `moved`. */
export function reroute(els: Els, moved: Set<string>): El[] {
  const map = byId(els);
  let any = false;
  const out = els.map((e) => {
    if (e.type !== "arrow" || !((e.startBinding && moved.has(e.startBinding.elementId)) || (e.endBinding && moved.has(e.endBinding.elementId)))) return e;
    any = true;
    return route(e, map);
  });
  // An arrow that re-routed carries its label to its new midpoint.
  return any ? syncAll(out) : out;
}

// ---------- Selection, groups ----------

/** The outermost group an element belongs to, unless the editor has entered that group. */
const outerGroup = (e: El, entered: string | null) => {
  const gs = e.groupIds;
  if (!gs.length) return null;
  const i = entered ? gs.indexOf(entered) : -1;
  return i > 0 ? gs[i - 1]! : i === 0 ? null : gs[gs.length - 1]!;
};

/** What clicking `e` selects: its whole group, a label's container, or itself. */
export function pickSet(els: Els, e: El, entered: string | null): string[] {
  const target = isLabel(e) ? (els.find((x) => x.id === e.containerId) ?? e) : e;
  const g = outerGroup(target, entered);
  return g ? els.filter((x) => x.groupIds.includes(g) && !isLabel(x)).map((x) => x.id) : [target.id];
}

/** Topmost element under a point, labels standing for their containers. Smaller shapes win over the
 *  hollow inside of a bigger one that holds them. */
export function topAt(els: Els, p: Pt, tol: number, withLocked = false): El | null {
  let best: El | null = null;
  let bestArea = Infinity;
  for (let i = els.length - 1; i >= 0; i--) {
    const e = els[i]!;
    if ((e.locked && !withLocked) || !hits(e, p, tol)) continue;
    const stroke = isLinear(e) || e.type === "freedraw" || e.type === "text";
    if (stroke) return e;
    const filled = e.backgroundColor !== "transparent" || e.type === "image";
    const area = e.width * e.height;
    const poly = outline(e);
    if (filled || polyDist(p, [...poly, poly[0]!]) <= tol) return !best || area < bestArea ? e : best;
    if (area < bestArea) {
      best = e;
      bestArea = area;
    }
  }
  return best;
}

/** Expands a selection with the labels of the selected containers. */
export function withLabels(els: Els, ids: Iterable<string>): Set<string> {
  const s = new Set(ids);
  for (const e of els) if (e.type === "text" && e.containerId && s.has(e.containerId)) s.add(e.id);
  return s;
}

// ---------- Edits ----------

function translate(e: El, dx: number, dy: number): El {
  return { ...e, x: e.x + dx, y: e.y + dy };
}

/** Moves the selected elements (and their labels), unbinding arrow ends that leave their shape behind. */
export function move(els: Els, ids: Set<string>, dx: number, dy: number): El[] {
  const all = withLabels(els, ids);
  let out = els.map((e) => (all.has(e.id) ? translate(e, dx, dy) : e));
  out = out.map((e) => {
    if (e.type !== "arrow" || !all.has(e.id)) return e;
    const keepS = !e.startBinding || all.has(e.startBinding.elementId);
    const keepE = !e.endBinding || all.has(e.endBinding.elementId);
    return keepS && keepE ? e : { ...e, startBinding: keepS ? e.startBinding : null, endBinding: keepE ? e.endBinding : null };
  });
  return reroute(out, all);
}

/** Deletes elements with their labels, and every arrow that loses an end with them (Whimsical, Miro:
 *  a link to a node that is gone says nothing; Tyler, 2026-11-06). */
export function remove(els: Els, ids: Set<string>): El[] {
  const all = withLabels(els, ids);
  const gone = new Set(all);
  for (const e of els) if (e.type === "arrow" && ((e.startBinding && all.has(e.startBinding.elementId)) || (e.endBinding && all.has(e.endBinding.elementId)))) gone.add(e.id);
  return els.filter((e) => !gone.has(e.id) && !(e.containerId && gone.has(e.containerId)));
}

/** Copies of elements with new ids, offset; bindings and groups between copies are kept. */
export function clone(src: Els, dx: number, dy: number): El[] {
  const ids = new Map(src.map((e) => [e.id, uid()]));
  const groups = new Map<string, string>();
  const g = (id: string) => groups.get(id) ?? (groups.set(id, uid()), groups.get(id)!);
  const bind = (b: Binding | null | undefined) => (b && ids.has(b.elementId) ? { ...b, elementId: ids.get(b.elementId)! } : null);
  return src.map((e) => ({
    ...translate(e, dx, dy),
    id: ids.get(e.id)!,
    groupIds: e.groupIds.map(g),
    containerId: e.containerId ? (ids.get(e.containerId) ?? null) : e.containerId,
    ...(isLinear(e) ? { startBinding: bind(e.startBinding), endBinding: bind(e.endBinding) } : {}),
    boundElements: null,
  }));
}

/** Duplicates the selection beside itself; returns the scene and the copies' ids. */
export function duplicate(els: Els, ids: Set<string>, dx = 20, dy = 20): { els: El[]; ids: string[] } {
  const all = withLabels(els, ids);
  const copies = clone(els.filter((e) => all.has(e.id)), dx, dy);
  return { els: [...els, ...copies], ids: copies.filter((e) => !isLabel(e)).map((e) => e.id) };
}

export function group(els: Els, ids: Set<string>): El[] {
  const gid = uid();
  const all = withLabels(els, ids);
  return els.map((e) => (all.has(e.id) ? { ...e, groupIds: [...e.groupIds, gid] } : e));
}

export function ungroup(els: Els, ids: Set<string>): El[] {
  const all = withLabels(els, ids);
  return els.map((e) => (all.has(e.id) && e.groupIds.length ? { ...e, groupIds: e.groupIds.slice(0, -1) } : e));
}

/** Layer order: "forward" and "backward" step past the next element they overlap, "front" and "back" go all the way. */
export function reorder(els: Els, ids: Set<string>, how: "front" | "back" | "forward" | "backward"): El[] {
  const all = withLabels(els, ids);
  const picked = els.filter((e) => all.has(e.id));
  const rest = els.filter((e) => !all.has(e.id));
  if (how === "front") return [...rest, ...picked];
  if (how === "back") return [...picked, ...rest];
  const b = boundsOf(picked);
  const idx = els.findIndex((e) => all.has(e.id));
  const last = els.length - 1 - [...els].reverse().findIndex((e) => all.has(e.id));
  if (how === "forward") {
    let j = last + 1;
    while (j < els.length && !(b && overlaps(bounds(els[j]!), b))) j++;
    if (j >= els.length) return [...rest, ...picked];
    const target = els[j]!;
    const at = rest.indexOf(target) + 1;
    return [...rest.slice(0, at), ...picked, ...rest.slice(at)];
  }
  let j = idx - 1;
  while (j >= 0 && !(b && overlaps(bounds(els[j]!), b))) j--;
  if (j < 0) return [...picked, ...rest];
  const at = rest.indexOf(els[j]!);
  return [...rest.slice(0, at), ...picked, ...rest.slice(at)];
}

export type Align = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom";

/** Aligns each selected unit (a group counts as one) to the selection's edge or centre. */
export function align(els: Els, units: string[][], how: Align): El[] {
  const map = byId(els);
  const boxes = units.map((u) => boundsOf(u.map((id) => map.get(id)!).filter(Boolean))!);
  const all = union(boxes);
  if (!all || units.length < 2) return [...els];
  let out = [...els];
  units.forEach((u, i) => {
    const b = boxes[i]!;
    const dx = how === "left" ? all.x - b.x : how === "right" ? all.x + all.w - b.x - b.w : how === "hcenter" ? all.x + all.w / 2 - b.x - b.w / 2 : 0;
    const dy = how === "top" ? all.y - b.y : how === "bottom" ? all.y + all.h - b.y - b.h : how === "vcenter" ? all.y + all.h / 2 - b.y - b.h / 2 : 0;
    if (dx || dy) out = move(out, new Set(u), dx, dy);
  });
  return out;
}

/** Spreads three or more units so the gaps between them are equal. */
export function distribute(els: Els, units: string[][], axis: "x" | "y"): El[] {
  if (units.length < 3) return [...els];
  const map = byId(els);
  const items = units.map((u) => ({ u, b: boundsOf(u.map((id) => map.get(id)!).filter(Boolean))! })).sort((a, b) => (axis === "x" ? a.b.x - b.b.x : a.b.y - b.b.y));
  const start = axis === "x" ? items[0]!.b.x : items[0]!.b.y;
  const lastB = items[items.length - 1]!.b;
  const end = axis === "x" ? lastB.x + lastB.w : lastB.y + lastB.h;
  const total = items.reduce((s, it) => s + (axis === "x" ? it.b.w : it.b.h), 0);
  const gap = (end - start - total) / (items.length - 1);
  let at = start;
  let out = [...els];
  for (const it of items) {
    const d = at - (axis === "x" ? it.b.x : it.b.y);
    if (d) out = move(out, new Set(it.u), axis === "x" ? d : 0, axis === "x" ? 0 : d);
    at += (axis === "x" ? it.b.w : it.b.h) + gap;
  }
  return out;
}

export function flip(els: Els, ids: Set<string>, axis: "x" | "y"): El[] {
  const all = withLabels(els, ids);
  const b = boundsOf(els.filter((e) => all.has(e.id)));
  if (!b) return [...els];
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const out = els.map((e) => {
    if (!all.has(e.id) || isLabel(e)) return e;
    if (e.points) {
      const abs = absPoints(e).map(([x, y]) => (axis === "x" ? [2 * cx - x, y] : [x, 2 * cy - y]) as Pt);
      return withPoints(e, abs);
    }
    const f = frame(e);
    return { ...e, x: axis === "x" ? 2 * cx - f.x - f.w : e.x, y: axis === "y" ? 2 * cy - f.y - f.h : e.y, angle: e.angle ? -e.angle : 0 };
  });
  return reroute(out, all);
}

export type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

/** The narrowest a labelled shape can be resized: its label's longest word still fits on one line
 *  (Excalidraw; Tyler, 2026-11-06), the inverse of `labelWidth`. 0 for a shape with no label. */
export function minLabelWidth(els: Els, c: El): number {
  const t = labelOf(els, c.id);
  if (!t) return 0;
  const size = t.fontSize ?? 20;
  const fam = t.fontFamily ?? SANS;
  const word = Math.max(0, ...(t.originalText ?? t.text ?? "").split(/\s+/).map((w) => measureLine(w, size, fam)));
  if (c.type === "ellipse") return (word + PAD * 2) * Math.SQRT2;
  if (c.type === "diamond") return (word + PAD * 2) * 2;
  return word + PAD * 4;
}

/** Resizes one element by dragging a handle to `p` (scene). `keep` holds the aspect ratio, `fromCentre`
 *  grows both ways, `minW` stops the width short of it (a label's longest word). */
export function resize(e: El, start: El, h: Handle, p: Pt, keep: boolean, fromCentre: boolean, minW = 0): El {
  const f = frame(start);
  const c: Pt = [f.x + f.w / 2, f.y + f.h / 2];
  const [lx, ly] = rot(p, c, -start.angle);
  let x0 = f.x, y0 = f.y, x1 = f.x + f.w, y1 = f.y + f.h;
  if (h.includes("w")) x0 = lx;
  if (h.includes("e")) x1 = lx;
  if (h.includes("n")) y0 = ly;
  if (h.includes("s")) y1 = ly;
  if (fromCentre) {
    if (h.includes("w")) x1 = 2 * c[0] - x0;
    if (h.includes("e")) x0 = 2 * c[0] - x1;
    if (h.includes("n")) y1 = 2 * c[1] - y0;
    if (h.includes("s")) y0 = 2 * c[1] - y1;
  }
  let w = x1 - x0;
  let hh = y1 - y0;
  if (keep && f.w && f.h) {
    const r = f.w / f.h;
    const side = h.length === 1 ? (h === "e" || h === "w" ? "w" : "h") : Math.abs(w) / r > Math.abs(hh) ? "w" : "h";
    if (side === "w") {
      const nh = (Math.abs(w) / r) * Math.sign(hh || 1);
      if (h.includes("n")) y0 = y1 - nh;
      else if (h.includes("s")) y1 = y0 + nh;
      else { y0 = c[1] - nh / 2; y1 = c[1] + nh / 2; }
    } else {
      const nw = Math.abs(hh) * r * Math.sign(w || 1);
      if (h.includes("w")) x0 = x1 - nw;
      else if (h.includes("e")) x1 = x0 + nw;
      else { x0 = c[0] - nw / 2; x1 = c[0] + nw / 2; }
    }
    w = x1 - x0;
    hh = y1 - y0;
  }
  if (minW && Math.abs(w) < minW) {
    // the edge being dragged stops; the other stays put
    if (h.includes("w")) x0 = x1 - minW * Math.sign(w || 1);
    else x1 = x0 + minW * Math.sign(w || 1);
    w = x1 - x0;
  }
  const nx = Math.min(x0, x1);
  const ny = Math.min(y0, y1);
  const nw = Math.max(1, Math.abs(w));
  const nh = Math.max(1, Math.abs(hh));
  // Keep the opposite corner put under rotation: the new frame's centre, rotated about the old one.
  const nc = rot([nx + nw / 2, ny + nh / 2], c, start.angle);
  const fx = nc[0] - nw / 2;
  const fy = nc[1] - nh / 2;
  if (start.points) {
    const sx = f.w ? nw / f.w : 1;
    const sy = f.h ? nh / f.h : 1;
    const flipX = w < 0 ? -1 : 1;
    const flipY = hh < 0 ? -1 : 1;
    const pts = start.points.map(([px, py]) => {
      const ax = start.x + px - f.x;
      const ay = start.y + py - f.y;
      return [fx + (flipX > 0 ? ax * sx : nw - ax * sx), fy + (flipY > 0 ? ay * sy : nh - ay * sy)] as Pt;
    });
    return { ...withPoints(start, pts), angle: start.angle };
  }
  const out: El = { ...start, x: fx, y: fy, width: nw, height: nh };
  if (start.type === "text" && start.fontSize && f.h) {
    const s = nh / f.h;
    out.fontSize = Math.max(6, Math.round(start.fontSize * s * 10) / 10);
  }
  return out;
}

/** Scales several elements as one box; each keeps its own rotation. */
export function resizeMany(starts: Els, from: Box, to: Box): El[] {
  const sx = from.w ? to.w / from.w : 1;
  const sy = from.h ? to.h / from.h : 1;
  return starts.map((e) => {
    if (e.points) {
      const pts = absPoints(e).map(([x, y]) => [to.x + (x - from.x) * sx, to.y + (y - from.y) * sy] as Pt);
      return e.type === "freedraw" ? { ...withPoints(e, pts), pressures: e.pressures } : withPoints(e, pts);
    }
    const f = frame(e);
    const out: El = { ...e, x: to.x + (f.x - from.x) * sx, y: to.y + (f.y - from.y) * sy, width: Math.max(1, f.w * sx), height: Math.max(1, f.h * sy) };
    if (e.type === "text" && e.fontSize) out.fontSize = Math.max(6, Math.round(e.fontSize * Math.min(sx, sy) * 10) / 10);
    return out;
  });
}

/** Rotates elements about a point by `da` radians. */
export function rotate(starts: Els, about: Pt, da: number): El[] {
  return starts.map((e) => {
    if (e.points && e.type !== "freedraw" && isLinear(e)) return withPoints(e, absPoints(e).map((p) => rot(p, about, da)));
    const c = rot(centre(e), about, da);
    const f = frame(e);
    return { ...e, x: e.x + (c[0] - (f.x + f.w / 2)), y: e.y + (c[1] - (f.y + f.h / 2)), angle: norm(e.angle + da) };
  });
}

const norm = (a: number) => {
  const t = Math.PI * 2;
  return ((a % t) + t) % t;
};

// ---------- Snapping ----------

/** A guide line while snapped: an edge or centre shared with another shape, or (`gap`) the equal
 *  spaces between the moving shape and two others in its row or column, drawn as spans. */
export type Guide = { axis: "x" | "y"; at: number; from: number; to: number; gap?: true };

/** Equal spacing along one axis: two others in the moving box's row (or column) with a gap between
 *  them, and the box the same gap after, before or between them. `a` is the axis start of a box,
 *  `s` its size, `c0`–`c1` its range across. Returns the nearest offset within `tol` and its spans. */
function spacing(b: { a: number; s: number; c0: number; c1: number }, others: { a: number; s: number; c0: number; c1: number }[], tol: number): { d: number; spans: [number, number][] } | null {
  const row = others.filter((o) => o.c0 < b.c1 && o.c1 > b.c0).sort((p, q) => p.a - q.a);
  let best: { d: number; spans: [number, number][] } | null = null;
  const take = (at: number, spans: (x: number) => [number, number][]) => {
    const d = at - b.a;
    if (Math.abs(d) <= tol && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, spans: spans(at) };
  };
  for (let i = 0; i < row.length; i++)
    for (let j = i + 1; j < row.length; j++) {
      const [o1, o2] = [row[i]!, row[j]!];
      const gap = o2.a - (o1.a + o1.s);
      if (gap <= 0) continue;
      take(o2.a + o2.s + gap, (x) => [[o1.a + o1.s, o2.a], [o2.a + o2.s, x]]);
      take(o1.a - gap - b.s, (x) => [[x + b.s, o1.a], [o1.a + o1.s, o2.a]]);
      if (gap > b.s) take(o1.a + o1.s + (gap - b.s) / 2, (x) => [[o1.a + o1.s, x], [x + b.s, o2.a]]);
    }
  return best;
}

/** Snaps a moving box to the edges and centres of others (within `tol`), else to equal spacing beside
 *  two of them, else to the grid. Returns the offset to add and the guide lines to draw. */
export function snapBox(b: Box, others: Box[], tol: number, grid: number | null): { dx: number; dy: number; guides: Guide[] } {
  const xs = [b.x, b.x + b.w / 2, b.x + b.w];
  const ys = [b.y, b.y + b.h / 2, b.y + b.h];
  let bx: { d: number; at: number } | null = null;
  let by: { d: number; at: number } | null = null;
  for (const o of others) {
    for (const t of [o.x, o.x + o.w / 2, o.x + o.w])
      for (const s of xs) if (Math.abs(t - s) <= tol && (!bx || Math.abs(t - s) < Math.abs(bx.d))) bx = { d: t - s, at: t };
    for (const t of [o.y, o.y + o.h / 2, o.y + o.h])
      for (const s of ys) if (Math.abs(t - s) <= tol && (!by || Math.abs(t - s) < Math.abs(by.d))) by = { d: t - s, at: t };
  }
  const gx = bx ? null : spacing({ a: b.x, s: b.w, c0: b.y, c1: b.y + b.h }, others.map((o) => ({ a: o.x, s: o.w, c0: o.y, c1: o.y + o.h })), tol);
  const gy = by ? null : spacing({ a: b.y, s: b.h, c0: b.x, c1: b.x + b.w }, others.map((o) => ({ a: o.y, s: o.h, c0: o.x, c1: o.x + o.w })), tol);
  let dx = bx?.d ?? gx?.d ?? 0;
  let dy = by?.d ?? gy?.d ?? 0;
  if (!bx && !gx && grid) dx = Math.round(b.x / grid) * grid - b.x;
  if (!by && !gy && grid) dy = Math.round(b.y / grid) * grid - b.y;
  const moved = { x: b.x + dx, y: b.y + dy, w: b.w, h: b.h };
  const guides: Guide[] = [];
  if (gx) for (const [from, to] of gx.spans) guides.push({ axis: "y", at: moved.y + moved.h / 2, from, to, gap: true });
  if (gy) for (const [from, to] of gy.spans) guides.push({ axis: "x", at: moved.x + moved.w / 2, from, to, gap: true });
  const near = (v: number, w: number) => Math.abs(v - w) < 0.5;
  if (bx) {
    const hit = others.filter((o) => [o.x, o.x + o.w / 2, o.x + o.w].some((v) => near(v, bx!.at)));
    const ys2 = [moved.y, moved.y + moved.h, ...hit.flatMap((o) => [o.y, o.y + o.h])];
    guides.push({ axis: "x", at: bx.at, from: Math.min(...ys2), to: Math.max(...ys2) });
  }
  if (by) {
    const hit = others.filter((o) => [o.y, o.y + o.h / 2, o.y + o.h].some((v) => near(v, by!.at)));
    const xs2 = [moved.x, moved.x + moved.w, ...hit.flatMap((o) => [o.x, o.x + o.w])];
    guides.push({ axis: "y", at: by.at, from: Math.min(...xs2), to: Math.max(...xs2) });
  }
  return { dx, dy, guides };
}

/** Snaps a single point (a resize corner, a line point) to others' edges and centres, else the grid. */
export function snapPoint(p: Pt, others: Box[], tol: number, grid: number | null): { p: Pt; guides: Guide[] } {
  const s = snapBox({ x: p[0], y: p[1], w: 0, h: 0 }, others, tol, grid);
  return { p: [p[0] + s.dx, p[1] + s.dy], guides: s.guides };
}

// ---------- Making things ----------

export function shape(type: Shape, b: Box, style: Style): El {
  return {
    id: uid(), type, x: b.x, y: b.y, width: b.w, height: b.h, angle: 0,
    strokeColor: style.strokeColor, backgroundColor: style.backgroundColor, fillStyle: style.fillStyle, strokeWidth: style.strokeWidth,
    strokeStyle: style.strokeStyle, roughness: 0, opacity: style.opacity, groupIds: [], roundness: type === "rectangle" ? style.roundness : style.roundness && { type: 2 },
    boundElements: null, locked: false,
  };
}

export function linear(type: Linear, abs: Pt[], style: Style): El {
  return withPoints(
    {
      id: uid(), type, x: 0, y: 0, width: 0, height: 0, angle: 0,
      strokeColor: style.strokeColor, backgroundColor: "transparent", fillStyle: style.fillStyle, strokeWidth: style.strokeWidth,
      strokeStyle: style.strokeStyle, roughness: 0, opacity: style.opacity, groupIds: [], roundness: style.roundness && { type: 2 },
      boundElements: null, locked: false, startBinding: null, endBinding: null,
      startArrowhead: type === "arrow" ? style.startArrowhead : null, endArrowhead: type === "arrow" ? style.endArrowhead : null,
      ...(type === "arrow" && style.elbowed ? { elbowed: true } : {}),
    },
    abs,
  );
}

export function text(at: Pt, value: string, style: Style, containerId: string | null = null): El {
  const m = measureText(value || " ", style.fontSize, style.fontFamily);
  return {
    id: uid(), type: "text", x: at[0], y: at[1], width: m.width, height: m.height, angle: 0,
    strokeColor: style.strokeColor, backgroundColor: "transparent", fillStyle: "solid", strokeWidth: 1, strokeStyle: "solid", roughness: 0,
    opacity: style.opacity, groupIds: [], roundness: null, boundElements: null, locked: false,
    text: value, originalText: value, fontSize: style.fontSize, fontFamily: style.fontFamily,
    textAlign: containerId ? "center" : style.textAlign === "center" ? "left" : style.textAlign, verticalAlign: containerId ? "middle" : "top",
    containerId, lineHeight: 1.25, autoResize: true,
  };
}

/** Sets a container's label (adding, changing or, when empty, removing its text element). */
export function setLabel(els: Els, containerId: string, value: string, style: Style): El[] {
  const c = els.find((e) => e.id === containerId);
  if (!c) return [...els];
  const old = labelOf(els, containerId);
  if (!value.trim()) return syncAll(old ? els.filter((e) => e.id !== old.id) : els);
  if (old) return syncAll(els.map((e) => (e.id === old.id ? { ...e, text: value, originalText: value } : e)));
  const t = { ...text([0, 0], value, { ...style, strokeColor: c.strokeColor, fontSize: isLinear(c) ? Math.min(style.fontSize, 16) : style.fontSize }, containerId), groupIds: c.groupIds };
  const i = els.findIndex((e) => e.id === containerId);
  return syncAll([...els.slice(0, i + 1), t, ...els.slice(i + 1)]);
}

/** Sets a free text element's text and size; empty text removes it. */
export function setText(els: Els, id: string, value: string): El[] {
  if (!value.trim()) return remove(els, new Set([id]));
  return els.map((e) => {
    if (e.id !== id) return e;
    const m = measureText(value, e.fontSize ?? 20, e.fontFamily ?? SANS, lineHeightOf(e));
    return { ...e, text: value, originalText: value, width: m.width, height: m.height };
  });
}

/** A bound arrow from `a` to `b`. */
export function connect(els: Els, a: El, b: El, style: Style, elbowed = false): El {
  const arrow = linear("arrow", [centre(a), centre(b)], { ...style, elbowed, startArrowhead: null, endArrowhead: style.endArrowhead ?? "arrow" });
  return route({ ...arrow, startBinding: { elementId: a.id, focus: 0, gap: GAP }, endBinding: { elementId: b.id, focus: 0, gap: GAP } }, byId([...els, a, b]));
}

export type Dir = "right" | "left" | "down" | "up";
const VEC: Record<Dir, Pt> = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] };

/** The direction the arrow into `node` came from, so Tab keeps a chain going the same way. */
export function flowDir(els: Els, node: El): Dir {
  const into = els.find((e) => e.type === "arrow" && e.endBinding?.elementId === node.id && e.startBinding);
  const from = into && els.find((e) => e.id === into.startBinding!.elementId);
  if (!from) return "right";
  const fp = into!.startBinding!.fixedPoint;
  if (fp) return fp[1] === 1 ? "down" : fp[1] === 0 ? "up" : fp[0] === 0 ? "left" : "right";
  // the axis the two boxes are apart on, so a row of siblings below a node reads as "down"
  const [a, b] = [bounds(from), bounds(node)];
  const gx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
  const gy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
  return gy > gx ? (b.y < a.y ? "up" : "down") : b.x < a.x ? "left" : "right";
}

/** A new node beside `parent` in `dir`, joined by an arrow: Tab and ⌘+arrow in the editor. It takes the
 *  parent's shape and style, and slides along the cross axis until it lands on free space, so making a
 *  map from memory never needs a drag (D103, the mechanics evidence in brief-diagramming-evidence.md). */
export function addChild(els: Els, parent: El, dir: Dir, style: Style): { els: El[]; node: El; arrow: El } {
  const kind = (isShape(parent) && parent.type !== "image" ? parent.type : "rectangle") as Shape;
  const w = isShape(parent) && parent.type !== "image" ? parent.width : NODE[0];
  const h = NODE[1];
  const pb = bounds(parent);
  const [vx, vy] = VEC[dir];
  const pc = centre(parent);
  let x = vx ? (vx > 0 ? pb.x + pb.w + SPACE : pb.x - SPACE - w) : pc[0] - w / 2;
  let y = vy ? (vy > 0 ? pb.y + pb.h + SPACE * 0.7 : pb.y - SPACE * 0.7 - h) : pc[1] - h / 2;
  const others = els.filter((e) => !isLabel(e) && e.type !== "arrow").map(bounds);
  const free = (bx: number, by: number) => !others.some((o) => overlaps({ x: bx - 16, y: by - 16, w: w + 32, h: h + 32 }, o));
  // Siblings stack after each other: try the slot in line first, then step along the cross axis.
  for (let i = 0; i < 40 && !free(x, y); i++) {
    if (vx) y += h + 24;
    else x += w + 24;
  }
  const node: El = {
    ...shape(kind, { x, y, w, h }, { ...style, strokeColor: parent.strokeColor, backgroundColor: isShape(parent) ? parent.backgroundColor : style.backgroundColor, fillStyle: parent.fillStyle, strokeWidth: isShape(parent) ? parent.strokeWidth : style.strokeWidth, strokeStyle: isShape(parent) ? parent.strokeStyle : "solid", roundness: isShape(parent) ? parent.roundness : style.roundness }),
    groupIds: [],
  };
  // the link leaves from the side the children grow on, so links to a row of children never cross a sibling
  const [fx, fy] = VEC[dir];
  const port = (sx: number, sy: number): [number, number] => [0.5 + sx / 2, 0.5 + sy / 2];
  const plain = connect(els, parent, node, style);
  const arrow = route({ ...plain, startBinding: { ...plain.startBinding!, fixedPoint: port(fx, fy) }, endBinding: { ...plain.endBinding!, fixedPoint: port(-fx, -fy) } }, byId([...els, node]));
  return { els: [...els, node, arrow], node, arrow };
}

/** Pushes the node a fresh link leads to further out until the link's label fits between the two
 *  nodes, so typing a long label after Tab never leaves it lying over a box. */
export function fitLink(els: Els, arrowId: string): El[] {
  const a = els.find((e) => e.id === arrowId);
  const t = a && labelOf(els, a.id);
  const from = a?.startBinding && els.find((e) => e.id === a.startBinding!.elementId);
  const to = a?.endBinding && els.find((e) => e.id === a.endBinding!.elementId);
  if (!a || !t || !from || !to) return [...els];
  const fb = bounds(from);
  const tb = bounds(to);
  const dx = centre(to)[0] - centre(from)[0];
  const dy = centre(to)[1] - centre(from)[1];
  if (Math.abs(dx) >= Math.abs(dy)) {
    const gap = dx > 0 ? tb.x - (fb.x + fb.w) : fb.x - (tb.x + tb.w);
    const need = t.width + 56;
    return gap < need ? move(els, new Set([to.id]), Math.sign(dx || 1) * (need - gap), 0) : [...els];
  }
  const gap = dy > 0 ? tb.y - (fb.y + fb.h) : fb.y - (tb.y + tb.h);
  const need = t.height + 40;
  return gap < need ? move(els, new Set([to.id]), 0, Math.sign(dy || 1) * (need - gap)) : [...els];
}

/** The nearest node from `from` in a direction (⌥+arrow), within a 60° cone, preferring ones it is joined to. */
export function nearestIn(els: Els, from: El, dir: Dir): El | null {
  const [vx, vy] = VEC[dir];
  const c = centre(from);
  const joined = new Set(els.filter((e) => e.type === "arrow").flatMap((a) => (a.startBinding?.elementId === from.id ? [a.endBinding?.elementId] : a.endBinding?.elementId === from.id ? [a.startBinding?.elementId] : [])));
  let best: El | null = null;
  let score = Infinity;
  for (const e of els) {
    if (e.id === from.id || !isNode(e)) continue;
    const [dx, dy] = [centre(e)[0] - c[0], centre(e)[1] - c[1]];
    const along = dx * vx + dy * vy;
    const across = Math.abs(dx * vy - dy * vx);
    if (along <= 0 || across > along * 1.8) continue;
    const s = (along + across * 2) * (joined.has(e.id) ? 0.6 : 1);
    if (s < score) {
      score = s;
      best = e;
    }
  }
  return best;
}

// ---------- Typed maps ----------

type Edge = { from: string; to: string; label: string };

/** Parses lines of `A -> B`, `A -causes-> B`, chains (`A -> B -> C`) and indented outlines (a line
 *  indented under another is its child), the text form of a concept map. A name in `(…)` is an
 *  ellipse and in `{…}` a diamond, as in Mermaid. */
export function parseMap(src: string): { nodes: string[]; edges: Edge[]; kinds: Map<string, "ellipse" | "diamond"> } {
  const nodes: string[] = [];
  const key = new Map<string, string>();
  const kinds = new Map<string, "ellipse" | "diamond">();
  const node = (raw: string) => {
    let name = raw.trim().replace(/^[-*•]\s+/, "");
    const wrap = name.match(/^\((.+)\)$|^\{(.+)\}$|^\[(.+)\]$/);
    const kind = wrap?.[1] ? "ellipse" : wrap?.[2] ? "diamond" : null;
    if (wrap) name = (wrap[1] ?? wrap[2] ?? wrap[3]!).trim();
    if (!name) return null;
    const k = name.toLowerCase();
    if (!key.has(k)) {
      key.set(k, name);
      nodes.push(name);
    }
    if (kind) kinds.set(key.get(k)!, kind);
    return key.get(k)!;
  };
  const edges: Edge[] = [];
  const stack: { indent: number; name: string }[] = [];
  for (const line of src.split("\n")) {
    if (!line.trim()) continue;
    const indent = line.match(/^\s*/)![0].replace(/\t/g, "  ").length;
    const parts = line.trim().split(/\s+-(?:([^>]+?)-)?>\s+|\s*->\s*/);
    // split() with a capture group interleaves labels: [node, label, node, label, node…]
    const names: (string | null)[] = [];
    const labels: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) names.push(node(parts[i] ?? ""));
      else labels.push((parts[i] ?? "").trim());
    }
    for (let i = 1; i < names.length; i++) {
      const a = names[i - 1];
      const b = names[i];
      if (a && b && !edges.some((e) => e.from === a && e.to === b)) edges.push({ from: a, to: b, label: labels[i - 1] ?? "" });
    }
    const first = names[0];
    if (!first) continue;
    while (stack.length && stack[stack.length - 1]!.indent >= indent) stack.pop();
    const parent = stack[stack.length - 1];
    if (parent && !edges.some((e) => e.from === parent.name && e.to === first)) edges.push({ from: parent.name, to: first, label: "" });
    stack.push({ indent, name: first });
  }
  return { nodes, edges, kinds };
}

/** Adds a typed map to the scene: nodes it names that already exist (same label) are reused, new ones
 *  are laid out in columns by depth to the right of what is there (or at `at` on an empty canvas). */
export function addMap(els: Els, src: string, style: Style, at: Pt): { els: El[]; ids: string[] } {
  const { nodes, edges, kinds } = parseMap(src);
  if (!nodes.length) return { els: [...els], ids: [] };
  const existing = new Map<string, El>();
  for (const e of els) {
    if (!isShape(e)) continue;
    const t = labelOf(els, e.id);
    const k = (t?.originalText ?? t?.text ?? "").trim().toLowerCase();
    if (k && !existing.has(k)) existing.set(k, e);
  }
  const depth = new Map<string, number>(nodes.map((n) => [n, 0]));
  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false;
    for (const e of edges) {
      const d = depth.get(e.from)! + 1;
      if (d > depth.get(e.to)! && d < nodes.length) {
        depth.set(e.to, d);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const all = boundsOf(els.filter((e) => !isLabel(e)));
  const origin: Pt = all ? [all.x + all.w + SPACE, all.y] : at;
  const rows = new Map<number, number>();
  let out = [...els];
  const made = new Map<string, El>();
  const ids: string[] = [];
  for (const n of nodes) {
    const found = existing.get(n.toLowerCase());
    if (found) {
      made.set(n, found);
      continue;
    }
    const d = depth.get(n)!;
    const r = rows.get(d) ?? 0;
    rows.set(d, r + 1);
    const el = shape(kinds.get(n) ?? "rectangle", { x: origin[0] + d * (NODE[0] + SPACE * 1.4), y: origin[1] + r * (NODE[1] + 36), w: NODE[0], h: NODE[1] }, style);
    out.push(el);
    out = setLabel(out, el.id, n, style);
    made.set(n, out.find((e) => e.id === el.id)!);
    ids.push(el.id);
  }
  for (const e of edges) {
    const a = out.find((x) => x.id === made.get(e.from)!.id)!;
    const b = out.find((x) => x.id === made.get(e.to)!.id)!;
    if (out.some((x) => x.type === "arrow" && x.startBinding?.elementId === a.id && x.endBinding?.elementId === b.id)) continue;
    const arrow = connect(out, a, b, style);
    out.push(arrow);
    ids.push(arrow.id);
    if (e.label) out = setLabel(out, arrow.id, e.label, style);
  }
  // Laid out as Tidy lays a map out, so no link runs through a node it doesn't join.
  const fresh = new Set(ids.filter((id) => out.some((x) => x.id === id && isShape(x))));
  return { els: fresh.size > 1 ? tidy(syncAll(out), fresh) : syncAll(out), ids };
}

/** Whether the segment p–q passes within `pad` of box b. */
function segHits(p: Pt, q: Pt, b: Box, pad: number): boolean {
  const x0 = b.x - pad, y0 = b.y - pad, x1 = b.x + b.w + pad, y1 = b.y + b.h + pad;
  let t0 = 0, t1 = 1;
  const dx = q[0] - p[0], dy = q[1] - p[1];
  for (const [pp, qq] of [[-dx, p[0] - x0], [dx, x1 - p[0]], [-dy, p[1] - y0], [dy, y1 - p[1]]] as const) {
    if (pp === 0) { if (qq < 0) return false; continue; }
    const r = qq / pp;
    if (pp < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return t0 <= t1;
}

/** Tidies a map: nodes joined by arrows go into columns by depth from the roots (a root one column
 *  before its nearest child), each column ordered by where its parents sit (fewer crossings), with room
 *  between columns for the widest link label; maps not joined to each other stack, one under another.
 *  A link that skips a column never runs through a node it doesn't join: that node and the ones under
 *  it move down past the line. Only the picked nodes move (all joined nodes when `ids` is empty);
 *  free shapes stay where they are. */
export function tidy(els: Els, ids: Set<string> = new Set()): El[] {
  const arrows = els.filter((e) => e.type === "arrow" && e.startBinding && e.endBinding && e.startBinding.elementId !== e.endBinding.elementId);
  const pick = (id: string) => !ids.size || ids.has(id);
  const nodeIds = [...new Set(arrows.flatMap((a) => [a.startBinding!.elementId, a.endBinding!.elementId]))].filter((id) => {
    const n = els.find((x) => x.id === id);
    return pick(id) && n && isShape(n) && !cellOf(n) && !n.locked;
  });
  const inMap = new Set(nodeIds);
  const edges = arrows.map((a) => ({ a, from: a.startBinding!.elementId, to: a.endBinding!.elementId })).filter((e) => inMap.has(e.from) && inMap.has(e.to));
  if (nodeIds.length < 2 || !edges.length) return [...els];
  const map = byId(els);
  // Maps not joined to each other, in the order their first node was drawn.
  const root = new Map(nodeIds.map((n) => [n, n]));
  const find = (n: string): string => (root.get(n) === n ? n : find(root.get(n)!));
  for (const e of edges) root.set(find(e.from), find(e.to));
  const comps = [...new Set(nodeIds.map(find))].map((r) => nodeIds.filter((n) => find(n) === r)).filter((c) => c.length > 1);
  const start = boundsOf(comps.flat().map((n) => map.get(n)!))!;
  let out = [...els];
  let top = start.y;
  for (const comp of comps) {
    const all = edges.filter((e) => comp.includes(e.from));
    // A loop's link back (found depth first, from the roots) doesn't set columns, so every column link runs
    // left to right and none joins two nodes in one column (the layered layout's usual cycle break).
    const back = new Set<(typeof all)[number]>();
    const state = new Map<string, 1 | 2>();
    const visit = (n: string) => {
      state.set(n, 1);
      for (const e of all.filter((x) => x.from === n)) {
        if (state.get(e.to) === 1) back.add(e);
        else if (!state.has(e.to)) visit(e.to);
      }
      state.set(n, 2);
    };
    for (const n of [...comp.filter((n) => !all.some((e) => e.to === n)), ...comp]) if (!state.has(n)) visit(n);
    const es = all.filter((e) => !back.has(e));
    const depth = new Map(comp.map((n) => [n, 0]));
    for (let pass = 0; pass < comp.length; pass++) {
      let changed = false;
      for (const e of es) {
        const d = depth.get(e.from)! + 1;
        if (d > depth.get(e.to)! && d < comp.length) {
          depth.set(e.to, d);
          changed = true;
        }
      }
      if (!changed) break;
    }
    // A root sits one column before its nearest child, so its link doesn't reach across other nodes.
    for (const n of comp) {
      if (es.some((e) => e.to === n)) continue;
      const kids = es.filter((e) => e.from === n).map((e) => depth.get(e.to)!);
      if (kids.length) depth.set(n, Math.max(0, Math.min(...kids) - 1));
    }
    const cols: string[][] = Array.from({ length: Math.max(...depth.values()) + 1 }, () => []);
    for (const n of comp) cols[depth.get(n)!]!.push(n);
    const rowOf = new Map<string, number>();
    cols.forEach((col, ci) => {
      if (ci > 0)
        col.sort((x, y) => {
          const avg = (n: string) => {
            const ps = es.filter((e) => e.to === n && rowOf.has(e.from)).map((e) => rowOf.get(e.from)!);
            return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : Infinity;
          };
          return avg(x) - avg(y);
        });
      col.forEach((n, i) => rowOf.set(n, i));
    });
    const heights = cols.map((col) => col.reduce((h, n) => h + map.get(n)!.height, 0) + Math.max(0, col.length - 1) * 32);
    const tallest = Math.max(...heights);
    let x = start.x;
    cols.forEach((col, ci) => {
      if (!col.length) return;
      const w = Math.max(...col.map((n) => map.get(n)!.width));
      // Each node level with its parents where there is room, so links run nearly flat (a steep one cuts
      // through the nodes beside its end); the first column is centred as before.
      let y = top + (tallest - heights[ci]!) / 2;
      let floor = -Infinity;
      for (const n of col) {
        const f = frame(out.find((v) => v.id === n)!);
        const ps = ci ? es.filter((e) => e.to === n).map((e) => out.find((v) => v.id === e.from)!).filter((v) => depth.get(v.id)! < ci) : [];
        const want = ps.length ? ps.reduce((a, v) => a + v.y + v.height / 2, 0) / ps.length - f.h / 2 : y;
        const at = Math.max(floor, want);
        out = out.map((v) => (v.id === n ? { ...v, x: x + (w - f.w) / 2, y: at, angle: 0 } : v));
        floor = at + f.h + 32;
        y = floor;
      }
      const next = cols[ci + 1];
      const labels = next ? es.filter((e) => col.includes(e.from) && next.includes(e.to)).map((e) => labelOf(els, e.a.id)?.width ?? 0) : [];
      x += w + Math.max(SPACE, Math.max(0, ...labels) + 56);
    });
    // A link that still runs through a node it doesn't join moves that node off the line: down with the nodes
    // under it in its column, or up with those over it when the link's own end is under it.
    for (let pass = 0; pass < comp.length * 4; pass++) {
      const at = byId(out);
      let move: { ids: Set<string>; dy: number } | null = null;
      for (const e of all) {
        const [p, q] = [centre(at.get(e.from)!), centre(at.get(e.to)!)];
        const yAt = (x: number) => p[1] + ((q[1] - p[1]) * (Math.min(Math.max(x, Math.min(p[0], q[0])), Math.max(p[0], q[0])) - p[0])) / (q[0] - p[0] || 1);
        for (const col of cols) {
          const i = col.findIndex((n) => n !== e.from && n !== e.to && segHits(p, q, frame(at.get(n)!), 16));
          if (i < 0) continue;
          const f = frame(at.get(col[i]!)!);
          const [lo, hi] = [Math.min(yAt(f.x), yAt(f.x + f.w)), Math.max(yAt(f.x), yAt(f.x + f.w))];
          const down = col.slice(i), up = col.slice(0, i + 1);
          if (!down.includes(e.from) && !down.includes(e.to)) move = { ids: new Set(down), dy: hi + 36 - f.y };
          else if (!up.includes(e.from) && !up.includes(e.to)) move = { ids: new Set(up), dy: lo - 36 - (f.y + f.h) };
          if (move) break;
        }
        if (move) break;
      }
      if (!move || !move.dy) break;
      out = out.map((v) => (move!.ids.has(v.id) ? { ...v, y: v.y + move!.dy } : v));
    }
    top = boundsOf(comp.map((n) => out.find((v) => v.id === n)!))!.y + boundsOf(comp.map((n) => out.find((v) => v.id === n)!))!.h + 64;
  }
  return reroute(syncAll(out), new Set(nodeIds));
}

// ---------- Matrix ----------

type Cell = { matrix: string; row: number; col: number };
export const cellOf = (e: El): Cell | null => {
  const c = e.customData?.oreCell as Cell | undefined;
  return c && typeof c.matrix === "string" ? c : null;
};

/** A compare-and-contrast matrix: header row and column, cells as grouped boxes (D103; the
 *  strongest single organizer effect in brief-diagramming-evidence.md row 3). */
export function addMatrix(els: Els, at: Pt, rows: number, cols: number, style: Style): { els: El[]; first: string } {
  const mid = uid();
  const cells: El[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const head = r === 0 || c === 0;
      cells.push({
        ...shape("rectangle", { x: at[0] + c * 180, y: at[1] + r * 56, w: 180, h: 56 }, { ...style, roundness: null, backgroundColor: head && (r || c) ? "#e9ecef" : "transparent", fillStyle: "solid", strokeWidth: 1, strokeStyle: "solid" }),
        groupIds: [mid],
        customData: { oreCell: { matrix: mid, row: r, col: c } },
      });
    }
  return { els: [...els, ...cells], first: cells[1]!.id };
}

const cellsOf = (els: Els, mid: string) => els.filter((e) => cellOf(e)?.matrix === mid);

/** Re-lays a matrix: every row as tall as its tallest cell, every column as wide as its widest. */
export function layoutMatrix(els: Els, mid: string): El[] {
  const synced = syncAll(els);
  const cells = cellsOf(synced, mid);
  if (!cells.length) return synced;
  const nr = Math.max(...cells.map((e) => cellOf(e)!.row)) + 1;
  const nc = Math.max(...cells.map((e) => cellOf(e)!.col)) + 1;
  const hs = Array.from({ length: nr }, (_, r) => Math.max(40, ...cells.filter((e) => cellOf(e)!.row === r).map((e) => e.height)));
  const ws = Array.from({ length: nc }, (_, c) => Math.max(60, ...cells.filter((e) => cellOf(e)!.col === c).map((e) => e.width)));
  const o = cells.find((e) => cellOf(e)!.row === 0 && cellOf(e)!.col === 0) ?? cells[0]!;
  const pos = (arr: number[], i: number) => arr.slice(0, i).reduce((a, b) => a + b, 0);
  const next = synced.map((e) => {
    const c = cellOf(e);
    if (c?.matrix !== mid) return e;
    return { ...e, x: o.x + pos(ws, c.col), y: o.y + pos(hs, c.row), width: ws[c.col]!, height: hs[c.row]!, angle: 0 };
  });
  return syncAll(next);
}

/** Adds a row or column at the end of a matrix. */
export function growMatrix(els: Els, mid: string, what: "row" | "col"): El[] {
  const cells = cellsOf(els, mid);
  if (!cells.length) return [...els];
  const nr = Math.max(...cells.map((e) => cellOf(e)!.row)) + 1;
  const nc = Math.max(...cells.map((e) => cellOf(e)!.col)) + 1;
  const template = cells.find((e) => cellOf(e)!.row === nr - 1 && cellOf(e)!.col === nc - 1)!;
  const head = cells.find((e) => cellOf(e)!.row === 0 && cellOf(e)!.col === 1) ?? template;
  const add: El[] = [];
  const count = what === "row" ? nc : nr;
  for (let i = 0; i < count; i++) {
    const row = what === "row" ? nr : i;
    const col = what === "row" ? i : nc;
    const isHead = row === 0 || col === 0;
    add.push({ ...template, id: uid(), backgroundColor: isHead && (row || col) ? head.backgroundColor : "transparent", boundElements: null, customData: { oreCell: { matrix: mid, row, col } } });
  }
  return layoutMatrix([...els, ...add], mid);
}

/** The next cell in reading order (Tab), or the previous (⇧Tab); null past either end. */
export function nextCell(els: Els, id: string, back: boolean): El | null {
  const e = els.find((x) => x.id === id);
  const c = e && cellOf(e);
  if (!c) return null;
  const cells = cellsOf(els, c.matrix).sort((a, b) => cellOf(a)!.row - cellOf(b)!.row || cellOf(a)!.col - cellOf(b)!.col);
  const i = cells.findIndex((x) => x.id === id);
  return cells[back ? i - 1 : i + 1] ?? null;
}

// ---------- Reading a diagram ----------

/** Plain-text reading of a diagram: each labelled node, then "A → B (label)" for each arrow. For
 *  the screen-reader summary and a copy as text. */
export function describe(els: Els): string {
  const name = (id?: string) => {
    const e = id ? els.find((x) => x.id === id) : undefined;
    if (!e) return "?";
    return (labelOf(els, e.id)?.originalText ?? e.text ?? e.type).trim() || e.type;
  };
  const lines: string[] = [];
  for (const e of els) if (isShape(e) || (e.type === "text" && !e.containerId)) lines.push(name(e.id));
  for (const e of els) {
    if (e.type !== "arrow" || !(e.startBinding || e.endBinding)) continue;
    const l = labelOf(els, e.id)?.originalText;
    lines.push(`${name(e.startBinding?.elementId)} → ${name(e.endBinding?.elementId)}${l ? ` (${l})` : ""}`);
  }
  return lines.join("\n");
}
