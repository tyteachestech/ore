import {fresh,sourceCard,snap,git,at,check} from './helpers.ts';
import {addText} from '../../packages/core/src/ingest/index.ts';
import {addSkill,setItemSkills,loadSkills} from '../../packages/core/src/skills.ts';
import {writeNewCard} from '../../packages/core/src/cards.ts';
import {addHighlight,reviseAnnotation,readAnnotations} from '../../packages/core/src/annotations.ts';
import {setNotes} from '../../packages/core/src/notes.ts';
import {openIndex,rebuildIndex} from '../../packages/core/src/db.ts';
import {recordReview,dueQueue,libraryStats,cardHistory} from '../../packages/core/src/study.ts';
import {startSession,endSession,readSessions} from '../../packages/core/src/sessions.ts';
import {readReviews} from '../../packages/core/src/reviews.ts';
import {today,skillGrowth} from '../../packages/core/src/today.ts';
import {doctor} from '../../packages/core/src/doctor.ts';
import {findItem,listItems} from '../../packages/core/src/items.ts';
const mode=process.argv[2]??'reset';
const lib=await fresh('membership-'+mode),{item,card}=await sourceCard(lib);
const ann=addHighlight(item,{exact:'Beta paragraph.',intent:'keep',note:'Older annotation note'});
await startSession(lib,at(0)); await recordReview(lib,card.meta.id,{rating:3,confidence:2,elapsed_ms:30000,now:at(0,1)});await endSession(lib,at(0,2));
function view(){
 const idx=openIndex(lib);const cards=idx.cards().sort((a,b)=>a.id.localeCompare(b.id));const items=idx.items().sort((a,b)=>a.id.localeCompare(b.id));const hits=idx.search('annotation');idx.close();
 return {cards,items,hits,reviews:readReviews(lib),sessions:readSessions(lib),stats:libraryStats(lib),today:today(lib,at(12)),queue:dueQueue(lib,at(12)),growth:skillGrowth(lib,'learning',at(12)),history:cardHistory(lib,card.meta.id,at(12))};
}
const before=view(),base=snap(lib);
const skill=await addSkill(lib,'Rollback only skill');
const newer=await addText(lib,'# After baseline\n\nThis source was added later.\n');await setItemSkills(lib,newer.meta.id,[skill.id]);await setNotes(lib,{skill:skill.id},'Brandnewskillnote');
const newCard=writeNewCard(lib,{kind:'card',item:newer.meta.id,skills:[skill.id],topics:[],content_type:'fact',question:'New question?',answer:'New answer',rubric:[]});
reviseAnnotation(findItem(lib,item.meta.id),ann,{note:'Newer annotation note',status:'deleted'});
await startSession(lib,at(2));await recordReview(lib,card.meta.id,{rating:1,confidence:1,elapsed_ms:60000,now:at(2,1)});await endSession(lib,at(2,2));
// A new month file is not in the baseline tree. Checkout overlays it; reset deletes it.
await startSession(lib,at(11));await recordReview(lib,newCard.meta.id,{rating:3,confidence:2,elapsed_ms:90000,now:at(11,1)});await endSession(lib,at(11,2));
view();snap(lib,11);
if(mode==='checkout')git(lib,'checkout',base,'--','.');else git(lib,'reset','--hard',base);
const restored=view();rebuildIndex(lib);const rebuilt=view();
for(const k of Object.keys(restored) as (keyof typeof restored)[])check(JSON.stringify(restored[k])===JSON.stringify(rebuilt[k]),`${mode}: incremental ${k} equals a fresh index`);
check(readAnnotations(findItem(lib,item.meta.id))[0]?.note===ann.note,'annotation log shrink restores earlier highlight revision');
check(!loadSkills(lib).skills.some(s=>s.id===skill.id),'skills.yaml removes later skill');
if(mode==='reset'){
 for(const k of Object.keys(before) as (keyof typeof before)[])check(JSON.stringify(before[k])===JSON.stringify(restored[k]),`hard reset restores baseline ${k}`);
 check(!listItems(lib).some(x=>x.meta.id===newer.meta.id),'new source disappears on reset');
 check((await doctor(lib)).ok,'doctor healthy after complete reset');
}else{
 check(listItems(lib).some(x=>x.meta.id===newer.meta.id),'checkout overlay retains later source as Git specifies');
 check(readReviews(lib).some(r=>r.card===newCard.meta.id),'checkout overlay retains new monthly review log');
 const issues=(await doctor(lib)).issues;
 check(issues.some(i=>i.message.includes('unknown skill')),'doctor identifies missing skill on retained source/exercise',issues);
}
