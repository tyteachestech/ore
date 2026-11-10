import { existsSync, mkdirSync, readFileSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pendingItems } from "./ai/enrich.ts";
import type { Item } from "./items.ts";
import { paths, type Library } from "./library.ts";
import { MIN_REVIEWS_TO_OPTIMIZE } from "./optimize.ts";
import { readReviews } from "./reviews.ts";

// D8, D10: "runs when awake, catches up once". Once a day the first command that checks starts a background
// run that enriches what is still pending, which includes planning cards from the plain highlights of a
// source he is still reading once it has rested (D180); once a month that run also refits FSRS's parameters.
export const CATCH_UP_EVERY_MS = 20 * 3_600_000;
export const OPTIMIZE_EVERY_MS = 30 * 86_400_000;
// A source added in the last hour has its own background enrich running; the catch-up leaves it alone.
const FRESH_MS = 3_600_000;

const marker = (lib: Library) => join(lib.root, ".ore", "catch-up");

export function catchUpDue(lib: Library, now = new Date()): boolean {
  try {
    return now.getTime() - statSync(marker(lib)).mtimeMs >= CATCH_UP_EVERY_MS;
  } catch {
    return true;
  }
}

export function markCatchUp(lib: Library, now = new Date()) {
  const m = marker(lib);
  mkdirSync(dirname(m), { recursive: true });
  writeFileSync(m, now.toISOString() + "\n");
  utimesSync(m, now, now);
}

export function catchUpItems(lib: Library, now = new Date()): Item[] {
  return pendingItems(lib, now).filter((i) => now.getTime() - Date.parse(i.meta.captured_at) >= FRESH_MS);
}

/** Enough reviews, and the parameters are missing or a month old. */
export function optimizeDue(lib: Library, now = new Date()): boolean {
  if (readReviews(lib).length < MIN_REVIEWS_TO_OPTIMIZE) return false;
  const p = paths.fsrsParams(lib);
  if (!existsSync(p)) return true;
  try {
    const at = Date.parse((JSON.parse(readFileSync(p, "utf8")) as { computed_at?: string }).computed_at ?? "");
    return !(now.getTime() - at < OPTIMIZE_EVERY_MS);
  } catch {
    return true;
  }
}
