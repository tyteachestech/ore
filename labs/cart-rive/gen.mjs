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
const NOSE = [0, 1].map((k) => { const a = PARTS.nose; let t = 0; for (let i = k; i < a.length; i += 4) t += a[i]; return t / (a.length / 4); });
/** My own dots on his grid: [x, y, r, tone] given in dots, around a pivot. */
const mine = (list, px = 0, py = ORIGIN_Y) => list.map(([x, y, r, t]) => [(x - px) * P, (y - py) * P, r * P, t]);
const at = (px, py) => ({ x: n2(px * P), y: n2((py - ORIGIN_Y) * P) }); // a pivot, in the root's space
const HEAD = [0, -1]; // where the head turns
const inHead = (px, py) => ({ x: n2((px - HEAD[0]) * P), y: n2((py - HEAD[1]) * P) });

// The body the rest drawing never shows, as the app draws it whole (mole-fine.ts, `s.whole`): a stout torso, a pale
// belly, short legs with flat feet, and arms that hang from the shoulder. Each part is its own set of dots so it can turn.
const seg = (x, y, x1, y1, x2, y2, r) => { const dx = x2 - x1, dy = y2 - y1, t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy))); return Math.hypot(x - x1 - dx * t, y - y1 - dy * t) - r; };
const oval = (x, y, cx, cy, rx, ry) => (Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * Math.min(rx, ry);
/** Dots of the first shape a point is in; a dark dot where a shape ends over one below it. fns: [distance, tone(x, y), group]. */
function carve(fns, x0, x1, y0, y1, noRim = []) {
  const out = {};
  for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
    const x = i + 0.07, y = j - 0.02, d = fns.map(([f]) => f(x, y));
    for (let n = 0; n < fns.length; n++) {
      let tone;
      if (d[n] < 0) tone = fns[n][1](x, y);
      else if (!noRim.includes(n) && d[n] < 0.8) for (let m = n + 1; m < fns.length; m++) if (d[m] < -0.4) { tone = 2; break; }
      if (tone !== undefined) { (out[fns[n][2]] ??= []).push([x, y, 0.4, tone]); break; }
    }
  }
  return out;
}
const SHOULDER = [9.5, 2.5], HIP = [5, 16], ARM_HANG = 2.09; // the arm is drawn raised, as he falls; at rest it hangs, turned this far
const FRONT = carve([
  [(x, y) => oval(Math.abs(x), y, 0, 11, 7.6, 6.4), () => 7, "belly"],
  [(x, y) => (x < 0 ? oval(-x, y, 8, 23, 3.5, 2.3) : 9), () => 9, "legL"],
  [(x, y) => (x > 0 ? oval(x, y, 8, 23, 3.5, 2.3) : 9), () => 9, "legR"],
  [(x, y) => (x < 0 ? seg(-x, y, 5, 16, 6.4, 21.5, 2.9) : 9), () => 4, "legL"],
  [(x, y) => (x > 0 ? seg(x, y, 5, 16, 6.4, 21.5, 2.9) : 9), () => 4, "legR"],
  [(x, y) => Math.min(oval(Math.abs(x), y, 0, 11.5, 13, 8.6), oval(Math.abs(x), y, 0, 5, 11.6, 7)), (x, y) => (y > 16 ? 4 : 5), "torso"],
], -24, 24, -3, 26, [0]);
const ARM = carve([
  [(x, y) => oval(x, y, 21, -11, 3, 3), () => 9, "arm"],
  [(x, y) => Math.min(seg(x, y, 9.5, 2.5, 16, -3, 2.5), seg(x, y, 16, -3, 21, -11, 2.3)), () => 4, "arm"],
], 5, 26, -16, 7).arm.map(([x, y, r, t]) => { const dx = x - SHOULDER[0], dy = y - SHOULDER[1], c = Math.cos(ARM_HANG), n = Math.sin(ARM_HANG); return [dx * c - dy * n, dx * n + dy * c, r, t]; });

const ids = {};
const I = (k) => (ids[k] ??= newId());

// Asleep he is the app's own side view (mole-fine.ts `sideDots`): drawn standing in profile, facing right (x forward,
// y down), then laid on his back: helmet tipped over his eyes, a lobe of the moustache on his chest, a paw behind
// his head, a belly like a hill and two flat feet. Shown smaller on the cart, as the app shows him.
const LY_SCALE = 0.45, NEAR = 0.72; // the app's sizes: asleep on the cart, and awake in the air before he grows into his spot
const turn = (x, y, a, px, py) => { const c = Math.cos(a), n = Math.sin(a); return [px + (x - px) * c - (y - py) * n, py + (x - px) * n + (y - py) * c]; };
const raw = (name, tone) => { const a = PARTS[name], out = []; for (let i = 0; i < a.length; i += 4) out.push([a[i], a[i + 1], a[i + 2], tone ?? grey(a[i + 3])]); return out; };
const SIDE = carve([
  [(x, y) => seg(x, y, 0.5, 23.2, 10.5, 23.2, 2.7), () => 9, "feet"],
  [(x, y) => oval(x, y, 10.6, 9, 6.6, 8.4), () => 7, "body"],
  [(x, y) => oval(x, y, -8, -18.5, 2.6, 3), () => 9, "arm"],
  [(x, y) => seg(x, y, -2.5, 1.5, -9, -14.5, 2.6), () => 5, "arm"],
  [(x, y) => oval(x, y, 10.6, -7.6, 3.6, 3.2), () => 5, "head"],
  [(x, y) => oval(x, y, 0, -10, 11.2, 11), () => 5, "head"],
  [(x, y) => oval(x, y, 2.8, 8.5, 14, 12.6), (x) => (x < -5 ? 4 : 5), "body"],
  [(x, y) => seg(x, y, 4.5, 24.6, 14, 24.6, 2.5), () => 7, "feet"],
], -14, 28, -27, 30, [1, 4]);
SIDE.hat = [...raw("lamp", "lamp").map(([x, y, r, t]) => [...turn(x + 7.5, y + 0.6, 0.42, 0, -10), r, t]), ...raw("helmet").map(([x, y, r, t]) => [...turn(x + 1.5, y, 0.42, 0, -10), r, t])];
SIDE.nose = raw("nose", "nose").map(([x, y, r, t]) => [13.6 + x, -8.2 + y + 10, r, t]);
SIDE.lobe = raw("lobeL").map(([x, y, r, t]) => [...turn(x + 0.9 + 11.2, y + 10.4 - 6.6, 0.25, 11.2, -6.6), r, t]);
const lyAt = (px, py) => ({ x: n2(px * P), y: n2(py * P) });
const LY_NOSE = [-9.5 * LY_SCALE, -27 * LY_SCALE]; // just over his nose, from the side view's own point
const LY_AT = [-22, 22]; // where the side view sits, from the front view's root
const HELM_PIVOT = [0, -15.5];
/** His head, from the traced drawing: eyes, helmet and lamp, nose, the two halves of the moustache, fur. p prefixes the ids. */
function headKids(p = "", shut = false, neckless = false) {
  const eye = (s, cx, cy) => {
    const open = [...part(`eye${s}`, "eye", cx, cy), ...part(`glint${s}`, "glint", cx, cy)];
    const lid = mine([[-1.05, 0.25, 0.3, "eye"], [-0.35, 0.6, 0.33, "eye"], [0.35, 0.6, 0.33, "eye"], [1.05, 0.25, 0.3, "eye"]], 0, 0);
    return node(`Eye${s}`, { id: I(`${p}eye${s}`), ...inHead(cx, cy) }, [
      node("Open", { id: I(`${p}open${s}`), opacity: shut ? 0 : undefined }, dotShapes(open, "eye")),
      node("Shut", { id: I(`${p}shut${s}`), opacity: shut ? 1 : 0 }, dotShapes(lid, "lid")),
    ]);
  };
  const lobe = (s, sign) => node(`Snore${s}`, { id: I(`${p}snore${s}`), ...inHead(sign * 0.9, -10.4) }, node(`Lobe${s}`, { id: I(`${p}lobe${s}`) }, [
    dotShapes(part(`lobe${s}`, undefined, sign * 0.9, -10.4), "lobe"), backing(part(`lobe${s}`, undefined, sign * 0.9, -10.4)),
  ]));
  // neckless: without the shoulders the rest drawing shows at the rim of his hole
  const hp = (name, tone) => part(name, tone, ...HEAD).filter(([, y]) => !neckless || y < 0.6 * P);
  const shaded = ([, y, , t]) => !neckless && y > (-2.5 - HEAD[1]) * P && t < 4;
  const helmet = part("helmet", undefined, ...HELM_PIVOT), lamp = part("lamp", "lamp", ...HELM_PIVOT);
  return [
    eye("L", -4.4, -12.6), eye("R", 5.6, -12.6),
    node("Helmet at", { x: n2((HELM_PIVOT[0] - HEAD[0]) * P), y: n2((HELM_PIVOT[1] - HEAD[1]) * P) }, node("Helmet", { id: I(`${p}helm`) }, [dotShapes(lamp, "lamp"), dotShapes(helmet, "helmet"), backing(helmet)])),
    dotShapes(hp("nose", "nose"), "nose"),
    lobe("L", -1), lobe("R", 1),
    dotShapes(hp("gap"), "gap"),
    // The shadows his paws cast on his chest go with the paws (mole-fine.ts): whole, those dots are plain fur.
    p ? "" : node("Paw shade", { id: I("pawShade"), opacity: 0 }, dotShapes(hp("fur").filter(shaded), "shade")),
    dotShapes(hp("fur").map((d) => (shaded(d) ? [d[0], d[1], d[2], 5] : d)), "fur"), backing(hp("fur")),
  ];
}
function lyingXml() {
  const sp = (name, list, px, py, a = {}, extra = []) => node(name, { ...a, x: n2(px * P), y: n2(py * P) }, [...extra, dotShapes(mine(list, px, py), name), backing(mine(list, px, py))]);
  return node("Lying", { id: I("lying"), x: LY_AT[0], y: LY_AT[1], rotation: n4(Math.PI / 2), opacity: 0 }, node("Sized", { scaleX: LY_SCALE, scaleY: LY_SCALE }, [
    node("ZAnchor", { id: I("zAnchor"), ...lyAt(-17, -33) }),
    node("NoseAnchor", { id: I("noseAnchor"), ...lyAt(-9.5, -27) }),
    // standing in profile, laid back: (x, y) of the drawing lands at (y - 1, -x - 11.5)
    node("Standing", { ...lyAt(-1, -11.5), rotation: n4(-Math.PI / 2) }, [
      node("Head", { id: I("lyHead") }, [
        node("Helmet at", { x: 0, y: n2(-10 * P) }, node("Helmet", { id: I("lyhelm") }, [dotShapes(mine(SIDE.hat, 0, -10), "helmet"), backing(mine(SIDE.hat, 0, -10))])),
        dotShapes(mine(SIDE.nose, 0, 0), "nose"),
        sp("Lobe", SIDE.lobe, 11.2, -6.6, { id: I("lysnoreL") }),
        node("Arm at", { x: n2(-2.5 * P), y: n2(1.5 * P) }, node("Arm", { id: I("lyArm") }, [dotShapes(mine(SIDE.arm, -2.5, 1.5), "arm"), backing(mine(SIDE.arm, -2.5, 1.5))])),
        dotShapes(mine(SIDE.head, 0, 0), "head"), backing(mine(SIDE.head, 0, 0)),
      ]),
      node("Unused", { id: I("lysnoreR") }),
      sp("Feet", SIDE.feet, 0, 23.5, { id: I("lyFeet") }),
      sp("Body", SIDE.body, -11.5, 8.5, { id: I("lyBody") }),
    ]),
  ]));
}
function moleXml() {
  // In the hole his paws rest on the rim (the traced drawing); out of it he has arms. One of the two is shown.
  const paw = (s, sign) => node(`Paw${s}`, { id: I(`paw${s}`), ...at(sign * 11.8, -2.6), opacity: 0 }, [
    dotShapes(part(`paw${s}`, undefined, sign * 11.8, -2.6), "paw"), backing(part(`paw${s}`, undefined, sign * 11.8, -2.6)),
  ]);
  const B = [0, 8], inB = (px, py) => ({ x: n2((px - B[0]) * P), y: n2((py - B[1]) * P) });
  const armDots = (sign) => mine(ARM.map(([x, y, r, t]) => [sign * x, y, r, t]), 0, 0);
  const arm = (s, sign) => node(`Arm${s}`, { id: I(`arm${s}`), ...inB(sign * SHOULDER[0], SHOULDER[1]) }, [dotShapes(armDots(sign), "arm"), backing(armDots(sign))]);
  const foot = (s, sign) => node(`Foot${s}`, { id: I(`foot${s}`), ...inB(sign * HIP[0], HIP[1]) }, [dotShapes(mine(FRONT[`leg${s}`], sign * HIP[0], HIP[1]), "leg"), backing(mine(FRONT[`leg${s}`], sign * HIP[0], HIP[1]))]);
  return node("Mole", { id: I("mole"), x: HOLE_X, y: n2(GROUND + ORIGIN_Y * P) }, [
    el("TransformConstraint", { id: I("moleSeat"), targetId: I("seat"), strength: 0, name: "Rides the cart" }),
    el("ClippingShape", { sourceId: I("holeClip"), name: "Above the dirt" }),
    lyingXml(),
    node("Bob", { id: I("bob") }, node("Squash", { id: I("sq") }, node("Breath", { id: I("br") }, [
      node("Head", { id: I("head"), ...at(...HEAD) }, headKids()),
      paw("L", -1), paw("R", 1),
      // belly over legs over torso over arms, as the app stacks them
      node("Body", { id: I("body"), ...at(...B) }, [
        dotShapes(mine(FRONT.belly, ...B), "belly"), backing(mine(FRONT.belly, ...B)),
        foot("L", -1), foot("R", 1),
        dotShapes(mine(FRONT.torso, ...B), "torso"), backing(mine(FRONT.torso, ...B)),
        arm("L", -1), arm("R", 1),
      ]),
    ]))),
  ]);
}

// ───────────────────────── the cart
const CART = { stopX: 0, pivot: [34, -19], tip: (50 * Math.PI) / 180, wheelR: 8 };
const rot = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const SEAT0 = [-32, -74]; // where he lies, in the bucket's space: across the heap, head to the back
const SLIDE = 36; // how far down the tipped bucket he slides, px
const SEAT1 = [SEAT0[0], -62]; // once the load has gone from under him he lies on the rim
CART.stopX = HOLE_X - CART.pivot[0] - rot(SEAT1, CART.tip)[0] - SLIDE * Math.cos(CART.tip);
const PIVOT_W = [CART.stopX + CART.pivot[0], GROUND + CART.pivot[1]]; // the bucket's hinge, in the world, once stopped
const slope = [Math.cos(CART.tip), Math.sin(CART.tip)];
const tipped0 = rot(SEAT1, CART.tip);
const HANG = [PIVOT_W[0] + tipped0[0] + SLIDE * slope[0], PIVOT_W[1] + tipped0[1] + SLIDE * slope[1]]; // where he is left in the air
const HANG_ROT = CART.tip - Math.PI / 2;
const LIP_HANG = rot([HANG[0] - PIVOT_W[0], HANG[1] - PIVOT_W[1]], -CART.tip); // the same point, in the bucket's space
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
  const end = CART.stopX + 50;
  for (let x = end - 4; x >= 0; x -= 6.4) dots.push([x, 0, 1.0, 3]);
  dots.push([end, 0, 1.4, 5], [end, -3.4, 1.4, 5], [end, -6.8, 1.4, 6]);
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
const BUB = 8;
function bubbleXml() {
  // A ring of pale dots with a glint, over a disc of the page colour so it reads against his pale face.
  const d = [];
  for (let i = 0; i < 18; i++) { const a = (i / 18) * 2 * Math.PI; d.push([BUB * Math.cos(a), -BUB + BUB * Math.sin(a), 1.25, 9]); }
  d.push([-3.6, -BUB - 3.6, 1.5, 9], [-5.6, -BUB - 0.6, 0.9, 9]);
  return node("Bubble", { x: 0, y: 0 }, [el("TranslationConstraint", { targetId: I("noseAnchor") }), node("Bubble show", { id: I("bubbleAt"), opacity: 0 }, node("Bubble grow", { id: I("bubble") }, [dotShapes(d, "bubble"), dotShapes([[0, -BUB, BUB - 0.4, 1]], "bubble fill")]))]);
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
const BREATH = 54, LYARM_Y = 0;
function asleep(a, frames, period = BREATH) {
  for (let c = 0; c * period < frames; c++) {
    const f = (t) => Math.min(frames, c * period + t * period);
    a.k("br", "scaleX", [[f(0), 1], [f(0.45), 0.985], [f(1), 1]]).k("br", "scaleY", [[f(0), 1], [f(0.45), 1.045], [f(1), 1]]);
    a.k("bob", "y", [[f(0), 0], [f(0.45), -3], [f(1), 0]]);
    a.s("bubble", [[f(0), 1], [f(0.45), 0.45], [f(1), 1]]); // in: it shrinks; out: it grows
    a.k("lyBody", "scaleX", [[f(0), 1], [f(0.45), 1.06], [f(1), 1]]).k("lyArm", "x", [[f(0), 0], [f(0.45), 2.6], [f(1), 0]]);
    a.k("lyHead", "rotation", [[f(0), 0], [f(0.45), -0.05], [f(1), 0]]);
    a.k("lysnoreL", "rotation", [[f(0), 0, "h"], [f(0.5), 0], [f(0.6), 0.3], [f(0.68), 0.08], [f(0.76), 0.3], [f(0.84), 0.1], [f(0.92), 0.24], [f(1), 0]]);
    a.k("lysnoreR", "rotation", [[f(0), 0, "h"], [f(0.5), 0], [f(0.6), -0.3], [f(0.68), -0.08], [f(0.76), -0.3], [f(0.84), -0.1], [f(0.92), -0.24], [f(1), 0]]);
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
  .k("zs", "opacity", [[0, 1, "h"]]).k("bubbleAt", "opacity", [[0, 1, "h"]])
  // asleep he is the side view, flat on his back; the front view waits, unseen
  .k("lying", "opacity", [[0, 1, "h"]]).k("bob", "opacity", [[0, 0, "h"]]).k("lying", "rotation", [[0, Math.PI / 2, "h"]]);

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
  a.k("moleSeat", "strength", [[0, 1, "h"]]).k("seatSlide", "strength", [[0, 0, "h"]]).k("seat", "y", [[0, SEAT0[1], "h"]]);
  sleepingPose(a);
  asleep(a, 54);
  // He sleeps through the brake: shoved toward the lip, squashed, belly wobbling, helmet over his brow.
  a.k("seat", "x", [[0, SEAT0[0], "h"], [26, SEAT0[0], "o"], [33, SEAT0[0] + 10, "io"], [41, SEAT0[0] + 6]]);
  a.k("sq", "scaleY", [[0, 1, "h"], [26, 1, "o"], [32, 0.9, "io"], [38, 1.05, "io"], [45, 1]]).k("sq", "scaleX", [[0, 1, "h"], [26, 1, "o"], [32, 1.07, "io"], [38, 0.97, "io"], [45, 1]]);
  a.k("body", "scaleX", [[0, 1, "h"], [28, 1, "o"], [33, 1.08, "io"], [38, 0.96, "io"], [43, 1.03, "io"], [48, 1]]);
  a.k("helm", "y", [[0, 0, "h"], [27, 0, "o"], [32, 4, "io"], [40, 1.5]]).k("helm", "rotation", [[0, 0, "h"], [27, 0, "o"], [33, 0.12, "io"], [42, 0.05]]);
  a.k("head", "rotation", [[0, -0.06, "h"], [27, -0.06, "o"], [33, 0.1, "io"], [42, -0.02, "io"], [54, 0.03]]);
  // Paws folded on his belly; the brake throws one loose.
  a.k("armL", "rotation", [[0, -0.9, "h"], [28, -0.9, "o"], [34, -0.5, "io"], [42, -0.9]]).k("armR", "rotation", [[0, 0.9, "h"], [28, 0.9, "o"], [34, 1.5, "io"], [44, 0.2, "io"], [54, 0.1]]);
  a.k("footL", "rotation", [[0, 0.25, "h"], [28, 0.25, "o"], [34, -0.4, "io"], [42, 0.3, "io"], [50, 0.2]]).k("footR", "rotation", [[0, -0.25, "h"], [28, -0.25, "o"], [35, -0.7, "io"], [43, 0.1, "io"], [51, -0.2]]);
  a.k("lyFeet", "rotation", [[0, 0, "h"], [27, 0, "o"], [33, 0.5, "io"], [40, -0.2, "io"], [47, 0.08, "io"], [53, 0]]);
  a.k("lyhelm", "y", [[0, 0, "h"], [27, 0, "o"], [32, 4, "io"], [41, 1.5]]);
  a.k("lyBody", "scaleY", [[0, 1, "h"], [26, 1, "o"], [32, 0.93, "io"], [38, 1.04, "io"], [45, 1]]);
  a.k("lyArm", "rotation", [[0, 0, "h"], [27, 0, "o"], [33, -0.5, "io"], [41, 0.12, "io"], [48, 0]]);
  // Sparks off the locked wheels.
  for (let s = 0; s < 6; s++) {
    const wx = (s % 2 ? 24 : -24), f0 = 27 + (s >> 1) * 2;
    a.crumb(f0, 11 + s, X - 30 + (f0 - 27) * 5 + wx, GROUND - 1, 150 + s * 28, -150 - ((s * 53) % 110), 1900, 1.0, 9);
  }
}

// 2. The pour: he slides down the tipped bucket, slowly, then not. One second long; the state plays it faster for less ore.
const CREEP = 0.28;
const A2 = new Anim("Pour", 60);
{
  const a = A2, t = CART.tip;
  a.k("bucket", "rotation", [[0, t], [9, t + deg(1.4)], [18, t - deg(1.1)], [27, t + deg(1)], [36, t - deg(0.8)], [45, t + deg(0.5)], [54, t]]);
  a.k("moleSeat", "strength", [[0, 1, "h"]]);
  a.k("seat", "x", [[0, SEAT0[0] + 6], [60, SEAT1[0]]]).k("seat", "y", [[0, SEAT0[1], "io"], [56, SEAT1[1], "h"]]); // the load leaves; he sinks onto the rim
  a.k("seatSlide", "strength", [[0, 0, "in"], [60, CREEP, "h"]]); // he creeps while it pours
  a.k("cart", "x", [[0, CART.stopX, "h"]]).k("deck", "rotation", [[0, 0, "h"]]).k("rail", "opacity", [[0, 1, "h"]]);
  sleepingPose(a);
  asleep(a, 60, 60);
  a.k("helm", "y", [[0, 1.5, "h"]]).k("helm", "rotation", [[0, 0.05, "h"]]);
  a.k("head", "rotation", [[0, 0.03], [60, 0.14]]);
  a.k("armL", "rotation", [[0, -0.9, "h"]]).k("armR", "rotation", [[0, 0.1], [60, -0.2]]);
  a.k("footL", "rotation", [[0, 0.2, "h"]]).k("footR", "rotation", [[0, -0.2, "h"]]);
  a.k("lyFeet", "rotation", [[0, 0, "h"]]).k("lyhelm", "y", [[0, 1.5, "h"]]).k("lyBody", "scaleY", [[0, 1, "h"]]).k("lyArm", "rotation", [[0, 0], [60, 0.25]]);
}

// 3. The stones drop while he slides the rest of the way, faster and faster, off the lip. The bucket falls back,
// the cart backs out, and he stays where he was, asleep on nothing (1.8 s).
const A3 = new Anim("Left hanging", 108);
const OFF = 30; // the frame he leaves the lip
const FLOAT = 14; // Tyler: he should not go up much before he drops into his spot
{
  const a = A3, t = CART.tip, X = CART.stopX, B = OFF - 2;
  a.k("seatSlide", "strength", [[0, CREEP, [0.7, 0, 1, 0.6]], [OFF, 1, "h"]]);
  a.k("seat", "x", [[0, SEAT1[0], "h"]]).k("seat", "y", [[0, SEAT1[1], "h"]]);
  a.k("moleSeat", "strength", [[0, 1, "h"], [OFF, 0, "h"]]);
  // Off the lip he does not fall: he drifts up a little, as if the bubble were holding him.
  a.k("mole", "x", [[0, HANG[0], "h"]]).k("mole", "y", [[0, HANG[1], "h"], [OFF, HANG[1], "o"], [OFF + 44, HANG[1] - FLOAT, "h"]]).k("mole", "rotation", [[0, HANG_ROT, "h"]]);
  a.k("bucket", "rotation", [[0, t, "h"], [B + 3, t, [0.6, 0, 1, 0.7]], [B + 12, deg(-7), "io"], [B + 17, deg(3), "io"], [B + 22, 0]]);
  a.k("deck", "rotation", [[0, 0, "h"], [B + 11, 0, "o"], [B + 15, -0.06, "io"], [B + 20, 0.02, "io"], [B + 25, 0]]);
  a.k("cart", "x", [[0, X, "h"], [B + 16, X, "io"], [B + 23, X + 6, [0.5, 0, 1, 0.6]], [B + 50, -140, "h"]]);
  for (const w of ["wheelF", "wheelB"]) a.k(w, "rotation", [[0, wheelRot(X - 38), "h"], [B + 16, wheelRot(X - 38), "io"], [B + 23, wheelRot(X - 32), [0.5, 0, 1, 0.6]], [B + 50, wheelRot(-140 - 38), "h"]]);
  a.k("rail", "opacity", [[0, 1, "h"], [B + 48, 1, "l"], [B + 60, 0, "h"]]);
  sleepingPose(a);
  asleep(a, 108, 54);
  // As he goes: stretched along the slide, an arm trailing. Then the stop at the lip rings on through him.
  const o = OFF;
  a.k("sq", "scaleY", [[0, 1, "h"], [o - 12, 1, "in"], [o, 1.08, "o"], [o + 6, 0.94, "io"], [o + 13, 1.02, "io"], [o + 20, 1]]).k("sq", "scaleX", [[0, 1, "h"], [o - 12, 1, "in"], [o, 0.94, "o"], [o + 6, 1.05, "io"], [o + 13, 0.99, "io"], [o + 20, 1]]);
  a.k("body", "scaleX", [[0, 1, "h"], [o, 1, "o"], [o + 5, 1.06, "io"], [o + 11, 0.97, "io"], [o + 17, 1.02, "io"], [o + 23, 1]]);
  a.k("helm", "y", [[0, 1.5, "h"], [o, 1.5, "o"], [o + 5, 4.5, "io"], [o + 12, 1, "io"], [o + 18, 2]]).k("helm", "rotation", [[0, 0.05, "h"]]);
  a.k("head", "rotation", [[0, 0.14, "h"], [o, 0.14, "io"], [o + 10, 0.2, "io"], [o + 26, 0.15]]);
  a.k("armL", "rotation", [[0, -0.9, "h"], [o - 14, -0.9, "in"], [o, -0.2, "io"], [o + 9, 0.3, "io"], [o + 20, -0.1, "io"], [o + 31, 0.08, "io"], [o + 42, 0]]);
  a.k("armR", "rotation", [[0, -0.2, "io"], [o, -1.2, "io"], [o + 10, 0.25, "io"], [o + 21, -0.15, "io"], [o + 32, 0]]);
  a.k("footL", "rotation", [[0, 0.2, "h"], [o - 10, 0.2, "in"], [o, -0.35, "io"], [o + 8, 0.3, "io"], [o + 18, -0.12, "io"], [o + 28, 0.06, "io"], [o + 38, 0]]);
  a.k("footR", "rotation", [[0, -0.2, "h"], [o - 10, -0.2, "in"], [o, 0.3, "io"], [o + 9, 0.45, "io"], [o + 19, 0.1, "io"], [o + 29, 0.26, "io"], [o + 39, 0.2]]);
  // Side view: the arm slips off his belly as he goes, the feet lead; in the air he settles level, still snoring.
  const flat = Math.PI / 2 - t;
  // He stays tilted until the bucket has swung home and the cart is leaving, so nothing passes through him.
  a.k("lying", "rotation", [[0, Math.PI / 2, "h"], [o + 24, Math.PI / 2, "io"], [o + 44, flat - 0.1, "io"], [o + 54, flat + 0.04, "io"], [o + 62, flat]]);
  a.k("lyArm", "rotation", [[0, 0.25, "in"], [o, 1.0, "io"], [o + 10, -0.3, "io"], [o + 20, 0.5, "io"], [o + 32, 0.9, "io"], [o + 44, 1.15, "io"], [o + 56, 1.05]]);
  a.k("lyFeet", "rotation", [[0, 0, "h"], [o - 10, 0, "in"], [o, 0.45, "io"], [o + 9, -0.4, "io"], [o + 19, 0.2, "io"], [o + 29, -0.08, "io"], [o + 39, 0]]);
  a.k("lyhelm", "y", [[0, 1.5, "h"], [o, 1.5, "o"], [o + 6, -3, "io"], [o + 14, 1, "io"], [o + 22, 0]]);
  a.k("lyBody", "scaleY", [[0, 1, "h"], [o, 1, "o"], [o + 5, 1.06, "io"], [o + 11, 0.97, "io"], [o + 17, 1.02, "io"], [o + 23, 1]]);
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

// 4. The bubble pops. Eyes wide. He scrambles on nothing, stops, looks down, looks at us, and drops into his
// hole, helmet last. Then up he pops as if nothing happened.
const RISE = 8, T_DROP = 58;
const FEET = (25.3 - ORIGIN_Y) * P; // his soles, below his root
const fallFrames = (d) => Math.sqrt((2 * d) / G) * 60;
const WAKE_Y = FLOOR - FEET * NEAR - 28; // awake he is drawn whole, at NEAR size, his soles well clear of the dirt
const T_KNOCK = Math.round(T_DROP + fallFrames(FLOOR - FEET - (WAKE_Y - RISE)));
const T_GONE = Math.ceil(T_DROP + fallFrames(REST[1] + 78 - (WAKE_Y - RISE)));
const T_POP = T_GONE + 18, T_SETTLED = T_POP + 27, T_SPEAK = T_POP + 87;
const A4 = new Anim("Wake and dive", T_POP + 117);
{
  const a = A4, hx = HANG[0], hy = HANG[1] - FLOAT, [rx, ry] = REST, wy = WAKE_Y, top = wy - RISE;
  a.k("moleSeat", "strength", [[0, 0, "h"]]).k("rail", "opacity", [[0, 0, "h"]]).k("cart", "x", [[0, -140, "h"]]);
  a.k("br", "scaleX", [[0, 1, "h"]]).k("br", "scaleY", [[0, 1, "h"]]).k("bob", "y", [[0, 0, "h"]]);
  a.k("snoreL", "rotation", [[0, 0, "h"]]).k("snoreR", "rotation", [[0, 0, "h"]]);
  // The bubble swells and pops; the Zs go with it.
  a.s("bubble", [[0, 1, "o"], [4, 1.45, "h"]]).k("bubbleAt", "opacity", [[0, 1, "h"], [4, 0, "h"]]);
  {
    const ly = rot(LY_AT, HANG_ROT), bx = hx + ly[0] + LY_NOSE[0] * P, by = hy + ly[1] + LY_NOSE[1] * P - BUB * 1.4;
    for (let c = 0; c < 6; c++) { const ang = (c / 6) * 2 * Math.PI + 0.4; a.crumb(4, 9 + (c % 3) * 2, bx + 10 * Math.cos(ang), by + 10 * Math.sin(ang), 120 * Math.cos(ang), 120 * Math.sin(ang) - 60, 1500, 0.9, 8); }
  }
  a.k("zs", "opacity", [[0, 1, "h"], [4, 1, "l"], [8, 0, "h"]]).s("zs", [[0, 1, "h"], [4, 1, "o"], [8, 1.5, "h"]]);
  // The cut: on the pop the side view gives way to the front view, bolt upright.
  a.k("lying", "opacity", [[0, 1, "h"], [5, 0, "h"]]).k("bob", "opacity", [[0, 0, "h"], [5, 1, "h"]]).k("lying", "rotation", [[0, Math.PI / 2 - CART.tip, "h"]]);
  a.k("lyBody", "scaleX", [[0, 1, "o"], [4, 0.85, "h"]]).k("lyArm", "rotation", [[0, 1.05, "h"]]).k("lyFeet", "rotation", [[0, 0, "o"], [4, -0.5, "h"]]);
  // Eyes: shut, then very open. A long stare before anything else moves.
  for (const s of ["L", "R"]) {
    a.k(`shut${s}`, "opacity", [[0, 1, "h"], [5, 0, "h"], [T_POP + 45, 1, "h"], [T_POP + 50, 0, "h"]]).k(`open${s}`, "opacity", [[0, 0, "h"], [5, 1, "h"], [T_POP + 45, 0, "h"], [T_POP + 50, 1, "h"]]);
    a.s(`eye${s}`, [[0, 1, "h"], [5, 2.0, "o"], [11, 1.65, "h"], [T_GONE, 1.6, "h"], [T_POP + 22, 1.6, "io"], [T_POP + 30, 1, "h"]]);
  }
  a.k("sq", "scaleY", [[0, 1, "o"], [4, 0.9, "o"], [8, 1.14, "io"], [14, 0.97, "io"], [19, 1, "h"]]).k("sq", "scaleX", [[0, 1, "o"], [4, 1.07, "o"], [8, 0.91, "io"], [14, 1.02, "io"], [19, 1, "h"]]);
  a.k("helm", "y", [[0, 2, "h"], [5, 2, "o"], [9, -9, "in"], [15, 2.5, "io"], [19, 0, "h"]]);
  a.k("helm", "rotation", [[0, 0.05, "h"], [5, 0.05, "o"], [9, -0.2, "io"], [16, 0.08, "io"], [21, 0, "h"]]);
  a.k("head", "rotation", [[0, 0.15, "o"], [7, -0.1, "io"], [14, 0, "h"]]);
  a.k("lobeL", "rotation", [[0, 0, "h"], [5, 0, "o"], [9, 0.5, "io"], [15, 0.1, "io"], [20, 0.2, "h"]]).k("lobeR", "rotation", [[0, 0, "h"], [5, 0, "o"], [9, -0.5, "io"], [15, -0.1, "io"], [20, -0.2, "h"]]);
  // The scramble: upright in a blink, limbs windmilling, climbing on nothing.
  const S0 = 20, S1 = 44;
  a.k("mole", "rotation", [[0, HANG_ROT, "h"], [5, -0.1, "h"], [S0, -0.1, "o"], [S0 + 7, 0.14, "io"], [S0 + 12, -0.05, "io"], [S0 + 17, 0, "h"]]);
  a.s("bob", [[0, 1, "h"], [5, LY_SCALE, "o"], [10, NEAR * 1.05, "io"], [15, NEAR, "h"], [T_DROP, NEAR, "in"], [T_KNOCK, 1, "h"]]); // he grows as he starts awake, as in the app
  a.k("mole", "y", [[0, hy, "h"], [5, wy, "h"], [S0, wy, "out"], [S1, top, "h"]]);
  const xs = [[0, hx, "h"]]; for (let f = S0 + 8, i = 0; f < S1; f += 2, i++) xs.push([f, hx + (i % 2 ? 1.6 : -1.6), "h"]); xs.push([S1, hx, "h"]);
  a.k("mole", "x", xs);
  const run = (f0, f1, step, a0, a1) => { const ks = []; for (let f = f0, i = 0; f <= f1; f += step, i++) ks.push([f, i % 2 ? a1 : a0, "io"]); return ks; };
  a.k("footL", "rotation", [[0, 0, "h"], [S0, 0, "o"], ...run(S0 + 3, S1 - 2, 3, 0.95, -0.95), [S1 + 3, 0.1, "h"]]);
  a.k("footR", "rotation", [[0, 0.2, "h"], [S0, 0.2, "o"], ...run(S0 + 3, S1 - 2, 3, -0.95, 0.95), [S1 + 3, -0.1, "h"]]);
  a.k("armL", "rotation", [[0, 0, "h"], [5, 0, "o"], [9, 0.9, "io"], [S0, 0.7, "io"], ...run(S0 + 4, S1 - 2, 4, 2.5, 1.1), [S1 + 5, 0.15, "h"]]);
  a.k("armR", "rotation", [[0, 0, "h"], [5, 0, "o"], [9, -0.9, "io"], [S0, -0.7, "io"], ...run(S0 + 6, S1 - 2, 4, -2.5, -1.1), [S1 + 5, -0.15, "h"]]);
  a.k("body", "scaleX", [[0, 1, "h"], [S1, 1, "o"], [S1 + 3, 1.05, "io"], [S1 + 6, 0.97, "io"], [S1 + 9, 1, "h"]]);
  // He stops. A look down, a look at us, a gulp.
  const eyeY = (s, base) => a.k(`eye${s}`, "y", [[0, base, "h"], [S1 + 2, base, "io"], [S1 + 5, base + 1.2 * P, "h"], [S1 + 10, base + 1.2 * P, "io"], [S1 + 12, base, "h"]]);
  eyeY("L", inHead(-4.4, -12.6).y); eyeY("R", inHead(5.6, -12.6).y);
  a.k("sq", "scaleY", [[S1 + 9, 1, "io"], [T_DROP - 2, 0.93, "in"], [T_DROP + 5, 1.22, "h"]]).k("sq", "scaleX", [[S1 + 9, 1, "io"], [T_DROP - 2, 1.05, "in"], [T_DROP + 5, 0.86, "h"]]);
  // The drop: gravity, feet first, arms left behind overhead, and the helmet a beat late.
  a.fall("mole", "y", T_DROP, T_GONE, top, 0, G, "h");
  a.k("armL", "rotation", [[T_DROP, 0.15, "o"], [T_DROP + 5, 2.2, "h"]]).k("armR", "rotation", [[T_DROP, -0.15, "o"], [T_DROP + 5, -2.2, "h"]]);
  a.k("helm", "y", [[T_DROP, 0, "out"], [T_DROP + 4, -17, "in"], [T_DROP + 9, 0, "h"]]).k("helm", "rotation", [[T_DROP, 0, "io"], [T_DROP + 4, 0.25, "io"], [T_DROP + 9, 0.1, "h"]]);
  a.k("lobeL", "rotation", [[T_DROP, 0.2, "o"], [T_DROP + 4, 0.75, "h"]]).k("lobeR", "rotation", [[T_DROP, -0.2, "o"], [T_DROP + 4, -0.75, "h"]]);
  // The hit: the host is told (the ring is the page's), dirt flies, the dirt line gives.
  a.call("evKnock", T_KNOCK);
  for (let c = 0; c < 14; c++) {
    const side = c % 2 ? 1 : -1, u = ((c * 37) % 14) / 14;
    a.crumb(T_KNOCK + (c % 3), 20 + ((c * 5) % 9), HOLE_X + side * (8 + u * 30), GROUND - 2, side * (60 + u * 190), -330 - ((c * 71) % 260), 2300, 1.1 + (c % 3) * 0.35, c % 4 === 0 ? 7 : "dirt");
  }
  a.k("dirtMid", "y", [[0, 0, "h"], [T_KNOCK, 0, "o"], [T_KNOCK + 3, 4.5, "io"], [T_KNOCK + 8, -2, "io"], [T_KNOCK + 13, 1, "io"], [T_KNOCK + 18, 0, "h"], [T_POP, 0, "o"], [T_POP + 3, -4, "io"], [T_POP + 9, 1.5, "io"], [T_POP + 14, 0]]);
  a.crumb(T_GONE + 6, 14, HOLE_X + 26, GROUND - 60, 4, 0, 2300, 1.2, "dirt"); // one that went higher than the rest
  // Underground, out of sight: arms away, paws on, everything straight.
  const U = T_GONE + 1;
  a.k("pawShade", "opacity", [[0, 0, "h"], [U, 1, "h"]]);
  for (const s of ["L", "R"]) a.k(`arm${s}`, "opacity", [[0, 1, "h"], [U, 0, "h"]]).k(`paw${s}`, "opacity", [[0, 0, "h"], [U, 1, "h"]]).k(`foot${s}`, "rotation", [[U, 0, "h"]]).k(`lobe${s}`, "rotation", [[U, 0, "h"]]);
  a.k("mole", "x", [[U, rx, "h"]]).k("mole", "rotation", [[U, 0, "h"]]).k("mole", "y", [[U, ry + 78, "h"]]);
  a.k("helm", "y", [[U, 4, "h"]]).k("helm", "rotation", [[U, 0.1, "h"]]);
  // The empty beat (0.3 s), then up he pops: wide-eyed, helmet late and askew.
  a.k("mole", "y", [[T_POP, ry + 78, [0.1, 0.75, 0.3, 1]], [T_POP + 6, ry - 5, "io"], [T_POP + 13, ry + 2, "io"], [T_POP + 19, ry - 0.5, "io"], [T_POP + 24, ry]]);
  a.k("sq", "scaleY", [[U, 1.16, "h"], [T_POP + 5, 1.16, "io"], [T_POP + 12, 0.92, "io"], [T_POP + 18, 1.03, "io"], [T_POP + 24, 1]]).k("sq", "scaleX", [[U, 0.9, "h"], [T_POP + 5, 0.9, "io"], [T_POP + 12, 1.06, "io"], [T_POP + 18, 0.98, "io"], [T_POP + 24, 1]]);
  a.k("pawL", "rotation", [[U, 0.5, "h"], [T_POP + 7, 0.5, "io"], [T_POP + 14, -0.14, "io"], [T_POP + 20, 0.04, "io"], [T_POP + 25, 0]]).k("pawR", "rotation", [[U, -0.5, "h"], [T_POP + 8, -0.5, "io"], [T_POP + 15, 0.14, "io"], [T_POP + 21, -0.04, "io"], [T_POP + 26, 0]]);
  a.k("lobeL", "rotation", [[T_POP + 5, 0, "o"], [T_POP + 9, -0.35, "io"], [T_POP + 16, 0.2, "io"], [T_POP + 23, -0.06, "io"], [T_POP + 29, 0]]).k("lobeR", "rotation", [[T_POP + 5, 0, "o"], [T_POP + 9, 0.35, "io"], [T_POP + 16, -0.2, "io"], [T_POP + 23, 0.06, "io"], [T_POP + 29, 0]]);
  a.k("helm", "y", [[T_POP, 4, "o"], [T_POP + 6, 7, "io"], [T_POP + 12, -10, "in"], [T_POP + 20, 2, "io"], [T_POP + 24, 0]]);
  a.k("helm", "rotation", [[T_POP + 6, 0.1, "io"], [T_POP + 12, 0.34, "io"], [T_POP + 20, 0.2, "io"], [T_POP + 24, 0.24, "h"], [T_POP + 61, 0.24, "io"], [T_POP + 68, -0.06, "io"], [T_POP + 74, 0]]);
  a.k("helm", "x", [[0, 0, "h"], [T_POP + 12, 0, "io"], [T_POP + 20, 4, "h"], [T_POP + 61, 4, "io"], [T_POP + 68, -0.6, "io"], [T_POP + 74, 0]]);
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
A5.k("pawShade", "opacity", [[0, 1, "h"]]).k("lying", "opacity", [[0, 0, "h"]]).k("bob", "opacity", [[0, 1, "h"]]);
for (const s of ["L", "R"]) A5.k(`arm${s}`, "opacity", [[0, 0, "h"]]).k(`paw${s}`, "opacity", [[0, 1, "h"]]);
for (const s of ["L", "R"]) A5.k(`shut${s}`, "opacity", [[0, 0, "h"], [150, 1, "h"], [155, 0, "h"]]).k(`open${s}`, "opacity", [[0, 1, "h"], [150, 0, "h"], [155, 1, "h"]]);

// The brake sparks belong to the roll-in. The web runtime can leave one lit when it changes state between two of
// its own frames, so every later timeline puts them out.
for (let c = 0; c < 6; c++) for (const an of [A2, A3, A4, A5]) an.k(`crumb${c}`, "opacity", [[0, 0, "h"]]);

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
    bangXml(), bubbleXml(), zsXml(), crumbXml(), dirtXml(), mole, cart, railXml(),
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
fs.writeFileSync(path.join(HERE, "rive/timing.json"), JSON.stringify({ W, H, RING, GROUND, P, pourSeconds: Object.fromEntries(BANDS.map((b) => [b, pourSeconds(b)])), rollIn: 54 / 60, hang: 108 / 60, wake: { knock: T_KNOCK / 60, pop: (T_POP + 1) / 60, settled: T_SETTLED / 60, speak: T_SPEAK / 60, total: A4.duration / 60 }, ore: { step: STEP / 120, flight: FLIGHT / 120 }, stone: { first: 2 / 60, step: 5 / 60, flight: 27 / 60 } }, null, 1));
console.log(`scene.rml ${(out.length / 1024).toFixed(0)} KB, ${nid - 100} ids, ${crumbs.length} crumbs`);
