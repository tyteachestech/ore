import { Fragment, useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import { aiMath, reply } from "./math-md";
import { withImages } from "./md-images";

/** An exercise's question or answer, drawn as a tutor reply is (its formulas, code and Markdown, F320) with
 *  the images of its source, as the reader draws them (`dir`: the source's folder). Plain text reads as it was
 *  typed: a paragraph keeps its line breaks. `inline`: in a one-line list, no paragraph wraps it. */
export function ExerciseText({ text, dir, inline }: { text: string; dir?: string; inline?: boolean }) {
  const parts = useMemo<Components>(() => {
    // A one-line list has no room for a picture: an image there is its alt text.
    if (inline) return { p: ({ children }) => <Fragment>{children}</Fragment>, img: ({ alt }) => <Fragment>{alt}</Fragment> };
    return dir ? withImages({}, dir) : {};
  }, [dir, inline]);
  return (
    <ReactMarkdown {...reply} components={parts} skipHtml>
      {aiMath(text)}
    </ReactMarkdown>
  );
}
