import { expect, test } from "bun:test";
import { refusal } from "../../../packages/core/src/ingest/check";
import { phoneReason } from "../src/phone/AddLink";

// A link the phone couldn't read says why, then that the Mac tries it: never the Mac's own next steps
// (its Browser tab, `ore add --tab`, "paste its text here"), which the phone doesn't have.
test("phone: a refused link's reason leaves out the Mac's next steps", () => {
  const reasons = [
    "example.com wouldn’t let Ore in (HTTP 403); it may need a sign-in. Open it in your browser and add it from the browser (Browser tab in the add box, or `ore add --tab`), or paste its text here instead.",
    "Couldn’t find article text on example.com: it may be built in the browser or need a sign-in. Open it in your browser and add it from the browser (Browser tab in the add box, or `ore add --tab`), or paste its text here instead.",
  ];
  for (const r of [...reasons, refusal("Just a moment...", "Checking your browser", "example.com")!, refusal("Article", "Sign in to read", "example.com")!].filter(Boolean)) {
    const shown = phoneReason(r);
    expect(shown).not.toMatch(/Browser tab|ore add|paste its text/);
    expect(shown.endsWith(".")).toBe(true);
    expect(shown.length).toBeGreaterThan(20);
  }
  expect(phoneReason("The link didn’t answer.")).toBe("The link didn’t answer.");
});
