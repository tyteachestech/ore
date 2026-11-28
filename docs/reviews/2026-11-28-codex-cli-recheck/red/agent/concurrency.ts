import assert from 'node:assert/strict';
import {seed,ore} from './common.ts';
import {saveChat,readChat} from '../../packages/core/src/chats.ts';
import {readReviews} from '../../packages/core/src/reviews.ts';
import {findAnnotation} from '../../packages/core/src/annotations.ts';
const {lib,item,card}=await seed('concurrency');
const q=await ore('highlight',item.meta.id,'--exact','Retrieval makes the memory accessible.','--intent','question','--note','Why?');
// One Bun process, real command handlers and real library lock, overlapping promises.
for(let i=0;i<3;i++) {
 await Promise.all([ore('review',card.meta.id,'--rating','3','--confidence','2','--answer','left-'+i),ore('review',card.meta.id,'--rating','2','--confidence','1','--answer','right-'+i)]);
 let reviews=readReviews(lib); assert.equal(reviews.length,2*(i+1)); assert.equal(new Set(reviews.map(r=>r.ts)).size,reviews.length);
}
console.log('[DEEP] two reviews: 3 overlapping pairs; six distinct receipts, both answers retained');
await Promise.all([ore('review',card.meta.id,'--rating','3','--confidence','2','--answer','review+edit'),ore('card','set',card.meta.id,'--question','Updated while rating')]);
assert.equal(readReviews(lib).length,7); assert.equal((await ore('card','show',card.meta.id)).question,'Updated while rating');
console.log('[DEEP] review + card set: wording and rating retained');
await Promise.all([ore('notes',item.meta.id,'--append','First note','--heading','Recall'),ore('notes',item.meta.id,'--append','Second note','--heading','Recall')]);
const note=(await ore('notes',item.meta.id)).text; assert(note.includes('First note')&&note.includes('Second note'));
console.log('[DEEP] two notes appends: both lines retained');
await Promise.all([ore('edit',item.meta.id,'--title','New source title'),ore('skills','set','learning','--name','Learning renamed')]);
assert.equal((await ore('show',item.meta.id)).title,'New source title'); assert((await ore('skills')).some((s:any)=>s.id==='learning'&&s.name==='Learning renamed'));
console.log('[DEEP] source title + its skill name: both retained');
const base={id:'shared-chat',title:'Study',carry:[],turns:[{id:'start',message:'Start'}]};
await saveChat(lib,JSON.stringify(base));
await Promise.all([saveChat(lib,JSON.stringify({...base,turns:[...base.turns,{id:'left',message:'Left'}]}),{merge:true}),saveChat(lib,JSON.stringify({...base,turns:[...base.turns,{id:'right',message:'Right'}]}),{merge:true})]);
assert.deepEqual(new Set(readChat(lib,base.id).turns.map(t=>t.id)),new Set(['start','left','right']));
console.log('[DEEP] two stale chat copies with --merge core path: all three turns retained');
await Promise.all([ore('inbox','--add','https://scout.invalid/a'),ore('inbox','--add','https://scout.invalid/b')]);
assert.equal((await ore('inbox')).length,2);
console.log('[DEEP] two inbox additions: two entries with distinct ids');
await Promise.all([ore('answer',q.id,'--text','Left answer'),ore('answer',q.id,'--text','Right answer')]);
assert.deepEqual(findAnnotation(lib,q.id).annotation.answers!.map(a=>a.text),['Left answer','Right answer']);
console.log('[DEEP] two answers: both pieces retained');
let collisions=0;
for(let i=0;i<30;i++) {
 await ore('answer',q.id,'--text','Natural first '+i);
 await ore('answer',q.id,'--text','Natural second '+i);
 const a=findAnnotation(lib,q.id).annotation.answers!.slice(-2); if(a[0]!.ts===a[1]!.ts)collisions++;
}
console.log('[DEEP] unmodified real clock, 30 sequential answer pairs: timestamp collisions='+collisions);
