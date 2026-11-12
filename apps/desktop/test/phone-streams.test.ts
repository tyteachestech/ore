// A stream is read with `for await` on the phone even where the web view leaves the iterator out (iOS 26):
// pdf.js reads a PDF's text that way.
import { expect, test } from "bun:test";
import { iterableStreams } from "../src/phone/streams";

test("a stream with no async iterator gets one, and reads every chunk in order", async () => {
  class Bare {
    constructor(private chunks: string[]) {}
    getReader() {
      const chunks = [...this.chunks];
      return { read: async () => (chunks.length ? { done: false, value: chunks.shift() } : { done: true, value: undefined }), releaseLock() {} } as never;
    }
  }
  const proto = Bare.prototype as never as { [Symbol.asyncIterator]?: unknown; getReader(): ReadableStreamDefaultReader };
  iterableStreams(proto);
  const got: string[] = [];
  for await (const c of new Bare(["a", "b", "c"]) as unknown as AsyncIterable<string>) got.push(c);
  expect(got).toEqual(["a", "b", "c"]);
});

test("a platform iterator is left as it is", () => {
  const own = async function* () {};
  const proto = { [Symbol.asyncIterator]: own, getReader: () => ({}) as never };
  iterableStreams(proto);
  expect(proto[Symbol.asyncIterator]).toBe(own);
});
