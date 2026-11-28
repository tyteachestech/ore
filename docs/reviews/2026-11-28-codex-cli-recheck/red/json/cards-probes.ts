import assert from 'node:assert/strict';
import { setup,call,hashes,diff } from './common.ts';
import { writeNewCard,findCard } from '../../packages/core/src/cards.ts';
import { checkSkills } from '../../packages/core/src/skills.ts';
for (const [name,value] of [['valid',['learning']],['empty',[]],['unknown',['missing']],['blank',['']],['scalar','learning']] as const) {
 const {lib,item}=await setup(`card-probe-${name}`);
 const card=writeNewCard(lib,{kind:'card',item:item.meta.id,skills:['learning'],topics:[],content_type:'fact',question:'Q?',answer:'A',rubric:[]});
 const before=hashes(lib.root);
 const r=await call('edit',[item.meta.id],{skills:'learning',cards:JSON.stringify({[card.meta.id]:value})});
 const validation=(()=>{try{checkSkills(lib,[...Object.values({[card.meta.id]:value}).flat()] as string[]);return 'accepted';}catch(e){return (e as Error).message;}})();
 const doc=await call('doctor');
 console.log('[DEEP]',JSON.stringify({name,input:value,validation,result:r,changed:diff(before,hashes(lib.root)),saved:findCard(lib,card.meta.id).meta.skills,issues:doc.data.issues}));
 if(name==='valid'||name==='empty')assert.equal(r.code,0);
 if(name==='unknown')assert.equal(r.code,1);
}
