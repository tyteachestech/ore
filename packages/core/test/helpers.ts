import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initLibrary } from "../src/init.ts";
import type { Library } from "../src/library.ts";

export async function tempLibrary(): Promise<Library> {
  const root = mkdtempSync(join(tmpdir(), "ore-test-"));
  await initLibrary(root);
  return { root };
}
