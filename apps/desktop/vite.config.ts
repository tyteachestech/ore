import react from "@vitejs/plugin-react";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

// MingCute's fill icons as [name, category] pairs for the picker's search; the SVGs themselves are copied below.
const MINGCUTE = "node_modules/mingcute_icon/svg";
const mingcuteList: Plugin = {
  name: "mingcute-list",
  resolveId: (id) => (id === "virtual:mingcute" ? "\0virtual:mingcute" : undefined),
  load(id) {
    if (id !== "\0virtual:mingcute") return;
    const icons = readdirSync(MINGCUTE).flatMap((category) =>
      readdirSync(`${MINGCUTE}/${category}`).flatMap((f) => (f.endsWith("_fill.svg") ? [[f.slice(0, -9), category]] : [])),
    );
    return `export default ${JSON.stringify(icons)};`;
  },
};

// The iPhone build (ORE_PHONE=1, apps/phone): the same UI with the core running inside the app
// (src/phone/core.ts), so the Node and Bun modules the core imports get phone stand-ins.
const PHONE = process.env.ORE_PHONE === "1";
const BUILD = process.argv.includes("build");
const phone = (f: string) => fileURLToPath(new URL(`./src/phone/${f}`, import.meta.url));
const phoneAliases = [
  // The CLI's command table (src/phone/core.ts), aliased so the app's typecheck doesn't walk the core.
  { find: /^ore-commands$/, replacement: fileURLToPath(new URL("../../packages/cli/src/commands.ts", import.meta.url)) },
  { find: /^(node:)?fs$/, replacement: phone("fs.ts") },
  { find: /^(node:)?path$/, replacement: createRequire(import.meta.url).resolve("path-browserify") },
  { find: /^(node:)?os$/, replacement: phone("os.ts") },
  { find: /^(node:)?(util|child_process|crypto)$/, replacement: phone("node.ts") },
  { find: /^bun:sqlite$/, replacement: phone("sqlite.ts") },
  // The FSRS optimizer is a native module; `ore optimize` stays on the Mac.
  { find: /^@open-spaced-repetition\/binding$/, replacement: phone("node.ts") },
];

// The phone's library for the feel test: the text files of ORE_PHONE_LIBRARY (a copy of his library,
// or a demo one), served as /library.json. Binaries (PDFs, the index, git) stay behind; thumbnails go as data URLs.
const phoneLibrary: Plugin = {
  name: "phone-library",
  configureServer(server) {
    server.middlewares.use("/library.json", (_req, res) => res.end(JSON.stringify(snapshot())));
  },
  generateBundle() {
    this.emitFile({ type: "asset", fileName: "library.json", source: JSON.stringify(snapshot()) });
  },
};
function snapshot(): Record<string, string> {
  const root = process.env.ORE_PHONE_LIBRARY;
  if (!root) throw new Error("ORE_PHONE_LIBRARY: the library folder to put on the phone");
  const out: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
      const rel = dir ? `${dir}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (!e.name.startsWith(".")) walk(rel);
      } else if (/\.(md|ya?ml|jsonl?|excalidraw)$/.test(e.name)) out[rel] = readFileSync(join(root, rel), "utf8");
      // A source's picture (D77), small by design (480px): it goes along as a data URL so lists show it.
      else if (/^(thumbnail|course-cover)\.(jpe?g|png|webp|gif)$/.test(e.name))
        out[rel] = `data:image/${e.name.split(".")[1]!.replace("jpg", "jpeg")};base64,${readFileSync(join(root, rel)).toString("base64")}`;
    }
  };
  walk("");
  return out;
}

// Tauri expects a fixed dev port and no screen clearing (it prints its own logs).
// The icon picker's data ships with the app, so it works offline: Emojibase for emoji, MingCute's fill SVGs for icons,
// and Phosphor's for icons picked before MingCute (still drawn, no longer offered).
export default defineConfig({
  plugins: [
    react(),
    mingcuteList,
    ...(PHONE ? [phoneLibrary] : []),
    viteStaticCopy({
      targets: [
        { src: "node_modules/emojibase-data/en/{data,messages}.json", dest: "emojibase/en", rename: { stripBase: true } },
        { src: "node_modules/@phosphor-icons/core/assets/fill/*.svg", dest: "icons", rename: { stripBase: true } },
        { src: `${MINGCUTE}/*/*_fill.svg`, dest: "mingcute", rename: { stripBase: true } },
      ],
    }),
  ],
  clearScreen: false,
  // Imported only by the lazy diagram chunk: found late, Vite would re-bundle and reload the page the
  // first time a diagram opens in dev (it lost the reader in the e2e diagram journey on a fresh checkout).
  optimizeDeps: { include: ["react-dom/server"] },
  server: { port: 1420, strictPort: true, host: PHONE ? true : undefined, watch: { ignored: ["**/src-tauri/**"] } },
  build: { target: "safari17", outDir: PHONE ? "dist-phone" : "dist" },
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
