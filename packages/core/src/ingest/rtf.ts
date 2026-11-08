import type { Asset } from "../items.ts";
import { assetName } from "./assets.ts";
import { cleanTitle, fileAuthor } from "./check.ts";

// Rich Text (.rtf), what TextEdit saves and Word and Google Docs can export (D122 gap 8): read here
// as Markdown, with its title and author, bold and italic, headings (Word's outline levels, or a
// short line set clearly larger), lists, tables and pictures.

export interface RtfDoc {
  title?: string;
  author?: string;
  body: string;
  assets: Asset[];
}

/** Groups whose text is not the document's: tables of fonts, colours and styles, headers, fields'
 *  codes, and any `\*` destination a reader doesn't know. */
const SKIP = new Set(["fonttbl", "colortbl", "stylesheet", "listtable", "listoverridetable", "rsidtbl", "generator", "header", "headerl", "headerr", "headerf", "footer", "footerl", "footerr", "footerf", "fldinst", "xmlnstbl", "themedata", "colorschememapping", "datastore", "latentstyles", "pgdsctbl", "expandedcolortbl", "filetbl", "revtbl", "object", "nonshppict", "bkmkstart", "bkmkend", "footnote", "annotation", "atnid", "atnauthor"]);
const SYMBOL: Record<string, string> = { emdash: "—", endash: "–", bullet: "•", lquote: "‘", rquote: "’", ldblquote: "“", rdblquote: "”", tab: "\t", emspace: " ", enspace: " ", qmspace: " " };

interface State {
  skip: boolean;
  bold: boolean;
  italic: boolean;
  size: number;
  /** How many fallback characters follow a `\u` character. */
  uc: number;
  /** The group is \info's `title` or `author`, or a picture. */
  into?: "title" | "author" | "pict";
}
type Run = { text: string; bold: boolean; italic: boolean; size: number };
type Para = { runs: Run[]; level: number; list: boolean };

/** A paragraph's runs as Markdown, a bold or italic run's marks inside its spaces. */
function markdown(parts: Run[]): string {
  const runs: Run[] = [];
  for (const r of parts) {
    const last = runs[runs.length - 1];
    if (last && last.bold === r.bold && last.italic === r.italic) last.text += r.text;
    else runs.push({ ...r });
  }
  let out = "";
  for (const r of runs) {
    if (!(r.bold || r.italic) || !r.text.trim()) {
      out += r.text;
      continue;
    }
    const [, lead, core, tail] = r.text.match(/^(\s*)(.*?)(\s*)$/s)!;
    const mark = r.bold && r.italic ? "***" : r.bold ? "**" : "*";
    out += lead + mark + core + mark + tail;
  }
  return out.replace(/[ \t]+/g, " ").trim();
}

export function rtfToDoc(data: Uint8Array): RtfDoc {
  const src = new TextDecoder("latin1").decode(data);
  if (!src.startsWith("{\\rtf")) throw new Error("That RTF file is damaged: it doesn’t start as one. Open it in TextEdit or Word and save it again.");
  let codepage = "windows-1252";
  const info: { title?: string; author?: string } = {};
  const assets = new Map<string, Asset>();
  const paras: (Para | { table: string[][] })[] = [];
  let runs: Run[] = [];
  let level = -1;
  let list = false;
  let rows: string[][] = [];
  let row: string[] = [];
  let cell: Run[] = [];
  let inTable = false;
  /** A \pard inside a table: the table ends unless the paragraph says it's in one (\intbl). */
  let leaving = false;
  /** How deep the open picture's group is, while one is. */
  let pictDepth = -1;
  let hex = "";
  let pictExt = "";
  let bytes: number[] = [];
  let skipChars = 0;

  const stack: State[] = [];
  let st: State = { skip: false, bold: false, italic: false, size: 24, uc: 1 };
  const decodeBytes = () => {
    if (!bytes.length) return;
    let s: string;
    try {
      s = new TextDecoder(codepage).decode(new Uint8Array(bytes));
    } catch {
      s = new TextDecoder("windows-1252").decode(new Uint8Array(bytes));
    }
    bytes = [];
    put(s, true);
  };
  const put = (s: string, decoded = false) => {
    if (!decoded) decodeBytes();
    if (st.skip || !s) return;
    if (leaving) endTable();
    if (st.into === "title" || st.into === "author") {
      info[st.into] = (info[st.into] ?? "") + s;
      return;
    }
    if (st.into === "pict") return;
    const target = inTable ? cell : runs;
    const last = target[target.length - 1];
    if (last && last.bold === st.bold && last.italic === st.italic && last.size === st.size) last.text += s;
    else target.push({ text: s, bold: st.bold, italic: st.italic, size: st.size });
  };
  const endPara = () => {
    decodeBytes();
    if (leaving) endTable();
    if (inTable) {
      cell.push({ text: " ", bold: false, italic: false, size: st.size });
      return;
    }
    if (runs.some((r) => r.text.trim())) paras.push({ runs, level, list });
    runs = [];
  };
  const endTable = () => {
    if (rows.length) paras.push({ table: rows });
    rows = [];
    inTable = leaving = false;
  };

  for (let i = 0; i < src.length; ) {
    const ch = src[i]!;
    if (skipChars > 0 && ch !== "{" && ch !== "}") {
      // A `\u` character's fallback, written for readers that can't show it.
      if (ch === "\\") {
        const m = /^\\(?:'[0-9a-f]{2}|[a-z]+-?\d* ?|.)/i.exec(src.slice(i, i + 40));
        i += m ? m[0].length : 1;
      } else i++;
      skipChars--;
      continue;
    }
    if (ch === "{") {
      decodeBytes();
      stack.push({ ...st });
      i++;
      continue;
    }
    if (ch === "}") {
      decodeBytes();
      const pict = stack.length === pictDepth;
      st = stack.pop() ?? st;
      if (pict) {
        // A picture Ore can show (PNG or JPEG) becomes its own paragraph.
        pictDepth = -1;
        const img = new Uint8Array((hex.match(/[0-9a-f]{2}/gi) ?? []).map((h) => parseInt(h, 16)));
        if (pictExt && img.length) {
          const name = assetName(img, pictExt);
          assets.set(name, { name, data: img });
          endPara();
          put(`![](assets/${name})`);
          endPara();
        }
        hex = pictExt = "";
      }
      i++;
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      i++;
      continue;
    }
    if (ch !== "\\") {
      if (st.into === "pict" && !st.skip) {
        const end = src.slice(i).search(/[\\{}]/);
        hex += src.slice(i, end < 0 ? undefined : i + end);
        i = end < 0 ? src.length : i + end;
        continue;
      }
      put(ch);
      i++;
      continue;
    }
    // A control: \'hh, an escaped symbol, or \word with an optional number and one space after it.
    const next = src[i + 1] ?? "";
    if (next === "'") {
      bytes.push(parseInt(src.slice(i + 2, i + 4), 16));
      i += 4;
      continue;
    }
    if (!/[a-z]/i.test(next)) {
      i += 2;
      if (next === "*") {
        // An optional destination: skipped unless it's one Ore reads.
        const m = /^\\([a-z]+)/i.exec(src.slice(i, i + 40));
        if (m?.[1] !== "shppict") st.skip = true;
      } else if (next === "~") put(" ");
      else if (next === "_") put("-");
      else if (next === "\\" || next === "{" || next === "}") put(next);
      else if (next === "\n" || next === "\r") endPara();
      continue;
    }
    const m = /^\\([a-z]+)(-?\d+)? ?/i.exec(src.slice(i, i + 40))!;
    i += m[0].length;
    const word = m[1]!;
    const n = m[2] === undefined ? undefined : Number(m[2]);
    if (SKIP.has(word)) {
      st.skip = true;
      continue;
    }
    switch (word) {
      case "ansicpg":
        codepage = n === 1252 || n === undefined ? "windows-1252" : n === 932 ? "shift_jis" : n === 936 ? "gbk" : n === 949 ? "euc-kr" : n === 950 ? "big5" : n === 65001 ? "utf-8" : `windows-${n}`;
        break;
      case "mac":
        codepage = "macintosh";
        break;
      case "info":
        // The document's properties: only its title and author are read.
        st.skip = true;
        break;
      case "title":
      case "author":
        st.into = word;
        st.skip = false;
        break;
      case "pict":
        st.into = "pict";
        pictDepth = stack.length;
        hex = "";
        break;
      case "pngblip":
        pictExt = "png";
        break;
      case "jpegblip":
        pictExt = "jpg";
        break;
      case "u":
        put(String.fromCharCode(n! < 0 ? n! + 65536 : n!));
        skipChars = st.uc;
        break;
      case "uc":
        st.uc = n ?? 1;
        break;
      case "par":
      case "sect":
        endPara();
        break;
      case "line":
        put("\n");
        break;
      case "pard":
        level = -1;
        list = false;
        leaving = inTable;
        break;
      case "outlinelevel":
        level = n ?? 0;
        break;
      case "ls":
      case "ilvl":
        list = true;
        break;
      case "listtext":
        // The bullet or number a list item shows, written out for older readers: the list marks it.
        list = true;
        st.skip = true;
        break;
      case "intbl":
        leaving = false;
        if (!inTable) {
          decodeBytes();
          if (runs.some((r) => r.text.trim())) paras.push({ runs, level, list });
          runs = [];
          inTable = true;
        }
        break;
      case "cell":
        decodeBytes();
        row.push(markdown(cell).replace(/\|/g, "\\|"));
        cell = [];
        break;
      case "row":
        rows.push(row);
        row = [];
        break;
      case "b":
        st.bold = n !== 0;
        break;
      case "i":
        st.italic = n !== 0;
        break;
      case "fs":
        st.size = n ?? 24;
        break;
      case "plain":
        st.bold = st.italic = false;
        st.size = 24;
        break;
      default:
        if (SYMBOL[word]) put(SYMBOL[word]);
    }
  }
  endPara();
  endTable();

  // Body text's usual size: a short paragraph set clearly larger is a heading.
  const sizes = paras.flatMap((p) => ("runs" in p ? p.runs.filter((r) => r.text.trim()).map((r) => r.size) : [])).sort((a, b) => a - b);
  const body = sizes[Math.floor(sizes.length / 2)] ?? 24;
  const out: string[] = [];
  for (const p of paras) {
    if ("table" in p) {
      const width = Math.max(...p.table.map((r) => r.length));
      const line = (r: string[]) => `| ${Array.from({ length: width }, (_, k) => r[k] ?? "").join(" | ")} |`;
      out.push([line(p.table[0]!), `|${" --- |".repeat(width)}`, ...p.table.slice(1).map(line)].join("\n"));
      continue;
    }
    const lines = p.runs.map((r) => r.text).join("").split("\n");
    const text = markdown(p.runs);
    if (!text) continue;
    const plain = text.replace(/\*/g, "");
    const top = Math.max(...p.runs.filter((r) => r.text.trim()).map((r) => r.size));
    if (p.level >= 0 && p.level < 5 && plain.length <= 150) out.push(`${"#".repeat(p.level + 1)} ${plain}`);
    else if (top >= body * 1.2 && plain.length <= 100 && lines.length === 1 && !/[.,;:]$/.test(plain)) out.push(`${top >= body * 1.6 ? "##" : "###"} ${plain}`);
    else if (p.list) out.push(`- ${text.replace(/^[•·\-–◦▪]\s*/, "")}`);
    else out.push(text.split("\n").map((l) => l.trim()).join("  \n"));
  }
  // List items sit together as one list.
  const md = out.join("\n\n").replace(/^(- .*)\n\n(?=- )/gm, "$1\n").trim();
  if (!md) throw new Error("That RTF file has no text to read.");
  const title = cleanTitle(info.title?.trim()) ?? md.match(/^#+ (.+)$/m)?.[1] ?? undefined;
  return { title, author: fileAuthor(info.author), body: md + "\n", assets: [...assets.values()] };
}
