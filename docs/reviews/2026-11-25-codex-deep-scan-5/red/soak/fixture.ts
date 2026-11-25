import { openLibrary, paths } from '../../packages/core/src/library';
import { updateItemMeta } from '../../packages/core/src/items';
import { writeNewCard, writeCardMeta } from '../../packages/core/src/cards';
import { withLock } from '../../packages/core/src/lock';
const [mode,id,arg]=process.argv.slice(2);
const lib=openLibrary();
if(!lib.root.includes('/codex-out/'))throw Error('Scratch libraries only');
if(mode==='pending'){
  console.log(JSON.stringify(await updateItemMeta(lib,id!,m=>({...m,captured_at:arg!,enriched_at:undefined,enrich_error:undefined,enrich_skipped:undefined,prequestions:[]}))));
}else if(mode==='question'){
  console.log(JSON.stringify(await updateItemMeta(lib,id!,m=>({...m,enriched_at:new Date().toISOString(),enrich_error:undefined,prequestions:[{q:arg!}]}))));
}else if(mode==='enrich'){
  console.log(JSON.stringify(await updateItemMeta(lib,id!,m=>({...m,enriched_at:arg==='ok'?new Date().toISOString():undefined,enrich_error:arg==='fail'?'Soak: simulated background enrichment failure':undefined,prequestions:arg==='ok'?[{q:'What makes spaced retrieval useful?'}]:[]}))));
}else if(mode==='cards'){
  const ids=await withLock(paths.lock(lib),()=>Array.from({length:2},(_,n)=>{
    const c=writeNewCard(lib,{kind:'card',item:id!,skills:['learning'],topics:[],content_type:'fact',question:`Soak ${arg}: What helps memory ${n+1}?`,answer:'Spaced retrieval practice.',rubric:[]});
    writeCardMeta(c,{...c.meta,state:'live',created:'2026-11-20T12:00:00.000Z'});
    return c.meta.id;
  }));console.log(JSON.stringify(ids));
}else throw Error('Unknown fixture mode');
