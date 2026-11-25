import TurndownService from "turndown";
import { flattenRuby } from "./check.ts";

// Plain HTML → Markdown (turndown, the converter Defuddle uses), without
// Defuddle's article heuristics, which drop chapter headings and short chapters.
export const td = new TurndownService({ headingStyle: "atx", bulletListMarker: "-", codeBlockStyle: "fenced", emDelimiter: "*" });
// Images show only once saved beside the source (src `assets/…`, D96); any other image is dropped.
// Ruby as its letters with their reading in brackets (an EPUB in Japanese), not spaced apart (Codex sweep 4).
td.addRule("ruby", { filter: (n) => n.nodeName === "RUBY", replacement: (_c, n) => flattenRuby((n as HTMLElement).outerHTML) });
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
    const trs = [...children(table, /^tr$/i), ...children(table, /^(thead|tbody|tfoot)$/i).flatMap((g) => children(g, /^tr$/i))];
    const occupied: number[] = [];
    const rows = trs.map((tr, rowIndex) => {
      const row: string[] = [];
      let col = 0;
      for (const cell of children(tr, /^(th|td)$/i)) {
        while ((occupied[col] ?? 0) > rowIndex) row[col++] = "";
        const width = Math.min(1000, Math.max(1, Number(cell.getAttribute("colspan")) || 1));
        const rawHeight = cell.getAttribute("rowspan");
        const height = rawHeight === "0" ? trs.length - rowIndex : Math.max(1, Number(rawHeight) || 1);
        row[col] = cellText(cell).replace(/\s+/g, " ").trim().replace(/\|/g, "\\|");
        for (let offset = 0; offset < width; offset++) {
          if (offset) row[col + offset] = "";
          occupied[col + offset] = rowIndex + height;
        }
        col += width;
      }
      return row;
    });
    // Spanned cells leave rows with nothing in them.
    rows.splice(0, rows.length, ...rows.filter((r) => r.some(Boolean)));
    if (!rows.length) return "";
    const n = Math.max(...rows.map((r) => r.length));
    const line = (r: string[]) => `| ${Array.from({ length: n }, (_, i) => r[i] ?? "").join(" | ")} |`;
    return `\n\n${[line(rows[0]!), line(Array(n).fill("---")), ...rows.slice(1).map(line)].join("\n")}\n\n`;
  },
});

/** An HTML block in a Markdown file (a `<p>`, `<div>` or `<table>` on its own lines) as Markdown: the reader
 *  shows no raw HTML, so it read as if the paragraph wasn't there (Codex sweep 4). Code is left as written. */
export function htmlBlocksToMarkdown(md: string): string {
  const BLOCK = /^ {0,3}<(p|div|section|article|aside|figure|table|ul|ol|dl|blockquote|details|h[1-6]|center)\b/i;
  const out: string[] = [];
  let fence: string | null = null;
  let chunk: string[] = [];
  const flush = () => {
    const text = flattenRuby(chunk.join("\n"));
    if (chunk.length) out.push(BLOCK.test(chunk[0]!) ? td.turndown(text) : text);
    chunk = [];
  };
  for (const line of md.split("\n")) {
    const f = line.match(/^ {0,3}(`{3,}|~{3,})/)?.[1];
    if (fence) {
      out.push(line);
      if (f && f[0] === fence[0] && f.length >= fence.length) fence = null;
    } else if (f) {
      flush();
      fence = f;
      out.push(line);
    } else if (!line.trim()) {
      flush();
      out.push(line);
    } else chunk.push(line);
  }
  flush();
  return out.join("\n");
}

/** Rewrite rendered Markdown images, including references, without touching examples inside code. */
export function rewriteImageUrls(md: string, resolve: (url: string) => string | undefined): string {
  const { fromMarkdown } = require("mdast-util-from-markdown") as typeof import("mdast-util-from-markdown");
  type Node = { type: string; url?: string; identifier?: string; alt?: string | null; title?: string | null; children?: Node[]; position?: { start: { offset?: number }; end: { offset?: number } } };
  const nodes: Node[] = [];
  const walk = (node: Node) => { nodes.push(node); node.children?.forEach(walk); };
  walk(fromMarkdown(md));
  const defs = new Map<string, Node>();
  for (const node of nodes) if (node.type === "definition" && !defs.has(node.identifier!)) defs.set(node.identifier!, node);
  for (const node of nodes.reverse()) {
    const target = node.type === "image" ? node : node.type === "imageReference" ? defs.get(node.identifier!) : undefined;
    const url = target?.url && resolve(target.url);
    if (!url || url === target?.url) continue;
    const alt = (node.alt ?? "").replace(/[\\[\]]/g, "\\$&");
    const title = target?.title ? ` "${target.title.replace(/[\\"]/g, "\\$&")}"` : "";
    const destination = url.replace(/ /g, "%20").replace(/\(/g, "%28").replace(/\)/g, "%29");
    md = md.slice(0, node.position!.start.offset!) + `![${alt}](${destination}${title})` + md.slice(node.position!.end.offset!);
  }
  return md;
}
