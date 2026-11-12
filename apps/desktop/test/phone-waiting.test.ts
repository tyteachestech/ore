import { expect, test } from "bun:test";
import { FROM_TAB, refusal } from "../../../packages/core/src/ingest/check";
import { MAC_WAY, phoneReason } from "../src/phone/AddLink";

// A link the phone couldn't read says why, then that the Mac tries it: never the Mac's own next steps
// (its Browser tab, `ore add --tab`, "paste its text here"), which the phone doesn't have.
test("phone: a refused link's reason leaves out the Mac's next steps", () => {
  expect(FROM_TAB.startsWith(MAC_WAY)).toBe(true);
  const cases: [string, string][] = [
    [`example.com wouldn’t let Ore in (HTTP 403); it may need a sign-in. Open it in your browser and ${FROM_TAB}, or paste its text here instead.`, "example.com wouldn’t let Ore in (HTTP 403); it may need a sign-in."],
    [`example.com is getting too many requests right now (HTTP 429). Try again in a few minutes, or open it in your browser and ${FROM_TAB}.`, "example.com is getting too many requests right now (HTTP 429). Try again in a few minutes."],
    [`X only shows posts to signed-in browsers. Open the post in Safari or Chrome and ${FROM_TAB}, or copy it and paste it here instead.`, "X only shows posts to signed-in browsers."],
    [`That Google Doc isn’t shared publicly, so Ore can’t download it. In Google, choose Share › Anyone with the link, then add it again; or open it in your browser and ${FROM_TAB}.`, "That Google Doc isn’t shared publicly, so Ore can’t download it. In Google, choose Share › Anyone with the link, then add it again."],
    [`Open it in your browser and ${FROM_TAB}.`, "Ore couldn’t read this page here."],
    ["The link didn’t answer.", "The link didn’t answer."],
  ];
  for (const [error, shown] of cases) expect(phoneReason(error)).toBe(shown);
  for (const r of [refusal("Just a moment...", "Checking your browser", "example.com"), refusal("Article", "Sign in to read", "example.com")]) {
    if (r) expect(phoneReason(r)).not.toMatch(/Browser tab|ore add|paste its text/);
  }
});
