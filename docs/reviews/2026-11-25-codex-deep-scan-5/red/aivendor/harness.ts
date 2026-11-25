import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { initLibrary } from '../../packages/core/src/init.ts';
export const base=resolve(import.meta.dir);
process.env.SCOUT_DIR=base;
process.env.PATH=join(base,'bin')+':/usr/bin:/bin';
process.env.ORE_NO_ENRICH='1';
process.env.TMPDIR=join(base,'tmp');
process.env.CODEX_HOME=join(base,'fake-codex-home');
delete process.env.ORE_AI_MODEL;
mkdirSync(process.env.TMPDIR,{recursive:true});
mkdirSync(process.env.CODEX_HOME,{recursive:true});
export async function library(name:string){
 const root=join(base,'libs',name); rmSync(root,{recursive:true,force:true}); await initLibrary(root); process.env.ORE_LIBRARY=root; return {root};
}
export function fake(cases:any[],vendor='claude'){
 process.env.ORE_AI=vendor;
 writeFileSync(join(base,'queue.json'),JSON.stringify(cases)); writeFileSync(join(base,'count'),'0'); writeFileSync(join(base,'calls.jsonl'),'');
 for(const f of ['ready','release'])rmSync(join(base,f),{force:true});
}
export function calls(){return readFileSync(join(base,'calls.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l));}
export async function ready(){const until=Date.now()+6000;while(!existsSync(join(base,'ready'))){if(Date.now()>until)throw Error('fake did not start');await new Promise(r=>setTimeout(r,5));}}
export function release(){writeFileSync(join(base,'release'),'yes');}
export function check(ok:unknown, text:string){console.log(`[DEEP] ${ok?'PASS':'FAIL'} ${text}`);if(!ok) process.exitCode=1;}
