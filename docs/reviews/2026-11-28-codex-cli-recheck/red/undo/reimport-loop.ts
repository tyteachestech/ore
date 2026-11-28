import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {core,fresh,snap,diff,artifact,tick} from './common.ts';
const mode=process.argv[2]??'chain';
const lib=await fresh('reimport-'+mode);
const bodies=[
 '# Recall\n\nAlpha practice strengthens recall.\n\nBeta spacing helps learning.\n\nGamma sleep consolidates memory.\n',
 '# Recall\n\nNew introduction.\n\nAlpha practice strengthens recall.\n\nGamma sleep consolidates memory.\n',
 '# Recall\n\nSecond introduction, longer.\n\nAlpha practice strengthens recall.\n\nGamma sleep consolidates memory.\n',
 '# Recall\n\nThird introduction with another sentence.\n\nAlpha practice strengthens recall.\n\nGamma sleep consolidates memory.\n'];
let page='';const file=(i:number)=>'---\ntitle: Recall\nauthor: Original author\n---\n\n'+bodies[i];
globalThis.fetch=(async(input:any)=>{
 const url=typeof input==='string'?input:input.url??String(input);
 if(url!=='https://example.test/lesson.md')throw Error('SCOUT: unexpected network '+url);
 return new Response(page,{headers:{'content-type':'text/markdown'}});
}) as typeof fetch;
page=file(0);const item=await core.addSource(lib,'https://example.test/lesson.md');const id=item.meta.id;
const keep=core.addHighlight(item,{exact:'Alpha practice strengthens recall.',intent:'keep',note:'My note'});
const gone=core.addHighlight(item,{exact:'Beta spacing helps learning.',intent:'keep',note:'My removed note'});
const before=snap(lib.root),steps:string[]=[],checks:any[]=[];
const cycles=mode==='chain'||mode==='chain-reindex'||mode==='named'?3:1;
for(let i=1;i<=cycles;i++){tick();page=file(i);const r=await core.reimportSource(lib,id);steps.push(r.step!);assert.equal(r.changed,true);}
if(mode==='author')await core.setItemAuthor(lib,id,'Manual corrected byline');
if(mode==='title')await core.renameItem(lib,id,'Manual corrected title');
if(mode==='highlight-delete'){const {item:i,annotation:a}=core.findAnnotation(lib,keep.id);core.reviseAnnotation(i,a,{status:'deleted'});}
if(mode==='highlight-note'){const {item:i,annotation:a}=core.findAnnotation(lib,keep.id);core.reviseAnnotation(i,a,{note:'My independently edited note'});}
if(mode==='notes')await core.setNotes(lib,id,'My independently edited source note');
if(mode==='status')await core.setItemStatus(lib,id,'done');
for(let i=cycles-1;i>=0;i--){
 if(mode==='chain-reindex')core.rebuildIndex(lib);
 const got=await core.undoReimport(lib,id,mode==='named'?steps[i]:undefined);
 checks.push({version:i,body:got.body===bodies[i],original:readFileSync(join(item.dir,'source.md'),'utf8')===file(i),highlights:core.readAnnotations(got).map(a=>({id:a.id,exact:a.exact,note:a.note,status:a.status,start:a.start,end:a.end}))});
}
const back=core.findItem(lib,id),restored=core.readAnnotations(back);
const result={mode,steps,checks,author:back.meta.author,title:back.meta.title,status:back.meta.status,annotations:restored,notes:core.readNotes(back),changes:diff(before,snap(lib.root)).map(d=>d.path)};
console.log('[DEEP]',JSON.stringify(result));artifact('reimport-'+mode+'.json',result);
assert.ok(checks.every(c=>c.body&&c.original),'Each unnamed Undo must step back exactly one version and original');
if(mode==='author')assert.equal(back.meta.author,'Manual corrected byline','Undo of reimport must preserve a byline corrected since');
if(mode==='title')assert.equal(back.meta.title,'Manual corrected title');
if(mode==='highlight-delete')assert.ok(!restored.some(a=>a.id===keep.id),'Undo of reimport must not resurrect a highlight independently deleted since');
if(mode==='highlight-note')assert.equal(restored.find(a=>a.id===keep.id)!.note,'My independently edited note');
if(mode==='notes')assert.equal(core.readNotes(back),'My independently edited source note');
if(mode==='status')assert.equal(back.meta.status,'done');
if(cycles===3){
 for(let i=0;i<cycles;i++){await core.undoReimport(lib,id,steps[i]);assert.equal(core.findItem(lib,id).body,bodies[i+1]);}
 for(let i=cycles-1;i>=0;i--){await core.undoReimport(lib,id,steps[i]);assert.equal(core.findItem(lib,id).body,bodies[i]);}
 console.log('[DEEP] Three-step redo and second undo preserve all four versions');
}
