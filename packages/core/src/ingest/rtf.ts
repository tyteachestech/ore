import type { Asset } from "../items.ts";
import { assetName } from "./assets.ts";
import { cleanTitle, fileAuthor } from "./check.ts";

// Rich Text (.rtf), what TextEdit saves and Word and Google Docs can export (D122 gap 8): read here
// as Markdown, with its title, author and date, bold and italic, headings (Word's outline levels, or
// a short line set clearly larger), lists, tables, links, footnotes and pictures.

export interface RtfDoc {
  title?: string;
  author?: string;
  published?: string;
  body: string;
  assets: Asset[];
}

/** Groups whose text is not the document's: tables of colours and styles, headers and footers, and
 *  other bookkeeping. Any `\*` group not read below is skipped too, as the format asks. */
const SKIP = new Set(["colortbl", "stylesheet", "listtable", "listoverridetable", "rsidtbl", "generator", "header", "headerl", "headerr", "headerf", "footer", "footerl", "footerr", "footerf", "xmlnstbl", "themedata", "colorschememapping", "datastore", "latentstyles", "pgdsctbl", "expandedcolortbl", "filetbl", "revtbl", "object", "nonshppict", "bkmkstart", "bkmkend", "annotation", "atnid", "atnauthor", "atrfstart", "atrfend"]);
/** `\*` groups that hold what Ore reads: Word's pictures and a link's target. */
const STARRED = new Set(["shppict", "fldinst"]);
const SYMBOL: Record<string, string> = { emdash: "—", endash: "–", bullet: "•", lquote: "‘", rquote: "’", ldblquote: "“", rdblquote: "”", tab: "\t", emspace: " ", enspace: " ", qmspace: " " };
/** A font's `\fcharset` as the code page its `\'hh` bytes are in. */
const CHARSET: Record<number, string> = { 77: "macintosh", 128: "shift_jis", 129: "euc-kr", 134: "gbk", 136: "big5", 161: "windows-1253", 162: "windows-1254", 163: "windows-1258", 177: "windows-1255", 178: "windows-1256", 186: "windows-1257", 204: "windows-1251", 222: "windows-874", 238: "windows-1250" };
const CODEPAGE: Record<number, string> = { 932: "shift_jis", 936: "gbk", 949: "euc-kr", 950: "big5", 10000: "macintosh", 65001: "utf-8" };

// Marks kept in the text until it is Markdown, so escaping never touches them.
const LINK = "\uE010";
const LINK_TO = "\uE011";
const LINK_END = "\uE012";
const NOTE = "\uE013";
const NOTE_END = "\uE014";

type Dest = "title" | "author" | "creatim" | "fonttbl" | "pict" | "listtext" | "fldinst" | "footnote";
interface State {
  skip: boolean;
  /** Hidden text (`\v`) and tracked deletions aren't read. */
  hidden: boolean;
  bold: boolean;
  italic: boolean;
  size: number;
  font: number;
  /** How many fallback characters follow a `\u` character. */
  uc: number;
  dest?: Dest;
}
type Run = { text: string; bold: boolean; italic: boolean; size: number };
type Para = { runs: Run[]; level: number; list: boolean; ordered: boolean; depth: number };
/** A paragraph that is already Markdown: a picture. */
type Raw = { raw: string };

const escape = (s: string) => s.replace(/([\\`*_[\]<>])/g, "\\$1");

/** A paragraph's runs as Markdown: bold and italic opened and closed around words, never spaces. */
function markdown(runs: Run[]): string {
  let out = "";
  const open: string[] = [];
  const close = (to: number) => {
    const marks = open.splice(to).reverse().join("");
    if (marks) out = out.replace(/\s*$/, (s) => marks + s);
  };
  for (const r of runs) {
    const [, lead, core, tail] = r.text.match(/^(\s*)(.*?)(\s*)$/s)!;
    if (!core) {
      out += r.text;
      continue;
    }
    const want = [r.bold ? "**" : "", r.italic ? "*" : ""].filter(Boolean);
    let keep = 0;
    while (keep < open.length && open[keep] === want[keep]) keep++;
    close(keep);
    out += lead + want.slice(keep).join("") + escape(core) + tail;
    open.push(...want.slice(keep));
  }
  close(0);
  return out
    .replace(/[ \t]+/g, " ")
    .trim()
    .replace(new RegExp(`${LINK}([^]*?)${LINK_TO}([^${LINK_END}]*)${LINK_END}`, "g"), (_, text: string, url: string) => (text.trim() ? `[${text}](${url})` : ""))
    .replace(new RegExp(`${NOTE}(\\d+)${NOTE_END}`, "g"), "[^$1]");
}

export function rtfToDoc(data: Uint8Array): RtfDoc {
  const src = new TextDecoder("latin1").decode(data).replace(/^\xEF\xBB\xBF/, "");
  if (!src.startsWith("{\\rtf")) throw new Error("That RTF file is damaged: it doesn’t start as one. Open it in TextEdit or Word and save it again.");
  let codepage = "windows-1252";
  const charsets = new Map<number, number>();
  let tableFont = 0;
  const info: { title?: string; author?: string } = {};
  const date: Record<string, number> = {};
  const assets = new Map<string, Asset>();
  const paras: (Para | Raw | { table: string[][] })[] = [];
  const notes: string[] = [];
  let runs: Run[] = [];
  let level = -1;
  let list = false;
  let ordered = false;
  let depth = 0;
  let rows: string[][] = [];
  let row: string[] = [];
  let cell: Run[] = [];
  let note: Run[] = [];
  let inTable = false;
  /** A \pard inside a table: the table ends unless the paragraph says it's in one (\intbl). */
  let leaving = false;
  let hex = "";
  let pictExt = "";
  let marker = "";
  let field = "";
  let url: string | undefined;
  let bytes: number[] = [];
  let skipChars = 0;
  /** What to do when the group at a depth closes: a picture, a footnote or a link is finished. */
  const closers = new Map<number, () => void>();

  const stack: State[] = [];
  let st: State = { skip: false, hidden: false, bold: false, italic: false, size: 24, font: 0, uc: 1 };
  const decodeBytes = () => {
    if (!bytes.length) return;
    const cs = charsets.get(st.font);
    const page = (cs !== undefined && CHARSET[cs]) || codepage;
    let s: string;
    try {
      s = new TextDecoder(page).decode(new Uint8Array(bytes));
    } catch {
      s = new TextDecoder("windows-1252").decode(new Uint8Array(bytes));
    }
    bytes = [];
    put(s);
  };
  const put = (s: string) => {
    if (bytes.length) decodeBytes();
    if (st.skip || st.hidden || !s) return;
    if (st.dest === "title" || st.dest === "author") info[st.dest] = (info[st.dest] ?? "") + s;
    else if (st.dest === "listtext") marker += s;
    else if (st.dest === "fldinst") field += s;
    else if (st.dest === "pict") hex += s;
    else if (st.dest === "creatim" || st.dest === "fonttbl") return;
    else {
      if (leaving && st.dest !== "footnote") endTable();
      const target = st.dest === "footnote" ? note : inTable ? cell : runs;
      const last = target[target.length - 1];
      if (last && last.bold === st.bold && last.italic === st.italic && last.size === st.size) last.text += s;
      else target.push({ text: s, bold: st.bold, italic: st.italic, size: st.size });
    }
  };
  const endPara = () => {
    decodeBytes();
    if (st.dest === "footnote") return put(" ");
    if (leaving) endTable();
    if (inTable) return put(" ");
    if (runs.some((r) => r.text.trim())) paras.push({ runs, level, list, ordered, depth });
    runs = [];
  };
  const endTable = () => {
    if (rows.length) paras.push({ table: rows });
    rows = [];
    inTable = leaving = false;
  };

  for (let i = 0; i < src.length; ) {
    const ch = src[i]!;
    if (ch === "\r" || ch === "\n") {
      i++;
      continue;
    }
    if (skipChars > 0 && ch !== "{" && ch !== "}") {
      // A `\u` character's fallback, written for readers that can't show it.
      const m = ch === "\\" ? /^\\(?:'[0-9a-f]{2}|[a-z]+-?\d* ?|.)/i.exec(src.slice(i, i + 40)) : null;
      i += m ? m[0].length : 1;
      skipChars--;
      continue;
    }
    if (ch === "{" || ch === "}") {
      decodeBytes();
      skipChars = 0;
      if (ch === "{") stack.push({ ...st });
      else {
        const done = closers.get(stack.length);
        closers.delete(stack.length);
        st = stack.pop() ?? st;
        done?.();
      }
      i++;
      continue;
    }
    if (ch !== "\\") {
      // Plain text runs to the next control or brace.
      const end = src.slice(i).search(/[\\{}\r\n]/);
      put(src.slice(i, end < 0 ? undefined : i + end));
      i = end < 0 ? src.length : i + end;
      continue;
    }
    const next = src[i + 1] ?? "";
    if (next === "'") {
      bytes.push(parseInt(src.slice(i + 2, i + 4), 16));
      i += 4;
      continue;
    }
    decodeBytes();
    if (!/[a-z]/i.test(next)) {
      i += 2;
      if (next === "*") {
        const m = /^\\([a-z]+)/i.exec(src.slice(i, i + 40));
        if (!m || !STARRED.has(m[1]!)) st.skip = true;
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
        codepage = CODEPAGE[n ?? 1252] ?? `windows-${n ?? 1252}`;
        break;
      case "mac":
        codepage = "macintosh";
        break;
      case "fonttbl":
        st.dest = "fonttbl";
        break;
      case "f":
        if (st.dest === "fonttbl") tableFont = n ?? 0;
        else st.font = n ?? 0;
        break;
      case "fcharset":
        if (st.dest === "fonttbl") charsets.set(tableFont, n ?? 0);
        break;
      case "info":
        // The document's properties: only its title, author and date are read.
        st.skip = true;
        break;
      case "title":
      case "author":
        st.dest = word;
        st.skip = false;
        break;
      case "creatim":
        st.dest = "creatim";
        break;
      case "yr":
      case "mo":
      case "dy":
        if (st.dest === "creatim") date[word] = n ?? 0;
        break;
      case "pict":
        st.dest = "pict";
        hex = pictExt = "";
        closers.set(stack.length, () => {
          // A picture Ore can show (PNG or JPEG) becomes its own paragraph.
          const img = new Uint8Array((hex.match(/[0-9a-f]{2}/gi) ?? []).map((h) => parseInt(h, 16)));
          if (!pictExt || !img.length) return;
          const name = assetName(img, pictExt);
          assets.set(name, { name, data: img });
          endPara();
          paras.push({ raw: `![](assets/${name})` });
        });
        break;
      case "pngblip":
        pictExt = "png";
        break;
      case "jpegblip":
        pictExt = "jpg";
        break;
      case "footnote": {
        // A footnote is marked where it stands and written out at the end, as Markdown footnotes.
        const k = notes.length + 1;
        put(`${NOTE}${k}${NOTE_END}`);
        notes.push("");
        st.dest = "footnote";
        note = [];
        const props = { level, list, ordered, depth };
        closers.set(stack.length, () => {
          notes[k - 1] = `[^${k}]: ${markdown(note)}`;
          ({ level, list, ordered, depth } = props);
        });
        break;
      }
      case "fldinst":
        st.dest = "fldinst";
        field = "";
        closers.set(stack.length, () => (url = field.match(/HYPERLINK\s+"([^"]+)"/)?.[1]));
        break;
      case "fldrslt":
        if (url) {
          const to = url;
          url = undefined;
          put(LINK);
          closers.set(stack.length, () => put(`${LINK_TO}${to}${LINK_END}`));
        }
        break;
      case "listtext":
        // The bullet or number a list item shows, written out for older readers.
        st.dest = "listtext";
        marker = "";
        closers.set(stack.length, () => {
          list = true;
          ordered = /^\s*\(?(?:\d+|[a-z]|[ivxlc]+)[.)]/i.test(marker);
        });
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
      case "page":
        endPara();
        break;
      case "line":
        put("\n");
        break;
      case "pard":
        if (st.dest === "footnote") break;
        level = -1;
        list = ordered = false;
        depth = 0;
        leaving = inTable;
        break;
      case "outlinelevel":
        level = n ?? 0;
        break;
      case "ls":
        list = true;
        break;
      case "ilvl":
        list = true;
        depth = n ?? 0;
        break;
      case "intbl":
        if (st.dest === "footnote") break;
        leaving = false;
        if (!inTable) {
          if (runs.some((r) => r.text.trim())) paras.push({ runs, level, list, ordered, depth });
          runs = [];
          inTable = true;
        }
        break;
      case "cell":
        if (!inTable) break;
        row.push(markdown(cell).replace(/\n/g, " ").replace(/\|/g, "\\|"));
        cell = [];
        break;
      case "row":
        if (!inTable) break;
        rows.push(row);
        row = [];
        break;
      case "b":
        st.bold = n !== 0;
        break;
      case "i":
        st.italic = n !== 0;
        break;
      case "v":
      case "deleted":
        st.hidden = n !== 0;
        break;
      case "fs":
        st.size = n ?? 24;
        break;
      case "plain":
        st.bold = st.italic = st.hidden = false;
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
    if ("raw" in p) {
      out.push(p.raw);
      continue;
    }
    if ("table" in p) {
      const width = Math.max(...p.table.map((r) => r.length));
      const line = (r: string[]) => `| ${Array.from({ length: width }, (_, k) => r[k] ?? "").join(" | ")} |`;
      out.push([line(p.table[0]!), `|${" --- |".repeat(width)}`, ...p.table.slice(1).map(line)].join("\n"));
      continue;
    }
    const text = markdown(p.runs);
    if (!text) continue;
    const plain = p.runs.map((r) => r.text).join("").replace(/\s+/g, " ").trim();
    const top = Math.max(...p.runs.filter((r) => r.text.trim()).map((r) => r.size));
    const heading = (hashes: string) => `${hashes} ${markdown([{ ...p.runs[0]!, text: plain, bold: false, italic: false }])}`;
    if (p.level >= 0 && p.level < 6 && plain.length <= 150) out.push(heading("#".repeat(p.level + 1)));
    else if (top >= body * 1.2 && plain.length <= 100 && !/\n/.test(p.runs.map((r) => r.text).join("").trim()) && !/[.,;:]$/.test(plain)) out.push(heading(top >= body * 1.6 ? "##" : "###"));
    else if (p.list) out.push(`${"  ".repeat(p.depth)}${p.ordered ? "1." : "-"} ${text}`);
    // A paragraph that starts like a heading, a list or a quote is only text.
    else out.push(text.replace(/^(\d+)([.)] )/, "$1\\$2").replace(/^([#>+-] )/, "\\$1").split("\n").map((l) => l.trim()).join("  \n"));
  }
  // List items sit together as one list.
  const md = [out.join("\n\n").replace(/^( *(?:-|1\.) .*)\n\n(?= *(?:-|1\.) )/gm, "$1\n").trim(), notes.filter(Boolean).join("\n")].filter(Boolean).join("\n\n");
  if (!md.trim()) throw new Error("That RTF file has no text to read.");
  const pad = (v: number) => String(v).padStart(2, "0");
  const published = date.yr && date.yr > 1900 ? `${date.yr}-${pad(date.mo || 1)}-${pad(date.dy || 1)}` : undefined;
  const title = cleanTitle(info.title?.trim()) ?? md.match(/^#+ (.+)$/m)?.[1]?.replace(/\\(.)/g, "$1");
  return { title, author: fileAuthor(info.author), published, body: md + "\n", assets: [...assets.values()] };
}
