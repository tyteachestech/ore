import { load, save } from "./util";

/** What a source row can show besides its title and skills (D77, D108): picked per list from the
 *  row's right-click "Show" menu or the view menu, as columns on the right. Author is on until he turns
 *  it off (D114); Type is off, since the row's picture already says what kind it is. */
export type Detail = "type" | "author" | "site" | "added";
export const DETAILS: { id: Detail; label: string }[] = [
  { id: "type", label: "Type" },
  { id: "author", label: "Author" },
  { id: "site", label: "Site" },
  { id: "added", label: "Date added" },
];
const DEFAULT: Detail[] = ["author"];

const only = (v: unknown): Detail[] => DETAILS.map((d) => d.id).filter((id) => Array.isArray(v) && v.includes(id));

/** Each list's details, by view ("<skill or all>/<tab>"). A list never set takes what the one
 *  Mac-wide choice before D108 (`ore.columns`, author and date) said, plus Author. */
export function detailsOf(store: string | null, legacy: string | null, view: string): Detail[] {
  try {
    const all = JSON.parse(store ?? "{}");
    if (all && typeof all === "object" && Array.isArray(all[view])) return only(all[view]);
  } catch {
    // a broken store reads as unset
  }
  try {
    return only([...DEFAULT, ...(JSON.parse(legacy ?? "[]") as unknown[])]);
  } catch {
    return DEFAULT;
  }
}

export function withDetails(store: string | null, view: string, next: Detail[]): string {
  let all: Record<string, Detail[]> = {};
  try {
    const v = JSON.parse(store ?? "{}");
    if (v && typeof v === "object" && !Array.isArray(v)) all = v;
  } catch {
    // start over
  }
  return JSON.stringify({ ...all, [view]: only(next) });
}

export const loadDetails = (view: string) => detailsOf(load("ore.details"), load("ore.columns"), view);
export const saveDetails = (view: string, next: Detail[]) => save("ore.details", withDetails(load("ore.details"), view, next));

/** The site a source came from ("nytimes.com"), or none for his own files and text. */
export function siteOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, "") || undefined;
  } catch {
    return undefined;
  }
}

/** Who made it, for every kind of source: the author a page, PDF, book or document names, a video's
 *  channel, a podcast's show, a repo's owner. A web page that names no one falls back to its site
 *  (the publisher), unless Site is shown beside it already; his own text with no author shows nothing. */
export function byline(item: { author?: string; url?: string }, siteShown: boolean): { text: string; site: boolean } | null {
  const a = item.author?.trim();
  if (a) return { text: a, site: false };
  const s = siteShown ? undefined : siteOf(item.url);
  return s ? { text: s, site: true } : null;
}
