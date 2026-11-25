import { mkdirSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { planCourse, addCourse } from '../../packages/core/src/ingest/course.ts';
import { courseLessons } from '../../packages/core/src/courses.ts';
const mode=process.argv[2]??'insert';
const root=resolve(`codex-out/courses/libs/playlist-${mode}`);
rmSync(root,{recursive:true,force:true});mkdirSync(root,{recursive:true});
const lib={root};
const bin=resolve('codex-out/courses/bin');mkdirSync(bin,{recursive:true});
for(const name of ['yt-dlp','claude','codex']){writeFileSync(`${bin}/${name}`,'#!/bin/sh\nexit 99\n');chmodSync(`${bin}/${name}`,0o755);}
process.env.PATH=`${bin}:${process.env.PATH}`;process.env.ORE_NO_ENRICH='1';
const url='https://www.youtube.com/playlist?list=PL_course_test';
const A='aaaaaaaaaaa',B='bbbbbbbbbbb',N='nnnnnnnnnnn';
let entries:any[]=[{id:A,title:'Alpha'}];
const calls:string[]=[];
// Stub the process boundary, not course logic: no child process or network is started.
Bun.spawn=((args:string[])=>{
 assert.equal(args[0],`${bin}/yt-dlp`,'all non-fixture subprocesses refused');
 const at=args.at(-1)!;calls.push(at);
 const info=args.includes('--flat-playlist')?{title:'Playlist',webpage_url:url,entries}:{title:at.includes(A)?'Alpha':at.includes(B)?'Beta':'New',webpage_url:at,channel:'Fixture teacher',subtitles:{en:[{ext:'vtt',url:'https://fixture.test/captions'}]}};
 return {stdout:new Response(JSON.stringify(info)).body,stderr:new Response('').body,exited:Promise.resolve(0)};
}) as typeof Bun.spawn;
globalThis.fetch=(async(input:any)=>String(input)==='https://fixture.test/captions'?new Response('WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nA complete fixture lesson about how to learn.\n'):new Response('',{status:404})) as typeof fetch;
if(mode==='private') entries=[{id:A,title:'Alpha'},{id:'private____',title:'[Private video]'},{id:'deleted____',title:'[Deleted video]'},{id:B,title:'Beta'}];
const p1=await planCourse(url);const first=await addCourse(lib,p1);assert.equal(first.failed.length,0);
if(mode==='private') {assert.deepEqual(p1.lessons.map(l=>l.title),['Alpha','Beta']);console.log('[DEEP] PASS private/deleted omitted, readable videos ordered',courseLessons(lib,first.course.id).map(i=>i.meta.title));process.exit(0);}
if(mode==='two-courses') {const other=await addCourse(lib,{...p1,title:'Second',url:url+'2'});assert.notEqual(first.course.id,other.course.id);assert.equal(courseLessons(lib,first.course.id)[0]!.meta.url,courseLessons(lib,other.course.id)[0]!.meta.url);console.log('[DEEP] PASS same video retained independently in both courses');process.exit(0);}
entries= mode==='append'?[{id:A,title:'Alpha'},{id:N,title:'New'}]:[{id:N,title:'New'},{id:A,title:'Alpha'}];
const p2=await planCourse(url);const again=await addCourse(lib,p2);const actual=courseLessons(lib,first.course.id).map(i=>({part:i.meta.course!.part,title:i.meta.title,url:i.meta.url}));
console.log('[DEEP]',JSON.stringify({mode,planned:p2.lessons.map(l=>l.title),added:again.added.map(i=>i.meta.title),kept:again.kept,failed:again.failed,actual,calls}));
assert.deepEqual(actual.map(i=>i.url),p2.lessons.map(l=>l.url),'re-import must import the new video and retain each existing video once');
console.log('[DEEP] PASS');
