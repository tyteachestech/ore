import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { tempLibrary } from "./helpers.ts";

const cli = join(import.meta.dir, "../../cli/src/ore.ts");
const docs = (root: string): string[] => readdirSync(join(root, "items"), { recursive: true }).map(String).filter((f) => f.endsWith("doc.md"));

// The app's Cancel on an add stops `ore add` with SIGTERM: what it wrote so far goes, nothing half-added stays.
describe("cancelling an add", () => {
  test("SIGTERM after the source is written takes it back out", async () => {
    const lib = await tempLibrary();
    let reached!: () => void;
    const thumbnail = new Promise<void>((r) => (reached = r));
    const words = Array.from({ length: 300 }, (_, i) => `word${i}`).join(" ");
    const server = Bun.serve({
      port: 0,
      fetch(req) {
        const { pathname } = new URL(req.url);
        // The thumbnail is fetched after doc.md is written: hold it there, as a slow step would.
        if (pathname === "/cover.jpg") return (reached(), new Promise<Response>(() => {}));
        return new Response(`<html><head><title>Slow page</title><meta property="og:image" content="/cover.jpg"></head><body><article><h1>Slow page</h1><p>${words}</p></article></body></html>`, { headers: { "content-type": "text/html" } });
      },
    });
    try {
      const p = Bun.spawn(["bun", cli, "add", `http://localhost:${server.port}/post`, "--json"], { env: { ...process.env, ORE_LIBRARY: lib.root, ORE_NO_ENRICH: "1" }, stdout: "pipe", stderr: "pipe" });
      await thumbnail;
      expect(docs(lib.root)).toHaveLength(1);
      p.kill("SIGTERM");
      expect(await p.exited).not.toBe(0);
      expect(docs(lib.root)).toEqual([]);
      expect(readdirSync(join(lib.root, "items"), { recursive: true }).map(String).filter((f) => f.includes("slow-page"))).toEqual([]);
    } finally {
      server.stop(true);
    }
  });
});
