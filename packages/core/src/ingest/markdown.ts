import TurndownService from "turndown";

// Plain HTML → Markdown (turndown, the converter Defuddle uses), without
// Defuddle's article heuristics, which drop chapter headings and short chapters.
export const td = new TurndownService({ headingStyle: "atx", bulletListMarker: "-", codeBlockStyle: "fenced", emDelimiter: "*" });
// Images show only once saved beside the source (src `assets/…`, D96); any other image is dropped.
td.addRule("text-only", { filter: (n) => /^(svg|script|style)$/i.test(n.nodeName), replacement: () => "" });
td.addRule("saved-image", {
  filter: "img",
  replacement: (_c, n) => {
    const src = (n as HTMLElement).getAttribute("src") ?? "";
    return src.startsWith("assets/") ? `![${((n as HTMLElement).getAttribute("alt") ?? "").replace(/[\[\]\n]/g, " ")}](${src})` : "";
  },
});
td.addRule("internal-link", {
  filter: (n) => n.nodeName === "A" && !/^https?:/i.test(n.getAttribute("href") ?? ""),
  replacement: (content) => content,
});
// Tables as GFM tables (the first row is the header), each cell's text on one line. Only the table's
// own rows and cells count: a table nested in a cell (a layout table) is that cell's text, not more rows.
const children = (el: Element, names: RegExp) => Array.from(el.children).filter((c) => names.test(c.nodeName));
/** A cell's text, with a space where its blocks (a nested table's cells, lines, list items) meet. */
const cellText = (el: Element): string =>
  Array.from(el.childNodes)
    .map((n) => (n.nodeType === 3 ? n.textContent ?? "" : n.nodeType === 1 ? (/^(td|th|tr|p|div|li|br)$/i.test(n.nodeName) ? ` ${cellText(n as Element)} ` : cellText(n as Element)) : ""))
    .join("");
td.addRule("table", {
  filter: "table",
  replacement: (_c, node) => {
    const table = node as HTMLTableElement;
    const rows = [...children(table, /^tr$/i), ...children(table, /^(thead|tbody|tfoot)$/i).flatMap((g) => children(g, /^tr$/i))].map((tr) =>
      children(tr, /^(th|td)$/i).map((c) => cellText(c).replace(/\s+/g, " ").trim().replace(/\|/g, "\\|")),
    );
    // Spanned cells leave rows with nothing in them.
    rows.splice(0, rows.length, ...rows.filter((r) => r.some(Boolean)));
    if (!rows.length) return "";
    const n = Math.max(...rows.map((r) => r.length));
    const line = (r: string[]) => `| ${Array.from({ length: n }, (_, i) => r[i] ?? "").join(" | ")} |`;
    return `\n\n${[line(rows[0]!), line(Array(n).fill("---")), ...rows.slice(1).map(line)].join("\n")}\n\n`;
  },
});
