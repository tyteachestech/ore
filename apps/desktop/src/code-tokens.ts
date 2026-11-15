/** What a piece of code is, as far as its colour goes (D300): five quiet tones, enough to
 *  tell a comment from a string from a keyword, no more. */
export const KINDS = ["comment", "keyword", "string", "number", "name"] as const;
export type Kind = (typeof KINDS)[number];
export type Token = { from: number; to: number; kind: Kind };

/** highlight.js's classes, folded into Ore's five. Anything else stays the text colour. */
const OF: Record<string, Kind> = {
  comment: "comment", quote: "comment", meta: "comment", doctag: "comment",
  keyword: "keyword", "selector-tag": "keyword", tag: "keyword", built_in: "keyword", type: "keyword",
  string: "string", regexp: "string", "template-string": "string", char: "string", symbol: "string",
  number: "number", literal: "number",
  title: "name", "title.function": "name", "title.class": "name", attr: "name", attribute: "name", name: "name", section: "name", "selector-class": "name", "selector-id": "name",
};

type Hast = { type: string; value?: string; properties?: { className?: unknown }; children?: Hast[] };

/** The coloured runs of a highlighted tree, as offsets into the code's text. A run inside a run (a
 *  variable in a template string) takes its own kind; touching runs of one kind are joined. */
export function tokens(tree: Hast): Token[] {
  const out: Token[] = [];
  let at = 0;
  const walk = (n: Hast, kind: Kind | null) => {
    if (n.type === "text") {
      const len = n.value?.length ?? 0;
      const last = out.at(-1);
      if (kind && len) last && last.kind === kind && last.to === at ? (last.to += len) : out.push({ from: at, to: at + len, kind });
      at += len;
      return;
    }
    const cls = Array.isArray(n.properties?.className) ? (n.properties.className as string[]) : [];
    const mine = cls.map((c) => OF[c.replace(/^hljs-/, "").replace(/_$/, "")]).find(Boolean) ?? kind;
    for (const c of n.children ?? []) walk(c, mine);
  };
  walk(tree, null);
  return out;
}

/** The language a fenced block names (```py), from the class react-markdown gives its <code>. */
export const languageOf = (className?: string) => /\blanguage-([\w+#-]+)/.exec(className ?? "")?.[1]?.toLowerCase();
