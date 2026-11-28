import assert from 'node:assert/strict';
import { setup, call, hashes, diff } from './common.ts';
import { writeNewCard, findCard } from '../../packages/core/src/cards.ts';
const mode=process.argv[2]??'empty-skill';
const {lib,item}=await setup(`cards-${mode}`);
const make=()=>writeNewCard(lib,{kind:'card',item:item.meta.id,skills:['learning'],topics:[],content_type:'fact',question:'What helps memory?',answer:'Recall',rubric:[]});
const c1=make(), c2=make();
const cards=mode==='partial'?{[c1.meta.id]:[],[c2.meta.id]:'learning'}:{[c1.meta.id]:['']};
const before=hashes(lib.root);
const r=await call('edit',[item.meta.id],{skills:'learning',cards:JSON.stringify(cards)});
const changed=diff(before,hashes(lib.root));
console.log('[DEEP]',JSON.stringify({mode,code:r.code,data:r.data,changed,savedSkills:findCard(lib,c1.meta.id).meta.skills}));
if(mode==='partial') {
 assert.equal(r.code,1);
 assert.deepEqual(changed,[],'invalid card map changes an earlier exercise before failing');
} else {
 assert.equal(r.code,1,'empty skill id in --cards must be rejected, never saved');
 assert.deepEqual(changed,[]);
}
