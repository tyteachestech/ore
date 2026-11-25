import { library,fake,check,calls } from './harness.ts';
import { addText } from '../../packages/core/src/ingest/index.ts';
import { addHighlight,findAnnotation } from '../../packages/core/src/annotations.ts';
import { markTried } from '../../packages/core/src/tries.ts';
import { tryLine } from '../../packages/core/src/ai/tries.ts';
import { tutor } from '../../packages/core/src/ai/tutor.ts';
import { runAgent } from '../../packages/core/src/ai/adapter.ts';
import { ExplainOutput } from '../../packages/core/src/ai/explain.ts';
const mode=process.argv[2]??'blank';const lib=await library('reply-'+mode);
const item=await addText(lib,'# Learning\n\nRecall strengthens memory.');
if(mode==='blank'){
 const a=addHighlight(item,{exact:'Recall strengthens memory.',intent:'apply',note:'I will recall.'});await markTried(lib,a.id,{reflection:'It helped.'});
 fake([{data:{line:process.argv[3]==='control'?' Keep recalling. ':' \n\t '}}]);let why='';try{await tryLine(lib,a.id);}catch(e){why=String(e);}
 const line=findAnnotation(lib,a.id).annotation.line;
 console.log('[DEEP]',JSON.stringify({error:why,saved:line,calls:calls().length}));
 check(!!why||!!line?.text.trim(),'a whitespace-only feedback reply must be rejected or retried, not saved empty');
}else if(mode==='encoding'){
 for(const vendor of ['claude','codex']){
  const data=[...new TextEncoder().encode('{"here":"'),255,...new TextEncoder().encode('","general":"General."}')];
  const raw=[...new TextEncoder().encode('{"type":"result","is_error":false,"structured_output":'),...data,...new TextEncoder().encode('}')];
  fake([vendor==='claude'?{raw}:{file_raw:data}],vendor);
  let result:any;let why='';try{result=await runAgent(lib,{prompt:'explain',input:{term:'x'},schema:ExplainOutput,cwd:lib.root});}catch(e){why=String(e);}
  console.log('[DEEP]',JSON.stringify({vendor,accepted:result?.data,error:why}));
 }
}else if(mode==='sessions'){
 const out={reply:'Recall helps.',citations:[],general:true,hint:false,card:null,exercise:null,steps:[],covered:[],evidence:[],title:'Recall'};
 for(const vendor of ['claude','codex']){
  const chat='forgotten-'+vendor;
  fake([{data:out}],vendor);
  await tutor(lib,'What helps?',{chat,item:item.meta.id});
  fake([{is_error:true,exit:1,stderr:'No conversation found with session ID: fake-thread'},{data:out}],vendor);
  let why='';try{await tutor(lib,'And why?',{chat,item:item.meta.id,earlier:[{message:'What helps?',reply:out.reply}]});}catch(e){why=String(e);}
  const rows=calls();
  console.log('[DEEP]',JSON.stringify({vendor,error:why,runs:rows.length,resumed:rows[0]?.args.includes(vendor==='claude'?'--resume':'resume'),fresh:rows[1]&&!rows[1].args.includes(vendor==='claude'?'--resume':'resume')}));
  check(!why&&rows.length===2,`${vendor} forgotten tutor session recovers with one fresh start`);
 }
}else throw Error('unknown reply mode');
