// A download is read the same in every web view the phone runs in. iOS 26's WebKit can't iterate a
// response body with `for await`, so every import of a file or page failed there with "undefined is not a
// function"; the reader must work on a body with no async iterator.
import { expect, test } from "bun:test";
import { readCapped } from "../src/ingest/index.ts";

test("a response body is read whole where the stream can't be iterated with for await", async () => {
  const res = new Response("hello, world");
  Object.defineProperty(res.body!, Symbol.asyncIterator, { value: undefined });
  expect(new TextDecoder().decode(await readCapped(res))).toBe("hello, world");
});
