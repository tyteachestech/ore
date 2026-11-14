// Builds Ore's design system page (docs/design/brand.md) from the app's own code, so it can't drift from what is
// built: the brand book is brand.md, the tokens are read out of styles.css and retro.css, and every preview mounts
// the real component (show.tsx) under the real stylesheet.
// Usage: bun apps/desktop/scripts/design-system/build.ts <folder>   (writes <folder>/project/, ready to publish)
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const out = process.argv[2];
if (!out) throw new Error("usage: build.ts <folder>");
const src = join(import.meta.dir, "../../src");
const root = join(import.meta.dir, "../../../..");
const write = (path: string, text: string) => {
  const file = join(out, "project", path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
};

const styles = readFileSync(join(src, "styles.css"), "utf8"), retro = readFileSync(join(src, "retro.css"), "utf8");
// A token's value as the app resolves it: retro.css (the look, D129) is loaded after styles.css.
const value = (name: string) => {
  const hit = [retro, styles].map((css) => css.match(new RegExp(`^\\s*--${name}:\\s*([^;]+);`, "m"))?.[1]).find(Boolean);
  if (!hit) throw new Error(`no --${name} in the stylesheets`);
  return hit.trim();
};
const tokens = (list: [string, string][]) => list.map(([name, usage]) => ({ name, value: value(name), usage }));
const fixed = (list: [string, string, string][]) => list.map(([name, v, usage]) => ({ name, value: v, usage }));

const tokensJson = {
  name: "Ore",
  version: 2,
  meta: { source: "apps/desktop/src/styles.css + retro.css, by scripts/design-system/build.ts" },
  color: {
    themes: [{ id: "dark", name: "Dark" }],
    tokens: tokens([
      ["bg", "The page, the sidebar and the reader: a soft neutral charcoal with no blue or violet cast."],
      ["bg-raised", "What floats: menus, popovers, panels, the mole's and the radio's buttons."],
      ["bg-hover", "A hovered row or control. Hover changes the fill, never the border."],
      ["bg-active", "A selected row, a chat bubble, the hairline's twin."],
      ["border", "The one hairline: rules under section labels, edges of floating things."],
      ["text", "Text and icons. 12.6:1 on bg."],
      ["text-read", "Long text he reads in the interface."],
      ["muted", "Secondary text. Use it, not faint, on hover and selected rows."],
      ["faint", "Hints, metadata, placeholders. 4.6:1 on bg; too weak on bg-hover and bg-active."],
      ["paper", "The one main action per view, and an inverted pick. Ink text on it."],
      ["ink", "Text on paper."],
      ["error", "Errors and destructive actions only."],
      ["keep-solid", "A plain highlight: its icon and marks."],
      ["card-solid", "A Key point."],
      ["question-solid", "A question."],
      ["apply-solid", "A try: a technique to use on his own work."],
      ["keep", "A highlighted passage's tint. The words on it stay full-contrast text."],
      ["card", "A Key point's tint."],
      ["question", "A question's tint."],
      ["apply", "A try's tint."],
      ["c-red", "Skill colour. Also the Again rating."],
      ["c-orange", "Skill colour. Also the Hard rating."],
      ["c-yellow", "Skill colour."],
      ["c-green", "Progress: the goal ring, ticks, a met day. Also a skill colour and the Good rating."],
      ["c-teal", "Skill colour."],
      ["c-blue", "Skill colour. Also the Easy rating."],
      ["c-purple", "Skill colour."],
      ["c-pink", "Skill colour."],
      ["c-gray", "A skill with no colour."],
      ["lamp", "The lamp: something is running right now (the radio playing). The mole's helmet lamp."],
      ["lcd", "The radio's screen glass. Dark in every theme: it is a device."],
      ["lcd-edge", "The edge of the radio's screen."],
      ["seam", "The gold rim of a gem won back. The one colour a gem carries beside its skill's."],
    ]),
  },
  type: {
    fonts: [
      { family: "Geist", file: "fonts/Geist-Regular.woff2", weight: "400" },
      { family: "Geist", file: "fonts/Geist-Medium.woff2", weight: "500" },
      { family: "Geist", file: "fonts/Geist-SemiBold.woff2", weight: "600" },
      { family: "Geist", file: "fonts/Geist-Bold.woff2", weight: "700 900" },
      { family: "Geist Mono", file: "fonts/GeistMono-Regular.woff2", weight: "400" },
      { family: "Geist Mono", file: "fonts/GeistMono-Medium.woff2", weight: "500 900" },
      { family: "OpenTUI Mono", file: "fonts/OpenTUIMono-Regular.woff2", weight: "400 600" },
      { family: "OpenTUI Mono", file: "fonts/OpenTUIMono-Bold.woff2", weight: "700 900" },
      { family: "Geist Pixel Circle", file: "fonts/GeistPixel-Circle.woff2", weight: "400 900" },
    ],
    families: {
      sans: "Geist, -apple-system, system-ui, sans-serif",
      mono: '"OpenTUI Mono", "Geist Mono", ui-monospace, Menlo, monospace',
      dot: '"Geist Pixel Circle", "OpenTUI Mono", monospace',
      source: 'Charter, "Bitstream Charter", "New York", ui-serif, Georgia, serif',
    },
    groups: [
      { name: "Interface", family: "sans", styles: [
        { name: "ui", fontSize: "13px", lineHeight: 1.45, fontWeight: 400, sample: "Why does retrieval beat rereading?", usage: "Rows, menus, buttons." },
        { name: "secondary", fontSize: "14px", lineHeight: 1.45, fontWeight: 400, sample: "Spacing beats cramming, even for the same total time.", usage: "Secondary body." },
        { name: "heading", fontSize: "15px", lineHeight: 1.3, fontWeight: 600, sample: "Make It Stick", usage: "List and nav headings." },
        { name: "dialog-title", fontSize: "20px", lineHeight: 1.3, fontWeight: 600, sample: "What to review", usage: "A dialog's title." },
        { name: "page-title", fontSize: "28px", lineHeight: 1.2, fontWeight: 700, sample: "Learning science", usage: "A page's title." },
      ] },
      { name: "Labels", family: "mono", styles: [
        { name: "caption", fontSize: "11px", lineHeight: 1.45, fontWeight: 400, letterSpacing: "0.04em", sample: "Article · 12 min", usage: "Metadata and counts." },
        { name: "label", fontSize: "12px", lineHeight: 1.45, fontWeight: 400, letterSpacing: "0.06em", sample: "Continue reading", usage: "Sentence-case labels, four words at most. The main button." },
        { name: "section", fontSize: "16px", lineHeight: 1.3, fontWeight: 400, sample: "To read", usage: "A page section's name, over its hairline." },
        { name: "number", fontSize: "24px", lineHeight: 1.2, fontWeight: 400, sample: "42", usage: "Big numbers that are not the hero." },
      ] },
      { name: "Dots", family: "dot", styles: [
        { name: "hero-number", fontSize: "40px", lineHeight: 1, fontWeight: 400, sample: "18", usage: "A screen's one hero number. Never under 24px: a dot face is unreadable small." },
      ] },
      { name: "Reading", family: "source", styles: [
        { name: "reading", fontSize: "17px", lineHeight: 1.6, fontWeight: 400, sample: "Retrieval practice strengthens memory more than rereading does.", usage: "A source's own text, about 66 characters a line." },
        { name: "doc-title", fontSize: "30px", lineHeight: 1.2, fontWeight: 700, sample: "The testing effect", usage: "A source's title." },
      ] },
    ],
  },
  spacing: { tokens: fixed([
    ["grid", "4px", "Everything aligns to this."],
    ["gap", "8px", "Between controls in a row."],
    ["section-gap", "36px", "Between a page's sections."],
    ["row", "40px", "A list row's height."],
    ["titlebar", "38px", "The window's top band."],
    ["sidebar", "216px", "The sidebar's width until he drags it."],
  ]) },
  radius: { tokens: fixed([
    ["radius-chip", "4px", "Chips."],
    ["radius-control", "6px", "Buttons and fields."],
    ["radius-row", "8px", "Rows, the segmented control's track."],
    ["radius-card", "10px", "Review's passages and answers, the skill badge."],
    ["radius-panel", "12px", "Menus, panels, sheets."],
    ["radius-pill", "999px", "The level chip only. Never the main button."],
  ]) },
  shadow: { tokens: tokens([["float", "Anything that floats over the page. Nothing on the page itself has a shadow."]]) },
  time: { tokens: tokens([
    ["t-1", "A press, a hover."],
    ["t-2", "A small move: tabs, chips, carets."],
    ["t-3", "What opens: menus, toasts, popups."],
    ["t-4", "What slides in: panels, sheets."],
    ["t-moment", "A moment: a ring filling, a gem cut, a session's end."],
    ["stagger", "Between the dots of a ring or bar as they light."],
  ]) },
  easing: { tokens: tokens([
    ["ease-out", "The default: anything entering or leaving."],
    ["ease-in-out", "Something already on screen moving or growing."],
    ["ease-spring", "Moments only."],
  ]) },
};
write("tokens.json", JSON.stringify(tokensJson, null, 1));

// The brand book: brand.md, with its repo links made plain (the page can't follow them).
write("README.md", readFileSync(join(root, "docs/design/brand.md"), "utf8").replace(/\[(`[^`]+`)\]\([^)]+\)/g, "$1"));

// The bundle: the real components, React included, as window.Ore.
// Gem.tsx reads one helper from ore.ts, which would pull in the whole app: the previews need only its name.
const stubOre = { name: "stub-ore", setup(b: import("bun").PluginBuilder) { b.onLoad({ filter: /src\/ore\.ts$/ }, () => ({ contents: "export const levelProgress = () => 0;", loader: "ts" })); } };
const built = await Bun.build({ entrypoints: [join(import.meta.dir, "show.tsx")], target: "browser", format: "iife", minify: true, define: { "process.env.NODE_ENV": '"production"' }, plugins: [stubOre] });
if (!built.success) throw new AggregateError(built.logs, "bundle failed");
const js = (await built.outputs[0]!.text()).replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "\\x3C!--");
write("components/bundle.js", `/* @ds-bundle: {"format":4,"namespace":"Ore","components":[]} */\n${js}\n`);

// The app's stylesheet whole (the page supplies the fonts from tokens.json), then the previews' own layout.
const css = [styles, retro].join("\n").replace(/@font-face\s*\{[^}]*\}/g, "");
write("components/bundle.css", `${css}
html, body { height: auto; min-height: 0; overflow: visible; background: var(--bg); }
body { padding: 20px 24px; }
.ds-row { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 28px; margin: 0; padding: 0; list-style: none; }
.ds-row.ds-tight { gap: 8px; align-items: center; }
.ds-stack { display: grid; gap: 16px; }
.ds-cell { display: grid; justify-items: center; gap: 10px; margin: 0; }
.ds-cell figcaption { font: 11px var(--mono); letter-spacing: 0.04em; color: var(--faint); }
.ds-art { display: grid; place-items: center; min-height: 36px; }
.ds-icons { display: flex; flex-wrap: wrap; gap: 10px; color: var(--muted); }
.ds-icons span, .ds-ink { display: inline-flex; color: var(--text); }
.ds-icons span { color: inherit; }
.ds-hero { font: 40px/1 var(--dot); color: var(--text); }
.ds-bar { --fill: var(--paper); }
.ds-orb { position: static; }
.ds-rate { margin: 0; width: 320px; }
.ds-row .intent { white-space: nowrap; }
`);
for (const f of ["Geist-Regular", "Geist-Medium", "Geist-SemiBold", "Geist-Bold", "GeistMono-Regular", "GeistMono-Medium", "OpenTUIMono-Regular", "OpenTUIMono-Bold", "GeistPixel-Circle"]) cpSync(join(src, "fonts", `${f}.woff2`), join(out, "project/fonts", `${f}.woff2`));
for (const f of ["OFL-Geist.txt", "OpenTUIMono-OFL.txt"]) cpSync(join(src, "fonts", f), join(out, "project/fonts", f));

// One preview per thing: [folder, show.tsx name, group, height, subtitle, guidelines].
const previews: [string, string, string, number, string, string][] = [
  ["Gem", "gems", "Dots", 130, "A memory, from rough stone to cut gem", "A gem is one memory, drawn as dots that fuse into pixels as it gets stronger.\n\n- Loose dots need work; solid pixels hold. A rock becomes a gem's outline at its first cut and keeps it.\n- Its colour is its skill's. The only other colour is the gold rim of one won back (`seam`).\n- No gem glows: no shadow, no blur. A polished gem gets a small plus-shaped sparkle.\n- 10 by 8 cells under 22px, 14 by 11 from there up."],
  ["Progress", "progress", "Dots", 150, "Rings, bars and numbers in dots", "Progress is drawn one dot per step.\n\n- Any progress lights one dot; only a finished ring lights them all.\n- Green (`c-green`) is the day's goal; a skill's ring takes the skill's colour; how far he has read is `paper`.\n- A screen has one hero number, in Geist Pixel Circle at 40px. Counts in rows stay in the mono.\n- Dots light `stagger` apart, never all at once."],
  ["Icons", "icons", "Dots", 230, "Every icon is a 16-grid sprite of round dots", "One icon set: MingCute's shapes redrawn on a 16 grid, every pixel a round dot 0.38 of a cell wide.\n\n- Drawn at 20px where 16 is asked, centred by their ink on the label's capitals.\n- `muted` by default; a selected icon shows by its row, never a second drawing.\n- Colour only for the four highlight types.\n- Never an emoji, a smooth glyph or another icon library beside them."],
  ["Lamp", "lamp", "Motion", 150, "Something is running right now", "The lamp is how a thing that is running says so: its dots turn amber and breathe in place.\n\n- It follows a real signal (the sound's level, each word the voice speaks, words arriving in a reply), so it reads as alive, never as a timer.\n- Three places: the radio playing, Listen reading aloud, the mole's helmet lamp while the tutor writes.\n- Dots swell and brighten where they stand. Nothing travels.\n- Off, it is grey and perfectly still: light means on.\n- Small and at the edge of the screen. It goes still under Reduce Motion, and should if it ever pulls his eye from reading.\n- Amber (`lamp`) means running now. It never means progress (green) or a reward (the glint)."],
  ["ResultMarks", "marks", "Motion", 130, "Each loops the way the thing itself would", "The marks beside a finished session's results: a gem, a calendar, a comet.\n\n- Shaded by dot size and brightness, in `text`. No colour.\n- Each loops its own way while the end screen is open: light crossing the gem's faces, days lighting one by one, a tail streaming.\n- These loops and the lamp are the only motion without an end."],
  ["Mole", "mole", "Mascot", 150, "The tutor. Press a mood", "The tutor is a miner mole: one traced drawing of about 580 dots, the same at every size.\n\n- He reacts once to what just happened, then rests. He blinks and glances at rest.\n- Greys only, plus his pink nose and amber lamp.\n- An open eye always keeps its white glint.\n- A miss gets a set jaw, never a sad face. He never nags."],
  ["Controls", "controls", "Controls", 220, "The four kinds of button", "Four buttons cover the app.\n\n- **Main action**: one per view, `paper` with ink text in the mono, 6px corners. Never a pill.\n- **Any other button**: 26px, a hairline edge, no fill, sans 12px.\n- **A choice of a few**: one segmented control everywhere. The picked option is a raised grey key; only its icon carries colour.\n- **An answer**: a button with a 3px lip it drops into when pressed."],
];
for (const [folder, name, group, height, subtitle, guide] of previews) {
  write(`components/${folder}/preview.html`, `<!-- @dsCard group="${group}" height=${height} subtitle="${subtitle}" -->\n<div id="r"></div>\n<script>Ore.show("${name}", document.getElementById("r"));</script>\n`);
  write(`components/${folder}/README.md`, `# ${folder}\n\n${guide}\n`);
}

// The cover: the app icon and the name over the palette's blocks and a dot grid. The icon is the page's own
// upload of src-tauri/icons/icon.png (Logos); upload it again and change this id if the icon is redrawn.
const ICON = "/_blob/310cbe6f56d1f15a6a5958a31cdd1408";
const dotGrid = Array.from({ length: 5 }, (_, y) => Array.from({ length: 15 }, (_, x) => `<circle cx="${232 + x * 16}" cy="${24 + y * 16}" r="1.5"/>`).join("")).join("");
write("components/Cover/preview.html", `<!-- @dsCard height=300 -->
<style>
  html, body { margin: 0; padding: 0; background: var(--bg); }
  .c { position: relative; width: 960px; height: 300px; overflow: hidden; }
  .c svg { position: absolute; left: 480px; top: 0; }
  .q { fill: var(--question-solid); } .a { fill: var(--apply-solid); } .k { fill: var(--keep-solid); } .cd { fill: var(--card-solid); } .l { fill: var(--lamp); } .p { fill: var(--bg-raised); } .dot { fill: var(--faint); }
  .t { position: absolute; left: 48px; bottom: 44px; max-width: 400px; }
  .t h1 { margin: 0; font: 600 64px/1 Geist, sans-serif; color: var(--text); letter-spacing: -.03em; }
  .t p { margin: 12px 0 0; font: 13px/18px var(--mono); color: var(--muted); }
  .icon { position: absolute; left: 40px; top: 28px; width: 72px; height: 72px; }
</style>
<div class="c">
  <svg width="480" height="300" viewBox="0 0 480 300" aria-hidden="true">
    <!-- blocks: bg-raised 264x300 slab; question-solid 160x112, apply-solid 112x64, card-solid 64x112, keep-solid 64x64, lamp disc r 20; corners radius-panel (12)
         arrangement: one tall slab bleeding off top and bottom, the four highlight colours stacked against it, the lamp a single lit dot
         pattern: a dot grid at 16px (4 x grid): "round dots are the signature"
         steps: 16 / 24 / 64; radius-panel -->
    <rect class="p" x="216" y="0" width="264" height="300"/>
    <g class="dot">${dotGrid}</g>
    <rect class="q" x="56" y="72" width="160" height="112" rx="12"/>
    <rect class="a" x="104" y="196" width="112" height="64" rx="12"/>
    <rect class="cd" x="240" y="136" width="64" height="112" rx="12"/>
    <rect class="k" x="320" y="184" width="64" height="64" rx="12"/>
    <circle class="l" cx="420" cy="156" r="20"/>
  </svg>
  <img class="icon" src="${ICON}" alt="Ore's app icon: a pickaxe in dots">
  <div class="t"><h1>Ore</h1><p>Calm learning, drawn in dots.</p></div>
</div>
`);
console.log(`design system written to ${join(out, "project")}`);
