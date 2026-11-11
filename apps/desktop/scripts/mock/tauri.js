// Stands in for Tauri in a plain browser: ore calls go to the bridge, everything else is a no-op.
// `window.__ORE_LABEL = "quiz"` in an earlier init script renders the quick quiz window;
// `window.__emit("quiz-open")` fires an event at its listeners.
let cb = 0;
const callbacks = new Map();
const listeners = [];
const label = window.__ORE_LABEL || "main";
window.__emit = (event, payload = null) => listeners.filter((l) => l.event === event).forEach((l) => callbacks.get(l.handler)?.({ event, payload, id: 0 }));
// The clipboard: `await window.__copy(text)` copies in another app (the window blurs, the clipboard
// changes, the window gains focus again), so the add box offers it.
const clip = { count: 0, text: null };
window.__copy = async (text) => {
  window.__emit("tauri://blur");
  await new Promise((r) => setTimeout(r, 50));
  clip.count++;
  clip.text = text;
  window.__emit("tauri://focus");
  await new Promise((r) => setTimeout(r, 50));
};
async function ore(args) {
  // window.__ORE_FAIL = { enrich: "why" }: that command fails with that reason (a test of the failure path).
  const fail = window.__ORE_FAIL && window.__ORE_FAIL[args.args[0]];
  if (fail) throw fail;
  // window.__ORE_HOLD = { "skills arrange": [800] }: the next such command waits that long before it runs at all
  // (one entry per call), so a later one (an Undo) can run first, as two `ore` processes can on a slow machine.
  // A key of the command alone ({ annotate: [1500] }) holds the next one whatever it names.
  const hold = window.__ORE_HOLD && (window.__ORE_HOLD[args.args.slice(0, 2).join(" ")] ?? window.__ORE_HOLD[args.args[0]]);
  if (hold && hold.length) await new Promise((ok) => setTimeout(ok, hold.shift()));
  const port = window.__ORE_BRIDGE || 1421;
  // As the real app reports a missing `ore`: say what is down and how to start it, not "Failed to fetch".
  const r = await fetch("http://localhost:" + port + "/ore", { method: "POST", body: JSON.stringify({ args: args.args, stdin: args.stdin ?? null, job: args.job ?? null }) }).catch(() => {
    throw `The mock bridge isn’t answering on port ${port}. Start it: PORT=${port} bun scripts/mock/bridge.ts`;
  });
  const j = await r.json();
  // window.__ORE_SLOW = { ls: 800 }: that command's answer comes back that much later (a race test).
  const slow = window.__ORE_SLOW && window.__ORE_SLOW[args.args[0]];
  if (slow) await new Promise((ok) => setTimeout(ok, slow));
  if (!r.ok) throw j;
  return j;
}
window.__TAURI_INTERNALS__ = {
  metadata: { currentWindow: { label }, currentWebview: { windowLabel: label, label } },
  transformCallback: (f) => (callbacks.set(++cb, f), cb),
  unregisterCallback: () => {},
  convertFileSrc: (p) => "http://localhost:" + (window.__ORE_BRIDGE || 1421) + "/file?p=" + encodeURIComponent(p),
  async invoke(cmd, args) {
    if (cmd === "ore") {
      // window.__ORE_PENDING: how many `ore` calls have not answered yet, so a test can wait for a page to finish loading.
      window.__ORE_PENDING = (window.__ORE_PENDING ?? 0) + 1;
      try {
        return await ore(args);
      } finally {
        window.__ORE_PENDING--;
      }
    }
    if (cmd === "ore_cancel") return void (await fetch("http://localhost:" + (window.__ORE_BRIDGE || 1421) + "/cancel", { method: "POST", body: JSON.stringify({ job: args.job }) }).catch(() => {}));
    // `window.__ORE_PLAYER_PORT` (an earlier init script) points the player at fake-player.ts.
    if (cmd === "player_port") return window.__ORE_PLAYER_PORT ?? null;
    // Look Up: the macOS dictionary's one-line entry, as Dictionary Services returns it; set
    // `window.__ORE_DEFINE = null` in an earlier init script to see a word with no entry.
    if (cmd === "define") return "__ORE_DEFINE" in window ? window.__ORE_DEFINE : `${args.word} | ˈsamp(ə)l | noun a small part or quantity intended to show what the whole is like: investigations involved analysing samples of handwriting. • a specimen taken for scientific testing. verb take a sample of. DERIVATIVES sampler noun. ORIGIN Middle English: from an Anglo-Norman French variant of Old French essample ‘example’.`;
    if (cmd === "clipboard_count") return clip.count;
    if (cmd === "clipboard_text") return clip.text;
    // Files copied in Finder: set `window.__ORE_FILES = ["/path/a.pdf"]` before a paste that carries files.
    if (cmd === "clipboard_files") return window.__ORE_FILES ?? [];
    // The Open panel: set `window.__ORE_PICK = ["/path/a.pdf"]` for the files he picks; unset, he cancels.
    if (cmd === "plugin:dialog|open") return window.__ORE_PICK ?? null;
    // Reveal in Finder: the paths land in `window.__ORE_REVEALED`.
    if (cmd === "plugin:opener|reveal_item_in_dir") return void (window.__ORE_REVEALED = args.paths);
    if (cmd === "plugin:event|listen") return listeners.push({ event: args.event, handler: args.handler });
    return null;
  },
};
window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
