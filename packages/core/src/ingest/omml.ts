// Word's equations (OMML, `<m:oMath>`) as TeX, so a Word file with formulas comes in whole (D122) instead of
// being refused (office-03). Mammoth drops every equation, so each one is swapped for a marker before it runs
// and the marker for its TeX after. An equation built from a part this doesn't know yields null: the file is
// then refused as before, never saved with a formula missing.

type Node = { tag: string; attrs: string; kids: Node[]; text?: string };

/** A small XML tree: enough for OMML, whose text sits only in `<m:t>`. */
function tree(xml: string): Node {
  const root: Node = { tag: "#root", attrs: "", kids: [] };
  const stack = [root];
  for (const m of xml.matchAll(/<(\/?)([\w:]+)([^>]*?)(\/?)>|([^<]+)/g)) {
    const top = stack.at(-1)!;
    if (m[5] !== undefined) { top.kids.push({ tag: "#text", attrs: "", kids: [], text: m[5] }); continue; }
    if (m[1]) { if (stack.length > 1) stack.pop(); continue; }
    const node: Node = { tag: m[2]!, attrs: m[3] ?? "", kids: [] };
    top.kids.push(node);
    if (!m[4]) stack.push(node);
  }
  return root;
}

const decode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#x([\da-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&amp;/g, "&");
const val = (n: Node | undefined, prop: string) => n?.kids.find((k) => k.tag === prop)?.attrs.match(/m:val="([^"]*)"/)?.[1];
const kid = (n: Node, tag: string) => n.kids.find((k) => k.tag === tag);

const NARY: Record<string, string> = { "∑": "\\sum", "∏": "\\prod", "∫": "\\int", "∬": "\\iint", "∭": "\\iiint", "∮": "\\oint", "⋃": "\\bigcup", "⋂": "\\bigcap", "∐": "\\coprod" };
const ACCENT: Record<string, string> = { "̂": "\\hat", "̃": "\\tilde", "̄": "\\bar", "⃗": "\\vec", "̇": "\\dot", "̈": "\\ddot", "̌": "\\check", "́": "\\acute", "̀": "\\grave", "̆": "\\breve" };
const SYMBOL: Record<string, string> = { "α": "\\alpha", "β": "\\beta", "γ": "\\gamma", "δ": "\\delta", "ε": "\\epsilon", "θ": "\\theta", "λ": "\\lambda", "μ": "\\mu", "π": "\\pi", "σ": "\\sigma", "τ": "\\tau", "φ": "\\phi", "ω": "\\omega", "Δ": "\\Delta", "Σ": "\\Sigma", "Ω": "\\Omega", "∞": "\\infty", "≤": "\\le", "≥": "\\ge", "≠": "\\ne", "±": "\\pm", "×": "\\times", "÷": "\\div", "→": "\\to", "∈": "\\in", "≈": "\\approx", "∂": "\\partial", "∇": "\\nabla", "⋅": "\\cdot", "·": "\\cdot", "−": "-" };

/** One OMML node as TeX, or null when it holds a part this doesn't know. */
function tex(n: Node): string | null {
  const all = (nodes: Node[]) => { const parts = nodes.map(tex); return parts.includes(null) ? null : parts.join(""); };
  const arg = (tag: string) => { const k = kid(n, tag); return k ? all(k.kids) : ""; };
  switch (n.tag) {
    case "#text": return "";
    case "#root": case "m:oMath": case "m:e": case "m:num": case "m:den": case "m:sub": case "m:sup": case "m:deg": case "m:fName": case "m:lim": case "m:box": case "m:borderBox": case "m:phant":
      return all(n.kids.filter((k) => !k.tag.endsWith("Pr")));
    case "m:oMathPara": {
      // Its equations, each on a line of its own (code review: two ran together as one).
      const eqs = n.kids.filter((k) => k.tag === "m:oMath").map(tex);
      if (eqs.includes(null)) return null;
      return eqs.length > 1 ? `\\begin{aligned}${eqs.join(" \\\\ ")}\\end{aligned}` : (eqs[0] ?? "");
    }
    case "m:r": {
      const t = n.kids.filter((k) => k.tag === "m:t").map((k) => decode(k.kids.map((x) => x.text ?? "").join(""))).join("");
      return [...t].map((c) => (SYMBOL[c] ? (SYMBOL[c].startsWith("\\") ? `${SYMBOL[c]} ` : SYMBOL[c]) : /[{}#%&$_^\\]/.test(c) ? `\\${c === "\\" ? "backslash " : c}` : c)).join("");
    }
    case "m:f": { const a = arg("m:num"), b = arg("m:den"); return a === null || b === null ? null : val(kid(n, "m:fPr"), "m:type") === "lin" ? `${a}/${b}` : `\\frac{${a}}{${b}}`; }
    case "m:sSup": { const e = arg("m:e"), s = arg("m:sup"); return e === null || s === null ? null : `{${e}}^{${s}}`; }
    case "m:sSub": { const e = arg("m:e"), s = arg("m:sub"); return e === null || s === null ? null : `{${e}}_{${s}}`; }
    case "m:sSubSup": { const e = arg("m:e"), b = arg("m:sub"), s = arg("m:sup"); return e === null || b === null || s === null ? null : `{${e}}_{${b}}^{${s}}`; }
    case "m:sPre": { const e = arg("m:e"), b = arg("m:sub"), s = arg("m:sup"); return e === null || b === null || s === null ? null : `{}_{${b}}^{${s}}{${e}}`; }
    case "m:rad": { const d = arg("m:deg"), e = arg("m:e"); return d === null || e === null ? null : d ? `\\sqrt[${d}]{${e}}` : `\\sqrt{${e}}`; }
    case "m:d": {
      const pr = kid(n, "m:dPr");
      const open = val(pr, "m:begChr") ?? "(", close = val(pr, "m:endChr") ?? ")", sep = val(pr, "m:sepChr") ?? ",";
      const parts = n.kids.filter((k) => k.tag === "m:e").map(tex);
      if (parts.includes(null)) return null;
      const fence = (c: string) => (c === "" ? "." : c === "{" ? "\\{" : c === "}" ? "\\}" : c === "|" ? "|" : c === "‖" ? "\\|" : c === "⟨" ? "\\langle" : c === "⟩" ? "\\rangle" : c === "⌊" ? "\\lfloor" : c === "⌋" ? "\\rfloor" : c === "⌈" ? "\\lceil" : c === "⌉" ? "\\rceil" : c);
      return `\\left${fence(open)}${parts.join(sep)}\\right${fence(close)}`;
    }
    case "m:nary": {
      const pr = kid(n, "m:naryPr");
      const chr = val(pr, "m:chr") ?? "∫";
      const op = NARY[chr] ?? chr;
      const b = val(pr, "m:subHide") === "1" ? "" : arg("m:sub"), s = val(pr, "m:supHide") === "1" ? "" : arg("m:sup"), e = arg("m:e");
      if (b === null || s === null || e === null) return null;
      return `${op}${b ? `_{${b}}` : ""}${s ? `^{${s}}` : ""}{${e}}`;
    }
    case "m:func": { const f = arg("m:fName"), e = arg("m:e"); if (f === null || e === null) return null; const name = f.trim(); return `${/^[a-z]+$/.test(name) ? `\\operatorname{${name}}` : name}{${e}}`; }
    case "m:limLow": { const e = arg("m:e"), l = arg("m:lim"); return e === null || l === null ? null : `${e.trim() === "lim" ? "\\lim" : `\\operatorname*{${e}}`}_{${l}}`; }
    case "m:limUpp": { const e = arg("m:e"), l = arg("m:lim"); return e === null || l === null ? null : `\\overset{${l}}{${e}}`; }
    case "m:acc": { const e = arg("m:e"); const c = val(kid(n, "m:accPr"), "m:chr") ?? "̂"; return e === null ? null : `${ACCENT[c] ?? "\\hat"}{${e}}`; }
    case "m:bar": { const e = arg("m:e"); return e === null ? null : val(kid(n, "m:barPr"), "m:pos") === "bot" ? `\\underline{${e}}` : `\\overline{${e}}`; }
    case "m:groupChr": { const e = arg("m:e"); return e === null ? null : val(kid(n, "m:groupChrPr"), "m:pos") === "top" ? `\\overbrace{${e}}` : `\\underbrace{${e}}`; }
    case "m:m": {
      const rows = n.kids.filter((k) => k.tag === "m:mr").map((r) => { const cells = r.kids.filter((k) => k.tag === "m:e").map(tex); return cells.includes(null) ? null : cells.join(" & "); });
      return rows.includes(null) ? null : `\\begin{matrix}${rows.join(" \\\\ ")}\\end{matrix}`;
    }
    case "m:eqArr": {
      const rows = n.kids.filter((k) => k.tag === "m:e").map(tex);
      return rows.includes(null) ? null : `\\begin{aligned}${rows.map((r) => r!.replace("=", "&=")).join(" \\\\ ")}\\end{aligned}`;
    }
    default:
      // Properties and Word's own run marks inside an equation carry no text; anything else is a part not known.
      if (n.tag.endsWith("Pr") || /^w:(rPr|bookmarkStart|bookmarkEnd|proofErr|ins|del)$/.test(n.tag)) return "";
      return null;
  }
}

/** An equation's XML as TeX, or null when any part of it isn't known. */
export function ommlToTex(xml: string): string | null {
  const t = tex(tree(xml));
  return t === null ? null : t.replace(/\s+/g, " ").replace(/\\(\w+) (?=[^a-zA-Z])/g, "\\$1").trim();
}

/** A document's equations swapped for markers mammoth keeps (`ORE0MATH3ORE0`, closed so a digit after it isn't read as its number), and the TeX of each; null when one
 *  can't be read. A paragraph that is only an equation (`<m:oMathPara>`) is shown on its own line. */
export function markEquations(xml: string, from = 0): { xml: string; maths: { tex: string; display: boolean }[] } | null {
  const maths: { tex: string; display: boolean }[] = [];
  let bad = false;
  const out = xml.replace(/<m:oMathPara\b[\s\S]*?<\/m:oMathPara>|<m:oMath\b[\s\S]*?<\/m:oMath>/g, (eq) => {
    const t = ommlToTex(eq);
    if (t === null || !t) { bad = bad || t === null; return ""; }
    maths.push({ tex: t, display: eq.startsWith("<m:oMathPara") });
    return `<w:r><w:t xml:space="preserve">ORE0MATH${from + maths.length - 1}ORE0</w:t></w:r>`;
  });
  return bad ? null : { xml: out, maths };
}
