// Native menu dispatch is read from Rust; the receiving page's listener and Undo hook run unchanged.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Window} from '../../apps/desktop/node_modules/happy-dom';
const w = new Window(); const g = globalThis as any;
for (const k of ['window','document','HTMLElement','Node','MutationObserver','getComputedStyle','navigator','localStorage','KeyboardEvent','Event','CustomEvent']) {
 const v=(w as any)[k];g[k]=typeof v==='function'&&/^[a-z]/.test(k)?v.bind(w):v;
}
for(const k of ['addEventListener','removeEventListener','dispatchEvent','requestAnimationFrame','cancelAnimationFrame']) g[k]=(w as any)[k].bind(w);
g.IS_REACT_ACT_ENVIRONMENT=true;
const handlers=new Map<number, Function>();const listeners=new Map<string,number[]>();let seq=0;
(w as any).__TAURI_INTERNALS__={
 transformCallback(fn:Function){handlers.set(++seq,fn);return seq;},
 async invoke(cmd:string,a:any){if(cmd==='plugin:event|listen'){listeners.set(a.event,[...(listeners.get(a.event)??[]),a.handler]);return a.handler;} if(cmd==='ore') throw Error('No CLI or AI permitted in this harness');}
};
const React=await import('../../apps/desktop/node_modules/react');
const {createRoot}=await import('../../apps/desktop/node_modules/react-dom/client');
const {useToast}=await import('../../apps/desktop/src/Toast');
const {listenMenu, menuSpec}=await import('../../apps/desktop/src/menubar');
const {BINDINGS}=await import('../../apps/desktop/src/keys');
const {History}=await import('../../apps/desktop/src/history');
const keys=Object.fromEntries(BINDINGS.map(b=>[b.id,b.combo])) as any;
let toast:ReturnType<typeof useToast>;
function Probe(){toast=useToast();return null;}
const root=createRoot(document.createElement('div') as any);
await React.act(async()=>root.render(React.createElement(Probe)));
await listenMenu(()=>keys);
const disk={mainSourceArchived:true,quizRatingSaved:true};
await React.act(async()=>{toast!.notify('Archived main source','quiet',async()=>{disk.mainSourceArchived=false;},async()=>{});});
const quizHistory=new History();quizHistory.push({message:'Quiz rating',undo:async()=>{disk.quizRatingSaved=false;}});
const rust=readFileSync('apps/desktop/src-tauri/src/main.rs','utf8');
const from=rust.indexOf('.on_menu_event(|app, e| {\n            let id =');
assert(from>=0,'shell menu route must be present');
const route=rust.slice(from,rust.indexOf('// Images in notes',from));
const target=route.match(/app.emit_to\("([^"]+)", "menu", id\)/)![1]!;
assert(!route.includes('is_focused'),'revisit this probe when the shell becomes focus-aware');
const mode=process.argv[2]??'native';
await React.act(async()=>{
 if(mode==='active-control') quizHistory.undo();
 else for(const id of listeners.get('menu')??[]) handlers.get(id)!({payload:'ore:undo'});
});
const later=menuSpec(keys,{reader:false,review:false}).flatMap(m=>m.items).find((r:any)=>r.id==='ore:later') as any;
console.log(`[DEEP] active window=quiz; native route=${target}; main Home menu Later enabled=${later.enabled}`);
console.log(`[DEEP] ${JSON.stringify(disk)}`);
try {assert.equal(disk.mainSourceArchived,true,'Quiz Undo must not restore a source archived in the other window');assert.equal(disk.quizRatingSaved,false,'Quiz Undo must undo the quiz rating');}
catch{console.error('[DEEP] FAIL: native Edit > Undo changes the main window instead of the quick quiz');process.exit(1);}
console.log('[DEEP] PASS: only the active quiz rating was undone');process.exit(0);
