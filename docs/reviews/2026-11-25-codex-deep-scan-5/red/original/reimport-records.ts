import { fresh, log } from './harness';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const { addSource, reimportSource, undoReimport } = await import('../../packages/core/src/ingest/index');
const { findItem, sourceFile } = await import('../../packages/core/src/items');
const { addHighlight, readAnnotations } = await import('../../packages/core/src/annotations');
const { writeNewCard } = await import('../../packages/core/src/cards');
const { setNotes, readNotes } = await import('../../packages/core/src/notes');
const { recordReview } = await import('../../packages/core/src/study');
const { readReviews } = await import('../../packages/core/src/reviews');
const lib = fresh('reimport-records');
const input = join(lib.root,'lesson.csv');
writeFileSync(input,'Topic,Advice\nSpacing,Wait before retrieving\nSleep,Rest after learning\n');
const item = await addSource(lib,input);
const original = readFileSync(sourceFile(item)!);
// A hand edit to doc.md, expressly in this scout's scope; reimport intentionally replaces the body (D93).
const originalDoc = readFileSync(item.docPath,'utf8');
writeFileSync(item.docPath, originalDoc.replace('| Topic |','Handwritten introduction.\n\n| Topic |'));
await (await import('../../packages/core/src/doctor')).doctor(lib,{fix:true});
const edited = findItem(lib,item.meta.id);
const keep=addHighlight(edited,{exact:'Wait before retrieving',intent:'card',note:'Recall this later'});
const gone=addHighlight(edited,{exact:'Handwritten introduction.',intent:'keep',note:'My margin line'});
await setNotes(lib,item.meta.id,'My source note survives reimport.\n');
const card=writeNewCard(lib,{kind:'card',item:item.meta.id,annotation:keep.id,skills:[],topics:[],content_type:'concept',question:'When to retrieve?',answer:'After a delay.',rubric:[]});
await recordReview(lib,card.meta.id,{confidence:2,rating:3,now:new Date('2026-11-24T12:00:00Z'),answer:'After a delay.',elapsed_ms:8000});
const before={note:readNotes(edited),card:readFileSync(card.path,'utf8'),reviews:JSON.stringify(readReviews(lib))};
const r=await reimportSource(lib,item.meta.id);
assert(r.changed && r.step); assert(r.removed.some(a=>a.id===gone.id)); assert(readAnnotations(r.item).some(a=>a.id===keep.id));
assert.equal(readNotes(r.item),before.note); assert.equal(readFileSync(card.path,'utf8'),before.card); assert.equal(JSON.stringify(readReviews(lib)),before.reviews); assert(readFileSync(sourceFile(r.item)!).equals(original));
await undoReimport(lib,item.meta.id,r.step);
const back=findItem(lib,item.meta.id);
assert(back.body.includes('Handwritten introduction.')); assert(readAnnotations(back).some(a=>a.id===gone.id));
assert.equal(readNotes(back),before.note); assert.equal(JSON.stringify(readReviews(lib)),before.reviews);
log('reimport-records',{changed:true,moved:r.moved,removed:r.removed.length,exerciseBytesKept:true,reviewHistoryKept:true,sourceNoteKept:true,originalBytesKept:true,undoRestoresHandEditAndHighlight:true});
for(const name of ['paper.pdf','notes.docx','deck.pptx']){
 const scratch=fresh('damaged-'+name);const input=join(scratch.root,name);writeFileSync(input,readFileSync('packages/core/test/fixtures/intake/files/'+name));
 const i=await addSource(scratch,input);writeFileSync(sourceFile(i)!,new Uint8Array([1,2,3,4]));
 const files=()=>Object.fromEntries(readdirSync(i.dir).filter(n=>!n.startsWith('.')).map(n=>[n,readFileSync(join(i.dir,n)).toString('base64')]));
 const pre=files(); let refused='';try{await reimportSource(scratch,i.meta.id)}catch(e){refused=(e as Error).message}
 assert(refused);assert.deepEqual(files(),pre);log('damaged-'+name,{refused,sourceFilesUnchanged:true});
}
