import { expect, test } from "bun:test";
import { firstRun } from "../src/ore";

test("first launch with no library makes one once, then every waiting call goes through", async () => {
  let made = 0;
  const init = async () => { made++; };
  const call = async () => { if (!made) throw new Error("no library at /Users/friend/Ore (run `ore init`, or set ORE_LIBRARY)"); return "ok"; };
  expect(await Promise.all([firstRun(call, init), firstRun(call, init)])).toEqual(["ok", "ok"]);
  expect(made).toBe(1);
});

test("any other error is his to see, and nothing is created", async () => {
  let made = 0;
  await expect(firstRun(async () => { throw new Error("That PDF is locked with a password."); }, async () => { made++; })).rejects.toThrow("locked");
  expect(made).toBe(0);
});
