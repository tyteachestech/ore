// The iPhone build swaps the Node modules the core imports for stand-ins (src/phone, vite.config.ts). A core import the
// stand-in lacks fails the whole phone app at load ("does not provide an export named …"), so every
// named import from those modules in the core must exist in its stand-in.
import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as fs from "../src/phone/fs";
import * as node from "../src/phone/node";
import * as os from "../src/phone/os";

const core = join(import.meta.dir, "../../../packages/core/src");
const files = (readdirSync(core, { recursive: true }) as string[]).filter((f) => f.endsWith(".ts"));

for (const [mod, shim] of [["fs", fs], ["os", os], ["util", node], ["child_process", node], ["crypto", node]] as const) {
  test(`phone ${mod} stand-in has every function the core imports`, () => {
    const used = new Set<string>();
    const re = new RegExp(`import\\s*(?:type\\s*)?\\{([^}]*)\\}\\s*from\\s*["'](?:node:)?${mod}["']`, "g");
    for (const f of files)
      for (const m of readFileSync(join(core, f), "utf8").matchAll(re))
        for (const name of m[1]!.split(",")) {
          const n = name.trim().split(/\s+as\s+/)[0]!;
          if (n && !n.startsWith("type ") && /^[a-z]/.test(n)) used.add(n);
        }
    expect([...used].filter((n) => !(n in shim))).toEqual([]);
  });
}

test("every Node module the core imports has a phone stand-in", () => {
  const vite = readFileSync(join(import.meta.dir, "../vite.config.ts"), "utf8");
  const mods = new Set(files.flatMap((f) => [...readFileSync(join(core, f), "utf8").matchAll(/from\s*["']node:([a-z_]+)["']/g)].map((m) => m[1]!)));
  expect([...mods].filter((m) => !new RegExp(`[(|?]${m}[|)$]`).test(vite))).toEqual([]);
});
