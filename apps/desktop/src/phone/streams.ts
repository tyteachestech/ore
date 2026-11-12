// iOS 26's web view can't iterate a stream with `for await`; iOS 27's can. pdf.js reads a PDF's text that
// way (getTextContent), so every PDF import failed on iOS 26 with "undefined is not a function". This gives
// streams the iterator the platform leaves out, and leaves one that has it alone.
export function iterableStreams(proto: { [Symbol.asyncIterator]?: unknown; getReader(): ReadableStreamDefaultReader } = ReadableStream.prototype as never) {
  if (typeof proto[Symbol.asyncIterator] === "function") return;
  Object.defineProperty(proto, Symbol.asyncIterator, {
    configurable: true,
    writable: true,
    value: async function* (this: ReadableStream) {
      const reader = this.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) return;
          yield value;
        }
      } finally {
        reader.releaseLock();
      }
    },
  });
}
