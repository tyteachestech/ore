import assert from 'node:assert/strict';
import {core,seed,artifact,tick} from './common.ts';
const mode=process.argv[2]??'reopen';
const {lib,item,card}=await seed('session-'+mode);
const c2=core.writeNewCard(lib,{kind:'card',item:item.meta.id,skills:['learning'],topics:[],content_type:'concept',question:'Why practice?',answer:'Recall.',rubric:[]});
for(const c of [card,c2])core.writeCardMeta(c,{...c.meta,created:'2026-11-26T18:00:00.000Z'});
const s=await core.startSession(lib);
await core.recordReview(lib,card.meta.id,{rating:3,confidence:2,elapsed_ms:1000});
const r=await core.recordReview(lib,c2.meta.id,{rating:3,confidence:2,elapsed_ms:1000});
tick();
const end=mode==='no-end'?null:await core.endSession(lib,new Date(),true,s.id);
await core.undoReview(lib,c2.meta.id,r.ts);
await core.reopenSession(lib,s.id);
if(mode==='reend'){tick();await core.endSession(lib,new Date(),false,s.id);}
if(mode==='reindex')core.rebuildIndex(lib);
const sameDay=core.today(lib);
// An unfinished review may stay open over midnight. Yesterday was not caught up after undo.
const nextDay=new Date('2026-11-28T18:00:00.000Z');
const today=core.today(lib,nextDay);
const priorDay=today.week.find(d=>d.date==='2026-11-27');
const result={mode,sameDayMet:sameDay.met,sameDayDue:sameDay.due,end,open:core.openSessionIds(lib),reviews:core.readReviews(lib).length,priorDay,allDue:core.dueQueue(lib,nextDay,{newLimit:false}).map(c=>c.id)};
console.log('[DEEP]',JSON.stringify(result));artifact('session-'+mode+'.json',result);
assert.equal(priorDay?.status,'open','An undone caught-up ending must not count yesterday as goal met');
