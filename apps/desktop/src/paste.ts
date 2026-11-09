// What a paste or a typed entry in the add box becomes: links and file paths are fetched or read
// by `ore add`; anything else is kept as text (`ore add --stdin`).

export const FILE_TYPES = ["pdf", "md", "markdown", "txt", "text", "html", "htm", "epub", "docx", "pptx", "rtf", "xlsx", "csv", "tsv", "ipynb", "srt", "vtt", "png", "jpg", "jpeg", "heic", "tiff", "webp", "gif", "mp3", "m4a", "wav", "aac", "aiff", "flac", "mp4", "mov", "m4v"];

/** What kind of source a dropped file becomes, from its extension; null when Ore can't read it. */
export type FileKind = "pdf" | "book" | "note" | "page" | "image" | "audio" | "video";
export function fileKind(path: string): FileKind | null {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "epub") return "book";
  if (ext === "md" || ext === "markdown" || ext === "txt" || ext === "text" || ext === "docx" || ext === "rtf" || ext === "xlsx" || ext === "csv" || ext === "tsv" || ext === "ipynb" || ext === "srt" || ext === "vtt") return "note";
  if (ext && ["png", "jpg", "jpeg", "heic", "tiff", "webp", "gif"].includes(ext)) return "image"; // its text, read on the Mac (D96)
  if (ext && ["mp3", "m4a", "wav", "aac", "aiff", "flac"].includes(ext)) return "audio"; // transcribed on the Mac (D96)
  if (ext && ["mp4", "mov", "m4v"].includes(ext)) return "video"; // heard from its sound on the Mac (D122)
  return ext === "html" || ext === "htm" || ext === "pptx" ? "page" : null;
}

/** Text pasted from a page (a ChatGPT answer) carries its HTML too, which keeps what the plain text loses. */
export type Entry = { kind: "link"; url: string } | { kind: "file"; path: string } | { kind: "text"; text: string; html?: string } | { kind: "tab" };

const FILE = new RegExp(`^(/|~/)\\S.*\\.(${FILE_TYPES.join("|")})$`, "i");
const WWW = /^www\.[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i;
/** A domain typed bare (paulgraham.com/x): a link, unless its ending names a file or code (README.md, main.py). */
const SITE = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.([a-z]{2,})(\/\S*)?$/i;
const NOT_SITE = new Set([...FILE_TYPES, "js", "jsx", "ts", "tsx", "py", "rb", "json", "yml", "yaml", "css", "swift", "java", "log"]);

function one(line: string): Entry | null {
  if (/^https?:\/\/\S+$/i.test(line)) return { kind: "link", url: line };
  if (/^file:\/\/\S+$/i.test(line)) {
    try {
      return { kind: "file", path: decodeURIComponent(new URL(line).pathname) };
    } catch {
      return null;
    }
  }
  if (FILE.test(line)) return { kind: "file", path: line };
  if (WWW.test(line)) return { kind: "link", url: `https://${line}` };
  const site = SITE.exec(line);
  if (site && !NOT_SITE.has(site[2]!.toLowerCase())) return { kind: "link", url: `https://${line}` };
  return null;
}

/** A link or file per line when every line is one (a pasted list), else the whole text as one source. */
export function entries(raw: string): Entry[] {
  const text = raw.trim();
  if (!text) return [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const each = lines.map(one);
  return each.every((e) => e) ? (each as Entry[]) : [{ kind: "text", text }];
}

/** What a paste is, plain and as HTML. */
export type Pasted = { text: string; html: string | null };

/** The clipboard's HTML when it holds what its plain text loses (images, tables, headings, code, math);
 *  null for plain or lightly styled text, which reads the same as typed. */
export function pastedHtml(d: DataTransfer | null): string | null {
  const html = d?.getData("text/html") ?? "";
  return /<(img|table|h[1-6]|pre|math)[\s>]/i.test(html) ? html : null;
}

/** The entries, with the paste's HTML on its text when the text is still the paste as it came. */
export function withHtml(list: Entry[], pasted: Pasted | null): Entry[] {
  const e = list.length === 1 ? list[0]! : null;
  const same = (a: string) => a.replace(/\r\n?/g, "\n").trim();
  return e?.kind === "text" && pasted?.html && same(e.text) === same(pasted.text) ? [{ ...e, html: pasted.html }] : list;
}

/** A link Ore adds lesson by lesson (D79): a Claude Academy course or lesson, a YouTube playlist (as core's isCourseUrl). */
export const isCourseLink = (url: string) =>
  /^https?:\/\/(?:www\.)?academy\.claude\.com\/courses\/[\w-]+(?:\/[\w-]*)?\/?(?:[?#].*)?$/.test(url) || /^https?:\/\/(?:www\.|m\.)?youtube\.com\/playlist\?(?:.*&)?list=[\w-]+/.test(url);

/** `ore add` arguments and stdin for one entry; a course link adds every lesson. */
export const addArgs = (e: Entry): { args: string[]; stdin: string | null } =>
  e.kind === "text" ? (e.html ? { args: ["add", "--stdin", "--html"], stdin: e.html } : { args: ["add", "--stdin"], stdin: e.text })
  : e.kind === "tab" ? { args: ["add", "--tab"], stdin: null }
  : e.kind === "link" && isCourseLink(e.url) ? { args: ["add", e.url, "--course"], stdin: null }
  : { args: ["add", e.kind === "link" ? e.url : e.path], stdin: null };

/** The entry as he typed it, to put back in the add box. */
export const entryText = (e: Entry) => (e.kind === "link" ? e.url : e.kind === "file" ? e.path : e.kind === "text" ? e.text : "");

/** A short name for the entry, for progress and errors. */
export const entryName = (e: Entry) =>
  e.kind === "link" ? (URL.canParse(e.url) ? new URL(e.url).hostname.replace(/^www\./, "") : e.url) : e.kind === "file" ? e.path.split("/").pop() || e.path : e.kind === "tab" ? "browser tab" : "text";

/** The toast for a list added in one go, `here` of them in the library already (the same file
 *  dropped twice, a link added before), so it never claims more than went in. */
export function manyAdded(n: number, here: number): string {
  const added = n - here;
  if (!here) return `Added ${n} sources`;
  if (!added) return `All ${n} are already here`;
  return `Added ${added} source${added > 1 ? "s" : ""}; ${here} ${here > 1 ? "were" : "was"} already here`;
}

export const words = (t: string) => t.split(/\s+/).filter(Boolean).length;

/** Where a file drag is, in CSS pixels. Tauri types the position as physical pixels, but on macOS wry
 *  passes the view's points through unscaled, so only other platforms divide by the pixel ratio. */
export function dropPoint(p: { x: number; y: number }, mac: boolean, ratio: number): { x: number; y: number } {
  return mac ? { x: p.x, y: p.y } : { x: p.x / ratio, y: p.y / ratio };
}

/** What the add box offers from the clipboard: one link or one file Ore reads, not in the library yet.
 *  Text, a list, a file type it can't read and a link already here are never offered. */
export function copiedEntry(text: string | null, have: Iterable<string>): Entry | null {
  const list = entries(text ?? "");
  const e = list.length === 1 ? list[0]! : null;
  if (!e || e.kind === "text" || e.kind === "tab") return null;
  if (e.kind === "file") return fileKind(e.path) ? e : null;
  return [...have].includes(e.url) || REFUSED.some((r) => r.test(e.url)) ? null : e;
}

/** Links core refuses (D96): an X post (as core's X_POST) and a podcast's show page, not an episode. */
const REFUSED = [/^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/\w+\/status\//, /^https?:\/\/podcasts\.apple\.com\/(?!.*[?&]i=)/];

/** What a copied entry is, for the add box's row: "video", "PDF", "course" and so on. */
export function copiedWhat(e: Entry): string {
  if (e.kind === "file") return ({ pdf: "PDF", book: "book", note: "file", page: "page", image: "image", audio: "audio", video: "video" } as const)[fileKind(e.path)!];
  if (e.kind !== "link") return "link";
  if (isCourseLink(e.url)) return "course";
  if (/^https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//i.test(e.url)) return "video";
  if (/^https?:\/\/podcasts\.apple\.com\/|^https?:\/\/open\.spotify\.com\/episode\//i.test(e.url)) return "episode";
  if (/\.pdf(?:[?#]|$)/i.test(e.url)) return "PDF";
  return "link";
}

/** An image a note can hold (`ore notes --attach`); other pictures are added as sources, for their text. */
export const noteImage = (path: string) => /\.(png|jpe?g|gif|webp|svg)$/i.test(path);

/** The file extension for a pasted image's type (`image/jpeg` → `jpg`), as `ore notes --attach - --ext` takes it. */
export const imageExt = (mime: string) => (mime.split("/")[1] ?? "").replace("jpeg", "jpg").replace(/\+xml$/, "");
