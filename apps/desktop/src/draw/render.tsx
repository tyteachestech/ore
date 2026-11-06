// Draws a scene as SVG (D103): crisp lines in the Terminal look, the same markup for the editor, the
// note preview and a copy as SVG or PNG. Colours are stored in Excalidraw's light palette and shown on
// the dark page the way Excalidraw's dark theme shows them, with black as the app's paper white.
import { memo, type ReactNode } from "react";
import { absPoints, centre, frame, isLinear, lineHeightOf, MONO, type El, type Els, type Pt } from "./model";

const ink = new Map<string, string>([["#1e1e1e", "#f2f1ec"], ["#000000", "#f2f1ec"], ["#ffffff", "#141413"]]);

/** Excalidraw's dark theme (invert 93%, hue-rotate 180°), in code so exports and previews match. */
export function dark(c: string): string {
  if (!c || c === "transparent") return "transparent";
  const hit = ink.get(c.toLowerCase());
  if (hit) return hit;
  const m = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return c;
  const h = m[1]!.length === 3 ? [...m[1]!].map((x) => x + x).join("") : m[1]!;
  const [r, g, b] = [0, 2, 4].map((i) => 0.93 - 0.86 * (parseInt(h.slice(i, i + 2), 16) / 255)) as [number, number, number];
  // hue-rotate(180deg) as the CSS filter's matrix
  const R = -0.574 * r + 1.43 * g + 0.144 * b;
  const G = 0.426 * r + 0.43 * g + 0.144 * b;
  const B = 0.426 * r + 1.43 * g - 0.856 * b;
  const hex = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0");
  const out = `#${hex(R)}${hex(G)}${hex(B)}`;
  ink.set(c.toLowerCase(), out);
  return out;
}

export const fontOf = (family?: number) => (family === MONO || family === 8 ? `"Geist Mono", ui-monospace, Menlo, monospace` : `Geist, -apple-system, "SF Pro Text", sans-serif`);

const dash = (e: El) => (e.strokeStyle === "dashed" ? `${e.strokeWidth * 4} ${e.strokeWidth * 3}` : e.strokeStyle === "dotted" ? `${e.strokeWidth} ${e.strokeWidth * 2.5}` : undefined);

/** The pixel dither that stands in for Excalidraw's hatching: a 2×2 checker in the fill colour. */
const ditherId = (c: string) => `dither-${c.replace(/[^a-z0-9]/gi, "")}`;
const fillOf = (e: El, map: (c: string) => string) => {
  if (e.backgroundColor === "transparent") return "none";
  return e.fillStyle === "solid" ? map(e.backgroundColor) : `url(#${ditherId(e.backgroundColor)})`;
};

export function Defs({ els, map = dark }: { els: Els; map?: (c: string) => string }) {
  const colours = [...new Set(els.filter((e) => e.backgroundColor !== "transparent" && e.fillStyle !== "solid").map((e) => e.backgroundColor))];
  if (!colours.length) return null;
  return (
    <defs>
      {colours.map((c) => (
        <pattern key={c} id={ditherId(c)} width={4} height={4} patternUnits="userSpaceOnUse">
          <rect width={2} height={2} fill={map(c)} />
          <rect x={2} y={2} width={2} height={2} fill={map(c)} />
        </pattern>
      ))}
    </defs>
  );
}

function smooth(pts: Pt[]): string {
  if (pts.length < 3) return `M${pts.map((p) => p.join(" ")).join(" L")}`;
  let d = `M${pts[0]![0]} ${pts[0]![1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

function freehand(pts: Pt[]): string {
  if (pts.length < 2) return pts.length ? `M${pts[0]![0]} ${pts[0]![1]} l0.01 0` : "";
  let d = `M${pts[0]![0]} ${pts[0]![1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i]!;
    const [nx, ny] = pts[i + 1]!;
    d += ` Q${x} ${y} ${(x + nx) / 2} ${(y + ny) / 2}`;
  }
  const last = pts[pts.length - 1]!;
  return `${d} L${last[0]} ${last[1]}`;
}

function head(kind: string | null | undefined, tip: Pt, from: Pt, w: number, colour: string): ReactNode {
  if (!kind) return null;
  const a = Math.atan2(tip[1] - from[1], tip[0] - from[0]);
  const size = 10 + w * 3;
  const at = (da: number, l = size): Pt => [tip[0] - l * Math.cos(a + da), tip[1] - l * Math.sin(a + da)];
  if (kind === "dot" || kind === "circle" || kind === "circle_outline") return <circle cx={tip[0]} cy={tip[1]} r={3 + w * 1.2} fill={kind === "circle_outline" ? "none" : colour} stroke={colour} strokeWidth={w} />;
  if (kind === "bar") {
    const [p, q] = [at(Math.PI / 2, size * 0.5), at(-Math.PI / 2, size * 0.5)];
    return <path d={`M${p[0]} ${p[1]} L${q[0]} ${q[1]}`} stroke={colour} strokeWidth={w} />;
  }
  const [p, q] = [at(0.45), at(-0.45)];
  if (kind === "triangle" || kind === "triangle_outline") return <path d={`M${tip[0]} ${tip[1]} L${p[0]} ${p[1]} L${q[0]} ${q[1]} Z`} fill={kind === "triangle" ? colour : "none"} stroke={colour} strokeWidth={w} strokeLinejoin="miter" />;
  return <path d={`M${p[0]} ${p[1]} L${tip[0]} ${tip[1]} L${q[0]} ${q[1]}`} fill="none" stroke={colour} strokeWidth={w} strokeLinecap="square" strokeLinejoin="miter" />;
}

type Props = { e: El; map?: (c: string) => string; container?: El | undefined; files?: Record<string, { dataURL?: string }> };

/** One element. Memoized on the element object, so a drag re-renders only what moved. */
export const Element = memo(function Element({ e, map = dark, container, files }: Props) {
  const stroke = map(e.strokeColor);
  const op = e.opacity < 100 ? e.opacity / 100 : undefined;
  const f = frame(e);
  const [cx, cy] = centre(e);
  const turn = e.angle ? `rotate(${(e.angle * 180) / Math.PI} ${cx} ${cy})` : undefined;
  const common = { stroke, strokeWidth: e.strokeWidth, strokeDasharray: dash(e), fill: fillOf(e, map), opacity: op };
  if (e.type === "rectangle") {
    const r = e.roundness ? Math.min(32, Math.min(f.w, f.h) * 0.25) : 0;
    return <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={r} transform={turn} {...common} />;
  }
  if (e.type === "ellipse") return <ellipse cx={cx} cy={cy} rx={f.w / 2} ry={f.h / 2} transform={turn} {...common} />;
  if (e.type === "diamond") return <path d={`M${cx} ${f.y} L${f.x + f.w} ${cy} L${cx} ${f.y + f.h} L${f.x} ${cy} Z`} strokeLinejoin={e.roundness ? "round" : "miter"} transform={turn} {...common} />;
  if (e.type === "image") {
    const src = e.fileId ? files?.[e.fileId]?.dataURL : undefined;
    return src ? <image href={src} x={f.x} y={f.y} width={f.w} height={f.h} transform={turn} opacity={op} preserveAspectRatio="none" /> : <rect x={f.x} y={f.y} width={f.w} height={f.h} fill="none" stroke={stroke} strokeDasharray="4 4" transform={turn} />;
  }
  if (isLinear(e)) {
    const pts = absPoints(e);
    const d = e.roundness && pts.length > 2 && !e.elbowed ? smooth(pts) : `M${pts.map((p) => p.join(" ")).join(" L")}`;
    const n = pts.length;
    return (
      <g opacity={op}>
        <path d={d} fill={e.type === "line" && n > 2 && pts[0]![0] === pts[n - 1]![0] && pts[0]![1] === pts[n - 1]![1] ? fillOf(e, map) : "none"} stroke={stroke} strokeWidth={e.strokeWidth} strokeDasharray={dash(e)} strokeLinejoin="round" strokeLinecap="round" />
        {n > 1 && head(e.endArrowhead, pts[n - 1]!, pts[n - 2]!, e.strokeWidth, stroke)}
        {n > 1 && head(e.startArrowhead, pts[0]!, pts[1]!, e.strokeWidth, stroke)}
      </g>
    );
  }
  if (e.type === "freedraw") return <path d={freehand(absPoints(e))} fill="none" stroke={stroke} strokeWidth={e.strokeWidth * 1.6 + 1} strokeLinecap="round" strokeLinejoin="round" opacity={op} transform={turn} />;
  if (e.type === "text") {
    const size = e.fontSize ?? 20;
    const lh = size * lineHeightOf(e);
    const lines = (e.text ?? "").split("\n");
    const anchor = e.textAlign === "center" ? "middle" : e.textAlign === "right" ? "end" : "start";
    const tx = e.textAlign === "center" ? f.x + f.w / 2 : e.textAlign === "right" ? f.x + f.w : f.x;
    // A label on an arrow masks the line under it, as on paper.
    const mask = container && isLinear(container) ? <rect x={f.x - 4} y={f.y - 1} width={f.w + 8} height={f.h + 2} fill="var(--draw-ground, #141413)" /> : null;
    return (
      <g transform={turn} opacity={op}>
        {mask}
        <text x={tx} y={f.y} fill={stroke} fontSize={size} fontFamily={fontOf(e.fontFamily)} textAnchor={anchor} style={{ whiteSpace: "pre" }}>
          {lines.map((l, i) => (
            <tspan key={i} x={tx} y={f.y + i * lh + lh / 2} dominantBaseline="central">
              {l || " "}
            </tspan>
          ))}
        </text>
      </g>
    );
  }
  return <rect x={f.x} y={f.y} width={f.w} height={f.h} fill="none" stroke={stroke} strokeDasharray="2 4" />;
});

/** Every element, back to front. `hidden` leaves some out (text being edited, a drag drawn elsewhere). */
export function Elements({ els, hidden, map, files }: { els: Els; hidden?: Set<string>; map?: (c: string) => string; files?: Record<string, { dataURL?: string }> }) {
  const byId = new Map(els.map((e) => [e.id, e]));
  return (
    <>
      {els.map((e) => (hidden?.has(e.id) ? null : <Element key={e.id} e={e} map={map} container={e.containerId ? byId.get(e.containerId) : undefined} files={files} />))}
    </>
  );
}
