import { guarded } from "./guard.ts";
import { importJob, type ImportReply } from "./import.ts";

/** Ore Cloud's server (D355, #545). For now one route, POST /import, and no accounts (#551 adds them):
 *  run it on your own machine only. A link comes as JSON `{ "url": … }`; a file as the request body with
 *  its name in `?name=`, or, with the files it links to, as JSON `{ name, bytes, beside: { name: bytes } }`
 *  in base64. The reply is JSON: `{ id, files: { path: base64 } }`, or `{ refused }` with the next step. */

/** A source bigger than this is refused before it is read: the Mac's own import has no such limit, but a
 *  server must not let one upload fill its disk. Revisit with the phone's real largest PDFs. */
export const MAX_UPLOAD = 200 * 1024 * 1024;

const json = (body: unknown, status = 200) => Response.json(body, { status });

const encode = (r: ImportReply) =>
  "refused" in r ? r : { id: r.id, files: Object.fromEntries(Object.entries(r.files).map(([p, b]) => [p, Buffer.from(b).toString("base64")])) };

export async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  if (url.pathname !== "/import") return json({ error: "not found" }, 404);
  if (req.method !== "POST") return json({ error: "use POST" }, 405);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_UPLOAD) return json({ refused: "This file is too big for Ore's server. Add it on your Mac." }, 413);
  const type = (req.headers.get("content-type") ?? "").toLowerCase();
  if (type.startsWith("application/json")) {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: "the body isn't JSON" }, 400);
    }
    const b = (body ?? {}) as { url?: unknown; name?: unknown; bytes?: unknown; beside?: unknown };
    if (typeof b.name === "string" && typeof b.bytes === "string") {
      const beside = b.beside && typeof b.beside === "object" ? (b.beside as Record<string, unknown>) : {};
      if (Object.values(beside).some((v) => typeof v !== "string")) return json({ error: "beside holds base64 files by name" }, 400);
      const bytes = (v: string) => new Uint8Array(Buffer.from(v, "base64"));
      return json(encode(await importJob({ name: b.name, bytes: bytes(b.bytes), beside: Object.fromEntries(Object.entries(beside).map(([n, v]) => [n, bytes(v as string)])) })));
    }
    const link = b.url;
    if (typeof link !== "string" || !/^https?:\/\//i.test(link)) return json({ error: "give a link starting with http:// or https://" }, 400);
    return json(encode(await importJob({ url: link })));
  }
  const name = url.searchParams.get("name");
  if (!name) return json({ error: "a file needs its name in ?name=" }, 400);
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength > MAX_UPLOAD) return json({ refused: "This file is too big for Ore's server. Add it on your Mac." }, 413);
  return json(encode(await importJob({ name, bytes })));
}

if (import.meta.main) {
  // Every link the import opens, its images and redirects too, must be on the public web.
  globalThis.fetch = guarded(globalThis.fetch);
  const server = Bun.serve({ port: Number(process.env.PORT ?? 8787), hostname: process.env.HOST ?? "127.0.0.1", fetch: handle, maxRequestBodySize: MAX_UPLOAD + 1 });
  console.log(`Ore Cloud listening on http://${server.hostname}:${server.port}`);
}
