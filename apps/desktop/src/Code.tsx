import { Children, isValidElement, useEffect, useRef, useState, type ReactNode } from "react";
import { KINDS, languageOf, tokens, type Kind } from "./code-tokens";
import { Hint } from "./Hint";
import { Check, Copy } from "./icons";
import { paint, UNDER } from "./paint";

/** The coloured ranges of every code block on screen: one CSS Custom Highlight per kind holds them all. */
const blocks = new Map<HTMLElement, Map<Kind, Range[]>>();
let queued = false;
function repaint() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    // Under his own highlights and Find's, so their colours win where they meet.
    for (const k of KINDS) paint(`code-${k}`, [...blocks.values()].flatMap((m) => m.get(k) ?? []), UNDER);
  });
}

/** highlight.js's common languages (BSD-3, through lowlight, MIT), fetched the first time code is on screen. */
let lowlight: Promise<{ registered: (l: string) => boolean; highlight: (l: string, v: string) => Parameters<typeof tokens>[0] }> | undefined;
const loadLowlight = () => (lowlight ??= import("lowlight").then(({ common, createLowlight }) => createLowlight(common)));

/** Lays a Range on each token. The text is not rewrapped in spans: his highlights, Find and Listen are
 *  Ranges on these same text nodes, and a rebuilt node would drop them. */
function colour(code: HTMLElement, lang: string, live: () => boolean) {
  void loadLowlight().then((low) => {
    if (!live() || !low.registered(lang)) return;
    const text = code.textContent ?? "";
    const nodes: { node: Text; from: number }[] = [];
    const walk = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode() as Text | null, at = 0; n; at += n.data.length, n = walk.nextNode() as Text | null) nodes.push({ node: n, from: at });
    const point = (at: number, end: boolean) => {
      const n = nodes.findLast((x) => (end ? x.from < at : x.from <= at)) ?? nodes[0]!;
      return [n.node, Math.min(at - n.from, n.node.data.length)] as const;
    };
    const byKind = new Map<Kind, Range[]>();
    for (const t of nodes.length ? tokens(low.highlight(lang, text)) : []) {
      const r = new Range();
      r.setStart(...point(t.from, false));
      r.setEnd(...point(t.to, true));
      byKind.set(t.kind, [...(byKind.get(t.kind) ?? []), r]);
    }
    blocks.set(code, byKind);
    repaint();
  }, () => {});
}

/** A code block in a source or a tutor reply, as GitHub and Linear draw one (D300): its
 *  parts coloured by kind when its fence names a language, and on hover that language's name and Copy.
 *  The button holds no text and the name is drawn by CSS, so neither is part of the source's words. */
export function CodeBlock({ children }: { children?: ReactNode }) {
  const pre = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const code = Children.toArray(children)[0];
  const lang = isValidElement<{ className?: string }>(code) ? languageOf(code.props.className) : undefined;
  const text = isValidElement<{ children?: ReactNode }>(code) ? String(code.props.children ?? "") : "";
  useEffect(() => {
    const el = pre.current?.querySelector("code");
    if (!el || !lang || lang === "text" || typeof CSS === "undefined" || !("highlights" in CSS)) return;
    let live = true;
    colour(el, lang, () => live);
    return () => {
      live = false;
      if (blocks.delete(el)) repaint();
    };
  }, [lang, text]);
  const copy = () => void navigator.clipboard.writeText(pre.current?.querySelector("code")?.textContent?.replace(/\n$/, "") ?? "").then(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, () => {});
  return (
    <pre ref={pre} className="code-block" data-lang={lang && lang !== "text" ? lang : undefined}>
      {children}
      <Hint text={copied ? "Copied" : "Copy code"} side="top">
        <button className="icon-btn code-copy" data-noindex="" aria-label="Copy code" onClick={copy}>
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
        </button>
      </Hint>
    </pre>
  );
}
