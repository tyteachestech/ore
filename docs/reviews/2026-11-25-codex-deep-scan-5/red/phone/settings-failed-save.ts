import assert from 'node:assert/strict';
import {readFileSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {change} from '../../apps/desktop/src/change';
import {setReviewSettings, reviewSettings} from '../../packages/core/src/skills';
const root=join(import.meta.dir,'libs/settings-failed-save');
rmSync(root,{recursive:true,force:true});mkdirSync(root,{recursive:true});writeFileSync(join(root,'skills.yaml'),'skills: []\n');
const source=readFileSync(join(import.meta.dir,'../../apps/desktop/src/phone/Settings.tsx'),'utf8');
const start=source.indexOf('  const set = <K extends Key>');
const end=source.indexOf('\n  /** On asks iOS',start);
assert.ok(start>=0&&end>start);
const js=new Bun.Transpiler({loader:'tsx'}).transformSync(source.slice(start,end));
let shown:any={goal_minutes:10,weekdays_only:false,new_per_day:10,plan:'',reminder:''};
const now={current:shown};
let disk=10, calls=0, fail!:(e:Error)=>void;
let began!:()=>void;
const started=new Promise<void>(r=>began=r);
const held=new Promise<void>((_,r)=>fail=r);
const mode=process.argv[2]??'overlap';
const errors:string[]=[];
const notify=(message:string,kind?:string)=>{ if(kind==='error') errors.push(message); return Object.assign(()=>{},{undo(){},hold(){}}); };
const ore=async(_cmd:string,option:string)=>{ if(++calls===1) { began(); await held; } disk=(await setReviewSettings({root},{goal_minutes:Number(option.split('=')[1])})).goal_minutes; };
const set=new Function('now','change','notify','setReview','ore','opt','planReminders','FLAG','NAME',js+';return set;')(
 now,change,notify,(f:any)=>{shown=f(shown);now.current=shown;},ore,(k:string,v:string)=>`--${k}=${v}`,()=>{},
 {goal_minutes:'minutes'},{goal_minutes:'Minutes a day'});
const first=set('goal_minutes',20);
await started;
let second:Promise<unknown>;
if(mode==='serial') {fail(new Error('write refused'));await first;second=set('goal_minutes',30);}
else {second=set('goal_minutes',30);fail(new Error('write refused'));}
await first; await second;
// change() runs its settlement continuation in a microtask.
await Promise.resolve(); await Promise.resolve();
console.log('[DEEP]',JSON.stringify({mode,disk:reviewSettings({root}).goal_minutes,shown:shown.goal_minutes,calls,errors}));
assert.equal(shown.goal_minutes,disk,'A failed older settings save must not hide the newer goal that saved');
