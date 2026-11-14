import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Mole } from "./Mole";
import { Gem } from "./Gem";
import { lit } from "./Ring";

/* The end of a session (D190, Tyler's pick B of three): the ore cart that rode Review's rail rolls in over the
   ring, brakes, and its bucket tips. One dot of ore per ring dot this session lit falls out on a real arc
   (gravity, no easing curve) and becomes that dot; one rough stone per memory that went solid drops to its place
   and is cut. Then the cart rolls off. Ore from a recall that had nearly faded (rescued, D62) is rich: bigger and
   brighter in the heap and in the air (D197), so the harder recall is the better find. Drawn as the mole is: round dots on a grid, shade by dot size. */

const CELL = 3;
/** The cart on a 20 by 13 grid, W rim to D shade (a gem's letters). The bucket tips about its front foot. */
const BUCKET = [".WWWWWWWWWWWWWWWWWW.", "..HHHHHHHHHHHMMMMD..", "..HHHHHHHHHHMMMMDD..", "...HHHHHHHHMMMMDD...", "...HHHHHHHMMMMDDD...", "....HHHHHMMMMDDD....", "....MMMMMMMDDDDD...."];
const FRAME = "...DDDDDDDDDDDDDD...";
const WHEEL = [".HHH.", "HM..H", "H.W.H", "H..MH", ".HHH."];
const RADIUS: Record<string, number> = { W: 0.5, H: 0.44, M: 0.36, D: 0.27 };
const BUCKET_TOP = 2, FRAME_ROW = 9, WHEEL_ROW = 10, WHEELS = [3, 12] as const;
const HINGE = [16.5, 9] as const, LIP = [18.5, 2] as const;
/** Rows of headroom over the bucket for its load. */
const HEAD = 8;
const W = 20 * CELL, H = (15 + HEAD) * CELL;
/** Where the heap's ore sits: five dots half behind the rim, four on top of them. */
const HEAP: [number, number][] = [[5.6, -0.3], [8.4, -0.3], [11.2, -0.3], [14, -0.3], [4.2, 1.9], [7, 1.9], [9.8, 1.9], [12.6, 1.9], [15.4, 1.9]];
const ROUGH = 6;
/** The mole riding the load: drawn at the size he stands at on the ring, shown smaller on the cart: `DOZE` asleep (side on, about 80px long), growing as he starts awake. */
const RIDER_PX = 96, DOZE = 0.45;
/** The middle of each drawing's body from the foot of its box, in px at full size: asleep he lies over it, awake he straddles it. */
const SLEEPER = [0, -45] as const, FALLER = [-1, -6] as const;
/** How far he is tipped when his slide leaves him hanging past the lip (degrees). */
const SLID = 58;
/** How far the middle of his body lies off the tipped rim he slides down, in px: half his girth, so the bucket never crosses him. */
const GIRTH = 22;
/** How far over the foot of his seat the dirt line is: the top of the seated mole's row of dirt. */
const GROUND = 3;
/** The gravity he dives under, px/s²: slower than the ore's, so a turn in the air can be seen. */
const DIVE = 1500;
/** How long he is pulled going up and diving, and how short he is pressed in the brace before it. */
const STRETCH = 1.2, SQUASH = 0.86;
/** Awake on nothing, beat by beat: how far through the hang, his lean in degrees, how far he has sunk in px and how far
 *  across to his hole he has run (0 to 1). He looks down, runs on air, then stops and gathers before he drops. */
const THRASH: [number, number, number, number][] = [[0, 0, 0, 0], [0.15, 5, 1, 0], [0.28, -11, 2, 0.1], [0.42, 9, 3, 0.34], [0.56, -10, 4, 0.62], [0.7, 8, 6, 0.86], [0.84, -4, 7, 1], [1, 0, 3, 1]];
/** The cart's hop as his weight leaves it, in px. */
const HOPPED = [0, -4, 1, 0];
/** How far the ring's nearest dot is knocked down as he hits, in px. */
const KNOCK = 7;
/** The dirt his dive throws up: each dot's speed across and up in px a second, and its size in px. */
const DIRT: [number, number, number][] = [[-210, -260, 6], [-160, -380, 8], [-110, -470, 6], [-70, -340, 9], [-30, -520, 7], [20, -400, 6], [60, -500, 9], [105, -360, 7], [150, -440, 6], [200, -290, 8], [-130, -200, 5], [140, -190, 5], [-40, -250, 5], [45, -230, 5]];
/** How far under the middle of his body his feet are, and how far over it his helmet's top, in px at full size. */
const FEET = 42, CROWN = 52;
/** The longest any of that dirt is in the air, in ms. */
const SETTLE = 840;
/** A snoring Z, in dots on a 4 by 4 grid (the mole's own Z). */
const Z = [[0, 0], [1, 0], [2, 0], [3, 0], [2, 1], [1, 2], [0, 3], [1, 3], [2, 3], [3, 3]] as const;

const dots = (rows: readonly string[], x0: number, y0: number) =>
  rows.flatMap((row, y) => [...row].map((t, x) => (t === "." ? null : <circle key={`${x},${y}`} className={`cart-${t}`} cx={x0 + x + 0.5} cy={y0 + y + 0.5} r={RADIUS[t]} />)));

/** How long a piece of the load takes to slide down the tipped bucket to its low lip, before it falls from there. */
const SLIDE = 150;
const GRAVITY = 2600, HOP = -90;
/** A throw from rest under gravity: how long it flies to land `dy` px lower, after a small hop up out of the bucket. */
export const flight = (dy: number) => (-HOP + Math.sqrt(HOP * HOP + 2 * GRAVITY * Math.max(0, dy))) / GRAVITY;
/** Where it is `t` seconds into a flight of `T` seconds that ends `dx`, `dy` away. */
export const along = (dx: number, dy: number, T: number, t: number): [number, number] => [(dx * t) / T, HOP * t + ((dy - HOP * T) / (T * T)) * t * t];

/** The ring dots a session lit, in the order they light: from the share it began at to the one it ended at. */
export const oreFor = (from: number, to: number, n: number) => Array.from({ length: Math.max(0, lit(to, n) - lit(from, n)) }, (_, i) => lit(from, n) + i);

type Flying = { el: HTMLElement; ours: boolean; x0: number; y0: number; dx: number; dy: number; T: number; t0: number; spin: number; land: () => void };

/** `host` is the end screen. `lit` are the ring dots to light, in order; `stones` the colours of the gems cut
 *  (already capped to those shown); `rich` how many of the ore are rich, poured first. `onStone(i)` when stone i lands, `onPoured` when the ring is full, `onLeave`
 *  as the cart starts off (the mole comes up, unless he is riding), `onDone` when it has gone. `mole`: he rides in asleep on the load and
 *  falls out onto the ring once the cart has left (D255); `onFell` as he lands, and `onDone` waits for it. */
export function CartTip({ host, lit, rich = 0, stones, mole = false, onFell, onStone, onPoured, onLeave, onDone }: {
  mole?: boolean; onFell?: () => void;
  host: HTMLElement | null; lit: number[]; rich?: number; stones: (string | undefined)[];
  onStone: (i: number) => void; onPoured: () => void; onLeave: () => void; onDone: () => void;
}) {
  const layer = useRef<HTMLDivElement>(null);
  const calls = useRef({ onStone, onPoured, onLeave, onDone, onFell });
  calls.current = { onStone, onPoured, onLeave, onDone, onFell };
  // The mole asleep on the load (D255) wakes once the cart has gone from under him.
  const [pose, setPose] = useState<"doze" | "fall" | "dive" | "gone">("doze");

  useEffect(() => {
    const el = layer.current, ring = host?.querySelector<SVGSVGElement>(".ring .dot-ring"), body = host?.closest<HTMLElement>(".review-body");
    if (!el || !host || !ring || !body) { calls.current.onPoured(); calls.current.onLeave(); calls.current.onFell?.(); calls.current.onDone(); return; }
    // Speeds and curves are the motion tokens (D185); only the falls keep their own time, which is gravity's.
    const css = getComputedStyle(el), token = (name: string, or: string) => css.getPropertyValue(name).trim() || or, ms = (name: string, or: number) => parseFloat(token(name, "")) || or;
    const OUT = token("--ease-out", "ease-out"), IN_OUT = token("--ease-in-out", "ease-in-out"), SPRING = token("--ease-spring", "ease-out");
    const T2 = ms("--t-2", 150), T4 = ms("--t-4", 300), MOMENT = ms("--t-moment", 600);
    // The layer spans the window's width, so the cart comes from one edge and leaves by the other.
    // Inside its scrollbar, or the layer would make the screen scroll sideways while it plays.
    const hb = host.getBoundingClientRect(), rb = ring.getBoundingClientRect(), bb = { left: body.getBoundingClientRect().left + body.clientLeft, width: body.clientWidth };
    el.style.left = `${bb.left - hb.left}px`;
    el.style.width = `${bb.width}px`;
    // Where a thing is in the layer, measured against the layer as it is at that throw: the end screen is still
    // sliding in when the cart mounts, and the page can scroll while it plays.
    const at = (r: DOMRect, o: DOMRect) => ({ x: r.left - o.left + r.width / 2, y: r.top - o.top + r.height / 2 });
    const cart = el.querySelector<SVGSVGElement>(".cart")!, rail = el.querySelector<HTMLElement>(".cart-rail")!, bucket = el.querySelector<SVGGElement>(".cart-bucket")!;
    const wheels = [...el.querySelectorAll<SVGGElement>(".cart-wheel")], heap = [...el.querySelectorAll<SVGCircleElement>(".cart-ore-in")], roughIn = [...el.querySelectorAll<SVGGElement>(".cart-rough-in")];
    const roughs = [...el.querySelectorAll<HTMLElement>(".cart-rough")], lip = el.querySelector<SVGCircleElement>(".cart-lip")!;
    // On the rail just over the ring, stopped where its tipped lip hangs over the ring's near side.
    const floor = rb.top - hb.top - 2, stop = rb.left - bb.left + rb.width * 0.3 - W - 20;
    rail.style.top = `${floor - 1}px`;
    cart.style.top = `${floor - H}px`;
    cart.style.left = `${stop}px`;

    const timers: number[] = [], anims: Animation[] = [], flying: Flying[] = [];
    let frame = 0, alive = true;
    const later = (ms: number, fn: () => void) => timers.push(window.setTimeout(() => alive && fn(), ms));
    const play = (node: Element, keys: Keyframe[], o: KeyframeAnimationOptions) => { const a = node.animate(keys, { fill: "both", ...o }); anims.push(a); return a; };
    const tick = (now: number) => {
      for (let i = flying.length - 1; i >= 0; i--) {
        const f = flying[i]!, t = (now - f.t0) / 1000;
        // A stone is React's to remove; the ore is ours.
        if (t >= f.T) { flying.splice(i, 1); if (f.ours) f.el.remove(); else f.el.hidden = true; f.land(); continue; }
        const [x, y] = along(f.dx, f.dy, f.T, Math.max(0, t));
        f.el.style.transform = `translate3d(${f.x0 + x}px, ${f.y0 + y}px, 0) rotate(${f.spin * t}deg)`;
      }
      frame = flying.length ? requestAnimationFrame(tick) : 0;
    };
    const fly = (node: HTMLElement, ours: boolean, target: Element, spin: number, land: () => void) => {
      const o = el.getBoundingClientRect(), from = at(lip.getBoundingClientRect(), o), to = at(target.getBoundingClientRect(), o);
      const dy = to.y - from.y, T = flight(dy);
      node.style.transform = `translate3d(${from.x}px, ${from.y}px, 0)`;
      node.hidden = false;
      flying.push({ el: node, ours, x0: from.x, y0: from.y, dx: to.x - from.x, dy, T, t0: performance.now(), spin, land });
      if (!frame) frame = requestAnimationFrame(tick);
    };

    // In from the left, braking hard; the wheels turn as far as it rolls.
    const roll = (from: number, to: number, ms: number, easing: string) => {
      play(cart, [{ transform: `translateX(${from}px)` }, { transform: `translateX(${to}px)` }], { duration: ms, easing });
      for (const w of wheels) play(w, [{ transform: `rotate(${from / (2.5 * CELL)}rad)` }, { transform: `rotate(${to / (2.5 * CELL)}rad)` }], { duration: ms, easing });
    };
    play(rail, [{ opacity: 0 }, { opacity: 1 }], { duration: T2, easing: OUT });
    roll(-(stop + W + 20), 0, MOMENT, OUT);
    // The brake: the wheels lock before it has stopped and it skids the last of the way, nose down, then rocks back.
    const far = -(stop + W + 20) / (2.5 * CELL), locked = Math.round((far * 0.12) / (2 * Math.PI)) * 2 * Math.PI;
    for (const w of wheels) play(w, [{ transform: `rotate(${far}rad)`, easing: OUT }, { transform: `rotate(${locked}rad)`, offset: 0.4 }, { transform: `rotate(${locked}rad)` }], { duration: MOMENT });
    cart.style.transformOrigin = `${(WHEELS[1] + 2.5) * CELL}px ${H}px`;
    play(cart, [0, 0, 3, -1, 0].map((turn, i) => ({ transform: `rotate(${turn}deg)`, offset: [0, 0.45, 0.72, 0.88, 1][i], easing: IN_OUT })), { duration: MOMENT + T2, composite: "add" });
    // Its own momentum throws the bucket forward as it stops.
    later(MOMENT - 100, () => play(bucket, [{ transform: "rotate(0deg)" }, { transform: "rotate(58deg)" }], { duration: T4, easing: SPRING }));

    const circles = [...ring.querySelectorAll("circle")], gap = lit.length ? Math.max(18, Math.min(60, 600 / lit.length)) : 0;
    const POUR = MOMENT + 180, poured = POUR + lit.length * gap, stoned = poured + stones.length * 130;
    let left = lit.length;
    // What is in the bucket slides down it to the low lip and falls from there, so the heap drains toward the lip.
    const slide = (node: SVGElement | undefined, x: number, y: number, ms: number) => {
      if (!node) return;
      play(node, [{ transform: `translate(${x}px, ${y}px)` }, { transform: `translate(${LIP[0] - 1}px, ${LIP[1] - 1.4}px)` }], { duration: SLIDE, easing: "ease-in" });
      later(ms, () => node.setAttribute("visibility", "hidden"));
    };
    const drained = new Set<number>();
    lit.forEach((_, k) => later(Math.max(0, POUR + k * gap - SLIDE), () => {
      const h = Math.floor((k * heap.length) / lit.length), dot = heap[h];
      if (!dot || drained.has(h)) return;
      drained.add(h);
      // A circle is placed by its centre, so its slide is measured from there.
      play(dot, [{ transform: "translate(0, 0)" }, { transform: `translate(${LIP[0] - 1 - Number(dot.getAttribute("cx"))}px, ${LIP[1] - 1.4 - Number(dot.getAttribute("cy"))}px)` }], { duration: SLIDE, easing: "ease-in" });
      later(SLIDE, () => dot.setAttribute("visibility", "hidden"));
    }));
    lit.forEach((n, k) => later(POUR + k * gap, () => {
      const c = circles[n];
      // A dot the ring doesn't have still counts as poured, or the ring would never be told it is full.
      if (!c) { if (--left === 0) calls.current.onPoured(); return; }
      const ore = document.createElement("span");
      ore.className = k < rich ? "cart-ore rich" : "cart-ore";
      ore.hidden = true;
      el.appendChild(ore);
      fly(ore, true, c, 0, () => {
        // The ore is the ring's dot from here: it lights where it landed, with the squash of a landing.
        c.classList.add("on");
        anims.push(c.animate([{ transform: "scale(1.55)" }, { transform: "scale(1)" }], { duration: T4, easing: OUT }));
        if (--left === 0) calls.current.onPoured();
      });
    }));
    if (!lit.length) later(POUR, () => calls.current.onPoured());
    stones.forEach((_, i) => later(Math.max(0, poured + i * 130 - SLIDE), () => {
      const [x = 0, y = 0] = (roughIn[i]?.getAttribute("transform") ?? "").match(/-?[\d.]+/g)?.map(Number) ?? [];
      slide(roughIn[i], x, y, SLIDE);
    }));
    stones.forEach((_, i) => later(poured + i * 130, () => {
      const slot = host.querySelectorAll(".review-cut > span")[i]?.querySelector(".gem");
      const rough = roughs[i];
      if (!slot || !rough) return calls.current.onStone(i);
      fly(rough, false, slot, 220, () => calls.current.onStone(i));
    }));

    // Emptied, the bucket drops back and the cart rolls off the other way out.
    later(stoned + 160, () => play(bucket, [{ transform: "rotate(58deg)" }, { transform: "rotate(0deg)" }], { duration: T4, easing: OUT }));
    later(stoned + 340, () => {
      // It gathers speed across the screen: the roll runs twice as far as the window's edge, so the cart crosses
      // the edge at the curve's fastest and is clipped there. Nothing waits on it (the mole is already coming up).
      // With the mole hanging off its lip it backs out the way it came, so it never rolls through him.
      roll(0, mole ? -2 * (stop + W + 20) : 2 * (bb.width - stop + 20), MOMENT, IN_OUT);
      play(rail, [{ opacity: 1 }, { opacity: 0 }], { duration: T4, delay: 260, easing: OUT });
    });
    later(stoned + 520, () => calls.current.onLeave());
    const rider = el.querySelector<HTMLElement>(".cart-mole"), seat = host.querySelector(".review-mole");
    if (!rider || !seat) later(stoned + 340 + MOMENT + 20, () => { calls.current.onFell?.(); calls.current.onDone(); });
    else {
      // Asleep he is drawn side on, already on his back (`doze`); awake he is the front view (`fall`). Each drawing's
      // middle sits elsewhere in the wrapper (which turns and scales about the foot of its box), so a place is worked
      // out for the middle of his body, and one drawing takes over from the other on the same spot.
      const place = (mid: readonly [number, number], cx: number, cy: number, turn: number, scale: number) => {
        const a = (turn * Math.PI) / 180, c = Math.cos(a), n = Math.sin(a);
        return `translate3d(${cx - scale * (mid[0] * c - mid[1] * n)}px, ${cy - scale * (mid[0] * n + mid[1] * c)}px, 0) rotate(${turn}deg) scale(${scale})`;
      };
      const x = stop + W / 2 - 2, y = floor - 30 - DOZE * 45, ground = rider.parentElement!;
      const asleep = (cx: number, cy: number, turn: number) => place(SLEEPER, cx, cy, turn, DOZE);
      // Squash and stretch: his body is pulled long (over 1) or pressed short along its own length, about its
      // middle and keeping its area, inside the wrapper that places him, so it never moves where he is.
      const body = rider.firstElementChild as HTMLElement;
      const about = (mid: readonly [number, number]) => { body.style.transformOrigin = `calc(50% + ${mid[0]}px) calc(100% + ${mid[1]}px)`; };
      const pull = (ks: number[], duration: number, easing: string) => play(body, ks.map((k) => ({ transform: `scale(${1 / k}, ${k})` })), { duration, easing });
      about(SLEEPER);
      play(rider, [{ transform: asleep(x - (stop + W + 20), y, 0) }, { transform: asleep(x, y, 0) }], { duration: MOMENT, easing: OUT });
      // The bucket tips under him, and while his bed pours out he slides down it, slowly, then faster, until he
      // hangs past the lip (Tyler, 2026-11-13: "he should be sliding slowly off the cart before fully falling").
      // From the tip on he is drawn over the cart, so its rim never crosses him.
      const tip = MOMENT - 100, tipped = [x + 40, y - 16, SLID] as const;
      let end = [x + 61, y + 14, SLID] as [number, number, number];
      later(tip, () => { ground.style.zIndex = "1"; play(rider, [{ transform: asleep(x, y, 0) }, { transform: asleep(...tipped) }], { duration: T4, easing: SPRING }); });
      later(tip + T4, () => {
        // The lip of the tipped bucket: he ends with his middle well past it, head and shoulders in the open.
        const o = el.getBoundingClientRect(), at2 = at(lip.getBoundingClientRect(), o);
        end = [at2.x + GIRTH * 0.85, at2.y - GIRTH * 0.53 - 2, SLID];
        const N = 14;
        // Most of the way in the last third: he creeps, then goes.
        play(rider, Array.from({ length: N + 1 }, (_, i) => { const t = (i / N) ** 3 * 0.8 + (i / N) * 0.2; return { transform: asleep(tipped[0] + (end[0] - tipped[0]) * t, tipped[1] + (end[1] - tipped[1]) * t, tipped[2] + (SLID - tipped[2]) * t) }; }), { duration: Math.max(T4, stoned + 160 - tip - T4), easing: "linear" });
      });
      // The bucket drops back, its lip flicking him up a little, and the cart backs out the way it came. He does
      // not: asleep on nothing, sagging; then awake with a start, up off nothing and bigger, limbs going; then down.
      const gone = stoned + 340, SLEEP = MOMENT - 100, BRACE = ms("--t-3", 200), START = 330, HANG = 780, SAG = 4, JUMP = 32, NEAR = 0.72;
      // Asleep on nothing he bobs with his breath, clear of the dirt line, so it reads as air and not a perch.
      later(stoned + 160, () => { play(cart, HOPPED.map((y) => ({ transform: `translateY(${y}px)` })), { duration: T4, easing: OUT, composite: "add" }); });
      later(stoned + 160, () => play(rider, [
        { transform: asleep(...end) }, { transform: asleep(end[0] + 3, end[1] - 6, end[2] - 5), easing: IN_OUT, offset: 0.2 },
        { transform: asleep(end[0], end[1] + SAG, end[2]), easing: IN_OUT, offset: 0.45 }, { transform: asleep(end[0], end[1] + SAG - 5, end[2] - 3), easing: IN_OUT, offset: 0.72 }, { transform: asleep(end[0], end[1] + SAG, end[2]) },
      ], { duration: gone + SLEEP - stoned - 160, easing: OUT }));
      // He braces before he starts (anticipation): a dip and a curl, still asleep to look at.
      later(gone + SLEEP, () => play(rider, [{ transform: asleep(end[0], end[1] + SAG, end[2]) }, { transform: asleep(end[0], end[1] + SAG + 7, end[2] + 14) }], { duration: BRACE, easing: OUT }));
      // Lying side on, his length runs across the drawing, so pressed short is the other way round.
      later(gone + SLEEP, () => pull([1, 1 / SQUASH], BRACE, OUT));
      // `flushSync`: his drawing and his place change in the same frame, on the same spot at the same size. He
      // starts up and over his hole, so the dive after it is straight down.
      let top = [0, 0] as [number, number];
      later(gone + SLEEP + BRACE, () => {
        flushSync(() => setPose("fall"));
        const o = el.getBoundingClientRect(), to = seat.getBoundingClientRect();
        const [cx, cy] = [end[0], end[1] + SAG + 7];
        top = [to.left - o.left + to.width / 2, cy - JUMP];
        // Pressed short in the brace, he starts up long, only a little way (Tyler, 2026-11-14: he should not go up
        // so much before he drops into his spot), and holds there staring.
        about(FALLER);
        pull([SQUASH, 1.16, 0.95, 1.03, 1], START, OUT);
        play(rider, [
          { transform: place(FALLER, cx, cy, SLID - 76, DOZE), easing: OUT },
          { transform: place(FALLER, cx, cy - JUMP - 4, 4, NEAR * 1.05), easing: IN_OUT, offset: 0.4 },
          { transform: place(FALLER, cx, cy - JUMP + 2, -2, NEAR * 0.98), easing: IN_OUT, offset: 0.7 },
          { transform: place(FALLER, cx, cy - JUMP, 0, NEAR) },
        ], { duration: START });
        // Then he looks down, runs on nothing across to over his hole, sinking as he goes, and stops.
        later(START, () => {
          play(rider, THRASH.map(([offset, turn, dy, across]) => ({ offset, transform: place(FALLER, cx + (top[0] - cx) * across, top[1] + dy, turn, NEAR), easing: IN_OUT })), { duration: HANG });
          pull([1, 0.97, 1.04, 0.97, 1.04, 0.97, 1.03, SQUASH], HANG, IN_OUT);
        });
      });
      later(gone + SLEEP + BRACE + START + HANG, () => {
        const o = el.getBoundingClientRect(), to = seat.getBoundingClientRect();
        // He drops into his hole feet first: nothing of him is drawn under the dirt line (F94), and he goes on
        // down until his helmet is out of sight. Then the hole is empty for a beat, and up he comes (`pop`).
        ground.style.clipPath = `inset(-9999px -9999px ${o.bottom - to.bottom + GROUND}px -9999px)`;
        const [cx, cy] = [top[0], top[1] + THRASH[THRASH.length - 1]![2]], ty = to.bottom - o.top - GROUND;
        // From rest, under his own slower gravity so the drop can be read: his feet meet the dirt at `hit`, and
        // at T his helmet is under it.
        const fallen = (px: number) => Math.sqrt((2 * Math.max(1, px)) / DIVE), hit = fallen(ty - cy - FEET * NEAR), T = fallen(ty - cy + CROWN), N = 16;
        play(rider, Array.from({ length: N + 1 }, (_, i) => {
          const t = (i / N) * T;
          return { transform: place(FALLER, cx, cy + 0.5 * DIVE * t * t, 0, NEAR + (1 - NEAR) * Math.min(1, t / hit)) };
        }), { duration: T * 1000, easing: "linear" });
        // Arms and helmet left behind over him, and longer the faster he goes.
        setPose("dive");
        pull([SQUASH, STRETCH], hit * 1000, "ease-in");
        // The hit, as his feet meet the dirt: it flies, and the ring takes the knock, nearest dots first.
        later(hit * 1000, () => {
          const hx = to.left - o.left + to.width / 2;
          DIRT.forEach(([vx, vy, r]) => {
            const d = document.createElement("span");
            d.className = "cart-dirt";
            d.style.width = d.style.height = `${r}px`;
            el.appendChild(d);
            // Up, over and back down to the dirt line it came from.
            const fall = -vy / (0.25 * GRAVITY), N2 = 10;
            play(d, Array.from({ length: N2 + 1 }, (_, j) => { const t = (j / N2) * fall; return { transform: `translate3d(${hx + vx * t}px, ${ty + vy * t + 0.5 * GRAVITY * 0.5 * t * t}px, 0)`, opacity: j === N2 ? 0 : 1 }; }), { duration: fall * 1000, easing: "linear" });
            later(fall * 1000, () => d.remove());
          });
          const rr = ring.getBoundingClientRect(), mid = rr.left + rr.width / 2;
          for (const c of circles) {
            const b = c.getBoundingClientRect(), far = Math.hypot(b.left + b.width / 2 - mid, b.top - rr.top);
            if (far > rr.width * 0.75) continue;
            const push = 1 - far / (rr.width * 0.75);
            anims.push(c.animate([{ transform: "translateY(0)" }, { transform: `translateY(${(KNOCK * push).toFixed(1)}px)`, offset: 0.3 }, { transform: "translateY(0)" }], { duration: T4, delay: far * 0.9, easing: OUT }));
          }
        });
        // He is gone from here as he comes up there, never two of him; the layer stays until his dirt has come down.
        later(T * 1000, () => flushSync(() => { setPose("gone"); calls.current.onFell?.(); }));
        later(hit * 1000 + SETTLE, () => calls.current.onDone());
      });
    }

    return () => {
      alive = false;
      timers.forEach(clearTimeout);
      anims.forEach((a) => a.cancel());
      cancelAnimationFrame(frame);
      if (rider?.parentElement) Object.assign(rider.parentElement.style, { clipPath: "", zIndex: "" });
    };
    // Plays once, for the session that just ended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  const load = Math.min(HEAP.length, lit.length);
  return (
    <div className="cart-tip" ref={layer} aria-hidden="true">
      <span className="cart-rail" />
      {/* Dots have gaps, and what lies behind a drawing would show through them. These fill a drawing's shape with
          the page behind its dots, so the mole and the bucket hide what they are in front of. */}
      <svg width="0" height="0" style={{ position: "absolute" }}>
        {([["cart-solid", 2.4], ["cart-solid-fine", 0.42]] as const).map(([id, r]) => (
          <filter key={id} id={id} x="-100%" y="-150%" width="300%" height="400%" colorInterpolationFilters="sRGB">
            <feMorphology in="SourceAlpha" operator="dilate" radius={r} result="shape" />
            <feFlood className="cart-solid-fill" />
            <feComposite operator="in" in2="shape" />
            <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        ))}
      </svg>
      {/* Before the cart, so he lies in the bucket, behind its near side. */}
      {mole && pose !== "gone" && (
        <span className="cart-ground"><span className="cart-mole"><span className="cart-mole-body">
          <Mole bare size={RIDER_PX} mood={pose} />
          {/* His snoring, in his wrapper so it stays over his head as the bucket tips him. */}
          {pose === "doze" && <svg className="cart-zzz" viewBox="0 0 28 22">{([[0, 16, 1.4], [9, 8, 1.7], [19, 0, 2]] as const).map(([x0, y0, p], n) => <g key={n}>{Z.map(([i, j]) => <circle key={`${i},${j}`} cx={x0 + (i + 0.5) * p} cy={y0 + (j + 0.5) * p} r={p * 0.4} />)}</g>)}</svg>}
        </span></span></span>
      )}
      <svg className="cart" width={W} height={H} viewBox={`0 ${-HEAD} 20 ${15 + HEAD}`}>
        {/* The rect fixes the group's box, so its foot is the same point whatever it carries. */}
        <g className="cart-bucket" style={{ transformOrigin: `${HINGE[0] + 4}px ${HINGE[1] + 12}px` }}>
          <rect x={-4} y={-12} width={28} height={24} fill="none" />
          {stones.slice(0, 3).map((color, i) => (
            <g key={i} className="cart-rough-in" data-color={color} transform={`translate(${7.2 + i * 3.2 - (Math.min(3, stones.length) - 1) * 1.6} ${load > 5 ? -6.6 : load ? -4.4 : -3.2})`}>
              <Gem kind="rough" size={ROUGH} />
            </g>
          ))}
          {HEAP.slice(HEAP.length - load).map(([x, y], i) => {
            // The heap drains from its first dot, as the rich ore pours first.
            const isRich = i < Math.ceil((Math.min(rich, lit.length) * load) / Math.max(1, lit.length));
            return <circle key={i} className={isRich ? "cart-ore-in rich" : "cart-ore-in"} cx={x} cy={y} r={isRich ? 1.7 : 1.3} />;
          })}
          {dots(BUCKET, 0, BUCKET_TOP)}
          <circle className="cart-lip" cx={LIP[0]} cy={LIP[1]} r={0.1} />
        </g>
        {dots([FRAME], 0, FRAME_ROW)}
        {WHEELS.map((x) => (
          <g key={x} className="cart-wheel">{dots(WHEEL, x, WHEEL_ROW)}</g>
        ))}
      </svg>
      {stones.map((color, i) => (
        <span key={i} className="cart-rough" data-color={color} hidden><Gem kind="rough" size={ROUGH * CELL} /></span>
      ))}
    </div>
  );
}
