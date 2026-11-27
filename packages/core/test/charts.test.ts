import { describe, expect, test } from "bun:test";
import { parseHTML } from "linkedom";
import { CHART_LOST, drawCharts } from "../src/ingest/charts.ts";

// Charts a page draws with Vega (F744), the edges /code-review found on #559.
const spec = (extra = "") => `{"$schema":"https://vega.github.io/schema/vega-lite/v5.json","data":{"values":[{"a":1,"b":2},{"a":2,"b":3}]},"mark":"bar","encoding":{"x":{"field":"a","type":"ordinal"},"y":{"field":"b","type":"quantitative"}}${extra}}`;
const page = (body: string) => parseHTML(`<!doctype html><html><body>${body}</body></html>`).document as unknown as Document;

describe("charts drawn at import", () => {
  test("a chart whose div isn't found goes after the paragraph before it, never over it", async () => {
    const html = `<p>The key paragraph.</p><script>var spec = ${spec()}; vegaEmbed(el, spec);</script>`;
    const doc = page(html);
    const assets = await drawCharts(doc, html);
    expect(assets).toHaveLength(1);
    expect(doc.body.textContent).toContain("The key paragraph.");
    expect(doc.body.innerHTML.indexOf("The key paragraph.")).toBeLessThan(doc.body.innerHTML.indexOf("<img"));
  });

  test("a page's expressions are interpreted, never compiled into code: one that reaches for code draws nothing and runs nothing", async () => {
    // A transform whose expression tries to escape to the Function constructor.
    const hostile = spec(`,"transform":[{"calculate":"constructor.constructor('globalThis.__pwned = 1')()","as":"c"}]`);
    const html = `<div id="v"></div><script>var spec = ${hostile}; vegaEmbed("#v", spec);</script>`;
    const doc = page(html);
    await drawCharts(doc, html);
    expect((globalThis as { __pwned?: number }).__pwned).toBeUndefined();
    // And one that only computes still draws.
    const fine = spec(`,"transform":[{"calculate":"datum.b * 2","as":"c"}]`);
    const ok = `<div id="w"></div><script>var spec = ${fine}; vegaEmbed("#w", spec);</script>`;
    expect(await drawCharts(page(ok), ok)).toHaveLength(1);
  });

  test("a script that only mentions vegaEmbed leaves the page alone", async () => {
    const html = `<p>Words.</p><script>function show(s) { vegaEmbed("#x", s); }</script>`;
    const doc = page(html);
    expect(await drawCharts(doc, html)).toHaveLength(0);
    expect(doc.body.textContent).toContain("Words.");
    expect(doc.body.textContent).not.toContain(CHART_LOST);
  });
});
