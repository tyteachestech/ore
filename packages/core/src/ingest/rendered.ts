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

// A chat shared from Claude (claude.ai/share/…), as the browser drew it (D-new-chat-import): the page is built in
// the browser, so it comes from the tab. What he asked is the outline, a heading each; under it his message in
// full when the heading cut it, then the reply. Only the reply's own prose is read: the page's buttons, its
// "Ran 5 agents" lines and its widgets are not what was said.

const CHAT_TURN = '[data-testid="user-message"], [data-testid="assistant-message"]';
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();
/** A heading's worth of a message: its first line, cut at a word near 90 characters. */
function asHeading(message: string): string {
  const first = oneLine(message.split("\n").find((l) => l.trim()) ?? "");
  if (first.length <= 90) return first;
  return `${first.slice(0, 90).replace(/\s+\S*$/, "")}…`;
}

/** What a reply showed that the shared copy leaves out, said in its place so the text around it still reads
 *  ("Here's how a typical negotiation spreads out" with nothing after it would not). */
function leftOut(widget: El): string | null {
  if (widget.querySelector('[data-testid="tool-status-pill"]')) return null;
  const text = oneLine(widget.textContent ?? "");
  if (/visual hidden when shared/i.test(text)) return "*An interactive visual was here. The shared copy of the chat leaves it out.*";
  const quiz = widget.querySelector('[role="group"]');
  if (quiz) {
    const name = oneLine(quiz.querySelector("span")?.textContent ?? "");
    return `*An interactive quiz was here${name ? ` (“${name}”)` : ""}. The shared copy of the chat leaves it out.*`;
  }
  return null;
}

/** A shared Claude chat as Markdown with its title and first day, or null when the HTML isn't one. */
export function chatMarkdown(html: string): { title?: string; published?: string; markdown: string } | null {
  if (!html.includes('data-testid="transcript-list"')) return null;
  const { document } = parseHTML(html);
  const list = document.querySelector('[data-testid="transcript-list"]');
  const turns = [...(list?.querySelectorAll(CHAT_TURN) ?? [])] as El[];
  if (!list || !turns.some((t) => t.getAttribute("data-testid") === "user-message") || !turns.some((t) => t.getAttribute("data-testid") === "assistant-message")) return null;
  const out: string[] = [];
  for (const t of turns) {
    if (t.getAttribute("data-testid") === "user-message") {
      const message = td.turndown(t as unknown as HTMLElement).trim();
      if (!message) continue;
      const heading = asHeading(message);
      out.push(`## ${heading}`);
      if (oneLine(message) !== heading) out.push(message.split("\n").map((l) => `> ${l}`.trimEnd()).join("\n"));
      continue;
    }
    // In the order the reply shows them: its prose, and a line where a widget stood.
    for (const part of t.querySelectorAll('[data-cds="Prose"], [data-find-omitted]') as unknown as El[]) {
      if (part.parentElement?.closest("[data-find-omitted]")) continue;
      if (part.tagName === "H3") continue; // "Claude responded: …", for screen readers
      // Turndown pads a list's marker to four columns; the library's lists have one space.
      const md = part.getAttribute("data-cds") === "Prose" ? td.turndown(part as unknown as HTMLElement).trim().replace(/^(\s*(?:-|\d+\.)) {2,}/gm, "$1 ") : leftOut(part);
      if (md) out.push(md);
    }
  }
  if (out.length < 2) return null;
  const title = oneLine(list.previousElementSibling?.textContent ?? "") || undefined;
  const published = document.querySelector("time[datetime]")?.getAttribute("datetime")?.slice(0, 10);
  return { title, published, markdown: `${out.join("\n\n")}\n` };
}
