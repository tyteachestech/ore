// The demo library's thumbnails (seed-demo.ts): what a real import would have given each source (D77). An
// article gets the share card its site would serve, a PDF its first page, a book its cover. Drawn as SVG so the
// seed needs no browser and no image tool; every picture is made from the source's own title, so none is copied.
const W = 480, H = 270;
const INK = "#16171a", PAPER = "#f4f3ee";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const hash = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

/** The title's words in rows of at most `max` letters, at most `rows` rows (the last one cut with an ellipsis). */
function wrap(text: string, max: number, rows: number): string[] {
  const out: string[] = [];
  for (const word of text.split(" ")) {
    const last = out[out.length - 1];
    if (last !== undefined && `${last} ${word}`.length <= max) out[out.length - 1] = `${last} ${word}`;
    else out.push(word);
  }
  return out.length > rows ? [...out.slice(0, rows - 1), `${out[rows - 1]}…`] : out;
}
const lines = (rows: string[], x: number, y: number, step: number, attrs: string) =>
  rows.map((row, i) => `<text x="${x}" y="${y + i * step}" ${attrs}>${esc(row)}</text>`).join("");
// A share card leads with the title up to its first colon, as a headline does.
const headline = (title: string) => title.split(/[:,?]/)[0]!.trim();
const svg = (bg: string, body: string, defs = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}<rect width="${W}" height="${H}" fill="${bg}"/>${body}</svg>`;

/** A PDF's first page: the title in a serif over a rule and lines of text, on a sheet lying on grey. */
function page(title: string, h: number): string {
  const rows = wrap(title, 26, 3), top = 60 + rows.length * 23;
  const text = Array.from({ length: 12 }, (_, i) => `<rect x="120" y="${top + 16 + i * 14}" width="${(i + h) % 4 === 3 ? 150 : 240}" height="5" fill="#c9c9c4"/>`).join("");
  return svg("#3a3b3f", `<rect x="90" y="22" width="300" height="${H}" fill="${PAPER}"/>${lines(rows, 120, 66, 23, `font-family="Georgia, serif" font-size="19" font-weight="600" fill="#1b1b1b"`)}<rect x="120" y="${top}" width="240" height="1" fill="#999"/>${text}`);
}

/** A book's cover, upright in the middle of the frame: the title in a serif on the skill's colour. */
function cover(title: string, colour: string): string {
  const rows = wrap(headline(title), 11, 4);
  return svg("#26272b", `<rect x="165" y="22" width="150" height="226" fill="${colour}"/>${lines(rows, 179, 62, 24, `font-family="Georgia, serif" font-size="21" font-weight="700" fill="${INK}"`)}<rect x="179" y="188" width="122" height="3" fill="${INK}"/>`);
}

/** An article's share card: its headline large at the foot, in one of four house styles a site might have. */
function card(title: string, colour: string, h: number): string {
  const sans = `font-family="Helvetica, Arial, sans-serif" font-weight="800" font-size="54" letter-spacing="-1"`;
  const style = [
    { bg: colour, max: 14, step: 56, attrs: `${sans} fill="${INK}"` },
    { bg: PAPER, max: 15, step: 56, attrs: `font-family="Georgia, serif" font-weight="600" font-size="52" fill="${INK}"` },
    { bg: INK, max: 13, step: 54, attrs: `font-family="Menlo, ui-monospace, monospace" font-weight="700" font-size="46" fill="${colour}"` },
    { bg: "url(#g)", max: 14, step: 56, attrs: `${sans} fill="#fff"` },
  ][h % 4]!;
  const rows = wrap(headline(title), style.max, 3);
  const defs = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${colour}"/><stop offset="0.85" stop-color="${INK}"/></linearGradient></defs>`;
  return svg(style.bg, lines(rows, 34, H - 34 - (rows.length - 1) * style.step, style.step, style.attrs), defs);
}

/** The picture a source of this kind would have come in with, as an SVG file's text. */
export function demoThumb(title: string, type: string, colour: string): string {
  const h = hash(title);
  return type === "pdf" ? page(title, h) : type === "epub" ? cover(title, colour) : card(title, colour, h);
}
