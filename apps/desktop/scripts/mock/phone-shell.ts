// Stand-in for the iPhone shell's library commands (apps/phone/src-tauri/src/lib.rs) when the phone build runs in a
// browser on a real folder: the phone then mounts that folder as it mounts Ore's iCloud Drive folder (fs.ts
// `mountDisk`), and a Mac page whose bridge has the same folder is the other device. Two apps, one library, as
// D222 has them; iCloud's own transport (its delay, `.icloud` placeholders) is not stood in for.
// PORT, ORE_PHONE_DISK=<folder>. POST /<command> with the command's args as JSON (library_write: the raw bytes,
// its place in x-path). `phoneShell(port)` is the page's side: an init script that routes the commands here.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

const PICTURE = /^(thumbnail|course-cover)\.(jpe?g|png|webp|gif)$/i;
const wanted = (name: string) => /\.(md|ya?ml|json|jsonl|excalidraw|vtt)$/i.test(name) || PICTURE.test(name);

function inside(root: string, rel: string): string {
  if (!rel || rel.split("/").some((c) => !c || c === "." || c === "..") || normalize(rel) !== rel) throw new Error(`not a library path: ${rel}`);
  return join(root, rel);
}
const stamp = (p: string): [number, string] => {
  const s = statSync(p);
  const ms = Math.floor(s.mtimeMs);
  return [ms, `${ms}:${s.size}`];
};
function walk(root: string, rel: string, out: { files: [string, number, string][]; waiting: string[]; other: string[] }) {
  for (const e of readdirSync(join(root, rel), { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) walk(root, r, out);
    else if (wanted(e.name)) out.files.push([r, ...stamp(join(root, r))]);
    else out.other.push(r);
  }
}
/** As lib.rs `land`: written beside, then moved in. */
function land(p: string, bytes: Uint8Array | string) {
  mkdirSync(dirname(p), { recursive: true });
  const tmp = join(dirname(p), `.ore-shell-${process.pid}`);
  writeFileSync(tmp, bytes);
  renameSync(tmp, p);
}

export function command(root: string, cmd: string, args: any, body?: Uint8Array, path?: string): unknown {
  switch (cmd) {
    case "library_dir":
      return root;
    case "library_scan": {
      const out = { files: [] as [string, number, string][], waiting: [] as string[], other: [] as string[] };
      walk(root, "", out);
      return out;
    }
    case "library_read":
      return (args.paths as string[]).map((rel) => {
        try {
          const p = inside(root, rel), m = PICTURE.exec(rel.split("/").pop()!);
          return m ? `data:image/${m[2]!.toLowerCase().replace("jpg", "jpeg")};base64,${readFileSync(p).toString("base64")}` : readFileSync(p, "utf8");
        } catch {
          return null;
        }
      });
    case "library_write": {
      const p = inside(root, path!);
      land(p, body!);
      return [path, ...stamp(p)];
    }
    case "library_apply": {
      const stamps: [string, number, string][] = [];
      for (const [rel, text, b64] of args.ops as [string, string | null, boolean][]) {
        const p = inside(root, rel);
        if (text !== null) {
          land(p, b64 ? Buffer.from(text, "base64") : text);
          stamps.push([rel, ...stamp(p)]);
        } else {
          rmSync(p, { recursive: true, force: true });
          for (let d = dirname(p); d !== root && d.startsWith(root); d = dirname(d)) {
            try {
              rmdirSync(d);
            } catch {
              break;
            }
          }
        }
      }
      return stamps;
    }
    case "library_bytes":
      try {
        return readFileSync(inside(root, args.path)).toString("base64");
      } catch {
        return null;
      }
    default:
      return null;
  }
}

/** The phone page's shell: Tauri's internals, with the library commands sent to this stand-in and the rest answered
 *  as a shell with nothing to give would (null). Run before the page's own scripts (`page.addInitScript`). */
export const phoneShell = (port: number) => `
  window.isTauri = true;
  // The page's own fetch, kept: on a shell the phone sends other fetches through http_fetch.
  const send = window.fetch.bind(window);
  window.__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: "main" }, currentWebview: { windowLabel: "main", label: "main" } },
    convertFileSrc: (p) => "http://localhost:${port}/file?p=" + encodeURIComponent(p),
    transformCallback: () => 0,
    unregisterCallback: () => {},
    async invoke(cmd, args, options) {
      if (!cmd.startsWith("library_")) return null;
      const raw = args instanceof Uint8Array;
      const r = await send("http://localhost:${port}/" + cmd, { method: "POST", body: raw ? args : JSON.stringify(args ?? {}), headers: raw ? { "x-path": options.headers["x-path"] } : {} });
      const j = await r.json();
      if (!r.ok) throw j;
      return j;
    },
  };`;

/** Serves the commands for the folder `root()` names now (a journey's library changes from file to file); port 0 picks one. */
export function serveShell(root: () => string, port = 0) {
  const H = { "access-control-allow-origin": "*", "access-control-allow-headers": "*" };
  return Bun.serve({
    port,
    idleTimeout: 0,
    async fetch(req) {
      if (req.method === "OPTIONS") return new Response(null, { headers: H });
      const url = new URL(req.url), cmd = url.pathname.slice(1), lib = root();
      try {
        if (cmd === "file") return new Response(Bun.file(inside(lib, (url.searchParams.get("p") ?? "").replace(lib + "/", ""))), { headers: H });
        const raw = cmd === "library_write";
        const body = raw ? new Uint8Array(await req.arrayBuffer()) : undefined;
        const path = raw ? decodeURIComponent(req.headers.get("x-path") ?? "") : undefined;
        return Response.json(command(lib, cmd, raw ? {} : await req.json(), body, path), { headers: H });
      } catch (e) {
        return Response.json(String((e as Error).message), { status: 500, headers: H });
      }
    },
  });
}

if (import.meta.main) {
  const root = process.env.ORE_PHONE_DISK;
  if (!root || !existsSync(root)) throw new Error("ORE_PHONE_DISK: the library folder the phone mounts");
  serveShell(() => root, Number(process.env.PORT ?? 1431));
}
