import assert from 'node:assert/strict';
import {core,fresh,artifact} from './common.ts';
const mode=process.argv[2]??'author',control=process.argv[3]??'none';
const lib=await fresh('overwrite-'+mode+'-'+control);
const oldBody='# Lesson\n\nAlpha practice strengthens recall.\n',newBody=oldBody+'\nNew unrelated ending.\n';
let page='---\nauthor: Original author\n---\n\n'+oldBody,fetches=0;
globalThis.fetch=(async()=>{fetches++;return new Response(page,{headers:{'content-type':'text/markdown'}});}) as typeof fetch;
const item=await core.addSource(lib,'https://example.test/lesson.md');
const a=mode==='highlight'?core.addHighlight(item,{exact:'Alpha practice strengthens recall.',intent:'keep'}):undefined;
page='---\nauthor: Original author\n---\n\n'+newBody;
const r=await core.reimportSource(lib,item.meta.id);
assert.ok(r.changed);
if(mode==='author')await core.setItemAuthor(lib,item.meta.id,'Manual correction');
else if(mode==='title')await core.renameItem(lib,item.meta.id,'Manual correction');
else if(mode==='highlight'){
 const x=core.findAnnotation(lib,a!.id);core.reviseAnnotation(x.item,x.annotation,{status:'deleted'});
}
const justBefore=core.findItem(lib,item.meta.id);
const before={author:justBefore.meta.author,title:justBefore.meta.title,liveHighlights:core.readAnnotations(justBefore).length};
if(control==='reindex')core.rebuildIndex(lib);
const fetchesBeforeUndo=fetches;
await core.undoReimport(lib,item.meta.id,r.step);
const back=core.findItem(lib,item.meta.id);
const after={author:back.meta.author,title:back.meta.title,liveHighlights:core.readAnnotations(back).length};
const result={mode,control,reimportRemoved:r.removed.length,before,after,fetchesDuringUndo:fetches-fetchesBeforeUndo,bodyRestored:back.body===oldBody,rawMeta:back.meta};
console.log('[DEEP]',JSON.stringify(result));artifact('overwrite-'+mode+'-'+control+'.json',result);
assert.equal(result.bodyRestored,true);
if(mode==='highlight')assert.equal(after.liveHighlights,0,'Undo resurrected an independently deleted highlight that reimport never removed');
else assert.equal(after[mode],before[mode],`Undo overwrote the independent ${mode} correction`);
