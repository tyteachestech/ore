import { expect, test } from "bun:test";
import { resolve } from "node:path";

test("existing webviews and their shortcut labels follow settings changes, resets and focus", () => {
  const run = Bun.spawnSync([process.execPath, resolve(import.meta.dir, "fixtures/keymap-windows.tsx")], { timeout: 10_000 });
  if (run.exitCode) console.error(run.stderr.toString());
  expect(run.exitCode).toBe(0);
  expect(run.stdout.toString()).toContain("PASS: existing windows");
});
