import assert from 'node:assert/strict';
import {setup,snap,git,rel,pinClock,advance,run,history} from './support';
import {findItem} from '../../packages/core/src/items';
import {change} from '../../apps/desktop/src/change';
import {sourceActions} from '../../apps/desktop/src/list-actions';
pinClock();
const {lib,item}=await setup('undo-list');
await run('edit',item.meta.id,'--title=A: recovered title','--priority=P1');
const old=snap(lib);
await run('edit',item.meta.id,'--title=B: intermediate title','--priority=P2');
const h=history();let list:any[]=await run('ls');
const source=()=>sourceActions({ore:run,skills:[],items:f=>{list=f(list)},archived(){},setSkills(){},change:c=>change(h.notify,c),skillChange:c=>change(h.notify,c),reloadSkills(){}});
await source().setImportance(list[0],'P3');
await h.settle();
const priorityStep=h.steps.at(-1)!;
await source().retitle(item.meta.id,list[0].title,'C: app title');
await h.settle();snap(lib);
git(lib,'restore','--source',old,'--',rel(lib,item.docPath));
list=await run('ls');
// Guarded title Undo is a positive control.
h.h.undo();await h.settle();
assert.equal(findItem(lib,item.meta.id).meta.title,'A: recovered title');
assert.ok(h.errors.some(x=>x.includes('renamed since')));
console.log('PASS: title Undo preserves restored title and explains why');
// Take the priority toast step directly, like its own Undo, past the refused title step.
h.h.take(priorityStep);await h.settle();
console.log('priority after restore: P1; after its Undo:',findItem(lib,item.meta.id).meta.priority);
assert.equal(findItem(lib,item.meta.id).meta.priority,'P1','app-01 companion: importance Undo must not overwrite restored priority');
