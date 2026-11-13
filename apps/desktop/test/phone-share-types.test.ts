import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The share sheet only lists Ore for what this rule matches, and iOS gives no error when it doesn't: a PDF
// opened in a preview is handed over as its data (com.adobe.pdf), with no file URL, and Ore was missing.
const script = readFileSync(join(import.meta.dir, "../../phone/scripts/share-target.ts"), "utf8");

test("the share sheet lists Ore for any link or file, not only a file with its own URL", () => {
  const rule = /const RULE =\s*'([^']+)'/.exec(script)?.[1] ?? "";
  expect(rule).toContain('UTI-CONFORMS-TO "public.url"');
  expect(rule).toContain('UTI-CONFORMS-TO "public.data"'); // every file type: PDF, EPUB, audio, pictures, text
  expect(script).not.toMatch(/^\s+NSExtensionActivationSupports\w+:/m); // the count keys, which missed bare data
});

test("a project made with the old rule gets the new one in place", () => {
  const old = new RegExp(/const OLD_RULE = \/(.+)\/;/.exec(script)![1]);
  const yml = "            NSExtensionActivationRule:\n              NSExtensionActivationSupportsWebURLWithMaxCount: 1\n              NSExtensionActivationSupportsText: true\n    entitlements:\n";
  expect(yml.replace(old, "NSExtensionActivationRule: 'X'\n")).toBe("            NSExtensionActivationRule: 'X'\n    entitlements:\n");
});
