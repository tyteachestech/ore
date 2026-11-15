import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// A drag that listens on the window by hand misses the pointer-up when the button is let go outside the window
// (no pointer capture) and has no pointercancel: the drag stays live and his next click drops what he was
// dragging. drag.ts `resizeDrag` handles both, so every window-wide drag goes through it.
test("no drag listens for the window's pointer-up except drag.ts", () => {
  const src = join(import.meta.dir, "../src");
  const files = readdirSync(src, { recursive: true }).map(String).filter((f) => /\.tsx?$/.test(f) && f !== "drag.ts");
  const by = files.filter((f) => /window\.addEventListener\("pointerup"/.test(readFileSync(join(src, f), "utf8")));
  expect(by).toEqual([]);
});
