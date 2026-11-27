import type { Asset } from "../items.ts";
import { assetName, MAX_IMAGE, MAX_TOTAL } from "./assets.ts";

// Charts a page draws in the browser with Vega or Vega-Lite (Altair's output: the Annotated Transformer's eight,
// F744) are only a script and an empty div in its HTML, so an import kept the code and lost the picture. Each
// spec is drawn here as an SVG, saved beside the source where its div stood; one that can't be drawn leaves a
// line saying so (D96), never a silent hole. Vega loads only for a page that has one.

/** What stands where a chart was that couldn't be drawn, or was too big to keep. */
export const CHART_LOST = "A chart on the page couldn’t be kept here.";

/** Where a drawn chart's `<img>` points until the Markdown is made: an address the extractor leaves as it is
 *  (it resolves a relative `assets/…` against the page), turned into `assets/<name>` by `chartLinks`. */
const HELD = "https://ore.invalid/chart/";
export const chartLinks = (md: string) => md.replaceAll(HELD, "assets/");

type Spec = Record<string, unknown>;

/** The JSON object that opens at `at` in `s`, as text, or undefined when it doesn't close. */
function objectAt(s: string, at: number): string | undefined {
  let depth = 0;
  let quote = false;
  for (let i = at; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === '"') quote = false;
    } else if (c === '"') quote = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return s.slice(at, i + 1);
  }
  return undefined;
}

const parse = (s: string | undefined): Spec | undefined => {
  try {
    const v = s ? JSON.parse(s) : undefined;
    return v && typeof v === "object" && !Array.isArray(v) ? v : undefined;
  } catch {
    return undefined;
  }
};

/** A script's chart: its spec and the embed options beside it, in Altair's shape (`})({spec}, {opts});`) or
 *  the hand-written one (`var spec = {…}; vegaEmbed("#vis", spec)`). */
function specOf(code: string): { spec?: Spec; opts?: Spec } {
  const call = [...code.matchAll(/\}\)\(\s*\{/g)].pop();
  if (call) {
    const at = call.index + call[0].length - 1;
    const text = objectAt(code, at);
    const rest = text ? code.slice(at + text.length).match(/^\s*,\s*\{/) : null;
    return { spec: parse(text), opts: rest ? parse(objectAt(code, at + text!.length + rest[0].length - 1)) : undefined };
  }
  const v = code.match(/\b(?:var|let|const)\s+spec\s*=\s*\{/);
  const o = code.match(/\b(?:var|let|const)\s+(?:embedOpt|opt)\s*=\s*\{/);
  return { spec: v ? parse(objectAt(code, v.index! + v[0].length - 1)) : undefined, opts: o ? parse(objectAt(code, o.index! + o[0].length - 1)) : undefined };
}

/** Whether a spec loads any of its data from an address: never fetched at import. */
function fetchesData(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  if (Array.isArray(v)) return v.some(fetchesData);
  const data = (v as Spec).data;
  if ([data].flat().some((d) => d && typeof d === "object" && typeof (d as Spec).url === "string")) return true;
  return Object.values(v).some(fetchesData);
}

/** The chart's title as its alt text, else "Chart". */
function titleOf(spec: Spec): string {
  const t = spec.title;
  const text = typeof t === "object" && t && !Array.isArray(t) ? (t as Spec).text : t;
  const s = [text].flat().filter((x) => typeof x === "string").join(" ").replace(/[\s\]\[]+/g, " ").trim();
  return s || "Chart";
}

/** A spec drawn as an SVG, headless: Vega-Lite compiled to Vega first. Nothing is fetched, nothing logged. */
async function draw(spec: Spec, lite: boolean): Promise<string> {
  if (fetchesData(spec)) throw new Error("its data is at an address");
  const vega = await import("vega");
  const quiet = vega.logger(vega.None);
  const runtime = vega.parse(lite ? (await import("vega-lite")).compile(spec as never, { logger: quiet }).spec : (spec as never));
  const loader = vega.loader();
  loader.load = loader.sanitize = async () => {
    throw new Error("nothing is fetched at import");
  };
  const view = new vega.View(runtime, { renderer: "none", loader, logger: quiet });
  try {
    return await view.toSVG();
  } finally {
    view.finalize();
  }
}

/** Draws each Vega chart in the page in place: an `<img>` of its saved SVG where its div was, or CHART_LOST.
 *  Returns the SVGs, to save beside the source. */
export async function drawCharts(doc: Document, html: string): Promise<Asset[]> {
  if (!html.includes("vegaEmbed")) return [];
  const assets: Asset[] = [];
  let total = 0;
  for (const script of [...doc.querySelectorAll("script:not([src])")]) {
    const code = script.textContent ?? "";
    if (!code.includes("vegaEmbed")) continue;
    const { spec, opts } = specOf(code);
    const id = code.match(/getElementById\(\s*["']([^"']+)["']/)?.[1] ?? code.match(/vegaEmbed\(\s*["']#([^"']+)["']/)?.[1];
    const target = (id && doc.getElementById(id)) || script.previousElementSibling;
    script.remove();
    // A script that only mentions vegaEmbed (a helper, a loader) and holds no spec leaves the page alone: only an
    // empty div was a chart's place.
    if (!target || (!spec && (target.textContent?.trim() || target.children.length))) continue;
    const p = doc.createElement("p");
    try {
      if (!spec) throw new Error("no spec");
      const schema = typeof spec.$schema === "string" ? spec.$schema : "";
      const lite = /vega-lite/.test(schema) || (!/schema\/vega\//.test(schema) && opts?.mode !== "vega");
      const data = new TextEncoder().encode(await draw(spec, lite));
      if (data.length > MAX_IMAGE || total + data.length > MAX_TOTAL) throw new Error("too big to keep");
      total += data.length;
      const asset = { name: assetName(data, "svg"), data };
      assets.push(asset);
      const img = doc.createElement("img");
      img.setAttribute("src", HELD + asset.name);
      img.setAttribute("alt", titleOf(spec));
      p.appendChild(img);
    } catch {
      p.textContent = CHART_LOST;
    }
    target.replaceWith(p);
  }
  return assets;
}
