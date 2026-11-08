import { useSyncExternalStore } from "react";
import { load, save } from "./util";

/** How the reading page looks (Apple Books, Readwise Reader): column width, text size and a light or
 *  dark page (D26). Per-viewer conveniences, so they live in localStorage. */
export const WIDTHS = [
  { id: "narrow", label: "Narrow" },
  { id: "medium", label: "Medium" },
  { id: "wide", label: "Wide" },
] as const;
export type Width = (typeof WIDTHS)[number]["id"];

export const PAGES = [
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
] as const;
export type Page = (typeof PAGES)[number]["id"];

/** The face a source reads in (D151): Charter, the book serif, or Geist, the interface sans. */
export const FONTS = [
  { id: "charter", label: "Charter" },
  { id: "geist", label: "Geist" },
] as const;
export type Font = (typeof FONTS)[number]["id"];

/** Text sizes in px, Books-style steps: one at a time near the default, bigger jumps above it. */
export const SIZES = [14, 15, 16, 17, 18, 20, 22, 24, 26] as const;
export const DEFAULT_SIZE = 17;

/** The next size up (`by` 1) or down (-1) from `size`, held at the ends. */
export function stepSize(size: number, by: 1 | -1): number {
  const at = (SIZES as readonly number[]).indexOf(size);
  const i = at < 0 ? SIZES.indexOf(DEFAULT_SIZE) : at + by;
  return SIZES[Math.max(0, Math.min(SIZES.length - 1, i))]!;
}

type State = { width: Width; size: number; page: Page; font: Font };
const root = document.documentElement;
const pick = <T extends string>(key: string, ids: readonly { id: T }[], fallback: T): T => {
  const v = load(key);
  return ids.some((x) => x.id === v) ? (v as T) : fallback;
};
const storedSize = Number(load("ore.size"));
let state: State = {
  width: pick("ore.width", WIDTHS, "medium"),
  size: (SIZES as readonly number[]).includes(storedSize) ? storedSize : DEFAULT_SIZE,
  page: pick("ore.page", PAGES, "dark"),
  font: pick("ore.font", FONTS, "charter"),
};
const listeners = new Set<() => void>();
const places = new Set<() => () => void>();

function paint() {
  root.dataset.width = state.width;
  root.dataset.page = state.page;
  root.dataset.font = state.font;
  root.style.setProperty("--read-size", `${state.size}px`);
}
paint();

/** Applies a change; the open reader keeps the same passage in view across the reflow. */
function set(next: Partial<State>) {
  const restore = [...places].map((capture) => capture());
  state = { ...state, ...next };
  paint();
  restore.forEach((r) => r());
  save("ore.width", state.width);
  save("ore.size", String(state.size));
  save("ore.page", state.page);
  save("ore.font", state.font);
  listeners.forEach((l) => l());
}

export const setWidth = (width: Width) => set({ width });
export const setSize = (size: number) => set({ size });
export const setPage = (page: Page) => set({ page });
export const setFont = (font: Font) => set({ font });
export const bigger = () => set({ size: stepSize(state.size, 1) });
export const smaller = () => set({ size: stepSize(state.size, -1) });

/** `capture` runs just before a change and returns what puts the reader back after it. */
export function keepPlace(capture: () => () => void): () => void {
  places.add(capture);
  return () => {
    places.delete(capture);
  };
}

/** Finds the block at the top of `scroll`'s view inside `doc` and returns a function that scrolls it
 *  back to the same spot, as Books keeps your paragraph when the text size changes. */
export function placeOf(scroll: HTMLElement, doc: HTMLElement): () => void {
  const top = scroll.getBoundingClientRect().top;
  const blocks = doc.querySelectorAll<HTMLElement>("p, li, h1, h2, h3, h4, h5, h6, pre, blockquote, tr, img");
  // Blocks run down the page in document order: the last one starting at or above the view's top.
  let lo = 0;
  let hi = blocks.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (blocks[mid]!.getBoundingClientRect().top <= top) (found = mid), (lo = mid + 1);
    else hi = mid - 1;
  }
  const el = blocks[found];
  if (!el) return () => {};
  const r = el.getBoundingClientRect();
  const at = r.height ? (top - r.top) / r.height : 0;
  return () => {
    const n = el.getBoundingClientRect();
    scroll.scrollTop += n.top + at * n.height - top;
  };
}

export function useReading(): State {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state,
  );
}
