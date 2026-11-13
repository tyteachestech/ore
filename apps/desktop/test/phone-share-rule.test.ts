// The share extension's activation rule (apps/phone/scripts/share-target.ts) decides whether Ore
// shows in iOS's share sheet at all. The SupportsWebURL/File/Image keys missed a PDF shared from
// Safari's viewer, so Ore was absent there; the rule is a predicate over any link, text or file.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(import.meta.dir, "../../phone/scripts/share-target.ts"), "utf8");
const rule = src.match(/NSExtensionActivationRule: '([^']+)'/)?.[1];

test("the share extension activates for any link, text or file, a PDF from Safari included", () => {
  expect(rule).toBeDefined();
  expect(rule).toStartWith("SUBQUERY(extensionItems");
  for (const uti of ["public.url", "public.plain-text", "public.data"]) expect(rule).toContain(`UTI-CONFORMS-TO "${uti}"`);
  expect(src).not.toContain("NSExtensionActivationSupports");
});
