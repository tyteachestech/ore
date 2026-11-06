import { describe, expect, test } from "bun:test";
import { inOrder } from "../src/util";

// A source's quick edits (add an author, ⌘Z, ⇧⌘Z) each start their own `ore` process; they must
// land in the order he made them, or the file keeps the undone value.
describe("inOrder", () => {
  const slow = (ms: number, log: string[], name: string) => () => new Promise<string>((ok) => setTimeout(() => (log.push(name), ok(name)), ms));

  test("writes to one source land in the order they were made, even when the first is slowest", async () => {
    const log: string[] = [];
    await Promise.all([inOrder("s1", slow(40, log, "add")), inOrder("s1", slow(0, log, "undo")), inOrder("s1", slow(10, log, "redo"))]);
    expect(log).toEqual(["add", "undo", "redo"]);
  });

  test("a failed write doesn't stop the next one, and other sources don't wait", async () => {
    const log: string[] = [];
    const bad = inOrder("s2", () => Promise.reject(new Error("offline")));
    const next = inOrder("s2", slow(0, log, "next"));
    const other = inOrder("s3", slow(0, log, "other"));
    await expect(bad).rejects.toThrow("offline");
    expect(await next).toBe("next");
    await other;
    expect(log).toEqual(["other", "next"]);
  });
});
