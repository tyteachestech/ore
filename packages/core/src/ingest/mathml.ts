// MathML (an EPUB's or a page's formulas) as TeX, for the reader's `$$…$$` (deep import pass, 2026-11-27).
// The book's own TeX annotation is taken where it gives one; else the presentation markup is converted.
// Anything this can't read returns null, and the formula comes in as its text, as before.

const SYMBOL: Record<string, string> = {
  "∑": "\\sum", "∏": "\\prod", "∫": "\\int", "∮": "\\oint", "≤": "\\le", "≥": "\\ge", "≠": "\\ne", "≈": "\\approx", "≡": "\\equiv",
  "±": "\\pm", "∓": "\\mp", "×": "\\times", "÷": "\\div", "·": "\\cdot", "⋅": "\\cdot", "∞": "\\infty", "→": "\\to", "←": "\\leftarrow",
  "⇒": "\\Rightarrow", "⇔": "\\Leftrightarrow", "↔": "\\leftrightarrow", "∈": "\\in", "∉": "\\notin", "⊂": "\\subset", "⊆": "\\subseteq",
  "∪": "\\cup", "∩": "\\cap", "∅": "\\emptyset", "∀": "\\forall", "∃": "\\exists", "¬": "\\neg", "∧": "\\land", "∨": "\\lor", "∂": "\\partial",
  "∇": "\\nabla", "√": "\\surd", "∝": "\\propto", "∼": "\\sim", "≅": "\\cong", "⊥": "\\perp", "∥": "\\parallel", "∠": "\\angle", "°": "^\\circ",
  "…": "\\ldots", "⋯": "\\cdots", "′": "'", "″": "''", "−": "-", "⁡": "", "⁢": "", "⁣": ",", "⁤": "+",
  α: "\\alpha", β: "\\beta", γ: "\\gamma", δ: "\\delta", ε: "\\epsilon", ϵ: "\\epsilon", ζ: "\\zeta", η: "\\eta", θ: "\\theta", ι: "\\iota", κ: "\\kappa",
  λ: "\\lambda", μ: "\\mu", ν: "\\nu", ξ: "\\xi", π: "\\pi", ρ: "\\rho", σ: "\\sigma", τ: "\\tau", υ: "\\upsilon", φ: "\\phi", ϕ: "\\phi", χ: "\\chi",
  ψ: "\\psi", ω: "\\omega", Γ: "\\Gamma", Δ: "\\Delta", Θ: "\\Theta", Λ: "\\Lambda", Ξ: "\\Xi", Π: "\\Pi", Σ: "\\Sigma", Φ: "\\Phi", Ψ: "\\Psi", Ω: "\\Omega",
};
const ACCENT: Record<string, string> = { "^": "\\hat", "ˆ": "\\hat", "~": "\\tilde", "˜": "\\tilde", "¯": "\\bar", "‾": "\\overline", "→": "\\vec", "˙": "\\dot", "¨": "\\ddot", "⏞": "\\overbrace", "⏟": "\\underbrace", _: "\\underline" };

const name = (e: Element) => (e.localName || e.nodeName).toLowerCase().replace(/^.*:/, "");
const kids = (e: Element) => Array.from(e.children);

/** Equal-height tables laid side by side inside one pair of brackets form a single matrix. */
export function joinMatrixTables(math: Element): void {
  const withoutSpace = (e: Element) => kids(e).filter((child) => name(child) !== "mspace");
  for (const row of [math, ...math.querySelectorAll("mrow, semantics, mfenced")]) {
    const inner = withoutSpace(row).filter((child) => !["annotation", "annotation-xml"].includes(name(child)));
    let brackets: string;
    if (name(row) === "mfenced") {
      brackets = (row.getAttribute("open") ?? "(").trim() + (row.getAttribute("close") ?? ")").trim();
    } else {
      const open = inner.shift();
      const close = inner.pop();
      if (!open || !close || name(open) !== "mo" || name(close) !== "mo") continue;
      brackets = open.textContent!.trim() + close.textContent!.trim();
    }
    if (!["[]", "()", "{}"].includes(brackets)) continue;
    const tables = inner.length === 1 && name(inner[0]!) === "mrow" ? withoutSpace(inner[0]!) : inner;
    if (tables.length < 2 || tables.some((table) => name(table) !== "mtable")) continue;
    const [first, ...rest] = tables.map(kids);
    if (!first?.length || [first, ...rest].some((rows) =>
      rows.length !== first.length || rows.some((tr) => name(tr) !== "mtr"))) continue;
    for (const rows of rest) {
      rows.forEach((tr, i) => first[i]!.append(...kids(tr)));
      rows[0]!.parentElement!.remove();
    }
    tables[0]!.parentElement!.querySelectorAll(":scope > mspace").forEach((space) => space.remove());
  }
}

/** One token's text as TeX: a symbol by name, a letter as itself, TeX's own specials escaped. */
function token(text: string): string {
  return [...text.trim()]
    .map((c) => {
      const s = SYMBOL[c];
      if (s !== undefined) return /^\\[a-zA-Z]+$/.test(s) ? `${s} ` : s;
      if (c === "\\") return "\\backslash ";
      if (c === "~") return "\\sim ";
      if (c === "^") return "\\hat{}";
      return /[{}#$%&_]/.test(c) ? `\\${c}` : c;
    })
    .join("")
    .trimEnd();
}

const group = (s: string) => (/^[^\s{}]$|^\\[a-zA-Z]+$/.test(s) ? s : `{${s}}`);

function tex(e: Element): string | null {
  const parts = (list: Element[]) => {
    const out: string[] = [];
    for (const k of list) {
      const t = tex(k);
      if (t === null) return null;
      if (t) out.push(t);
    }
    return out.join(" ").replace(/\s+/g, " ").replace(/ ([_^])/g, "$1");
  };
  const at = (i: number) => {
    const k = kids(e)[i];
    return k ? tex(k) : null;
  };
  switch (name(e)) {
    case "math": case "mrow": case "mstyle": case "mpadded": case "mphantom": case "merror": case "menclose": case "mtd":
      return parts(kids(e));
    case "semantics": {
      const own = kids(e).find((k) => name(k) === "annotation" && /tex/i.test(k.getAttribute("encoding") ?? ""));
      if (own?.textContent?.trim()) return own.textContent.trim();
      const first = kids(e)[0];
      return first ? tex(first) : "";
    }
    case "annotation": case "annotation-xml": case "mspace": case "none": case "mprescripts":
      return "";
    case "mi": {
      const t = (e.textContent ?? "").trim();
      if (t.length > 1 && /^[A-Za-z]+$/.test(t)) return /^(sin|cos|tan|log|ln|exp|lim|max|min|sup|inf|det|sec|csc|cot|arg|deg|dim|gcd|ker)$/.test(t) ? `\\${t}` : `\\mathrm{${t}}`;
      return token(t);
    }
    case "mn": case "mo":
      return token(e.textContent ?? "");
    case "mtext": case "ms": {
      const t = (e.textContent ?? "").replace(/\s+/g, " ").trim();
      // TeX's own characters escaped, so "50% off" or "$5" can't end the formula early (code review).
      const esc = t.replace(/[\\{}]/g, "").replace(/[#$%&_]/g, "\\$&").replace(/\^/g, "\\textasciicircum{}").replace(/~/g, "\\textasciitilde{}");
      return t ? `\\text{${esc}}` : "";
    }
    case "mfrac": {
      const [a, b] = [at(0), at(1)];
      if (a === null || b === null) return null;
      return e.getAttribute("linethickness") === "0" ? `\\binom{${a}}{${b}}` : `\\frac{${a}}{${b}}`;
    }
    case "msqrt": {
      const a = parts(kids(e));
      return a === null ? null : `\\sqrt{${a}}`;
    }
    case "mroot": {
      const [a, n] = [at(0), at(1)];
      return a === null || n === null ? null : `\\sqrt[${n}]{${a}}`;
    }
    case "msup": case "msub": case "msubsup": {
      const [b, x, y] = [at(0), at(1), name(e) === "msubsup" ? at(2) : ""];
      if (b === null || x === null || y === null) return null;
      const base = group(b);
      if (name(e) === "msup") return `${base}^${group(x)}`;
      if (name(e) === "msub") return `${base}_${group(x)}`;
      return `${base}_${group(x)}^${group(y)}`;
    }
    case "munder": case "mover": case "munderover": {
      const [b, x, y] = [at(0), at(1), name(e) === "munderover" ? at(2) : ""];
      if (b === null || x === null || y === null) return null;
      if (name(e) === "mover" && ACCENT[(kids(e)[1]?.textContent ?? "").trim()]) return `${ACCENT[kids(e)[1]!.textContent!.trim()]}{${b}}`;
      if (name(e) === "munder" && ACCENT[(kids(e)[1]?.textContent ?? "").trim()] === "\\underbrace") return `\\underbrace{${b}}`;
      if (name(e) === "munder" && (kids(e)[1]?.textContent ?? "").trim() === "_") return `\\underline{${b}}`;
      const big = /^\\(sum|prod|int|oint|lim|max|min|sup|inf|bigcup|bigcap)$/.test(b) || /^\\(cup|cap)$/.test(b);
      if (big) return name(e) === "munder" ? `${b}_${group(x)}` : name(e) === "mover" ? `${b}^${group(x)}` : `${b}_${group(x)}^${group(y)}`;
      if (name(e) === "munder") return `\\underset{${x}}{${b}}`;
      if (name(e) === "mover") return `\\overset{${x}}{${b}}`;
      return `\\overset{${y}}{\\underset{${x}}{${b}}}`;
    }
    case "mfenced": {
      const open = e.getAttribute("open") ?? "(";
      const close = e.getAttribute("close") ?? ")";
      const sep = (e.getAttribute("separators") ?? ",").trim()[0] ?? "";
      const inner: string[] = [];
      for (const k of kids(e)) {
        const t = tex(k);
        if (t === null) return null;
        inner.push(t);
      }
      const fence = (c: string) => (c === "{" ? "\\{" : c === "}" ? "\\}" : c || ".");
      return `\\left${fence(open)} ${inner.join(`${sep} `)} \\right${fence(close)}`;
    }
    case "mtable": {
      const rows: string[] = [];
      for (const tr of kids(e)) {
        const cells: string[] = [];
        for (const td of name(tr) === "mtr" || name(tr) === "mlabeledtr" ? kids(tr) : [tr]) {
          const t = tex(td);
          if (t === null) return null;
          cells.push(t);
        }
        rows.push(cells.join(" & "));
      }
      return `\\begin{matrix} ${rows.join(" \\\\ ")} \\end{matrix}`;
    }
    case "mmultiscripts": {
      const base = at(0);
      if (base === null) return null;
      const rest = kids(e).slice(1);
      const split = rest.findIndex((k) => name(k) === "mprescripts");
      const post = split < 0 ? rest : rest.slice(0, split);
      const pre = split < 0 ? [] : rest.slice(split + 1);
      const pairs = (list: Element[]) => {
        let s = "";
        for (let i = 0; i < list.length; i += 2) {
          const [a, b] = [tex(list[i]!), list[i + 1] ? tex(list[i + 1]!) : ""];
          if (a === null || b === null) return null;
          s += `${a ? `_${group(a)}` : ""}${b ? `^${group(b)}` : ""}`;
        }
        return s;
      };
      const [p, q] = [pairs(pre), pairs(post)];
      return p === null || q === null ? null : `${p ? `{}${p}` : ""}${group(base)}${q}`;
    }
    default:
      return null;
  }
}

/** A <math> element as TeX, or null when it holds a part this can't read. */
export function mathmlToTex(math: Element): string | null {
  const t = tex(math);
  return t === null ? null : t.replace(/\s+/g, " ").trim();
}
