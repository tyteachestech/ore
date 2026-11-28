import assert from 'node:assert/strict';
import {seed,ore} from './common.ts';
import {updateItemMeta,findItem} from '../../packages/core/src/items.ts';
import {pendingPrequestions} from '../../packages/core/src/ai/enrich.ts';
import {listCards} from '../../packages/core/src/cards.ts';
const {lib,item}=await seed('guide-finish');
await updateItemMeta(lib,item.meta.id,m=>({...m,enriched_at:new Date().toISOString(),prequestions:[{q:'Why retrieve?'},{q:'How would you space practice?'}]}));
// Every write named by mode 3, with a supplied learner answer at each stage.
for(const n of ['1','2']) await ore('prequestion',item.meta.id,n,'--before','No idea');
for(const n of ['1','2']) await ore('prequestion',item.meta.id,n,'--after','Retrieval over several days improves recall.');
await ore('recall',item.meta.id,'--text','I recalled the idea without looking.');
await ore('notes',item.meta.id,'--append','I will use this next week.','--heading','Use and connections');
const final=findItem(lib,item.meta.id);
console.log('[DEEP] after guide finish: status='+final.meta.status+', finished_at='+final.meta.finished_at+', prequestion drafts pending='+pendingPrequestions(final,listCards(lib)).length);
assert.equal(final.meta.status,'done','a source the learner finished through mode 3 should be Done, enabling its prequestion drafts');
