// The launchd job that keeps the Mac and iPhone at master (apps/desktop/scripts/auto-update.ts).
import { expect, test } from "bun:test";
import { phoneNeeds } from "../scripts/auto-update";

test("rebuilds the phone only when a pull touched what the phone app is built from", () => {
  expect(phoneNeeds(["apps/desktop/src/phone/Home.tsx"])).toBe(true);
  expect(phoneNeeds(["packages/core/src/queue.ts"])).toBe(true);
  expect(phoneNeeds(["apps/phone/src-tauri/tauri.conf.json"])).toBe(true);
  expect(phoneNeeds(["bun.lock"])).toBe(true);
  expect(phoneNeeds(["docs/WORKFLOW.md", "skills/ore/SKILL.md"])).toBe(false);
  expect(phoneNeeds([""])).toBe(false);
});
