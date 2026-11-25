import { Fragment, useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import { aiMath, rehypeMath, remarkPlugins, reply } from "./math-md";
import { withImages } from "./md-images";

type MdNode = { type: string; value?: string; data?: object; children?: MdNode[] };
const CONTAINERS = new Set(["root", "list", "listItem", "blockquote", "table", "tableRow", "tableCell", "footnoteDefinition"]);
/** One line of what was written as blocks: each block's words, a space between, a code block as inline code and a
 *  formula on its own line as an inline one (`remark-math`'s own shape for one). */
const oneLine = () => (tree: MdNode) => {
  const flat = (n: MdNode): MdNode[] => {
    if (n.type === "code") return [{ type: "inlineCode", value: n.value }];
    if (n.type === "math") return [{ type: "inlineMath", value: n.value, data: { hName: "code", hProperties: { className: ["language-math", "math-inline"] }, hChildren: [{ type: "text", value: n.value }] } }];
    if (n.type === "paragraph" || n.type === "heading") return n.children ?? [];
    if (n.type === "thematicBreak") return [];
    if (!CONTAINERS.has(n.type)) return [n];
    return (n.children ?? []).map(flat).filter((p) => p.length).flatMap((p, i) => (i ? [{ type: "text", value: " " }, ...p] : p));
  };
  tree.children = [{ type: "paragraph", children: flat(tree) }];
};
const line = { remarkPlugins: [...remarkPlugins, oneLine], rehypePlugins: [rehypeMath] };

/** An image with no folder to load it from is its alt text; a web image loads as it is. */
const altOnly: Components["img"] = ({ src, alt }) =>
  typeof src === "string" && /^(https?:|data:)/i.test(src) ? <img src={src} alt={alt ?? ""} loading="lazy" draggable={false} /> : <Fragment>{alt}</Fragment>;

/** An exercise's question or answer, drawn as a tutor reply is (its formulas, code and Markdown, F320) with
 *  the images of its source, as the reader draws them (`dir`: the source's folder). Plain text reads as it was
 *  typed: a paragraph keeps its line breaks, and what looks like a tag shows as typed. `inline`: in a one-line
 *  spot, one line: no paragraph wraps it, its blocks run on with a space, an image is its alt text and a link its words. */
export function ExerciseText({ text, dir, inline }: { text: string; dir?: string; inline?: boolean }) {
  const parts = useMemo<Components>(() => {
    // One line sits in rows and buttons (a quiz's key point, a prequestion): a link there is its words, never a link inside a button.
    if (inline) return { p: ({ children }) => <Fragment>{children}</Fragment>, img: ({ alt }) => <Fragment>{alt}</Fragment>, a: ({ children }) => <Fragment>{children}</Fragment> };
    return dir ? withImages({}, dir) : { img: altOnly };
  }, [dir, inline]);
  return (
    <ReactMarkdown {...(inline ? line : reply)} components={parts}>
      {aiMath(text)}
    </ReactMarkdown>
  );
}
