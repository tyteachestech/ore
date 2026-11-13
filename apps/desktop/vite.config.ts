import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import { dots } from "./src/dots";
import { FIXES } from "./src/skill-icon-fixes";
import { scaleFontSizes } from "./src/phone/dynamic-type";

// Skill icons (D157) on the UI icons' 16-pixel grid (D129), each pixel a round dot (2026-11-08): each MingCute icon of
// src/skill-icon-set.ts as redrawn by scripts/pixel-skill-icons.ts, or by hand in src/skill-icon-fixes.ts, served as
// /mingcute-px/<name>.svg in dev and written into the build.
const pixelSvg = (rows: readonly string[]) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="${dots(rows)}"/></svg>`;
let pixelCache: Record<string, string> | undefined;
function pixelIcons(): Record<string, string> {
  if (pixelCache) return pixelCache;
  const auto: Record<string, string[]> = JSON.parse(readFileSync(new URL("./src/skill-icons.json", import.meta.url), "utf8"));
  const out: Record<string, string> = {};
  for (const [name, hex] of Object.entries(auto))
    out[name] = pixelSvg(FIXES[name] ?? hex.map((h) => parseInt(h, 16).toString(2).padStart(16, "0").replace(/1/g, "#").replace(/0/g, ".")));
  return (pixelCache = out);
}
const pixelSkillIcons: Plugin = {
  name: "pixel-skill-icons",
  configureServer(server) {
    server.middlewares.use("/mingcute-px", (req, res, next) => {
      const svg = pixelIcons()[decodeURIComponent(req.url ?? "").replace(/^\//, "").replace(/\.svg$/, "")];
      if (!svg) return next();
      res.setHeader("Content-Type", "image/svg+xml");
      res.end(svg);
    });
  },
  generateBundle() {
    for (const [name, svg] of Object.entries(pixelIcons())) this.emitFile({ type: "asset", fileName: `mingcute-px/${name}.svg`, source: svg });
  },
};

// The iPhone build (ORE_PHONE=1, apps/phone): the same UI with the core running inside the app
// (src/phone/core.ts), so the Node and Bun modules the core imports get phone stand-ins.
const PHONE = process.env.ORE_PHONE === "1";
const BUILD = process.argv.includes("build");
// The iPhone's text size (F70, src/phone/dynamic-type.ts): the app's own CSS sizes its text times --type.
const dynamicType: Plugin = {
  name: "dynamic-type",
  enforce: "pre",
  transform(code, id) {
    if (!/src\/(styles|retro)\.css($|\?)/.test(id)) return;
    return { code: scaleFontSizes(code), map: null };
  },
};
const phone = (f: string) => fileURLToPath(new URL(`./src/phone/${f}`, import.meta.url));
const phoneAliases = [
  // The CLI's command table (src/phone/core.ts), aliased so the app's typecheck doesn't walk the core.
  { find: /^ore-commands$/, replacement: fileURLToPath(new URL("../../packages/cli/src/commands.ts", import.meta.url)) },
  { find: /^(node:)?fs$/, replacement: phone("fs.ts") },
  { find: /^(node:)?path$/, replacement: createRequire(import.meta.url).resolve("path-browserify") },
  { find: /^(node:)?os$/, replacement: phone("os.ts") },
  { find: /^(node:)?(util|child_process|crypto)$/, replacement: phone("node.ts") },
  { find: /^bun:sqlite$/, replacement: phone("sqlite.ts") },
  { find: /^@tauri-apps\/api\/core$/, replacement: phone("tauri-core.ts") },
  // The FSRS optimizer is a native module; `ore optimize` stays on the Mac.
  { find: /^@open-spaced-repetition\/binding$/, replacement: phone("node.ts") },
];

// The phone's library in a browser (the e2e journeys, `vite` at phone size): the text files of ORE_PHONE_LIBRARY
// (a demo library, or a copy of his), served as /library.json. Binaries (PDFs, audio, the index, git) stay behind,
// named with null as the phone's folder listing names them (`unread`); thumbnails go as data URLs. The iPhone app reads Ore's iCloud Drive folder instead (src/phone/fs.ts), so its
// build ships no library unless ORE_PHONE_LIBRARY is set.
const phoneLibrary: Plugin = {
  name: "phone-library",
  configureServer(server) {
    server.middlewares.use("/library.json", (_req, res) => res.end(JSON.stringify(snapshot())));
    // A source's own files (its images, audio, PDF) for a browser standing in for the phone, as the shell's asset
    // protocol serves them from the folder: the e2e journeys point convertFileSrc here.
    server.middlewares.use("/library-file", (req, res) => {
      const rel = decodeURIComponent((req.url ?? "").split("?")[0]!).replace(/^\/lib\//, "");
      const root = process.env.ORE_PHONE_LIBRARY!;
      const file = join(root, rel);
      if (rel.split("/").includes("..") || !existsSync(file)) return void ((res.statusCode = 404), res.end());
      const type: Record<string, string> = { svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", pdf: "application/pdf", wav: "audio/wav", m4a: "audio/mp4", mp3: "audio/mpeg" };
      const ext = file.split(".").pop()!.toLowerCase();
      if (type[ext]) res.setHeader("content-type", type[ext]);
      res.end(readFileSync(file));
    });
  },
  generateBundle() {
    if (process.env.ORE_PHONE_LIBRARY) this.emitFile({ type: "asset", fileName: "library.json", source: JSON.stringify(snapshot()) });
  },
};
function snapshot(): Record<string, string | null> {
  const root = process.env.ORE_PHONE_LIBRARY;
  if (!root) throw new Error("ORE_PHONE_LIBRARY: the library folder to put on the phone");
  const out: Record<string, string | null> = {};
  const walk = (dir: string) => {
    for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
      const rel = dir ? `${dir}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (!e.name.startsWith(".")) walk(rel);
      } else if (/\.(md|ya?ml|jsonl?|excalidraw|vtt)$/.test(e.name)) out[rel] = readFileSync(join(root, rel), "utf8");
      // A source's picture (D77), small by design (480px): it goes along as a data URL so lists show it.
      else if (/^(thumbnail|course-cover)\.(jpe?g|png|webp|gif)$/.test(e.name))
        out[rel] = `data:image/${e.name.split(".")[1]!.replace("jpg", "jpeg")};base64,${readFileSync(join(root, rel)).toString("base64")}`;
      else if (!e.name.startsWith(".")) out[rel] = null;
    }
  };
  walk("");
  return out;
}

// The core imports its prompts, the library's AGENTS.md and its Swift helpers as text (`with { type: "text" }`),
// which Bun understands and Vite doesn't.
const textImports: Plugin = {
  name: "text-imports",
  enforce: "pre",
  load(id) {
    if (!/\.(md|swift)$/.test(id)) return;
    return { code: `export default ${JSON.stringify(readFileSync(id, "utf8"))};`, moduleType: "js" };
  },
};

// The ambience radio's sounds (D253): ElevenLabs output may ship inside the app but not as loose files in this public
// repo, so they live on his Mac, in ~/Library/Application Support/Ore/sounds (ORE_SOUNDS overrides; the e2e journeys
// point it at their own tones). Served as /sounds/<id>.mp3 in dev and written into the build when they are there;
// a channel with no file says so in the app.
const SOUNDS = process.env.ORE_SOUNDS ?? join(homedir(), "Library/Application Support/Ore/sounds");
const SOUND_IDS = ["cave", "rain", "lamp", "deep", "focus"];
const soundFile = (id: string) => join(SOUNDS, `${id}.mp3`);
const ambienceSounds: Plugin = {
  name: "ambience-sounds",
  configureServer(server) {
    server.middlewares.use("/sounds", (req, res, next) => {
      const id = (req.url ?? "").split("?")[0]!.replace(/^\//, "").replace(/\.mp3$/, "");
      if (!SOUND_IDS.includes(id) || !existsSync(soundFile(id))) return next();
      res.setHeader("Content-Type", "audio/mpeg");
      res.end(readFileSync(soundFile(id)));
    });
  },
  generateBundle() {
    for (const id of SOUND_IDS) if (existsSync(soundFile(id))) this.emitFile({ type: "asset", fileName: `sounds/${id}.mp3`, source: readFileSync(soundFile(id)) });
  },
};

// Tauri expects a fixed dev port and no screen clearing (it prints its own logs).
// The icon picker's icons ship with the app, so it works offline: the pixel skill icons (pixelSkillIcons, D157).
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    pixelSkillIcons,
    ...(PHONE ? [] : [ambienceSounds]),
    ...(PHONE ? [dynamicType] : []),
    ...(PHONE ? [phoneLibrary, textImports] : []),
  ],
  clearScreen: false,
  // Imported only by the lazy diagram chunk: found late, Vite would re-bundle and reload the page the
  // first time a diagram opens in dev (it lost the reader in the e2e diagram journey on a fresh checkout).
  // Named here so the dev server bundles them at start: one found later (a lazy chunk's) reloads the page mid-use.
  optimizeDeps: { include: ["react-dom/server", "react-colorful", "pdfjs-dist/legacy/build/pdf.mjs"] },
  // Its own cache of bundled dependencies, so the phone build and the Mac one can run side by side (the e2e phone journeys).
  cacheDir: PHONE ? "node_modules/.vite-phone" : undefined,
  server: { port: 1420, strictPort: true, host: PHONE ? true : undefined, watch: { ignored: ["**/src-tauri/**"] } },
  // Fonts stay files: one inlined as data: is refused by the release CSP's font-src 'self' (KaTeX_Size3 was), and
  // the dev server, which has no CSP, never shows it (e2e/release-check.ts does).
  build: { target: "safari17", outDir: PHONE ? "dist-phone" : "dist", assetsInlineLimit: (file) => (/\.(woff2?|ttf|otf|eot)$/.test(file) ? false : undefined) },
  ...(PHONE && {
    resolve: { alias: phoneAliases },
    define: {
      "import.meta.env.VITE_PHONE": JSON.stringify("1"),
      global: "globalThis",
      // A build inlines process.env as {}; read it at run time from src/phone/env.ts instead. (Dev leaves it alone.)
      ...(BUILD && { "process.env": "globalThis.process.env" }),
    },
  }),
});
