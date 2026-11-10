import { useEffect, useRef } from "react";
import { Gem } from "./Gem";

/* The end of a session (D190, Tyler's pick B of three): the ore cart that rode Review's rail rolls in over the
   ring, brakes, and its bucket tips. One dot of ore per ring dot this session lit falls out on a real arc
   (gravity, no easing curve) and becomes that dot; one rough stone per memory that went solid drops to its place
   and is cut. Then the cart rolls off. Drawn as the mole is: round dots on a grid, shade by dot size. */

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

const dots = (rows: readonly string[], x0: number, y0: number) =>
  rows.flatMap((row, y) => [...row].map((t, x) => (t === "." ? null : <circle key={`${x},${y}`} className={`cart-${t}`} cx={x0 + x + 0.5} cy={y0 + y + 0.5} r={RADIUS[t]} />)));

const GRAVITY = 2600, HOP = -90;
/** A throw from rest under gravity: how long it flies to land `dy` px lower, after a small hop up out of the bucket. */
export const flight = (dy: number) => (-HOP + Math.sqrt(HOP * HOP + 2 * GRAVITY * Math.max(0, dy))) / GRAVITY;
/** Where it is `t` seconds into a flight of `T` seconds that ends `dx`, `dy` away. */
export const along = (dx: number, dy: number, T: number, t: number): [number, number] => [(dx * t) / T, HOP * t + ((dy - HOP * T) / (T * T)) * t * t];

type Flying = { el: HTMLElement; x0: number; y0: number; dx: number; dy: number; T: number; t0: number; spin: number; land: () => void };

/** `host` is the end screen. `lit` are the ring dots to light, in order; `stones` the colours of the gems cut
 *  (already capped to those shown). `onStone(i)` when stone i lands, `onPoured` when the ring is full, `onLeave`
 *  as the cart starts off (the mole comes up), `onDone` when it has gone. */
export function CartTip({ host, lit, stones, onStone, onPoured, onLeave, onDone }: {
  host: HTMLElement | null; lit: number[]; stones: (string | undefined)[];
  onStone: (i: number) => void; onPoured: () => void; onLeave: () => void; onDone: () => void;
}) {
  const layer = useRef<HTMLDivElement>(null);
  const calls = useRef({ onStone, onPoured, onLeave, onDone });
  calls.current = { onStone, onPoured, onLeave, onDone };

  useEffect(() => {
    const el = layer.current, ring = host?.querySelector<SVGSVGElement>(".ring .dot-ring"), body = host?.closest<HTMLElement>(".review-body");
    if (!el || !host || !ring || !body) { calls.current.onPoured(); calls.current.onLeave(); calls.current.onDone(); return; }
    const css = getComputedStyle(el), OUT = css.getPropertyValue("--ease-out").trim() || "ease-out", SPRING = css.getPropertyValue("--ease-spring").trim() || "ease-out";
    // The layer spans the window's width, so the cart comes from one edge and leaves by the other.
    const hb = host.getBoundingClientRect(), bb = body.getBoundingClientRect(), rb = ring.getBoundingClientRect();
    el.style.left = `${bb.left - hb.left}px`;
    el.style.width = `${bb.width}px`;
    const at = (r: DOMRect) => ({ x: r.left - bb.left + r.width / 2, y: r.top - hb.top + r.height / 2 });
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
        if (t >= f.T) { flying.splice(i, 1); f.el.remove(); f.land(); continue; }
        const [x, y] = along(f.dx, f.dy, f.T, Math.max(0, t));
        f.el.style.transform = `translate3d(${f.x0 + x}px, ${f.y0 + y}px, 0) rotate(${f.spin * t}deg)`;
      }
      frame = flying.length ? requestAnimationFrame(tick) : 0;
    };
    const fly = (node: HTMLElement, to: { x: number; y: number }, spin: number, land: () => void) => {
      const from = at(lip.getBoundingClientRect());
      const dy = to.y - from.y, T = flight(dy);
      node.style.transform = `translate3d(${from.x}px, ${from.y}px, 0)`;
      node.hidden = false;
      flying.push({ el: node, x0: from.x, y0: from.y, dx: to.x - from.x, dy, T, t0: performance.now(), spin, land });
      if (!frame) frame = requestAnimationFrame(tick);
    };

    // In from the left, braking hard; the wheels turn as far as it rolls.
    const roll = (from: number, to: number, ms: number, easing: string) => {
      play(cart, [{ transform: `translateX(${from}px)` }, { transform: `translateX(${to}px)` }], { duration: ms, easing });
      for (const w of wheels) play(w, [{ transform: `rotate(${from / (2.5 * CELL)}rad)` }, { transform: `rotate(${to / (2.5 * CELL)}rad)` }], { duration: ms, easing });
    };
    play(rail, [{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: "ease-out" });
    roll(-(stop + W + 20), 0, 650, OUT);
    // Its own momentum throws the bucket forward as it stops.
    later(500, () => play(bucket, [{ transform: "rotate(0deg)" }, { transform: "rotate(58deg)" }], { duration: 360, easing: SPRING }));

    const circles = [...ring.querySelectorAll("circle")], gap = lit.length ? Math.max(18, Math.min(60, 600 / lit.length)) : 0;
    const POUR = 780, poured = POUR + lit.length * gap, stoned = poured + stones.length * 130;
    let left = lit.length;
    lit.forEach((n, k) => later(POUR + k * gap, () => {
      // The heap drains as the ore leaves.
      heap[Math.floor((k * heap.length) / lit.length)]?.setAttribute("visibility", "hidden");
      const c = circles[n];
      if (!c) return;
      const ore = document.createElement("span");
      ore.className = "cart-ore";
      ore.hidden = true;
      el.appendChild(ore);
      fly(ore, at(c.getBoundingClientRect()), 0, () => {
        // The ore is the ring's dot from here: it lights where it landed, with the squash of a landing.
        c.classList.add("on");
        anims.push(c.animate([{ transform: "scale(1.55)" }, { transform: "scale(1)" }], { duration: 280, easing: OUT }));
        if (--left === 0) calls.current.onPoured();
      });
    }));
    if (!lit.length) later(POUR, () => calls.current.onPoured());
    stones.forEach((_, i) => later(poured + i * 130, () => {
      roughIn[i]?.setAttribute("visibility", "hidden");
      const slot = host.querySelectorAll(".review-cut > span")[i]?.querySelector(".gem");
      const rough = roughs[i];
      if (!slot || !rough) return calls.current.onStone(i);
      fly(rough, at(slot.getBoundingClientRect()), 220, () => calls.current.onStone(i));
    }));

    // Emptied, the bucket drops back and the cart rolls off the other way out.
    later(stoned + 160, () => play(bucket, [{ transform: "rotate(58deg)" }, { transform: "rotate(0deg)" }], { duration: 260, easing: OUT }));
    later(stoned + 340, () => {
      // An object leaving speeds up as it goes; nothing waits on it (the mole is already coming up).
      roll(0, bb.width - stop + 20, 560, "cubic-bezier(0.5, 0, 0.9, 0.5)");
      play(rail, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, delay: 260, easing: "ease-out" });
    });
    later(stoned + 520, () => calls.current.onLeave());
    later(stoned + 920, () => calls.current.onDone());

    return () => {
      alive = false;
      timers.forEach(clearTimeout);
      anims.forEach((a) => a.cancel());
      cancelAnimationFrame(frame);
    };
    // Plays once, for the session that just ended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  const load = Math.min(HEAP.length, lit.length);
  return (
    <div className="cart-tip" ref={layer} aria-hidden="true">
      <span className="cart-rail" />
      <svg className="cart" width={W} height={H} viewBox={`0 ${-HEAD} 20 ${15 + HEAD}`}>
        {/* The rect fixes the group's box, so its foot is the same point whatever it carries. */}
        <g className="cart-bucket" style={{ transformOrigin: `${HINGE[0] + 4}px ${HINGE[1] + 12}px` }}>
          <rect x={-4} y={-12} width={28} height={24} fill="none" />
          {stones.slice(0, 3).map((color, i) => (
            <g key={i} className="cart-rough-in" data-color={color} transform={`translate(${7.2 + i * 3.2 - (Math.min(3, stones.length) - 1) * 1.6} ${load > 5 ? -6.6 : load ? -4.4 : -3.2})`}>
              <Gem kind="rough" size={ROUGH} />
            </g>
          ))}
          {HEAP.slice(HEAP.length - load).map(([x, y], i) => <circle key={i} className="cart-ore-in" cx={x} cy={y} r={1.3} />)}
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
