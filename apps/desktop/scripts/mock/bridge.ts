// Stand-in for the Tauri `ore` command when the UI runs in a plain browser (screenshots, Playwright).
// POST /ore {args, stdin, job} -> runs the real ore CLI against $ORE_LIBRARY, returns its JSON (or 500 with the error line).
// POST /cancel {job} stops that run with SIGTERM, as the app's ore_cancel does.
const CLI = `${import.meta.dir}/../../../../packages/cli/src/ore.ts`;
const jobs = new Map<string, ReturnType<typeof Bun.spawn>>();
Bun.serve({
  port: Number(process.env.PORT ?? 1421),
  async fetch(req) {
    const h = { "access-control-allow-origin": "*", "access-control-allow-headers": "*" };
    if (req.method === "OPTIONS") return new Response(null, { headers: h });
    // convertFileSrc in tauri.js: files inside the library (thumbnails, note images), as the asset protocol serves them.
    const url = new URL(req.url);
    if (url.pathname === "/file") {
      const path = url.searchParams.get("p") ?? "";
      const lib = process.env.ORE_LIBRARY ?? "";
      return lib && path.startsWith(lib + "/") && !path.includes("..") ? new Response(Bun.file(path), { headers: h }) : new Response(null, { status: 404 });
    }
    if (url.pathname === "/cancel") {
      const { job } = await req.json();
      jobs.get(job)?.kill("SIGTERM");
      return new Response("null", { headers: h });
    }
    const { args, stdin, job } = await req.json();
    // `recall --text` only stores what he wrote; `recall --feedback` is the AI call.
    const ai = ["enrich", "ask", "ask-library", "tutor", "grade", "key-points", "check", "research", "explain"].includes(args[0]) || (args[0] === "recall" && args.includes("--feedback"));
    if (ai) {
      // ORE_MOCK_AI=<dir>: <dir>/<command>.json answers that AI command (after a moment, as the AI would).
      const canned = process.env.ORE_MOCK_AI && Bun.file(`${process.env.ORE_MOCK_AI}/${args[0]}.json`);
      if (canned && (await canned.exists())) return new Promise((ok) => setTimeout(async () => ok(new Response(await canned.text(), { headers: h })), Number(process.env.ORE_MOCK_DELAY ?? 600)));
      return new Response(JSON.stringify(null), { headers: h });
    }
    // No background enrichment unless ORE_MOCK_ENRICH=1: `ore add` would start the real claude or codex CLI and spend real usage.
    const env = { ...process.env, ORE_NO_ENRICH: process.env.ORE_MOCK_ENRICH ? "" : "1" };
    const p = Bun.spawn(["bun", CLI, ...args, "--json"], { env, stdin: stdin == null ? "ignore" : new TextEncoder().encode(stdin), stdout: "pipe", stderr: "pipe" });
    if (job) jobs.set(job, p);
    const [out, err, code] = [await new Response(p.stdout).text(), await new Response(p.stderr).text(), await p.exited];
    if (job) jobs.delete(job);
    // As the app's one_line_error (src-tauri/src/main.rs): the "ore: …" line without its prefix, so code that reads an
    // error's start (firstRun's "no library at") runs here as it does on the Mac.
    const lines = err.split("\n").map((l) => l.trim()).filter(Boolean);
    const line = lines.find((l) => l.startsWith("ore:"))?.slice(4).trim() ?? lines.pop();
    if (code !== 0) return new Response(JSON.stringify(line || "ore failed"), { status: 500, headers: h });
    return new Response(out.trim() || "null", { headers: h });
  },
});
console.log(`ore bridge on ${process.env.PORT ?? 1421}, library ${process.env.ORE_LIBRARY}`);
