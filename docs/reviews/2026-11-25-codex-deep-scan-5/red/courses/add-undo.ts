import assert from 'node:assert/strict';
import {mkdirSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {addCourse,type CoursePlan} from '../../packages/core/src/ingest/course.ts';
import {courseLessons,setCourseArchived,setCourseSkills} from '../../packages/core/src/courses.ts';
import {findItem,setItemArchived} from '../../packages/core/src/items.ts';
const root=resolve('codex-out/courses/libs/add-undo');rmSync(root,{recursive:true,force:true});mkdirSync(root,{recursive:true});writeFileSync(`${root}/skills.yaml`,'skills: []\n');
const lib={root};process.env.ORE_NO_ENRICH='1';
globalThis.fetch=(async(input:any)=>new Response(`<html><head><title>Lesson</title></head><body><article><h1>Lesson</h1>${('<p>Learning takes practice. This fixture has the full text of one course lesson and examples to explain its subject.</p>').repeat(6)}</article></body></html>`,{headers:{'content-type':'text/html'}})) as typeof fetch;
const plan=(names:string[]):CoursePlan=>({title:'Course',url:'https://fixture.test/course',lessons:names.map(title=>({title,url:`https://fixture.test/${title}`}))});
const first=await addCourse(lib,plan(['old']));const old=first.added[0]!;await setItemArchived(lib,old.meta.id,true);
const mode=process.argv[2]??'gained';
const nextPlan=plan(mode==='control'?['old']:['old','new']);
let receipt:any;const calls:string[]=[];
const ore=async(...args:string[])=>{calls.push(args.join(' '));if(args[0]==='archive')return setItemArchived(lib,args[1]!,!args.includes('--undo'));if(args[0]==='course'&&args[1]==='archive')return setCourseArchived(lib,args[2]!,!args.includes('--undo'),args.find(s=>s.startsWith('--lessons='))?.slice(10).split(','));throw new Error(`unexpected ${args}`);};
let undo:(()=>Promise<unknown>)|undefined;
const app=readFileSync('apps/desktop/src/App.tsx','utf8');
const block=app.split('const addSources = useCallback(')[1]!.split('[notify, progress, refresh, skills, openSource, reloadSkills],')[0]!;
const source=`return (${block.trim().replace(/,$/,'')});`;
const env:any={
 PHONE:true,skills:[],viewRef:{current:{openId:null}},progress(){},refresh:async()=>{},reloadSkills(){},
 addArgs:()=>({args:['add',nextPlan.url,'--course'],stdin:null}),listen:async()=>()=>{},
 oreJob:async()=>{const r=await addCourse(lib,nextPlan);receipt=r;const lessons=courseLessons(lib,r.course.id);return {...r,lessons:r.added.map(i=>({id:i.meta.id,title:i.meta.title})),skills:lessons[0]!.meta.skills,first:{...lessons[0]!.meta}};},
 ore,opt:(k:string,v:string)=>`--${k}=${v}`,count:(n:number,t:string)=>`${n} ${t}${n===1?'':'s'}`,
 notify:(_s:string,_k:string,u:any)=>{undo=u;},setStatus(){},setPlace(){},setSkill(){},setCursor(){},setOpenId(){},setFinishing(){},clearToast(){},openSource(){},errorText:(e:Error)=>e.message
};
const addSources=new Function(...Object.keys(env),new Bun.Transpiler({loader:'ts'}).transformSync(source))(...Object.values(env));
await addSources([{kind:'url',url:nextPlan.url}],[]);assert.ok(undo,'add should have undo');assert.equal(!!findItem(lib,old.meta.id).meta.archived_at,false);
await undo();
const actual=courseLessons(lib,first.course.id,{archived:true}).map(i=>({title:i.meta.title,archived:!!i.meta.archived_at}));
console.log('[DEEP]',JSON.stringify({mode,restored:receipt.restored.length,added:receipt.added.length,calls,actual}));
assert.equal(!!findItem(lib,old.meta.id).meta.archived_at,true,'Undo must rearchive the old lesson this re-add restored');
console.log('[DEEP] PASS');
