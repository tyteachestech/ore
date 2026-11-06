/** Copy with the source attached (Readwise, Kindle): Markdown for text fields, HTML alongside so it
 *  pastes rich into Notes or Mail. Plain ⌘C on selected text never comes here. */
export type Cited = { text: string; html: string };
type Source = { title: string; url?: string };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const mdLink = ({ title, url }: Source) => {
  const t = title.replace(/([[\]])/g, "\\$1");
  return url ? `[${t}](${url.replace(/[()\s]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`)})` : t;
};
const htmlLink = ({ title, url }: Source) => (url ? `<a href="${esc(url)}">${esc(title)}</a>` : esc(title));

/** "> quote — Title (link)", with his note under it when he wrote one. */
export function citeQuote(quote: string, src: Source, note?: string): Cited {
  const lines = quote.trim().split(/\n+/);
  const n = note?.trim();
  return {
    text: [...lines.map((l) => `> ${l}`), `> — ${mdLink(src)}`].join("\n") + (n ? `\n\n${n}` : ""),
    html: `<blockquote>${lines.map((l) => `<p>${esc(l)}</p>`).join("")}<p>— ${htmlLink(src)}</p></blockquote>` + (n ? `<p>${esc(n)}</p>` : ""),
  };
}

/** A source as its linked title; several as a list. */
export function citeSources(srcs: Source[]): Cited {
  if (srcs.length === 1) return { text: mdLink(srcs[0]!), html: htmlLink(srcs[0]!) };
  return { text: srcs.map((s) => `- ${mdLink(s)}`).join("\n"), html: `<ul>${srcs.map((s) => `<li>${htmlLink(s)}</li>`).join("")}</ul>` };
}

/** Puts both forms on the clipboard; plain text only where rich copy isn't offered. */
export async function copyCited(c: Cited): Promise<void> {
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
    try {
      return await navigator.clipboard.write([
        new ClipboardItem({ "text/plain": new Blob([c.text], { type: "text/plain" }), "text/html": new Blob([c.html], { type: "text/html" }) }),
      ]);
    } catch {
      // fall through to plain text
    }
  }
  await navigator.clipboard.writeText(c.text);
}
