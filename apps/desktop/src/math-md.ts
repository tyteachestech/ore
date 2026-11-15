import type ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

type Props = Parameters<typeof ReactMarkdown>[0];

// Markdown with formulas drawn by KaTeX, as the reader draws a source's (D96) and a note keeps them (D38):
// `$$…$$` inline or on its own line, a single `$` staying a dollar, so a price never reads as math.
export const remarkPlugins = [remarkGfm, [remarkMath, { singleDollarTextMath: false }]] as NonNullable<Props["remarkPlugins"]>;

type MdNode = { type: string; value?: string; data?: object; children?: MdNode[] };
/** A formula alone in its paragraph is shown on its own line, full size, as ChatGPT and Claude show one:
 *  an AI writes `$$x$$` on one line where a document writes a `$$` block. */
const loneDisplay = () => (tree: MdNode) => {
  tree.children?.forEach((n, i) => {
    const m = n.type === "paragraph" && n.children?.length === 1 ? n.children[0]! : null;
    if (m?.type !== "inlineMath") return;
    const code = { type: "element", tagName: "code", properties: { className: ["language-math", "math-display"] }, children: [{ type: "text", value: m.value }] };
    tree.children![i] = { type: "math", value: m.value, data: { hName: "pre", hChildren: [code] } };
  });
};
const replyRemark = [...remarkPlugins, loneDisplay] as NonNullable<Props["remarkPlugins"]>;
export const rehypeMath = [rehypeKatex, { output: "htmlAndMathml", throwOnError: false }] as NonNullable<Props["rehypePlugins"]>[number];
/** What a tutor or Ask reply is drawn with: its formulas too (F-new-raw-latex). */
export const reply = { remarkPlugins: replyRemark, rehypePlugins: [rehypeMath] as NonNullable<Props["rehypePlugins"]> };

/** An AI's own ways of writing a formula, `$x$`, `\(x\)` and `\[x\]`, written as `$$x$$` (on its own line for
 *  `\[x\]`), outside code. A single `$` is math only as Pandoc reads it: no space inside either `$` and no digit
 *  right after the closing one, so "$5 and $10" stays two prices. */
export function aiMath(text: string): string {
  return text
    .split(/(```[\s\S]*?```|`[^`\n]*`)/)
    .map((part, at) =>
      at % 2
        ? part
        : part
            .replace(/\\\[([\s\S]+?)\\\]/g, (_, x: string) => `\n\n$$${x.trim()}$$\n\n`)
            .replace(/\\\((.+?)\\\)/g, (_, x: string) => `$$${x.trim()}$$`)
            .replace(/(?<![$\\])\$(?![$\s])([^$\n]*?[^\s$\\])\$(?![$\d])/g, (_, x: string) => `$$${x}$$`),
    )
    .join("");
}
