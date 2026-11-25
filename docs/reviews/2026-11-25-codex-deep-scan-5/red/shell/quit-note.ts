// Run from the repo root. Real useNotes hook; no app, vendor, or live library.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Window } from '../../apps/desktop/node_modules/happy-dom';
const w = new Window();
const g = globalThis as any;
for (const k of ['window', 'document', 'HTMLElement', 'Node', 'MutationObserver', 'getComputedStyle', 'navigator', 'localStorage', 'KeyboardEvent']) {
  const v = (w as any)[k]; g[k] = typeof v === 'function' && /^[a-z]/.test(k) ? v.bind(w) : v;
}
for (const k of ['addEventListener', 'removeEventListener', 'dispatchEvent']) g[k] = (w as any)[k].bind(w);
g.IS_REACT_ACT_ENVIRONMENT = true;
let clock = 0;
let timerId = 0;
const timers = new Map<number, {at: number; fn: () => void}>();
w.setTimeout = ((fn: () => void, ms = 0) => { const id = ++timerId; timers.set(id, {at: clock + ms, fn}); return id; }) as any;
// useNotes cancels via the global clearTimeout.
const originalClear = globalThis.clearTimeout;
g.clearTimeout = (id: any) => { timers.delete(id); originalClear(id); };
const callbacks = new Map<number, Function>();
const events = new Map<string, number[]>();
let callbackId = 1000;
let disk = 'Original note';
const calls: string[][] = [];
(w as any).__TAURI_INTERNALS__ = {
  transformCallback(fn: Function) { const id = ++callbackId; callbacks.set(id, fn); return id; },
  invoke: async (cmd: string, a: any) => {
    if (cmd === 'plugin:event|listen') { events.set(a.event, [...(events.get(a.event) ?? []), a.handler]); return a.handler; }
    if (cmd !== 'ore') return;
    calls.push(a.args);
    assert.equal(a.args[0], 'notes');
    const set = a.args.find((s: string) => s.startsWith('--set='));
    if (set) disk = set.slice(6);
    return {text: disk, dir: '/unused', merged: false};
  },
};
const React = await import('../../apps/desktop/node_modules/react');
const { createRoot } = await import('../../apps/desktop/node_modules/react-dom/client');
const { useNotes } = await import('../../apps/desktop/src/Notes');
const { kept } = await import('../../apps/desktop/src/util');
let notes: ReturnType<typeof useNotes>;
const notify = (() => Object.assign(() => {}, {undo(){}, hold(){}})) as any;
function Probe() { notes = useNotes({item: 'own-scratch-source'}, notify); return null; }
const root = createRoot(document.createElement('div') as any);
await React.act(async () => root.render(React.createElement(Probe)));
assert.equal(notes!.text, 'Original note');
await React.act(async () => notes!.edit('Original note plus my final sentence'));
const draft = kept<string>('shell-control'); draft.set('answer', 'Review draft control');
const shell = readFileSync('apps/desktop/src-tauri/src/main.rs', 'utf8');
const quit = shell.slice(shell.indexOf('if let tauri::RunEvent::ExitRequested'));
const event = quit.match(/app.emit\("([^"]+)"/)![1]!;
const deadline = Number(quit.match(/Duration::from_millis\((\d+)\)/)![1]);
const mode = process.argv[2] ?? 'quit';
await React.act(async () => {
  if (mode === 'beforeunload') w.dispatchEvent(new w.Event('beforeunload'));
  else for (const id of events.get(event) ?? []) callbacks.get(id)!({payload: null});
  clock = mode === 'autosave' ? 800 : deadline;
  for (const [id, t] of timers) if (t.at <= clock) { timers.delete(id); t.fn(); }
});
console.log(`[DEEP] event=${mode === 'beforeunload' ? mode : event}; exit deadline=${deadline}ms; observed at=${clock}ms`);
console.log(`[DEEP] review draft stored=${!!localStorage.getItem('shell-control')}; note writes=${calls.filter(a => a.some(s => s.startsWith('--set='))).length}; note=${JSON.stringify(disk)}`);
try { assert.equal(disk, 'Original note plus my final sentence', 'Quit must persist the final note edit before the shell exits'); }
catch (e) { console.error('[DEEP] FAIL: Quit loses the pending note edit'); process.exit(1); }
console.log('[DEEP] PASS: note edit persisted');
process.exit(0);
