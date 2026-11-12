// A picture in the text, opened over the whole screen as Books and Photos open one on the iPhone: it grows
// from where it sat, pinch or a double tap zooms it, a drag pans it once zoomed, and a tap or a swipe down
// puts it back where it was. The Mac's figure view (Reader.tsx FigureZoom) also draws boxes for exercises;
// on the phone a drag on the picture is the finger's, so that stays on the Mac.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";

export function FigureView({ img, from, onClose }: { img: HTMLImageElement; from: DOMRect; onClose: () => void }) {
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [open, setOpen] = useState(still);
  const [drag, setDrag] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const leaving = useRef(false);
  const tap = useRef<number | null>(null);
  const zoom = useRef<ReactZoomPanPinchRef>(null);
  /** The last tap's time and place: a second one close by soon after is a double tap (Photos: zoom in there, or out). */
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const moved = useRef(false);
  const swipe = useRef<{ y: number; t: number } | null>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const back = () => {
    if (leaving.current) return;
    leaving.current = true;
    setDrag(0);
    if (still || zoomed) close.current(); // zoomed in, it would shrink from the wrong place: it goes at once
    else setOpen(false);
  };
  useLayoutEffect(() => {
    img.style.visibility = "hidden";
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
    return () => {
      cancelAnimationFrame(id);
      img.style.visibility = "";
    };
  }, [img]);
  useEffect(() => () => void (tap.current && clearTimeout(tap.current)), []);
  // Fitted to the screen, edge to edge as Photos shows it; drawn at that size so it comes in sharp.
  const scale = Math.min(innerWidth / from.width, innerHeight / from.height);
  const w = from.width * scale;
  const h = from.height * scale;
  const left = (innerWidth - w) / 2;
  const top = (innerHeight - h) / 2;
  const shade = open ? Math.max(0, 1 - drag / 400) : 0;
  return createPortal(
    <div
      className={`figure-view${open ? " open" : ""}`}
      role="dialog"
      aria-label={img.alt || "Picture"}
      style={{ background: `color-mix(in srgb, var(--bg) ${Math.round(shade * 100)}%, transparent)`, transition: swipe.current ? "none" : undefined }}
      onTouchStart={(e) => {
        moved.current = e.touches.length > 1;
        swipe.current = !zoomed && e.touches.length === 1 ? { y: e.touches[0]!.clientY, t: e.timeStamp } : null;
      }}
      onTouchMove={(e) => {
        moved.current = true;
        if (!swipe.current || e.touches.length !== 1) return void (swipe.current = null, setDrag(0));
        setDrag(Math.max(0, e.touches[0]!.clientY - swipe.current.y));
      }}
      onTouchEnd={(e) => {
        const s = swipe.current;
        swipe.current = null;
        // Taps are counted here, not from click: iOS sends no second click once the zoom has taken the touch.
        const p = e.changedTouches[0];
        if (!moved.current && p && e.touches.length === 0) {
          e.preventDefault(); // no click follows: this handler is the tap
          const last = lastTap.current;
          if (last && e.timeStamp - last.t < 300 && Math.hypot(p.clientX - last.x, p.clientY - last.y) < 40) {
            lastTap.current = null;
            if (tap.current) (clearTimeout(tap.current), (tap.current = null));
            const z = zoom.current;
            if (zoomed) z?.resetTransform(200);
            else z?.setTransform(p.clientX * (1 - 2.5), p.clientY * (1 - 2.5), 2.5, 200);
          } else {
            lastTap.current = { t: e.timeStamp, x: p.clientX, y: p.clientY };
            if (tap.current) clearTimeout(tap.current);
            tap.current = window.setTimeout(() => {
              tap.current = null;
              if (!zoomed) back();
            }, 300);
          }
          return setDrag(0);
        }
        if (!s || drag < 6) return setDrag(0);
        if (drag > 100 || drag / Math.max(1, e.timeStamp - s.t) > 0.5) back();
        else setDrag(0);
      }}
      onClick={(e) => {
        e.stopPropagation();
        // A finger's taps are counted in onTouchEnd; a click with no touch before it (a mouse) puts it back.
        if (lastTap.current || tap.current || zoomed) return;
        back();
      }}
    >
      <TransformWrapper
        minScale={1}
        maxScale={6}
        ref={zoom}
        doubleClick={{ disabled: true }}
        panning={{ disabled: !zoomed, velocityDisabled: false }}
        onTransformed={(_, s) => setZoomed(s.scale > 1.01)}
      >
        <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }} contentStyle={{ width: "100%", height: "100%" }}>
          <img
            src={img.currentSrc || img.src}
            alt={img.alt}
            draggable={false}
            style={{
              left,
              top,
              width: w,
              height: h,
              transform: open ? `translateY(${drag}px)` : `translate(${from.left - left}px, ${from.top - top}px) scale(${1 / scale})`,
              transition: swipe.current ? "none" : undefined,
            }}
            onTransitionEnd={(e) => e.propertyName === "transform" && leaving.current && close.current()}
          />
        </TransformComponent>
      </TransformWrapper>
    </div>,
    document.body,
  );
}
