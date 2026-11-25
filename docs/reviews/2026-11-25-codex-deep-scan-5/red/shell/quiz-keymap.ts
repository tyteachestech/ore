// Two JS module instances model Tauri's two pages; same localStorage, genuine storage event delivered.
import assert from 'node:assert/strict';
import {Window} from '../../apps/desktop/node_modules/happy-dom';
const w=new Window();const g=globalThis as any;
g.window=w;g.document=w.document;g.localStorage=w.localStorage;
for(const k of ['addEventListener','removeEventListener','dispatchEvent'])g[k]=(w as any)[k].bind(w);
const main=await import('../../apps/desktop/src/keys?main-shell-probe');
const quiz=await import('../../apps/desktop/src/keys?quiz-shell-probe');
const event=(combo:string)=>{const p=combo.split('+');const code=p.pop()!;return new w.KeyboardEvent('keydown',{code,key:code.replace(/^Key/,'').toLowerCase(),metaKey:p.includes('Meta'),ctrlKey:p.includes('Ctrl'),altKey:p.includes('Alt'),shiftKey:p.includes('Shift')}) as any;};
assert(quiz.is(event('Meta+KeyL'),'later'));
assert.equal(main.rebind('later','Ctrl+Alt+KeyL'),null);
w.dispatchEvent(new w.StorageEvent('storage',{key:'ore.keys',newValue:localStorage.getItem('ore.keys'),storageArea:localStorage as any}));
const mode=process.argv[2]??'already-open';
const observed=mode==='fresh-control'?await import('../../apps/desktop/src/keys?relaunch-shell-probe'):quiz;
const result={mainNew:main.is(event('Ctrl+Alt+KeyL'),'later'),quizNew:observed.is(event('Ctrl+Alt+KeyL'),'later'),quizOld:observed.is(event('Meta+KeyL'),'later')};
console.log(`[DEEP] mode=${mode}; after Settings rebind + storage event: ${JSON.stringify(result)}`);
try{assert(result.quizNew,'The already-created quick quiz must use the saved shortcut');assert(!result.quizOld,'The replaced shortcut must stop acting in the quick quiz');}
catch{console.error('[DEEP] FAIL: quick quiz keeps the launch-time keymap until relaunch');process.exit(1);}
console.log('[DEEP] PASS: new shortcut used, old shortcut inactive');process.exit(0);
