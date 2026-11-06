import type { Transcript } from "./ore";
import { plainSkeleton, type TextIndex } from "./text";

// Transcript words (D49) located in the rendered reader text, so playback time maps to a DOM range
// and a DOM point maps back to a time. Built from the same TextIndex the highlights use.

/** Matched words only, in order: skeleton offsets of each word's first and last char, and its start time. */
export type WordMap = { pos: Int32Array; end: Int32Array; time: Float64Array };

const inStamp = (idx: TextIndex, at: number) => !!idx.nodes[idx.node[at]!]!.parentElement?.closest(".ts");

/** Walks the words in order against the rendered text, from the first [mm:ss] on: a page with its
 *  video (D92) has the page's text above the transcript. A word that is not found nearby (the rendered
 *  body can drop a leading title) is skipped; misses widen the next search. */
export function alignWords(idx: TextIndex, words: Transcript["words"]): WordMap {
  const pos: number[] = [];
  const end: number[] = [];
  const time: number[] = [];
  const stamp = idx.nodes.findIndex((n) => n.parentElement?.closest(".ts"));
  let cursor = stamp < 0 ? 0 : idx.first.get(idx.nodes[stamp]!) ?? 0;
  let miss = 0;
  for (const [t, w] of words) {
    const s = plainSkeleton(w);
    if (!s) continue;
    const reach = pos.length ? 200 * (1 + miss) : Infinity;
    let p = idx.chars.indexOf(s, cursor);
    while (p >= 0 && p - cursor <= reach && inStamp(idx, p)) p = idx.chars.indexOf(s, p + 1);
    if (p < 0 || p - cursor > reach) {
      miss++;
      continue;
    }
    miss = 0;
    pos.push(p);
    end.push(p + s.length - 1);
    time.push(t);
    cursor = p + s.length;
  }
  return { pos: Int32Array.from(pos), end: Int32Array.from(end), time: Float64Array.from(time) };
}

/** Last index whose value is ≤ x, or -1. */
function last(arr: ArrayLike<number>, x: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid]! <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
}

/** The word being spoken at `t` seconds, or -1 before the first. */
export const wordAtTime = (m: WordMap, t: number) => last(m.time, t);

/** The word at or after a skeleton offset (a selection's start, an ⌥-click). */
export function wordAtOffset(m: WordMap, at: number): number {
  const i = last(m.end, at - 1) + 1;
  return Math.min(i, m.pos.length - 1);
}

/** A DOM range over skeleton chars [from, to]. */
export function skeletonRange(idx: TextIndex, from: number, to: number, range = document.createRange()): Range {
  range.setStart(idx.nodes[idx.node[from]!]!, idx.off[from]!);
  range.setEnd(idx.nodes[idx.node[to]!]!, idx.off[to]! + 1);
  return range;
}

/** A transcript's spoken time for a passage: the last `[mm:ss]` stamp at or before it, as the player shows it. */
export function stampBefore(body: string, at: number): string | undefined {
  let sec: number | undefined;
  for (const m of body.slice(0, at + 12).matchAll(/\[(?:(\d+):)?(\d+):(\d{2})(?:\.\d+)?\]/g)) {
    if (m.index! > at) break;
    sec = Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  }
  if (sec === undefined) return undefined;
  const h = Math.floor(sec / 3600), mm = Math.floor(sec / 60) % 60, ss = String(sec % 60).padStart(2, "0");
  return h ? `${h}:${String(mm).padStart(2, "0")}:${ss}` : `${mm}:${ss}`;
}
