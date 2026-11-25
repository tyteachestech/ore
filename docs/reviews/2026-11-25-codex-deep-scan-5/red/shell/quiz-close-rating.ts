// Real ReviewSession + core receipt/review writes; gate the CLI boundary, no native window or AI.
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {rmSync} from 'node:fs';
import {initLibrary} from '../../packages/core/src/init';
import {addSnippet} from '../../packages/core/src/ingest/index';
import {writeNewCard} from '../../packages/core/src/cards';
import {recordReview} from '../../packages/core/src/study';
import {readReviews} from '../../packages/core/src/reviews';
import {startSession,endSession,readSessions} from '../../packages/core/src/sessions';
const g=globalThis as any;
g.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
const {ReviewSession}=await import('../../apps/desktop/src/review-session');
const {setPlayer}=await import('../../apps/desktop/src/sfx');setPlayer(()=>{});
const root=resolve('codex-out/shell/libs/quiz-close-rating');rmSync(root,{recursive:true,force:true});
await initLibrary(root);const lib={root};
const {item}=await addSnippet(lib,{text:'A scratch source written for this test.'});
const c=writeNewCard(lib,{item:item.meta.id,kind:'card',skills:[],topics:[],content_type:'fact',question:'What source?',answer:'A scratch source.',rubric:[]});
const at=new Date('2030-01-02T12:00:00Z');
Date.now=()=>at.getTime();
let release!:()=>void;
const gate=new Promise<void>(r=>release=r);
const calls:string[]=[];let ended:Promise<unknown>|undefined;let logged=0;
const today={goal_minutes:10,goal_ms:600000,active_ms:0,counts:true,met:false,due:1,exercises:1,new_waiting:0,skills:[]};
const run=(async (...args:string[])=>{
  calls.push(args.slice(0,2).join(' '));
  if(args[0]==='session'&&args[1]==='start')return startSession(lib,at,{stack:true});
  if(args[0]==='session'&&args[1]==='end')return ended=endSession(lib,new Date(+at+1),false,args[2]);
  if(args[0]==='today')return today;
  if(args[0]==='due')return [{...c.meta,question:c.question,due:at.toISOString(),relearn:false,retrievability:0}];
  if(args[0]==='review'){
    await gate;
    return recordReview(lib,args[1]!,{rating:3,confidence:2,session:args.find(a=>a.startsWith('--session='))?.slice(10),now:new Date(+at+2)});
  }
  throw Error('Unexpected command '+args.join(' '));
}) as any;
const s=new ReviewSession(true,run);
s.screen={notify:()=>Object.assign(()=>{},{undo(){},hold(){}}),onClose(){},onLogged(){logged++},shown:()=>null,unrated(){},press(){}} as any;
const stop=s.begin();
for(let n=0;n<100&&!s.queue;n++)await new Promise(r=>setTimeout(r,1));
assert(s.queue?.length);
const pending=s.rate({card:{...c.meta,question:c.question,answer:c.answer,rubric:[]},rating:3,answer:'',grade:null,inHead:false,noteSeen:true} as any);
await Promise.resolve();await Promise.resolve();
assert(calls.some(a=>a.startsWith('review ')),'rating has reached held boundary');
const mode=process.argv[2]??'close-first';
if(mode==='write-first-control'){release();await pending;}
// Review cleanup invoked when QuickQuiz closes on blur, shortcut, or Open in source.
stop();s.leave();s.gone();await ended;
if(mode!=='write-first-control'){release();await pending;}
const ends=readSessions(lib).filter(s=>s.type==='end');
const reviews=readReviews(lib);
console.log(`[DEEP] mode=${mode}; saved reviews=${reviews.length}; receipt reviews=${ends.at(-1)?.reviews}; receipt kept=${ends.at(-1)?.kept}; post-close notifications=${logged}`);
assert.equal(reviews.length,1);assert.equal(reviews[0]?.session,ends.at(-1)?.id);
try{assert.equal(ends.at(-1)?.reviews,reviews.length);assert.equal(ends.at(-1)?.kept,1);}
catch{console.error('[DEEP] FAIL: closing during a rating permanently stores a zero-review session receipt');process.exit(1);}
console.log('[DEEP] PASS: receipt includes saved rating');process.exit(0);
