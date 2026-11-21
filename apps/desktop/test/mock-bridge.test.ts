import { expect, test } from "bun:test";

// F452: Bun.serve hangs up on a connection idle for 10 s by default. The e2e runner keeps its
// connections to the bridge for reuse, so a call sent as one was being closed failed with ECONNRESET.
test("the mock bridge never hangs up on a quiet connection", async () => {
  const src = await Bun.file(`${import.meta.dir}/../scripts/mock/bridge.ts`).text();
  expect(/Bun\.serve\(\{[^]*?idleTimeout: 0,/.test(src)).toBe(true);
});
