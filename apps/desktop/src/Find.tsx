import { ArrowDown, ArrowUp, X } from "./icons";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Hint } from "./Hint";

// Find in the open source (⌘F), the Claude app's and Safari's find bar: one list over every pane
// on screen, the source first and then the side panel, so the count reads left to right as he sees
// it. Matches paint with the CSS Custom Highlight API in their own colour, never as highlights.

const FOLD: Record<string, string> = { "’": "'", "‘": "'", "“": '"', "”": '"' };

/** Case, curly quotes and whitespace folded one character for one, so offsets stay put. */
export function fold(s: string): string {
  // Whole-string lowercase when it keeps the length (almost always): a book folds in milliseconds,
  // where a callback per character took ~100 ms a keystroke.
  const lower = s.toLowerCase();
  if (lower.length === s.length) return lower.replace(/[^\S ]|[’‘“”]/g, (c) => FOLD[c] ?? " ");
  return s.replace(/[\s\S]/g, (c) => {
    if (/\s/.test(c)) return " ";
    const f = FOLD[c] ?? c.toLowerCase();
    return f.length === 1 ? f : c;
  });
}

/** Where `needle` starts in `hay`, without overlaps, ignoring case. */
export function findAll(hay: string, needle: string): number[] {
  const n = fold(needle);
  if (!n.trim()) return [];
  const h = fold(hay);
  const at: number[] = [];
  for (let i = h.indexOf(n); i >= 0; i = h.indexOf(n, i + n.length)) at.push(i);
  return at;
}

// Text that is not the source or the note: overlays, controls, the find bar.
const SKIP = ".marks, .margin, .popup, .tip, .player-pin, .find-bar, button, [aria-hidden=true]";
const BLOCK = "p, li, h1, h2, h3, h4, h5, h6, blockquote, pre, td, th, figcaption, dt, dd, div";
// Never inside a match: it stops one from running across two paragraphs.
const BREAK = "\u0000";

/** Every match of `query` under `roots`, in order, as ranges. */
export function search(roots: HTMLElement[], query: string): Range[] {
  const out: Range[] = [];
  for (const root of roots) {
    const nodes: Text[] = [];
    const starts: number[] = [];
    let text = "";
    let block: Element | null = null;
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => {
        const el = n.parentElement;
        if (!el || !n.nodeValue || el.closest(SKIP)) return NodeFilter.FILTER_REJECT;
        // A collapsed toggle in the note, a hidden tab: nothing to scroll to.
        if (el.checkVisibility?.() === false) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    for (let n = walk.nextNode() as Text | null; n; n = walk.nextNode() as Text | null) {
      const b = n.parentElement!.closest(BLOCK);
      if (b !== block) text += BREAK;
      block = b;
      starts.push(text.length);
      nodes.push(n);
      text += n.nodeValue;
    }
    /** The text node holding character `i` of `text`. */
    const nodeAt = (i: number) => {
      let lo = 0;
      let hi = starts.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (starts[mid]! <= i) lo = mid;
        else hi = mid - 1;
      }
      return lo;
    };
    for (const i of findAll(text, query)) {
      const a = nodeAt(i);
      const b = nodeAt(i + query.length - 1);
      const r = document.createRange();
      r.setStart(nodes[a]!, i - starts[a]!);
      r.setEnd(nodes[b]!, i + query.length - starts[b]!);
      out.push(r);
    }
  }
  return out;
}

/** Runs `go` once `query` is in the text under `root` (a note still loading), or after about a second
 *  without it, so a ⌘K jump opens the find bar on the match. Returns the cancel. */
export function onceFound(root: () => HTMLElement | null | undefined, query: string, go: () => void): () => void {
  let n = 0;
  let raf = 0;
  const look = () => {
    const el = root();
    if ((el && search([el], query).length) || ++n > 60) go();
    else raf = requestAnimationFrame(look);
  };
  look();
  return () => cancelAnimationFrame(raf);
}

/** The nearest ancestor that scrolls. */
function scrollerOf(node: Node): HTMLElement | null {
  for (let el = node.parentElement; el; el = el.parentElement) {
    const o = getComputedStyle(el).overflowY;
    if ((o === "auto" || o === "scroll") && el.scrollHeight > el.clientHeight) return el;
  }
  return null;
}

/** The part of a scroller he can see: below the pinned video player when there is one. */
function viewOf(el: HTMLElement) {
  const box = el.getBoundingClientRect();
  const pin = el.querySelector(".player-pin")?.getBoundingClientRect();
  return { top: Math.max(box.top, pin && pin.bottom > box.top ? pin.bottom : box.top), bottom: box.bottom };
}

/** Brings a match into view a third of the way down, as the quiz's passages do (D55); left alone when already in view. */
function reveal(r: Range) {
  const el = scrollerOf(r.startContainer);
  const rect = r.getBoundingClientRect();
  if (!el || !rect.height) return;
  const v = viewOf(el);
  if (rect.top >= v.top && rect.bottom <= v.bottom) return;
  el.scrollTop += rect.top - (v.top + (v.bottom - v.top) / 3);
}

function paint(all: Range[], on: Range | undefined) {
  // Above highlights and the spoken text, so the current match always reads.
  const h = new Highlight(...all.filter((r) => r !== on));
  h.priority = 2;
  CSS.highlights.set("find", h);
  if (!on) return void CSS.highlights.delete("find-on");
  const cur = new Highlight(on);
  cur.priority = 3;
  CSS.highlights.set("find-on", cur);
}

/** The find bar at the top right of the source. `roots` lists what it searches, left to right;
 *  `within` is watched so typing in the note or the source finishing loading updates the count. */
export function FindBar({ roots, within, query, onQuery, focus, onClose, onJump }: {
  roots: () => (HTMLElement | null | undefined)[];
  within: HTMLElement | null;
  query: string;
  onQuery: (q: string) => void;
  /** Bumped by ⌘F while the bar is open: focus the field again and select what is in it. */
  focus: number;
  onClose: () => void;
  /** Called before a step scrolls the source (a video stops following the speaker). */
  onJump?: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [found, setFound] = useState<Range[]>([]);
  const [at, setAt] = useState(0);
  const atRef = useRef(at);
  atRef.current = at;

  useLayoutEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, [focus]);

  // A new query starts at the first match he can see, or the next one below it, as a browser does.
  useEffect(() => {
    const rs = search(roots().filter((r): r is HTMLElement => !!r), query);
    let i = 0;
    const first = rs[0] && scrollerOf(rs[0].startContainer);
    if (first) {
      const top = viewOf(first).top;
      const j = rs.findIndex((r) => r.getBoundingClientRect().bottom > top);
      if (j >= 0) i = j;
    }
    setFound(rs);
    setAt(i);
    if (rs[i]) {
      onJump?.();
      reveal(rs[i]!);
    }
  }, [query]);

  // The text changed under it (the note typed in, the book still mounting): count again, same place.
  useEffect(() => {
    if (!within) return;
    let t = 0;
    const mo = new MutationObserver((ms) => {
      if (ms.every((m) => (m.target as Element).closest?.(".find-bar") || m.target.parentElement?.closest(".find-bar"))) return;
      clearTimeout(t);
      t = window.setTimeout(() => {
        const rs = search(roots().filter((r): r is HTMLElement => !!r), query);
        setFound(rs);
        setAt((i) => Math.min(i, Math.max(0, rs.length - 1)));
      }, 120);
    });
    mo.observe(within, { childList: true, subtree: true, characterData: true });
    return () => {
      mo.disconnect();
      clearTimeout(t);
    };
  }, [within, query]);

  useEffect(() => paint(found, found[at]), [found, at]);
  useEffect(() => () => {
    CSS.highlights.delete("find");
    CSS.highlights.delete("find-on");
  }, []);

  const step = (d: 1 | -1) => {
    if (!found.length) return;
    const i = (atRef.current + d + found.length) % found.length;
    setAt(i);
    onJump?.();
    reveal(found[i]!);
  };

  // ⌘G and ⇧⌘G step from anywhere while the bar is open (Safari, Notes).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyG" || !e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      step(e.shiftKey ? -1 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="find-bar" role="search">
      <input
        ref={input}
        aria-label="Find in source"
        placeholder="Find"
        spellCheck={false}
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        onKeyDown={(e) => {
          const plain = !e.metaKey && !e.ctrlKey && !e.altKey;
          if (plain && (e.key === "Enter" || e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            e.stopPropagation();
            step(e.key === "ArrowUp" || (e.key === "Enter" && e.shiftKey) ? -1 : 1);
          } else if (plain && e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }
        }}
      />
      {query.trim() && (
        <span className={`find-count${found.length ? "" : " none"}`} aria-live="polite">
          {found.length ? `${at + 1}/${found.length}` : "Not found"}
        </span>
      )}
      <span className="find-sep" />
      <Hint text={<>Previous match<kbd>⇧↵</kbd></>}>
        <button aria-label="Previous match" disabled={!found.length} onClick={() => step(-1)}>
          <ArrowUp size={14} aria-hidden="true" />
        </button>
      </Hint>
      <Hint text={<>Next match<kbd>↵</kbd></>}>
        <button aria-label="Next match" disabled={!found.length} onClick={() => step(1)}>
          <ArrowDown size={14} aria-hidden="true" />
        </button>
      </Hint>
      <Hint text={<>Close<kbd>Esc</kbd></>}>
        <button aria-label="Close find" onClick={onClose}>
          <X size={14} aria-hidden="true" />
        </button>
      </Hint>
    </div>
  );
}
