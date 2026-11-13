import { useEffect, useRef, useState } from "react";
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
/** The mole riding the load: drawn at the size he stands at on the ring, shown smaller on the cart. */
const RIDER_PX = 96, RIDER = 0.7;
/** How long he hangs asleep where the cart was, and again awake, and how long he takes to fall. */
const HANG_MS = 300, FALL_MS = 520;

const dots = (rows: readonly string[], x0: number, y0: number) =>
  rows.flatMap((row, y) => [...row].map((t, x) => (t === "." ? null : <circle key={`${x},${y}`} className={`cart-${t}`} cx={x0 + x + 0.5} cy={y0 + y + 0.5} r={RADIUS[t]} />)));

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
 *  as the cart starts off (the mole comes up), `onDone` when it has gone. `mole`: he rides in asleep on the load and
 *  falls out onto the ring once the cart has left (D-new-cart-nap); `onFell` as he lands, and `onDone` waits for it. */
export function CartTip({ host, lit, rich = 0, stones, mole = false, onFell, onStone, onPoured, onLeave, onDone }: {
  mole?: boolean; onFell?: () => void;
  host: HTMLElement | null; lit: number[]; rich?: number; stones: (string | undefined)[];
  onStone: (i: number) => void; onPoured: () => void; onLeave: () => void; onDone: () => void;
}) {
  const layer = useRef<HTMLDivElement>(null);
  const calls = useRef({ onStone, onPoured, onLeave, onDone, onFell });
  calls.current = { onStone, onPoured, onLeave, onDone, onFell };
  // The mole asleep on the load (D-new-cart-nap) wakes once the cart has gone from under him.
  const [awake, setAwake] = useState(false);

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
    // Its own momentum throws the bucket forward as it stops.
    later(MOMENT - 100, () => play(bucket, [{ transform: "rotate(0deg)" }, { transform: "rotate(58deg)" }], { duration: T4, easing: SPRING }));

    const circles = [...ring.querySelectorAll("circle")], gap = lit.length ? Math.max(18, Math.min(60, 600 / lit.length)) : 0;
    const POUR = MOMENT + 180, poured = POUR + lit.length * gap, stoned = poured + stones.length * 130;
    let left = lit.length;
    lit.forEach((n, k) => later(POUR + k * gap, () => {
      // The heap drains as the ore leaves.
      heap[Math.floor((k * heap.length) / lit.length)]?.setAttribute("visibility", "hidden");
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
    stones.forEach((_, i) => later(poured + i * 130, () => {
      roughIn[i]?.setAttribute("visibility", "hidden");
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
      roll(0, 2 * (bb.width - stop + 20), MOMENT, IN_OUT);
      play(rail, [{ opacity: 1 }, { opacity: 0 }], { duration: T4, delay: 260, easing: OUT });
    });
    later(stoned + 520, () => calls.current.onLeave());
    const rider = el.querySelector<HTMLElement>(".cart-mole"), zzz = el.querySelector<HTMLElement>(".cart-zzz"), seat = host.querySelector(".review-mole");
    if (!rider || !seat) later(stoned + 340 + MOMENT + 20, () => { calls.current.onFell?.(); calls.current.onDone(); });
    else {
      // He lies on the load, head to the rear: his wrapper turns about the middle of his body (`Mole`'s whole body).
      const x = stop + W / 2 - 2, y = floor - 64, tipped = [x + 12, y + 6, -64] as const;
      const tf = (x: number, y: number, turn: number, scale: number) => `translate3d(${x}px, ${y}px, 0) rotate(${turn}deg) scale(${scale})`;
      if (zzz) { zzz.style.left = `${x - RIDER * 46}px`; zzz.style.top = `${y - RIDER * 96}px`; }
      play(rider, [{ transform: tf(x - (stop + W + 20), y, -90, RIDER) }, { transform: tf(x, y, -90, RIDER) }], { duration: MOMENT, easing: OUT });
      // The bucket tips under him: he slides to the lip and sleeps on while his bed pours out.
      later(MOMENT - 100, () => play(rider, [{ transform: tf(x, y, -90, RIDER) }, { transform: tf(...tipped, RIDER) }], { duration: T4, easing: SPRING }));
      later(stoned + 160, () => play(rider, [{ transform: tf(...tipped, RIDER) }, { transform: tf(x + 6, y, -90, RIDER) }], { duration: T4, easing: OUT }));
      // The cart leaves. He does not: a beat asleep on nothing, a beat running on it, then down.
      const gone = stoned + 340;
      later(gone + HANG_MS, () => setAwake(true));
      later(gone + 2 * HANG_MS, () => {
        const o = el.getBoundingClientRect(), to = seat.getBoundingClientRect(), dx = to.left - o.left + to.width / 2 - (x + 6), dy = to.bottom - o.top - y, N = 14;
        // Head over heels onto the ring, growing to the size he stands at, and up on his feet as he lands.
        play(rider, Array.from({ length: N + 1 }, (_, i) => { const t = i / N; return { transform: tf(x + 6 + dx * t, y + dy * t * t - 4 * 34 * t * (1 - t), -90 + 450 * t, RIDER + (1 - RIDER) * t) }; }), { duration: FALL_MS, easing: "linear" });
        later(FALL_MS, () => { rider.hidden = true; calls.current.onFell?.(); calls.current.onDone(); });
      });
    }

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
      {/* Before the cart, so he lies in the bucket, behind its near side. */}
      {mole && <span className="cart-mole"><Mole bare size={RIDER_PX} mood={awake ? "fall" : "nap"} /></span>}
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
      {mole && !awake && <span className="cart-zzz"><i>z</i><i>z</i><i>z</i></span>}
      {stones.map((color, i) => (
        <span key={i} className="cart-rough" data-color={color} hidden><Gem kind="rough" size={ROUGH * CELL} /></span>
      ))}
    </div>
  );
}
