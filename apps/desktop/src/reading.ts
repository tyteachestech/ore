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

const PHONE = import.meta.env?.VITE_PHONE === "1";
/** The reading page (D26). On the phone, Auto follows the iPhone's Light or Dark mode, and is where it starts
 *  (D311: dark text on a light page reads better by day, a dark page is kinder at night).
 *  The Mac's window is always dark, so it offers no Auto. */
export const PAGES = [
  ...(PHONE ? [{ id: "auto", label: "Auto" } as const] : []),
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
] as const;
export type Page = "auto" | "dark" | "light";

/** The face a source reads in (D151): Charter, the book serif, or Geist, the interface sans. */
export const FONTS = [
  { id: "charter", label: "Charter" },
  { id: "geist", label: "Geist" },
] as const;
export type Font = (typeof FONTS)[number]["id"];

/** Room between lines, as Books, Kindle and Readwise offer it: each a step from the reader's own line height
 *  (the Mac's 1.65, the phone's 1.5, D310). */
export const SPACINGS = [
  { id: "tight", label: "Tight" },
  { id: "normal", label: "Normal" },
  { id: "loose", label: "Loose" },
] as const;
export type Spacing = (typeof SPACINGS)[number]["id"];

/** Text sizes in px, Books-style steps: one at a time near the default, bigger jumps above it. */
export const SIZES = [14, 15, 16, 17, 18, 20, 22, 24, 26] as const;
/** 17 on the Mac; 20 on the phone, about 35 letters a line as Books sets it (D310). */
export const DEFAULT_SIZE = PHONE ? 20 : 17;

/** The next size up (`by` 1) or down (-1) from `size`, held at the ends. */
export function stepSize(size: number, by: 1 | -1): number {
  const at = (SIZES as readonly number[]).indexOf(size);
  const i = at < 0 ? SIZES.indexOf(DEFAULT_SIZE) : at + by;
  return SIZES[Math.max(0, Math.min(SIZES.length - 1, i))]!;
}

type State = { width: Width; size: number; page: Page; font: Font; spacing: Spacing };
const root = document.documentElement;
const pick = <T extends string>(key: string, ids: readonly { id: T }[], fallback: T): T => {
  const v = load(key);
  return ids.some((x) => x.id === v) ? (v as T) : fallback;
};
const storedSize = Number(load("ore.size"));
let state: State = {
  width: pick("ore.width", WIDTHS, "medium"),
  size: (SIZES as readonly number[]).includes(storedSize) ? storedSize : DEFAULT_SIZE,
  page: pick("ore.page", PAGES, PHONE ? "auto" : "dark"),
  font: pick("ore.font", FONTS, "charter"),
  spacing: pick("ore.spacing", SPACINGS, "normal"),
};
const listeners = new Set<() => void>();
const places = new Set<() => () => void>();

/** Whether the device is in Dark mode, for Auto: the phone asks iOS (phone/appearance.ts). */
let systemDark = true;
/** The page as drawn: Auto resolved to Dark or Light. */
export const pageShown = (): "dark" | "light" => (state.page === "auto" ? (systemDark ? "dark" : "light") : state.page);

function paint() {
  root.dataset.width = state.width;
  root.dataset.page = pageShown();
  root.dataset.font = state.font;
  root.dataset.spacing = state.spacing;
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
  save("ore.spacing", state.spacing);
  listeners.forEach((l) => l());
}

export const setWidth = (width: Width) => set({ width });
export const setSize = (size: number) => set({ size });
export const setPage = (page: Page) => set({ page });
export const setFont = (font: Font) => set({ font });
/** iOS's mode came in or changed: Auto repaints, keeping the passage in view. */
export function setSystemDark(dark: boolean) {
  if (dark === systemDark) return;
  systemDark = dark;
  set({});
}
export const setSpacing = (spacing: Spacing) => set({ spacing });
export const bigger = () => set({ size: stepSize(state.size, 1) });
export const smaller = () => set({ size: stepSize(state.size, -1) });

/** `capture` runs just before a change and returns what puts the reader back after it. */
export function keepPlace(capture: () => () => void): () => void {
  places.add(capture);
  return () => {
    places.delete(capture);
  };
}

const BLOCKS = "p, li, h1, h2, h3, h4, h5, h6, pre, blockquote, tr, img";

/** The block at the top of `scroll`'s view inside `doc`: which one, counting down the text, and how far into it
 *  the view's top is (0 its top, 1 its foot). */
function topBlock(scroll: HTMLElement, doc: HTMLElement): { el: HTMLElement; index: number; at: number } | null {
  const top = scroll.getBoundingClientRect().top;
  const blocks = doc.querySelectorAll<HTMLElement>(BLOCKS);
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
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { el, index: found, at: r.height ? (top - r.top) / r.height : 0 };
}

/** Scrolls so the view's top is `at` of the way into `el`. */
function toBlock(scroll: HTMLElement, el: HTMLElement, at: number) {
  const n = el.getBoundingClientRect();
  scroll.scrollTop += n.top + at * n.height - scroll.getBoundingClientRect().top;
}

/** Finds the block at the top of `scroll`'s view inside `doc` and returns a function that scrolls it
 *  back to the same spot, as Books keeps your paragraph when the text size changes. */
export function placeOf(scroll: HTMLElement, doc: HTMLElement): () => void {
  const b = topBlock(scroll, doc);
  return b ? () => toBlock(scroll, b.el, b.at) : () => {};
}

/** His place in a source, to save: the block at the top of the view and how far into it, as "index:at". A
 *  passage, never a distance down the page: pictures above it change that distance as they load (F-new-place-by-passage). */
export function placeAt(scroll: HTMLElement, doc: HTMLElement): string | null {
  const b = topBlock(scroll, doc);
  return b ? `${b.index}:${+b.at.toFixed(3)}` : null;
}

/** Scrolls to a place `placeAt` saved; false when the text has no such block (nothing saved, or a shorter text now). */
export function toPlace(scroll: HTMLElement, doc: HTMLElement, place: string): boolean {
  const m = place.match(/^(\d+):([\d.]+)$/);
  const el = m && doc.querySelectorAll<HTMLElement>(BLOCKS)[+m[1]!];
  if (!m || !el) return false;
  toBlock(scroll, el, +m[2]!);
  return true;
}

/** The reading looks now, outside React. */
export const readingNow = (): State => state;

export function useReading(): State {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    readingNow,
  );
}
