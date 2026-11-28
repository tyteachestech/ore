import assert from 'node:assert/strict';
import { Window } from '../../apps/desktop/node_modules/happy-dom';
import { setup, snap, git, rel, history, pinClock, run, tick } from './support';
import { getNotes, setNotes } from '../../packages/core/src/notes';
import { keepUnedited } from '../../apps/desktop/src/editor/preserve';
pinClock();
const {lib,item}=await setup('notes-controls');
const oldText='## Idea\n\nRecovered explanation.\n\n## Example\n\nOriginal example.\n';
const newer='## Idea\n\nUnwanted newer explanation.\n\n## Example\n\nOriginal example.\n';
await setNotes(lib,item.meta.id,oldText);const old=snap(lib);
await setNotes(lib,item.meta.id,newer);snap(lib);
const w=new Window();
for(const k of ['window','document','HTMLElement','Node','MutationObserver','getComputedStyle','navigator'] as const){ const v=(w as any)[k]; (globalThis as any)[k]=typeof v==='function'&&/^[a-z]/.test(k)?v.bind(w):v; }
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
(w as any).__TAURI_INTERNALS__={invoke:async (_cmd:string,{args}:{args:string[]})=>run(...args)};
const React=await import('../../apps/desktop/node_modules/react');const {act}=React;
const {createRoot}=await import('../../apps/desktop/node_modules/react-dom/client');
const {useSourceNote}=await import('../../apps/desktop/src/Notes');
let notes!:ReturnType<typeof useSourceNote>;
const h=history();
function Probe(){notes=useSourceNote(item.meta.id,h.notify);return null;}
const root=createRoot(w.document.createElement('div') as any);
await act(async()=>{root.render(React.createElement(Probe));await tick();});
await act(async()=>{await h.settle();});
assert.equal(notes.text,newer);
git(lib,'restore','--source',old,'--',getNotes(lib,item.meta.id).path);
await act(async()=>{ w.dispatchEvent(new w.Event('ore:library-back'));await h.settle();});
assert.equal(notes.text,oldText);
await act(async()=>{await notes.flush();});
assert.equal(getNotes(lib,item.meta.id).text,oldText);
console.log('PASS: clean open note accepts restore and flush does not overwrite it');
// Pending typing elsewhere merges with the recovered paragraph.
await act(async()=>{notes.apply(newer);});
const typed=keepUnedited(newer,newer,newer.replace('Original example.','Edited example.'));
await act(async()=>{notes.edit(typed);await notes.flush();});
const merged=getNotes(lib,item.meta.id).text;
assert.ok(merged.includes('Recovered explanation.'));
assert.ok(merged.includes('Edited example.'));
assert.ok(!merged.includes('Unwanted newer explanation.'));
console.log('PASS: pending edit to a separate paragraph keeps restored paragraph');
// Same paragraph: both versions survive, as current note conflict policy says.
await setNotes(lib,item.meta.id,oldText);
await act(async()=>{notes.apply(newer);notes.edit(newer.replace('Unwanted newer explanation.','Typed while restore ran.'));await notes.flush();});
const conflict=getNotes(lib,item.meta.id).text;
assert.ok(conflict.includes('Recovered explanation.'));
assert.ok(conflict.includes('Typed while restore ran.'));
console.log('PASS: overlapping pending edit keeps both versions (no conflict label)');
await act(async()=>{root.unmount();await h.settle();});
await w.happyDOM.abort();
