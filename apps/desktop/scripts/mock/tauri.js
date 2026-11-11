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
const held = [];
Object.defineProperty(window, "__ORE_HELD", { get: () => held.map((h) => h.key) });
window.__ORE_RELEASE = (key) => {
  for (let i = held.length - 1; i >= 0; i--) if (held[i].key === key) held.splice(i, 1)[0].ok();
};
async function ore(args) {
  // window.__ORE_FAIL = { enrich: "why" }: that command fails with that reason (a test of the failure path).
  const fail = window.__ORE_FAIL && window.__ORE_FAIL[args.args[0]];
  if (fail) throw fail;
  // window.__ORE_HOLD = { "skills arrange": [800] }: the next such command waits that long before it runs at all
  // (one entry per call), so a later one (an Undo) can run first, as two `ore` processes can on a slow machine.
  // A key of the command alone ({ annotate: [1500] }) holds the next one whatever it names. An entry "manual"
  // holds it until the test calls window.__ORE_RELEASE(key); window.__ORE_HELD lists the keys waiting so.
  const two = args.args.slice(0, 2).join(" ");
  const key = window.__ORE_HOLD && (window.__ORE_HOLD[two] ? two : window.__ORE_HOLD[args.args[0]] ? args.args[0] : null);
  const hold = key && window.__ORE_HOLD[key];
  if (hold && hold.length) {
    const h = hold.shift();
    if (h === "manual") await new Promise((ok) => held.push({ key, ok }));
    else await new Promise((ok) => setTimeout(ok, h));
  }
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
  // window.__ORE_EDIT = { today: (answer) => changed }: the page gets that command's answer changed so (a test of
  // fresh numbers), in the page itself, where no request can slip past it.
  const edit = window.__ORE_EDIT && window.__ORE_EDIT[args.args[0]];
  return edit ? edit(j) : j;
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
      // And which: window.__ORE_INFLIGHT, so a journey left waiting on one can say what it is.
      const call = args.args.slice(0, 2).join(" ");
      (window.__ORE_INFLIGHT ??= []).push(call);
      try {
        return await ore(args);
      } finally {
        window.__ORE_PENDING--;
        window.__ORE_INFLIGHT.splice(window.__ORE_INFLIGHT.indexOf(call), 1);
        // window.__ORE_AFTER = { highlight: fn }: fn runs once that command's answer is in, after the code awaiting
        // it has run (a few dozen microtasks) but before the page draws it: what a click in that instant meets.
        const after = window.__ORE_AFTER && window.__ORE_AFTER[args.args[0]];
        if (after) {
          delete window.__ORE_AFTER[args.args[0]];
          let hops = 40;
          const hop = () => (hops-- > 0 ? Promise.resolve().then(hop) : after());
          void Promise.resolve().then(hop);
        }
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
