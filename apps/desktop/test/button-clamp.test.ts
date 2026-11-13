import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// WebKit (the iPhone's web view, and the Mac's) draws a <button> whole when the line clamp is on the button
// itself: Today's titles ran to seven lines (F99), and the mole's bubble had the same rule. The clamp goes on a
// span inside the button.
test("no line clamp sits on a class that a <button> carries", () => {
  const src = join(import.meta.dir, "..", "src");
  const css = readFileSync(join(src, "styles.css"), "utf8");
  const clamped = new Set<string>();
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/-webkit-line-clamp:\s*\d/.test(body!)) continue;
    for (const sel of selectors!.split(",")) {
      const last = sel.trim().split(/\s+/).pop()!;
      const cls = last.match(/^\.([\w-]+)(?::[\w-]+(?:\([^)]*\))?)*$/)?.[1];
      if (cls) clamped.add(cls);
    }
  }
  const files = readdirSync(src, { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith(".tsx"));
  const bad: string[] = [];
  for (const f of files) {
    for (const [, classes] of readFileSync(join(src, f), "utf8").matchAll(/<button[^>]*?className="([^"]+)"/g)) {
      for (const c of classes!.split(/\s+/)) if (clamped.has(c)) bad.push(`${f}: <button className="${classes}">`);
    }
  }
  expect(bad).toEqual([]);
});
