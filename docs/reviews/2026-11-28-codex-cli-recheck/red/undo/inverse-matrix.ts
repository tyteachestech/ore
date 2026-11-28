import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {core,seed,snap,diff,artifact,tick} from './common.ts';
import {commands} from '../../packages/cli/src/commands.ts';
const cases=['archive','pin','cut','page-text','skills-rm','skills-archive','course-archive','review','chat-delete','variant-reject','card-retire','tried','tried-next','tried-again','dig','edit-skills','suggested-skill','suggested-archived','inbox','session','annotate','status'];
const selected=process.argv[2], modes=process.argv[3]?[process.argv[3]]:['plain','intervening','reindex'];
const results:any[]=[];
const norm=(x:any):any=>Array.isArray(x)?x.map(norm):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().filter(k=>x[k]!==undefined).map(k=>[k,norm(x[k])])):x;
const same=(a:any,b:any)=>JSON.stringify(norm(a))===JSON.stringify(norm(b));
for(const name of selected&&selected!=='all'?[selected]:cases)for(const mode of modes){
 const {lib,item,ann,card}=await seed('inverse-'+name+'-'+mode);
 if(mode==='mature'){core.writeCardMeta(card,{...card.meta,created:'2026-11-01T18:00:00.000Z'});for(const [date,rating] of [['2026-11-01',3],['2026-11-07',3],['2026-11-20',1]] as const)await core.recordReview(lib,card.meta.id,{rating,confidence:2,now:new Date(date+'T18:00:00.000Z')});}
 const cmd=async(c:string,p:string[]=[],f:Record<string,any>={})=>(await commands[c]!.run(p,f)).data as any;
 const id=item.meta.id,cid=card.meta.id,aid=ann.id;
 let forward:()=>Promise<any>,undo:(r:any)=>Promise<any>,redo:((r:any)=>Promise<any>)|undefined;
 switch(name){
 case 'archive':forward=()=>cmd('archive',[id]);undo=()=>cmd('archive',[id],{undo:true});break;
 case 'pin':forward=()=>cmd('pin',[id]);undo=()=>cmd('pin',[id],{undo:true});break;
 case 'cut': forward=()=>cmd('cut',[id],{from:String(item.body.indexOf('Beta')),to:String(item.body.indexOf('Beta')+1)});undo=r=>cmd('cut',[id],{undo:r.id});redo=r=>cmd('cut',[id],{redo:r.id});break;
 case 'page-text':writeFileSync(join(item.dir,'page.html'),'<html><head><title>Episode</title></head><body><article><h1>Episode notes</h1><p>'+('A useful lesson about practice and spacing with examples to learn from. '.repeat(20))+'</p></article></body></html>'); forward=()=>cmd('page-text',[id]);undo=r=>cmd('page-text',[id],{undo:r.id});redo=r=>cmd('page-text',[id],{redo:r.id});break;
 case 'skills-rm-plain':forward=()=>cmd('skills',['rm','learning']);undo=r=>cmd('skills',['restore',JSON.stringify(r.removed)]);break;
 case 'skills-rm':forward=()=>cmd('skills',['rm','learning'],{archive:true});undo=r=>cmd('skills',['restore',JSON.stringify(r.removed)]);break;
 case 'skills-archive':forward=()=>cmd('skills',['archive','learning']);undo=()=>cmd('skills',['archive','learning'],{undo:true});break;
 case 'course-all':case 'course-archive':{
  const lesson=await core.addText(lib,'# Other lesson\n\nAnother complete lesson.');
  for(const [i,l] of [item,lesson].entries())await core.updateItemMeta(lib,l.meta.id,m=>({...m,course:{id:'course-one',title:'A course',part:i+1,url:'https://example.test/course'}}));
  if(name==='course-archive')await core.setItemArchived(lib,lesson.meta.id,true);
  forward=()=>cmd('course',['archive','course-one']);undo=r=>cmd('course',['archive','course-one'],name==='course-all'?{undo:true}:{undo:true,lessons:r.lessons.join(',')});break;
 }
 case 'review':forward=()=>cmd('review',[cid],{rating:'3',confidence:'2',answer:'Spacing'});undo=r=>cmd('review',[cid],{undo:r.ts});break;
 case 'chat-delete':await core.saveChat(lib,JSON.stringify({id:'chat-one',title:'My learning',turns:[{id:'turn-one',message:'My words',reply:'A fixed reply'}]}));forward=()=>core.deleteChat(lib,'chat-one');undo=r=>core.saveChat(lib,JSON.stringify(r),{touch:false});break;
 case 'variant-reject':writeFileSync(core.paths.variants(lib,cid),JSON.stringify({id:'V1',rev:1,card:cid,type:'new-case',setting:'garden',question:'What helps?',answer:'Spacing.',rubric:['Spacing'],maps:[0],status:'ready',created:new Date().toISOString(),ai:{vendor:'claude',model:'stub',prompt_version:'variant@1'}})+'\n');forward=()=>cmd('variant',['reject',cid,'V1'],{reason:'Unclear'});undo=()=>cmd('variant',['restore',cid,'V1']);break;
 case 'card-retire':forward=()=>cmd('card',['retire',cid]);undo=()=>cmd('card',['restore',cid],{state:'draft'});break;
 case 'tried':forward=()=>cmd('tried',[aid]);undo=()=>cmd('tried',[aid],{undo:true});break;
 case 'tried-next':forward=()=>cmd('tried',[aid],{next:'Try after lunch'});undo=async()=>{await cmd('tried',[aid],{undo:true});return cmd('tried',[aid],{undo:true});};break;
 case 'tried-again':forward=()=>cmd('tried',[aid],{again:true});undo=async()=>{await cmd('tried',[aid],{undo:true});return cmd('tried',[aid],{undo:true});};break;
 case 'dig':await core.setSkillLook(lib,'learning',{goal:'Explain how learning works'});forward=()=>cmd('dig',['learning'],{text:'Recall and spacing help'});undo=r=>cmd('dig',['learning'],{drop:r.id});break;
 case 'edit-skills':await core.addSkill(lib,'Gardening');core.ensureTopic(lib,{slug:'memory',name:'Memory',status:'active',skills:['learning']});await core.updateItemMeta(lib,id,m=>({...m,topics:['memory']}));forward=()=>cmd('edit',[id],{skills:'gardening'});undo=r=>cmd('edit',[id],{skills:'learning',cards:JSON.stringify(r.cards_before)});break;
 case 'suggested-skill':case 'suggested-archived':
  await core.updateItemMeta(lib,id,m=>({...m,suggested_skill:{name:'Gardening',hook:'Grow plants'}}));
  if(name==='suggested-archived'){await core.addSkill(lib,'Gardening');await core.archiveSkill(lib,'gardening',true);}
  forward=()=>cmd('suggested-skill',[id,'accept']);undo=r=>cmd('suggested-skill',[id,'undo',JSON.stringify(r.undo)]);break;
 case 'inbox-link':{const q=core.queueLink(lib,'https://example.test/lesson',[]);forward=()=>cmd('inbox',[],{remove:q.id,keep:true});undo=()=>cmd('inbox',[],{restore:q.id});break;}
 case 'inbox':{const q=core.queueFile(lib,item.docPath,[],'lesson.md');forward=()=>cmd('inbox',[],{remove:q.id,keep:true});undo=()=>cmd('inbox',[],{restore:q.id});break;}
 case 'session':{const s=await core.startSession(lib);forward=()=>core.endSession(lib,new Date(),false,s.id);undo=()=>core.reopenSession(lib,s.id);break;}
 case 'annotate':forward=()=>cmd('annotate',[aid],{status:'deleted'});undo=()=>cmd('annotate',[aid],{status:'open'});break;
 case 'status':await core.setItemStatus(lib,id,'done','2026-11-20T12:00:00.000Z');forward=()=>cmd('status',[id,'reading']);undo=()=>cmd('status',[id,'done'],{at:'2026-11-20T12:00:00.000Z'});break;
 default:throw Error(name);
 }
 const state=()=>({items:core.allItems(lib).map(i=>({meta:i.meta,body:i.body,annotations:core.readAnnotations(i).map(({rev,ts,uses,...a})=>({...a,...(uses?.length?{uses}:{})}))})),cards:core.listCards(lib).map(({path,...c})=>c),skills:core.loadSkills(lib),topics:core.listTopics(lib),reviews:core.readReviews(lib),variants:core.readVariants(lib,cid).map(({rev,...v})=>v),chats:core.listChats(lib).map(c=>core.readChat(lib,c.id)),inbox:core.queuedLinks(lib),digs:core.readDigs(lib,'learning'),open:core.openSessionIds(lib)});
 try{
  const before=snap(lib.root),expected=state();
  const viewsBefore={ls:await cmd('ls'),due:await cmd('due',[],{all:true}),search:await cmd('search',['spacing'])};
  const r=await forward!();
  if(mode==='intervening'){await core.renameItem(lib,id,'Renamed independently');expected.items.find(i=>i.meta.id===id)!.meta.title='Renamed independently';}
  if(mode==='reindex')core.rebuildIndex(lib);
  await undo!(r);
  const actual=state(),deltas=diff(before,snap(lib.root));
  const viewsAfter={ls:await cmd('ls'),due:await cmd('due',[],{all:true}),search:await cmd('search',['spacing'])};
  core.rebuildIndex(lib);
  const viewsFresh={ls:await cmd('ls'),due:await cmd('due',[],{all:true}),search:await cmd('search',['spacing'])};
  const mismatches=Object.keys(expected).filter(k=>!same((expected as any)[k],(actual as any)[k]));
  let redoError:string|undefined;
  if(redo){try{await redo(r);await undo!(r);if(!same(state(),expected))redoError='state differs after redo/undo';}catch(e){redoError=String(e);}}
  const row={name,mode,semanticPass:!mismatches.length,indexPass:same(viewsAfter,viewsFresh),mismatches,deltas,expected,actual,viewsBefore,viewsAfter,viewsFresh,redoError};results.push(row);
  console.log('[DEEP]',JSON.stringify({name,mode,semanticPass:row.semanticPass,indexPass:row.indexPass,mismatches,changed:deltas.map(d=>d.path),redoError}));
 }catch(e){results.push({name,mode,error:String(e)});console.log('[DEEP]',JSON.stringify({name,mode,error:String(e)}));}
}
artifact(selected?'inverse-'+selected+'-'+(process.argv[3]??'modes')+'.json':'inverse-matrix.json',results);
if(selected)assert.ok(results.every(r=>r.semanticPass&&r.indexPass&&!r.redoError),'Inverse must restore the prior state and keep the index current');
