import type { EditorView } from "@milkdown/kit/prose/view";
import type { Transaction } from "@milkdown/kit/prose/state";
import { useEffect, useRef, useState, type RefObject } from "react";
import { DotsSix } from "../icons";
import { label, useKeymap } from "../keys";
import { MoreButton, WithMenu, type MenuAction } from "../Menu";
import { blockAt, duplicate, gaps, kindOf, KINDS, moveBy, moveTo, remove, turnInto, type Block, type Gap } from "./blockops";

type Box = { x: number; y: number; w: number; h: number };
type Spot = { gap: Gap; y: number; left: number; right: number };

/** Notion's ⋮⋮ beside the block under the pointer: drag it to move the block (a line shows where it
 *  lands, Esc cancels), click it or right-click it for the block's menu (Turn into, Duplicate, Move,
 *  Delete). Each action is one editor step, so ⌘Z takes it back. Not on the phone: no pointer to hover. */
export function BlockHandle({ view, host }: { view: () => EditorView | undefined; host: RefObject<HTMLElement | null> }) {
  const keys = useKeymap();
  const viewNow = useRef(view);
  viewNow.current = view;
  /** The block the handle is on, by the position it starts at, and where the handle and block sit. */
  const [at, setAt] = useState<{ from: number; handle: { x: number; y: number }; box: Box } | null>(null);
  const [open, setOpen] = useState(false);
  const [line, setLine] = useState<Box | null>(null);
  const busy = useRef(false); // a drag or an open menu keeps the handle where it is
  busy.current = open || line !== null;

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const move = (e: MouseEvent) => {
      const v = viewNow.current();
      if (!v || busy.current || dragging.current) return;
      const r = v.dom.getBoundingClientRect();
      if (e.clientY < r.top || e.clientY > r.bottom) return setAt(null);
      const hit = v.posAtCoords({ left: Math.min(Math.max(e.clientX, r.left + 1), r.right - 1), top: e.clientY });
      const b = hit && blockAt(v.state.doc, hit.pos);
      setAt(b ? place(v, el, b) : null);
    };
    const leave = () => !busy.current && !dragging.current && setAt(null);
    el.addEventListener("mousemove", move);
    el.addEventListener("mouseleave", leave);
    return () => {
      el.removeEventListener("mousemove", move);
      el.removeEventListener("mouseleave", leave);
    };
  }, [host]);

  // A drag: press on the handle, move past 4 px, release over a gap. A press that never moved is a click.
  const dragging = useRef(false);
  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    const v = view();
    const el = host.current;
    if (e.button !== 0 || !v || !el || !at) return;
    e.preventDefault(); // the menu opens on the click, not the press
    const b = blockAt(v.state.doc, at.from + 1);
    if (!b) return;
    const start = { x: e.clientX, y: e.clientY };
    let spots: Spot[] | null = null;
    let to: Spot | null = null;
    const h = el.getBoundingClientRect();
    const onMove = (m: PointerEvent) => {
      if (!spots) {
        if (Math.hypot(m.clientX - start.x, m.clientY - start.y) < 4) return;
        dragging.current = true;
        spots = gaps(v.state.doc, b).map((g) => spot(v, g));
      }
      to = nearest(spots, m.clientX, m.clientY);
      setLine(to ? { x: to.left - h.left, y: to.y - h.top - 1, w: to.right - to.left, h: 2 } : null);
    };
    const end = (drop: boolean) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey, true);
      const was = dragging.current;
      dragging.current = false;
      setLine(null);
      if (!was) return void (drop && setOpen(true));
      if (drop && to) {
        v.dispatch(moveTo(v.state, b, to.gap));
        v.focus();
      }
      setAt(null);
    };
    const onUp = () => end(true);
    const onKey = (k: KeyboardEvent) => {
      if (k.key !== "Escape") return;
      k.preventDefault();
      k.stopPropagation();
      end(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey, true);
  };

  const actions = (): MenuAction[] => {
    const v = view();
    const b = v && at ? blockAt(v.state.doc, at.from + 1) : null;
    if (!v || !b) return [];
    const run = (make: (b: Block) => Transaction | null) => () => {
      const now = blockAt(v.state.doc, b.from + 1);
      const tr = now && make(now);
      if (tr) v.dispatch(tr);
      v.focus();
      setAt(null);
    };
    const kind = kindOf(v.state.doc, b);
    return [
      { id: "turn", label: "Turn into", run: () => {}, sub: KINDS.map((k) => ({ id: k.kind, label: k.label, checked: k.kind === kind, run: run((x) => turnInto(v.state, x, k.kind)) })) },
      { id: "duplicate", label: "Duplicate", hint: label(keys["block-duplicate"]), run: run((x) => duplicate(v.state, x)) },
      { id: "up", label: "Move up", hint: label(keys["block-up"]), run: run((x) => moveBy(v.state, x, -1)) },
      { id: "down", label: "Move down", hint: label(keys["block-down"]), run: run((x) => moveBy(v.state, x, 1)) },
      { id: "delete", label: "Delete", danger: true, divider: true, run: run((x) => remove(v.state, x)) },
    ];
  };

  if (!at) return null;
  return (
    <>
      {(open || line) && <div className="block-on" style={{ left: at.box.x, top: at.box.y, width: at.box.w, height: at.box.h }} />}
      {line && <div className="block-drop" style={{ left: line.x, top: line.y, width: line.w }} />}
      <div className="block-handle" style={{ left: at.handle.x, top: at.handle.y }}>
        <WithMenu actions={actions} keepFocus>
          <MoreButton
            label="Block actions"
            className={`block-grip${open ? " on" : ""}`}
            icon={<DotsSix size={16} aria-hidden="true" />}
            hint={<>Drag to move<br />Click for the menu</>}
            align="start"
            keepFocus
            actions={actions}
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (!o) setAt(null);
            }}
            onPointerDown={onPointerDown}
          />
        </WithMenu>
      </div>
    </>
  );
}

/** Where the handle sits for a block: left of its bullet or text, centred on its first line. */
function place(v: EditorView, host: HTMLElement, b: Block) {
  const h = host.getBoundingClientRect();
  const own = v.nodeDOM(b.from) as HTMLElement | null;
  // An item's handle sits left of its bullet, which is drawn in its list's padding.
  const edge = (b.item ? (v.nodeDOM(v.state.doc.resolve(b.from).before()) as HTMLElement | null) : own) ?? own;
  if (!own?.getBoundingClientRect || !edge?.getBoundingClientRect) return null;
  const r = own.getBoundingClientRect();
  let first = b.node.isTextblock ? b.from + 1 : -1;
  if (first < 0)
    b.node.descendants((n, p) => {
      if (first < 0 && n.isTextblock && n.content.size) first = b.from + 1 + p + 1;
      return first < 0;
    });
  const c = first >= 0 ? v.coordsAtPos(first) : { top: r.top, bottom: r.top + 24 };
  return {
    from: b.from,
    handle: { x: edge.getBoundingClientRect().left - h.left - 22, y: (c.top + c.bottom) / 2 - h.top - 12 },
    box: { x: r.left - h.left, y: r.top - h.top, w: r.width, h: r.height },
  };
}

/** A gap's line: halfway between the blocks on either side, as wide as the list or note it is in. */
function spot(v: EditorView, gap: Gap): Spot {
  const $p = v.state.doc.resolve(gap.pos);
  const rect = (pos: number) => (v.nodeDOM(pos) as HTMLElement).getBoundingClientRect();
  const before = $p.nodeBefore ? rect(gap.pos - $p.nodeBefore.nodeSize) : null;
  const after = $p.nodeAfter ? rect(gap.pos) : null;
  const y = before && after ? (before.bottom + after.top) / 2 : before ? before.bottom + 3 : after!.top - 3;
  const outer = v.dom.getBoundingClientRect();
  const left = $p.depth === 0 ? outer.left : (after ?? before)!.left;
  return { gap, y, left, right: outer.right };
}

/** The gap nearest the pointer; of gaps at about the same height, the deepest one left of the pointer
 *  (Notion's indent by moving right). */
function nearest(spots: Spot[], x: number, y: number): Spot | null {
  if (!spots.length) return null;
  const best = Math.min(...spots.map((s) => Math.abs(s.y - y)));
  const close = spots.filter((s) => Math.abs(s.y - y) <= best + 8);
  const under = close.filter((s) => s.left <= x);
  return (under.length ? under : close).reduce((a, s) => (s.left > a.left ? s : a));
}
