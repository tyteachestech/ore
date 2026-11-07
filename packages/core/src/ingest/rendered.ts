import { parseHTML } from "linkedom";
import { td } from "./markdown.ts";

// A Notion page as the browser rendered it (D96, D122): Notion builds its pages from div blocks
// (`.notion-header-block`, `.notion-text-block`, ...) that no article reader understands, so its
// visible text lost the headings, images, code and tables. Each block becomes its Markdown here.

type El = Element;

const own = (block: El, sel: string) => [...block.querySelectorAll(sel)].find((e) => e.closest("[data-block-id]") === block);
const kind = (block: El) => /\bnotion-([a-z_]+)-block\b/.exec(block.className)?.[1] ?? "";

/** A leaf's text as Markdown: links, bold and italics kept; mention icons dropped; equations as TeX. */
function inline(leaf: El | undefined): string {
  if (!leaf) return "";
  const copy = leaf.cloneNode(true) as El;
  for (const m of copy.querySelectorAll(".notion-text-equation-token")) m.replaceWith(`$${m.querySelector("annotation")?.textContent ?? m.textContent}$`);
  for (const i of copy.querySelectorAll("img, svg")) i.remove();
  for (const c of copy.querySelectorAll(".notion-inline-code-container")) c.outerHTML = `<code>${c.innerHTML}</code>`;
  // A link mention shows the site's name, then the page's title: the title is the link's text.
  for (const a of copy.querySelectorAll("a.notion-link-mention-token")) {
    const t = [...a.querySelectorAll("span")].filter((x) => !x.querySelector("span")).pop();
    if (t) a.textContent = t.textContent;
  }
  return td.turndown(copy.innerHTML).replace(/\u200b/g, "").replace(/\n+/g, " ").trim();
}

const cells = (row: El) => [...row.querySelectorAll("[data-col-index]")].map((c) => (c.textContent ?? "").replace(/\s+/g, " ").replace(/\|/g, "\\|").trim());
const table = (rows: string[][], head?: string[]) => {
  if (!rows.length) return "";
  const h = head?.length === rows[0]!.length ? head : rows.shift()!;
  return [h, h.map(() => "---"), ...rows].map((r) => `| ${r.join(" | ")} |`).join("\n");
};

function block(b: El, url: string, depth: number): string | null {
  const k = kind(b);
  const leaf = own(b, "[data-content-editable-leaf]");
  const text = inline(leaf);
  const pad = "  ".repeat(depth);
  switch (k) {
    case "header": return text && `## ${text}`;
    case "sub_header": return text && `### ${text}`;
    case "sub_sub_header": return text && `#### ${text}`;
    case "bulleted_list": case "toggle": return text && `${pad}- ${text}`;
    case "numbered_list": return text && `${pad}1. ${text}`;
    case "to_do": return text && `${pad}- [${own(b, "input:checked, [aria-checked=true]") ? "x" : " "}] ${text}`;
    case "quote": return text && `> ${text}`;
    case "code": return `\`\`\`\n${(leaf?.textContent ?? "").replace(/\n+$/, "")}\n\`\`\``;
    case "equation": return `$$\n${own(b, "annotation")?.textContent ?? b.textContent}\n$$`;
    case "image": {
      const src = own(b, "img")?.getAttribute("src");
      if (!src || src.startsWith("data:")) return null; // a placeholder for an image Notion couldn't load
      return `![${text}](${new URL(src, url).href})`;
    }
    case "page": {
      const a = own(b, "a[href]");
      const t = (b.textContent ?? "").trim();
      return a && t ? `[${t}](${new URL(a.getAttribute("href")!, url).href})` : null;
    }
    case "table": return table([...b.querySelectorAll("tr")].map((r) => [...r.querySelectorAll("td, th")].map((c) => inline(c))));
    case "collection_view": {
      // A database: its title, then its rows as a table under its column names.
      const rows = new Map<string, string[]>();
      for (const c of b.querySelectorAll("[data-row-index]")) rows.set(c.getAttribute("data-row-index")!, cells(c.parentElement!));
      const head = [...b.querySelectorAll("[role=button][aria-haspopup=dialog]:not([aria-label])")].map((h) => (h.textContent ?? "").trim()).filter(Boolean);
      const title = (b.querySelector("a[href] .notranslate")?.textContent ?? "").trim();
      return [title, table([...rows.values()], head)].filter(Boolean).join("\n\n") || null;
    }
    case "divider": case "column_list": case "column": case "callout": case "logo": return null;
    default: return text || null;
  }
}

/** The page's blocks as Markdown, or null when the HTML isn't a rendered Notion page. */
export function notionMarkdown(html: string, url: string): string | null {
  const { document } = parseHTML(html);
  const root = document.querySelector(".notion-page-content");
  if (!root) return null;
  const out: string[] = [];
  let prevList = false;
  for (const b of root.querySelectorAll("[data-block-id]") as unknown as El[]) {
    const parent = b.parentElement?.closest("[data-block-id]");
    // A database repeats its id on inner wrappers, and its rows are blocks too: the outermost one speaks for it.
    if (parent && (parent.getAttribute("data-block-id") === b.getAttribute("data-block-id") || parent.closest(".notion-collection_view-block"))) continue;
    let depth = 0;
    let quoted = false;
    for (let p = parent; p; p = p.parentElement?.closest("[data-block-id]")) {
      if (/notion-(bulleted_list|numbered_list|to_do|toggle)-block/.test(p.className)) depth++;
      if (/notion-(callout|quote)-block/.test(p.className)) quoted = true;
    }
    let md = block(b, url, depth);
    if (!md) continue;
    if (quoted) md = md.split("\n").map((l) => `> ${l}`).join("\n");
    const list = /^\s*(?:- |1\. )/.test(md);
    // List items sit together; everything else is its own paragraph.
    if (list && prevList) out[out.length - 1] += `\n${md}`;
    else out.push(md);
    prevList = list;
  }
  const body = out.join("\n\n").trim();
  return body ? body + "\n" : null;
}
