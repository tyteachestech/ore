import assert from 'node:assert/strict';
import {seed,ore} from './common.ts';
import {createItem} from '../../packages/core/src/items.ts';
const {lib}=await seed('guide-figure');
const figure=await createItem(lib,{type:'markdown',title:'Plant parts',body:'# Plant parts\n\n![Plant](assets/plant.svg)\n',skills:['learning'],assets:[{name:'plant.svg',data:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><text x="20" y="40">Root</text></svg>')}]});
const c=await ore('card','figure',figure.meta.id,'--src','assets/plant.svg','--box','0.05,0.05,0.4,0.2','--answer','Root');
// The normal guide would wait until tomorrow; --source includes this new fixture immediately.
const queue=await ore('due','--source',figure.meta.id);
const guided=queue.find((r:any)=>r.id===c.id);
const shown=await ore('card','show',c.id,'--review');
console.log('[DEEP] guide probe:',guided.question);
console.log('[DEEP] guide queue figure:',guided.figure,'figure_file:',guided.figure_file);
console.log('[DEEP] available through card show:',JSON.stringify(shown.figure));
assert(guided.figure&&guided.figure_file,'the guide probe must include the covered figure, not only “What’s under the box?”');
