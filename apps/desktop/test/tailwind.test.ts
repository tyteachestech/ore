// Tailwind's utilities sit beside Ore's own CSS (D-style loop, #114). A bare utility named like one of Ore's classes
// (`ring`, `outline`, `grow`, `filter`…) silently restyles it: #114 framed Home's goal ring and the reader's outline
// in a 1px white box. Every class name in src must generate no Tailwind CSS unless it opts in with the `tw:` prefix.
import { expect, test } from "bun:test";
import { compile } from "tailwindcss";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

const src = join(import.meta.dir, "../src");
const twDir = dirname(require.resolve("tailwindcss/package.json", { paths: [src] }));

test("no class in src is turned into a Tailwind utility by accident", async () => {
  const words = new Set<string>();
  for (const f of readdirSync(src, { recursive: true }) as string[]) {
    if (!/\.(tsx?|css)$/.test(f)) continue;
    for (const m of readFileSync(join(src, f), "utf8").matchAll(/[\w:-]+/g)) if (!m[0].startsWith("tw:")) words.add(m[0]);
  }
  const compiler = await compile(readFileSync(join(src, "tailwind.css"), "utf8"), {
    base: src,
    loadStylesheet: async (id: string) => {
      const path = join(twDir, id.replace(/^tailwindcss\//, ""));
      return { path, base: dirname(path), content: readFileSync(path, "utf8") };
    },
  });
  const css = compiler.build([...words]);
  const made = [...css.matchAll(/^\s*\.([\w\\:-]+)\s*\{/gm)].map((m) => m[1]);
  expect(made).toEqual([]);
});
