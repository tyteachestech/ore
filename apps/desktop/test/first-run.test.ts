import { expect, test } from "bun:test";
import { firstRun } from "../src/ore";

test("first launch with no library makes one once, then every waiting call goes through", async () => {
  let made = 0;
  const init = async () => { made++; };
  const call = async () => { if (!made) throw new Error("no library at /Users/friend/Ore (run `ore init`, or set ORE_LIBRARY)"); return "ok"; };
  const seen = { opened: false };
  expect(await Promise.all([firstRun(call, init, seen), firstRun(call, init, seen)])).toEqual(["ok", "ok"]);
  expect(made).toBe(1);
});

test("any other error is his to see, and nothing is created", async () => {
  let made = 0;
  await expect(firstRun(async () => { throw new Error("That PDF is locked with a password."); }, async () => { made++; })).rejects.toThrow("locked");
  expect(made).toBe(0);
});

test("a library that was open and is then moved away is named as moved, never replaced by a new empty one (Codex sweep 4)", async () => {
  let made = 0;
  let there = true;
  const call = async () => { if (!there) throw new Error("no library at /Users/friend/Ore (run `ore init`, or set ORE_LIBRARY)"); return "ok"; };
  const seen = { opened: false };
  expect(await firstRun(call, async () => { made++; }, seen)).toBe("ok");
  there = false;
  await expect(firstRun(call, async () => { made++; }, seen)).rejects.toThrow("Your library is no longer at /Users/friend/Ore: it was moved");
  expect(made).toBe(0);
});
