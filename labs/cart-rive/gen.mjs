// Writes rive/scene.rml: the cart ending as one Rive artboard, from text. Run: node labs/cart-rive/gen.mjs [--stage]
// --stage also draws a stand-in for the page (background, unlit ring) so a headless capture can be read on its own.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STAGE = process.argv.includes("--stage");
const BGONLY = process.argv.includes("--bg"); // only the page colour behind, so a capture can be keyed onto the stage page
const X2 = process.argv.includes("--x2") ? 2 : 1; // draw at twice the size, for a Retina capture from the headless renderer

// ───────────────────────── the stage: what the page owns, and where
const W = 1280, H = 800;
export const RING = { cx: 640, cy: 372, R: 101.5, r: 7.65, n: 30 };
const P = 96 / 33; // one dot of the mole's pitch, px: he is 33 dots and 96 px across
const GROUND = RING.cy - RING.R - RING.r - 5; // the dirt line of his hole, just over the ring's top dot
const FLOOR = GROUND - 0.4 * P; // nothing of him is drawn below this
const HOLE_X = RING.cx;
const BG = "121316", TEXT = "F5F6F7", GREEN = "5FCF8A";
const MAX_ORE = 30, MAX_STONES = 3;
const DEF_ORE = 12, DEF_STONES = 1;

const hex2 = (n) => Math.round(n).toString(16).padStart(2, "0").toUpperCase();
const mix = (a, b, t) => [0, 2, 4].map((i) => hex2(parseInt(b.slice(i, i + 2), 16) * (1 - t) + parseInt(a.slice(i, i + 2), 16) * t)).join("");
const TONE = Array.from({ length: 10 }, (_, k) => mix(TEXT, BG, k / 9)); // his greys: 0 the page … 9 the text colour
const COL = { eye: "060607", glint: TEXT, nose: "F096AC", lamp: "FFB224", dirt: "5C5E64", green: GREEN, bg: BG };
const colour = (t) => (typeof t === "number" ? TONE[Math.max(0, Math.min(9, t))] : COL[t] ?? t);

// ───────────────────────── tiny XML and id helpers
let nid = 100;
const newId = () => `0:${nid++}`;
const n2 = (v) => +(+v).toFixed(2);
const n4 = (v) => +(+v).toFixed(4);
const attrs = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => ` ${k}="${v}"`).join("");
const el = (tag, a = {}, kids = "") => {
  const body = Array.isArray(kids) ? kids.filter(Boolean).join("\n") : kids;
  return body ? `<${tag}${attrs(a)}>\n${body}\n</${tag}>` : `<${tag}${attrs(a)}/>`;
};
const node = (name, a, kids) => el("Node", { name, ...a }, kids);

/** Dots as shapes: one Shape per colour, an Ellipse per dot. dots: [x, y, r, tone] in px, local. */
function dotShapes(dots, name = "dots") {
  const by = new Map();
  for (const [x, y, r, t] of dots) {
    const c = colour(t);
    if (!by.has(c)) by.set(c, []);
    by.get(c).push(`<Ellipse x="${n2(x)}" y="${n2(y)}" width="${n2(2 * r)}" height="${n2(2 * r)}"/>`);
  }
  return [...by].map(([c, es]) => el("Shape", { name: `${name} ${c}` }, [...es, `<Fill><SolidColor colorValue="FF${c}"/></Fill>`])).join("\n");
}
/** What hides the things behind a part: its own dots again, fat, in the page colour. Thinned to every other dot where neighbours cover the gap. */
function backing(dots, grow = 0.78 * P, name = "backing") {
  const seen = new Set(), out = [];
  for (const [x, y] of dots) {
    const k = `${Math.round(x / (P * 0.9))},${Math.round(y / (P * 0.9))}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push([x, y, grow, "bg"]);
  }
  return dotShapes(out, name);
}

// ───────────────────────── the mole's drawing
const src = fs.readFileSync(path.join(HERE, "../../apps/desktop/src/mole-fine-data.ts"), "utf8");
const PARTS = {};
for (const [, k, v] of src.matchAll(/^  (\w+): \[([^\]]*)\]/gm)) PARTS[k] = v.split(",").map(Number);
const grey = (b) => Math.round(Math.max(0, Math.min(1, (b - 25) / 215)) * 9);
const ORIGIN_Y = -2; // his root sits at his chest, two dots over the dirt line of the rest drawing
/** A traced part as [x, y, r, tone] in px around a pivot given in the drawing's own dots. */
const part = (name, tone, px = 0, py = ORIGIN_Y) => {
  const a = PARTS[name], out = [];
  for (let i = 0; i < a.length; i += 4) out.push([(a[i] - px) * P, (a[i + 1] - py) * P, a[i + 2] * P, tone ?? grey(a[i + 3])]);
  return out;
};
/** My own dots on his grid: [x, y, r, tone] given in dots, around a pivot. */
const mine = (list, px = 0, py = ORIGIN_Y) => list.map(([x, y, r, t]) => [(x - px) * P, (y - py) * P, r * P, t]);
const at = (px, py) => ({ x: n2(px * P), y: n2((py - ORIGIN_Y) * P) }); // a pivot, in the root's space
const HEAD = [0, -1]; // where the head turns
const inHead = (px, py) => ({ x: n2((px - HEAD[0]) * P), y: n2((py - HEAD[1]) * P) });

// The body the rest drawing never shows: a stout barrel under the head, a pale belly, two small feet.
const bodyDots = [], bellyDots = [], footDots = [];
for (let y = 1; y <= 15; y++) for (let x = -12; x <= 12; x++) {
  const d = Math.hypot(x / 11.6, (y - 7.6) / 8.2);
  if (d > 1) continue;
  const b = Math.hypot(x / 6.4, (y - 9.2) / 4.9);
  if (b <= 1) bellyDots.push([x, y, 0.42 - 0.05 * b * b, b > 0.8 ? 8 : 9]);
  else bodyDots.push([x, y, d > 0.86 ? 0.3 : d > 0.7 ? 0.36 : 0.4, d > 0.86 ? 4 : d > 0.7 ? 5 : 6]);
}
for (let y = 0; y <= 2; y++) for (let x = -2; x <= 2; x++) {
  if (Math.hypot(x / 2.6, (y - 1) / 1.5) > 1) continue;
  footDots.push([x, y, y === 2 ? 0.34 : 0.4, y === 0 ? 7 : 8]);
}

const ids = {};
const I = (k) => (ids[k] ??= newId());

function moleXml() {
  const eye = (s, cx, cy) => {
    const open = [...part(`eye${s}`, "eye", cx, cy), ...part(`glint${s}`, "glint", cx, cy)];
    const shut = mine([[-1.05, 0.25, 0.3, "eye"], [-0.35, 0.6, 0.33, "eye"], [0.35, 0.6, 0.33, "eye"], [1.05, 0.25, 0.3, "eye"]], 0, 0);
    return node(`Eye${s}`, { id: I(`eye${s}`), ...inHead(cx, cy) }, [
      node("Open", { id: I(`open${s}`) }, dotShapes(open, "eye")),
      node("Shut", { id: I(`shut${s}`), opacity: 0 }, dotShapes(shut, "lid")),
    ]);
  };
  const lobe = (s, sign) => node(`Snore${s}`, { id: I(`snore${s}`), ...inHead(sign * 0.9, -10.4) }, node(`Lobe${s}`, { id: I(`lobe${s}`) }, [
    dotShapes(part(`lobe${s}`, undefined, sign * 0.9, -10.4), "lobe"), backing(part(`lobe${s}`, undefined, sign * 0.9, -10.4)),
  ]));
  const arm = (s, sign) => node(`Arm${s}`, { id: I(`arm${s}`), ...at(sign * 11.8, -2.6) }, [
    dotShapes(part(`paw${s}`, undefined, sign * 11.8, -2.6), "paw"), backing(part(`paw${s}`, undefined, sign * 11.8, -2.6)),
  ]);
  const foot = (s, sign) => node(`Foot${s}`, { id: I(`foot${s}`), ...at(sign * 5, 14.6) }, [dotShapes(mine(footDots, 0, 0), "foot"), backing(mine(footDots, 0, 0))]);
  const headPivot = HEAD, helmPivot = [0, -15.5];
  const hp = (name, tone) => part(name, tone, ...headPivot);
  const helmet = part("helmet", undefined, ...helmPivot), lamp = part("lamp", "lamp", ...helmPivot);
  return node("Mole", { id: I("mole"), x: HOLE_X, y: n2(GROUND + ORIGIN_Y * P) }, [
    el("TransformConstraint", { id: I("moleSeat"), targetId: I("seat"), strength: 0, name: "Rides the cart" }),
    el("ClippingShape", { sourceId: I("holeClip"), name: "Above the dirt" }),
    node("Bob", { id: I("bob") }, node("Squash", { id: I("sq") }, node("Breath", { id: I("br") }, [
      node("Head", { id: I("head"), ...at(...headPivot) }, [
        node("ZAnchor", { id: I("zAnchor"), x: n2(7 * P), y: n2(-21 * P) }),
        eye("L", -4.4, -12.6), eye("R", 5.6, -12.6),
        node("Helmet at", { x: n2((helmPivot[0] - headPivot[0]) * P), y: n2((helmPivot[1] - headPivot[1]) * P) }, node("Helmet", { id: I("helm") }, [dotShapes(lamp, "lamp"), dotShapes(helmet, "helmet"), backing(helmet)])),
        dotShapes(hp("nose", "nose"), "nose"),
        lobe("L", -1), lobe("R", 1),
        dotShapes(hp("gap"), "gap"),
        dotShapes(hp("fur"), "fur"), backing(hp("fur")),
      ]),
      arm("L", -1), arm("R", 1),
      node("Body", { id: I("body"), ...at(0, 9) }, [dotShapes(mine(bellyDots, 0, 9), "belly"), dotShapes(mine(bodyDots, 0, 9), "body"), backing(mine([...bodyDots, ...bellyDots], 0, 9))]),
      foot("L", -1), foot("R", 1),
    ]))),
  ]);
}

// ───────────────────────── the cart
const CART = { stopX: 434, pivot: [34, -19], tip: (50 * Math.PI) / 180, wheelR: 8 };
const PIVOT_W = [CART.stopX + CART.pivot[0], GROUND + CART.pivot[1]]; // the bucket's hinge, in the world, once stopped
const rot = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const SEAT0 = [-32, -88]; // where he lies, in the bucket's space: across the heap, head to the back
const SLIDE = 46; // how far down the tipped bucket he slides, px
const slope = [Math.cos(CART.tip), Math.sin(CART.tip)];
const tipped0 = rot(SEAT0, CART.tip);
const HANG = [PIVOT_W[0] + tipped0[0] + SLIDE * slope[0], PIVOT_W[1] + tipped0[1] + SLIDE * slope[1]]; // where he is left in the air
const HANG_ROT = CART.tip - Math.PI / 2;
const LIP_HANG = rot([HANG[0] - PIVOT_W[0], HANG[1] - PIVOT_W[1]], -CART.tip); // the same point, in the bucket's space
const APEX = [HOLE_X, GROUND + ORIGIN_Y * P - 136];
const REST = [HOLE_X, GROUND + ORIGIN_Y * P];

// Ore sits heaped over the rim: rows from the bottom, each filled from the lip back, and it pours in that order.
const SLOTS = [];
[[10, -44.5], [9, -51], [7, -57.5], [4, -64]].forEach(([count, y], row) => {
  for (let c = 0; c < count; c++) SLOTS.push([-3 - row * 3.6 - c * 7.3, y]);
});
const STONE_SLOTS = [[-62, -70], [-48, -72], [-70, -60]];
const ORE_R = 3.3;

function cartXml() {
  const g = 3.2, bucket = [];
  // The bucket's face: a trapezoid of dots, pale rim and walls, darker belly, two rivets.
  for (let y = -40; y <= 0.01; y += g) {
    const t = -y / 40, left = -62 - 10 * t, right = -2 + 10 * t;
    for (let x = left; x <= right + 0.01; x += g) {
      const edge = x - left < g * 0.9 || right - x < g * 0.9 || y > -g * 0.9;
      const rim = y < -40 + g * 1.5;
      bucket.push([x, y, rim ? 1.4 : edge ? 1.3 : 1.05, rim ? 9 : edge ? 7 : (Math.round(x / g) + Math.round(y / g)) % 2 ? 4 : 3]);
    }
  }
  const wheel = (key, x) => {
    const dots = [[0, 0, 1.5, 9]];
    for (let i = 0; i < 8; i++) dots.push([6 * Math.cos((i / 8) * 2 * Math.PI), 6 * Math.sin((i / 8) * 2 * Math.PI), i % 4 === 0 ? 1.5 : 1.2, i % 4 === 0 ? 9 : 6]);
    return node(`Wheel ${key}`, { id: I(key), x, y: -CART.wheelR }, [dotShapes(dots, "wheel"), dotShapes([[0, 0, 7.6, "bg"]], "hub back")]);
  };
  const chassis = [];
  for (let x = -40; x <= 40.01; x += g) { chassis.push([x, -15.2, 1.25, 6]); chassis.push([x, -18.4, 1.0, 4]); }
  const piece = (i) => node(`Ore ${i}`, { id: I(`ore${i}`), x: n2(SLOTS[i][0]), y: n2(SLOTS[i][1]) }, [
    el("TransformConstraint", { id: I(`oreFly${i}`), targetId: I(`oreAim${i}`), strength: 0 }),
    node("Counted", { opacity: i < DEF_ORE ? 1 : 0 }, [
      el("DataBindContext", { sourcePathIds: `${I("vm")}-${I("vmOre")}`, propertyKey: 18, converterId: I(`oreOn${i}`) }),
      node("Fade", { id: I(`oreFade${i}`) }, dotShapes([[0, 0, ORE_R, "green"]], "ore")),
    ]),
  ]);
  const stone = (j) => {
    const lump = [[0, 0, 2.6, 6], [-3.4, 1, 2.1, 5], [3.2, -0.6, 2.2, 7], [0.6, -3.4, 2.0, 8], [-1.6, 3.2, 1.8, 4], [2.6, 2.8, 1.7, 5]];
    return node(`Stone ${j}`, { id: I(`stone${j}`), x: STONE_SLOTS[j][0], y: STONE_SLOTS[j][1] }, [
      el("TransformConstraint", { id: I(`stoneFly${j}`), targetId: I(`stoneAim${j}`), strength: 0 }),
      node("Counted", { opacity: j < DEF_STONES ? 1 : 0 }, [
        el("DataBindContext", { sourcePathIds: `${I("vm")}-${I("vmStones")}`, propertyKey: 18, converterId: I(`stoneOn${j}`) }),
        node("Spin", { id: I(`stoneSpin${j}`) }, [dotShapes(lump, "stone"), backing(lump, 3.2)]),
      ]),
    ]);
  };
  return node("Cart", { id: I("cart"), x: -130, y: GROUND }, [
    wheel("wheelF", 24), wheel("wheelB", -24),
    node("Deck", { id: I("deck"), x: 24, y: -CART.wheelR }, node("Deck offset", { x: -24, y: CART.wheelR }, [
      node("Bucket", { id: I("bucket"), x: CART.pivot[0], y: CART.pivot[1] }, [
        node("Seat", { id: I("seat"), x: SEAT0[0], y: SEAT0[1], rotation: n4(-Math.PI / 2) }, el("TranslationConstraint", { id: I("seatSlide"), targetId: I("lipHang"), strength: 0 })),
        node("LipHang", { id: I("lipHang"), x: n2(LIP_HANG[0]), y: n2(LIP_HANG[1]) }),
        dotShapes(bucket, "bucket"), backing(bucket, 2.4),
        ...Array.from({ length: MAX_STONES }, (_, j) => stone(j)),
        ...Array.from({ length: MAX_ORE }, (_, i) => piece(i)),
      ]),
      dotShapes(chassis, "chassis"), backing(chassis, 2.2),
    ])),
  ]);
}

// ───────────────────────── small things: rail, dirt, Zs, the "!", crumbs
function railXml() {
  const dots = [];
  for (let x = 2; x <= 500; x += 6.4) dots.push([x, 0, 1.0, 3]);
  dots.push([506, 0, 1.4, 5], [506, -3.4, 1.4, 5], [506, -6.8, 1.4, 6]);
  return node("Rail", { id: I("rail"), y: n2(GROUND + 1.2), opacity: 0 }, dotShapes(dots, "rail"));
}
const DIRT_MID = 6;
function dirtXml() {
  const side = [], mid = [];
  for (let i = -16; i <= 16; i++) (Math.abs(i) <= DIRT_MID ? mid : side).push([i * P, 0.09 * P, 0.42 * P, "dirt"]);
  return node("Dirt", { x: HOLE_X, y: GROUND }, [node("Dirt mid", { id: I("dirtMid") }, dotShapes(mid, "dirt")), dotShapes(side, "dirt")]);
}
function zsXml() {
  const z = [[-1, -1], [0, -1], [1, -1], [0, 0], [-1, 1], [0, 1], [1, 1]].map(([x, y]) => [x * 2.5, y * 2.5, 1.0, 7]);
  return node("Zs", { id: I("zs"), x: 0, y: 0 }, [
    el("TranslationConstraint", { targetId: I("zAnchor") }),
    ...[0, 1, 2].map((k) => node(`Z${k}`, { id: I(`z${k}`), opacity: 0 }, dotShapes(z, "z"))),
  ]);
}
function bangXml() {
  const d = [[0, -13.6], [0, -10.2], [0, -6.8], [0, -3.4], [0, 3.4]].map(([x, y]) => [x, y, 1.5, 9]);
  return node("Bang", { id: I("bang"), x: HOLE_X + 40, y: n2(GROUND - 82), rotation: 0.2, opacity: 0 }, dotShapes(d, "bang"));
}
const crumbs = []; // filled by the animations: each gets a node
const crumbXml = () => crumbs.map((c) => node(`Crumb ${c.k}`, { id: c.id, x: n2(c.x0), y: n2(c.y0), opacity: 0 }, dotShapes([[0, 0, c.r, c.tone]], "crumb"))).join("\n");

// ───────────────────────── animations
const EASE = { io: [0.42, 0, 0.58, 1], o: [0.16, 1, 0.3, 1], i: [0.5, 0, 0.9, 0.55], out: [0, 0, 0.58, 1], in: [0.42, 0, 1, 1] };
class Anim {
  constructor(name, duration, { fps = 60, loop = false } = {}) { Object.assign(this, { name, duration, fps, loop, id: newId(), tracks: new Map(), calls: new Map() }); }
  /** keys: [frame, value, ease]. ease: "h" hold, "l" linear, a name in EASE, [x1,y1,x2,y2], {cv:[v1,v2]} a curve through values. */
  k(obj, prop, keys) {
    const id = I(obj), key = `${id}|${prop}`;
    if (!this.tracks.has(key)) this.tracks.set(key, []);
    for (const [f, v, e = "io"] of keys) this.tracks.get(key).push({ f: Math.round(f), v, e });
    return this;
  }
  /** Free fall on one axis between two frames: a parabola, exact, as one curve through values. */
  fall(obj, prop, f0, f1, y0, v0, g, after = "h") {
    const T = (f1 - f0) / this.fps, y1 = y0 + v0 * T + 0.5 * g * T * T, q = y0 + (v0 * T) / 2;
    return this.k(obj, prop, [[f0, y0, { cv: [y0 + (2 / 3) * (q - y0), y1 + (2 / 3) * (q - y1)] }], [f1, y1, after]]);
  }
  call(ev, frame) { const id = I(ev); if (!this.calls.has(id)) this.calls.set(id, []); this.calls.get(id).push(Math.round(frame)); return this; }
  xml() {
    const byObj = new Map();
    for (const [key, keys] of this.tracks) {
      const [id, prop] = key.split("|");
      const sorted = [...keys].sort((a, b) => a.f - b.f).filter((k, i, a) => i === a.length - 1 || a[i + 1].f !== k.f);
      const frames = sorted.map(({ f, v, e }) => {
        const a = { value: n4(v), frame: f };
        if (e === "h") return el("KeyFrameDouble", { ...a, interpolationType: "hold" });
        if (e === "l") return el("KeyFrameDouble", { ...a, interpolationType: "linear" });
        if (e.cv) return el("KeyFrameDouble", { ...a, interpolationType: "cubicValue" }, el("CubicValueInterpolator", { x1: 0.33333334, y1: n4(e.cv[0]), x2: 0.6666667, y2: n4(e.cv[1]) }));
        const c = Array.isArray(e) ? e : EASE[e];
        return el("KeyFrameDouble", { ...a, interpolationType: "cubic" }, el("CubicEaseInterpolator", { x1: c[0], y1: c[1], x2: c[2], y2: c[3] }));
      });
      if (!byObj.has(id)) byObj.set(id, []);
      byObj.get(id).push(el("KeyedProperty", { property: prop }, frames));
    }
    for (const [id, frames] of this.calls) {
      if (!byObj.has(id)) byObj.set(id, []);
      byObj.get(id).push(el("KeyedProperty", { property: "trigger" }, [...new Set(frames)].sort((a, b) => a - b).map((f) => el("KeyFrameCallback", { frame: f }))));
    }
    return el("LinearAnimation", { name: this.name, id: this.id, duration: this.duration, fps: this.fps, loopValue: this.loop ? "loop" : undefined }, [...byObj].map(([id, props]) => el("KeyedObject", { objectId: id }, props)));
  }
  /** Both scales at once. */
  s(obj, keys) { return this.k(obj, "scaleX", keys).k(obj, "scaleY", keys); }
  /** A dot thrown under gravity: appears at f0, lands (and fades) T frames on. */
  crumb(f0, T, x0, y0, vx, vy, g, r = 1.3, tone = "dirt") {
    const c = { k: crumbs.length, id: newId(), x0, y0, r, tone };
    crumbs.push(c);
    ids[`crumb${c.k}`] = c.id;
    const o = `crumb${c.k}`, t = T / this.fps;
    this.k(o, "x", [[f0, x0, "l"], [f0 + T, x0 + vx * t, "h"]]);
    this.fall(o, "y", f0, f0 + T, y0, vy, g);
    this.k(o, "opacity", [[0, 0, "h"], [f0, 1, "h"], [f0 + T - 4, 1, "l"], [f0 + T, 0, "h"]]);
    return this;
  }
}
const deg = (d) => (d * Math.PI) / 180;
const G = 4100; // the mole's gravity, px/s²: cartoon weight

// Asleep: one breath is 54 frames. Belly rises, he bobs, the moustache flutters on the way out, Zs rise.
const BREATH = 54;
function asleep(a, frames, period = BREATH) {
  for (let c = 0; c * period < frames; c++) {
    const f = (t) => Math.min(frames, c * period + t * period);
    a.k("br", "scaleX", [[f(0), 1], [f(0.45), 0.985], [f(1), 1]]).k("br", "scaleY", [[f(0), 1], [f(0.45), 1.045], [f(1), 1]]);
    a.k("bob", "y", [[f(0), 0], [f(0.45), -3], [f(1), 0]]);
    a.k("snoreL", "rotation", [[f(0), 0, "h"], [f(0.5), 0], [f(0.6), 0.3], [f(0.68), 0.08], [f(0.76), 0.3], [f(0.84), 0.1], [f(0.92), 0.24], [f(1), 0]]);
    a.k("snoreR", "rotation", [[f(0), 0, "h"], [f(0.5), 0], [f(0.6), -0.3], [f(0.68), -0.08], [f(0.76), -0.3], [f(0.84), -0.1], [f(0.92), -0.24], [f(1), 0]]);
  }
  // Three Zs, a third of a breath apart. Each track is sampled so a Z that is mid-rise when a timeline starts is where it should be.
  const TR = { x: [[0, 0], [0.5, 9], [0.98, 16]], y: [[0, 0], [0.3, -15], [0.98, -36]], s: [[0, 0.5], [0.98, 1.25]], opacity: [[0, 0], [0.18, 1], [0.7, 1], [0.98, 0]] };
  const val = (bp, t) => { let p = bp[0]; for (const q of bp) { if (q[0] >= t) return p === q ? q[1] : p[1] + ((q[1] - p[1]) * (t - p[0])) / (q[0] - p[0]); p = q; } return bp[0][1]; };
  for (let z = 0; z < 3; z++) {
    const ph = z / 3;
    for (const [prop, bp] of Object.entries(TR)) {
      const ks = [[0, val(bp, ph), "l"], [frames, val(bp, (frames / period + ph) % 1), "h"]];
      for (let c = -1; (c - ph) * period < frames; c++) bp.forEach(([t, v], i) => { const f = Math.round((c + t - ph) * period); if (f > 0 && f < frames) ks.push([f, v, i === bp.length - 1 ? "h" : "l"]); });
      for (let c = 0; (c - ph) * period < frames; c++) { const f = Math.round((c + 1 - ph) * period); if (f > 0 && f < frames) ks.push([f, bp[0][1], "l"]); }
      if (prop === "s") a.s(`z${z}`, ks); else a.k(`z${z}`, prop, ks);
    }
  }
  return a;
}
const sleepingPose = (a) => a
  .k("openL", "opacity", [[0, 0, "h"]]).k("openR", "opacity", [[0, 0, "h"]]).k("shutL", "opacity", [[0, 1, "h"]]).k("shutR", "opacity", [[0, 1, "h"]])
  .k("zs", "opacity", [[0, 1, "h"]]);

const wheelRot = (x) => x / CART.wheelR;
const cartAt = (a, keys) => {
  a.k("cart", "x", keys);
  for (const w of ["wheelF", "wheelB"]) a.k(w, "rotation", keys.map(([f, x, e]) => [f, wheelRot(x), e]));
};

// 1. Roll in, brake, and the bucket is thrown forward (0.9 s).
const A1 = new Anim("Roll in", 54);
{
  const a = A1, X = CART.stopX;
  a.k("cart", "x", [[0, -130, "l"], [26, X - 34, [0.2, 0.7, 0.4, 1]], [33, X + 4, "io"], [39, X]]);
  // The wheels lock at the brake and skid: they stop turning before the cart stops moving.
  for (const w of ["wheelF", "wheelB"]) a.k(w, "rotation", [[0, wheelRot(-130), "l"], [26, wheelRot(X - 34), "h"], [33, wheelRot(X - 34), "io"], [39, wheelRot(X - 38)]]);
  a.k("deck", "rotation", [[0, 0, "h"], [26, 0, "o"], [32, 0.15, "io"], [39, -0.04, "io"], [45, 0.014, "io"], [50, 0]]);
  a.k("bucket", "rotation", [[0, 0, "h"], [28, 0, [0.55, 0, 0.85, 0.6]], [40, CART.tip + deg(11), "io"], [46, CART.tip - deg(5), "io"], [51, CART.tip + deg(2), "io"], [54, CART.tip]]);
  a.k("rail", "opacity", [[0, 0, "l"], [6, 1, "h"]]);
  a.k("moleSeat", "strength", [[0, 1, "h"]]).k("seatSlide", "strength", [[0, 0, "h"]]);
  sleepingPose(a);
  asleep(a, 54);
  // He sleeps through the brake: shoved toward the lip, squashed, belly wobbling, helmet over his brow.
  a.k("seat", "x", [[0, SEAT0[0], "h"], [26, SEAT0[0], "o"], [33, SEAT0[0] + 10, "io"], [41, SEAT0[0] + 6]]);
  a.k("sq", "scaleY", [[0, 1, "h"], [26, 1, "o"], [32, 0.9, "io"], [38, 1.05, "io"], [45, 1]]).k("sq", "scaleX", [[0, 1, "h"], [26, 1, "o"], [32, 1.07, "io"], [38, 0.97, "io"], [45, 1]]);
  a.k("body", "scaleX", [[0, 1, "h"], [28, 1, "o"], [33, 1.08, "io"], [38, 0.96, "io"], [43, 1.03, "io"], [48, 1]]);
  a.k("helm", "y", [[0, 0, "h"], [27, 0, "o"], [32, 4, "io"], [40, 1.5]]).k("helm", "rotation", [[0, 0, "h"], [27, 0, "o"], [33, 0.12, "io"], [42, 0.05]]);
  a.k("head", "rotation", [[0, -0.06, "h"], [27, -0.06, "o"], [33, 0.1, "io"], [42, -0.02, "io"], [54, 0.03]]);
  a.k("armL", "rotation", [[0, -1.0, "h"], [28, -1.0, "o"], [34, -1.3, "io"], [42, -0.9]]).k("armR", "rotation", [[0, 1.0, "h"], [28, 1.0, "o"], [34, 1.45, "io"], [44, 0.5, "io"], [54, 0.3]]);
  a.k("footL", "rotation", [[0, 0.25, "h"], [28, 0.25, "o"], [34, -0.4, "io"], [42, 0.3, "io"], [50, 0.2]]).k("footR", "rotation", [[0, -0.25, "h"], [28, -0.25, "o"], [35, -0.7, "io"], [43, 0.1, "io"], [51, -0.2]]);
  // Sparks off the locked wheels.
  for (let s = 0; s < 6; s++) {
    const wx = (s % 2 ? 24 : -24), f0 = 27 + (s >> 1) * 2;
    a.crumb(f0, 11 + s, X - 30 + (f0 - 27) * 5 + wx, GROUND - 1, 150 + s * 28, -150 - ((s * 53) % 110), 1900, 1.0, 9);
  }
}

// 2. The pour: he slides down the tipped bucket, slowly, then not. One second long; the state plays it faster for less ore.
const A2 = new Anim("Pour", 60);
{
  const a = A2, t = CART.tip;
  a.k("bucket", "rotation", [[0, t], [9, t + deg(1.4)], [18, t - deg(1.1)], [27, t + deg(1)], [36, t - deg(0.8)], [45, t + deg(0.5)], [54, t]]);
  a.k("moleSeat", "strength", [[0, 1, "h"]]);
  a.k("seat", "x", [[0, SEAT0[0] + 6, "h"]]);
  a.k("seatSlide", "strength", [[0, 0, [0.62, 0, 0.95, 0.45]], [57, 1, "h"]]);
  a.k("cart", "x", [[0, CART.stopX, "h"]]).k("deck", "rotation", [[0, 0, "h"]]).k("rail", "opacity", [[0, 1, "h"]]);
  sleepingPose(a);
  asleep(a, 60, 60);
  a.k("helm", "y", [[0, 1.5, "h"]]).k("helm", "rotation", [[0, 0.05, "h"]]);
  a.k("head", "rotation", [[0, 0.03], [60, 0.14]]);
  a.k("armL", "rotation", [[0, -0.9], [24, -1.0, "in"], [40, -0.15, "io"], [52, -0.4, "io"], [60, -0.25]]).k("armR", "rotation", [[0, 0.3], [40, 0.45, "io"], [60, 0.2]]);
  a.k("footL", "rotation", [[0, 0.2], [44, 0.1, "in"], [57, -0.35, "io"], [60, -0.2]]).k("footR", "rotation", [[0, -0.2], [44, -0.1, "in"], [57, 0.3, "io"], [60, 0.2]]);
  a.k("sq", "scaleY", [[0, 1, "h"], [48, 1, "in"], [57, 1.07, "h"]]).k("sq", "scaleX", [[0, 1, "h"], [48, 1, "in"], [57, 0.95, "h"]]);
}

// 3. The stones drop, the bucket falls back, the cart backs out. He stays where he was, on nothing (1.35 s).
const A3 = new Anim("Left hanging", 81);
{
  const a = A3, t = CART.tip, X = CART.stopX;
  a.k("moleSeat", "strength", [[0, 0, "h"]]);
  a.k("mole", "x", [[0, HANG[0], "h"]]).k("mole", "y", [[0, HANG[1], "h"]]).k("mole", "rotation", [[0, HANG_ROT, "h"]]);
  a.k("bucket", "rotation", [[0, t, "h"], [3, t, [0.6, 0, 1, 0.7]], [12, deg(-7), "io"], [17, deg(3), "io"], [22, 0]]);
  a.k("deck", "rotation", [[0, 0, "h"], [11, 0, "o"], [15, -0.06, "io"], [20, 0.02, "io"], [25, 0]]);
  a.k("cart", "x", [[0, X, "h"], [16, X, "io"], [23, X + 6, [0.5, 0, 1, 0.6]], [50, -140, "h"]]);
  for (const w of ["wheelF", "wheelB"]) a.k(w, "rotation", [[0, wheelRot(X - 38), "h"], [16, wheelRot(X - 38), "io"], [23, wheelRot(X - 32), [0.5, 0, 1, 0.6]], [50, wheelRot(-140 - 38), "h"]]);
  a.k("rail", "opacity", [[0, 1, "h"], [48, 1, "l"], [60, 0, "h"]]);
  sleepingPose(a);
  asleep(a, 81, 40.5);
  // The arrival at the lip rings on through him: a settle, limbs swinging to rest.
  a.k("sq", "scaleY", [[0, 1.07, "o"], [6, 0.95, "io"], [13, 1.02, "io"], [20, 1]]).k("sq", "scaleX", [[0, 0.95, "o"], [6, 1.04, "io"], [13, 0.99, "io"], [20, 1]]);
  a.k("body", "scaleX", [[0, 1, "o"], [5, 1.06, "io"], [11, 0.97, "io"], [17, 1.02, "io"], [23, 1]]);
  a.k("helm", "y", [[0, 1.5, "o"], [5, 4.5, "io"], [12, 1, "io"], [18, 2]]).k("helm", "rotation", [[0, 0.05, "h"]]);
  a.k("head", "rotation", [[0, 0.14, "io"], [10, 0.2, "io"], [26, 0.15]]);
  a.k("armL", "rotation", [[0, -0.25, "io"], [9, 0.22, "io"], [20, -0.1, "io"], [31, 0.05, "io"], [42, 0]]).k("armR", "rotation", [[0, 0.2, "io"], [10, 0.5, "io"], [21, 0.3, "io"], [32, 0.4]]);
  a.k("footL", "rotation", [[0, -0.2, "io"], [8, 0.3, "io"], [18, -0.12, "io"], [28, 0.06, "io"], [38, 0]]).k("footR", "rotation", [[0, 0.2, "io"], [9, 0.45, "io"], [19, 0.1, "io"], [29, 0.26, "io"], [39, 0.2]]);
  for (let j = 0; j < MAX_STONES; j++) {
    const L = 2 + j * 5, T = 27, h = 58;
    a.k(`stoneFly${j}`, "strength", [[0, 0, "h"], [L, 0, "l"], [L + T, 1, "h"]]);
    a.k(`stoneAimIn${j}`, "y", [[0, -4 * h, "h"], [L, -4 * h, "l"], [L + T, 0, "h"]]);
    a.k(`stoneSpin${j}`, "rotation", [[0, 0, "h"], [L, 0, "l"], [L + T, 5.2, "h"]]);
    a.k(`stoneSpin${j}`, "opacity", [[0, 1, "h"], [L + T + 3, 0, "h"]]);
    a.s(`stoneSpin${j}`, [[0, 1, "h"], [L + T, 1.3, "o"], [L + T + 3, 1, "h"]]);
    a.call("evStone", L + T);
  }
}

// 4. He wakes, runs on nothing, dives into his hole, and pops up as if nothing happened.
const A4 = new Anim("Wake and dive", 190);
const T_KNOCK = 46, T_POP = 73, T_SETTLED = 100, T_SPEAK = 160;
{
  const a = A4, [hx, hy] = HANG, [ax, ay] = APEX, [rx, ry] = REST;
  a.k("moleSeat", "strength", [[0, 0, "h"]]).k("rail", "opacity", [[0, 0, "h"]]).k("cart", "x", [[0, -140, "h"]]);
  // The breath he was on stops; the brace.
  a.k("br", "scaleX", [[0, 1, "h"]]).k("br", "scaleY", [[0, 1, "h"]]).k("bob", "y", [[0, 0, "h"]]);
  a.k("snoreL", "rotation", [[0, 0, "h"]]).k("snoreR", "rotation", [[0, 0, "h"]]);
  a.k("zs", "opacity", [[0, 1, "l"], [5, 0, "h"]]).s("zs", [[0, 1, "o"], [5, 1.5, "h"]]);
  a.k("sq", "scaleY", [[0, 1, "o"], [6, 0.86, "o"], [11, 1.2, "io"], [18, 0.96, "io"], [23, 1.03, "io"], [28, 1]]);
  a.k("sq", "scaleX", [[0, 1, "o"], [6, 1.1, "o"], [11, 0.88, "io"], [18, 1.03, "io"], [23, 0.98, "io"], [28, 1]]);
  // Eyes: shut, then very open.
  for (const s of ["L", "R"]) {
    a.k(`shut${s}`, "opacity", [[0, 1, "h"], [6, 0, "h"], [118, 1, "h"], [123, 0, "h"]]).k(`open${s}`, "opacity", [[0, 0, "h"], [6, 1, "h"], [118, 0, "h"], [123, 1, "h"]]);
    a.s(`eye${s}`, [[0, 1, "h"], [6, 1.7, "o"], [12, 1.45, "h"], [54, 1.45, "h"], [T_POP, 1.6, "h"], [T_POP + 22, 1.6, "io"], [T_POP + 30, 1, "h"]]);
  }
  const eyeY = (s, base) => a.k(`eye${s}`, "y", [[0, base, "h"], [21, base, "io"], [25, base + 1.1 * P, "h"], [54, base, "h"]]);
  eyeY("L", inHead(-4.4, -12.6).y); eyeY("R", inHead(5.6, -12.6).y);
  // Up and over the hole: thrown up, no gravity until he looks down.
  a.k("mole", "x", [[0, hx, "h"], [6, hx, [0.2, 0.6, 0.5, 1]], [18, ax, "h"], [19, ax - 1.6, "h"], [21, ax + 1.6, "h"], [23, ax - 1.6, "h"], [25, ax + 1.6, "h"], [27, ax - 1.2, "h"], [29, ax, "h"]]);
  a.k("mole", "y", [[0, hy, "o"], [6, hy + 4, "h"]]);
  const gl = (2 * (hy + 4 - ay)) / 0.04; // thrown so that he stops dead at the top, 0.2 s later
  a.fall("mole", "y", 6, 18, hy + 4, -gl * 0.2, gl, "io");
  a.k("mole", "y", [[30, ay, "o"], [34, ay - 9, "h"]]);
  a.k("mole", "rotation", [[0, HANG_ROT, "h"], [6, HANG_ROT, "o"], [14, 0.14, "io"], [19, -0.04, "io"], [24, 0, "h"], [30, 0, [0.5, 0, 0.5, 1]], [41, Math.PI, "h"]]);
  // Limbs running on nothing.
  const run = (o, f0, f1, step, a0, a1) => { const ks = []; for (let f = f0, i = 0; f <= f1; f += step, i++) ks.push([f, i % 2 ? a1 : a0, "io"]); return ks; };
  a.k("footL", "rotation", [[0, 0, "o"], [8, 0.5, "io"], ...run("footL", 13, 31, 3, 0.95, -0.95), [36, 0.15, "h"]]);
  a.k("footR", "rotation", [[0, 0.2, "o"], [8, -0.5, "io"], ...run("footR", 13, 31, 3, -0.95, 0.95), [36, -0.15, "h"]]);
  a.k("armL", "rotation", [[0, 0, "o"], [9, 2.5, "io"], ...run("armL", 13, 29, 4, 2.7, 1.5), [31, 2.2, "io"], [38, 3.43, "h"], [56, 0, "h"]]);
  a.k("armR", "rotation", [[0, 0.4, "o"], [9, -2.5, "io"], ...run("armR", 15, 31, 4, -2.7, -1.5), [33, -2.2, "io"], [38, -3.43, "h"], [56, 0, "h"]]);
  a.k("lobeL", "rotation", [[0, 0, "h"], [6, 0, "o"], [10, 0.55, "io"], [17, 0.1, "io"], [22, 0.25, "io"], [30, 0.1, "io"], [38, 0.5, "io"], [42, 0.3, "io"], [46, 0.55, "h"], [56, 0, "h"], [T_POP + 5, 0, "o"], [T_POP + 9, -0.35, "io"], [T_POP + 16, 0.2, "io"], [T_POP + 23, -0.06, "io"], [T_POP + 29, 0]]);
  a.k("lobeR", "rotation", [[0, 0, "h"], [6, 0, "o"], [10, -0.55, "io"], [17, -0.1, "io"], [22, -0.25, "io"], [30, -0.1, "io"], [38, -0.5, "io"], [42, -0.3, "io"], [46, -0.55, "h"], [56, 0, "h"], [T_POP + 5, 0, "o"], [T_POP + 9, 0.35, "io"], [T_POP + 16, -0.2, "io"], [T_POP + 23, 0.06, "io"], [T_POP + 29, 0]]);
  // The helmet is the last to hear about anything.
  a.k("helm", "y", [[0, 2, "h"], [6, 2, "o"], [10, 7, "io"], [17, -9, "in"], [23, 2.5, "io"], [27, 0, "h"], [30, 0, "io"], [35, -4, "io"], [44, 3, "h"], [56, 4, "h"], [T_POP, 4, "o"], [T_POP + 6, 7, "io"], [T_POP + 12, -10, "in"], [T_POP + 20, 2, "io"], [T_POP + 24, 0]]);
  a.k("helm", "rotation", [[0, 0.05, "h"], [6, 0.05, "o"], [17, -0.22, "io"], [24, 0.1, "io"], [30, 0.04, "h"], [56, 0.1, "h"], [T_POP + 6, 0.1, "io"], [T_POP + 12, 0.34, "io"], [T_POP + 20, 0.2, "io"], [T_POP + 24, 0.24, "h"], [134, 0.24, "io"], [141, -0.06, "io"], [147, 0]]);
  a.k("helm", "x", [[0, 0, "h"], [T_POP + 12, 0, "io"], [T_POP + 20, 4, "h"], [134, 4, "io"], [141, -0.6, "io"], [147, 0]]);
  a.k("head", "rotation", [[0, 0.15, "o"], [8, -0.12, "io"], [16, 0.06, "io"], [22, 0, "io"], [27, 0.1, "h"], [34, 0, "h"]]);
  a.k("body", "scaleX", [[0, 1, "h"], [18, 1, "o"], [21, 1.05, "io"], [24, 0.97, "io"], [27, 1.03, "io"], [30, 1, "h"]]);
  // The dive: a tuck, then gravity, head first. Arms out in front, stretched along the fall.
  a.fall("mole", "y", 34, 56, ay - 9, 0, G, "h");
  a.k("sq", "scaleY", [[30, 1, "o"], [34, 0.88, "in"], [46, 1.2, "h"], [56, 1, "h"]]).k("sq", "scaleX", [[30, 1, "o"], [34, 1.09, "in"], [46, 0.87, "h"], [56, 1, "h"]]);
  a.k("footL", "rotation", [[36, 0.15, "io"], [47, 0.1, "io"], [50, 0.9, "io"], [53, -0.7, "io"], [56, 0, "h"]]).k("footR", "rotation", [[36, -0.15, "io"], [47, -0.1, "io"], [50, -0.9, "io"], [53, 0.7, "io"], [56, 0, "h"]]);
  // The hit: the host is told (the ring is the page's), dirt flies, the dirt line gives.
  a.call("evKnock", T_KNOCK);
  for (let c = 0; c < 14; c++) {
    const side = c % 2 ? 1 : -1, u = ((c * 37) % 14) / 14;
    a.crumb(T_KNOCK + (c % 3), 20 + ((c * 5) % 9), HOLE_X + side * (8 + u * 30), GROUND - 2, side * (60 + u * 190), -330 - ((c * 71) % 260), 2300, 1.1 + (c % 3) * 0.35, c % 4 === 0 ? 7 : "dirt");
  }
  a.k("dirtMid", "y", [[0, 0, "h"], [T_KNOCK, 0, "o"], [T_KNOCK + 3, 4.5, "io"], [T_KNOCK + 8, -2, "io"], [T_KNOCK + 13, 1, "io"], [T_KNOCK + 18, 0, "h"], [T_POP, 0, "o"], [T_POP + 3, -4, "io"], [T_POP + 9, 1.5, "io"], [T_POP + 14, 0]]);
  a.crumb(62, 14, HOLE_X + 26, GROUND - 60, 4, 0, 2300, 1.2, "dirt"); // one that went higher than the rest
  // The empty beat (0.3 s), then up he pops: upright, wide-eyed, helmet late and askew.
  a.k("mole", "rotation", [[56, 0, "h"]]).k("mole", "x", [[56, rx, "h"]]);
  a.k("mole", "y", [[57, ry + 78, "h"], [T_POP, ry + 78, [0.1, 0.75, 0.3, 1]], [T_POP + 6, ry - 13, "io"], [T_POP + 13, ry + 3.5, "io"], [T_POP + 19, ry - 1, "io"], [T_POP + 24, ry]]);
  a.k("sq", "scaleY", [[T_POP, 1.16, "h"], [T_POP + 5, 1.16, "io"], [T_POP + 12, 0.92, "io"], [T_POP + 18, 1.03, "io"], [T_POP + 24, 1]]).k("sq", "scaleX", [[T_POP, 0.9, "h"], [T_POP + 5, 0.9, "io"], [T_POP + 12, 1.06, "io"], [T_POP + 18, 0.98, "io"], [T_POP + 24, 1]]);
  a.k("armL", "rotation", [[T_POP, 0.5, "h"], [T_POP + 7, 0.5, "io"], [T_POP + 14, -0.14, "io"], [T_POP + 20, 0.04, "io"], [T_POP + 25, 0]]).k("armR", "rotation", [[T_POP, -0.5, "h"], [T_POP + 8, -0.5, "io"], [T_POP + 15, 0.14, "io"], [T_POP + 21, -0.04, "io"], [T_POP + 26, 0]]);
  a.call("evKnock", T_POP + 1);
  for (let c = 0; c < 7; c++) { const side = c % 2 ? 1 : -1; a.crumb(T_POP + 1 + (c % 2), 15 + c * 2, HOLE_X + side * (20 + c * 4), GROUND - 2, side * (50 + c * 30), -210 - c * 28, 2300, 1.0 + (c % 2) * 0.4, "dirt"); }
  a.k("bang", "opacity", [[0, 0, "h"], [T_POP + 4, 1, "h"], [T_POP + 36, 1, "l"], [T_POP + 42, 0, "h"]]).s("bang", [[T_POP + 4, 0.2, "o"], [T_POP + 8, 1.3, "io"], [T_POP + 13, 1, "h"]]).k("bang", "y", [[T_POP + 4, GROUND - 76, "o"], [T_POP + 8, GROUND - 86, "io"], [T_POP + 13, GROUND - 82]]);
  // Nothing to see here: a look left, a look right, a blink, and the helmet is straightened.
  const ex = (s, base) => a.k(`eye${s}`, "x", [[0, base, "h"], [T_POP + 30, base, "io"], [T_POP + 35, base - 0.9 * P, "h"], [T_POP + 46, base - 0.9 * P, "io"], [T_POP + 52, base + 0.9 * P, "h"], [T_POP + 62, base + 0.9 * P, "io"], [T_POP + 67, base]]);
  ex("L", inHead(-4.4, 0).x); ex("R", inHead(5.6, 0).x);
  a.call("evSettled", T_SETTLED).call("evSpeak", T_SPEAK);
}

// 5. Rest: he blinks now and then.
const A5 = new Anim("At rest", 240, { loop: true });
for (const s of ["L", "R"]) A5.k(`shut${s}`, "opacity", [[0, 0, "h"], [150, 1, "h"], [155, 0, "h"]]).k(`open${s}`, "opacity", [[0, 1, "h"], [150, 0, "h"], [155, 1, "h"]]);

// The ore's own layer, at 120 fps so each piece leaves 1/24 s after the last. A piece is blended from where it
// lies in the bucket to the place the page gave it; the place's aim point starts 4h high and falls to it at a
// steady rate, which makes the blend an exact parabola: one gravity for every piece, whatever its target.
const WAIT = new Anim("Ore waits", 54);
const FL = new Anim("Ore flies", 0, { fps: 120 });
const STEP = 5, FLIGHT = 50, ARC = 46, RING_SCALE = RING.r / ORE_R;
for (let i = 0; i < MAX_ORE; i++) {
  const L = i * STEP, E = L + FLIGHT;
  FL.k(`oreFly${i}`, "strength", [[0, 0, "h"], [L, 0, "l"], [E, 1, "h"]]);
  FL.k(`oreAimIn${i}`, "y", [[0, -4 * ARC, "h"], [L, -4 * ARC, "l"], [E, 0, "h"]]);
  FL.k(`oreAimIn${i}`, "scaleX", [[0, RING_SCALE, "h"], [E, RING_SCALE * 1.4, "o"], [E + 9, RING_SCALE * 0.92, "io"], [E + 18, RING_SCALE]]);
  FL.k(`oreAimIn${i}`, "scaleY", [[0, RING_SCALE, "h"], [E, RING_SCALE * 0.62, "o"], [E + 9, RING_SCALE * 1.07, "io"], [E + 18, RING_SCALE]]);
  FL.k(`oreFade${i}`, "opacity", [[0, 1, "h"], [E + 26, 0, "h"]]);
  FL.call("evLand", E);
}
FL.duration = (MAX_ORE - 1) * STEP + FLIGHT + 30;

// ───────────────────────── the view model, the targets, the state machine
const ringDot = (i) => { const a = (i / RING.n) * 2 * Math.PI - Math.PI / 2; return [RING.cx + RING.R * Math.cos(a), RING.cy + RING.R * Math.sin(a)]; };
const gemPlace = (j) => [RING.cx + (j - (DEF_STONES - 1) / 2) * 60, RING.cy];
const vmProps = [], vmVals = [], targets = [], converters = [];
const num = (key, name, value) => { vmProps.push(el("ViewModelPropertyNumber", { name, id: I(key) })); vmVals.push(el("ViewModelInstanceNumber", { propertyValue: n2(value), viewModelPropertyId: I(key) })); };
num("vmOre", "ore", DEF_ORE);
num("vmStones", "stones", DEF_STONES);
const target = (kind, i, [x, y], scale) => {
  num(`${kind}X${i}`, `${kind}${i}x`, x); num(`${kind}Y${i}`, `${kind}${i}y`, y);
  targets.push(node(`${kind} target ${i}`, { x: n2(x), y: n2(y) }, [
    el("DataBindContext", { sourcePathIds: `${I("vm")}-${I(`${kind}X${i}`)}`, propertyKey: 13 }),
    el("DataBindContext", { sourcePathIds: `${I("vm")}-${I(`${kind}Y${i}`)}`, propertyKey: 14 }),
    node("Aim", { id: I(`${kind}Aim${i}`) }, node("Aim in", { id: I(`${kind}AimIn${i}`), scaleX: scale, scaleY: scale })),
  ]));
  converters.push(el("DataConverterRangeMapper", { id: I(`${kind}On${i}`), name: `${kind} ${i} counted`, minInput: i, maxInput: i + 1, minOutput: 0, maxOutput: 1, clampLower: "true", clampUpper: "true" }));
};
for (let i = 0; i < MAX_ORE; i++) target("ore", i, ringDot(i), n4(RING_SCALE));
for (let j = 0; j < MAX_STONES; j++) target("stone", j, gemPlace(j), 1);
// The constraint must follow the inner aim node (the one that is keyed), so point at it.
for (let i = 0; i < MAX_ORE; i++) ids[`oreAim${i}`] = ids[`oreAimIn${i}`];
for (let j = 0; j < MAX_STONES; j++) ids[`stoneAim${j}`] = ids[`stoneAimIn${j}`];

const mole = moleXml(), cart = cartXml();

// How long the pour lasts for each amount of ore: the last piece has left, and a breath.
const pourSeconds = (n) => Math.max(0.45, (n * STEP) / 120 + 0.12);
const BANDS = [6, 12, 18, 24, 30];
const sm = (() => {
  const s = { roll: newId(), hang: newId(), wake: newId(), rest: newId(), wait: newId(), fly: newId() };
  const pours = BANDS.map(() => newId());
  const after = (to) => el("StateTransition", { stateToId: to, enableExitTime: "true", exitTimeIsPercetange: "true", exitTime: 100 });
  const cmp = (op, v) => el("TransitionViewModelCondition", { opValue: op }, [
    el("TransitionPropertyViewModelComparator", {}, el("BindablePropertyNumber", {}, el("DataBindContext", { sourcePathIds: `${I("vm")}-${I("vmOre")}`, propertyKey: 636 }))),
    el("TransitionValueNumberComparator", { value: v }),
  ]);
  const toPour = BANDS.map((hi, b) => el("StateTransition", { stateToId: pours[b], enableExitTime: "true", exitTimeIsPercetange: "true", exitTime: 100 }, [b > 0 ? cmp("greaterThan", BANDS[b - 1]) : "", b < BANDS.length - 1 ? cmp("lessThanOrEqual", hi) : ""]));
  return el("StateMachine", { name: "Cart ending", id: I("sm") }, [
    el("StateMachineLayer", { name: "Scene" }, [
      el("AnyState", { x: 0, y: -120 }), el("ExitState", { x: 1200, y: -120 }),
      el("EntryState", { x: 0, y: 0 }, el("StateTransition", { stateToId: s.roll })),
      el("AnimationState", { id: s.roll, animationId: A1.id, x: 160, y: 0 }, toPour),
      ...BANDS.map((hi, b) => el("AnimationState", { id: pours[b], animationId: A2.id, speed: n4(1 / pourSeconds(hi)), x: 360, y: b * 80 }, after(s.hang))),
      el("AnimationState", { id: s.hang, animationId: A3.id, x: 560, y: 0 }, after(s.wake)),
      el("AnimationState", { id: s.wake, animationId: A4.id, x: 760, y: 0 }, after(s.rest)),
      el("AnimationState", { id: s.rest, animationId: A5.id, x: 960, y: 0 }),
    ]),
    el("StateMachineLayer", { name: "Ore" }, [
      el("AnyState", { x: 0, y: 380 }), el("ExitState", { x: 1200, y: 380 }),
      el("EntryState", { x: 0, y: 500 }, el("StateTransition", { stateToId: s.wait })),
      el("AnimationState", { id: s.wait, animationId: WAIT.id, x: 160, y: 500 }, after(s.fly)),
      el("AnimationState", { id: s.fly, animationId: FL.id, x: 360, y: 500 }),
    ]),
  ]);
})();

const stage = () => {
  if (!STAGE && !BGONLY) return "";
  const dots = BGONLY ? [] : Array.from({ length: RING.n }, (_, i) => [...ringDot(i), RING.r * 0.7, "3A3B3E"]);
  return [dots.length ? dotShapes(dots, "stage ring") : "", el("Shape", { name: "stage bg" }, [`<Rectangle x="${W / 2}" y="${H / 2}" width="${W}" height="${H}"/>`, `<Fill><SolidColor colorValue="FF${BG}"/></Fill>`])].join("\n");
};

const out = `<Rive version="1" kind="fragment">
${el("Artboard", { name: "CartEnding", id: I("artboard"), width: W * X2, height: H * X2, defaultStateMachineId: I("sm"), viewModelId: I("vm"), styleId: I("style") }, [
  el("LayoutComponentStyle", { name: "Artboard Style", id: I("style") }),
  sm,
  ...["land:evLand", "stoneLand:evStone", "knock:evKnock", "settled:evSettled", "speak:evSpeak"].map((s) => el("Event", { name: s.split(":")[0], id: I(s.split(":")[1]) })),
  node("Scene", { scaleX: X2, scaleY: X2 }, [
    bangXml(), zsXml(), crumbXml(), dirtXml(), mole, cart, railXml(),
    ...targets,
    el("Shape", { name: "Above the dirt", id: I("holeClip") }, `<Rectangle x="${W / 2}" y="${n2(FLOOR - 500)}" width="${W + 400}" height="1000"/>`),
    stage(),
  ]),
  ...[A1, A2, A3, A4, A5, WAIT, FL].map((a) => a.xml()),
])}
${converters.join("\n")}
${el("ViewModel", { name: "CartEnding", id: I("vm"), defaultInstanceId: I("vmi") }, [...vmProps, el("ViewModelInstance", { name: "Default", id: I("vmi"), exports: "true" }, vmVals)])}
</Rive>
`;
fs.mkdirSync(path.join(HERE, "rive"), { recursive: true });
fs.writeFileSync(path.join(HERE, "rive/scene.rml"), out);
fs.writeFileSync(path.join(HERE, "rive/rive.yaml"), "name: cart-ending\n");
// What the page needs to know to play its part.
fs.writeFileSync(path.join(HERE, "rive/timing.json"), JSON.stringify({ W, H, RING, GROUND, P, pourSeconds: Object.fromEntries(BANDS.map((b) => [b, pourSeconds(b)])), rollIn: 54 / 60, hang: 81 / 60, wake: { knock: T_KNOCK / 60, pop: (T_POP + 1) / 60, settled: T_SETTLED / 60, speak: T_SPEAK / 60, total: 190 / 60 }, ore: { step: STEP / 120, flight: FLIGHT / 120 }, stone: { first: 2 / 60, step: 5 / 60, flight: 27 / 60 } }, null, 1));
console.log(`scene.rml ${(out.length / 1024).toFixed(0)} KB, ${nid - 100} ids, ${crumbs.length} crumbs`);
