import { expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Tauri refuses to build with an icon that has no alpha channel ("icon … is not RGBA"): an RGB set stopped
// every iPhone build after the pickaxe icon (D221).
test("every Tauri icon PNG is RGBA", () => {
  for (const app of ["desktop", "phone"]) {
    const dir = join(import.meta.dir, "../..", app, "src-tauri/icons");
    for (const name of readdirSync(dir).filter((f) => f.endsWith(".png"))) {
      const png = readFileSync(join(dir, name));
      expect({ file: `${app}/${name}`, colorType: png[25] }).toEqual({ file: `${app}/${name}`, colorType: 6 });
    }
  }
});
