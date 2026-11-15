import type ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { inProse } from "../../../packages/core/src/markers";

type Props = Parameters<typeof ReactMarkdown>[0];

// Markdown with formulas drawn by KaTeX, as the reader draws a source's (D96) and a note keeps them (D38):
// `$$…$$` inline or on its own line, a single `$` staying a dollar, so a price never reads as math.
export const remarkPlugins = [remarkGfm, [remarkMath, { singleDollarTextMath: false }]] as NonNullable<Props["remarkPlugins"]>;

type MdNode = { type: string; value?: string; data?: object; children?: MdNode[] };
/** A formula alone in its paragraph is shown on its own line, full size, as ChatGPT and Claude show one:
 *  an AI writes `$$x$$` on one line where a document writes a `$$` block. In a list or a quote too; a table
 *  cell holds no paragraph, so a formula there stays inline. */
const loneDisplay = () => (tree: MdNode) => {
  const walk = (parent: MdNode) =>
    parent.children?.forEach((n, i) => {
      const m = n.type === "paragraph" && n.children?.length === 1 ? n.children[0]! : null;
      if (m?.type !== "inlineMath") return walk(n);
      const code = { type: "element", tagName: "code", properties: { className: ["language-math", "math-display"] }, children: [{ type: "text", value: m.value }] };
      parent.children![i] = { type: "math", value: m.value, data: { hName: "pre", hChildren: [code] } };
    });
  walk(tree);
};
const replyRemark = [...remarkPlugins, loneDisplay] as NonNullable<Props["remarkPlugins"]>;
export const rehypeMath = [rehypeKatex, { output: "htmlAndMathml", throwOnError: false }] as NonNullable<Props["rehypePlugins"]>[number];
/** What a tutor or Ask reply is drawn with: its formulas too (F320). */
export const reply = { remarkPlugins: replyRemark, rehypePlugins: [rehypeMath] as NonNullable<Props["rehypePlugins"]> };

// A single-dollar formula, read as Pandoc reads one (no space inside either `$`, no digit right after the
// closing one) and more strictly: nothing of a word or a path (a letter, digit, _ or /) against either `$`
// from outside, and no / at its own edges, so "$5 and $10", `$HOME/$USER/bin` and "$A and $B" stay as written.
const SINGLE = /(?<![$\\\p{L}\p{N}_/])\$(?![$\s/])([^$\n]*?[^\s$\\/])\$(?![$\p{L}\p{N}_/])/gu;

/** An AI's own ways of writing a formula, `$x$`, `\(x\)` and `\[x\]`, written as `$$x$$` (on its own line for
 *  `\[x\]`), in its prose only: never in code (a block still being written included) or a `$$` formula. */
export function aiMath(text: string): string {
  return inProse(text, (prose) =>
    prose
      .replace(/\\\[([\s\S]+?)\\\]/g, (_, x: string) => `\n\n$$${x.trim()}$$\n\n`)
      .replace(/\\\((.+?)\\\)/g, (_, x: string) => `$$${x.trim()}$$`)
      .replace(SINGLE, (_, x: string) => `$$${x}$$`),
  );
}
