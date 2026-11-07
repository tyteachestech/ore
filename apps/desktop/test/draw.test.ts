import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  addChild, addMap, addMatrix, align, bounds, centre, DEFAULT_STYLE, distribute, duplicate, edgePoint, fitLink, flowDir, fromScene, growMatrix, labelOf,
  layoutMatrix, minLabelWidth, nearestIn, nextCell, parseMap, remove, reorder, resize, rotate, route, byId, setLabel, shape, snapBox, toScene, topAt, move, type El, type Scene,
} from "../src/draw/model";
import { dark } from "../src/draw/render";

const legacy = () => JSON.parse(readFileSync(join(import.meta.dir, "fixtures/excalidraw-0.18.excalidraw"), "utf8")) as Scene;
const box = (x: number, y: number, w = 100, h = 60, type: "rectangle" | "ellipse" | "diamond" = "rectangle"): El => shape(type, { x, y, w, h }, DEFAULT_STYLE);
const near = (a: number, b: number, d = 1) => expect(Math.abs(a - b)).toBeLessThanOrEqual(d);

describe("diagram files (Excalidraw's format)", () => {
  test("a file Excalidraw saved opens: deleted elements dropped, labels and bindings kept", () => {
    const els = fromScene(legacy());
    expect(els.map((e) => e.id)).toEqual(["r1", "t1", "e1", "a1", "f1"]);
    expect(labelOf(els, "r1")?.originalText).toBe("Retrieval practice");
    expect(els.find((e) => e.id === "a1")?.endBinding?.elementId).toBe("e1");
  });

  test("saving keeps unknown fields and the file's other keys, and recomputes boundElements", () => {
    const prev = legacy();
    const out = toScene(fromScene(prev), prev);
    expect(out.type).toBe("excalidraw");
    expect(out.appState).toMatchObject({ gridSize: 20 });
    const r1 = (out.elements as El[]).find((e) => e.id === "r1")!;
    expect(r1.seed).toBeUndefined(); // per-edit noise Excalidraw regenerates
    expect(r1.roundness).toEqual({ type: 3 });
    expect(r1.frameId).toBeUndefined(); // a default, left out
    expect(r1.boundElements).toEqual([{ id: "t1", type: "text" }, { id: "a1", type: "arrow" }]);
    expect((out.elements as El[]).some((e) => e.id === "x9")).toBe(false);
  });

  test("a box with a label and an arrow write about 150 bytes each", () => {
    const a = box(0, 0);
    const b = box(300, 0);
    let els = addChild([a], a, "right", DEFAULT_STYLE).els;
    els = setLabel(els, a.id, "Retrieval", DEFAULT_STYLE);
    const out = toScene(els, null).elements as El[];
    const sizes = out.map((e) => JSON.stringify(e).length);
    expect(Math.max(...sizes)).toBeLessThan(330);
    expect(sizes.reduce((x, y) => x + y, 0) / sizes.length).toBeLessThan(260);
    expect(fromScene({ type: "excalidraw", elements: out }).find((e) => e.id === a.id)).toMatchObject({ angle: 0, opacity: 100, groupIds: [] });
    void b;
  });

  test("dark page colours: black ink is paper white, others follow Excalidraw's dark theme", () => {
    expect(dark("#1e1e1e")).toBe("#f2f1ec");
    expect(dark("transparent")).toBe("transparent");
    expect(dark("#a5d8ff")).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("arrows", () => {
  test("a bound arrow's ends sit on each shape's edge, a gap away, and follow a move", () => {
    const a = box(0, 0);
    const b = box(300, 0);
    const arrow = { ...shape("rectangle", { x: 0, y: 0, w: 0, h: 0 }, DEFAULT_STYLE), type: "arrow", points: [[0, 0], [10, 0]] as [number, number][], startBinding: { elementId: a.id, focus: 0, gap: 6 }, endBinding: { elementId: b.id, focus: 0, gap: 6 } };
    const r = route(arrow, byId([a, b]));
    near(r.x, 106);
    near(r.x + r.points![1]![0], 294);
    const moved = move([a, b, r], new Set([b.id]), 0, 200);
    const m = moved.find((e) => e.id === r.id)!;
    const end = [m.x + m.points![1]![0], m.y + m.points![1]![1]];
    expect(end[1]).toBeGreaterThan(190); // now points down to b's new place
  });

  test("edgePoint meets an ellipse on its outline", () => {
    const e = box(0, 0, 200, 100, "ellipse");
    const p = edgePoint(e, [400, 50]);
    near(p[0], 200, 2);
    near(p[1], 50, 1);
  });

  test("deleting a shape removes its label and every arrow bound to it, with the arrow's label", () => {
    const a = box(0, 0);
    const b = box(300, 0);
    const made = addChild([a, b], a, "right", DEFAULT_STYLE);
    let els = setLabel(made.els, a.id, "A", DEFAULT_STYLE);
    els = setLabel(els, made.arrow.id, "to", DEFAULT_STYLE);
    const arrow = made.arrow;
    const out = remove(els, new Set([a.id]));
    expect(out.map((e) => e.id)).toEqual([b.id, made.node.id]);
    expect(out.some((e) => e.containerId === arrow.id)).toBe(false);
  });

  test("a labelled box cannot be resized narrower than its longest word", () => {
    let els = [box(0, 0, 300, 60)];
    els = setLabel(els, els[0]!.id, "short antidisestablishment", DEFAULT_STYLE);
    const c = els[0]!;
    const min = minLabelWidth(els, c);
    expect(min).toBeGreaterThan(100);
    const r = resize(c, c, "e", [20, 30], false, false, min);
    near(r.width, min, 0.01);
    expect(r.x).toBe(0);
    const l = resize(c, c, "w", [280, 30], false, false, min);
    near(l.x + l.width, 300, 0.01); // the right edge stays put
    expect(minLabelWidth([box(0, 0)], box(0, 0))).toBe(0);
  });
});

describe("keyboard maps (Tab, ⌘+arrow, ⌥+arrow)", () => {
  test("a new node lands beside its parent on free space, joined by a bound arrow", () => {
    const a = box(0, 0);
    const one = addChild([a], a, "right", DEFAULT_STYLE);
    expect(one.node.x).toBeGreaterThan(a.x + a.width);
    expect(one.arrow.startBinding?.elementId).toBe(a.id);
    expect(one.arrow.endBinding?.elementId).toBe(one.node.id);
    const two = addChild(one.els, a, "right", DEFAULT_STYLE);
    const [b1, b2] = [bounds(one.node), bounds(two.node)];
    expect(b2.y).toBeGreaterThanOrEqual(b1.y + b1.h); // the second child stacks under the first
  });

  test("a long link label pushes the new node out until it fits", () => {
    const a = box(0, 0);
    const { els, node, arrow } = addChild([a], a, "right", DEFAULT_STYLE);
    const labelled = setLabel(els, arrow.id, "is a necessary but not sufficient condition for", DEFAULT_STYLE);
    const out = fitLink(labelled, arrow.id);
    const t = labelOf(out, arrow.id)!;
    const n = out.find((e) => e.id === node.id)!;
    expect(n.x - (a.x + a.width)).toBeGreaterThanOrEqual(t.width + 40);
  });

  test("⌥+arrow goes to the nearest node that way", () => {
    const a = box(0, 0);
    const right = box(300, 10);
    const below = box(0, 300);
    expect(nearestIn([a, right, below], a, "right")?.id).toBe(right.id);
    expect(nearestIn([a, right, below], a, "down")?.id).toBe(below.id);
    expect(nearestIn([a, right, below], a, "left")).toBeNull();
  });

  test("typed links: labels, chains, outlines, hyphenated words", () => {
    const m = parseMap("Spaced practice -strengthens-> Long-term memory\nA -> B -> C\nRetrieval\n  Free recall\n  Concept map");
    expect(m.edges).toContainEqual({ from: "Spaced practice", to: "Long-term memory", label: "strengthens" });
    expect(m.edges).toContainEqual({ from: "A", to: "B", label: "" });
    expect(m.edges).toContainEqual({ from: "B", to: "C", label: "" });
    expect(m.edges).toContainEqual({ from: "Retrieval", to: "Free recall", label: "" });
    expect(m.edges).toContainEqual({ from: "Retrieval", to: "Concept map", label: "" });
    expect(m.nodes).toContain("Long-term memory");
  });

  test("a typed map draws (x) as an ellipse and {x} as a diamond", () => {
    const m = parseMap("(Sleep) -> {Enough?} -yes-> Memory");
    expect(m.nodes).toEqual(["Sleep", "Enough?", "Memory"]);
    const r = addMap([], "(Sleep) -> {Enough?} -yes-> Memory", DEFAULT_STYLE, [0, 0]);
    expect(r.els.filter((e) => !e.containerId && e.type !== "arrow").map((e) => e.type)).toEqual(["ellipse", "diamond", "rectangle"]);
  });

  test("a label that wraps grows its box from the centre", () => {
    let els = [box(0, 0)];
    const y0 = els[0]!.y, h0 = els[0]!.height;
    els = setLabel(els, els[0]!.id, "a long label that has to wrap over several lines inside this box", DEFAULT_STYLE);
    const b = els.find((e) => e.id === els[0]!.id)!;
    expect(b.height).toBeGreaterThan(h0);
    expect(Math.abs(b.y + b.height / 2 - (y0 + h0 / 2))).toBeLessThanOrEqual(1);
  });

  test("children below a node link from its bottom, so a row of siblings is never crossed", () => {
    let els: El[] = [box(0, 0)];
    let last = els[0]!;
    for (let i = 0; i < 4; i++) {
      const made = addChild(els, els[0]!, "down", DEFAULT_STYLE);
      els = made.els;
      last = made.node;
    }
    const rows = els.filter((e) => e.type === "rectangle" && e.id !== els[0]!.id);
    expect(new Set(rows.map((r) => r.y)).size).toBe(1);
    const a = els.find((e) => e.type === "arrow" && e.endBinding?.elementId === last.id)!;
    const pts = a.points.map(([x, y]) => [a.x + x, a.y + y] as const);
    expect(Math.max(...pts.map((p) => p[1]))).toBeLessThanOrEqual(last.y);
    expect(flowDir(els, last)).toBe("down");
    const round = fromScene(toScene(els, { type: "excalidraw", elements: [] } as never) as never);
    expect(round.find((e) => e.id === a.id)?.startBinding?.fixedPoint).toEqual([0.5, 1]);
  });

  test("a typed map reuses nodes already drawn with the same label", () => {
    let els = [box(0, 0)];
    els = setLabel(els, els[0]!.id, "Memory", DEFAULT_STYLE);
    const r = addMap(els, "memory -> Sleep", DEFAULT_STYLE, [0, 0]);
    expect(r.els.filter((e) => e.type === "rectangle")).toHaveLength(2);
    expect(r.els.find((e) => e.type === "arrow")?.startBinding?.elementId).toBe(els[0]!.id);
  });
});

describe("compare matrix", () => {
  test("Tab walks cells in reading order; rows grow to their tallest cell", () => {
    const { els, first } = addMatrix([], [0, 0], 3, 3, DEFAULT_STYLE);
    expect(els).toHaveLength(9);
    const second = nextCell(els, first, false)!;
    expect(nextCell(els, second.id, true)?.id).toBe(first);
    const tall = layoutMatrix(setLabel(els, first, "a much longer header that wraps onto several lines", DEFAULT_STYLE), els[0]!.groupIds[0]!);
    const row0 = tall.filter((e) => (e.customData?.oreCell as { row: number } | undefined)?.row === 0);
    expect(new Set(row0.map((e) => e.height)).size).toBe(1);
    expect(row0[0]!.height).toBeGreaterThan(56);
  });

  test("adding a row adds a cell per column", () => {
    const { els } = addMatrix([], [0, 0], 2, 3, DEFAULT_STYLE);
    expect(growMatrix(els, els[0]!.groupIds[0]!, "row")).toHaveLength(9);
  });
});

describe("selection and arranging", () => {
  test("a click inside a hollow box picks it; a smaller box inside it wins", () => {
    const big = box(0, 0, 400, 400);
    const small = box(100, 100, 50, 50);
    expect(topAt([big], [200, 200], 4)?.id).toBe(big.id);
    expect(topAt([small, big], [120, 120], 4)?.id).toBe(small.id);
    expect(topAt([big], [600, 600], 4)).toBeNull();
  });

  test("snapping: edges and centres within the tolerance, with a guide", () => {
    const s = snapBox({ x: 103, y: 40, w: 50, h: 50 }, [{ x: 100, y: 200, w: 50, h: 50 }], 6, null);
    expect(s.dx).toBe(-3);
    expect(s.guides[0]).toMatchObject({ axis: "x", at: 100 });
    expect(snapBox({ x: 13, y: 27, w: 10, h: 10 }, [], 6, 20)).toMatchObject({ dx: 7, dy: -7 });
  });

  test("snapping: a box dragged near two in a row takes their gap, after, before or between them", () => {
    const row = [{ x: 0, y: 0, w: 50, h: 50 }, { x: 80, y: 0, w: 50, h: 50 }]; // gap 30
    const after = snapBox({ x: 163, y: 2, w: 50, h: 50 }, row, 6, null);
    expect(after.dx).toBe(-3); // 130 + 30 = 160
    expect(after.guides.filter((g) => g.gap).map((g) => [g.from, g.to])).toEqual([[50, 80], [130, 160]]);
    expect(snapBox({ x: -77, y: 0, w: 50, h: 50 }, row, 6, null).dx).toBe(-3); // -80 = 0 - 30 - 50
    const wide = [{ x: 0, y: 0, w: 50, h: 50 }, { x: 200, y: 0, w: 50, h: 50 }];
    expect(snapBox({ x: 97, y: 0, w: 50, h: 50 }, wide, 6, null).dx).toBe(3); // centred: 50 + (150 - 50) / 2
    // another row (no vertical overlap) is not a neighbour; an edge match wins over a gap
    expect(snapBox({ x: 163, y: 200, w: 50, h: 50 }, row, 6, null).dx).toBe(0);
    expect(snapBox({ x: 163, y: 2, w: 50, h: 50 }, [...row, { x: 165, y: 100, w: 10, h: 10 }], 6, null)).toMatchObject({ dx: 2 });
  });

  test("align, distribute, reorder, duplicate", () => {
    const [a, b, c] = [box(0, 0), box(150, 40), box(400, 80)];
    const left = align([a, b, c], [[a.id], [b.id], [c.id]], "top");
    expect(new Set(left.map((e) => e.y))).toEqual(new Set([0]));
    const mid = box(120, 0);
    const spread = distribute([a, mid, c], [[a.id], [mid.id], [c.id]], "x");
    const xs = spread.map((e) => e.x).sort((p, q) => p - q);
    near(xs[1]! - xs[0]!, xs[2]! - xs[1]!);
    expect(reorder([a, b, c], new Set([a.id]), "front").at(-1)!.id).toBe(a.id);
    const d = duplicate([a], new Set([a.id]));
    expect(d.els).toHaveLength(2);
    expect(d.ids[0]).not.toBe(a.id);
  });

  test("resize keeps the opposite corner and, with ⇧, the aspect ratio; rotate turns about the centre", () => {
    const a = box(0, 0, 100, 50);
    const r = resize(a, a, "se", [200, 300], true, false);
    expect([r.x, r.y]).toEqual([0, 0]);
    near(r.width / r.height, 2, 0.01);
    const [t] = rotate([a], centre(a), Math.PI / 2);
    near(t!.angle, Math.PI / 2, 1e-9);
    expect(centre(t!)).toEqual(centre(a));
  });
});
