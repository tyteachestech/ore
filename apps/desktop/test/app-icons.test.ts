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

// The Xcode project (gen/apple) is not in git and each worktree makes its own with Tauri's stock icons, so a
// phone build from a fresh worktree shipped the old icon. The set is in git and every build copies it in.
test("the iPhone's icon set is in git and every phone build copies it into the Xcode project", () => {
  const phone = join(import.meta.dir, "../../phone/src-tauri");
  const names = readdirSync(join(phone, "icons/ios")).filter((f) => f.endsWith(".png"));
  expect(names).toHaveLength(18);
  expect(names).toContain("AppIcon-512@2x.png");
  const conf = JSON.parse(readFileSync(join(phone, "tauri.conf.json"), "utf8"));
  expect(conf.build.beforeBuildCommand).toContain("cp src-tauri/icons/ios/*.png src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset/");
});
