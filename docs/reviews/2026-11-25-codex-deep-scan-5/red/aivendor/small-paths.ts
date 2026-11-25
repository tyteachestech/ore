import { library,fake,ready,release,check,calls } from './harness.ts';
import { addText } from '../../packages/core/src/ingest/index.ts';
import { findItem,updateItemMeta,setPrequestionAttempt } from '../../packages/core/src/items.ts';
import { recallFeedback } from '../../packages/core/src/ai/recall.ts';
import { checkPrequestion } from '../../packages/core/src/ai/check.ts';
import { setSkillLook } from '../../packages/core/src/skills.ts';
import { addHighlight } from '../../packages/core/src/annotations.ts';
import { startDig,endDig,readDigs } from '../../packages/core/src/digs.ts';
import { digAsk,digAnswer } from '../../packages/core/src/ai/dig.ts';
const mode=process.argv[2]??'recall-race';
const control=process.argv[3]==='control';
const lib=await library(mode+(control?'-control':''));
const item=await addText(lib,'# Learning\n\nRecall strengthens memory.\n\nSpace practice over time.\n',{skills:['learning']});
const stamp={vendor:'claude',model:'old',prompt_version:'key-points@1'};
if(mode==='recall-race'){
 await updateItemMeta(lib,item.meta.id,m=>({...m,prequestions:[{q:'What helps memory?',after:'Rereading only.'}]}));
 fake([{data:{feedback:'Rereading alone is not sufficient.',questions:[{n:1,feedback:'Your answer missed retrieval.'}],missed:['Retrieval'],section_lines:null},hold:true}]);
 const pending=recallFeedback(lib,item.meta.id).then(()=>'',e=>String(e));
 await ready();if(!control)await setPrequestionAttempt(lib,item.meta.id,1,{after:'Recall strengthens memory.'});release();
 const error=await pending;const meta=findItem(lib,item.meta.id).meta;
 console.log('[DEEP]',JSON.stringify({error,answer:meta.prequestions?.[0]?.after,feedback:meta.recall?.feedback}));
 check(control?!!meta.recall?.feedback:!meta.recall?.feedback,'feedback for the old answer must not be saved on the corrected answer');
}else if(mode==='check-race'){
 await updateItemMeta(lib,item.meta.id,m=>({...m,prequestions:[{q:'What helps memory?',after:'Practice.',points:[{text:'Retrieval',evidence:[]},{text:'Spacing',evidence:[]}],points_ai:stamp}]}));
 fake([{data:{covered:[true,false]},hold:true}]);
 const pending=checkPrequestion(lib,item.meta.id,1).then(()=>'',e=>String(e));
 await ready();if(!control)await updateItemMeta(lib,item.meta.id,m=>({...m,prequestions:m.prequestions!.map(p=>({...p,points:[{text:'New point A',evidence:[]},{text:'New point B',evidence:[]},{text:'New point C',evidence:[]}]}))}));release();
 const error=await pending;const p=findItem(lib,item.meta.id).meta.prequestions![0]!;
 console.log('[DEEP]',JSON.stringify({error,inputPoints:JSON.parse(calls()[0].args[1].split('Task input (JSON):\n')[1]).key_points,points:p.points,check:p.check}));
 check(!p.check||p.check.covered.length===p.points!.length,'late check must not put two marks on three changed key points');
}else if(mode==='dig-close'||mode==='dig-stamps'){
 await setSkillLook(lib,'learning',{goal:'Explain learning'});
 for(const exact of ['Recall strengthens memory.','Space practice over time.']) addHighlight(findItem(lib,item.meta.id),{exact,intent:'card'});
 const d=await startDig(lib,'learning','I remember retrieval.',new Date('2026-11-24T12:00:00Z'));
 fake([{data:{came:[1],asks:[{n:2,q:'What about spacing?'}]},hold:mode==='dig-close',model:'claude-first'}]);
 if(mode==='dig-close'){
  const pending=digAsk(lib,'learning').then(()=>'',e=>String(e));await ready();
  const closed=control?d:await endDig(lib,'learning',d.id,new Date('2026-11-24T12:01:00Z'));release();
  const error=await pending;const saved=readDigs(lib,'learning')[0]!;
  console.log('[DEEP]',JSON.stringify({error,before:closed,after:saved}));
  check(control?!!saved.asks&&!saved.done_at:JSON.stringify(saved)===JSON.stringify(closed),'a late ask must leave the finished dig unchanged');
 }else{
  const first=await digAsk(lib,'learning');
  fake([{data:{came:[2],asks:[]},model:control?'claude-first':'other'}],control?'claude':'codex');process.env.ORE_AI_MODEL=control?'claude-first':'codex-second';
  await digAnswer(lib,'learning',['I should space practice.']);
  const saved=readDigs(lib,'learning')[0]!;
  console.log('[DEEP]',JSON.stringify({firstStamp:first.ai,saved}));
  check(JSON.stringify(saved).includes('claude-first'),'the saved dig must retain the author of the question and own marks from stage one');
 }
}else throw Error('unknown mode');
