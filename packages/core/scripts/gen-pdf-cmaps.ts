import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
const dir = join(dirname(require.resolve("pdfjs-dist/package.json")), "cmaps");
const names = readdirSync(dir).filter((f) => f.endsWith(".bcmap")).sort();
const lines = [
  "// The CMaps pdf.js reads a PDF's CJK text with, when a font names its encoding instead of carrying it",
  "// (many Korean, Japanese and Chinese PDFs): carried in the compiled `ore`, so they work in the app too.",
  "// Written by scripts/gen-pdf-cmaps.ts from pdfjs-dist/cmaps; test/pdf-cmaps.test.ts keeps the list whole.",
  ...names.map((n, i) => `import c${i} from "pdfjs-dist/cmaps/${n}" with { type: "file" };`),
  "",
  "export const CMAPS: Record<string, string> = {",
  ...names.map((n, i) => `  "${n.slice(0, -6)}": c${i},`),
  "};",
  "",
];
await Bun.write(join(import.meta.dir, "../src/ingest/pdf-cmaps.ts"), lines.join("\n"));
