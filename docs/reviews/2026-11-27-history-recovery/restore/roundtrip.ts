import { fresh, snap, git, check, at, out } from './helpers.ts';
import { addSource, addText, reimportSource } from '../../packages/core/src/ingest/index.ts';
import { findItem, listItems, setItemArchived, sourceFile } from '../../packages/core/src/items.ts';
import { addHighlight, readAnnotations, anchorAnnotations, reviseAnnotation } from '../../packages/core/src/annotations.ts';
import { writeNewCard, findCard } from '../../packages/core/src/cards.ts';
import { setNotes, getNotes } from '../../packages/core/src/notes.ts';
import { backlinks, brokenLinks } from '../../packages/core/src/links.ts';
import { setDiagram, getDiagram } from '../../packages/core/src/diagrams.ts';
import { saveChat, readChat, listChats } from '../../packages/core/src/chats.ts';
import { openIndex } from '../../packages/core/src/db.ts';
import { dueQueue, recordReview, cardHistory } from '../../packages/core/src/study.ts';
import { doctor } from '../../packages/core/src/doctor.ts';
import { cutText, restoreCut } from '../../packages/core/src/cut.ts';
import { readFileSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { commands } from '../../packages/cli/src/commands.ts';

const mode=process.argv[2]??'notes';
const lib=await fresh('roundtrip-'+mode);
const item=await addSource(lib,resolve('packages/core/test/fixtures/intake/files/textedit.rtf'));
const id=item.meta.id;
const phrase=item.body.split('\n').find(x=>x.trim()&&!x.startsWith('#'))!.trim();
const ann=addHighlight(item,{exact:phrase,intent:'card',note:'Restorable highlight'});
const card=writeNewCard(lib,{kind:'card',item:id,annotation:ann.id,skills:['learning'],topics:[],content_type:'fact',question:'What did this source say?',answer:phrase,rubric:[]});
const other=await addText(lib,'# Link target\n\nAnother source to link.\n');
const note=`amberword [Target](ore:item/${other.meta.id})\n`;
await setNotes(lib,id,note);
await setNotes(lib,other.meta.id,`[Back](ore:item/${id})\n`);
await setNotes(lib,{skill:'learning'},`amberword [Source](ore:item/${id})\n`);
const scene={type:'excalidraw',elements:[{id:'txt',type:'text',text:'amberword'}]};
await setDiagram(lib,id,'map',JSON.stringify(scene));
const chat={id:'restorechat',title:'Old title',created:at(0).toISOString(),updated:at(0).toISOString(),carry:[],turns:[{id:'one',message:'amberword',reply:'Older reply'}]};
await saveChat(lib,JSON.stringify(chat),{touch:false});
await recordReview(lib,card.meta.id,{rating:3,confidence:2,now:at(0)});
const original=readFileSync(sourceFile(item)!);
const sha=snap(lib);
const search=(q:string)=>{ const i=openIndex(lib); try{return i.search(q);}finally{i.close();} };
search('amberword');
if(mode==='notes') {
 const path=join(item.dir,'notes.md'); const oldStat=statSync(path);
 await setNotes(lib,id,note.replace('amberword','violetone').replace(other.meta.id,id));
 await setNotes(lib,{skill:'learning'},`violetone [Source](ore:item/${id})\n`);
 await setDiagram(lib,id,'map',JSON.stringify({...scene,elements:[{id:'txt',type:'text',text:'violetone'}]}));
 await saveChat(lib,JSON.stringify({...chat,title:'New title',turns:[{id:'one',message:'violetone',reply:'Newer reply'}]}),{touch:false});
 check(search('violetone').length===2,'changed source and skill notes indexed');
 git(lib,'checkout',sha,'--',relative(lib.root,path),'skills/learning/notes.md',relative(lib.root,join(item.dir,'diagrams/map.excalidraw')),'chats/restorechat.json');
 check(oldStat.size===statSync(path).size,'same-sized note restore exercised');
 check(getNotes(lib,id).text===note,'source note bytes restored');
 check(search('amberword').length===2 && search('violetone').length===0,'search sees restored same-sized source and skill notes');
 check(backlinks(lib,{kind:'item',id:other.meta.id}).some(x=>x.from.id===id),'outgoing backlink restored');
 check(backlinks(lib,{kind:'item',id}).length===2,'incoming source and skill backlinks preserved');
 check(brokenLinks(lib).length===0,'no broken links after restoration');
 check(JSON.stringify(getDiagram(lib,id,'map').scene)===JSON.stringify(scene),'diagram restored');
 check(readChat(lib,chat.id).turns[0]?.message==='amberword' && listChats(lib)[0]?.title==='Old title','chat contents and list restored');
} else {
 if(mode==='archive') await setItemArchived(lib,id,true);
 if(mode==='cut') await cutText(lib,id,item.body.indexOf(phrase),item.body.indexOf(phrase)+1);
 if(mode==='delete') {rmSync(item.dir,{recursive:true});rmSync(card.path);}
 search('amberword'); snap(lib,1);
 git(lib,'restore','--source',sha,'--staged','--worktree','--',relative(lib.root,item.dir),relative(lib.root,card.path));
 check(findItem(lib,id).body===item.body,'source body restored');
 check(JSON.stringify(findItem(lib,id).meta)===JSON.stringify(item.meta),'source metadata restored');
 check(readFileSync(sourceFile(findItem(lib,id))!).equals(original),'kept original restored byte for byte');
 check(readAnnotations(findItem(lib,id)).length===1 && anchorAnnotations(findItem(lib,id))[0]?.anchor?.method==='position','highlight restored and position anchored');
 check(findCard(lib,card.meta.id).question===card.question,'exercise restored');
 check(listItems(lib).some(x=>x.meta.id===id) && search('amberword').some(x=>x.item===id),'list and search see restored source');
 check(dueQueue(lib,at(7)).some(x=>x.id===card.meta.id),'due queue sees restored exercise');
 check(cardHistory(lib,card.meta.id,at(7)).reviews.length===1,'exercise review history preserved');
 const r=await reimportSource(lib,id,{local:true});
 check(r.item.body===item.body,'reimport uses restored original');
 if(mode==='cut') { const atWord=findItem(lib,id).body.indexOf(phrase); const c=await cutText(lib,id,atWord,atWord+1); git(lib,'checkout',sha,'--',relative(lib.root,item.dir)); let refused=false; try {await restoreCut(lib,id,c.id);}catch{refused=true;} check(refused && findItem(lib,id).body===item.body,'one cut already restored is refused safely'); }
}
const d=await doctor(lib);check(d.errors===0,'doctor has no errors',d.issues);
for(const [name,args,flags] of [['ls',[],{}],['show',[id],{}],['search',['amberword'],{}],['due',[],{all:true}],['card',['show',card.meta.id],{review:true}],['stats',[],{}],['today',[],{}],['doctor',[],{}],['notes',[id],{}],['diagram',[id,'map'],{}],['chat',[chat.id],{}]] as const) {
 const result=await commands[name]!.run([...args],flags);
 check(!result.exitCode,`command handler ${name} returns successfully`);
 writeFileSync(join(out,`roundtrip-${mode}-${name}.json`),JSON.stringify(result.data,null,2));
}
writeFileSync(join(out,`manifest-${mode}.json`),JSON.stringify({root:lib.root,item:id,card:card.meta.id,sha},null,2));
